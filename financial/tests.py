from datetime import time, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Product, Service
from professionals.models import Professional, WorkingHours
from scheduling.services import create_booking
from .models import CashFlowTransaction, ComissionRecord, Order, OrderItem


class FinancialFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin_fin',
            password='password123',
            is_staff=True,
        )
        self.service = Service.objects.create(
            name='Corte + Barba',
            price=Decimal('80.00'),
            duration_minutes=45,
        )
        self.product = Product.objects.create(
            name='Pomada Modeladora',
            cost_price=Decimal('15.00'),
            sale_price=Decimal('40.00'),
            stock_quantity=5,
            min_stock_alert=2,
        )
        self.professional = Professional.objects.create(
            user=self.user,
            display_name='João Barbeiro',
            slug='joao-barbeiro',
            phone_number='11988880001',
            service_comission_rate=Decimal('50.00'),
            product_comission_rate=Decimal('10.00'),
        )
        self.professional.services.add(self.service)

        self.target_date = timezone.localdate() + timedelta(days=3)
        WorkingHours.objects.create(
            professional=self.professional,
            day_of_week=self.target_date.isoweekday(),
            is_working=True,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        self.appointment = create_booking(
            professional=self.professional,
            service_ids=[self.service.id],
            target_date=self.target_date,
            start_time=time(10, 0),
            client_name='Pedro Cliente',
            client_phone='11944443333',
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_order_creation_stock_deduction_commission_and_cashflow(self):
        order = Order.create_from_appointment(self.appointment)
        self.assertEqual(order.subtotal, Decimal('80.00'))

        # Adiciona 2 unidades de pomada (2 x R$ 40,00 = R$ 80,00)
        OrderItem.objects.create(
            order=order,
            item_type=OrderItem.ItemType.PRODUCT,
            product=self.product,
            quantity=2,
        )
        order.recalculate_totals()
        self.assertEqual(order.subtotal, Decimal('160.00'))

        # Fecha comanda via API aplicando desconto de R$ 10 e gorjeta de R$ 15
        close_url = reverse('admin-orders-close', args=[order.id])
        resp = self.api.post(
            close_url,
            {
                'payment_method': Order.PaymentMethod.PIX,
                'discount_total': '10.00',
                'tip': '15.00',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)

        order.refresh_from_db()
        self.product.refresh_from_db()
        self.appointment.refresh_from_db()
        client = self.appointment.client
        client.refresh_from_db()

        # Total: (160 - 10) + 15 = R$ 165,00
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(order.total_amount, Decimal('165.00'))
        self.assertEqual(self.product.stock_quantity, 3)
        self.assertEqual(
            self.appointment.status,
            self.appointment.Status.COMPLETED,
        )
        self.assertEqual(client.total_visits, 1)

        # Comissão: 50% de 80 (40) + 10% de 80 (8) + gorjeta (15) = R$ 63,00
        commission = ComissionRecord.objects.get(order=order)
        self.assertEqual(commission.comission_amount, Decimal('63.00'))

        # Lançamento de entrada no caixa: R$ 165,00
        cashflow = CashFlowTransaction.objects.get(order=order)
        self.assertEqual(cashflow.amount, Decimal('165.00'))

        # Repassa a comissão ao barbeiro e confere o resumo financeiro
        pay_url = reverse(
            'admin-commissions-mark-paid',
            args=[commission.id],
        )
        pay_resp = self.api.post(pay_url)
        self.assertEqual(pay_resp.status_code, 200)

        summary_url = reverse('admin-cashflow-summary')
        sum_resp = self.api.get(summary_url)
        self.assertEqual(sum_resp.status_code, 200)
        self.assertEqual(sum_resp.data['total_income'], Decimal('165.00'))
        self.assertEqual(sum_resp.data['total_expense'], Decimal('63.00'))
        self.assertEqual(sum_resp.data['net_balance'], Decimal('102.00'))
        self.assertEqual(sum_resp.data['pending_commissions'], Decimal('0.00'))

    def test_insufficient_stock_blocks_order_close(self):
        order = Order.create_from_appointment(self.appointment)
        OrderItem.objects.create(
            order=order,
            item_type=OrderItem.ItemType.PRODUCT,
            product=self.product,
            quantity=10,
        )
        with self.assertRaises(ValidationError):
            order.close_order(payment_method=Order.PaymentMethod.CASH)
