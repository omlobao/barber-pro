from datetime import datetime
import uuid

from django.db import transaction
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

from catalog.models import Service
from core.permissions import IsAuthenticatedClient, IsBarberShopStaff
from financial.models import Order
from financial.serializers import OrderSerializer
from professionals.models import Professional
from .models import Appointment
from .serializers import (
    AdminAppointmentSerializer,
    PublicAppointmentDetailSerializer,
    PublicBookingCreateSerializer,
)
from .services import get_available_slots

PUBLIC_TAG = '2. Vitrine & Agendamento Público'
SCHEDULING_TAG = '6. Painel — Agenda & Atendimentos'


class PublicAvailabilityView(APIView):
    """Consulta pública de slots disponíveis por data e serviços."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=[PUBLIC_TAG],
        summary='Consultar horários livres para agendamento',
        description=(
            'Calcula a duração total dos serviços selecionados e retorna os '
            'horários livres (`HH:MM`) de cada barbeiro habilitado na data '
            'escolhida, já descontando pausas de almoço, bloqueios, feriados, '
            'tempo de limpeza da bancada (`buffer_time_minutes`) e '
            'agendamentos existentes.'
        ),
        parameters=[
            OpenApiParameter(
                name='date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Data desejada no formato YYYY-MM-DD.',
            ),
            OpenApiParameter(
                name='service_ids',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=True,
                description=(
                    'UUIDs dos serviços escolhidos separados por vírgula '
                    '(ex.: uuid1,uuid2).'
                ),
            ),
            OpenApiParameter(
                name='professional_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description=(
                    'Opcional: filtra a disponibilidade de um barbeiro '
                    'específico.'
                ),
            ),
        ],
        responses={
            200: inline_serializer(
                name='PublicAvailabilityResponse',
                fields={
                    'date': serializers.DateField(),
                    'total_duration_minutes': serializers.IntegerField(),
                    'availability': serializers.ListField(
                        child=inline_serializer(
                            name='ProfessionalSlotItem',
                            fields={
                                'professional_id': serializers.UUIDField(),
                                'professional_name': serializers.CharField(),
                                'slots': serializers.ListField(
                                    child=serializers.CharField()
                                ),
                            },
                        )
                    ),
                },
            )
        },
    )
    def get(self, request):
        date_str = request.query_params.get('date')
        service_ids_raw = request.query_params.get('service_ids', '')
        professional_id = request.query_params.get('professional_id')

        if not date_str or not service_ids_raw:
            return Response(
                {
                    'detail': (
                        'Os parâmetros date e service_ids são obrigatórios.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'detail': 'Formato de data inválido. Use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_ids = [
            s.strip() for s in service_ids_raw.split(',') if s.strip()
        ]
        try:
            service_ids = [uuid.UUID(s) for s in raw_ids]
            if professional_id:
                professional_uuid = uuid.UUID(professional_id)
            else:
                professional_uuid = None
        except ValueError:
            return Response(
                {'detail': 'Formato de UUID inválido nos parâmetros.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        services = list(
            Service.objects.filter(id__in=service_ids, is_active=True)
        )
        if not services:
            return Response(
                {'detail': 'Nenhum serviço válido informado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_duration = sum(s.duration_minutes for s in services)

        professionals_qs = Professional.objects.filter(is_active=True)
        if professional_uuid:
            professionals_qs = professionals_qs.filter(id=professional_uuid)
        else:
            for s_id in service_ids:
                professionals_qs = professionals_qs.filter(services__id=s_id)

        results = []
        for prof in professionals_qs.distinct():
            slots = get_available_slots(prof, target_date, total_duration)
            results.append({
                'professional_id': str(prof.id),
                'professional_name': prof.display_name,
                'slots': slots,
            })

        return Response({
            'date': date_str,
            'total_duration_minutes': total_duration,
            'availability': results,
        })


@extend_schema(
    tags=[PUBLIC_TAG],
    summary='Realizar agendamento online (Cliente Autenticado)',
    description=(
        'Cria um novo agendamento para o cliente logado de forma atômica com '
        'lock pessimista (`SELECT FOR UPDATE`), aplicando cupom promocional '
        'quando informado e retornando o `cancel_token`.'
    ),
    request=PublicBookingCreateSerializer,
    responses={201: PublicAppointmentDetailSerializer},
)
class PublicBookingCreateView(generics.CreateAPIView):
    """Criação de agendamento online pelo cliente autenticado."""

    permission_classes = [IsAuthenticatedClient]
    serializer_class = PublicBookingCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = serializer.save()
        output = PublicAppointmentDetailSerializer(appointment).data
        return Response(output, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=[PUBLIC_TAG],
    summary='Consultar agendamento via token do cliente',
    description=(
        'Retorna o resumo público do agendamento a partir do `cancel_token` '
        'enviado ao cliente (sem expor notas internas da barbearia).'
    ),
)
class PublicAppointmentManageView(generics.RetrieveAPIView):
    """Consulta pública do agendamento pelo cancel_token."""

    permission_classes = [AllowAny]
    queryset = (
        Appointment.objects.select_related('client', 'professional', 'coupon')
        .prefetch_related('items__service')
    )
    serializer_class = PublicAppointmentDetailSerializer
    lookup_field = 'cancel_token'


class PublicAppointmentCancelView(APIView):
    """Cancelamento público do agendamento pelo cliente via token."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=[PUBLIC_TAG],
        summary='Cancelar agendamento via token do cliente',
        description=(
            'Permite ao próprio cliente cancelar seu agendamento usando o '
            '`cancel_token`, desde que o status atual seja `PENDING` ou '
            '`CONFIRMED`. Libera o horário imediatamente na agenda.'
        ),
        request=None,
        responses={
            200: inline_serializer(
                name='CancelAppointmentResponse',
                fields={'detail': serializers.CharField()},
            )
        },
    )
    def post(self, request, cancel_token):
        try:
            appointment = Appointment.objects.get(cancel_token=cancel_token)
        except Appointment.DoesNotExist:
            return Response(
                {'detail': 'Agendamento não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        cancelable = [
            Appointment.Status.PENDING,
            Appointment.Status.CONFIRMED,
        ]
        if appointment.status not in cancelable:
            return Response(
                {'detail': 'Este agendamento não pode mais ser cancelado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        appointment.status = Appointment.Status.CANCELED
        appointment.save(update_fields=['status', 'updated_at'])
        return Response({'detail': 'Agendamento cancelado com sucesso.'})


@extend_schema_view(
    list=extend_schema(
        tags=[SCHEDULING_TAG],
        summary='Listar agendamentos do painel',
        description=(
            'Lista os agendamentos com filtro opcional por `?date=YYYY-MM-DD` '
            'e `?professional_id=UUID`. Barbeiros sem permissão de gerente '
            'visualizam apenas a própria agenda.'
        ),
        parameters=[
            OpenApiParameter(
                name='date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Filtra agendamentos de uma data (YYYY-MM-DD).',
            ),
            OpenApiParameter(
                name='professional_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description='Filtra agendamentos de um barbeiro específico.',
            ),
        ],
    ),
    retrieve=extend_schema(
        tags=[SCHEDULING_TAG],
        summary='Obter detalhes completos de um agendamento',
        description=(
            'Retorna todos os dados do agendamento, incluindo telefone do '
            'cliente, notas internas, serviços e `order_id` da comanda.'
        ),
    ),
    create=extend_schema(
        tags=[SCHEDULING_TAG],
        summary='Criar agendamento manualmente pelo painel',
        description=(
            'Registra um agendamento diretamente pelo painel administrativo, '
            'validando conflitos de horário do profissional.'
        ),
    ),
    update=extend_schema(
        tags=[SCHEDULING_TAG],
        summary='Atualizar agendamento completo (PUT)',
        description='Atualiza todos os campos de um agendamento.',
    ),
    partial_update=extend_schema(
        tags=[SCHEDULING_TAG],
        summary='Atualizar status, horário ou notas do agendamento (PATCH)',
        description=(
            'Atualiza parcialmente o agendamento. Caso o status mude para '
            '`NO_SHOW`, o contador de faltas do cliente é incrementado.'
        ),
    ),
    destroy=extend_schema(
        tags=[SCHEDULING_TAG],
        summary='Excluir agendamento',
        description='Remove um registro de agendamento do painel.',
    ),
)
class AdminAppointmentViewSet(viewsets.ModelViewSet):
    """CRUD administrativo da agenda de atendimentos."""

    queryset = (
        Appointment.objects.select_related('client', 'professional', 'coupon')
        .prefetch_related('items__service')
    )
    serializer_class = AdminAppointmentSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        date_param = self.request.query_params.get('date')
        prof_param = self.request.query_params.get('professional_id')

        if date_param:
            qs = qs.filter(date=date_param)
        if prof_param:
            qs = qs.filter(professional_id=prof_param)
        elif (
            not self.request.user.is_staff
            and hasattr(self.request.user, 'professional_profile')
        ):
            qs = qs.filter(
                professional=self.request.user.professional_profile
            )

        return qs

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        with transaction.atomic():
            appointment = serializer.save()
            if (
                old_status != Appointment.Status.NO_SHOW
                and appointment.status == Appointment.Status.NO_SHOW
            ):
                client = appointment.client
                client.no_show_count += 1
                client.save(update_fields=['no_show_count', 'updated_at'])

    @extend_schema(
        tags=[SCHEDULING_TAG],
        summary='Registrar falta do cliente (No-Show)',
        description=(
            'Altera o status do agendamento para `NO_SHOW` e incrementa '
            'automaticamente `client.no_show_count += 1` no histórico do '
            'cliente.'
        ),
        request=None,
        responses={200: AdminAppointmentSerializer},
    )
    @action(detail=True, methods=['post'], url_path='mark-no-show')
    def mark_no_show(self, request, pk=None):
        appointment = self.get_object()
        invalid_statuses = [
            Appointment.Status.COMPLETED,
            Appointment.Status.CANCELED,
            Appointment.Status.NO_SHOW,
        ]
        if appointment.status in invalid_statuses:
            return Response(
                {
                    'detail': (
                        'Não é possível registrar falta para um agendamento '
                        'já concluído, cancelado ou com falta registrada.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            appointment.status = Appointment.Status.NO_SHOW
            appointment.save(update_fields=['status', 'updated_at'])
            client = appointment.client
            client.no_show_count += 1
            client.save(update_fields=['no_show_count', 'updated_at'])

        return Response(
            AdminAppointmentSerializer(appointment).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=[SCHEDULING_TAG],
        summary='Abrir ou recuperar comanda financeira do agendamento',
        description=(
            'Gera automaticamente uma comanda (`Order`) no caixa importando '
            'todos os serviços e preços do agendamento (ou retorna a comanda '
            'já existente caso já tenha sido aberta).'
        ),
        request=None,
        responses={200: OrderSerializer},
    )
    @action(detail=True, methods=['post'], url_path='open-order')
    def open_order(self, request, pk=None):
        appointment = self.get_object()
        order = Order.create_from_appointment(appointment)
        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_200_OK,
        )
