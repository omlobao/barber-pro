from django.contrib import admin

from .models import (
    CRMLead,
    WhatsAppCampaign,
    WhatsAppConversation,
    WhatsAppHumanQueueEntry,
    WhatsAppMessage,
    WhatsAppSettings,
)


@admin.register(WhatsAppSettings)
class WhatsAppSettingsAdmin(admin.ModelAdmin):
    list_display = (
        'shop_name',
        'provider',
        'instance_name',
        'bot_enabled',
        'updated_at',
    )


@admin.register(WhatsAppConversation)
class WhatsAppConversationAdmin(admin.ModelAdmin):
    list_display = (
        'phone',
        'contact_name',
        'status',
        'unread_count',
        'last_message_at',
    )
    search_fields = ('phone', 'contact_name')
    list_filter = ('status',)


@admin.register(WhatsAppMessage)
class WhatsAppMessageAdmin(admin.ModelAdmin):
    list_display = (
        'conversation',
        'direction',
        'status',
        'sender',
        'created_at',
    )
    search_fields = ('text', 'message_id', 'conversation__phone')
    list_filter = ('direction', 'status')


@admin.register(WhatsAppHumanQueueEntry)
class WhatsAppHumanQueueEntryAdmin(admin.ModelAdmin):
    list_display = (
        'phone',
        'contact_name',
        'status',
        'assigned_to',
        'requested_at',
    )
    list_filter = ('status',)


@admin.register(CRMLead)
class CRMLeadAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'phone',
        'stage',
        'source',
        'assigned_to',
        'updated_at',
    )
    list_filter = ('stage', 'source')
    search_fields = ('name', 'phone', 'interest')


@admin.register(WhatsAppCampaign)
class WhatsAppCampaignAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'audience',
        'status',
        'recipients_count',
        'sent_at',
    )
    list_filter = ('status', 'audience')
