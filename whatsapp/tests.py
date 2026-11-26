import json
from datetime import time, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Coupon, Service
from clients.models import Client
from professionals.models import Professional
from scheduling.models import Appointment, AppointmentItem
from .bot import process_whatsapp_message
from .models import (
    CRMLead,
    WhatsAppCampaign,
    WhatsAppConversation,
    WhatsAppHumanQueueEntry,
    WhatsAppMessage,
    WhatsAppSettings,
)
from .views import _build_evolution_webhook_url


class WhatsAppCRMTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_superuser(
            username='owner_test',
            email='owner@test.com',
            password='pass1234',
        )
        self.barber_user = User.objects.create_user(
            username='barber_test',
            password='pass1234',
        )
        self.barber = Professional.objects.create(
            user=self.barber_user,
            display_name='Matheus Teste',
            slug='matheus-teste',
            phone_number='11991112222',
        )
        self.service = Service.objects.create(
            name='Corte Fade',
            category=Service.Category.HAIR,
            price=Decimal('60.00'),
            promotion_price=Decimal('49.90'),
            duration_minutes=40,
            is_active=True,
        )
        self.coupon = Coupon.objects.create(
            code='VIP15',
            description='15% OFF',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('15.00'),
            is_active=True,
        )
        self.client_obj = Client.objects.create(
            name='Carlos Silva',
            phone_number='11988776655',
            email='carlos@test.com',
        )
        tomorrow = timezone.localdate() + timedelta(days=1)
        self.appt = Appointment.objects.create(
            client=self.client_obj,
            professional=self.barber,
            date=tomorrow,
            start_time=time(15, 0),
            end_time=time(15, 40),
            status=Appointment.Status.CONFIRMED,
            total_duration_minutes=40,
            subtotal_price=Decimal('49.90'),
            total_price=Decimal('49.90'),
        )
        AppointmentItem.objects.create(
            appointment=self.appt,
            service=self.service,
            price=Decimal('49.90'),
            duration_minutes=40,
        )
        self.cfg = WhatsAppSettings.get_solo()

    def test_webhook_rejects_invalid_token(self):
        url = reverse('whatsapp-webhook', kwargs={'token': 'token-invalido'})
        resp = self.client.post(
            url,
            data=json.dumps({'event': 'MESSAGE'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_webhook_accepts_evolution_go_and_deduplicates(self):
        url = reverse(
            'whatsapp-webhook',
            kwargs={'token': self.cfg.effective_webhook_token()},
        )
        payload = {
            'event': 'MESSAGE',
            'instance': 'barberpro',
            'data': {
                'Info': {
                    'ID': 'evo-msg-001',
                    'Chat': '5511988776655@s.whatsapp.net',
                    'PushName': 'Carlos Silva',
                    'FromMe': False,
                },
                'Message': {'Conversation': '1'},
            },
        }
        resp1 = self.client.post(
            url,
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(resp1.status_code, 200)
        conv = WhatsAppConversation.objects.get(phone='5511988776655')
        self.assertEqual(conv.client_id, self.client_obj.id)
        self.assertEqual(conv.unread_count, 1)
        msg_count_after_first = conv.messages.count()
        self.assertEqual(msg_count_after_first, 2)

        # Reenvio do mesmo ID não deve duplicar mensagens
        resp2 = self.client.post(
            url,
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(conv.messages.count(), msg_count_after_first)

    def test_bot_menu_appointment_lookup_and_cancel(self):
        replies = []
        process_whatsapp_message(
            '11988776655',
            '3',
            push_name='Carlos',
            simulate_buffer=replies,
        )
        self.assertEqual(len(replies), 1)
        self.assertIn('Matheus Teste', replies[0])
        self.assertIn('Corte Fade', replies[0])

        cancel_replies = []
        process_whatsapp_message(
            '11988776655',
            'CONFIRMAR CANCELAMENTO',
            push_name='Carlos',
            simulate_buffer=cancel_replies,
        )
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.Status.CANCELED)

    def test_bot_human_queue_and_opt_out(self):
        buf = []
        process_whatsapp_message(
            '11988776655',
            '5',
            push_name='Carlos',
            simulate_buffer=buf,
        )
        self.assertTrue(
            WhatsAppHumanQueueEntry.objects.filter(
                phone='5511988776655',
                status=WhatsAppHumanQueueEntry.STATUS_WAITING,
            ).exists()
        )

        # Enquanto está na fila humana, texto comum não dispara menu do bot
        quiet_buf = []
        process_whatsapp_message(
            '11988776655',
            'Preciso falar sobre um corte infantil',
            push_name='Carlos',
            simulate_buffer=quiet_buf,
        )
        self.assertEqual(quiet_buf, [])

        # Opt-out funciona sempre
        opt_buf = []
        process_whatsapp_message(
            '11988776655',
            'PARAR',
            push_name='Carlos',
            simulate_buffer=opt_buf,
        )
        self.client_obj.refresh_from_db()
        self.assertFalse(self.client_obj.whatsapp_opt_in)

    def test_admin_endpoints_inbox_send_campaign_and_simulator(self):
        self.api.force_authenticate(user=self.admin)

        sim_resp = self.api.post(
            '/api/admin/whatsapp/simulate/',
            {'phone': '5511977001122', 'message': '2', 'push_name': 'Lucas'},
            format='json',
        )
        self.assertEqual(sim_resp.status_code, 200)
        self.assertIn('VIP15', sim_resp.data['replies'][0])
        self.assertTrue(
            CRMLead.objects.filter(phone='5511977001122').exists()
        )

        conv_id = sim_resp.data['conversation_id']
        send_resp = self.api.post(
            f'/api/admin/whatsapp/conversations/{conv_id}/send/',
            {'text': 'Fala Lucas! Posso te ajudar no horário?'},
            format='json',
        )
        self.assertEqual(send_resp.status_code, 201)
        self.assertEqual(
            send_resp.data['message']['status'],
            WhatsAppMessage.STATUS_SIMULATED,
        )

        ctx_resp = self.api.get(
            f'/api/admin/whatsapp/conversations/{conv_id}/contact/'
        )
        self.assertEqual(ctx_resp.status_code, 200)
        self.assertIsNotNone(ctx_resp.data['lead'])

        # Campanha respeita opt-in
        camp_resp = self.api.post(
            '/api/admin/whatsapp/campaigns/',
            {
                'title': 'Oferta Relâmpago',
                'audience': WhatsAppCampaign.Audience.ALL_OPT_IN,
                'coupon': str(self.coupon.id),
                'message': 'Olá {nome}, use {cupom} em {link}',
            },
            format='json',
        )
        self.assertEqual(camp_resp.status_code, 201)
        camp_id = camp_resp.data['id']
        fire_resp = self.api.post(
            f'/api/admin/whatsapp/campaigns/{camp_id}/send/'
        )
        self.assertEqual(fire_resp.status_code, 200)
        self.assertEqual(fire_resp.data['campaign']['recipients_count'], 1)

    @override_settings(EVOLUTION_WEBHOOK_BASE_URL='')
    def test_webhook_url_builder_rewrites_localhost_for_docker(self):
        factory = RequestFactory()
        req = factory.get(
            '/api/admin/whatsapp/qrcode/',
            HTTP_HOST='localhost:5173',
        )
        self.cfg.api_url = 'http://127.0.0.1:4000'
        local_url = _build_evolution_webhook_url(req, self.cfg)
        self.assertTrue(
            local_url.startswith(
                'http://host.docker.internal:8000/webhook/whatsapp/'
            )
        )

        self.cfg.api_url = 'https://evo.barberpro.com.br'
        remote_url = _build_evolution_webhook_url(req, self.cfg)
        self.assertTrue(
            remote_url.startswith('http://localhost:5173/webhook/whatsapp/')
        )
