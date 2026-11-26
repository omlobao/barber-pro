from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Client


class ClientModelAndAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin_clients',
            password='password123',
            is_staff=True,
        )
        self.client_obj = Client.objects.create(
            name='Marcos Oliveira',
            phone_number='(11) 98765-4321',
            email='marcos@example.com',
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_phone_number_is_sanitized_on_save(self):
        self.assertEqual(self.client_obj.phone_number, '11987654321')

    def test_invalid_phone_number_raises_validation_error(self):
        invalid_client = Client(
            name='Telefone Curto',
            phone_number='12345',
        )
        with self.assertRaises(ValidationError):
            invalid_client.save()

    def test_create_client_via_api_and_reject_duplicate_phone(self):
        url = reverse('admin-clients-list')
        resp = self.api.post(
            url,
            {
                'name': 'Rafael Souza',
                'phone_number': '(21) 99888-7766',
                'email': 'rafael@example.com',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['phone_number'], '21998887766')

        # Tentar cadastrar mesmo telefone formatado deve retornar 400
        dup_resp = self.api.post(
            url,
            {
                'name': 'Outro Nome',
                'phone_number': '(11) 98765-4321',
            },
            format='json',
        )
        self.assertEqual(dup_resp.status_code, 400)
        self.assertIn('phone_number', dup_resp.data)

    def test_search_filter_and_toggle_block_action(self):
        list_url = reverse('admin-clients-list')
        search_resp = self.api.get(list_url, {'search': '98765'})
        self.assertEqual(search_resp.status_code, 200)
        self.assertEqual(len(search_resp.data), 1)

        # Alterna bloqueio (toggle-block)
        toggle_url = reverse(
            'admin-clients-toggle-block',
            args=[self.client_obj.id],
        )
        toggle_resp = self.api.post(toggle_url)
        self.assertEqual(toggle_resp.status_code, 200)
        self.assertTrue(toggle_resp.data['is_blocked'])

        blocked_resp = self.api.get(list_url, {'is_blocked': 'true'})
        self.assertEqual(len(blocked_resp.data), 1)

    def test_client_register_claims_walkin_and_isolates_admin_routes(self):
        self.client_obj.total_visits = 4
        self.client_obj.save(update_fields=['total_visits'])

        public_api = APIClient()
        reg_url = reverse('client-register')
        reg_resp = public_api.post(
            reg_url,
            {
                'name': 'Marcos Oliveira',
                'phone_number': '(11) 98765-4321',
                'email': 'marcos@example.com',
                'password': 'senhaSegura123',
            },
            format='json',
        )
        self.assertEqual(reg_resp.status_code, 201)
        self.assertEqual(reg_resp.data['client']['total_visits'], 4)

        # Impede segundo cadastro com o mesmo WhatsApp
        dup_reg = public_api.post(
            reg_url,
            {
                'name': 'Marcos Duplicado',
                'phone_number': '11987654321',
                'password': 'senhaSegura123',
            },
            format='json',
        )
        self.assertEqual(dup_reg.status_code, 400)

        # Login por WhatsApp e por e-mail
        login_url = reverse('client-login')
        for identifier in ('(11) 98765-4321', 'marcos@example.com'):
            login_resp = public_api.post(
                login_url,
                {'identifier': identifier, 'password': 'senhaSegura123'},
                format='json',
            )
            self.assertEqual(login_resp.status_code, 200)
            self.assertIn('access', login_resp.data)

        # Cliente logado não pode acessar endpoints restritos (/api/admin)
        token = reg_resp.data['access']
        public_api.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        me_resp = public_api.get(reverse('client-me'))
        self.assertEqual(me_resp.status_code, 200)

        admin_resp = public_api.get(reverse('admin-clients-list'))
        self.assertEqual(admin_resp.status_code, 403)
