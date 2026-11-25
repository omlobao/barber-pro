from django.db import models
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from core.permissions import IsBarberShopStaff, IsOwnerOrReadOnly
from .models import Product, Service
from .serializers import ProductSerializer, ServiceSerializer


class PublicServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Vitrine de serviços para landing page."""

    queryset = Service.objects.filter(is_active=True)
    serializer_class = ServiceSerializer
    permission_classes = [AllowAny]


class AdminServiceViewSet(viewsets.ModelViewSet):
    """CRUD de serviços para o painel administrativo."""

    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [IsBarberShopStaff, IsOwnerOrReadOnly]


class AdminProductViewSet(viewsets.ModelViewSet):
    """CRUD de produtos para o painel administrativo."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('is_low_stock') == 'true':
            qs = qs.filter(stock_quantity__lte=models.F('min_stock_alert'))
        return qs
