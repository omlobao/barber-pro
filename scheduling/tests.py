from datetime import date, time, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Coupon, Service
from clients.models import Client
from professionals.models import (
    Professional,
    ScheduleException,
    WorkingHours,
)
from .models import Appointment
from .services import create_booking, get_available_slots


class SchedulingEngineTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='barber1',
            password='password123',
            is_staff=True,
        )
        self.service = Service.objects.create(
            name='Corte Degradê',
            price=Decimal('50.00'),
            duration_minutes=30,
        )
        self.professional = Professional.objects.create(
            user=self.user,
            display_name='Matheus Barber',
            slug='matheus-barber',
            phone_number='11999990001',
            service_comission_rate=Decimal('50.00'),
            slot_interval_minutes=30,
            buffer_time_minutes=0,
        )
        self.professional.services.add(self.service)

        # Configura uma data futura garantida
        self.target_date = timezone.localdate() + timedelta(days=5)
        WorkingHours.objects.create(
            professional=self.professional,
            day_of_week=self.target_date.isoweekday(),
            is_working=True,
            start_time=time(9, 0),
            end_time=time(12, 0),
            break_start=time(10, 0),
            break_end=time(10, 30),
        )
        self.api = APIClient()

    def test_get_available_slots_respects_break_and_working_hours(self):
        slots = get_available_slots(
            self.professional,
            self.target_date,
            duration_minutes=30,
        )
        # 09:00-12:00 com pausa 10:00-10:30
        self.assertEqual(
            slots,
            ['09:00', '09:30', '10:30', '11:00', '11:30'],
        )

    def test_holiday_blocks_all_slots(self):
        ScheduleException.objects.create(
            professional=None,
            date=self.target_date,
            exception_type=ScheduleException.ExceptionType.HOLIDAY,
            is_all_day=True,
        )
        slots = get_available_slots(
            self.professional,
            self.target_date,
            duration_minutes=30,
        )
        self.assertEqual(slots, [])

    def test_create_booking_and_prevent_double_booking(self):
        appointment = create_booking(
            professional=self.professional,
            service_ids=[self.service.id],
            target_date=self.target_date,
            start_time=time(9, 0),
            client_name='Carlos Cliente',
            client_phone='(11) 98888-7777',
        )
        self.assertEqual(appointment.total_price, Decimal('50.00'))
        self.assertEqual(appointment.items.count(), 1)

        # Tentar agendar no mesmo horário deve lançar ValidationError
        with self.assertRaises(ValidationError):
            create_booking(
                professional=self.professional,
                service_ids=[self.service.id],
                target_date=self.target_date,
                start_time=time(9, 0),
                client_name='Outro Cliente',
                client_phone='11977776666',
            )

    def test_blocked_client_cannot_book(self):
        Client.objects.create(
            name='Cliente Bloqueado',
            phone_number='11966665555',
            is_blocked=True,
        )
        with self.assertRaises(ValidationError):
            create_booking(
                professional=self.professional,
                service_ids=[self.service.id],
                target_date=self.target_date,
                start_time=time(9, 30),
                client_name='Cliente Bloqueado',
                client_phone='11966665555',
            )

    def test_public_booking_requires_client_auth_and_applies_coupon(self):
        coupon = Coupon.objects.create(
            code='BEMVINDO10',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            only_first_visit=True,
        )
        create_url = reverse('public-booking-create')
        payload = {
            'professional_id': str(self.professional.id),
            'service_ids': [str(self.service.id)],
            'date': self.target_date.strftime('%Y-%m-%d'),
            'start_time': '11:00',
            'coupon_code': 'bemvindo10',
        }

        # Sem autenticação do cliente, o agendamento online é bloqueado (401)
        unauth_resp = self.api.post(create_url, payload, format='json')
        self.assertEqual(unauth_resp.status_code, 401)

        # Cadastra o cliente online e agenda usando o token retornado
        reg_resp = self.api.post(
            reverse('client-register'),
            {
                'name': 'Lucas Faltoso',
                'phone_number': '(11) 95555-4444',
                'email': 'lucas.cli@example.com',
                'password': 'cliente123',
            },
            format='json',
        )
        self.assertEqual(reg_resp.status_code, 201)
        access_token = reg_resp.data['access']

        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        resp = self.api.post(create_url, payload, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['subtotal_price'], '50.00')
        self.assertEqual(resp.data['discount_amount'], '5.00')
        self.assertEqual(resp.data['total_price'], '45.00')
        self.assertEqual(resp.data['coupon_code'], 'BEMVINDO10')
        app_id = resp.data['id']

        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 1)

        # Marca falta pelo endpoint administrativo e verifica no_show_count
        self.api.credentials()
        self.api.force_authenticate(user=self.user)
        no_show_url = reverse(
            'admin-appointments-mark-no-show',
            args=[app_id],
        )
        ns_resp = self.api.post(no_show_url)
        self.assertEqual(ns_resp.status_code, 200)
        self.assertEqual(ns_resp.data['status'], Appointment.Status.NO_SHOW)

        client = Client.objects.get(phone_number='11955554444')
        self.assertEqual(client.no_show_count, 1)
