from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from professionals.models import Professional
from .models import Appointment, AppointmentItem
from .services import create_booking


class AppointmentItemSerializer(serializers.ModelSerializer):
    """
    Serializa cada serviço individual vinculado a um agendamento
    (ex.: corte, barba), trazendo também o nome legível do serviço.
    """

    service_name = serializers.CharField(
        source='service.name',
        read_only=True,
    )

    class Meta:
        model = AppointmentItem
        fields = [
            'id',
            'service',
            'service_name',
            'price',
            'duration_minutes',
        ]


class PublicBookingCreateSerializer(serializers.Serializer):
    """
    Valida o payload enviado pelo cliente na etapa final do agendamento
    público e aciona a camada de serviço para criar o agendamento.
    """

    professional_id = serializers.UUIDField()
    service_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )
    date = serializers.DateField()
    start_time = serializers.TimeField(
        format='%H:%M',
        input_formats=['%H:%M', '%H:%M:%S'],
    )
    client_name = serializers.CharField(max_length=120)
    client_phone = serializers.CharField(max_length=20)
    client_notes = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )

    def create(self, validated_data):
        """
        Executado ao chamar serializer.save(). Valida se o profissional
        está ativo e delega a criação para create_booking.
        """
        try:
            professional = Professional.objects.get(
                id=validated_data['professional_id'],
                is_active=True,
            )
        except Professional.DoesNotExist:
            raise serializers.ValidationError({
                'professional_id': 'Profissional não encontrado.'
            })

        try:
            return create_booking(
                professional=professional,
                service_ids=validated_data['service_ids'],
                target_date=validated_data['date'],
                start_time=validated_data['start_time'],
                client_name=validated_data['client_name'],
                client_phone=validated_data['client_phone'],
                client_notes=validated_data.get('client_notes', ''),
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})


class PublicAppointmentDetailSerializer(serializers.ModelSerializer):
    """
    Formata os detalhes de um agendamento para exibição pública ao cliente
    (tela /meu-agendamento/:cancel_token), ocultando dados internos.
    """

    professional_name = serializers.CharField(
        source='professional.display_name',
        read_only=True,
    )
    client_name = serializers.CharField(source='client.name', read_only=True)
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True,
    )
    items = AppointmentItemSerializer(many=True, read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id',
            'cancel_token',
            'client_name',
            'professional_name',
            'date',
            'start_time',
            'end_time',
            'status',
            'status_display',
            'total_duration_minutes',
            'total_price',
            'client_notes',
            'items',
        ]


class AdminAppointmentSerializer(serializers.ModelSerializer):
    """
    Serializa o agendamento completo para o painel administrativo, incluindo
    notas internas, telefone do cliente e vínculo com a comanda (order_id).
    """

    client_name = serializers.CharField(source='client.name', read_only=True)
    client_phone = serializers.CharField(
        source='client.phone_number',
        read_only=True,
    )
    professional_name = serializers.CharField(
        source='professional.display_name',
        read_only=True,
    )
    items = AppointmentItemSerializer(many=True, read_only=True)
    order_id = serializers.UUIDField(
        source='order.id',
        read_only=True,
        default=None,
    )

    class Meta:
        model = Appointment
        fields = [
            'id',
            'client',
            'client_name',
            'client_phone',
            'professional',
            'professional_name',
            'date',
            'start_time',
            'end_time',
            'status',
            'total_duration_minutes',
            'total_price',
            'client_notes',
            'internal_notes',
            'items',
            'order_id',
        ]

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'detail': exc.messages})
