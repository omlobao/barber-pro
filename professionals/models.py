import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
import holidays


class Professional(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    display_name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    bio = models.TextField(blank=True, null=True)
    profile_picture = models.ImageField(
        upload_to="profiles/",
        blank=True,
        null=True,
    )
    phone_number = models.CharField(max_length=20, unique=True)
    services = models.ManyToManyField('catalog.Service', blank=True)
    service_comission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
    )
    product_comission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
    )
    slot_interval_minutes = models.PositiveIntegerField(default=30)
    buffer_time_minutes = models.PositiveIntegerField(default=0)
    display_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'display_name']

    def __str__(self):
        return self.display_name


class WorkingHours(models.Model):
    class DayOfWeek(models.IntegerChoices):
        MONDAY = 1, 'Monday'
        TUESDAY = 2, 'Tuesday'
        WEDNESDAY = 3, 'Wednesday'
        THURSDAY = 4, 'Thursday'
        FRIDAY = 5, 'Friday'
        SATURDAY = 6, 'Saturday'
        SUNDAY = 7, 'Sunday'

    professional = models.ForeignKey(
        Professional,
        on_delete=models.CASCADE,
        related_name='working_hours',
    )
    is_working = models.BooleanField(default=True)
    day_of_week = models.PositiveSmallIntegerField(choices=DayOfWeek.choices)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    break_start = models.TimeField(null=True, blank=True)
    break_end = models.TimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['professional', 'day_of_week'],
                name='unique_barber_day_of_week',
            )
        ]
        ordering = ['day_of_week']

    def clean(self):
        if self.is_working and (not self.start_time or not self.end_time):
            raise ValidationError(
                "Informe o horário de início e fim quando o dia estiver ativo."
            )
        if (
            self.start_time
            and self.end_time
            and self.start_time >= self.end_time
        ):
            raise ValidationError(
                "O horário de início deve ser menor que o horário de fim."
            )

    def __str__(self):
        return f"{self.professional} - {self.get_day_of_week_display()}"


class ScheduleException(models.Model):
    class ExceptionType(models.TextChoices):
        BLOCK = 'BLOCK', 'Bloqueio / Ausência'
        EXTRA_HOURS = 'EXTRA_HOURS', 'Horário Extra'
        HOLIDAY = 'HOLIDAY', 'Feriado'
        VACATION = 'VACATION', 'Férias'

    professional = models.ForeignKey(
        Professional,
        on_delete=models.CASCADE,
        related_name='schedule_exceptions',
        null=True,
        blank=True,
    )
    date = models.DateField(db_index=True)
    exception_type = models.CharField(
        max_length=20,
        choices=ExceptionType.choices,
        default=ExceptionType.BLOCK,
    )
    is_all_day = models.BooleanField(default=False)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    reason = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'start_time']
        verbose_name = 'Exceção de Agenda'
        verbose_name_plural = 'Exceções de Agenda'

    def clean(self):
        # Se for feriado, define como dia todo e preenche o nome se vazio
        if self.exception_type == self.ExceptionType.HOLIDAY:
            self.is_all_day = True
            if not self.reason and self.date:
                br_holidays = holidays.country_holidays('BR')
                self.reason = br_holidays.get(self.date, 'Feriado')

        if self.is_all_day:
            self.start_time = None
            self.end_time = None
        else:
            if not self.start_time or not self.end_time:
                raise ValidationError(
                    "Informe o horário de início e fim "
                    "quando não for o dia todo."
                )
            if self.start_time >= self.end_time:
                raise ValidationError(
                    "O horário de início deve ser menor que o horário de fim."
                )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    @classmethod
    def populate_national_holidays(cls, year: int, state: str = None):
        """
        Cadastra todos os feriados nacionais (e estaduais, se informado)
        para o ano especificado como exceções gerais da barbearia.
        """
        holiday_list = holidays.country_holidays(
            'BR',
            subdiv=state,
            years=year,
        )
        created_records = []

        for holiday_date, name in holiday_list.items():
            existing = cls.objects.filter(
                date=holiday_date,
                professional=None,
            ).first()
            if not existing:
                obj = cls.objects.create(
                    date=holiday_date,
                    professional=None,
                    exception_type=cls.ExceptionType.HOLIDAY,
                    is_all_day=True,
                    reason=name,
                )
                created_records.append(obj)

        return created_records

    def __str__(self):
        target = (
            self.professional.display_name
            if self.professional
            else 'Barbearia (Geral)'
        )
        return (
            f"{target} - {self.date} "
            f"({self.get_exception_type_display()})"
        )
