import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  Clock,
  Scissors,
  User,
  XCircle,
} from 'lucide-react';
import api from '@/api/client';
import { PublicNavbar } from '@/components/PublicNavbar';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  APPOINTMENT_STATUS_META,
  buildGoogleCalendarUrl,
  extractErrorMessage,
  formatCurrency,
  formatDateBR,
} from '@/utils/formatters';

export default function MyAppointmentPage() {
  const { cancel_token: cancelToken } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const loadAppointment = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/api/public/bookings/${cancelToken}/`);
      setAppointment(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Agendamento não encontrado.'));
    } finally {
      setLoading(false);
    }
  }, [cancelToken]);

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  const canCancel =
    appointment &&
    ['PENDING', 'CONFIRMED'].includes(appointment.status);

  const handleConfirmCancel = async () => {
    setCanceling(true);
    try {
      await api.post(`/api/public/bookings/${cancelToken}/cancel/`);
      setConfirmOpen(false);
      await loadAppointment();
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível cancelar o horário.'));
    } finally {
      setCanceling(false);
    }
  };

  const statusMeta =
    APPOINTMENT_STATUS_META[appointment?.status] ||
    APPOINTMENT_STATUS_META.CONFIRMED;

  return (
    <div className="min-h-screen bg-[#0B0D10] text-[#F8FAFC]">
      <PublicNavbar />

      <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
        {loading ? (
          <Skeleton className="h-96 w-full rounded-3xl" />
        ) : error && !appointment ? (
          <div className="rounded-3xl border border-[#232730] bg-[#14171D] p-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
            <h1 className="mt-4 text-xl font-bold">{error}</h1>
            <Link
              to="/agendar"
              className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#D97706] px-6 text-sm font-bold text-[#0B0D10]"
            >
              Fazer Novo Agendamento
            </Link>
          </div>
        ) : appointment ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-[#232730] bg-[#14171D] p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#232730] pb-5">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#94A3B8]">
                  Comprovante de Agendamento
                </span>
                <h1 className="font-display mt-1 text-2xl font-bold text-[#F8FAFC]">
                  Olá, {appointment.client_name}
                </h1>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusMeta.badge}`}
              >
                <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                {appointment.status_display || statusMeta.label}
              </span>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            ) : null}

            <div className="mt-6 space-y-4 rounded-2xl border border-[#232730] bg-[#0B0D10] p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[#94A3B8]">
                  <User className="h-4 w-4 text-[#D97706]" />
                  Profissional
                </span>
                <span className="font-bold text-[#F8FAFC]">
                  {appointment.professional_name}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[#94A3B8]">
                  <Calendar className="h-4 w-4 text-[#D97706]" />
                  Data
                </span>
                <span className="font-bold text-[#F8FAFC]">
                  {formatDateBR(appointment.date)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[#94A3B8]">
                  <Clock className="h-4 w-4 text-[#D97706]" />
                  Horário
                </span>
                <span className="font-bold text-[#F59E0B]">
                  {String(appointment.start_time).slice(0, 5)} às{' '}
                  {String(appointment.end_time).slice(0, 5)} (
                  {appointment.total_duration_minutes} min)
                </span>
              </div>

              <div className="border-t border-[#232730] pt-3">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <Scissors className="h-3.5 w-3.5 text-[#D97706]" />
                  Serviços Contratados
                </span>
                <ul className="mt-2 space-y-1.5">
                  {(appointment.items || []).map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between text-[#F8FAFC]"
                    >
                      <span>{item.service_name}</span>
                      <span className="text-[#94A3B8]">
                        {formatCurrency(item.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {Number(appointment.discount_amount || 0) > 0 ? (
                <div className="space-y-1.5 border-t border-[#232730] pt-3 text-xs">
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(appointment.subtotal_price)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-400">
                    <span>
                      Cupom Aplicado ({appointment.coupon_code || 'PROMO'})
                    </span>
                    <span>-{formatCurrency(appointment.discount_amount)}</span>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-between border-t border-[#232730] pt-3 text-base font-extrabold">
                <span>Valor Total</span>
                <span className="text-[#F59E0B]">
                  {formatCurrency(appointment.total_price)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {canCancel ? (
                <>
                  <a
                    href={buildGoogleCalendarUrl({
                      title: `BarberPro — ${appointment.professional_name}`,
                      date: appointment.date,
                      startTime: appointment.start_time,
                      endTime: appointment.end_time,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#D97706] px-4 text-sm font-bold text-[#0B0D10] transition hover:bg-[#F59E0B]"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Google Agenda
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 text-sm font-bold text-rose-400 transition hover:bg-rose-500/20"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar Horário
                  </button>
                </>
              ) : (
                <Link
                  to="/agendar"
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#D97706] px-5 text-sm font-bold text-[#0B0D10] transition hover:bg-[#F59E0B]"
                >
                  Reservar Novo Horário
                </Link>
              )}
            </div>
          </motion.div>
        ) : null}
      </main>

      <ModalDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancelar este agendamento?"
        subtitle="O horário será imediatamente liberado na agenda do profissional."
      >
        <p className="text-sm text-[#94A3B8]">
          Tem certeza que deseja cancelar seu atendimento de{' '}
          <strong className="text-[#F8FAFC]">
            {formatDateBR(appointment?.date)} às{' '}
            {String(appointment?.start_time || '').slice(0, 5)}
          </strong>
          ?
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            onClick={() => setConfirmOpen(false)}
            className="min-h-[48px] rounded-xl border border-[#232730] bg-[#0B0D10] px-5 text-sm font-semibold text-[#F8FAFC] hover:border-[#D97706]/50"
          >
            Manter Horário
          </button>
          <button
            type="button"
            disabled={canceling}
            onClick={handleConfirmCancel}
            className="min-h-[48px] rounded-xl bg-rose-600 px-5 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {canceling ? 'Cancelando...' : 'Sim, Cancelar Agendamento'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
