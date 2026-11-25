from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import CashFlowTransaction, ComissionRecord, Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    item_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id',
            'item_type',
            'service',
            'product',
            'item_name',
            'quantity',
            'unit_price',
            'total_price',
            'comission_rate',
            'comission_amount',
        ]
        read_only_fields = ['total_price', 'comission_amount']
        extra_kwargs = {
            'unit_price': {'required': False},
            'comission_rate': {'required': False},
        }

    def get_item_name(self, obj):
        if obj.service:
            return obj.service.name
        if obj.product:
            return obj.product.name
        return ''

    def validate(self, attrs):
        item_type = attrs.get('item_type')
        service = attrs.get('service')
        product = attrs.get('product')

        if item_type == OrderItem.ItemType.SERVICE and not service:
            raise serializers.ValidationError({
                'service': 'Selecione qual serviço foi realizado.'
            })
        if item_type == OrderItem.ItemType.PRODUCT and not product:
            raise serializers.ValidationError({
                'product': 'Selecione qual produto foi vendido.'
            })
        return attrs

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    client_name = serializers.CharField(
        source='client.name',
        read_only=True,
        default='Cliente Balcão',
    )
    professional_name = serializers.CharField(
        source='professional.display_name',
        read_only=True,
    )
    tip = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default=Decimal('0.00'),
    )

    class Meta:
        model = Order
        fields = [
            'id',
            'appointment',
            'client',
            'client_name',
            'professional',
            'professional_name',
            'status',
            'payment_method',
            'subtotal',
            'discount_total',
            'tip',
            'total_amount',
            'notes',
            'paid_at',
            'created_at',
            'updated_at',
            'items',
        ]
        read_only_fields = [
            'subtotal',
            'total_amount',
            'paid_at',
            'created_at',
            'updated_at',
        ]


class CloseOrderSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(
        choices=Order.PaymentMethod.choices,
    )
    discount_total = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=Decimal('0.00'),
    )
    discount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=Decimal('0.00'),
        write_only=True,
    )
    tip = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=Decimal('0.00'),
    )


class ComissionRecordSerializer(serializers.ModelSerializer):
    professional_name = serializers.CharField(
        source='professional.display_name',
        read_only=True,
    )

    class Meta:
        model = ComissionRecord
        fields = [
            'id',
            'professional',
            'professional_name',
            'order',
            'base_amount',
            'comission_amount',
            'status',
            'paid_at',
            'created_at',
        ]


# Alias para compatibilidade de grafia
CommissionRecordSerializer = ComissionRecordSerializer


class CashFlowTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashFlowTransaction
        fields = [
            'id',
            'transaction_type',
            'category',
            'order',
            'description',
            'amount',
            'payment_method',
            'date',
            'created_at',
        ]
