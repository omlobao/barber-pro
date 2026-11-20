from django.contrib import admin

from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'phone_number',
        'email',
        'total_visits',
        'no_show_count',
        'is_blocked',
        'created_at',
    )
    list_editable = ('is_blocked',)
    list_filter = ('is_blocked', 'created_at')
    search_fields = ('name', 'phone_number', 'email')
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        (
            'Dados Pessoais',
            {
                'fields': (
                    'id',
                    'name',
                    'phone_number',
                    'email',
                    'birth_date',
                    'notes',
                ),
            },
        ),
        (
            'Histórico e Restrições',
            {
                'fields': ('total_visits', 'no_show_count', 'is_blocked'),
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
