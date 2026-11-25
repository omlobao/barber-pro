from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from professionals.models import Professional


class AuthAndPermissionsTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='owner',
            password='password123',
            is_staff=True,
        )
        self.barber_user = User.objects.create_user(
            username='active_barber',
            password='password123',
            is_staff=False,
        )
        self.professional = Professional.objects.create(
            user=self.barber_user,
            display_name='Barbeiro Ativo',
            slug='barbeiro-ativo',
            phone_number='11966660001',
            is_active=True,
        )
        self.api = APIClient()

    def test_jwt_login_and_me_endpoint_for_barber(self):
        login_url = reverse('auth-login')
        login_resp = self.api.post(
            login_url,
            {'username': 'active_barber', 'password': 'password123'},
            format='json',
        )
        self.assertEqual(login_resp.status_code, 200)
        access_token = login_resp.data['access']

        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_url = reverse('auth-me')
        me_resp = self.api.get(me_url)
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.data['role'], 'PROFESSIONAL')
        self.assertEqual(
            me_resp.data['professional']['id'],
            str(self.professional.id),
        )

        # Desativar o profissional deve bloquear o acesso ao painel (403)
        self.professional.is_active = False
        self.professional.save(update_fields=['is_active'])
        forbidden_resp = self.api.get(me_url)
        self.assertEqual(forbidden_resp.status_code, 403)

    def test_api_docs_restricted_to_admin_only(self):
        docs_url = reverse('swagger-ui')
        schema_url = reverse('schema')

        # 1. Visitante anônimo deve ser bloqueado (403)
        anon_resp = self.api.get(docs_url)
        self.assertIn(anon_resp.status_code, (401, 403))

        # 2. Barbeiro comum (não-staff) deve ser bloqueado (403)
        self.api.force_authenticate(user=self.barber_user)
        barber_resp = self.api.get(docs_url)
        self.assertEqual(barber_resp.status_code, 403)

        # 3. Administrador (is_staff=True) tem acesso liberado (200)
        self.api.force_authenticate(user=self.admin)
        admin_docs = self.api.get(docs_url)
        admin_schema = self.api.get(schema_url)
        self.assertEqual(admin_docs.status_code, 200)
        self.assertEqual(admin_schema.status_code, 200)
