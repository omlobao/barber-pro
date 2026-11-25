from datetime import datetime
import uuid

from django.db import transaction
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Service
from core.permissions import IsBarberShopStaff
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


class PublicAvailabilityView(APIView):
    """
    Endpoint público de consulta de horários livres para agendamento:
    GET /api/public/availability/?date=2026-11-25&service_ids=u1,u2
    """

    permission_classes = [AllowAny]

    def get(self, request):
        """
        Calcula a duração total dos serviços escolhidos e retorna os
        horários disponíveis por profissional na data informada.
        """
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


class PublicBookingCreateView(generics.CreateAPIView):
    """
    Endpoint público para criação de um novo agendamento pelo cliente:
    POST /api/public/bookings/
    """

    permission_classes = [AllowAny]
    serializer_class = PublicBookingCreateSerializer

    def create(self, request, *args, **kwargs):
        """
        Valida e salva o agendamento com PublicBookingCreateSerializer, e
        formata a resposta HTTP 201 com PublicAppointmentDetailSerializer.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = serializer.save()
        output = PublicAppointmentDetailSerializer(appointment).data
        return Response(output, status=status.HTTP_201_CREATED)


class PublicAppointmentManageView(generics.RetrieveAPIView):
    """
    Endpoint público de consulta do agendamento via token único:
    GET /api/public/bookings/<cancel_token>/
    """

    permission_classes = [AllowAny]
    queryset = (
        Appointment.objects.select_related('client', 'professional')
        .prefetch_related('items__service')
    )
    serializer_class = PublicAppointmentDetailSerializer
    lookup_field = 'cancel_token'


class PublicAppointmentCancelView(APIView):
    """
    Endpoint público para o cliente cancelar seu agendamento via token:
    POST /api/public/bookings/<cancel_token>/cancel/
    """

    permission_classes = [AllowAny]

    def post(self, request, cancel_token):
        """
        Localiza o agendamento pelo cancel_token e altera o status para
        CANCELED, desde que ainda esteja pendente ou confirmado.
        """
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


class AdminAppointmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo (CRUD) da agenda para o painel administrativo.
    """

    queryset = (
        Appointment.objects.select_related('client', 'professional')
        .prefetch_related('items__service')
    )
    serializer_class = AdminAppointmentSerializer
    permission_classes = [IsBarberShopStaff]

    def get_queryset(self):
        """
        Filtra os agendamentos por data e profissional via query params e
        restringe barbeiros comuns a visualizarem apenas a própria agenda.
        """
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
        """
        Ao atualizar um agendamento para NO_SHOW, incrementa
        automaticamente o contador de faltas do cliente.
        """
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

    @action(detail=True, methods=['post'], url_path='mark-no-show')
    def mark_no_show(self, request, pk=None):
        """
        Marca o agendamento como Não Compareceu (NO_SHOW) e incrementa
        o contador de faltas sem aviso do cliente.
        POST /api/admin/appointments/{id}/mark-no-show/
        """
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

    @action(detail=True, methods=['post'], url_path='open-order')
    def open_order(self, request, pk=None):
        """
        Rota customizada (POST /appointments/{id}/open-order/) que gera ou
        recupera a comanda financeira a partir do agendamento.
        """
        appointment = self.get_object()
        order = Order.create_from_appointment(appointment)
        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_200_OK,
        )
