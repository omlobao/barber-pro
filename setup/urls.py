from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter

from catalog.views import (
    AdminProductViewSet,
    AdminServiceViewSet,
    PublicServiceViewSet,
)
from clients.views import AdminClientViewSet
from core.views import AuthLoginView, AuthRefreshView, CurrentUserView
from financial.views import (
    AdminCashFlowViewSet,
    AdminCommissionViewSet,
    AdminOrderViewSet,
)
from professionals.views import (
    AdminProfessionalViewSet,
    AdminScheduleExceptionViewSet,
    PublicProfessionalViewSet,
)
from scheduling.views import (
    AdminAppointmentViewSet,
    PublicAppointmentCancelView,
    PublicAppointmentManageView,
    PublicAvailabilityView,
    PublicBookingCreateView,
)

# Rotas Públicas (Landing Page + Wizard de Agendamento)
public_router = DefaultRouter()
public_router.register(
    r'services',
    PublicServiceViewSet,
    basename='public-services',
)
public_router.register(
    r'professionals',
    PublicProfessionalViewSet,
    basename='public-professionals',
)

# Rotas Privadas (Painel do Barbeiro e Administrador)
admin_router = DefaultRouter()
admin_router.register(
    r'services',
    AdminServiceViewSet,
    basename='admin-services',
)
admin_router.register(
    r'products',
    AdminProductViewSet,
    basename='admin-products',
)
admin_router.register(
    r'clients',
    AdminClientViewSet,
    basename='admin-clients',
)
admin_router.register(
    r'professionals',
    AdminProfessionalViewSet,
    basename='admin-professionals',
)
admin_router.register(
    r'schedule-exceptions',
    AdminScheduleExceptionViewSet,
    basename='admin-exceptions',
)
admin_router.register(
    r'appointments',
    AdminAppointmentViewSet,
    basename='admin-appointments',
)
admin_router.register(
    r'orders',
    AdminOrderViewSet,
    basename='admin-orders',
)
admin_router.register(
    r'commissions',
    AdminCommissionViewSet,
    basename='admin-commissions',
)
admin_router.register(
    r'cashflow',
    AdminCashFlowViewSet,
    basename='admin-cashflow',
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Documentação OpenAPI 3 / Swagger UI / Redoc
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(url_name='schema'),
        name='swagger-ui',
    ),
    path(
        'api/redoc/',
        SpectacularRedocView.as_view(url_name='schema'),
        name='redoc',
    ),

    # Autenticação JWT
    path(
        'api/auth/login/',
        AuthLoginView.as_view(),
        name='auth-login',
    ),
    path(
        'api/auth/refresh/',
        AuthRefreshView.as_view(),
        name='auth-refresh',
    ),
    path(
        'api/auth/me/',
        CurrentUserView.as_view(),
        name='auth-me',
    ),

    # API Pública
    path('api/public/', include(public_router.urls)),
    path(
        'api/public/availability/',
        PublicAvailabilityView.as_view(),
        name='public-availability',
    ),
    path(
        'api/public/bookings/',
        PublicBookingCreateView.as_view(),
        name='public-booking-create',
    ),
    path(
        'api/public/bookings/<uuid:cancel_token>/',
        PublicAppointmentManageView.as_view(),
        name='public-booking-detail',
    ),
    path(
        'api/public/bookings/<uuid:cancel_token>/cancel/',
        PublicAppointmentCancelView.as_view(),
        name='public-booking-cancel',
    ),

    # API Painel
    path('api/admin/', include(admin_router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
