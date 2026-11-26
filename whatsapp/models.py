import secrets
import uuid

from django.conf import settings
from django.db import models


def _default_webhook_token():
    return secrets.token_urlsafe(24)


class WhatsAppSettings(models.Model):
    """Configuração única da integração WhatsApp e do bot da barbearia."""

    class Provider(models.TextChoices):
        EVOLUTION_GO = 'evolution_go', 'Evolution GO'
        LEGACY = 'legacy', 'Evolution API (Legado)'

    singleton_key = models.CharField(
        max_length=16,
        unique=True,
        default='default',
        editable=False,
    )
    shop_name = models.CharField(
        max_length=120,
        default='BarberPro Studio',
        verbose_name='Nome da Barbearia',
    )
    shop_address = models.CharField(
        max_length=255,
        default='Av. Paulista, 1000 — Bela Vista, São Paulo/SP',
        verbose_name='Endereço da Barbearia',
    )
    shop_hours = models.CharField(
        max_length=140,
        default='Segunda a Sábado, das 09h às 19h',
        verbose_name='Horário de Funcionamento',
    )
    booking_url = models.CharField(
        max_length=255,
        default='http://localhost:5173/agendar',
        verbose_name='Link de Agendamento Online',
    )
    welcome_message = models.TextField(
        blank=True,
        default=(
            'Olá! Bem-vindo à *BarberPro Studio* 💈✂️\n'
            'Escolha uma opção abaixo para agilizar seu atendimento:'
        ),
        verbose_name='Mensagem de Boas-vindas',
    )
    provider = models.CharField(
        max_length=20,
        choices=Provider.choices,
        default=Provider.EVOLUTION_GO,
    )
    api_url = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name='URL do Servidor Evolution',
    )
    instance_name = models.CharField(
        max_length=100,
        blank=True,
        default='barberpro',
        verbose_name='Nome da Instância',
    )
    api_token = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name='Token / API Key da Instância',
    )
    webhook_token = models.CharField(
        max_length=120,
        default=_default_webhook_token,
        verbose_name='Token Secreto do Webhook',
    )
    bot_enabled = models.BooleanField(
        default=True,
        verbose_name='Ativar Autoatendimento (Bot)',
    )
    auto_lead_capture = models.BooleanField(
        default=True,
        verbose_name='Capturar Leads Automaticamente',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuração do WhatsApp'
        verbose_name_plural = 'Configurações do WhatsApp'

    @classmethod
    def get_solo(cls):
        default_url = getattr(
            settings,
            'PUBLIC_BOOKING_URL',
            'http://localhost:5173/agendar',
        )
        obj, _ = cls.objects.get_or_create(
            singleton_key='default',
            defaults={'booking_url': default_url},
        )
        return obj

    def effective_api_url(self) -> str:
        raw = self.api_url or getattr(settings, 'EVOLUTION_API_URL', '')
        return str(raw or '').strip().rstrip('/')

    def effective_api_token(self) -> str:
        raw = self.api_token or getattr(settings, 'EVOLUTION_API_KEY', '')
        return str(raw or '').strip()

    def effective_instance_name(self) -> str:
        raw = self.instance_name or getattr(
            settings,
            'EVOLUTION_INSTANCE_NAME',
            'barberpro',
        )
        return str(raw or 'barberpro').strip()

    def effective_webhook_token(self) -> str:
        env_token = getattr(settings, 'EVOLUTION_WEBHOOK_TOKEN', '')
        return str(env_token or self.webhook_token or '').strip()

    def __str__(self):
        return f'WhatsApp Config ({self.shop_name})'


class WhatsAppConversation(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Bot / Ativa'
        HUMAN = 'human', 'Atendimento Humano'
        CLOSED = 'closed', 'Encerrada'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='whatsapp_conversations',
    )
    phone = models.CharField(
        max_length=30,
        unique=True,
        db_index=True,
    )
    contact_name = models.CharField(
        max_length=120,
        blank=True,
        default='',
    )
    instance_name = models.CharField(
        max_length=100,
        blank=True,
        default='',
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    unread_count = models.PositiveIntegerField(default=0)
    last_message_preview = models.CharField(
        max_length=255,
        blank=True,
        default='',
    )
    last_message_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_message_at', '-updated_at']
        verbose_name = 'Conversa de WhatsApp'
        verbose_name_plural = 'Conversas de WhatsApp'

    def __str__(self):
        label = self.contact_name or self.phone
        return f'{label} ({self.phone})'


class WhatsAppMessage(models.Model):
    DIRECTION_INBOUND = 'inbound'
    DIRECTION_OUTBOUND = 'outbound'
    DIRECTION_CHOICES = [
        (DIRECTION_INBOUND, 'Recebida'),
        (DIRECTION_OUTBOUND, 'Enviada'),
    ]

    STATUS_RECEIVED = 'received'
    STATUS_SENT = 'sent'
    STATUS_SIMULATED = 'simulated'
    STATUS_READ = 'read'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_RECEIVED, 'Recebida'),
        (STATUS_SENT, 'Enviada'),
        (STATUS_SIMULATED, 'Simulada Local'),
        (STATUS_READ, 'Lida'),
        (STATUS_FAILED, 'Falhou'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    conversation = models.ForeignKey(
        WhatsAppConversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    message_id = models.CharField(max_length=190, unique=True)
    direction = models.CharField(
        max_length=12,
        choices=DIRECTION_CHOICES,
    )
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_RECEIVED,
    )
    text = models.TextField(blank=True, default='')
    sender = models.CharField(max_length=120, blank=True, default='')
    media_type = models.CharField(max_length=30, blank=True, default='')
    media_url = models.CharField(max_length=500, blank=True, default='')
    media_name = models.CharField(max_length=255, blank=True, default='')
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Mensagem de WhatsApp'
        verbose_name_plural = 'Mensagens de WhatsApp'

    def __str__(self):
        phone = self.conversation.phone
        return f'[{self.direction}] {phone}: {self.text[:36]}'


class WhatsAppHumanQueueEntry(models.Model):
    STATUS_WAITING = 'waiting'
    STATUS_ASSIGNED = 'assigned'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = [
        (STATUS_WAITING, 'Aguardando na Fila'),
        (STATUS_ASSIGNED, 'Em Atendimento'),
        (STATUS_CLOSED, 'Encerrado'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    conversation = models.ForeignKey(
        WhatsAppConversation,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='queue_entries',
    )
    phone = models.CharField(max_length=30, db_index=True)
    contact_name = models.CharField(max_length=120, blank=True, default='')
    reason = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_WAITING,
        db_index=True,
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='whatsapp_queue_entries',
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['requested_at']
        verbose_name = 'Fila de Atendimento Humano'
        verbose_name_plural = 'Fila de Atendimento Humano'

    def __str__(self):
        return f'{self.contact_name or self.phone} ({self.status})'


class CRMLead(models.Model):
    class Stage(models.TextChoices):
        NEW = 'new', 'Novo Contato'
        INTERESTED = 'interested', 'Interessado'
        SCHEDULED = 'scheduled', 'Agendado'
        VIP = 'vip', 'Cliente Recorrente'
        REACTIVATION = 'reactivation', 'Em Reativação'
        LOST = 'lost', 'Perdido'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_leads',
    )
    phone = models.CharField(max_length=30, unique=True, db_index=True)
    name = models.CharField(max_length=120, blank=True, default='')
    stage = models.CharField(
        max_length=20,
        choices=Stage.choices,
        default=Stage.NEW,
        db_index=True,
    )
    source = models.CharField(max_length=60, blank=True, default='whatsapp')
    interest = models.CharField(max_length=255, blank=True, default='')
    latest_message = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_crm_leads',
    )
    follow_up_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Lead CRM'
        verbose_name_plural = 'Leads CRM'

    def __str__(self):
        return f'{self.name or self.phone} [{self.get_stage_display()}]'


class WhatsAppCampaign(models.Model):
    class Audience(models.TextChoices):
        ALL_OPT_IN = 'all_opt_in', 'Todos os clientes com opt-in'
        INACTIVE_30D = 'inactive_30d', 'Clientes sem visita há 30+ dias'
        VIP_CLIENTS = 'vip_clients', 'Clientes recorrentes (3+ visitas)'
        FIRST_VISIT = 'first_visit', 'Cadastros ainda sem visita concluída'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Rascunho'
        SENT = 'sent', 'Enviada'
        CANCELLED = 'cancelled', 'Cancelada'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    title = models.CharField(max_length=140)
    audience = models.CharField(
        max_length=24,
        choices=Audience.choices,
        default=Audience.ALL_OPT_IN,
    )
    coupon = models.ForeignKey(
        'catalog.Coupon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='whatsapp_campaigns',
    )
    message = models.TextField(
        help_text='Suporta variáveis {nome}, {cupom} e {link}.',
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    recipients_count = models.PositiveIntegerField(default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='whatsapp_campaigns',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Campanha de WhatsApp'
        verbose_name_plural = 'Campanhas de WhatsApp'

    def __str__(self):
        return f'{self.title} ({self.get_status_display()})'
