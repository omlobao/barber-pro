import re

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Client

User = get_user_model()


def sanitize_phone(value: str) -> str:
    digits_only = re.sub(r'\D', '', value or '')
    if len(digits_only) < 10 or len(digits_only) > 13:
        raise serializers.ValidationError(
            'Informe um número de telefone ou WhatsApp válido com DDD.'
        )
    return digits_only


class ClientSerializer(serializers.ModelSerializer):
    """
    Serializa os dados cadastrais, métricas de fidelidade (visitas/faltas),
    vínculo de conta online e status de bloqueio para o painel administrativo.
    """

    has_account = serializers.SerializerMethodField()

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
            'has_account',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'total_visits',
            'no_show_count',
            'has_account',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'phone_number': {'validators': []},
        }

    def get_has_account(self, obj) -> bool:
        return bool(obj.user_id)

    def validate_phone_number(self, value):
        digits_only = sanitize_phone(value)
        qs = Client.objects.filter(phone_number=digits_only)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Já existe um cliente cadastrado com este número de telefone.'
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


class ClientProfileSerializer(serializers.ModelSerializer):
    """Perfil do próprio cliente autenticado na Área do Cliente."""

    class Meta:
        model = Client
        fields = [
            'id',
            'name',
            'phone_number',
            'email',
            'birth_date',
            'total_visits',
            'no_show_count',
            'is_blocked',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'total_visits',
            'no_show_count',
            'is_blocked',
            'created_at',
        ]
        extra_kwargs = {
            'phone_number': {'validators': []},
        }

    def validate_phone_number(self, value):
        digits_only = sanitize_phone(value)
        qs = Client.objects.filter(phone_number=digits_only)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Este WhatsApp já está vinculado a outro cadastro.'
            )
        return digits_only

    def validate_email(self, value):
        cleaned = (value or '').strip().lower()
        if not cleaned:
            return None
        qs = Client.objects.filter(email__iexact=cleaned, user__isnull=False)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Este e-mail já está em uso por outra conta.'
            )
        return cleaned

    def update(self, instance, validated_data):
        client = super().update(instance, validated_data)
        if client.user:
            first_name = client.name.strip().split()[0][:30]
            client.user.first_name = first_name
            client.user.email = client.email or ''
            client.user.save(update_fields=['first_name', 'email'])
        return client


class ClientRegisterSerializer(serializers.Serializer):
    """Cadastro online do cliente com emissão imediata de tokens JWT."""

    name = serializers.CharField(max_length=120)
    phone_number = serializers.CharField(max_length=20)
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    birth_date = serializers.DateField(required=False, allow_null=True)
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_phone_number(self, value):
        digits = sanitize_phone(value)
        existing = Client.objects.filter(phone_number=digits).first()
        if existing and existing.user_id is not None:
            raise serializers.ValidationError(
                'Já existe uma conta com este WhatsApp. Faça login.'
            )
        if existing and existing.is_blocked:
            raise serializers.ValidationError(
                'Seu cadastro possui restrição. Contate a barbearia.'
            )
        return digits

    def validate_email(self, value):
        cleaned = (value or '').strip().lower()
        if not cleaned:
            return None
        if Client.objects.filter(
            email__iexact=cleaned,
            user__isnull=False,
        ).exists():
            raise serializers.ValidationError(
                'Já existe uma conta cadastrada com este e-mail.'
            )
        return cleaned

    def create(self, validated_data):
        digits = validated_data['phone_number']
        name = validated_data['name'].strip()
        email = validated_data.get('email')
        birth_date = validated_data.get('birth_date')
        password = validated_data['password']

        base_username = f'cli_{digits}'
        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            username = f'{base_username}_{suffix}'
            suffix += 1

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email or '',
                password=password,
                first_name=name.split()[0][:30],
            )
            existing = (
                Client.objects.select_for_update()
                .filter(phone_number=digits)
                .first()
            )
            if existing:
                existing.user = user
                existing.name = name
                if email:
                    existing.email = email
                if birth_date:
                    existing.birth_date = birth_date
                existing.save()
                client = existing
            else:
                client = Client.objects.create(
                    user=user,
                    name=name,
                    phone_number=digits,
                    email=email,
                    birth_date=birth_date,
                )

        refresh = RefreshToken.for_user(user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'client': ClientProfileSerializer(client).data,
        }


class ClientLoginSerializer(serializers.Serializer):
    """Autenticação do cliente usando WhatsApp (com DDD) ou e-mail."""

    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        raw_id = (attrs.get('identifier') or '').strip()
        password = attrs.get('password') or ''

        if '@' in raw_id:
            client = (
                Client.objects.select_related('user')
                .filter(email__iexact=raw_id, user__isnull=False)
                .first()
            )
        else:
            digits = re.sub(r'\D', '', raw_id)
            client = (
                Client.objects.select_related('user')
                .filter(phone_number=digits, user__isnull=False)
                .first()
            )

        if (
            not client
            or not client.user
            or not client.user.is_active
            or not client.user.check_password(password)
        ):
            raise serializers.ValidationError({
                'detail': 'WhatsApp/e-mail ou senha incorretos.'
            })

        refresh = RefreshToken.for_user(client.user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'client': ClientProfileSerializer(client).data,
        }
