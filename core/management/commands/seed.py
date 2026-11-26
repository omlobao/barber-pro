from datetime import time, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from catalog.models import Coupon, Product, Service
from clients.models import Client
from financial.models import Order, OrderItem
from professionals.models import (
    Professional,
    ScheduleException,
    WorkingHours,
)
from scheduling.models import Appointment, AppointmentItem


class Command(BaseCommand):
    help = (
        'Popula o banco de dados com dados realistas de demonstração '
        '(serviços, produtos, barbeiros, expediente, feriados, clientes, '
        'agendamentos e movimentação financeira).'
    )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write('Iniciando carga de dados do BarberPro...')

        # 1. Superusuário Administrador
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@barberpro.com',
                'first_name': 'Admin',
                'last_name': 'BarberPro',
                'is_staff': True,
                'is_superuser': True,
            },
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()

        # 2. Catálogo de Serviços
        services_data = [
            {
                'slug': 'corte-degrade-fade',
                'name': 'Corte Degradê / Fade',
                'category': Service.Category.HAIR,
                'description': (
                    'Corte moderno com acabamento na navalha e finalização.'
                ),
                'price': Decimal('55.00'),
                'promotion_price': None,
                'duration_minutes': 40,
                'is_featured': True,
                'display_order': 1,
            },
            {
                'slug': 'corte-social-classico',
                'name': 'Corte Social Clássico',
                'category': Service.Category.HAIR,
                'description': 'Corte tradicional na tesoura e máquina.',
                'price': Decimal('45.00'),
                'promotion_price': None,
                'duration_minutes': 30,
                'is_featured': False,
                'display_order': 2,
            },
            {
                'slug': 'barboterapia-toalha-quente',
                'name': 'Barboterapia com Toalha Quente',
                'category': Service.Category.BEARD,
                'description': (
                    'Alinhamento de barba com toalha quente, óleo essencial '
                    'e massagem facial.'
                ),
                'price': Decimal('45.00'),
                'promotion_price': Decimal('39.90'),
                'duration_minutes': 30,
                'is_featured': True,
                'display_order': 3,
            },
            {
                'slug': 'combo-vip-corte-barba-sobrancelha',
                'name': 'Combo VIP (Corte + Barba + Sobrancelha)',
                'category': Service.Category.COMBO,
                'description': (
                    'Pacote completo de visual com desconto especial.'
                ),
                'price': Decimal('100.00'),
                'promotion_price': Decimal('89.90'),
                'duration_minutes': 60,
                'is_featured': True,
                'display_order': 4,
            },
            {
                'slug': 'design-sobrancelha-navalha',
                'name': 'Design de Sobrancelha na Navalha',
                'category': Service.Category.AESTHETICS,
                'description': 'Limpeza e alinhamento rápido na navalha.',
                'price': Decimal('20.00'),
                'promotion_price': None,
                'duration_minutes': 15,
                'is_featured': False,
                'display_order': 5,
            },
            {
                'slug': 'selagem-alisamento-masculino',
                'name': 'Selagem & Alisamento Masculino',
                'category': Service.Category.CHEMISTRY,
                'description': 'Redução de volume e alinhamento térmico.',
                'price': Decimal('120.00'),
                'promotion_price': None,
                'duration_minutes': 60,
                'is_featured': False,
                'display_order': 6,
            },
        ]

        services = {}
        for s_data in services_data:
            slug = s_data.pop('slug')
            service, _ = Service.objects.update_or_create(
                slug=slug,
                defaults=s_data,
            )
            services[slug] = service

        # 3. Catálogo de Produtos (incluindo item com estoque baixo)
        products_data = [
            {
                'sku': 'POM-MATTE',
                'name': 'Pomada Modeladora Efeito Matte 120g',
                'description': 'Alta fixação com acabamento seco natural.',
                'cost_price': Decimal('18.00'),
                'sale_price': Decimal('45.00'),
                'stock_quantity': 15,
                'min_stock_alert': 3,
            },
            {
                'sku': 'OLEO-BARBA',
                'name': 'Óleo Hidratante para Barba Cedro 30ml',
                'description': 'Hidratação profunda e brilho sem oleosidade.',
                'cost_price': Decimal('14.00'),
                'sale_price': Decimal('38.00'),
                'stock_quantity': 8,
                'min_stock_alert': 3,
            },
            {
                'sku': 'SHAMP-MENT',
                'name': 'Shampoo Mentolado Antiqueda 250ml',
                'description': 'Limpeza refrescante para couro cabeludo.',
                'cost_price': Decimal('20.00'),
                'sale_price': Decimal('52.00'),
                'stock_quantity': 2,
                'min_stock_alert': 3,
            },
            {
                'sku': 'CERV-IPA',
                'name': 'Cerveja Artesanal IPA Long Neck 355ml',
                'description': 'Cerveja gelada para consumo durante o corte.',
                'cost_price': Decimal('6.50'),
                'sale_price': Decimal('16.00'),
                'stock_quantity': 24,
                'min_stock_alert': 6,
            },
            {
                'sku': 'BALM-POS',
                'name': 'Balm Pós-Barba Calmante 100g',
                'description': 'Evita irritação e foliculite após a navalha.',
                'cost_price': Decimal('15.00'),
                'sale_price': Decimal('35.00'),
                'stock_quantity': 10,
                'min_stock_alert': 3,
            },
        ]

        products = {}
        for p_data in products_data:
            sku = p_data.pop('sku')
            product, _ = Product.objects.update_or_create(
                sku=sku,
                defaults=p_data,
            )
            products[sku] = product

        # 4. Profissionais e Grades de Horário (Segunda a Sábado)
        barbers_data = [
            {
                'username': 'matheus',
                'first_name': 'Matheus',
                'last_name': 'Lobão',
                'display_name': 'Matheus Lobão',
                'slug': 'matheus-lobao',
                'phone_number': '11991110001',
                'bio': (
                    'Master Barber especialista em Fade, Visagismo e '
                    'Barboterapia.'
                ),
                'service_comission_rate': Decimal('50.00'),
                'product_comission_rate': Decimal('15.00'),
                'slot_interval_minutes': 30,
                'buffer_time_minutes': 5,
                'display_order': 1,
            },
            {
                'username': 'lucas',
                'first_name': 'Lucas',
                'last_name': 'Ferreira',
                'display_name': 'Lucas Ferreira',
                'slug': 'lucas-ferreira',
                'phone_number': '11991110002',
                'bio': 'Especialista em cortes clássicos na tesoura e barba.',
                'service_comission_rate': Decimal('45.00'),
                'product_comission_rate': Decimal('10.00'),
                'slot_interval_minutes': 30,
                'buffer_time_minutes': 0,
                'display_order': 2,
            },
            {
                'username': 'rafael',
                'first_name': 'Rafael',
                'last_name': 'Costa',
                'display_name': 'Rafael Costa',
                'slug': 'rafael-costa',
                'phone_number': '11991110003',
                'bio': 'Especialista em degradê navalhado, química e luzes.',
                'service_comission_rate': Decimal('45.00'),
                'product_comission_rate': Decimal('10.00'),
                'slot_interval_minutes': 30,
                'buffer_time_minutes': 0,
                'display_order': 3,
            },
        ]

        professionals = {}
        all_services = list(services.values())

        for b_data in barbers_data:
            username = b_data.pop('username')
            first_name = b_data.pop('first_name')
            last_name = b_data.pop('last_name')
            slug = b_data.pop('slug')

            user, u_created = User.objects.get_or_create(
                username=username,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': f'{username}@barberpro.com',
                    'is_staff': False,
                },
            )
            if u_created:
                user.set_password('barber123')
                user.save()

            prof, _ = Professional.objects.update_or_create(
                slug=slug,
                defaults={'user': user, **b_data},
            )
            prof.services.set(all_services)
            professionals[slug] = prof

            # Expediente: Segunda (1) a Sábado (6) 09h-19h, Domingo (7) folga
            for day in range(1, 8):
                is_working = day != 7
                WorkingHours.objects.update_or_create(
                    professional=prof,
                    day_of_week=day,
                    defaults={
                        'is_working': is_working,
                        'start_time': time(9, 0) if is_working else None,
                        'end_time': time(19, 0) if is_working else None,
                        'break_start': time(12, 0) if is_working else None,
                        'break_end': time(13, 0) if is_working else None,
                    },
                )

        # 5. Feriados Nacionais do Ano Atual
        current_year = timezone.localdate().year
        ScheduleException.populate_national_holidays(year=current_year)

        # 6. Clientes
        clients_data = [
            {
                'phone_number': '11988001122',
                'name': 'Gabriel Almeida',
                'email': 'gabriel.almeida@email.com',
                'notes': 'Prefere degradê médio com navalha alta.',
                'is_blocked': False,
            },
            {
                'phone_number': '11988002233',
                'name': 'Bruno Henrique',
                'email': 'bruno.henrique@email.com',
                'notes': 'Cliente mensalista.',
                'is_blocked': False,
            },
            {
                'phone_number': '11988003344',
                'name': 'Felipe Santos',
                'email': 'felipe.santos@email.com',
                'notes': '',
                'is_blocked': False,
            },
            {
                'phone_number': '11988004455',
                'name': 'Rodrigo Faltoso',
                'email': 'rodrigo@email.com',
                'notes': 'Bloqueado após 3 faltas consecutivas sem aviso.',
                'no_show_count': 3,
                'is_blocked': True,
            },
        ]

        clients = {}
        for c_data in clients_data:
            phone = c_data.pop('phone_number')
            client, _ = Client.objects.update_or_create(
                phone_number=phone,
                defaults=c_data,
            )
            clients[phone] = client

        # Contas online de demonstração para clientes (senha: cliente123)
        demo_accounts = [
            ('11988001122', 'Gabriel', 'gabriel.almeida@email.com'),
            ('11988003344', 'Felipe', 'felipe.santos@email.com'),
        ]
        for phone, first_name, email in demo_accounts:
            c_user, u_created = User.objects.get_or_create(
                username=f'cli_{phone}',
                defaults={
                    'first_name': first_name,
                    'email': email,
                    'is_staff': False,
                },
            )
            if u_created:
                c_user.set_password('cliente123')
                c_user.save()
            client_obj = clients[phone]
            if client_obj.user_id != c_user.id:
                client_obj.user = c_user
                client_obj.save(update_fields=['user', 'updated_at'])

        # 6.1 Cupons Promocionais (Controle do Dono)
        today = timezone.localdate()
        coupons_data = [
            {
                'code': 'BEMVINDO15',
                'description': (
                    '15% de desconto exclusivo para o seu 1º agendamento'
                ),
                'discount_type': Coupon.DiscountType.PERCENTAGE,
                'discount_value': Decimal('15.00'),
                'min_order_amount': Decimal('0.00'),
                'valid_from': today - timedelta(days=1),
                'valid_until': today + timedelta(days=90),
                'max_uses': None,
                'only_first_visit': True,
                'is_active': True,
            },
            {
                'code': 'BARBA10',
                'description': (
                    'R$ 10,00 OFF em serviços ou combos a partir de R$ 60'
                ),
                'discount_type': Coupon.DiscountType.FIXED,
                'discount_value': Decimal('10.00'),
                'min_order_amount': Decimal('60.00'),
                'valid_from': today - timedelta(days=1),
                'valid_until': today + timedelta(days=60),
                'max_uses': 100,
                'only_first_visit': False,
                'is_active': True,
            },
            {
                'code': 'VIP20',
                'description': (
                    '20% OFF em pacotes completos acima de R$ 100'
                ),
                'discount_type': Coupon.DiscountType.PERCENTAGE,
                'discount_value': Decimal('20.00'),
                'min_order_amount': Decimal('100.00'),
                'valid_from': today - timedelta(days=1),
                'valid_until': today + timedelta(days=45),
                'max_uses': 50,
                'only_first_visit': False,
                'is_active': True,
            },
        ]
        for cp_data in coupons_data:
            code = cp_data.pop('code')
            Coupon.objects.update_or_create(code=code, defaults=cp_data)

        # 7. Agendamentos e Comanda Financeira de Demonstração
        target_date = timezone.localdate() + timedelta(days=1)
        while (
            target_date.isoweekday() == 7
            or ScheduleException.objects.filter(
                date=target_date,
                is_all_day=True,
            ).exists()
        ):
            target_date += timedelta(days=1)

        matheus = professionals['matheus-lobao']
        lucas = professionals['lucas-ferreira']
        combo = services['combo-vip-corte-barba-sobrancelha']
        degrade = services['corte-degrade-fade']
        pomada = products['POM-MATTE']

        # Agendamento 1: Concluído com Comanda Paga no Caixa
        app1, app1_created = Appointment.objects.get_or_create(
            professional=matheus,
            date=target_date,
            start_time=time(10, 0),
            defaults={
                'client': clients['11988001122'],
                'end_time': time(11, 0),
                'status': Appointment.Status.CONFIRMED,
                'total_duration_minutes': combo.duration_minutes,
                'subtotal_price': combo.effective_price,
                'discount_amount': Decimal('0.00'),
                'total_price': combo.effective_price,
                'client_notes': 'Deixar a barba mais quadrada.',
            },
        )
        if app1_created:
            AppointmentItem.objects.create(
                appointment=app1,
                service=combo,
                price=combo.effective_price,
                duration_minutes=combo.duration_minutes,
            )
            order = Order.create_from_appointment(app1)
            OrderItem.objects.create(
                order=order,
                item_type=OrderItem.ItemType.PRODUCT,
                product=pomada,
                quantity=1,
            )
            order.tip = Decimal('10.00')
            order.save(update_fields=['tip', 'updated_at'])
            order.close_order(payment_method=Order.PaymentMethod.PIX)

        # Agendamento 2: Confirmado na Agenda (Aberto para teste no painel)
        app2, app2_created = Appointment.objects.get_or_create(
            professional=lucas,
            date=target_date,
            start_time=time(14, 0),
            defaults={
                'client': clients['11988002233'],
                'end_time': time(14, 40),
                'status': Appointment.Status.CONFIRMED,
                'total_duration_minutes': degrade.duration_minutes,
                'subtotal_price': degrade.effective_price,
                'discount_amount': Decimal('0.00'),
                'total_price': degrade.effective_price,
            },
        )
        if app2_created:
            AppointmentItem.objects.create(
                appointment=app2,
                service=degrade,
                price=degrade.effective_price,
                duration_minutes=degrade.duration_minutes,
            )

        self.stdout.write(
            self.style.SUCCESS(
                'Seed concluído com sucesso! '
                '(Admin: admin / admin123 | Barbeiros: matheus, lucas, '
                'rafael / barber123 | Cliente: 11988003344 / cliente123)'
            )
        )
