"""Motor de autoatendimento, triagem CRM e envio WhatsApp da barbearia."""

import logging
import re
import unicodedata
from uuid import uuid4

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from catalog.models import Coupon, Service
from clients.models import Client
from scheduling.models import Appointment
from .evolution import EvolutionClient, EvolutionProviderError
from .models import (
    CRMLead,
    WhatsAppConversation,
    WhatsAppHumanQueueEntry,
    WhatsAppMessage,
    WhatsAppSettings,
)

logger = logging.getLogger(__name__)

OPT_OUT_COMMANDS = {
    'sair',
    'parar',
    'stop',
    'cancelar promocoes',
    'nao quero receber promocoes',
}
OPT_IN_COMMANDS = {
    'ativar promocoes',
    'quero promocoes',
    'receber promocoes',
}
MENU_COMMANDS = {
    'menu',
    'oi',
    'ola',
    'opa',
    'bom dia',
    'boa tarde',
    'boa noite',
    'voltar',
    'opcoes',
    'ajuda',
    '0',
}
QUEUE_EXIT_COMMANDS = {
    'cancelar atendimento',
    'sair da fila',
    'cancelar fila',
    'encerrar',
    'encerrar atendimento',
}
COMMERCIAL_REGEX = re.compile(
    r'\b(corte|barba|degrade|fade|combo|prec|valor|quanto|agend|'
    r'horari|vaga|hoje|amanha|cupom|promoc|sobrancelha)\w*',
    re.IGNORECASE,
)


def clean_phone_number(raw_phone: str) -> str:
    """Normaliza telefone para dígitos com DDI 55 quando nacional."""
    raw = str(raw_phone or '').split('@')[0]
    digits = re.sub(r'\D', '', raw)
    if not digits:
        return ''
    if len(digits) in (10, 11) and not digits.startswith('55'):
        return f'55{digits}'
    return digits


def local_phone_digits(clean_phone: str) -> str:
    """Remove o prefixo 55 caso presente para cruzar com Client."""
    digits = re.sub(r'\D', '', clean_phone or '')
    if len(digits) in (12, 13) and digits.startswith('55'):
        return digits[2:]
    return digits


def find_client_by_phone(phone: str):
    """Localiza ficha de Client pelo telefone com ou sem DDI 55."""
    clean = clean_phone_number(phone)
    if not clean:
        return None
    local = local_phone_digits(clean)
    tail = clean[-9:] if len(clean) >= 9 else clean
    candidates = Client.objects.filter(
        Q(phone_number=clean)
        | Q(phone_number=local)
        | Q(phone_number__endswith=tail)
    )
    for candidate in candidates:
        cand_digits = re.sub(r'\D', '', candidate.phone_number)
        if cand_digits in (clean, local) or cand_digits[-9:] == clean[-9:]:
            return candidate
    return None


def _normalize_command(text: str) -> str:
    cleaned = unicodedata.normalize('NFKD', str(text or '').strip().lower())
    ascii_text = ''.join(ch for ch in cleaned if not unicodedata.combining(ch))
    ascii_text = re.sub(r'^/+', '', ascii_text)
    ascii_text = re.sub(r'[^\w\s]', ' ', ascii_text)
    return re.sub(r'\s+', ' ', ascii_text).strip()


def upsert_conversation(
    phone: str,
    *,
    contact_name: str = '',
    instance_name: str = '',
):
    """Garante conversa única por número normalizado e vincula Client."""
    clean = clean_phone_number(phone)
    if not clean:
        return None
    client = find_client_by_phone(clean)
    resolved_name = (
        (client.name if client else '')
        or str(contact_name or '').strip()
    )
    conversation, _ = WhatsAppConversation.objects.get_or_create(
        phone=clean,
        defaults={
            'client': client,
            'contact_name': resolved_name,
            'instance_name': str(instance_name or '').strip(),
        },
    )
    changed = []
    if client and conversation.client_id != client.id:
        conversation.client = client
        changed.append('client')
    if resolved_name and conversation.contact_name != resolved_name:
        conversation.contact_name = resolved_name
        changed.append('contact_name')
    if instance_name and conversation.instance_name != instance_name:
        conversation.instance_name = instance_name
        changed.append('instance_name')
    if changed:
        conversation.save(update_fields=changed + ['updated_at'])
    return conversation


def upsert_crm_lead(
    phone: str,
    *,
    name: str = '',
    message: str = '',
    interest: str = '',
    force_stage: str = '',
    source: str = 'whatsapp',
):
    """Cria ou atualiza card no funil de Leads CRM."""
    clean = clean_phone_number(phone)
    if not clean:
        return None
    client = find_client_by_phone(clean)
    today = timezone.localdate()
    has_upcoming = False
    if client:
        has_upcoming = Appointment.objects.filter(
            client=client,
            date__gte=today,
            status__in=[
                Appointment.Status.PENDING,
                Appointment.Status.CONFIRMED,
                Appointment.Status.IN_PROGRESS,
            ],
        ).exists()

    default_stage = CRMLead.Stage.NEW
    if force_stage:
        default_stage = force_stage
    elif client and client.total_visits >= 3:
        default_stage = CRMLead.Stage.VIP
    elif has_upcoming:
        default_stage = CRMLead.Stage.SCHEDULED
    elif COMMERCIAL_REGEX.search(message or ''):
        default_stage = CRMLead.Stage.INTERESTED

    lead_name = (client.name if client else '') or str(name or '').strip()
    lead, created = CRMLead.objects.get_or_create(
        phone=clean,
        defaults={
            'client': client,
            'name': lead_name,
            'stage': default_stage,
            'source': source,
            'interest': str(interest or message or '')[:255],
            'latest_message': str(message or '')[:1000],
        },
    )
    if not created:
        changed = []
        if client and lead.client_id != client.id:
            lead.client = client
            changed.append('client')
        if lead_name and not lead.name:
            lead.name = lead_name
            changed.append('name')
        if message:
            lead.latest_message = str(message)[:1000]
            changed.append('latest_message')
        if interest:
            lead.interest = str(interest)[:255]
            changed.append('interest')
        if force_stage and lead.stage != force_stage:
            lead.stage = force_stage
            changed.append('stage')
        elif (
            lead.stage == CRMLead.Stage.NEW
            and default_stage != CRMLead.Stage.NEW
        ):
            lead.stage = default_stage
            changed.append('stage')
        if changed:
            lead.save(update_fields=changed + ['updated_at'])
    return lead


def send_whatsapp_message(
    phone: str,
    text: str,
    *,
    sender: str = 'Bot BarberPro',
    instance_name: str = '',
    simulate_buffer=None,
) -> bool:
    """Envia mensagem via Evolution (ou simulador) e grava no histórico."""
    clean = clean_phone_number(phone)
    body = str(text or '').strip()
    if not clean or not body:
        return False

    cfg = WhatsAppSettings.get_solo()
    eff_instance = instance_name or cfg.effective_instance_name()
    conversation = upsert_conversation(clean, instance_name=eff_instance)

    if simulate_buffer is not None:
        simulate_buffer.append(body)
        msg_status = WhatsAppMessage.STATUS_SIMULATED
        ok = True
    else:
        evo = EvolutionClient.from_settings_obj(cfg)
        if evo.is_configured:
            try:
                try:
                    evo.send_presence(
                        clean,
                        instance=eff_instance,
                        presence='composing',
                    )
                except EvolutionProviderError:
                    pass
                evo.send_text(clean, body, instance=eff_instance)
                msg_status = WhatsAppMessage.STATUS_SENT
                ok = True
            except EvolutionProviderError:
                msg_status = WhatsAppMessage.STATUS_FAILED
                ok = False
        else:
            msg_status = WhatsAppMessage.STATUS_SIMULATED
            ok = True

    now = timezone.now()
    with transaction.atomic():
        WhatsAppMessage.objects.create(
            conversation=conversation,
            message_id=f'out-{uuid4()}',
            direction=WhatsAppMessage.DIRECTION_OUTBOUND,
            status=msg_status,
            text=body,
            sender=sender,
            sent_at=now,
        )
        conversation.last_message_at = now
        conversation.last_message_preview = body[:250]
        conversation.save(
            update_fields=[
                'last_message_at',
                'last_message_preview',
                'updated_at',
            ]
        )
    return ok


def record_inbound_message(
    phone: str,
    text: str,
    *,
    push_name: str = '',
    message_id: str = '',
    instance_name: str = '',
    media_type: str = '',
    media_name: str = '',
    mark_unread: bool = True,
):
    """Registra mensagem recebida de forma idempotente na conversa."""
    clean = clean_phone_number(phone)
    if not clean:
        return None, False
    cfg = WhatsAppSettings.get_solo()
    eff_instance = instance_name or cfg.effective_instance_name()
    ext_id = str(message_id or f'in-{uuid4()}')

    if WhatsAppMessage.objects.filter(message_id=ext_id).exists():
        conv = WhatsAppConversation.objects.filter(phone=clean).first()
        return conv, False

    with transaction.atomic():
        conversation = upsert_conversation(
            clean,
            contact_name=push_name,
            instance_name=eff_instance,
        )
        msg = WhatsAppMessage.objects.create(
            conversation=conversation,
            message_id=ext_id,
            direction=WhatsAppMessage.DIRECTION_INBOUND,
            status=WhatsAppMessage.STATUS_RECEIVED,
            text=str(text or '').strip(),
            sender=push_name or conversation.contact_name or clean,
            media_type=media_type,
            media_name=media_name,
        )
        if conversation.status == WhatsAppConversation.Status.CLOSED:
            conversation.status = WhatsAppConversation.Status.ACTIVE
            conversation.closed_at = None
        conversation.last_message_at = msg.created_at
        conversation.last_message_preview = msg.text[:250]
        if mark_unread:
            conversation.unread_count += 1
        conversation.save(
            update_fields=[
                'status',
                'closed_at',
                'last_message_at',
                'last_message_preview',
                'unread_count',
                'updated_at',
            ]
        )
    return conversation, True


def _build_menu_text(cfg: WhatsAppSettings, client=None) -> str:
    greeting = cfg.welcome_message.strip() or (
        f'Olá! Bem-vindo à *{cfg.shop_name}* 💈✂️'
    )
    if client:
        first_name = client.name.split()[0]
        header = f'Fala, *{first_name}*! 💈\n{greeting}'
    else:
        header = greeting

    return (
        f'{header}\n\n'
        '*1* — Catálogo de Serviços e Preços\n'
        '*2* — Agendar Horário Online\n'
        '*3* — Consultar Meu Próximo Horário\n'
        '*4* — Cancelar Meu Agendamento\n'
        '*5* — Falar com Barbeiro / Recepção\n'
        '*6* — Endereço e Funcionamento\n\n'
        '_Responda com o número da opção desejada._'
    )


def _send_services_catalog(
    cfg: WhatsAppSettings,
    phone: str,
    *,
    instance_name: str = '',
    simulate_buffer=None,
):
    services = list(Service.objects.filter(is_active=True)[:12])
    if not services:
        msg = (
            f'*{cfg.shop_name}*\n'
            'Nosso catálogo está sendo atualizado no momento.\n'
            f'Agende direto pelo link: {cfg.booking_url}'
        )
        send_whatsapp_message(
            phone,
            msg,
            instance_name=instance_name,
            simulate_buffer=simulate_buffer,
        )
        return

    lines = [f'✂️ *Menu de Serviços — {cfg.shop_name}*\n']
    for svc in services:
        if svc.promotion_price:
            price_txt = (
                f'~R$ {svc.price:.2f}~ por *R$ {svc.promotion_price:.2f}*'
            )
        else:
            price_txt = f'*R$ {svc.price:.2f}*'
        lines.append(
            f'• *{svc.name}* ({svc.duration_minutes} min) — {price_txt}'
        )
    lines.append(f'\n📅 *Reservar agora:* {cfg.booking_url}')
    lines.append('_Digite *2* para cupom e agendamento ou *0* para o menu._')
    send_whatsapp_message(
        phone,
        '\n'.join(lines),
        instance_name=instance_name,
        simulate_buffer=simulate_buffer,
    )


def _send_booking_invite(
    cfg: WhatsAppSettings,
    phone: str,
    client=None,
    *,
    instance_name: str = '',
    simulate_buffer=None,
):
    today = timezone.localdate()
    coupon_qs = Coupon.objects.filter(is_active=True).filter(
        Q(valid_from__isnull=True) | Q(valid_from__lte=today),
        Q(valid_until__isnull=True) | Q(valid_until__gte=today),
        Q(max_uses__isnull=True) | Q(used_count__lt=F('max_uses')),
    )
    if client and client.total_visits > 0:
        coupon_qs = coupon_qs.filter(only_first_visit=False)
    coupon = coupon_qs.first()

    lines = [
        f'📅 *Agendamento Online — {cfg.shop_name}*',
        '',
        'Escolha seu barbeiro, serviço e horário em segundos:',
        f'👉 {cfg.booking_url}',
    ]
    if coupon:
        if coupon.discount_type == Coupon.DiscountType.PERCENTAGE:
            off = f'{coupon.discount_value:.0f}% OFF'
        else:
            off = f'R$ {coupon.discount_value:.2f} OFF'
        lines.extend([
            '',
            f'🎟️ *Cupom disponível:* `{coupon.code}` ({off})',
        ])
    send_whatsapp_message(
        phone,
        '\n'.join(lines),
        instance_name=instance_name,
        simulate_buffer=simulate_buffer,
    )


def _next_active_appointment(client):
    if not client:
        return None
    today = timezone.localdate()
    return (
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


def _send_next_appointment(
    cfg: WhatsAppSettings,
    phone: str,
    client=None,
    *,
    instance_name: str = '',
    simulate_buffer=None,
):
    appt = _next_active_appointment(client)
    if not appt:
        msg = (
            '🔎 Não encontrei nenhum agendamento futuro vinculado a este '
            'WhatsApp.\n\n'
            f'Para reservar sua cadeira agora, acesse:\n👉 {cfg.booking_url}'
        )
        send_whatsapp_message(
            phone,
            msg,
            instance_name=instance_name,
            simulate_buffer=simulate_buffer,
        )
        return

    svc_names = ', '.join(it.service.name for it in appt.items.all())
    base_site = cfg.booking_url.split('/agendar')[0].rstrip('/')
    manage_url = f'{base_site}/meu-agendamento/{appt.cancel_token}'
    msg = (
        '💈 *Seu Próximo Agendamento*\n\n'
        f"📆 Data: *{appt.date.strftime('%d/%m/%Y')}*\n"
        f"⏰ Horário: *{appt.start_time.strftime('%H:%M')}*\n"
        f'✂️ Profissional: *{appt.professional.display_name}*\n'
        f"📋 Serviços: {svc_names or 'Atendimento'}\n"
        f'💰 Valor: *R$ {appt.total_price:.2f}*\n\n'
        f'🔗 Gerenciar ou reagendar:\n{manage_url}\n'
        '_Para cancelar por aqui, envie *CONFIRMAR CANCELAMENTO*._'
    )
    send_whatsapp_message(
        phone,
        msg,
        instance_name=instance_name,
        simulate_buffer=simulate_buffer,
    )


def _prompt_or_cancel_appointment(
    cfg: WhatsAppSettings,
    phone: str,
    client=None,
    *,
    confirm: bool = False,
    instance_name: str = '',
    simulate_buffer=None,
):
    appt = _next_active_appointment(client)
    if not appt:
        send_whatsapp_message(
            phone,
            'Você não possui nenhum horário futuro ativo para cancelar.',
            instance_name=instance_name,
            simulate_buffer=simulate_buffer,
        )
        return

    date_fmt = appt.date.strftime('%d/%m/%Y')
    time_fmt = appt.start_time.strftime('%H:%M')
    if not confirm:
        msg = (
            f'⚠️ Encontrei seu horário em *{date_fmt} às {time_fmt}* '
            f'com *{appt.professional.display_name}*.\n\n'
            'Para confirmar o cancelamento imediato, responda:\n'
            '*CONFIRMAR CANCELAMENTO*\n\n'
            '_Ou envie *0* para manter seu horário._'
        )
        send_whatsapp_message(
            phone,
            msg,
            instance_name=instance_name,
            simulate_buffer=simulate_buffer,
        )
        return

    appt.status = Appointment.Status.CANCELED
    appt.save(update_fields=['status', 'updated_at'])
    msg = (
        f'✅ Seu agendamento de *{date_fmt} às {time_fmt}* foi cancelado '
        'com sucesso.\n\n'
        f'Quando quiser remarcar, acesse: {cfg.booking_url}'
    )
    send_whatsapp_message(
        phone,
        msg,
        instance_name=instance_name,
        simulate_buffer=simulate_buffer,
    )


def _enter_human_queue(
    cfg: WhatsAppSettings,
    conversation: WhatsAppConversation,
    *,
    reason: str = '',
    instance_name: str = '',
    simulate_buffer=None,
):
    active_entry = WhatsAppHumanQueueEntry.objects.filter(
        phone=conversation.phone,
        status__in=[
            WhatsAppHumanQueueEntry.STATUS_WAITING,
            WhatsAppHumanQueueEntry.STATUS_ASSIGNED,
        ],
    ).first()
    if not active_entry:
        active_entry = WhatsAppHumanQueueEntry.objects.create(
            conversation=conversation,
            phone=conversation.phone,
            contact_name=conversation.contact_name,
            reason=str(reason or 'Solicitou atendimento humano')[:255],
            status=WhatsAppHumanQueueEntry.STATUS_WAITING,
        )
    conversation.status = WhatsAppConversation.Status.HUMAN
    conversation.save(update_fields=['status', 'updated_at'])

    position = WhatsAppHumanQueueEntry.objects.filter(
        status=WhatsAppHumanQueueEntry.STATUS_WAITING,
        requested_at__lte=active_entry.requested_at,
    ).count()
    msg = (
        f'👋 Perfeito! Coloquei você na fila de atendimento da '
        f'*{cfg.shop_name}* (posição *{max(1, position)}*).\n'
        'Nossa equipe já vai responder por aqui.\n\n'
        '_Para voltar ao menu automático, digite *ENCERRAR*._'
    )
    send_whatsapp_message(
        conversation.phone,
        msg,
        instance_name=instance_name,
        simulate_buffer=simulate_buffer,
    )


def process_whatsapp_message(
    phone: str,
    text: str,
    *,
    push_name: str = '',
    message_id: str = '',
    instance_name: str = '',
    simulate_buffer=None,
    record_inbound: bool = True,
):
    """Processa mensagem recebida (webhook ou simulador) e aciona o CRM."""
    clean = clean_phone_number(phone)
    raw_text = str(text or '').strip()
    if not clean or not raw_text:
        return None

    cfg = WhatsAppSettings.get_solo()
    eff_instance = instance_name or cfg.effective_instance_name()

    if record_inbound:
        conversation, is_new = record_inbound_message(
            clean,
            raw_text,
            push_name=push_name,
            message_id=message_id,
            instance_name=eff_instance,
            mark_unread=(simulate_buffer is None),
        )
        if not is_new:
            return conversation
    else:
        conversation = upsert_conversation(
            clean,
            contact_name=push_name,
            instance_name=eff_instance,
        )

    client = conversation.client or find_client_by_phone(clean)
    if cfg.auto_lead_capture:
        upsert_crm_lead(
            clean,
            name=push_name or (client.name if client else ''),
            message=raw_text,
        )

    norm = _normalize_command(raw_text)

    # 1. Opt-out / Opt-in de campanhas (sempre respeitado, mesmo sem bot)
    if norm in OPT_OUT_COMMANDS:
        if client:
            client.whatsapp_opt_in = False
            client.whatsapp_opt_out_at = timezone.now()
            client.save(
                update_fields=[
                    'whatsapp_opt_in',
                    'whatsapp_opt_out_at',
                    'updated_at',
                ]
            )
        send_whatsapp_message(
            clean,
            f'Tudo certo! Você não receberá mais promoções da '
            f'*{cfg.shop_name}*. Se mudar de ideia, envie *QUERO PROMOCOES*.',
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    if norm in OPT_IN_COMMANDS:
        if client:
            client.whatsapp_opt_in = True
            client.whatsapp_opt_out_at = None
            client.save(
                update_fields=[
                    'whatsapp_opt_in',
                    'whatsapp_opt_out_at',
                    'updated_at',
                ]
            )
        send_whatsapp_message(
            clean,
            f'✅ Suas ofertas e cupons VIP da *{cfg.shop_name}* foram '
            'reativados com sucesso!',
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    # 2. Fila humana ativa: não interrompe o operador humano
    active_queue = WhatsAppHumanQueueEntry.objects.filter(
        phone=clean,
        status__in=[
            WhatsAppHumanQueueEntry.STATUS_WAITING,
            WhatsAppHumanQueueEntry.STATUS_ASSIGNED,
        ],
    ).first()
    if active_queue and norm in QUEUE_EXIT_COMMANDS:
        active_queue.status = WhatsAppHumanQueueEntry.STATUS_CLOSED
        active_queue.closed_at = timezone.now()
        active_queue.save(update_fields=['status', 'closed_at'])
        conversation.status = WhatsAppConversation.Status.ACTIVE
        conversation.save(update_fields=['status', 'updated_at'])
        send_whatsapp_message(
            clean,
            '✅ Atendimento humano encerrado. Voltando ao menu automático:',
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        send_whatsapp_message(
            clean,
            _build_menu_text(cfg, client=client),
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    if (
        active_queue
        or conversation.status == WhatsAppConversation.Status.HUMAN
    ):
        if norm not in {'0', 'menu'}:
            return conversation

    if not cfg.bot_enabled:
        if simulate_buffer is not None:
            simulate_buffer.append(
                'ℹ️ O autoatendimento automático está pausado nas '
                'configurações. A mensagem foi salva na Central de Conversas.'
            )
        return conversation

    # 3. Roteamento do Menu da Barbearia
    if norm in MENU_COMMANDS:
        send_whatsapp_message(
            clean,
            _build_menu_text(cfg, client=client),
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    if norm in {
        '1',
        'servicos',
        'catalogo',
        'precos',
        'valores',
        'tabela',
    }:
        upsert_crm_lead(
            clean,
            name=push_name,
            message=raw_text,
            interest='Catálogo de Serviços',
            force_stage=CRMLead.Stage.INTERESTED,
        )
        _send_services_catalog(
            cfg,
            clean,
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    if norm in {
        '2',
        'agendar',
        'agendamento',
        'marcar',
        'reservar',
        'quero agendar',
    }:
        upsert_crm_lead(
            clean,
            name=push_name,
            message=raw_text,
            interest='Link de Agendamento Online',
            force_stage=CRMLead.Stage.INTERESTED,
        )
        _send_booking_invite(
            cfg,
            clean,
            client=client,
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    if norm in {
        '3',
        'meu horario',
        'meus agendamentos',
        'consultar',
        'consultar horario',
    }:
        _send_next_appointment(
            cfg,
            clean,
            client=client,
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    if norm in {'4', 'cancelar', 'cancelar horario', 'desmarcar'}:
        _prompt_or_cancel_appointment(
            cfg,
            clean,
            client=client,
            confirm=False,
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    if norm == 'confirmar cancelamento':
        _prompt_or_cancel_appointment(
            cfg,
            clean,
            client=client,
            confirm=True,
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    if norm in {
        '5',
        'atendente',
        'humano',
        'barbeiro',
        'recepcao',
        'falar com atendente',
        'falar com barbeiro',
    }:
        _enter_human_queue(
            cfg,
            conversation,
            reason=raw_text,
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    if norm in {
        '6',
        'endereco',
        'localizacao',
        'local',
        'onde fica',
        'como chegar',
        'funcionamento',
        'horario de funcionamento',
    }:
        loc_msg = (
            f'📍 *{cfg.shop_name}*\n'
            f'{cfg.shop_address}\n\n'
            f'🕒 *Funcionamento:* {cfg.shop_hours}\n'
            f'📅 *Agende sem fila:* {cfg.booking_url}'
        )
        send_whatsapp_message(
            clean,
            loc_msg,
            instance_name=eff_instance,
            simulate_buffer=simulate_buffer,
        )
        return conversation

    # 4. Mensagem em linguagem natural -> envia saudação + menu prático
    send_whatsapp_message(
        clean,
        _build_menu_text(cfg, client=client),
        instance_name=eff_instance,
        simulate_buffer=simulate_buffer,
    )
    return conversation
