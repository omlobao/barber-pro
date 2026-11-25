from django.contrib import admin

from .models import Appointment, AppointmentItem


class AppointmentItemInline(admin.TabularInline):
    model = AppointmentItem
    extra = 1
    autocomplete_fields = ('service',)


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        'date',
        'start_time',
        'end_time',
        'client',
        'professional',
        'status',
        'total_price',
        'reminder_sent',
    )
    list_filter = ('status', 'professional', 'date', 'reminder_sent')
    search_fields = (
        'id',
        'client__name',
        'client__phone_number',
        'professional__display_name',
    )
    date_hierarchy = 'date'
    autocomplete_fields = ('client', 'professional')
    readonly_fields = ('id', 'cancel_token', 'created_at', 'updated_at')
    inlines = [AppointmentItemInline]
    actions = ['mark_as_confirmed', 'mark_as_canceled', 'mark_as_no_show']
    fieldsets = (
        (
            'Agendamento',
            {
                'fields': (
                    'id',
                    'cancel_token',
                    'client',
                    'professional',
                    'status',
                ),
            },
        ),
        (
            'Horário e Valores',
            {
                'fields': (
                    'date',
                    'start_time',
                    'end_time',
                    'total_duration_minutes',
                    'total_price',
                ),
            },
        ),
        (
            'Observações e Notificações',
            {
                'fields': ('client_notes', 'internal_notes', 'reminder_sent'),
            },
        ),
        (
            'Datas',
            {
                'fields': ('created_at', 'updated_at'),
                'classes': ('collapse',),
            },
        ),
    )

    @admin.action(description='Marcar selecionados como Confirmado')
    def mark_as_confirmed(self, request, queryset):
        queryset.update(status=Appointment.Status.CONFIRMED)

    @admin.action(description='Marcar selecionados como Cancelado')
    def mark_as_canceled(self, request, queryset):
        queryset.update(status=Appointment.Status.CANCELED)

    @admin.action(description='Marcar selecionados como Não Compareceu')
    def mark_as_no_show(self, request, queryset):
        eligible = list(
            queryset.exclude(status=Appointment.Status.NO_SHOW)
            .select_related('client')
        )
        for appointment in eligible:
            appointment.status = Appointment.Status.NO_SHOW
            appointment.save(update_fields=['status', 'updated_at'])
            client = appointment.client
            client.no_show_count += 1
            client.save(update_fields=['no_show_count', 'updated_at'])


@admin.register(AppointmentItem)
class AppointmentItemAdmin(admin.ModelAdmin):
    list_display = ('appointment', 'service', 'price', 'duration_minutes')
    search_fields = (
        'service__name',
        'appointment__client__name',
        'appointment__id',
    )
    autocomplete_fields = ('appointment', 'service')
