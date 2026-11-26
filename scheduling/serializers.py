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
    Valida o payload enviado pelo cliente autenticado na etapa final do
    agendamento online e aciona a camada de serviço com suporte a cupom.
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
    coupon_code = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
    )
    client_notes = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )

    def create(self, validated_data):
        """
        Executado ao chamar serializer.save(). Utiliza o perfil do cliente
        autenticado e aplica o cupom de desconto se informado.
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

        request = self.context.get('request')
        client = getattr(request.user, 'client_profile', None)

        try:
            return create_booking(
                professional=professional,
                service_ids=validated_data['service_ids'],
                target_date=validated_data['date'],
                start_time=validated_data['start_time'],
                client=client,
                coupon_code=validated_data.get('coupon_code', ''),
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
    coupon_code = serializers.CharField(
        source='coupon.code',
        read_only=True,
        default=None,
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
            'subtotal_price',
            'discount_amount',
            'total_price',
            'coupon_code',
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
    coupon_code = serializers.CharField(
        source='coupon.code',
        read_only=True,
        default=None,
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
            'subtotal_price',
            'discount_amount',
            'total_price',
            'coupon_code',
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
