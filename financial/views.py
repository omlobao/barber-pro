from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import serializers, status, viewsets
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

FINANCIAL_TAG = '7. Painel — Financeiro, Comandas (PDV) & Caixa'


@extend_schema_view(
    list=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Listar comandas / vendas (PDV)',
        description=(
            'Retorna todas as comandas (abertas, pagas e canceladas) com '
            'seus respectivos itens de serviço e produto.'
        ),
    ),
    retrieve=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Consultar detalhes de uma comanda',
        description=(
            'Retorna uma comanda específica com subtotal, desconto, gorjeta, '
            'total líquido e lista de itens consumidos.'
        ),
    ),
    create=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Abrir nova comanda avulsa (Balcão)',
        description=(
            'Abre uma nova comanda no status `OPEN` (pode ser vinculada a '
            'um cliente ou aberta como venda avulsa de balcão).'
        ),
    ),
    update=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Atualizar comanda completa (PUT)',
        description='Atualiza os dados gerais de uma comanda.',
    ),
    partial_update=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Atualizar comanda parcialmente (PATCH)',
        description=(
            'Permite atualizar observações, profissional responsável, '
            'desconto ou gorjeta de uma comanda.'
        ),
    ),
    destroy=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Excluir comanda',
        description='Remove o registro de uma comanda do sistema.',
    ),
)
class AdminOrderViewSet(viewsets.ModelViewSet):
    queryset = (
        Order.objects.select_related('client', 'professional')
        .prefetch_related('items__service', 'items__product')
    )
    serializer_class = OrderSerializer
    permission_classes = [IsBarberShopStaff]

    @extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Adicionar serviço extra ou produto na comanda aberta',
        description=(
            'Adiciona um item (`SERVICE` ou `PRODUCT`) à comanda aberta. '
            'Preenche automaticamente o preço unitário e a taxa de comissão '
            'do barbeiro caso não sejam informados e recalcula o total da '
            'comanda.'
        ),
        request=OrderItemSerializer,
        responses={201: OrderSerializer},
    )
    @action(detail=True, methods=['post'], url_path='add-item')
    def add_item(self, request, pk=None):
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

    @extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Remover item de uma comanda aberta',
        description=(
            'Exclui um item específico (`item_id`) da comanda aberta e '
            'recalcula automaticamente o `subtotal` e `total_amount`.'
        ),
        parameters=[
            OpenApiParameter(
                name='item_id',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.PATH,
                description=(
                    'ID do item da comanda (OrderItem) a ser removido.'
                ),
            ),
        ],
        responses={200: OrderSerializer},
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

    @extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Fechar e receber comanda (Liquidação PDV)',
        description=(
            'Executa o fechamento atômico da comanda:\n'
            '1. Aplica `discount_total` e `tip` (gorjeta), se enviados.\n'
            '2. Valida e desconta o estoque dos produtos vendidos.\n'
            '3. Muda o status da comanda para `PAID`.\n'
            '4. Conclui o agendamento vinculado (`COMPLETED`) e incrementa '
            '`client.total_visits`.\n'
            '5. Gera o registro de comissão do barbeiro (`ComissionRecord`).\n'
            '6. Lança a entrada financeira no fluxo de caixa.'
        ),
        request=CloseOrderSerializer,
        responses={200: OrderSerializer},
    )
    @action(detail=True, methods=['post'], url_path='close')
    def close(self, request, pk=None):
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


@extend_schema_view(
    list=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Listar registros de comissões de barbeiros',
        description=(
            'Lista as comissões geradas no fechamento de comandas. '
            'Administradores visualizam todos os barbeiros; profissionais '
            'visualizam apenas as próprias comissões.'
        ),
    ),
    retrieve=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Consultar detalhes de um registro de comissão',
        description='Retorna os dados de uma comissão específica pelo UUID.',
    ),
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

    @extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Confirmar pagamento/repasse de comissão ao barbeiro',
        description=(
            'Restrito ao administrador (`is_staff`). Marca a comissão '
            'pendente como `PAID`, preenche `paid_at` e lança '
            'automaticamente uma saída (`EXPENSE` / `COMISSION_PAYOUT`) no '
            'fluxo de caixa da barbearia.'
        ),
        request=None,
        responses={200: ComissionRecordSerializer},
    )
    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
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


@extend_schema_view(
    list=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Listar movimentações do fluxo de caixa',
        description=(
            'Lista todas as entradas (`INCOME`) e saídas (`EXPENSE`) do '
            'caixa, permitindo filtrar por período (`start_date` e '
            '`end_date`), tipo e categoria.'
        ),
        parameters=[
            OpenApiParameter(
                name='start_date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Data inicial (YYYY-MM-DD).',
            ),
            OpenApiParameter(
                name='end_date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Data final (YYYY-MM-DD).',
            ),
            OpenApiParameter(
                name='transaction_type',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description=(
                    'Filtra por INCOME (Receita) ou EXPENSE (Despesa).'
                ),
            ),
            OpenApiParameter(
                name='category',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description=(
                    'Filtra por categoria (ORDER_PAYMENT, COMISSION_PAYOUT, '
                    'STOCK_PURCHASE, FIXED_EXPENSE, OTHER).'
                ),
            ),
        ],
    ),
    retrieve=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Consultar detalhes de um lançamento de caixa',
        description='Retorna os dados de uma transação financeira pelo UUID.',
    ),
    create=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Registrar lançamento manual no caixa (Despesa ou Receita)',
        description=(
            'Permite ao administrador lançar despesas fixas (aluguel, luz, '
            'internet), compras de insumos ou entradas avulsas no caixa.'
        ),
    ),
    update=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Atualizar lançamento de caixa (PUT)',
        description='Atualiza todos os campos de uma transação do caixa.',
    ),
    partial_update=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Atualizar lançamento de caixa parcialmente (PATCH)',
        description='Altera descrição, valor, categoria ou data.',
    ),
    destroy=extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Excluir lançamento de caixa',
        description='Remove um lançamento financeiro (restrito a `is_staff`).',
    ),
)
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

    @extend_schema(
        tags=[FINANCIAL_TAG],
        summary='Obter resumo financeiro consolidado (Dashboard)',
        description=(
            'Retorna os indicadores financeiros agregados do período: total '
            'de receitas (`total_income`), total de despesas '
            '(`total_expense`), saldo líquido (`net_balance`), total de '
            'comissões pendentes de repasse (`pending_commissions`) e '
            'quantidade de comandas pagas (`paid_orders_count`).'
        ),
        parameters=[
            OpenApiParameter(
                name='start_date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Data inicial do período (YYYY-MM-DD).',
            ),
            OpenApiParameter(
                name='end_date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Data final do período (YYYY-MM-DD).',
            ),
        ],
        responses={
            200: inline_serializer(
                name='CashFlowSummaryResponse',
                fields={
                    'start_date': serializers.DateField(allow_null=True),
                    'end_date': serializers.DateField(allow_null=True),
                    'total_income': serializers.DecimalField(
                        max_digits=12,
                        decimal_places=2,
                    ),
                    'total_expense': serializers.DecimalField(
                        max_digits=12,
                        decimal_places=2,
                    ),
                    'net_balance': serializers.DecimalField(
                        max_digits=12,
                        decimal_places=2,
                    ),
                    'pending_commissions': serializers.DecimalField(
                        max_digits=12,
                        decimal_places=2,
                    ),
                    'paid_orders_count': serializers.IntegerField(),
                },
            )
        },
    )
    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
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
