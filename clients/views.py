from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsBarberShopStaff
from .models import Client
from .serializers import ClientSerializer

CLIENTS_TAG = '4. Painel — Clientes (CRM)'


@extend_schema_view(
    list=extend_schema(
        tags=[CLIENTS_TAG],
        summary='Listar e buscar clientes',
        description=(
            'Retorna a lista de clientes ordenada por nome. Permite buscar '
            'por nome, telefone ou e-mail via `?search=` e filtrar clientes '
            'bloqueados via `?is_blocked=true` ou `false`.'
        ),
        parameters=[
            OpenApiParameter(
                name='search',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Busca parcial por nome, telefone ou e-mail.',
            ),
            OpenApiParameter(
                name='is_blocked',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description='Filtra clientes bloqueados (true ou false).',
            ),
        ],
    ),
    retrieve=extend_schema(
        tags=[CLIENTS_TAG],
        summary='Consultar ficha de um cliente',
        description=(
            'Retorna os dados cadastrais, total de visitas (`total_visits`), '
            'faltas sem aviso (`no_show_count`) e status de bloqueio.'
        ),
    ),
    create=extend_schema(
        tags=[CLIENTS_TAG],
        summary='Cadastrar novo cliente manualmente',
        description=(
            'Cadastra um cliente pelo painel. O telefone é sanitizado para '
            'apenas dígitos e validado quanto ao DDD (10 a 13 dígitos) e '
            'unicidade.'
        ),
    ),
    update=extend_schema(
        tags=[CLIENTS_TAG],
        summary='Atualizar dados do cliente (PUT)',
        description='Substitui os dados cadastrais de um cliente.',
    ),
    partial_update=extend_schema(
        tags=[CLIENTS_TAG],
        summary='Atualizar cliente parcialmente (PATCH)',
        description=(
            'Atualiza campos específicos do cliente (ex.: observações, '
            'telefone ou data de nascimento).'
        ),
    ),
    destroy=extend_schema(
        tags=[CLIENTS_TAG],
        summary='Remover cliente',
        description=(
            'Exclui o cadastro de um cliente (bloqueado caso já possua '
            'agendamentos ou comandas registradas).'
        ),
    ),
)
class AdminClientViewSet(viewsets.ModelViewSet):
    """CRUD completo de clientes para o painel administrativo."""

    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        is_blocked = self.request.query_params.get('is_blocked')

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(phone_number__icontains=search)
                | Q(email__icontains=search)
            )

        if is_blocked in ('true', 'false'):
            qs = qs.filter(is_blocked=(is_blocked == 'true'))

        return qs

    @extend_schema(
        tags=[CLIENTS_TAG],
        summary='Bloquear / Desbloquear cliente para agendamento online',
        description=(
            'Inverte o status `is_blocked` do cliente. Clientes bloqueados '
            'são impedidos de realizar novos agendamentos públicos online.'
        ),
        request=None,
        responses={200: ClientSerializer},
    )
    @action(detail=True, methods=['post'], url_path='toggle-block')
    def toggle_block(self, request, pk=None):
        client = self.get_object()
        client.is_blocked = not client.is_blocked
        client.save(update_fields=['is_blocked', 'updated_at'])
        return Response(
            ClientSerializer(client).data,
            status=status.HTTP_200_OK,
        )
