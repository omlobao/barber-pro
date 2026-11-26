from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Coupon, Product, Service


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
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})


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
        extra_kwargs = {
            'sku': {'required': False, 'allow_blank': True},
        }

    def get_is_low_stock(self, obj) -> bool:
        return obj.stock_quantity <= obj.min_stock_alert

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            'id',
            'code',
            'description',
            'discount_type',
            'discount_value',
            'min_order_amount',
            'valid_from',
            'valid_until',
            'max_uses',
            'used_count',
            'only_first_visit',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'used_count',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'code': {'validators': []},
        }

    def validate_code(self, value: str) -> str:
        normalized = (value or '').strip().upper().replace(' ', '')
        if len(normalized) < 3:
            raise serializers.ValidationError(
                'O código do cupom deve ter pelo menos 3 caracteres.'
            )
        qs = Coupon.objects.filter(code__iexact=normalized)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Já existe um cupom cadastrado com este código.'
            )
        return normalized

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})
