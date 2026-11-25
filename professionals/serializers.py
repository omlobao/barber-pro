from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Professional, ScheduleException, WorkingHours


class WorkingHoursSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(
        source='get_day_of_week_display',
        read_only=True,
    )

    class Meta:
        model = WorkingHours
        fields = [
            'id',
            'day_of_week',
            'day_name',
            'is_working',
            'start_time',
            'end_time',
            'break_start',
            'break_end',
        ]

    def validate(self, attrs):
        is_working = attrs.get('is_working', True)
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')

        if is_working and (not start_time or not end_time):
            raise serializers.ValidationError(
                "Informe o horário de início e fim quando o dia estiver ativo."
            )
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError(
                "O horário de início deve ser menor que o horário de fim."
            )
        return attrs


class ScheduleExceptionSerializer(serializers.ModelSerializer):
    professional_name = serializers.CharField(
        source='professional.display_name',
        read_only=True,
        default=None,
    )

    class Meta:
        model = ScheduleException
        fields = [
            'id',
            'professional',
            'professional_name',
            'date',
            'exception_type',
            'is_all_day',
            'start_time',
            'end_time',
            'reason',
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


class PublicProfessionalSerializer(serializers.ModelSerializer):
    """Dados públicos exibidos na escolha do barbeiro."""

    services = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Professional
        fields = [
            'id',
            'display_name',
            'slug',
            'bio',
            'profile_picture',
            'services',
            'is_active',
        ]


class AdminProfessionalSerializer(serializers.ModelSerializer):
    working_hours = WorkingHoursSerializer(many=True, read_only=True)

    class Meta:
        model = Professional
        fields = [
            'id',
            'user',
            'display_name',
            'slug',
            'bio',
            'profile_picture',
            'phone_number',
            'services',
            'service_comission_rate',
            'product_comission_rate',
            'slot_interval_minutes',
            'buffer_time_minutes',
            'display_order',
            'is_active',
            'working_hours',
        ]
