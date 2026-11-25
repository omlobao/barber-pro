import re

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    """
    Serializa os dados cadastrais, métricas de fidelidade (visitas/faltas)
    e status de bloqueio do cliente para o painel administrativo.
    """

    class Meta:
        model = Client
        fields = [
            'id',
            'name',
            'phone_number',
            'email',
            'birth_date',
            'notes',
            'total_visits',
            'no_show_count',
            'is_blocked',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'total_visits',
            'no_show_count',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'phone_number': {'validators': []},
        }

    def validate_phone_number(self, value):
        digits_only = re.sub(r'\D', '', value or '')
        if len(digits_only) < 10 or len(digits_only) > 13:
            raise serializers.ValidationError(
                "Informe um número de telefone ou WhatsApp válido com DDD."
            )

        qs = Client.objects.filter(phone_number=digits_only)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "Já existe um cliente cadastrado com este número de telefone."
            )
        return digits_only

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
