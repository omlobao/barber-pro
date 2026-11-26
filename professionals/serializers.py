from datetime import time
import re

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from catalog.models import Service
from .models import Professional, ScheduleException, WorkingHours

User = get_user_model()


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
                'Informe o horário de início e fim quando o dia estiver ativo.'
            )
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError(
                'O horário de início deve ser menor que o horário de fim.'
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
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        min_length=6,
    )

    class Meta:
        model = Professional
        fields = [
            'id',
            'user',
            'username',
            'email',
            'password',
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
        extra_kwargs = {
            'user': {'required': False},
            'slug': {'required': False, 'allow_blank': True, 'validators': []},
            'phone_number': {'validators': []},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['username'] = instance.user.username if instance.user_id else ''
        data['email'] = instance.user.email if instance.user_id else ''
        return data

    def validate_phone_number(self, value):
        digits = re.sub(r'\D', '', value or '')
        if len(digits) < 10 or len(digits) > 13:
            raise serializers.ValidationError(
                'Informe um WhatsApp válido com DDD.'
            )
        qs = Professional.objects.filter(phone_number=digits)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Já existe um profissional cadastrado com este WhatsApp.'
            )
        return digits

    def validate(self, attrs):
        raw_username = (attrs.get('username') or '').strip().lower()
        raw_username = raw_username.replace(' ', '')
        password = attrs.get('password') or ''

        if self.instance is None and not attrs.get('user'):
            if not raw_username:
                raise serializers.ValidationError({
                    'username': (
                        'Defina um nome de usuário para o funcionário '
                        'acessar o painel.'
                    )
                })
            if len(password) < 6:
                raise serializers.ValidationError({
                    'password': (
                        'Defina uma senha inicial com pelo menos 6 caracteres.'
                    )
                })
            if User.objects.filter(username__iexact=raw_username).exists():
                raise serializers.ValidationError({
                    'username': 'Este nome de usuário já está em uso.'
                })
            attrs['username'] = raw_username
        elif self.instance is not None and raw_username:
            qs = User.objects.filter(username__iexact=raw_username).exclude(
                pk=self.instance.user_id
            )
            if qs.exists():
                raise serializers.ValidationError({
                    'username': 'Este nome de usuário já está em uso.'
                })
            attrs['username'] = raw_username

        return attrs

    def _build_unique_slug(self, display_name: str, provided_slug: str = ''):
        base = slugify(provided_slug or display_name) or 'profissional'
        slug = base
        counter = 1
        qs = Professional.objects.all()
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        while qs.filter(slug=slug).exists():
            slug = f'{base}-{counter}'
            counter += 1
        return slug

    @transaction.atomic
    def create(self, validated_data):
        username = validated_data.pop('username', '')
        email = validated_data.pop('email', '') or ''
        password = validated_data.pop('password', '')
        services = validated_data.pop('services', None)
        provided_slug = validated_data.pop('slug', '')

        display_name = validated_data['display_name'].strip()
        validated_data['display_name'] = display_name
        validated_data['slug'] = self._build_unique_slug(
            display_name,
            provided_slug,
        )

        if 'user' not in validated_data or validated_data['user'] is None:
            parts = display_name.split(' ', 1)
            first_name = parts[0][:30]
            last_name = parts[1][:150] if len(parts) > 1 else ''
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_staff=False,
            )
            validated_data['user'] = user

        professional = Professional.objects.create(**validated_data)

        if services is not None:
            professional.services.set(services)
        else:
            professional.services.set(Service.objects.filter(is_active=True))

        # Cria expediente padrão (Seg a Sáb 09h-19h com almoço 12h-13h)
        for day in range(1, 8):
            is_working = day != 7
            WorkingHours.objects.create(
                professional=professional,
                day_of_week=day,
                is_working=is_working,
                start_time=time(9, 0) if is_working else None,
                end_time=time(19, 0) if is_working else None,
                break_start=time(12, 0) if is_working else None,
                break_end=time(13, 0) if is_working else None,
            )

        return professional

    @transaction.atomic
    def update(self, instance, validated_data):
        username = validated_data.pop('username', None)
        email = validated_data.pop('email', None)
        password = validated_data.pop('password', '')
        services = validated_data.pop('services', None)

        if 'slug' in validated_data:
            raw_slug = validated_data.pop('slug')
            if raw_slug:
                instance.slug = self._build_unique_slug(
                    validated_data.get('display_name', instance.display_name),
                    raw_slug,
                )

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if services is not None:
            instance.services.set(services)

        if instance.user_id:
            user = instance.user
            user_changed = False
            if username:
                user.username = username
                user_changed = True
            if email is not None:
                user.email = email
                user_changed = True
            if password:
                user.set_password(password)
                user_changed = True
            if 'display_name' in validated_data:
                parts = instance.display_name.strip().split(' ', 1)
                user.first_name = parts[0][:30]
                user.last_name = parts[1][:150] if len(parts) > 1 else ''
                user_changed = True
            if user_changed:
                user.save()

        return instance
