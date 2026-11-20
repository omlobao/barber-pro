from django.contrib import admin

from .models import Professional, ScheduleException, WorkingHours


class WorkingHoursInline(admin.TabularInline):
    model = WorkingHours
    extra = 0
    ordering = ('day_of_week',)


class ScheduleExceptionInline(admin.TabularInline):
    model = ScheduleException
    extra = 0
    fields = (
        'date',
        'exception_type',
        'is_all_day',
        'start_time',
        'end_time',
        'reason',
    )


@admin.register(Professional)
class ProfessionalAdmin(admin.ModelAdmin):
    list_display = (
        'display_name',
        'phone_number',
        'service_comission_rate',
        'product_comission_rate',
        'display_order',
        'is_active',
    )
    list_editable = ('display_order', 'is_active')
    list_filter = ('is_active',)
    search_fields = (
        'display_name',
        'phone_number',
        'user__username',
        'user__email',
    )
    prepopulated_fields = {'slug': ('display_name',)}
    filter_horizontal = ('services',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines = [WorkingHoursInline, ScheduleExceptionInline]
    fieldsets = (
        (
            'Informações Básicas',
            {
                'fields': (
                    'id',
                    'user',
                    'display_name',
                    'slug',
                    'phone_number',
                    'bio',
                    'profile_picture',
                ),
            },
        ),
        (
            'Serviços e Comissões',
            {
                'fields': (
                    'services',
                    'service_comission_rate',
                    'product_comission_rate',
                ),
            },
        ),
        (
            'Configurações de Agenda',
            {
                'fields': (
                    'slot_interval_minutes',
                    'buffer_time_minutes',
                    'display_order',
                    'is_active',
                ),
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


@admin.register(WorkingHours)
class WorkingHoursAdmin(admin.ModelAdmin):
    list_display = (
        'professional',
        'day_of_week',
        'is_working',
        'start_time',
        'end_time',
        'break_start',
        'break_end',
    )
    list_filter = ('professional', 'day_of_week', 'is_working')
    search_fields = ('professional__display_name',)
    autocomplete_fields = ('professional',)


@admin.register(ScheduleException)
class ScheduleExceptionAdmin(admin.ModelAdmin):
    list_display = (
        'date',
        'professional',
        'exception_type',
        'is_all_day',
        'start_time',
        'end_time',
        'reason',
    )
    list_filter = ('exception_type', 'is_all_day', 'professional')
    search_fields = ('reason', 'professional__display_name')
    date_hierarchy = 'date'
    autocomplete_fields = ('professional',)
    readonly_fields = ('created_at', 'updated_at')
