from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsBarberShopStaff, IsOwnerOrReadOnly
from .models import CashFlowTransaction, ComissionRecord, Order, OrderItem
from .serializers import (
    CashFlowTransactionSerializer,
    CloseOrderSerializer,
    ComissionRecordSerializer,
    OrderItemSerializer,
    OrderSerializer,
)


class AdminOrderViewSet(viewsets.ModelViewSet):
    queryset = (
        Order.objects.select_related('client', 'professional')
        .prefetch_related('items__service', 'items__product')
    )
    serializer_class = OrderSerializer
    permission_classes = [IsBarberShopStaff]

    @action(detail=True, methods=['post'], url_path='add-item')
    def add_item(self, request, pk=None):
        """Adiciona um serviço extra ou produto na comanda aberta."""
        order = self.get_object()
        if order.status != Order.Status.OPEN:
            return Response(
                {'detail': 'Só é possível editar comandas abertas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = OrderItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(order=order)
        order.recalculate_totals()

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'remove-item/(?P<item_id>[^/.]+)',
    )
    def remove_item(self, request, pk=None, item_id=None):
        order = self.get_object()
        if order.status != Order.Status.OPEN:
            return Response(
                {'detail': 'Só é possível editar comandas abertas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted, _ = OrderItem.objects.filter(
            id=item_id,
            order=order,
        ).delete()
        if not deleted:
            return Response(
                {'detail': 'Item não encontrado na comanda.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        order.recalculate_totals()
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='close')
    def close(self, request, pk=None):
        """Fecha a comanda, baixa estoque, gera comissão e lança no caixa."""
        order = self.get_object()
        serializer = CloseOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        update_fields = []

        if 'discount_total' in data:
            order.discount_total = data['discount_total']
            update_fields.append('discount_total')
        elif 'discount' in data:
            order.discount_total = data['discount']
            update_fields.append('discount_total')

        if 'tip' in data:
            order.tip = data['tip']
            update_fields.append('tip')

        if update_fields:
            update_fields.append('updated_at')
            order.save(update_fields=update_fields)

        try:
            order.close_order(payment_method=data['payment_method'])
        except DjangoValidationError as exc:
            return Response(
                {'detail': exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_200_OK,
        )


class AdminCommissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ComissionRecord.objects.select_related(
        'professional',
        'order',
    ).all()
    serializer_class = ComissionRecordSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        if (
            not self.request.user.is_staff
            and hasattr(self.request.user, 'professional_profile')
        ):
            qs = qs.filter(
                professional=self.request.user.professional_profile
            )
        return qs

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        """Dono marca a comissão como repassada e registra saída no caixa."""
        if not request.user.is_staff:
            return Response(
                {'detail': 'Apenas o administrador pode confirmar repasses.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        record = self.get_object()
        if record.status != ComissionRecord.Status.PENDING:
            return Response(
                {'detail': 'Esta comissão não está pendente.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            record.status = ComissionRecord.Status.PAID
            record.paid_at = timezone.now()
            record.save(update_fields=['status', 'paid_at'])

            prof_name = record.professional.display_name
            CashFlowTransaction.objects.create(
                transaction_type=CashFlowTransaction.TransactionType.EXPENSE,
                category=CashFlowTransaction.Category.COMISSION_PAYOUT,
                description=f"Repasse comissão - {prof_name}",
                amount=record.comission_amount,
                payment_method=Order.PaymentMethod.PIX,
                date=timezone.localdate(),
            )

        return Response(ComissionRecordSerializer(record).data)


class AdminCashFlowViewSet(viewsets.ModelViewSet):
    queryset = CashFlowTransaction.objects.all()
    serializer_class = CashFlowTransactionSerializer
    permission_classes = [IsBarberShopStaff, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        tx_type = self.request.query_params.get('transaction_type')
        category = self.request.query_params.get('category')

        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)
        if tx_type:
            qs = qs.filter(transaction_type=tx_type)
        if category:
            qs = qs.filter(category=category)

        return qs

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Retorna o resumo financeiro consolidado para o dashboard
        (entradas, saídas, saldo líquido e comissões pendentes).
        GET /api/admin/cashflow/summary/?start_date=YYYY-MM-DD&end_date=...
        """
        qs = self.get_queryset()
        zero = Decimal('0.00')

        income_agg = qs.filter(
            transaction_type=CashFlowTransaction.TransactionType.INCOME
        ).aggregate(total=Sum('amount'))
        expense_agg = qs.filter(
            transaction_type=CashFlowTransaction.TransactionType.EXPENSE
        ).aggregate(total=Sum('amount'))

        total_income = income_agg['total'] or zero
        total_expense = expense_agg['total'] or zero
        net_balance = total_income - total_expense

        commissions_qs = ComissionRecord.objects.filter(
            status=ComissionRecord.Status.PENDING
        )
        orders_qs = Order.objects.filter(status=Order.Status.PAID)

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            commissions_qs = commissions_qs.filter(
                created_at__date__gte=start_date
            )
            orders_qs = orders_qs.filter(paid_at__date__gte=start_date)
        if end_date:
            commissions_qs = commissions_qs.filter(
                created_at__date__lte=end_date
            )
            orders_qs = orders_qs.filter(paid_at__date__lte=end_date)

        pending_agg = commissions_qs.aggregate(total=Sum('comission_amount'))
        pending_commissions = pending_agg['total'] or zero

        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'total_income': total_income,
            'total_expense': total_expense,
            'net_balance': net_balance,
            'pending_commissions': pending_commissions,
            'paid_orders_count': orders_qs.count(),
        })
