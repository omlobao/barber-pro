from rest_framework import serializers

from .bot import clean_phone_number, find_client_by_phone
from .models import (
    CRMLead,
    WhatsAppCampaign,
    WhatsAppConversation,
    WhatsAppHumanQueueEntry,
    WhatsAppMessage,
    WhatsAppSettings,
)


class WhatsAppSettingsSerializer(serializers.ModelSerializer):
    has_api_token = serializers.SerializerMethodField()
    webhook_path = serializers.SerializerMethodField()
    api_token = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )
    clear_api_token = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False,
    )

    class Meta:
        model = WhatsAppSettings
        fields = [
            'shop_name',
            'shop_address',
            'shop_hours',
            'booking_url',
            'welcome_message',
            'provider',
            'api_url',
            'instance_name',
            'api_token',
            'clear_api_token',
            'has_api_token',
            'webhook_path',
            'bot_enabled',
            'auto_lead_capture',
            'updated_at',
        ]
        read_only_fields = ['has_api_token', 'webhook_path', 'updated_at']

    def get_has_api_token(self, obj) -> bool:
        return bool(obj.effective_api_token())

    def get_webhook_path(self, obj) -> str:
        return f'/webhook/whatsapp/{obj.effective_webhook_token()}/'

    def update(self, instance, validated_data):
        clear_token = validated_data.pop('clear_api_token', False)
        raw_token = validated_data.pop('api_token', None)
        if clear_token:
            instance.api_token = ''
        elif raw_token is not None and raw_token.strip():
            instance.api_token = raw_token.strip()
        return super().update(instance, validated_data)


class WhatsAppConversationSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    client_visits = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppConversation
        fields = [
            'id',
            'client',
            'client_name',
            'client_visits',
            'phone',
            'contact_name',
            'instance_name',
            'status',
            'unread_count',
            'last_message_preview',
            'last_message_at',
            'updated_at',
        ]

    def get_client_name(self, obj) -> str:
        if obj.client_id and obj.client:
            return obj.client.name
        return obj.contact_name or obj.phone

    def get_client_visits(self, obj) -> int:
        if obj.client_id and obj.client:
            return obj.client.total_visits
        return 0


class WhatsAppMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppMessage
        fields = [
            'id',
            'message_id',
            'direction',
            'status',
            'text',
            'sender',
            'media_type',
            'media_url',
            'media_name',
            'sent_at',
            'created_at',
        ]


class WhatsAppHumanQueueSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    conversation_id = serializers.UUIDField(
        source='conversation.id',
        read_only=True,
    )

    class Meta:
        model = WhatsAppHumanQueueEntry
        fields = [
            'id',
            'conversation_id',
            'phone',
            'contact_name',
            'reason',
            'status',
            'assigned_to',
            'assigned_to_name',
            'requested_at',
            'assigned_at',
            'closed_at',
        ]

    def get_assigned_to_name(self, obj) -> str:
        if not obj.assigned_to_id or not obj.assigned_to:
            return ''
        return (
            obj.assigned_to.get_full_name()
            or obj.assigned_to.username
        )


class CRMLeadSerializer(serializers.ModelSerializer):
    stage_label = serializers.CharField(
        source='get_stage_display',
        read_only=True,
    )
    client_visits = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = CRMLead
        fields = [
            'id',
            'client',
            'client_visits',
            'phone',
            'name',
            'stage',
            'stage_label',
            'source',
            'interest',
            'latest_message',
            'notes',
            'assigned_to',
            'assigned_to_name',
            'follow_up_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'stage_label',
            'client_visits',
            'assigned_to_name',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'phone': {'validators': []},
        }

    def get_client_visits(self, obj) -> int:
        return obj.client.total_visits if obj.client_id and obj.client else 0

    def get_assigned_to_name(self, obj) -> str:
        if not obj.assigned_to_id or not obj.assigned_to:
            return ''
        return obj.assigned_to.get_full_name() or obj.assigned_to.username

    def validate_phone(self, value):
        clean = clean_phone_number(value)
        if len(clean) < 12 or len(clean) > 15:
            raise serializers.ValidationError(
                'Informe um número de WhatsApp válido com DDD.'
            )
        qs = CRMLead.objects.filter(phone=clean)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Já existe um lead registrado para este WhatsApp.'
            )
        return clean

    def create(self, validated_data):
        if not validated_data.get('client'):
            client = find_client_by_phone(validated_data['phone'])
            if client:
                validated_data['client'] = client
                if not validated_data.get('name'):
                    validated_data['name'] = client.name
        return super().create(validated_data)


class WhatsAppCampaignSerializer(serializers.ModelSerializer):
    audience_label = serializers.CharField(
        source='get_audience_display',
        read_only=True,
    )
    status_label = serializers.CharField(
        source='get_status_display',
        read_only=True,
    )
    coupon_code = serializers.CharField(
        source='coupon.code',
        read_only=True,
        default='',
    )

    class Meta:
        model = WhatsAppCampaign
        fields = [
            'id',
            'title',
            'audience',
            'audience_label',
            'coupon',
            'coupon_code',
            'message',
            'status',
            'status_label',
            'recipients_count',
            'sent_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'audience_label',
            'status_label',
            'coupon_code',
            'status',
            'recipients_count',
            'sent_at',
            'created_at',
            'updated_at',
        ]
