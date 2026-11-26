from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CRMLeadViewSet,
    ReactivationTargetsView,
    WhatsAppCampaignViewSet,
    WhatsAppConversationViewSet,
    WhatsAppLogoutDeviceView,
    WhatsAppOverviewView,
    WhatsAppQRCodeView,
    WhatsAppQueueViewSet,
    WhatsAppSettingsView,
    WhatsAppSimulateView,
)

router = DefaultRouter()
router.register(
    r'conversations',
    WhatsAppConversationViewSet,
    basename='admin-whatsapp-conversations',
)
router.register(
    r'queue',
    WhatsAppQueueViewSet,
    basename='admin-whatsapp-queue',
)
router.register(
    r'leads',
    CRMLeadViewSet,
    basename='admin-whatsapp-leads',
)
router.register(
    r'campaigns',
    WhatsAppCampaignViewSet,
    basename='admin-whatsapp-campaigns',
)

urlpatterns = [
    path(
        'overview/',
        WhatsAppOverviewView.as_view(),
        name='whatsapp-overview',
    ),
    path(
        'reactivation-targets/',
        ReactivationTargetsView.as_view(),
        name='whatsapp-reactivation-targets',
    ),
    path(
        'settings/',
        WhatsAppSettingsView.as_view(),
        name='whatsapp-settings',
    ),
    path(
        'qrcode/',
        WhatsAppQRCodeView.as_view(),
        name='whatsapp-qrcode',
    ),
    path(
        'logout/',
        WhatsAppLogoutDeviceView.as_view(),
        name='whatsapp-logout',
    ),
    path(
        'simulate/',
        WhatsAppSimulateView.as_view(),
        name='whatsapp-simulate',
    ),
    path('', include(router.urls)),
]
