from datetime import date, time
from decimal import Decimal
import re

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from catalog.models import Coupon, Service
from clients.models import Client
from professionals.models import (
    Professional,
    ScheduleException,
    WorkingHours,
)
from .models import Appointment, AppointmentItem


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _minutes_to_time(minutes: int) -> time:
    return time(hour=minutes // 60, minute=minutes % 60)


def get_available_slots(
    professional: Professional,
    target_date: date,
    duration_minutes: int,
) -> list[str]:
    """
    Retorna uma lista de horários livres (ex: ['09:00', '09:30']) para
    um profissional em uma data específica considerando a duração do corte.
    """
    if not professional.is_active or target_date < timezone.localdate():
        return []

    # 1. Busca exceções aplicáveis ao profissional ou gerais da barbearia
    exceptions = ScheduleException.objects.filter(
        Q(professional=professional) | Q(professional__isnull=True),
        date=target_date,
    )

    # Se houver qualquer bloqueio de dia inteiro, agenda fechada
    blocking_types = [
        ScheduleException.ExceptionType.BLOCK,
        ScheduleException.ExceptionType.HOLIDAY,
        ScheduleException.ExceptionType.VACATION,
    ]
    if exceptions.filter(
        exception_type__in=blocking_types,
        is_all_day=True,
    ).exists():
        return []

    # 2. Determina horários de trabalho e intervalos bloqueados
    work_intervals: list[tuple[int, int]] = []
    blocked_intervals: list[tuple[int, int]] = []

    # Bloqueios parciais do dia (ex: ausência de 14:00 às 16:00)
    for block in exceptions.filter(
        exception_type__in=blocking_types,
        is_all_day=False,
    ):
        if block.start_time and block.end_time:
            blocked_intervals.append(
                (
                    _time_to_minutes(block.start_time),
                    _time_to_minutes(block.end_time),
                )
            )

    working_day = WorkingHours.objects.filter(
        professional=professional,
        day_of_week=target_date.isoweekday(),
        is_working=True,
    ).first()

    if working_day and working_day.start_time and working_day.end_time:
        work_intervals.append(
            (
                _time_to_minutes(working_day.start_time),
                _time_to_minutes(working_day.end_time),
            )
        )
        if working_day.break_start and working_day.break_end:
            blocked_intervals.append(
                (
                    _time_to_minutes(working_day.break_start),
                    _time_to_minutes(working_day.break_end),
                )
            )

    # 3. Adiciona turnos extras cadastrados para a data
    extra_hours = exceptions.filter(
        exception_type=ScheduleException.ExceptionType.EXTRA_HOURS,
    )
    for extra in extra_hours:
        if extra.start_time and extra.end_time:
            work_intervals.append(
                (
                    _time_to_minutes(extra.start_time),
                    _time_to_minutes(extra.end_time),
                )
            )

    if not work_intervals:
        return []

    # 4. Adiciona agendamentos já marcados no dia + tempo de limpeza (buffer)
    active_statuses = [
        Appointment.Status.PENDING,
        Appointment.Status.CONFIRMED,
        Appointment.Status.IN_PROGRESS,
    ]
    appointments = Appointment.objects.filter(
        professional=professional,
        date=target_date,
        status__in=active_statuses,
    )
    buffer_minutes = professional.buffer_time_minutes or 0
    for app in appointments:
        start_min = _time_to_minutes(app.start_time)
        end_min = _time_to_minutes(app.end_time) + buffer_minutes
        blocked_intervals.append((start_min, end_min))

    # 5. Se for hoje, desconsidera horários que já passaram (+15min tolerância)
    now_minutes = None
    if target_date == timezone.localdate():
        now = timezone.localtime()
        now_minutes = now.hour * 60 + now.minute + 15

    # 6. Fatia as janelas de acordo com o intervalo do barbeiro
    step = professional.slot_interval_minutes or 30
    available_slots: set[int] = set()

    for w_start, w_end in work_intervals:
        cursor = w_start
        while cursor + duration_minutes <= w_end:
            slot_end = cursor + duration_minutes

            if now_minutes is None or cursor >= now_minutes:
                has_conflict = any(
                    cursor < b_end and slot_end > b_start
                    for b_start, b_end in blocked_intervals
                )
                if not has_conflict:
                    available_slots.add(cursor)

            cursor += step

    return [
        _minutes_to_time(m).strftime("%H:%M")
        for m in sorted(available_slots)
    ]


# Alias com a grafia anterior para manter compatibilidade
get_avaliable_slots = get_available_slots


@transaction.atomic
def create_booking(
    *,
    professional: Professional,
    service_ids: list,
    target_date: date,
    start_time: time,
    client_name: str = "",
    client_phone: str = "",
    client: Client | None = None,
    coupon_code: str = "",
    client_notes: str = "",
) -> Appointment:
    """
    Cria um agendamento de forma atômica garantindo a integridade dos dados
    para impedir que dois clientes reservem o mesmo horário simultaneamente.
    """
    # Lock de linha para concorrência
    professional = (
        Professional.objects.select_for_update().get(pk=professional.pk)
    )

    clean_service_ids = list(dict.fromkeys(service_ids))
    services = list(
        Service.objects.filter(id__in=clean_service_ids, is_active=True)
    )
    if len(services) != len(clean_service_ids) or not services:
        raise ValidationError(
            "Um ou mais serviços selecionados são inválidos ou inativos."
        )

    total_duration = sum(s.duration_minutes for s in services)
    subtotal_price = sum(
        (s.effective_price for s in services),
        Decimal("0.00"),
    )

    start_min = _time_to_minutes(start_time)
    end_time = _minutes_to_time(start_min + total_duration)

    available_slots = get_available_slots(
        professional, target_date, total_duration
    )
    if start_time.strftime("%H:%M") not in available_slots:
        raise ValidationError(
            "Este horário acabou de ser preenchido. "
            "Por favor, escolha outro horário."
        )

    if client is None:
        clean_phone = re.sub(r'\D', '', client_phone)
        client, created = Client.objects.get_or_create(
            phone_number=clean_phone,
            defaults={"name": client_name},
        )
        if not created and client_name and client.name != client_name:
            client.name = client_name
            client.save(update_fields=["name", "updated_at"])

    if client.is_blocked:
        raise ValidationError(
            "Não foi possível concluir o agendamento online. "
            "Entre em contato com a barbearia."
        )

    coupon = None
    discount_amount = Decimal("0.00")
    clean_code = (coupon_code or "").strip().upper()
    if clean_code:
        try:
            coupon = Coupon.objects.select_for_update().get(
                code__iexact=clean_code
            )
        except Coupon.DoesNotExist:
            raise ValidationError("Cupom inválido ou não encontrado.")

        discount_amount = coupon.calculate_discount(
            subtotal_price,
            client=client,
        )
        coupon.used_count += 1
        coupon.save(update_fields=["used_count", "updated_at"])

    total_price = max(Decimal("0.00"), subtotal_price - discount_amount)

    appointment = Appointment(
        client=client,
        professional=professional,
        date=target_date,
        start_time=start_time,
        end_time=end_time,
        status=Appointment.Status.CONFIRMED,
        total_duration_minutes=total_duration,
        coupon=coupon,
        subtotal_price=subtotal_price,
        discount_amount=discount_amount,
        total_price=total_price,
        client_notes=client_notes,
    )
    appointment.full_clean()
    appointment.save()

    AppointmentItem.objects.bulk_create([
        AppointmentItem(
            appointment=appointment,
            service=s,
            price=s.effective_price,
            duration_minutes=s.duration_minutes,
        )
        for s in services
    ])

    return appointment
