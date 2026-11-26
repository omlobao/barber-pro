import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Phone,
  Play,
  Receipt,
  RefreshCw,
  UserX,
  XCircle,
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { OrderDrawer } from '@/components/admin/OrderDrawer';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  APPOINTMENT_STATUS_META,
  extractErrorMessage,
  formatCurrency,
  formatPhoneMask,
  toLocalISODate,
} from '@/utils/formatters';

export default function AdminAgendaPage() {
  const { isAdmin } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => toLocalISODate());
  const [selectedProfId, setSelectedProfId] = useState('');
  const [professionals, setProfessionals] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const [drawerOrderId, setDrawerOrderId] = useState(null);

  useEffect(() => {
    api
      .get('/api/admin/professionals/')
      .then(({ data }) => {
        setProfessionals(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setFeedback('');
    try {
      const params = { date: selectedDate };
      if (selectedProfId) params.professional_id = selectedProfId;
      const { data } = await api.get('/api/admin/appointments/', { params });
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
      setAppointments(list);
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao carregar agenda.'));
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedProfId]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleStatusPatch = async (appointmentId, newStatus) => {
    try {
      await api.patch(`/api/admin/appointments/${appointmentId}/`, {
        status: newStatus,
      });
      await loadAppointments();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Não foi possível alterar o status.'));
    }
  };

  const handleMarkNoShow = async (appointmentId) => {
    try {
      await api.post(`/api/admin/appointments/${appointmentId}/mark-no-show/`);
      await loadAppointments();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao registrar falta.'));
    }
  };

  const handleOpenOrder = async (appointmentId) => {
    try {
      const { data } = await api.post(
        `/api/admin/appointments/${appointmentId}/open-order/`
      );
      setDrawerOrderId(data.id);
      await loadAppointments();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao abrir comanda.'));
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Agenda do Dia
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Acompanhe os atendimentos em tempo real e abra comandas com 1 clique.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            aria-label="Filtrar por data"
            className="h-11 rounded-xl border border-[#232730] bg-[#14171D] px-3.5 text-sm text-[#F8FAFC] focus:border-[#D97706] focus:outline-none"
          />

          {isAdmin ? (
            <select
              value={selectedProfId}
              onChange={(e) => setSelectedProfId(e.target.value)}
              aria-label="Filtrar por profissional"
              className="h-11 rounded-xl border border-[#232730] bg-[#14171D] px-3.5 text-sm text-[#F8FAFC] focus:border-[#D97706] focus:outline-none"
            >
              <option value="">Todos os Barbeiros</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            onClick={loadAppointments}
            aria-label="Atualizar agenda"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#232730] bg-[#14171D] text-[#94A3B8] hover:border-[#D97706] hover:text-[#F8FAFC]"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          {feedback}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#232730] bg-[#14171D] p-12 text-center">
          <Calendar className="mx-auto h-10 w-10 text-[#94A3B8]" />
          <h2 className="mt-3 text-base font-bold text-[#F8FAFC]">
            Nenhum agendamento para esta data
          </h2>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Altere a data acima ou aguarde novos agendamentos online.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <AnimatePresence>
            {appointments.map((app) => {
              const meta =
                APPOINTMENT_STATUS_META[app.status] ||
                APPOINTMENT_STATUS_META.CONFIRMED;
              const isActive = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(
                app.status
              );

              return (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="flex flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B0D10] px-3 py-1.5 text-sm font-extrabold text-[#F59E0B] border border-[#232730]">
                          <Clock className="h-3.5 w-3.5" />
                          {String(app.start_time).slice(0, 5)} -{' '}
                          {String(app.end_time).slice(0, 5)}
                        </span>
                        <span className="text-xs font-medium text-[#94A3B8]">
                          {app.professional_name}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-4">
                      <h3 className="text-base font-bold text-[#F8FAFC]">
                        {app.client_name}
                      </h3>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
                        <Phone className="h-3 w-3 text-[#D97706]" />
                        {formatPhoneMask(app.client_phone)}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(app.items || []).map((it) => (
                        <span
                          key={it.id}
                          className="rounded-lg border border-[#232730] bg-[#0B0D10] px-2.5 py-1 text-xs text-[#94A3B8]"
                        >
                          {it.service_name}
                        </span>
                      ))}
                    </div>

                    {app.client_notes ? (
                      <p className="mt-2.5 rounded-xl bg-[#0B0D10]/70 px-3 py-2 text-xs italic text-[#94A3B8]">
                        “{app.client_notes}”
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#232730] pt-4">
                    <span className="text-base font-extrabold text-[#F59E0B]">
                      {formatCurrency(app.total_price)}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {app.status === 'CONFIRMED' ? (
                        <button
                          type="button"
                          onClick={() => handleStatusPatch(app.id, 'IN_PROGRESS')}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-500/15 px-3 text-xs font-bold text-purple-300 hover:bg-purple-500/25"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Iniciar
                        </button>
                      ) : null}

                      {isActive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMarkNoShow(app.id)}
                            title="Registrar falta sem aviso"
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-orange-500/30 bg-orange-500/10 px-2.5 text-xs font-semibold text-orange-400 hover:bg-orange-500/20"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Faltou
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusPatch(app.id, 'CANCELED')}
                            title="Cancelar horário"
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : null}

                      {app.status !== 'CANCELED' && app.status !== 'NO_SHOW' ? (
                        <button
                          type="button"
                          onClick={() =>
                            app.order_id
                              ? setDrawerOrderId(app.order_id)
                              : handleOpenOrder(app.id)
                          }
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#D97706] px-3.5 text-xs font-bold text-[#0B0D10] hover:bg-[#F59E0B]"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          {app.order_id ? 'Ver Comanda' : 'Abrir Comanda'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <OrderDrawer
        orderId={drawerOrderId}
        open={Boolean(drawerOrderId)}
        onClose={() => setDrawerOrderId(null)}
        onOrderUpdated={() => loadAppointments()}
      />
    </div>
  );
}
