from datetime import timedelta
from decimal import Decimal
import hashlib
import hmac
import json
import logging
import time
from urllib.parse import quote, urlparse
from uuid import uuid4

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Max, Q, Sum
from django.http import HttpResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from clients.models import Client
from core.permissions import IsBarberShopStaff, IsOwnerOrReadOnly
from financial.models import Order
from scheduling.models import Appointment
from .bot import (
    clean_phone_number,
    find_client_by_phone,
    process_whatsapp_message,
    send_whatsapp_message,
    upsert_conversation,
)
from .evolution import (
    EvolutionClient,
    EvolutionProviderError,
    evolution_is_connected,
)
from .models import (
    CRMLead,
    WhatsAppCampaign,
    WhatsAppConversation,
    WhatsAppHumanQueueEntry,
    WhatsAppMessage,
    WhatsAppSettings,
)
from .serializers import (
    CRMLeadSerializer,
    WhatsAppCampaignSerializer,
    WhatsAppConversationSerializer,
    WhatsAppHumanQueueSerializer,
    WhatsAppMessageSerializer,
    WhatsAppSettingsSerializer,
)

logger = logging.getLogger(__name__)
WHATSAPP_TAG = '8. Painel — WhatsApp CRM & Automação'


def _extract_webhook_fields(update: dict, raw_body: bytes):
    """Extrai telefone, texto, nome e id de eventos Evolution GO ou legado."""
    webhook_event = str(update.get('event') or update.get('type') or '')
    instance = str(
        update.get('instance') or update.get('instanceName') or ''
    ).strip()
    data = update.get('data') or update
    if not isinstance(data, dict):
        return None

    info = data.get('Info') or data.get('info') or {}
    key = data.get('key') or {}
    if not isinstance(info, dict):
        info = {}
    if not isinstance(key, dict):
        key = {}

    from_me = (
        key.get('fromMe')
        or key.get('FromMe')
        or info.get('FromMe')
        or info.get('IsFromMe')
        or data.get('fromMe')
        or data.get('FromMe')
    )
    if from_me:
        return None

    chat_jid = (
        key.get('remoteJid')
        or key.get('RemoteJid')
        or data.get('remoteJid')
        or data.get('RemoteJid')
        or data.get('jid')
        or data.get('chat')
        or data.get('phone')
        or info.get('Chat')
        or ''
    )
    if '@g.us' in str(chat_jid) or '@broadcast' in str(chat_jid):
        return None

    remote_jid = str(chat_jid)
    sender_jid = str(info.get('Sender') or '')
    if '@lid' in remote_jid and '@s.whatsapp.net' in sender_jid:
        remote_jid = sender_jid

    phone = clean_phone_number(remote_jid)
    if not phone:
        return None

    msg_obj = data.get('message') or data.get('Message') or {}
    text = ''
    media_type = ''
    media_name = ''
    if isinstance(msg_obj, dict):
        text = (
            msg_obj.get('conversation')
            or msg_obj.get('Conversation')
            or msg_obj.get('extendedTextMessage', {}).get('text')
            or msg_obj.get('ExtendedTextMessage', {}).get('text')
            or msg_obj.get('imageMessage', {}).get('caption')
            or msg_obj.get('ImageMessage', {}).get('caption')
            or ''
        )
        for m_type, m_key in (
            ('image', 'imageMessage'),
            ('video', 'videoMessage'),
            ('audio', 'audioMessage'),
            ('document', 'documentMessage'),
        ):
            upper_key = m_key[0].upper() + m_key[1:]
            node = msg_obj.get(m_key) or msg_obj.get(upper_key)
            if isinstance(node, dict):
                media_type = m_type
                media_name = (
                    node.get('fileName') or node.get('filename') or ''
                )
                break
        if media_type and not text:
            labels = {
                'image': '[Imagem]',
                'video': '[Vídeo]',
                'audio': '[Áudio]',
                'document': '[Documento]',
            }
            text = labels.get(media_type, '[Mídia]')
        if not text:
            btn = (
                msg_obj.get('buttonsResponseMessage')
                or msg_obj.get('ButtonsResponseMessage')
                or {}
            )
            lst = (
                msg_obj.get('listResponseMessage')
                or msg_obj.get('ListResponseMessage')
                or {}
            )
            sel = (
                lst.get('singleSelectReply')
                or lst.get('SingleSelectReply')
                or {}
            )
            text = (
                btn.get('selectedButtonId')
                or btn.get('SelectedButtonId')
                or sel.get('selectedRowId')
                or sel.get('SelectedRowId')
                or ''
            )
    elif isinstance(data.get('text'), str):
        text = data.get('text', '')

    if not text and webhook_event.lower() in {'buttonclick', 'button_click'}:
        text = str(data.get('buttonId') or data.get('buttonText') or '')

    if not str(text or '').strip():
        return None

    push_name = str(
        data.get('pushName')
        or data.get('PushName')
        or info.get('PushName')
        or (update.get('sender') or {}).get('pushName')
        or ''
    ).strip()

    event_id = str(
        key.get('id')
        or key.get('ID')
        or info.get('ID')
        or data.get('messageId')
        or data.get('MessageID')
        or ''
    ).strip()
    if not event_id:
        event_id = hashlib.sha256(raw_body).hexdigest()

    return {
        'phone': phone,
        'text': str(text).strip(),
        'push_name': push_name,
        'event_id': event_id,
        'instance': instance,
        'media_type': media_type,
        'media_name': media_name,
    }


@csrf_exempt
def whatsapp_webhook(request, token: str):
    """Recebe eventos de mensagens do Evolution GO / Evolution API."""
    cfg = WhatsAppSettings.get_solo()
    expected = cfg.effective_webhook_token()
    if not expected or not hmac.compare_digest(str(token), str(expected)):
        return HttpResponseForbidden('Invalid webhook token')

    if request.method != 'POST':
        return HttpResponseForbidden('Only POST requests are allowed')

    try:
        raw_body = request.body or b'{}'
        update = json.loads(raw_body.decode('utf-8'))
        parsed = _extract_webhook_fields(update, raw_body)
        if parsed:
            process_whatsapp_message(
                parsed['phone'],
                parsed['text'],
                push_name=parsed['push_name'],
                message_id=parsed['event_id'],
                instance_name=parsed['instance'],
            )
    except Exception as exc:
        logger.error('Erro ao processar webhook WhatsApp: %s', exc)
    return HttpResponse('OK')


@extend_schema(tags=[WHATSAPP_TAG], responses={200: OpenApiTypes.OBJECT})
class WhatsAppOverviewView(APIView):
    """Resumo operacional em tempo real do WhatsApp CRM."""

    permission_classes = [IsBarberShopStaff]

    def get(self, request):
        cfg = WhatsAppSettings.get_solo()
        evo = EvolutionClient.from_settings_obj(cfg)
        unread_total = (
            WhatsAppConversation.objects.aggregate(s=Sum('unread_count'))['s']
            or 0
        )
        waiting_queue = WhatsAppHumanQueueEntry.objects.filter(
            status=WhatsAppHumanQueueEntry.STATUS_WAITING
        ).count()
        stage_rows = CRMLead.objects.values('stage').annotate(
            total=Count('id')
        )
        leads_by_stage = {row['stage']: row['total'] for row in stage_rows}
        opt_in_clients = Client.objects.filter(
            is_blocked=False,
            whatsapp_opt_in=True,
        ).count()

        return Response({
            'unread_messages': unread_total,
            'conversations_count': WhatsAppConversation.objects.count(),
            'waiting_queue': waiting_queue,
            'leads_total': CRMLead.objects.count(),
            'leads_by_stage': leads_by_stage,
            'opt_in_clients': opt_in_clients,
            'bot_enabled': cfg.bot_enabled,
            'gateway_configured': evo.is_configured,
            'instance_name': cfg.effective_instance_name(),
        })


@extend_schema(tags=[WHATSAPP_TAG])
class WhatsAppConversationViewSet(viewsets.ReadOnlyModelViewSet):
    """Central de Conversas de WhatsApp (listagem, histórico e resposta)."""

    queryset = WhatsAppConversation.objects.select_related('client').all()
    serializer_class = WhatsAppConversationSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        conv_status = self.request.query_params.get('status', '').strip()
        if search:
            qs = qs.filter(
                Q(contact_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(client__name__icontains=search)
            )
        if conv_status in {'active', 'human', 'closed'}:
            qs = qs.filter(status=conv_status)
        return qs

    @action(detail=False, methods=['post'], url_path='start')
    def start_conversation(self, request):
        raw_phone = request.data.get('phone', '')
        contact_name = str(request.data.get('contact_name', '')).strip()
        clean = clean_phone_number(raw_phone)
        if len(clean) < 12:
            return Response(
                {'detail': 'Informe um número de WhatsApp válido com DDD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cfg = WhatsAppSettings.get_solo()
        conv = upsert_conversation(
            clean,
            contact_name=contact_name,
            instance_name=cfg.effective_instance_name(),
        )
        return Response(
            WhatsAppConversationSerializer(conv).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'], url_path='messages')
    def messages(self, request, pk=None):
        conv = self.get_object()
        msgs = conv.messages.all()
        return Response({
            'conversation': WhatsAppConversationSerializer(conv).data,
            'messages': WhatsAppMessageSerializer(msgs, many=True).data,
        })

    @action(detail=True, methods=['post'], url_path='read')
    def mark_read(self, request, pk=None):
        conv = self.get_object()
        conv.unread_count = 0
        conv.save(update_fields=['unread_count', 'updated_at'])
        conv.messages.filter(
            direction=WhatsAppMessage.DIRECTION_INBOUND,
            status=WhatsAppMessage.STATUS_RECEIVED,
        ).update(status=WhatsAppMessage.STATUS_READ)
        return Response({'ok': True})

    @action(detail=True, methods=['post'], url_path='send')
    def send_manual(self, request, pk=None):
        conv = self.get_object()
        text = str(request.data.get('text', '')).strip()
        if not text or len(text) > 5000:
            return Response(
                {'detail': 'Digite uma mensagem válida para enviar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cfg = WhatsAppSettings.get_solo()
        evo = EvolutionClient.from_settings_obj(cfg)
        instance = conv.instance_name or cfg.effective_instance_name()
        sender_name = (
            request.user.get_full_name() or request.user.username
        )

        if evo.is_configured:
            try:
                evo.send_text(conv.phone, text, instance=instance)
                msg_status = WhatsAppMessage.STATUS_SENT
            except EvolutionProviderError:
                return Response(
                    {
                        'detail': (
                            'Não foi possível entregar a mensagem ao '
                            'Evolution GO. Verifique a conexão do QR Code.'
                        )
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
        else:
            msg_status = WhatsAppMessage.STATUS_SIMULATED

        now = timezone.now()
        with transaction.atomic():
            msg = WhatsAppMessage.objects.create(
                conversation=conv,
                message_id=f'manual-{uuid4()}',
                direction=WhatsAppMessage.DIRECTION_OUTBOUND,
                status=msg_status,
                text=text,
                sender=sender_name,
                sent_at=now,
            )
            conv.last_message_at = now
            conv.last_message_preview = text[:250]
            conv.unread_count = 0
            conv.save(
                update_fields=[
                    'last_message_at',
                    'last_message_preview',
                    'unread_count',
                    'updated_at',
                ]
            )

        wa_url = f'https://wa.me/{conv.phone}?text={quote(text)}'
        return Response(
            {
                'message': WhatsAppMessageSerializer(msg).data,
                'delivered_via_gateway': evo.is_configured,
                'wa_me_url': wa_url,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='status')
    def change_status(self, request, pk=None):
        conv = self.get_object()
        next_status = str(request.data.get('status', '')).strip()
        if next_status not in {'active', 'human', 'closed'}:
            return Response(
                {'detail': 'Status de conversa inválido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        conv.status = next_status
        conv.closed_at = (
            timezone.now() if next_status == 'closed' else None
        )
        conv.save(update_fields=['status', 'closed_at', 'updated_at'])
        if next_status != 'human':
            WhatsAppHumanQueueEntry.objects.filter(
                phone=conv.phone,
                status__in=[
                    WhatsAppHumanQueueEntry.STATUS_WAITING,
                    WhatsAppHumanQueueEntry.STATUS_ASSIGNED,
                ],
            ).update(
                status=WhatsAppHumanQueueEntry.STATUS_CLOSED,
                closed_at=timezone.now(),
            )
        return Response(WhatsAppConversationSerializer(conv).data)

    @action(detail=True, methods=['get'], url_path='contact')
    def contact_context(self, request, pk=None):
        conv = self.get_object()
        client = conv.client or find_client_by_phone(conv.phone)
        if client and conv.client_id != client.id:
            conv.client = client
            conv.save(update_fields=['client', 'updated_at'])

        cfg = WhatsAppSettings.get_solo()
        evo = EvolutionClient.from_settings_obj(cfg)
        avatar_url = ''
        if evo.is_configured and cfg.provider == 'evolution_go':
            try:
                res = evo.get_avatar(conv.phone)
                data = res.get('data', res) if isinstance(res, dict) else {}
                avatar_url = (
                    data.get('URL')
                    or data.get('url')
                    or data.get('profilePictureUrl')
                    or ''
                )
            except EvolutionProviderError:
                pass

        client_payload = None
        next_appt_payload = None
        recent_appts = []
        if client:
            total_spent = (
                Order.objects.filter(
                    client=client,
                    status=Order.Status.PAID,
                ).aggregate(s=Sum('total_amount'))['s']
                or Decimal('0.00')
            )
            today = timezone.localdate()
            next_appt = (
                Appointment.objects.filter(
                    client=client,
                    date__gte=today,
                    status__in=[
                        Appointment.Status.PENDING,
                        Appointment.Status.CONFIRMED,
                        Appointment.Status.IN_PROGRESS,
                    ],
                )
                .select_related('professional')
                .prefetch_related('items__service')
                .order_by('date', 'start_time')
                .first()
            )
            if next_appt:
                next_appt_payload = {
                    'id': str(next_appt.id),
                    'date': next_appt.date,
                    'start_time': next_appt.start_time.strftime('%H:%M'),
                    'professional': next_appt.professional.display_name,
                    'services': [
                        it.service.name for it in next_appt.items.all()
                    ],
                    'total_price': str(next_appt.total_price),
                    'status': next_appt.status,
                }
            for appt in (
                Appointment.objects.filter(client=client)
                .select_related('professional')
                .order_by('-date', '-start_time')[:4]
            ):
                recent_appts.append({
                    'id': str(appt.id),
                    'date': appt.date,
                    'start_time': appt.start_time.strftime('%H:%M'),
                    'professional': appt.professional.display_name,
                    'status': appt.status,
                    'total_price': str(appt.total_price),
                })
            client_payload = {
                'id': str(client.id),
                'name': client.name,
                'phone_number': client.phone_number,
                'email': client.email,
                'notes': client.notes,
                'total_visits': client.total_visits,
                'no_show_count': client.no_show_count,
                'is_blocked': client.is_blocked,
                'whatsapp_opt_in': client.whatsapp_opt_in,
                'total_spent': str(total_spent.quantize(Decimal('0.01'))),
            }

        lead = CRMLead.objects.filter(phone=conv.phone).first()
        queue_entry = WhatsAppHumanQueueEntry.objects.filter(
            phone=conv.phone,
            status__in=[
                WhatsAppHumanQueueEntry.STATUS_WAITING,
                WhatsAppHumanQueueEntry.STATUS_ASSIGNED,
            ],
        ).first()
        queue_payload = None
        if queue_entry:
            pos = 0
            if queue_entry.status == WhatsAppHumanQueueEntry.STATUS_WAITING:
                pos = WhatsAppHumanQueueEntry.objects.filter(
                    status=WhatsAppHumanQueueEntry.STATUS_WAITING,
                    requested_at__lte=queue_entry.requested_at,
                ).count()
            queue_payload = {
                'id': str(queue_entry.id),
                'status': queue_entry.status,
                'position': pos,
                'reason': queue_entry.reason,
            }

        return Response({
            'avatar_url': avatar_url,
            'wa_me_url': f'https://wa.me/{conv.phone}',
            'client': client_payload,
            'next_appointment': next_appt_payload,
            'recent_appointments': recent_appts,
            'lead': CRMLeadSerializer(lead).data if lead else None,
            'queue': queue_payload,
        })


@extend_schema(tags=[WHATSAPP_TAG])
class WhatsAppQueueViewSet(viewsets.ReadOnlyModelViewSet):
    """Fila de Atendimento Humano (assumir ou encerrar chamados)."""

    queryset = WhatsAppHumanQueueEntry.objects.select_related(
        'conversation',
        'assigned_to',
    ).all()
    serializer_class = WhatsAppHumanQueueSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        only_open = self.request.query_params.get('open', 'true')
        if only_open != 'false':
            qs = qs.filter(
                status__in=[
                    WhatsAppHumanQueueEntry.STATUS_WAITING,
                    WhatsAppHumanQueueEntry.STATUS_ASSIGNED,
                ]
            )
        return qs

    @action(detail=True, methods=['post'], url_path='claim')
    def claim(self, request, pk=None):
        entry = self.get_object()
        entry.status = WhatsAppHumanQueueEntry.STATUS_ASSIGNED
        entry.assigned_to = request.user
        entry.assigned_at = timezone.now()
        entry.save(update_fields=['status', 'assigned_to', 'assigned_at'])
        if entry.conversation_id:
            entry.conversation.status = WhatsAppConversation.Status.HUMAN
            entry.conversation.save(update_fields=['status', 'updated_at'])
        return Response(WhatsAppHumanQueueSerializer(entry).data)

    @action(detail=True, methods=['post'], url_path='close')
    def close_entry(self, request, pk=None):
        entry = self.get_object()
        entry.status = WhatsAppHumanQueueEntry.STATUS_CLOSED
        entry.closed_at = timezone.now()
        entry.save(update_fields=['status', 'closed_at'])
        if entry.conversation_id:
            entry.conversation.status = WhatsAppConversation.Status.ACTIVE
            entry.conversation.save(update_fields=['status', 'updated_at'])
        return Response(WhatsAppHumanQueueSerializer(entry).data)


@extend_schema(tags=[WHATSAPP_TAG])
class CRMLeadViewSet(viewsets.ModelViewSet):
    """Gestão do Funil Kanban de Leads do WhatsApp CRM."""

    queryset = CRMLead.objects.select_related('client', 'assigned_to').all()
    serializer_class = CRMLeadSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        stage = self.request.query_params.get('stage', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(phone__icontains=search)
                | Q(interest__icontains=search)
            )
        if stage:
            qs = qs.filter(stage=stage)
        return qs


@extend_schema(tags=[WHATSAPP_TAG])
class WhatsAppCampaignViewSet(viewsets.ModelViewSet):
    """Campanhas promocionais e reativação de clientes com opt-in."""

    queryset = WhatsAppCampaign.objects.select_related('coupon').all()
    serializer_class = WhatsAppCampaignSerializer
    permission_classes = [IsBarberShopStaff, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _audience_queryset(self, audience: str):
        qs = Client.objects.filter(is_blocked=False, whatsapp_opt_in=True)
        if audience == WhatsAppCampaign.Audience.VIP_CLIENTS:
            return qs.filter(total_visits__gte=3)
        if audience == WhatsAppCampaign.Audience.FIRST_VISIT:
            return qs.filter(total_visits=0)
        if audience == WhatsAppCampaign.Audience.INACTIVE_30D:
            cutoff = timezone.localdate() - timedelta(days=30)
            return qs.annotate(
                last_appt_date=Max(
                    'appointments__date',
                    filter=Q(
                        appointments__status=Appointment.Status.COMPLETED
                    ),
                )
            ).filter(
                Q(last_appt_date__lte=cutoff)
                | Q(last_appt_date__isnull=True, created_at__date__lte=cutoff)
            )
        return qs

    @action(detail=True, methods=['post'], url_path='send')
    def send_campaign(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status != WhatsAppCampaign.Status.DRAFT:
            return Response(
                {'detail': 'Esta campanha já foi disparada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cfg = WhatsAppSettings.get_solo()
        evo = EvolutionClient.from_settings_obj(cfg)
        simulate_mode = not evo.is_configured

        recipients = list(self._audience_queryset(campaign.audience)[:100])
        if not recipients:
            return Response(
                {
                    'detail': (
                        'Nenhum cliente elegível com consentimento (opt-in) '
                        'para este público.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        coupon_code = campaign.coupon.code if campaign.coupon else ''
        sent_count = 0
        for client in recipients:
            first_name = client.name.split()[0] if client.name else 'cliente'
            rendered = (
                campaign.message.replace('{nome}', first_name)
                .replace('{cupom}', coupon_code)
                .replace('{link}', cfg.booking_url)
            )
            buf = [] if simulate_mode else None
            if send_whatsapp_message(
                client.phone_number,
                rendered,
                sender=f'Campanha: {campaign.title}',
                instance_name=cfg.effective_instance_name(),
                simulate_buffer=buf,
            ):
                sent_count += 1

        campaign.status = WhatsAppCampaign.Status.SENT
        campaign.sent_at = timezone.now()
        campaign.recipients_count = sent_count
        campaign.save(
            update_fields=[
                'status',
                'sent_at',
                'recipients_count',
                'updated_at',
            ]
        )
        return Response({
            'campaign': WhatsAppCampaignSerializer(campaign).data,
            'simulated': simulate_mode,
        })


@extend_schema(tags=[WHATSAPP_TAG], responses={200: OpenApiTypes.OBJECT})
class ReactivationTargetsView(APIView):
    """Lista clientes para reativação 1-clique via WhatsApp (estilo SGR)."""

    permission_classes = [IsBarberShopStaff]

    def get(self, request):
        cfg = WhatsAppSettings.get_solo()
        cutoff = timezone.localdate() - timedelta(days=25)
        clients = (
            Client.objects.filter(is_blocked=False, whatsapp_opt_in=True)
            .annotate(
                last_visit_date=Max(
                    'appointments__date',
                    filter=Q(
                        appointments__status=Appointment.Status.COMPLETED
                    ),
                )
            )
            .order_by('last_visit_date', '-total_visits')[:30]
        )

        items = []
        today = timezone.localdate()
        for c in clients:
            days_away = (
                (today - c.last_visit_date).days
                if c.last_visit_date
                else (today - c.created_at.date()).days
            )
            is_due = (
                c.last_visit_date is None or c.last_visit_date <= cutoff
            )
            first_name = c.name.split()[0]
            clean = clean_phone_number(c.phone_number)
            suggested = (
                f'Fala, {first_name}! Tudo certo? 💈 Já faz um tempinho '
                f'desde o seu último trato no visual aqui na '
                f'{cfg.shop_name}. Bora garantir seu horário da semana? '
                f'Reserve sem fila: {cfg.booking_url}'
            )
            items.append({
                'id': str(c.id),
                'name': c.name,
                'phone': clean,
                'phone_number': c.phone_number,
                'total_visits': c.total_visits,
                'last_visit_date': c.last_visit_date,
                'days_away': max(0, days_away),
                'needs_reactivation': is_due,
                'suggested_message': suggested,
                'wa_me_url': f'https://wa.me/{clean}?text={quote(suggested)}',
            })
        return Response({'targets': items})


@extend_schema(tags=[WHATSAPP_TAG])
class WhatsAppSettingsView(APIView):
    """Leitura e atualização das configurações do Evolution GO e Bot."""

    permission_classes = [IsBarberShopStaff, IsOwnerOrReadOnly]
    serializer_class = WhatsAppSettingsSerializer

    def get(self, request):
        cfg = WhatsAppSettings.get_solo()
        return Response(WhatsAppSettingsSerializer(cfg).data)

    def patch(self, request):
        cfg = WhatsAppSettings.get_solo()
        serializer = WhatsAppSettingsSerializer(
            cfg,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def _build_evolution_webhook_url(request, cfg) -> str:
    """Monta a URL do webhook alcançável pelo container ou servidor remoto."""
    path = f'/webhook/whatsapp/{cfg.effective_webhook_token()}/'
    custom_base = str(
        getattr(settings, 'EVOLUTION_WEBHOOK_BASE_URL', '') or ''
    ).strip().rstrip('/')
    if custom_base:
        return f'{custom_base}{path}'

    raw_url = request.build_absolute_uri(path)
    api_host = (urlparse(cfg.effective_api_url()).hostname or '').lower()
    req_host = (urlparse(raw_url).hostname or '').lower()
    if (
        api_host in {'127.0.0.1', 'localhost'}
        and req_host in {'127.0.0.1', 'localhost'}
    ):
        return f'http://host.docker.internal:8000{path}'
    return raw_url


def _extract_qr_image(qr_payload) -> str:
    data = (
        qr_payload.get('data', qr_payload)
        if isinstance(qr_payload, dict)
        else {}
    )
    if not isinstance(data, dict):
        return ''
    return str(
        data.get('qrcode') or data.get('base64') or data.get('code') or ''
    )


@extend_schema(tags=[WHATSAPP_TAG], responses={200: OpenApiTypes.OBJECT})
class WhatsAppQRCodeView(APIView):
    """Consulta status da instância Evolution GO ou emite QR Code."""

    permission_classes = [IsBarberShopStaff]

    def get(self, request):
        cfg = WhatsAppSettings.get_solo()
        evo = EvolutionClient.from_settings_obj(cfg)
        instance = cfg.effective_instance_name()

        if not evo.is_configured:
            return Response({
                'success': False,
                'connected': False,
                'configured': False,
                'instance': instance,
                'error': (
                    'Servidor Evolution GO ainda não configurado. Informe a '
                    'URL e o Token da instância abaixo, ou use o Simulador '
                    'Local ao lado para testar todo o bot e o CRM agora!'
                ),
            })

        try:
            if cfg.provider == 'evolution_go':
                webhook_url = _build_evolution_webhook_url(request, cfg)
                try:
                    evo.configure_webhook(webhook_url)
                except EvolutionProviderError:
                    pass

            try:
                status_payload = evo.status(instance=instance)
                if evolution_is_connected(status_payload):
                    return Response({
                        'success': True,
                        'connected': True,
                        'configured': True,
                        'instance': instance,
                    })
            except EvolutionProviderError:
                pass

            qr_payload = evo.qr(instance=instance)
            base64_img = _extract_qr_image(qr_payload)
            if not base64_img:
                time.sleep(1)
                qr_payload = evo.qr(instance=instance)
                base64_img = _extract_qr_image(qr_payload)

            if base64_img:
                return Response({
                    'success': True,
                    'connected': False,
                    'configured': True,
                    'instance': instance,
                    'base64': base64_img,
                })
            return Response({
                'success': False,
                'connected': False,
                'configured': True,
                'instance': instance,
                'error': 'O servidor Evolution não retornou imagem QR Code.',
            })
        except EvolutionProviderError as exc:
            return Response({
                'success': False,
                'connected': False,
                'configured': True,
                'instance': instance,
                'error': str(exc),
            })


@extend_schema(
    tags=[WHATSAPP_TAG],
    request=None,
    responses={200: OpenApiTypes.OBJECT},
)
class WhatsAppLogoutDeviceView(APIView):
    """Desconecta a sessão do aparelho WhatsApp no Evolution GO."""

    permission_classes = [IsBarberShopStaff, IsOwnerOrReadOnly]

    def post(self, request):
        cfg = WhatsAppSettings.get_solo()
        evo = EvolutionClient.from_settings_obj(cfg)
        if not evo.is_configured:
            return Response(
                {'detail': 'Nenhuma instância ativa configurada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            evo.logout(instance=cfg.effective_instance_name())
        except EvolutionProviderError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({'ok': True})


@extend_schema(
    tags=[WHATSAPP_TAG],
    request=OpenApiTypes.OBJECT,
    responses={200: OpenApiTypes.OBJECT},
)
class WhatsAppSimulateView(APIView):
    """Simulador Local do Bot da Barbearia (testa sem precisar de celular)."""

    permission_classes = [IsBarberShopStaff]

    def post(self, request):
        phone = str(request.data.get('phone') or '5511988001122').strip()
        message = str(request.data.get('message') or '').strip()
        push_name = str(
            request.data.get('push_name') or 'Cliente Simulador'
        ).strip()
        if not message:
            return Response(
                {'detail': 'Digite uma mensagem para simular.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        replies = []
        conv = process_whatsapp_message(
            phone,
            message,
            push_name=push_name,
            simulate_buffer=replies,
        )
        return Response({
            'success': True,
            'replies': replies,
            'conversation_id': str(conv.id) if conv else None,
        })
