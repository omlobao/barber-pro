import React, { useCallback, useEffect, useState } from 'react';
import { CalendarOff, Clock, Plus, Trash2 } from 'lucide-react';
import api from '@/api/client';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import {
  extractErrorMessage,
  formatDateBR,
  toLocalISODate,
} from '@/utils/formatters';

const DAYS_PT = {
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
  7: 'Domingo',
};

export default function AdminTeamPage() {
  const [professionals, setProfessionals] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [feedback, setFeedback] = useState('');

  const [editingProf, setEditingProf] = useState(null);
  const [hoursDraft, setHoursDraft] = useState([]);
  const [savingHours, setSavingHours] = useState(false);

  const [excModalOpen, setExcModalOpen] = useState(false);
  const [excProfId, setExcProfId] = useState('');
  const [excDate, setExcDate] = useState(() => toLocalISODate());
  const [excType, setExcType] = useState('BLOCK');
  const [excAllDay, setExcAllDay] = useState(true);
  const [excStart, setExcStart] = useState('14:00');
  const [excEnd, setExcEnd] = useState('17:00');
  const [excReason, setExcReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [profRes, excRes] = await Promise.all([
        api.get('/api/admin/professionals/'),
        api.get('/api/admin/schedule-exceptions/'),
      ]);
      setProfessionals(profRes.data || []);
      setExceptions(excRes.data || []);
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao carregar equipe.'));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openScheduleEditor = (prof) => {
    const existingMap = new Map(
      (prof.working_hours || []).map((wh) => [wh.day_of_week, wh])
    );
    const fullWeek = [1, 2, 3, 4, 5, 6, 7].map((day) => {
      const item = existingMap.get(day);
      return {
        day_of_week: day,
        is_working: item ? item.is_working : day !== 7,
        start_time: item?.start_time ? String(item.start_time).slice(0, 5) : '09:00',
        end_time: item?.end_time ? String(item.end_time).slice(0, 5) : '19:00',
        break_start: item?.break_start
          ? String(item.break_start).slice(0, 5)
          : '12:00',
        break_end: item?.break_end
          ? String(item.break_end).slice(0, 5)
          : '13:00',
      };
    });
    setHoursDraft(fullWeek);
    setEditingProf(prof);
  };

  const handleSaveHours = async (e) => {
    e.preventDefault();
    if (!editingProf) return;
    setSavingHours(true);
    setFeedback('');
    try {
      const payload = hoursDraft.map((d) => ({
        day_of_week: d.day_of_week,
        is_working: d.is_working,
        start_time: d.is_working ? d.start_time : null,
        end_time: d.is_working ? d.end_time : null,
        break_start: d.is_working && d.break_start ? d.break_start : null,
        break_end: d.is_working && d.break_end ? d.break_end : null,
      }));
      await api.put(
        `/api/admin/professionals/${editingProf.id}/working-hours/`,
        payload
      );
      setEditingProf(null);
      await loadData();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao atualizar expediente.'));
    } finally {
      setSavingHours(false);
    }
  };

  const handleCreateException = async (e) => {
    e.preventDefault();
    setFeedback('');
    try {
      await api.post('/api/admin/schedule-exceptions/', {
        professional: excProfId || null,
        date: excDate,
        exception_type: excType,
        is_all_day: excAllDay,
        start_time: excAllDay ? null : excStart,
        end_time: excAllDay ? null : excEnd,
        reason: excReason.trim(),
      });
      setExcModalOpen(false);
      setExcReason('');
      await loadData();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao cadastrar exceção.'));
    }
  };

  const handleDeleteException = async (id) => {
    try {
      await api.delete(`/api/admin/schedule-exceptions/${id}/`);
      await loadData();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao remover exceção.'));
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Equipe & Expediente
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Configure a grade semanal de cada barbeiro, folgas, férias e feriados.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExcModalOpen(true)}
          className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10]"
        >
          <Plus className="h-4 w-4" />
          Registrar Folga / Feriado
        </button>
      </div>

      {feedback ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          {feedback}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {professionals.map((p) => (
          <div
            key={p.id}
            className="flex flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  {p.display_name}
                </h3>
                <SpellBadge variant={p.is_active ? 'emerald' : 'rose'} size="sm">
                  {p.is_active ? 'Ativo' : 'Inativo'}
                </SpellBadge>
              </div>
              <p className="mt-2 text-xs text-[#94A3B8]">
                Comissão Serviço: <strong>{p.service_comission_rate}%</strong> •
                Produto: <strong>{p.product_comission_rate}%</strong>
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Intervalo: {p.slot_interval_minutes}m • Buffer:{' '}
                {p.buffer_time_minutes}m
              </p>
            </div>

            <button
              type="button"
              onClick={() => openScheduleEditor(p)}
              className="mt-5 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[#D97706]/50 bg-[#0B0D10] text-xs font-bold text-[#F59E0B] hover:bg-[#D97706] hover:text-[#0B0D10]"
            >
              <Clock className="h-3.5 w-3.5" />
              Editar Grade Semanal
            </button>
          </div>
        ))}
      </div>

      {/* Exceções e Feriados */}
      <div className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94A3B8]">
          Exceções de Agenda & Feriados ({exceptions.length})
        </h2>
        <div className="mt-3 space-y-2">
          {exceptions.slice(0, 12).map((ex) => (
            <div
              key={ex.id}
              className="flex items-center justify-between rounded-xl border border-[#232730] bg-[#14171D] px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <CalendarOff className="h-4 w-4 text-[#D97706]" />
                <div>
                  <p className="font-semibold text-[#F8FAFC]">
                    {formatDateBR(ex.date)} — {ex.reason || ex.exception_type}
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    {ex.professional_name || 'Barbearia Inteira (Geral)'} •{' '}
                    {ex.is_all_day
                      ? 'Dia Inteiro'
                      : `${String(ex.start_time).slice(0, 5)} às ${String(
                          ex.end_time
                        ).slice(0, 5)}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteException(ex.id)}
                aria-label="Remover exceção"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Grade Semanal */}
      <ModalDialog
        open={Boolean(editingProf)}
        onClose={() => setEditingProf(null)}
        title={`Expediente — ${editingProf?.display_name || ''}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveHours} className="space-y-3">
          {hoursDraft.map((row, idx) => (
            <div
              key={row.day_of_week}
              className="grid grid-cols-1 items-center gap-2 rounded-xl border border-[#232730] bg-[#0B0D10] p-3 sm:grid-cols-6"
            >
              <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2">
                <input
                  type="checkbox"
                  checked={row.is_working}
                  onChange={(e) => {
                    const next = [...hoursDraft];
                    next[idx] = { ...row, is_working: e.target.checked };
                    setHoursDraft(next);
                  }}
                />
                <span>{DAYS_PT[row.day_of_week]}</span>
              </label>
              {row.is_working ? (
                <>
                  <input
                    type="time"
                    value={row.start_time}
                    onChange={(e) => {
                      const next = [...hoursDraft];
                      next[idx] = { ...row, start_time: e.target.value };
                      setHoursDraft(next);
                    }}
                    className="h-9 rounded-lg border border-[#232730] bg-[#14171D] px-2 text-xs"
                  />
                  <input
                    type="time"
                    value={row.end_time}
                    onChange={(e) => {
                      const next = [...hoursDraft];
                      next[idx] = { ...row, end_time: e.target.value };
                      setHoursDraft(next);
                    }}
                    className="h-9 rounded-lg border border-[#232730] bg-[#14171D] px-2 text-xs"
                  />
                  <input
                    type="time"
                    value={row.break_start}
                    onChange={(e) => {
                      const next = [...hoursDraft];
                      next[idx] = { ...row, break_start: e.target.value };
                      setHoursDraft(next);
                    }}
                    className="h-9 rounded-lg border border-[#232730] bg-[#14171D] px-2 text-xs"
                  />
                  <input
                    type="time"
                    value={row.break_end}
                    onChange={(e) => {
                      const next = [...hoursDraft];
                      next[idx] = { ...row, break_end: e.target.value };
                      setHoursDraft(next);
                    }}
                    className="h-9 rounded-lg border border-[#232730] bg-[#14171D] px-2 text-xs"
                  />
                </>
              ) : (
                <span className="text-xs text-rose-400 sm:col-span-4">
                  Folga / Fechado
                </span>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setEditingProf(null)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingHours}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              {savingHours ? 'Salvando...' : 'Salvar Expediente'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal Nova Exceção */}
      <ModalDialog
        open={excModalOpen}
        onClose={() => setExcModalOpen(false)}
        title="Registrar Bloqueio, Férias ou Turno Extra"
      >
        <form onSubmit={handleCreateException} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="exc-prof"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Aplicar a
              </label>
              <select
                id="exc-prof"
                value={excProfId}
                onChange={(e) => setExcProfId(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              >
                <option value="">Barbearia Inteira (Geral)</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="exc-type"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Tipo
              </label>
              <select
                id="exc-type"
                value={excType}
                onChange={(e) => setExcType(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              >
                <option value="BLOCK">Bloqueio / Ausência</option>
                <option value="VACATION">Férias</option>
                <option value="HOLIDAY">Feriado</option>
                <option value="EXTRA_HOURS">Turno Extra</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label
                htmlFor="exc-date"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Data *
              </label>
              <input
                id="exc-date"
                type="date"
                required
                value={excDate}
                onChange={(e) => setExcDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold">
              <input
                type="checkbox"
                checked={excAllDay}
                onChange={(e) => setExcAllDay(e.target.checked)}
              />
              Dia inteiro
            </label>
          </div>

          {!excAllDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="exc-start"
                  className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                >
                  Início
                </label>
                <input
                  id="exc-start"
                  type="time"
                  value={excStart}
                  onChange={(e) => setExcStart(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
                />
              </div>
              <div>
                <label
                  htmlFor="exc-end"
                  className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                >
                  Fim
                </label>
                <input
                  id="exc-end"
                  type="time"
                  value={excEnd}
                  onChange={(e) => setExcEnd(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="exc-reason"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Motivo / Observação
            </label>
            <input
              id="exc-reason"
              type="text"
              placeholder="Ex.: Consulta médica"
              value={excReason}
              onChange={(e) => setExcReason(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setExcModalOpen(false)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              Salvar Exceção
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
