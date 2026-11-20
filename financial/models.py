from decimal import Decimal
import uuid

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone


class Order(models.Model):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Aberta'
        PAID = 'PAID', 'Paga / Concluída'
        CANCELLED = 'CANCELLED', 'Cancelada'

    class PaymentMethod(models.TextChoices):
        PIX = 'PIX', 'Pix'
        CREDIT_CARD = 'CREDIT_CARD', 'Cartão de Crédito'
        DEBIT_CARD = 'DEBIT_CARD', 'Cartão de Débito'
        CASH = 'CASH', 'Dinheiro'
        MIXED = 'MIXED', 'Pagamento Misto'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    appointment = models.OneToOneField(
        'scheduling.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order',
        help_text=(
            "Vinculado ao agendamento (pode ficar vazio para "
            "venda avulsa no balcão)"
        ),
    )
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )
    professional = models.ForeignKey(
        'professionals.Professional',
        on_delete=models.PROTECT,
        related_name='orders',
        verbose_name='Profissional',
    )
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        null=True,
        blank=True,
    )
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Subtotal',
    )
    discount_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Desconto Total',
    )
    tip = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Gorjeta / Caixinha',
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Valor Total',
    )
    notes = models.CharField(
        max_length=255,
        blank=True,
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Data Pagamento',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Venda / Ordem'
        verbose_name_plural = 'Vendas / Ordens'
        ordering = ['-created_at']

    def recalculate_totals(self):
        """Soma todos os itens da comanda e aplica descontos e gorjetas."""
        items_total = sum(
            (item.total_price for item in self.items.all()),
            Decimal('0.00'),
        )
        self.subtotal = items_total
        self.total_amount = max(
            Decimal('0.00'),
            self.subtotal - self.discount_total,
        ) + self.tip
        self.save(update_fields=['subtotal', 'total_amount', 'updated_at'])

    @classmethod
    def create_from_appointment(cls, appointment):
        """Abre uma comanda puxando os serviços do agendamento."""
        with transaction.atomic():
            order, created = cls.objects.get_or_create(
                appointment=appointment,
                defaults={
                    'client': appointment.client,
                    'professional': appointment.professional,
                },
            )
            if created:
                app_items = appointment.items.select_related('service').all()
                for app_item in app_items:
                    OrderItem.objects.create(
                        order=order,
                        item_type=OrderItem.ItemType.SERVICE,
                        service=app_item.service,
                        quantity=1,
                        unit_price=app_item.price,
                    )
                order.recalculate_totals()
        return order

    def close_order(self, payment_method):
        """
        Fecha a comanda, baixa o estoque de produtos, gera a comissão
        do barbeiro e registra a entrada no fluxo de caixa.
        """
        if payment_method not in self.PaymentMethod.values:
            raise ValidationError("Forma de pagamento inválida.")

        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.pk)

            if order.status == self.Status.PAID:
                raise ValidationError("Esta comanda já está paga.")
            if order.status == self.Status.CANCELLED:
                raise ValidationError("Esta comanda já está cancelada.")

            order.recalculate_totals()
            items = order.items.select_related('product', 'service').all()

            if not items.exists():
                raise ValidationError(
                    "Não é possível fechar uma comanda vazia."
                )

            total_comission = Decimal('0.00')

            for item in items:
                total_comission += item.comission_amount

                # Se for produto físico, valida e desconta do estoque
                is_product = item.item_type == OrderItem.ItemType.PRODUCT
                if is_product and item.product_id:
                    product_model = item.product.__class__
                    product = product_model.objects.select_for_update().get(
                        pk=item.product_id
                    )
                    if product.stock_quantity < item.quantity:
                        raise ValidationError(
                            f"Estoque insuficiente para '{product.name}'. "
                            f"Disponível: {product.stock_quantity}."
                        )
                    product.stock_quantity -= item.quantity
                    product.save(
                        update_fields=['stock_quantity', 'updated_at']
                    )

            # 1. Atualiza o status da comanda
            order.status = self.Status.PAID
            order.payment_method = payment_method
            order.paid_at = timezone.now()
            order.save(
                update_fields=[
                    'status',
                    'payment_method',
                    'paid_at',
                    'updated_at',
                ]
            )

            # Sincroniza a instância em memória
            self.status = order.status
            self.payment_method = order.payment_method
            self.paid_at = order.paid_at
            self.subtotal = order.subtotal
            self.total_amount = order.total_amount

            # 2. Finaliza o agendamento e incrementa visitas do cliente
            if order.appointment:
                order.appointment.status = order.appointment.Status.COMPLETED
                order.appointment.save(update_fields=['status', 'updated_at'])

            if order.client:
                order.client.total_visits += 1
                order.client.save(
                    update_fields=['total_visits', 'updated_at']
                )

            # 3. Gera a comissão para o barbeiro (incluindo gorjeta)
            ComissionRecord.objects.create(
                professional=order.professional,
                order=order,
                base_amount=order.subtotal,
                comission_amount=total_comission + order.tip,
            )

            # 4. Lança a entrada no fluxo de caixa da barbearia
            short_id = str(order.id)[:8]
            CashFlowTransaction.objects.create(
                transaction_type=CashFlowTransaction.TransactionType.INCOME,
                category=CashFlowTransaction.Category.ORDER_PAYMENT,
                order=order,
                description=(
                    f"Comanda #{short_id} - "
                    f"{order.professional.display_name}"
                ),
                amount=order.total_amount,
                payment_method=payment_method,
                date=timezone.localdate(),
            )

    def __str__(self):
        client_name = self.client.name if self.client else "Cliente Balcão"
        return (
            f"Comanda {client_name} - R$ {self.total_amount} "
            f"({self.get_status_display()})"
        )


class OrderItem(models.Model):
    class ItemType(models.TextChoices):
        SERVICE = 'SERVICE', 'Serviço'
        PRODUCT = 'PRODUCT', 'Produto'

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
    )
    item_type = models.CharField(
        max_length=10,
        choices=ItemType.choices,
    )
    service = models.ForeignKey(
        'catalog.Service',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    quantity = models.PositiveSmallIntegerField(default=1)
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        editable=False,
    )
    comission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Porcentagem de comissão aplicada neste item.",
    )
    comission_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        editable=False,
        help_text="Valor em R$ da comissão gerada por este item.",
    )

    class Meta:
        verbose_name = 'Item da Comanda'
        verbose_name_plural = 'Itens da Comanda'

    def clean(self):
        if self.item_type == self.ItemType.SERVICE and not self.service:
            raise ValidationError("Selecione qual serviço foi realizado.")
        if self.item_type == self.ItemType.PRODUCT and not self.product:
            raise ValidationError("Selecione qual produto foi vendido.")

    def save(self, *args, **kwargs):
        self.clean()
        professional = self.order.professional

        # Define preço e comissão automaticamente se não informados
        if self.item_type == self.ItemType.SERVICE and self.service:
            if self.unit_price is None:
                self.unit_price = self.service.effective_price
            if self.comission_rate is None:
                self.comission_rate = professional.service_comission_rate

        elif self.item_type == self.ItemType.PRODUCT and self.product:
            if self.unit_price is None:
                self.unit_price = self.product.sale_price
            if self.comission_rate is None:
                self.comission_rate = professional.product_comission_rate

        self.total_price = Decimal(self.unit_price) * Decimal(self.quantity)
        self.comission_amount = (
            self.total_price * Decimal(self.comission_rate or 0)
        ) / Decimal('100.00')

        super().save(*args, **kwargs)

    def __str__(self):
        if self.service:
            target = self.service.name
        elif self.product:
            target = self.product.name
        else:
            target = "Item"
        return f"{self.quantity}x {target} (R$ {self.total_price})"


class ComissionRecord(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pendente de Repasse'
        PAID = 'PAID', 'Pago ao Profissional'
        CANCELLED = 'CANCELLED', 'Estornado'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    professional = models.ForeignKey(
        'professionals.Professional',
        on_delete=models.PROTECT,
        related_name='comissions',
    )
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name='comission_record',
    )
    base_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Valor base da comanda",
    )
    comission_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Valor da comissão (R$)',
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Data do Repasse",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Registro de Comissão'
        verbose_name_plural = 'Registros de Comissões'

    def __str__(self):
        return (
            f"{self.professional.display_name} - "
            f"R$ {self.comission_amount} ({self.get_status_display()})"
        )


class CashFlowTransaction(models.Model):
    class TransactionType(models.TextChoices):
        INCOME = 'INCOME', 'Receita'
        EXPENSE = 'EXPENSE', 'Despesa'

    class Category(models.TextChoices):
        ORDER_PAYMENT = 'ORDER_PAYMENT', 'Receimento de Comanda'
        COMISSION_PAYOUT = 'COMISSION_PAYOUT', 'Repasse de Comissão'
        STOCK_PURCHASE = 'STOCK_PURCHASE', 'Compra de Produtos / Insumos'
        FIXED_EXPENSE = (
            'FIXED_EXPENSE',
            'Despesa Fixa (Aluguel, Luz, Internet, etc.)',
        )
        OTHER = 'OTHER', 'Outros'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    transaction_type = models.CharField(
        max_length=10,
        choices=TransactionType.choices,
        db_index=True,
    )
    category = models.CharField(
        max_length=25,
        choices=Category.choices,
        default=Category.OTHER,
        db_index=True,
        verbose_name='Categoria',
    )
    order = models.OneToOneField(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cashflow_entry',
    )
    description = models.CharField(
        max_length=200,
        blank=True,
        default='',
        verbose_name="Descrição",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Valor financeiro da entrada ou saída.",
    )
    payment_method = models.CharField(
        max_length=20,
        choices=Order.PaymentMethod.choices,
        default=Order.PaymentMethod.PIX,
    )
    date = models.DateField(
        default=timezone.localdate,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Lançamento de Caixa'
        verbose_name_plural = 'Lançamentos de Caixa'

    def __str__(self):
        is_income = self.transaction_type == self.TransactionType.INCOME
        sinal = "+" if is_income else "-"
        date_str = self.date.strftime('%d/%m/%Y')
        return f"[{date_str}] {sinal} R$ {self.amount} - {self.description}"
