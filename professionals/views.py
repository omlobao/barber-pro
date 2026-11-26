from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.permissions import IsBarberShopStaff, IsOwnerOrReadOnly
from .models import Professional, ScheduleException, WorkingHours
from .serializers import (
    AdminProfessionalSerializer,
    PublicProfessionalSerializer,
    ScheduleExceptionSerializer,
    WorkingHoursSerializer,
)

PUBLIC_TAG = '2. Vitrine & Agendamento Público'
PROFESSIONALS_TAG = '5. Painel — Profissionais & Expediente'


@extend_schema_view(
    list=extend_schema(
        tags=[PUBLIC_TAG],
        summary='Listar barbeiros ativos para escolha do cliente',
        description=(
            'Retorna a lista pública de profissionais ativos, incluindo bio, '
            'foto de perfil e IDs dos serviços que cada barbeiro realiza.'
        ),
    ),
    retrieve=extend_schema(
        tags=[PUBLIC_TAG],
        summary='Obter perfil público de um barbeiro',
        description='Retorna os dados públicos de um profissional ativo.',
    ),
)
class PublicProfessionalViewSet(viewsets.ReadOnlyModelViewSet):
    """Vitrine pública de profissionais ativos."""

    queryset = Professional.objects.filter(is_active=True)
    serializer_class = PublicProfessionalSerializer
    permission_classes = [AllowAny]


@extend_schema_view(
    list=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Listar todos os profissionais e grades de horário',
        description=(
            'Retorna todos os barbeiros (ativos e inativos) com suas taxas '
            'de comissão, serviços habilitados e grade semanal completa.'
        ),
    ),
    retrieve=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Consultar detalhes de um profissional no painel',
        description='Retorna o cadastro completo e expediente do barbeiro.',
    ),
    create=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Cadastrar novo profissional',
        description=(
            'Vincula um usuário a um novo perfil de barbeiro, definindo '
            'taxas de comissão, intervalo de agenda e serviços atendidos.'
        ),
    ),
    update=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Atualizar cadastro do profissional (PUT)',
        description='Substitui todos os dados cadastrais de um profissional.',
    ),
    partial_update=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Atualizar profissional parcialmente (PATCH)',
        description=(
            'Atualiza campos específicos (ex.: taxa de comissão, serviços '
            'atendidos ou status `is_active`).'
        ),
    ),
    destroy=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Remover profissional',
        description=(
            'Remove o cadastro do profissional (bloqueado caso já possua '
            'histórico de agendamentos ou comandas).'
        ),
    ),
)
class AdminProfessionalViewSet(viewsets.ModelViewSet):
    """CRUD administrativo de profissionais e horários."""

    queryset = Professional.objects.all().prefetch_related(
        'working_hours',
        'services',
    )
    serializer_class = AdminProfessionalSerializer
    permission_classes = [IsBarberShopStaff, IsOwnerOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Definir ou atualizar grade semanal de horários (Lote)',
        description=(
            'Recebe uma lista de turnos por dia da semana (`day_of_week` de '
            '1=Segunda a 7=Domingo) com `start_time`, `end_time`, '
            '`break_start` e `break_end`, atualizando toda a grade do '
            'profissional em uma única transação atômica.'
        ),
        request=WorkingHoursSerializer(many=True),
        responses={200: WorkingHoursSerializer(many=True)},
    )
    @action(
        detail=True,
        methods=['put'],
        url_path='working-hours',
        url_name='working_hours',
    )
    def update_working_hours(self, request, pk=None):
        professional = self.get_object()

        serializer = WorkingHoursSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                for item in serializer.validated_data:
                    wh, _ = WorkingHours.objects.update_or_create(
                        professional=professional,
                        day_of_week=item['day_of_week'],
                        defaults={
                            'is_working': item.get('is_working', True),
                            'start_time': item.get('start_time'),
                            'end_time': item.get('end_time'),
                            'break_start': item.get('break_start'),
                            'break_end': item.get('break_end'),
                        },
                    )
                    wh.full_clean()
        except DjangoValidationError as exc:
            return Response(
                {'detail': exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = WorkingHours.objects.filter(professional=professional)
        return Response(
            WorkingHoursSerializer(updated, many=True).data,
            status=status.HTTP_200_OK,
        )


@extend_schema_view(
    list=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Listar exceções de agenda (Folgas, Férias, Feriados)',
        description=(
            'Retorna todas as exceções cadastradas. Registros com '
            '`professional=null` aplicam-se à barbearia inteira.'
        ),
    ),
    retrieve=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Consultar detalhes de uma exceção de agenda',
        description='Retorna os dados de um bloqueio, feriado ou hora extra.',
    ),
    create=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Cadastrar bloqueio, feriado, férias ou turno extra',
        description=(
            'Cria uma exceção na agenda. Se `exception_type="HOLIDAY"`, '
            'define `is_all_day=true` e preenche o nome oficial do feriado '
            'nacional automaticamente caso `reason` seja omitido.'
        ),
    ),
    update=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Atualizar exceção de agenda (PUT)',
        description='Atualiza todos os campos de uma exceção de agenda.',
    ),
    partial_update=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Atualizar exceção parcialmente (PATCH)',
        description='Altera horários, data ou motivo de uma exceção.',
    ),
    destroy=extend_schema(
        tags=[PROFESSIONALS_TAG],
        summary='Remover exceção de agenda',
        description='Exclui o bloqueio ou turno extra, liberando a agenda.',
    ),
)
class AdminScheduleExceptionViewSet(viewsets.ModelViewSet):
    """CRUD administrativo de exceções de agenda."""

    queryset = ScheduleException.objects.select_related('professional').all()
    serializer_class = ScheduleExceptionSerializer
    permission_classes = [IsBarberShopStaff]
