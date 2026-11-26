"""
Django settings for setup project.
"""

from datetime import timedelta
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-ej^h%qfi8w4ai)(d)4#go&y-$iceaw060wjp=^a1o&+6n3_v17',
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        'DJANGO_ALLOWED_HOSTS',
        'localhost,127.0.0.1,0.0.0.0',
    ).split(',')
    if h.strip()
]


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'drf_spectacular',
    'core',
    'professionals',
    'catalog',
    'clients',
    'scheduling',
    'financial',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'setup.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'setup.wsgi.application'


# Database

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# Password validation

_AUTH_VAL = 'django.contrib.auth.password_validation'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': f'{_AUTH_VAL}.UserAttributeSimilarityValidator'},
    {'NAME': f'{_AUTH_VAL}.MinimumLengthValidator'},
    {'NAME': f'{_AUTH_VAL}.CommonPasswordValidator'},
    {'NAME': f'{_AUTH_VAL}.NumericPasswordValidator'},
]


# Internationalization

LANGUAGE_CODE = 'pt-br'

TIME_ZONE = 'America/Sao_Paulo'

USE_I18N = True

USE_TZ = True


# Static & Media files

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


# CORS Configuration (React / Vite / Next.js / Mobile)

_DEFAULT_CORS = (
    'http://localhost:3000,'
    'http://127.0.0.1:3000,'
    'http://localhost:5173,'
    'http://127.0.0.1:5173'
)

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CORS_ALLOWED_ORIGINS', _DEFAULT_CORS).split(
        ','
    )
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True


# Django REST Framework & SimpleJWT

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'BarberPro API',
    'DESCRIPTION': (
        'Documentação técnica interativa da API RESTful do **BarberPro**.\n\n'
        '### Perfis de Acesso:\n'
        '* **Rotas Públicas (`/api/public/`)**: Abertas (`AllowAny`) para a '
        'vitrine da barbearia e agendamento online pelo cliente.\n'
        '* **Rotas do Painel (`/api/admin/`)**: Protegidas por token JWT '
        '(`Bearer <access_token>`). Acessíveis por administradores '
        '(`is_staff`) e barbeiros ativos.'
    ),
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SERVE_PERMISSIONS': ['rest_framework.permissions.IsAdminUser'],
    'SERVE_AUTHENTICATION': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'COMPONENT_SPLIT_REQUEST': True,
    'TAGS': [
        {
            'name': '1. Autenticação & Sessão',
            'description': (
                'Emissão e renovação de tokens JWT e identificação do '
                'usuário/barbeiro logado.'
            ),
        },
        {
            'name': '2. Vitrine & Agendamento Público',
            'description': (
                'Endpoints públicos consumidos pelo cliente final para '
                'consultar serviços, barbeiros, horários livres, agendar e '
                'cancelar via token.'
            ),
        },
        {
            'name': '2.1 Área do Cliente (Conta & Cupons)',
            'description': (
                'Cadastro e login do cliente final, perfil, histórico de '
                'agendamentos e validação de cupons promocionais.'
            ),
        },
        {
            'name': '3. Painel — Catálogo (Serviços e Produtos)',
            'description': (
                'Gestão interna do catálogo de cortes/serviços, preços '
                'promocionais e estoque de produtos.'
            ),
        },
        {
            'name': '4. Painel — Clientes (CRM)',
            'description': (
                'Cadastro de clientes, busca por WhatsApp, histórico de '
                'visitas/faltas e bloqueio preventivo.'
            ),
        },
        {
            'name': '5. Painel — Profissionais & Expediente',
            'description': (
                'Gestão de barbeiros, comissões, grade semanal de trabalho '
                'e exceções/feriados.'
            ),
        },
        {
            'name': '6. Painel — Agenda & Atendimentos',
            'description': (
                'Gerenciamento da agenda diária, abertura de comanda a '
                'partir do agendamento e registro de faltas (no-show).'
            ),
        },
        {
            'name': '7. Painel — Financeiro, Comandas (PDV) & Caixa',
            'description': (
                'Operação de caixa: comandas, adição/remoção de itens, '
                'fechamento com baixa de estoque, repasse de comissões e '
                'resumo financeiro.'
            ),
        },
    ],
    'ENUM_NAME_OVERRIDES': {
        'AppointmentStatusEnum': 'scheduling.models.Appointment.Status',
        'OrderStatusEnum': 'financial.models.Order.Status',
        'ComissionStatusEnum': 'financial.models.ComissionRecord.Status',
    },
}
