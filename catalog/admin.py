from django.contrib import admin

from .models import Product, Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'category',
        'price',
        'promotion_price',
        'duration_minutes',
        'is_featured',
        'display_order',
        'is_active',
    )
    list_editable = ('is_featured', 'display_order', 'is_active')
    list_filter = ('category', 'is_featured', 'is_active')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        (
            'Informações do Serviço',
            {
                'fields': (
                    'id',
                    'name',
                    'slug',
                    'category',
                    'description',
                    'image',
                ),
            },
        ),
        (
            'Valores e Duração',
            {
                'fields': ('price', 'promotion_price', 'duration_minutes'),
            },
        ),
        (
            'Exibição',
            {
                'fields': ('is_featured', 'display_order', 'is_active'),
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


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'sku',
        'cost_price',
        'sale_price',
        'stock_quantity',
        'is_low_stock',
        'is_active',
    )
    list_editable = ('sale_price', 'stock_quantity', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'sku', 'description')
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        (
            'Informações do Produto',
            {
                'fields': ('id', 'name', 'sku', 'description', 'image'),
            },
        ),
        (
            'Preços e Estoque',
            {
                'fields': (
                    'cost_price',
                    'sale_price',
                    'stock_quantity',
                    'min_stock_alert',
                ),
            },
        ),
        (
            'Status',
            {
                'fields': ('is_active',),
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

    @admin.display(boolean=True, description='Estoque Baixo')
    def is_low_stock(self, obj):
        return obj.stock_quantity <= obj.min_stock_alert
