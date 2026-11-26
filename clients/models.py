import re
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Client(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='client_profile',
        verbose_name="Conta de Acesso",
    )
    name = models.CharField(
        max_length=120,
        verbose_name="Nome Completo",
    )
    phone_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Número de Telefone",
        help_text="Número de telefone do cliente com DDD (ex: 11912345678)",
    )
    email = models.EmailField(
        blank=True,
        verbose_name="E-mail",
    )
    birth_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Data de Nascimento",
    )
    notes = models.TextField(
        blank=True,
        verbose_name="Observações",
        help_text="Informações adicionais sobre o cliente",
    )
    total_visits = models.PositiveIntegerField(
        default=0,
        verbose_name="Total de Visitas",
    )
    no_show_count = models.PositiveSmallIntegerField(
        default=0,
        verbose_name="Faltas sem Aviso",
    )
    is_blocked = models.BooleanField(
        default=False,
        verbose_name="Bloqueado para agendamento online",
        help_text=(
            "Marque para impedir agendamentos futuros de clientes "
            "recorrentes com faltas"
        ),
    )
    whatsapp_opt_in = models.BooleanField(
        default=True,
        verbose_name="Aceita Promoções no WhatsApp",
        help_text=(
            "Desmarcado automaticamente quando o cliente envia SAIR ou PARAR."
        ),
    )
    whatsapp_opt_out_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Cancelou Promoções em",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'

    def clean(self):
        if self.phone_number:
            digits_only = re.sub(r'\D', '', self.phone_number)
            if len(digits_only) < 10 or len(digits_only) > 13:
                raise ValidationError({
                    'phone_number': (
                        "Informe um número de telefone ou WhatsApp "
                        "válido com DDD."
                    )
                })
            self.phone_number = digits_only

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.phone_number})"
