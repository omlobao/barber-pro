from django.db import models
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from core.permissions import IsBarberShopStaff, IsOwnerOrReadOnly
from .models import Product, Service
from .serializers import ProductSerializer, ServiceSerializer

PUBLIC_TAG = '2. Vitrine & Agendamento Público'
CATALOG_TAG = '3. Painel — Catálogo (Serviços e Produtos)'


@extend_schema_view(
    list=extend_schema(
        tags=[PUBLIC_TAG],
        summary='Listar serviços ativos na vitrine pública',
        description=(
            'Retorna todos os serviços ativos (`is_active=True`) ordenados '
            'por `display_order` e nome, incluindo o `effective_price` '
            '(preço promocional quando ativo ou preço padrão).'
        ),
    ),
    retrieve=extend_schema(
        tags=[PUBLIC_TAG],
        summary='Consultar detalhes de um serviço público',
        description=(
            'Retorna os dados detalhados de um serviço ativo pelo seu UUID.'
        ),
    ),
)
class PublicServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Vitrine pública de serviços da barbearia."""

    queryset = Service.objects.filter(is_active=True)
    serializer_class = ServiceSerializer
    permission_classes = [AllowAny]


@extend_schema_view(
    list=extend_schema(
        tags=[CATALOG_TAG],
        summary='Listar todos os serviços (ativos e inativos)',
        description=(
            'Retorna o catálogo completo de serviços da barbearia para o '
            'painel administrativo.'
        ),
    ),
    retrieve=extend_schema(
        tags=[CATALOG_TAG],
        summary='Obter detalhes de um serviço no painel',
        description='Consulta um serviço específico pelo seu UUID.',
    ),
    create=extend_schema(
        tags=[CATALOG_TAG],
        summary='Cadastrar novo serviço',
        description=(
            'Cria um novo serviço no catálogo (restrito a administradores '
            '`is_staff`). Gera o `slug` automaticamente caso não informado.'
        ),
    ),
    update=extend_schema(
        tags=[CATALOG_TAG],
        summary='Atualizar serviço completo (PUT)',
        description='Substitui todos os dados de um serviço existente.',
    ),
    partial_update=extend_schema(
        tags=[CATALOG_TAG],
        summary='Atualizar serviço parcialmente (PATCH)',
        description=(
            'Atualiza campos específicos de um serviço (ex.: ativar promoção '
            'ou alterar preço).'
        ),
    ),
    destroy=extend_schema(
        tags=[CATALOG_TAG],
        summary='Remover serviço',
        description=(
            'Exclui um serviço do catálogo (bloqueado por `PROTECT` caso já '
            'possua agendamentos ou comandas vinculadas).'
        ),
    ),
)
class AdminServiceViewSet(viewsets.ModelViewSet):
    """CRUD administrativo de serviços."""

    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [IsBarberShopStaff, IsOwnerOrReadOnly]


@extend_schema_view(
    list=extend_schema(
        tags=[CATALOG_TAG],
        summary='Listar produtos e estoque',
        description=(
            'Retorna os produtos cadastrados com indicador `is_low_stock`. '
            'Use `?is_low_stock=true` para filtrar apenas produtos com '
            'estoque igual ou abaixo do alerta mínimo.'
        ),
        parameters=[
            OpenApiParameter(
                name='is_low_stock',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description=(
                    'Filtra apenas produtos com estoque baixo '
                    '(stock_quantity <= min_stock_alert).'
                ),
            ),
        ],
    ),
    retrieve=extend_schema(
        tags=[CATALOG_TAG],
        summary='Obter detalhes de um produto',
        description='Retorna os dados e estoque atual de um produto.',
    ),
    create=extend_schema(
        tags=[CATALOG_TAG],
        summary='Cadastrar novo produto',
        description=(
            'Cadastra um produto para venda ou insumo. Caso o `sku` não seja '
            'informado, um código único de 8 caracteres é gerado.'
        ),
    ),
    update=extend_schema(
        tags=[CATALOG_TAG],
        summary='Atualizar produto completo (PUT)',
        description='Atualiza todos os campos de um produto.',
    ),
    partial_update=extend_schema(
        tags=[CATALOG_TAG],
        summary='Atualizar estoque ou preço do produto (PATCH)',
        description=(
            'Atualiza parcialmente um produto (ex.: reposição de '
            '`stock_quantity` ou ajuste de `sale_price`).'
        ),
    ),
    destroy=extend_schema(
        tags=[CATALOG_TAG],
        summary='Remover produto',
        description='Remove um produto sem histórico de vendas vinculado.',
    ),
)
class AdminProductViewSet(viewsets.ModelViewSet):
    """CRUD administrativo de produtos."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('is_low_stock') == 'true':
            qs = qs.filter(stock_quantity__lte=models.F('min_stock_alert'))
        return qs
