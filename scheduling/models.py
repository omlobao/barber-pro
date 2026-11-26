from decimal import Decimal
import uuid

from django.core.exceptions import ValidationError
from django.db import models


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pendente'
        CONFIRMED = 'CONFIRMED', 'Confirmado'
        IN_PROGRESS = 'IN_PROGRESS', 'Em Atendimento'
        COMPLETED = 'COMPLETED', 'Concluído'
        CANCELED = 'CANCELED', 'Cancelado'
        NO_SHOW = 'NO_SHOW', 'Não Compareceu'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    cancel_token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        help_text=(
            "Token seguro para o cliente cancelar/reagendar "
            "via link do WhatsApp."
        ),
    )
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.PROTECT,
        related_name='appointments',
    )
    professional = models.ForeignKey(
        'professionals.Professional',
        on_delete=models.PROTECT,
        related_name='appointments',
    )
    date = models.DateField(db_index=True, verbose_name="Data")
    start_time = models.TimeField(verbose_name="Início")
    end_time = models.TimeField(verbose_name="Término Previsto")
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.CONFIRMED,
        db_index=True,
    )
    total_duration_minutes = models.PositiveSmallIntegerField(default=30)
    coupon = models.ForeignKey(
        'catalog.Coupon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments',
    )
    subtotal_price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    discount_amount = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    total_price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    client_notes = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Observação do Cliente",
    )
    internal_notes = models.TextField(
        blank=True,
        verbose_name="Observação Interna da Barbearia",
    )
    reminder_sent = models.BooleanField(
        default=False,
        help_text=(
            "Indica se o lembrete automático de WhatsApp já foi disparado."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-start_time']
        indexes = [
            models.Index(fields=['professional', 'date', 'status']),
        ]
        verbose_name = 'Agendamento'
        verbose_name_plural = 'Agendamentos'

    def clean(self):
        if (
            self.start_time
            and self.end_time
            and self.start_time >= self.end_time
        ):
            raise ValidationError(
                "O horário de término deve ser maior que o horário de início."
            )

        active_statuses = [
            self.Status.PENDING,
            self.Status.CONFIRMED,
            self.Status.IN_PROGRESS,
        ]

        # Valida conflito de horário apenas se este agendamento estiver ativo
        if (
            self.status in active_statuses
            and self.professional_id
            and self.date
            and self.start_time
            and self.end_time
        ):
            overlapping = Appointment.objects.filter(
                professional_id=self.professional_id,
                date=self.date,
                status__in=active_statuses,
                start_time__lt=self.end_time,
                end_time__gt=self.start_time,
            ).exclude(pk=self.pk)

            if overlapping.exists():
                raise ValidationError(
                    "Este profissional já possui um agendamento "
                    "neste intervalo de horário."
                )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        date_str = self.date.strftime('%d/%m/%Y')
        time_str = self.start_time.strftime('%H:%M')
        return (
            f"{date_str} {time_str} - {self.client.name} "
            f"({self.professional.display_name})"
        )


class AppointmentItem(models.Model):
    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.CASCADE,
        related_name='items',
    )
    service = models.ForeignKey(
        'catalog.Service',
        on_delete=models.PROTECT,
        related_name='appointment_items',
    )
    price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Preço do serviço congelado no momento do agendamento.",
    )
    duration_minutes = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Duração congelada no momento do agendamento.",
    )

    class Meta:
        verbose_name = 'Serviço do Agendamento'
        verbose_name_plural = 'Serviços do Agendamento'

    def save(self, *args, **kwargs):
        if self.price is None and self.service_id:
            self.price = self.service.effective_price
        if self.duration_minutes is None and self.service_id:
            self.duration_minutes = self.service.duration_minutes
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.service.name} - R$ {self.price}"
