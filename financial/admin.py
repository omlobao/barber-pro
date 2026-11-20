from django.contrib import admin
from django.utils import timezone

from .models import CashFlowTransaction, ComissionRecord, Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1
    autocomplete_fields = ('service', 'product')
    readonly_fields = ('total_price', 'comission_amount')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'short_id',
        'client',
        'professional',
        'status',
        'payment_method',
        'subtotal',
        'discount_total',
        'tip',
        'total_amount',
        'paid_at',
    )
    list_filter = ('status', 'payment_method', 'professional', 'created_at')
    search_fields = (
        'id',
        'client__name',
        'client__phone_number',
        'professional__display_name',
        'notes',
    )
    date_hierarchy = 'created_at'
    autocomplete_fields = ('appointment', 'client', 'professional')
    readonly_fields = (
        'id',
        'subtotal',
        'total_amount',
        'paid_at',
        'created_at',
        'updated_at',
    )
    inlines = [OrderItemInline]
    fieldsets = (
        (
            'Identificação',
            {
                'fields': (
                    'id',
                    'appointment',
                    'client',
                    'professional',
                    'status',
                    'payment_method',
                ),
            },
        ),
        (
            'Valores',
            {
                'fields': (
                    'subtotal',
                    'discount_total',
                    'tip',
                    'total_amount',
                ),
            },
        ),
        (
            'Observações e Datas',
            {
                'fields': ('notes', 'paid_at', 'created_at', 'updated_at'),
            },
        ),
    )

    @admin.display(description='Comanda')
    def short_id(self, obj):
        return f"#{str(obj.id)[:8]}"

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        form.instance.recalculate_totals()


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        'order',
        'item_type',
        'service',
        'product',
        'quantity',
        'unit_price',
        'total_price',
        'comission_rate',
        'comission_amount',
    )
    list_filter = ('item_type',)
    search_fields = ('order__id', 'service__name', 'product__name')
    autocomplete_fields = ('order', 'service', 'product')
    readonly_fields = ('total_price', 'comission_amount')


@admin.register(ComissionRecord)
class ComissionRecordAdmin(admin.ModelAdmin):
    list_display = (
        'professional',
        'order',
        'base_amount',
        'comission_amount',
        'status',
        'paid_at',
        'created_at',
    )
    list_filter = ('status', 'professional', 'created_at')
    search_fields = ('professional__display_name', 'order__id')
    date_hierarchy = 'created_at'
    autocomplete_fields = ('professional', 'order')
    readonly_fields = ('id', 'created_at')
    actions = ['mark_as_paid']

    @admin.action(description='Marcar comissões selecionadas como Pagas')
    def mark_as_paid(self, request, queryset):
        queryset.filter(status=ComissionRecord.Status.PENDING).update(
            status=ComissionRecord.Status.PAID,
            paid_at=timezone.now(),
        )


@admin.register(CashFlowTransaction)
class CashFlowTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'date',
        'transaction_type',
        'category',
        'description',
        'amount',
        'payment_method',
        'order',
    )
    list_filter = ('transaction_type', 'category', 'payment_method', 'date')
    search_fields = ('description', 'order__id')
    date_hierarchy = 'date'
    autocomplete_fields = ('order',)
    readonly_fields = ('id', 'created_at')
