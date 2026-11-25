from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
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


class PublicProfessionalViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet somente leitura (GET) destinado à vitrine pública ou landing page.
    Permite listar e visualizar detalhes apenas dos profissionais ativos.
    """

    queryset = Professional.objects.filter(is_active=True)
    serializer_class = PublicProfessionalSerializer
    permission_classes = [AllowAny]


class AdminProfessionalViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo (CRUD) para o painel administrativo da barbearia.
    Gerencia todos os profissionais (ativos e inativos) e seus horários.
    """

    queryset = Professional.objects.all().prefetch_related(
        'working_hours',
        'services',
    )
    serializer_class = AdminProfessionalSerializer
    permission_classes = [IsBarberShopStaff, IsOwnerOrReadOnly]

    @action(
        detail=True,
        methods=['put'],
        url_path='working-hours',
        url_name='working_hours',
    )
    def update_working_hours(self, request, pk=None):
        """
        Endpoint customizado (PUT /professionals/{id}/working-hours/)
        para cadastrar ou atualizar em lote a grade semanal do profissional.
        """
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

        updated = professional.working_hours.all()
        return Response(
            WorkingHoursSerializer(updated, many=True).data,
            status=status.HTTP_200_OK,
        )


class AdminScheduleExceptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo (CRUD) para gerenciar exceções na agenda dos
    profissionais, como folgas, férias, feriados ou horários extras.
    """

    queryset = ScheduleException.objects.select_related('professional').all()
    serializer_class = ScheduleExceptionSerializer
    permission_classes = [IsBarberShopStaff]
