import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarOff,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import {
  extractErrorMessage,
  formatDateBR,
  formatPhoneMask,
  resolveMediaUrl,
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

const EMPTY_EMP_FORM = {
  display_name: '',
  phone_number: '',
  username: '',
  email: '',
  password: '',
  bio: '',
  service_comission_rate: '50.00',
  product_comission_rate: '10.00',
  slot_interval_minutes: 30,
  buffer_time_minutes: 0,
  services: [],
  is_active: true,
};

export default function AdminTeamPage() {
  const { isAdmin } = useAuth();
  const [professionals, setProfessionals] = useState([]);
  const [servicesCatalog, setServicesCatalog] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [feedback, setFeedback] = useState('');

  // Modal Criar / Editar Funcionário (Barbeiro)
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [empForm, setEmpForm] = useState(EMPTY_EMP_FORM);
  const [empPhotoFile, setEmpPhotoFile] = useState(null);
  const [empPhotoPreview, setEmpPhotoPreview] = useState('');
  const [empRemovePhoto, setEmpRemovePhoto] = useState(false);
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [savingEmp, setSavingEmp] = useState(false);
  const [empFormError, setEmpFormError] = useState('');

  // Modal Grade Semanal
  const [editingProf, setEditingProf] = useState(null);
  const [hoursDraft, setHoursDraft] = useState([]);
  const [savingHours, setSavingHours] = useState(false);

  // Modal Nova Exceção
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
      const [profRes, excRes, srvRes] = await Promise.all([
        api.get('/api/admin/professionals/'),
        api.get('/api/admin/schedule-exceptions/'),
        api.get('/api/admin/services/'),
      ]);
      setProfessionals(profRes.data || []);
      setExceptions(excRes.data || []);
      setServicesCatalog((srvRes.data || []).filter((s) => s.is_active));
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao carregar equipe.'));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openNewEmployeeModal = () => {
    setEditingMember(null);
    setEmpFormError('');
    setShowEmpPassword(false);
    setEmpPhotoFile(null);
    setEmpPhotoPreview('');
    setEmpRemovePhoto(false);
    setEmpForm({
      ...EMPTY_EMP_FORM,
      services: servicesCatalog.map((s) => s.id),
    });
    setEmpModalOpen(true);
  };

  const openEditEmployeeModal = (prof) => {
    setEditingMember(prof);
    setEmpFormError('');
    setShowEmpPassword(false);
    setEmpPhotoFile(null);
    setEmpPhotoPreview(
      prof.profile_picture ? resolveMediaUrl(prof.profile_picture) : ''
    );
    setEmpRemovePhoto(false);
    setEmpForm({
      display_name: prof.display_name || '',
      phone_number: formatPhoneMask(prof.phone_number || ''),
      username: prof.username || '',
      email: prof.email || '',
      password: '',
      bio: prof.bio || '',
      service_comission_rate: String(prof.service_comission_rate ?? '50.00'),
      product_comission_rate: String(prof.product_comission_rate ?? '10.00'),
      slot_interval_minutes: Number(prof.slot_interval_minutes || 30),
      buffer_time_minutes: Number(prof.buffer_time_minutes || 0),
      services: (prof.services || []).map(String),
      is_active: Boolean(prof.is_active),
    });
    setEmpModalOpen(true);
  };

  const handleEmpPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEmpPhotoFile(file);
    setEmpRemovePhoto(false);
    setEmpPhotoPreview(URL.createObjectURL(file));
  };

  const handleClearEmpPhoto = () => {
    setEmpPhotoFile(null);
    setEmpPhotoPreview('');
    setEmpRemovePhoto(true);
  };

  const toggleServiceInForm = (serviceId) => {
    const idStr = String(serviceId);
    setEmpForm((prev) => {
      const exists = prev.services.includes(idStr);
      return {
        ...prev,
        services: exists
          ? prev.services.filter((item) => item !== idStr)
          : [...prev.services, idStr],
      };
    });
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setSavingEmp(true);
    setEmpFormError('');
    setFeedback('');

    const fd = new FormData();
    fd.append('display_name', empForm.display_name.trim());
    fd.append('phone_number', empForm.phone_number);
    fd.append('username', empForm.username.trim().toLowerCase());
    fd.append('email', empForm.email.trim() || '');
    fd.append('bio', empForm.bio.trim());
    fd.append(
      'service_comission_rate',
      Number(empForm.service_comission_rate || 0).toFixed(2)
    );
    fd.append(
      'product_comission_rate',
      Number(empForm.product_comission_rate || 0).toFixed(2)
    );
    fd.append(
      'slot_interval_minutes',
      String(Number(empForm.slot_interval_minutes) || 30)
    );
    fd.append(
      'buffer_time_minutes',
      String(Number(empForm.buffer_time_minutes) || 0)
    );
    fd.append('is_active', empForm.is_active ? 'true' : 'false');

    if (empForm.services.length > 0) {
      empForm.services.forEach((id) => fd.append('services', String(id)));
    } else {
      fd.append('clear_services', 'true');
    }

    if (empForm.password.trim()) {
      fd.append('password', empForm.password.trim());
    }
    if (empPhotoFile) {
      fd.append('profile_picture', empPhotoFile);
    } else if (empRemovePhoto) {
      fd.append('remove_image', 'true');
    }

    try {
      if (editingMember) {
        await api.patch(`/api/admin/professionals/${editingMember.id}/`, fd);
      } else {
        await api.post('/api/admin/professionals/', fd);
      }
      setEmpModalOpen(false);
      await loadData();
    } catch (err) {
      setEmpFormError(
        extractErrorMessage(err, 'Não foi possível salvar o funcionário.')
      );
    } finally {
      setSavingEmp(false);
    }
  };

  const handleToggleActive = async (prof) => {
    setFeedback('');
    try {
      await api.patch(`/api/admin/professionals/${prof.id}/`, {
        is_active: !prof.is_active,
      });
      await loadData();
    } catch (err) {
      setFeedback(
        extractErrorMessage(err, 'Não foi possível alterar o status.')
      );
    }
  };

  const openScheduleEditor = (prof) => {
    const existingMap = new Map(
      (prof.working_hours || []).map((wh) => [wh.day_of_week, wh])
    );
    const fullWeek = [1, 2, 3, 4, 5, 6, 7].map((day) => {
      const item = existingMap.get(day);
      return {
        day_of_week: day,
        is_working: item ? item.is_working : day !== 7,
        start_time: item?.start_time
          ? String(item.start_time).slice(0, 5)
          : '09:00',
        end_time: item?.end_time
          ? String(item.end_time).slice(0, 5)
          : '19:00',
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
            Equipe &amp; Expediente
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Cadastre novos barbeiros, gerencie comissões, grade semanal e folgas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin ? (
            <button
              type="button"
              onClick={openNewEmployeeModal}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 transition hover:bg-[#F59E0B]"
            >
              <UserPlus className="h-4 w-4" />
              Novo Funcionário
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setExcModalOpen(true)}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#232730] bg-[#14171D] px-4 text-xs font-bold text-[#F8FAFC] transition hover:border-[#D97706]/50"
          >
            <Plus className="h-4 w-4 text-[#D97706]" />
            Registrar Folga / Feriado
          </button>
        </div>
      </div>

      {feedback ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          {feedback}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {professionals.map((p) => (
          <div
            key={p.id}
            className="flex flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  {p.profile_picture ? (
                    <img
                      src={resolveMediaUrl(p.profile_picture)}
                      alt={p.display_name}
                      className="h-12 w-12 shrink-0 rounded-xl border border-[#D97706]/40 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#232730] bg-[#0B0D10] font-display text-sm font-bold text-[#F59E0B]">
                      {p.display_name
                        .split(' ')
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join('')}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-[#F8FAFC]">
                      {p.display_name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#94A3B8]">
                      Usuário:{' '}
                      <strong className="font-mono text-[#F59E0B]">
                        @{p.username}
                      </strong>{' '}
                      • {formatPhoneMask(p.phone_number)}
                    </p>
                  </div>
                </div>
                <SpellBadge variant={p.is_active ? 'emerald' : 'rose'} size="sm">
                  {p.is_active ? 'Ativo' : 'Inativo'}
                </SpellBadge>
              </div>

              {p.bio ? (
                <p className="mt-2.5 line-clamp-2 text-xs text-[#94A3B8]">
                  {p.bio}
                </p>
              ) : null}

              <div className="mt-3 space-y-1 rounded-xl border border-[#232730] bg-[#0B0D10] p-3 text-xs text-[#94A3B8]">
                <div className="flex justify-between">
                  <span>Comissões:</span>
                  <strong className="text-[#F8FAFC]">
                    {p.service_comission_rate}% serv. /{' '}
                    {p.product_comission_rate}% prod.
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Agenda:</span>
                  <strong className="text-[#F8FAFC]">
                    {p.slot_interval_minutes}m (buffer {p.buffer_time_minutes}m)
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Serviços habilitados:</span>
                  <strong className="text-[#F59E0B]">
                    {(p.services || []).length} serviço(s)
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => openScheduleEditor(p)}
                className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[#D97706]/50 bg-[#0B0D10] text-xs font-bold text-[#F59E0B] transition hover:bg-[#D97706] hover:text-[#0B0D10]"
              >
                <Clock className="h-3.5 w-3.5" />
                Editar Grade Semanal
              </button>

              {isAdmin ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openEditEmployeeModal(p)}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold text-[#F8FAFC] hover:border-[#D97706]/40"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#D97706]" />
                    Editar Dados
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(p)}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    {p.is_active ? (
                      <>
                        <PauseCircle className="h-3.5 w-3.5 text-amber-400" />
                        Inativar
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-3.5 w-3.5 text-emerald-400" />
                        Reativar
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Exceções e Feriados */}
      <div className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94A3B8]">
          Exceções de Agenda &amp; Feriados ({exceptions.length})
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

      {/* Modal Criar / Editar Funcionário */}
      <ModalDialog
        open={empModalOpen}
        onClose={() => setEmpModalOpen(false)}
        title={
          editingMember
            ? `Editar Funcionário — ${editingMember.display_name}`
            : 'Cadastrar Novo Funcionário / Barbeiro'
        }
        subtitle={
          editingMember
            ? 'Atualize comissões, serviços habilitados ou credenciais de acesso.'
            : 'Cria o acesso ao painel e já configura o expediente padrão (Seg a Sáb, 09h às 19h).'
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveEmployee} className="space-y-4">
          {empFormError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-medium text-rose-300"
            >
              {empFormError}
            </div>
          ) : null}

          {/* Upload de Foto do Barbeiro (Reflete na Landing Page e no Agendamento) */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#232730] bg-[#0B0D10] p-3.5 sm:flex-row sm:items-center">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#232730] bg-[#14171D]">
              {empPhotoPreview ? (
                <img
                  src={empPhotoPreview}
                  alt="Preview do profissional"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#94A3B8]">
                  <ImagePlus className="h-6 w-6" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <label
                htmlFor="emp-photo"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Foto do Profissional (atualiza na Landing Page e no Agendamento)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="emp-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleEmpPhotoChange}
                  className="block max-w-full text-xs text-[#94A3B8] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#D97706] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#0B0D10] hover:file:bg-[#F59E0B]"
                />
                {empPhotoPreview ? (
                  <button
                    type="button"
                    onClick={handleClearEmpPhoto}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-500/20"
                  >
                    <X className="h-3 w-3" />
                    Remover foto
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="emp-name"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Nome Completo / Artístico *
              </label>
              <input
                id="emp-name"
                required
                placeholder="Ex.: Jhonas Rex"
                value={empForm.display_name}
                onChange={(e) =>
                  setEmpForm((prev) => ({
                    ...prev,
                    display_name: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-phone"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                WhatsApp com DDD *
              </label>
              <input
                id="emp-phone"
                type="tel"
                inputMode="tel"
                required
                placeholder="(61) 99999-9999"
                value={empForm.phone_number}
                onChange={(e) =>
                  setEmpForm((prev) => ({
                    ...prev,
                    phone_number: formatPhoneMask(e.target.value),
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="emp-username"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Usuário de Login *
              </label>
              <input
                id="emp-username"
                required
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Ex.: jhonas"
                value={empForm.username}
                onChange={(e) =>
                  setEmpForm((prev) => ({
                    ...prev,
                    username: e.target.value.toLowerCase().replace(/\s+/g, ''),
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 font-mono text-sm text-[#F8FAFC]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-email"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                E-mail (opcional)
              </label>
              <input
                id="emp-email"
                type="email"
                placeholder="jhonas@barbearia.com"
                value={empForm.email}
                onChange={(e) =>
                  setEmpForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-password"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                {editingMember ? 'Nova Senha (opcional)' : 'Senha Inicial *'}
              </label>
              <div className="relative">
                <input
                  id="emp-password"
                  type={showEmpPassword ? 'text' : 'password'}
                  required={!editingMember}
                  minLength={6}
                  autoComplete="new-password"
                  placeholder={editingMember ? 'Manter atual' : 'Mín. 6 caract.'}
                  value={empForm.password}
                  onChange={(e) =>
                    setEmpForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-10 pl-3 text-sm text-[#F8FAFC]"
                />
                <button
                  type="button"
                  onClick={() => setShowEmpPassword((prev) => !prev)}
                  aria-label={showEmpPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  {showEmpPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label
                htmlFor="emp-srv-comm"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Comissão Serv. (%)
              </label>
              <input
                id="emp-srv-comm"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={empForm.service_comission_rate}
                onChange={(e) =>
                  setEmpForm((prev) => ({
                    ...prev,
                    service_comission_rate: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-prod-comm"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Comissão Prod. (%)
              </label>
              <input
                id="emp-prod-comm"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={empForm.product_comission_rate}
                onChange={(e) =>
                  setEmpForm((prev) => ({
                    ...prev,
                    product_comission_rate: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-interval"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Intervalo (min)
              </label>
              <input
                id="emp-interval"
                type="number"
                min="10"
                max="120"
                step="5"
                value={empForm.slot_interval_minutes}
                onChange={(e) =>
                  setEmpForm((prev) => ({
                    ...prev,
                    slot_interval_minutes: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>

            <div>
              <label
                htmlFor="emp-buffer"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Buffer Limpeza (m)
              </label>
              <input
                id="emp-buffer"
                type="number"
                min="0"
                max="60"
                step="5"
                value={empForm.buffer_time_minutes}
                onChange={(e) =>
                  setEmpForm((prev) => ({
                    ...prev,
                    buffer_time_minutes: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="emp-bio"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Biografia / Especialidades (exibida na vitrine)
            </label>
            <textarea
              id="emp-bio"
              rows={2}
              placeholder="Ex.: Master Barber especialista em degradê navalhado e vapor de ozônio."
              value={empForm.bio}
              onChange={(e) =>
                setEmpForm((prev) => ({ ...prev, bio: e.target.value }))
              }
              className="w-full rounded-xl border border-[#232730] bg-[#0B0D10] p-3 text-sm text-[#F8FAFC]"
            />
          </div>

          <fieldset className="rounded-xl border border-[#232730] bg-[#0B0D10] p-3.5">
            <legend className="px-1 text-xs font-semibold text-[#F8FAFC]">
              Serviços que este profissional realiza ({empForm.services.length})
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {servicesCatalog.map((srv) => {
                const checked = empForm.services.includes(String(srv.id));
                return (
                  <div key={srv.id} className="flex items-center gap-2">
                    <input
                      id={`emp-srv-${srv.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleServiceInForm(srv.id)}
                      className="h-4 w-4 accent-[#D97706]"
                    />
                    <label
                      htmlFor={`emp-srv-${srv.id}`}
                      className="text-xs text-[#CBD5E1]"
                    >
                      {srv.name}
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEmpModalOpen(false)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs font-semibold text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEmp}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              {savingEmp
                ? 'Salvando...'
                : editingMember
                ? 'Salvar Alterações'
                : 'Cadastrar Funcionário'}
            </button>
          </div>
        </form>
      </ModalDialog>

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

          <div className="grid grid-cols-2 items-end gap-3">
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
