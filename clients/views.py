from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import F, Q
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Coupon, Service
from core.permissions import IsAuthenticatedClient, IsBarberShopStaff
from scheduling.models import Appointment
from scheduling.serializers import PublicAppointmentDetailSerializer
from .models import Client
from .serializers import (
    ClientLoginSerializer,
    ClientProfileSerializer,
    ClientRegisterSerializer,
    ClientSerializer,
)

CLIENTS_TAG = '4. Painel — Clientes (CRM)'
CLIENT_PORTAL_TAG = '2.1 Área do Cliente (Conta & Cupons)'


class ClientRegisterView(APIView):
    """Cria a conta online do cliente e retorna os tokens JWT."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=[CLIENT_PORTAL_TAG],
        summary='Criar conta do cliente (Cadastro Online)',
        description=(
            'Cria o login do cliente vinculado ao seu WhatsApp (reivindicando '
            'automaticamente a ficha de histórico caso já tenha sido atendido '
            'no balcão) e retorna os tokens JWT (`access` e `refresh`).'
        ),
        request=ClientRegisterSerializer,
        responses={201: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        serializer = ClientRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.save()
        return Response(payload, status=status.HTTP_201_CREATED)


class ClientLoginView(APIView):
    """Autentica um cliente cadastrado via WhatsApp ou e-mail."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=[CLIENT_PORTAL_TAG],
        summary='Entrar na conta do cliente (WhatsApp ou E-mail)',
        description=(
            'Autentica o cliente usando seu número de WhatsApp com DDD ou '
            'e-mail e senha, retornando os tokens JWT e os dados do perfil.'
        ),
        request=ClientLoginSerializer,
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        serializer = ClientLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class ClientMeView(APIView):
    """Consulta e atualização do perfil do próprio cliente logado."""

    permission_classes = [IsAuthenticatedClient]

    @extend_schema(
        tags=[CLIENT_PORTAL_TAG],
        summary='Obter perfil do cliente logado',
        responses={200: ClientProfileSerializer},
    )
    def get(self, request):
        client = request.user.client_profile
        return Response(ClientProfileSerializer(client).data)

    @extend_schema(
        tags=[CLIENT_PORTAL_TAG],
        summary='Atualizar dados cadastrais do cliente logado',
        request=ClientProfileSerializer,
        responses={200: ClientProfileSerializer},
    )
    def patch(self, request):
        client = request.user.client_profile
        serializer = ClientProfileSerializer(
            client,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@extend_schema(
    tags=[CLIENT_PORTAL_TAG],
    summary='Listar histórico de agendamentos do cliente logado',
    description=(
        'Retorna todos os agendamentos futuros e passados do cliente '
        'autenticado, incluindo o `cancel_token` e descontos aplicados.'
    ),
)
class ClientAppointmentsView(generics.ListAPIView):
    """Histórico e próximos horários do cliente autenticado."""

    permission_classes = [IsAuthenticatedClient]
    serializer_class = PublicAppointmentDetailSerializer

    def get_queryset(self):
        client = self.request.user.client_profile
        return (
            Appointment.objects.filter(client=client)
            .select_related('client', 'professional', 'coupon')
            .prefetch_related('items__service')
            .order_by('-date', '-start_time')
        )


class ClientAvailableCouponsView(APIView):
    """Lista os cupons promocionais elegíveis para o cliente logado."""

    permission_classes = [IsAuthenticatedClient]

    @extend_schema(
        tags=[CLIENT_PORTAL_TAG],
        summary='Listar cupons disponíveis para o cliente',
        description=(
            'Retorna os cupons ativos e dentro do prazo de validade que o '
            'cliente pode utilizar no momento (ocultando cupons exclusivos '
            'de primeira visita caso o cliente já possua visitas concluídas).'
        ),
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        client = request.user.client_profile
        today = timezone.localdate()

        qs = Coupon.objects.filter(is_active=True).filter(
            Q(valid_from__isnull=True) | Q(valid_from__lte=today),
            Q(valid_until__isnull=True) | Q(valid_until__gte=today),
            Q(max_uses__isnull=True) | Q(used_count__lt=F('max_uses')),
        )
        if client.total_visits > 0:
            qs = qs.filter(only_first_visit=False)

        data = [
            {
                'id': str(c.id),
                'code': c.code,
                'description': c.description,
                'discount_type': c.discount_type,
                'discount_value': str(c.discount_value),
                'min_order_amount': str(c.min_order_amount),
                'valid_until': c.valid_until,
                'only_first_visit': c.only_first_visit,
            }
            for c in qs
        ]
        return Response(data)


class ClientValidateCouponView(APIView):
    """Simula e valida um código de cupom antes de confirmar a reserva."""

    permission_classes = [IsAuthenticatedClient]

    @extend_schema(
        tags=[CLIENT_PORTAL_TAG],
        summary='Validar cupom de desconto no agendamento',
        request=inline_serializer(
            name='ValidateCouponRequest',
            fields={
                'code': serializers.CharField(),
                'service_ids': serializers.ListField(
                    child=serializers.UUIDField(),
                    required=False,
                ),
                'subtotal': serializers.DecimalField(
                    max_digits=10,
                    decimal_places=2,
                    required=False,
                ),
            },
        ),
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        client = request.user.client_profile
        raw_code = (request.data.get('code') or '').strip().upper()
        raw_code = raw_code.replace(' ', '')
        if not raw_code:
            return Response(
                {'detail': 'Informe o código do cupom.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service_ids = request.data.get('service_ids') or []
        if service_ids:
            services = Service.objects.filter(
                id__in=service_ids,
                is_active=True,
            )
            subtotal = sum(
                (s.effective_price for s in services),
                Decimal('0.00'),
            )
        else:
            try:
                subtotal = Decimal(str(request.data.get('subtotal', '0.00')))
            except Exception:
                subtotal = Decimal('0.00')

        coupon = Coupon.objects.filter(code__iexact=raw_code).first()
        if not coupon:
            return Response(
                {'detail': f'O cupom "{raw_code}" não foi encontrado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            discount_amount = coupon.calculate_discount(
                subtotal=subtotal,
                client=client,
            )
        except DjangoValidationError as exc:
            return Response(
                {'detail': exc.messages[0]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        final_total = max(Decimal('0.00'), subtotal - discount_amount)
        return Response({
            'code': coupon.code,
            'description': coupon.description,
            'discount_type': coupon.discount_type,
            'discount_value': str(coupon.discount_value),
            'subtotal': str(subtotal.quantize(Decimal('0.01'))),
            'discount_amount': str(discount_amount),
            'final_total': str(final_total.quantize(Decimal('0.01'))),
        })


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
