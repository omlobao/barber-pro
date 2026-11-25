from rest_framework import serializers

from .models import Product, Service


class ServiceSerializer(serializers.ModelSerializer):
    effective_price = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Service
        fields = [
            'id',
            'name',
            'slug',
            'category',
            'description',
            'price',
            'promotion_price',
            'effective_price',
            'duration_minutes',
            'image',
            'is_featured',
            'display_order',
            'is_active',
        ]


class ProductSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'sku',
            'description',
            'cost_price',
            'sale_price',
            'stock_quantity',
            'min_stock_alert',
            'is_low_stock',
            'image',
            'is_active',
        ]

    def get_is_low_stock(self, obj) -> bool:
        return obj.stock_quantity <= obj.min_stock_alert
