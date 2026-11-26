from decimal import Decimal
import io

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from clients.models import Client
from .models import Coupon, Product, Service


class CatalogModelAndAPITests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_cat',
            password='password123',
            is_staff=True,
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.admin)

    def test_service_slug_generation_and_effective_price(self):
        s1 = Service.objects.create(
            name='Corte Social',
            price=Decimal('45.00'),
            promotion_price=Decimal('35.00'),
            duration_minutes=30,
        )
        s2 = Service.objects.create(
            name='Corte Social',
            price=Decimal('45.00'),
            duration_minutes=30,
        )
        self.assertEqual(s1.slug, 'corte-social')
        self.assertEqual(s2.slug, 'corte-social-1')
        self.assertEqual(s1.effective_price, Decimal('35.00'))
        self.assertEqual(s2.effective_price, Decimal('45.00'))

    def test_invalid_promotion_price_raises_validation_error(self):
        with self.assertRaises(ValidationError):
            Service.objects.create(
                name='Barba',
                price=Decimal('30.00'),
                promotion_price=Decimal('35.00'),
                duration_minutes=20,
            )

    def test_product_sku_and_low_stock_filter_api(self):
        p_low = Product.objects.create(
            name='Shampoo Mentolado',
            sale_price=Decimal('35.00'),
            stock_quantity=1,
            min_stock_alert=2,
        )
        Product.objects.create(
            name='Óleo para Barba',
            sale_price=Decimal('30.00'),
            stock_quantity=10,
            min_stock_alert=2,
        )
        self.assertTrue(bool(p_low.sku))

        url = reverse('admin-products-list')
        resp = self.api.get(url, {'is_low_stock': 'true'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['id'], str(p_low.id))
        self.assertTrue(resp.data[0]['is_low_stock'])

    def test_admin_coupon_crud_and_first_visit_rule(self):
        url = reverse('admin-coupons-list')
        resp = self.api.post(
            url,
            {
                'code': 'vip 15',
                'description': '15% na primeira visita',
                'discount_type': Coupon.DiscountType.PERCENTAGE,
                'discount_value': '15.00',
                'min_order_amount': '40.00',
                'only_first_visit': True,
                'is_active': True,
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['code'], 'VIP15')

        coupon = Coupon.objects.get(code='VIP15')
        new_client = Client.objects.create(
            name='Cliente Novo',
            phone_number='11912345678',
            total_visits=0,
        )
        self.assertEqual(
            coupon.calculate_discount(Decimal('100.00'), client=new_client),
            Decimal('15.00'),
        )

        returning_client = Client.objects.create(
            name='Cliente Antigo',
            phone_number='11987651234',
            total_visits=2,
        )
        with self.assertRaises(ValidationError):
            coupon.calculate_discount(
                Decimal('100.00'),
                client=returning_client,
            )

    def test_admin_service_and_product_update_via_api(self):
        srv = Service.objects.create(
            name='Corte Teste',
            price=Decimal('50.00'),
            duration_minutes=30,
        )
        srv_url = reverse('admin-services-detail', args=[srv.id])
        patch_resp = self.api.patch(
            srv_url,
            {'price': '60.00', 'promotion_price': '49.90'},
            format='json',
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.data['effective_price'], '49.90')

        prod = Product.objects.create(
            name='Pomada Teste',
            cost_price=Decimal('15.00'),
            sale_price=Decimal('40.00'),
            stock_quantity=5,
        )
        prod_url = reverse('admin-products-detail', args=[prod.id])
        prod_resp = self.api.patch(
            prod_url,
            {'sale_price': '45.00', 'is_active': False},
            format='json',
        )
        self.assertEqual(prod_resp.status_code, 200)
        self.assertFalse(prod_resp.data['is_active'])

    def test_service_multipart_image_upload_and_removal(self):
        buf = io.BytesIO()
        img = Image.new('RGB', (60, 60), color=(217, 119, 6))
        img.save(buf, format='JPEG')
        uploaded = SimpleUploadedFile(
            'corte.jpg',
            buf.getvalue(),
            content_type='image/jpeg',
        )

        create_resp = self.api.post(
            reverse('admin-services-list'),
            {
                'name': 'Corte com Foto',
                'category': 'HAIR',
                'price': '70.00',
                'promotion_price': '',
                'duration_minutes': '45',
                'image': uploaded,
            },
            format='multipart',
        )
        self.assertEqual(create_resp.status_code, 201)
        self.assertTrue(bool(create_resp.data['image']))
        srv_id = create_resp.data['id']

        # Remove a foto enviada
        clear_resp = self.api.patch(
            reverse('admin-services-detail', args=[srv_id]),
            {'remove_image': 'true'},
            format='multipart',
        )
        self.assertEqual(clear_resp.status_code, 200)
        self.assertIsNone(clear_resp.data['image'])
