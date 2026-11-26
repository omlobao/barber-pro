import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  Edit3,
  MessageCircle,
  Plus,
  Search,
  UserCheck,
} from 'lucide-react';
import api from '@/api/client';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import {
  extractErrorMessage,
  formatDateBR,
  formatPhoneMask,
} from '@/utils/formatters';

export default function AdminClientsPage() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [onlyWithAccount, setOnlyWithAccount] = useState(false);
  const [feedback, setFeedback] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (onlyBlocked) params.is_blocked = 'true';
      const { data } = await api.get('/api/admin/clients/', { params });
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao buscar clientes.'));
    }
  }, [search, onlyBlocked]);

  useEffect(() => {
    const timer = setTimeout(loadClients, 220);
    return () => clearTimeout(timer);
  }, [loadClients]);

  const handleToggleBlock = async (clientId) => {
    try {
      await api.post(`/api/admin/clients/${clientId}/toggle-block/`);
      await loadClients();
    } catch (err) {
      setFeedback(extractErrorMessage(err, 'Erro ao alterar bloqueio.'));
    }
  };

  const openCreateModal = () => {
    setEditingClient(null);
    setName('');
    setPhone('');
    setEmail('');
    setBirthDate('');
    setNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (clientObj) => {
    setEditingClient(clientObj);
    setName(clientObj.name || '');
    setPhone(formatPhoneMask(clientObj.phone_number || ''));
    setEmail(clientObj.email || '');
    setBirthDate(clientObj.birth_date || '');
    setNotes(clientObj.notes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    setFeedback('');

    const payload = {
      name: name.trim(),
      phone_number: phone,
      email: email.trim() || null,
      birth_date: birthDate || null,
      notes: notes.trim(),
    };

    try {
      if (editingClient) {
        await api.patch(`/api/admin/clients/${editingClient.id}/`, payload);
      } else {
        await api.post('/api/admin/clients/', payload);
      }
      setModalOpen(false);
      await loadClients();
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Erro ao salvar cliente.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            Clientes (CRM)
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Histórico de fidelidade, dados cadastrais, faltas sem aviso e
            controle de bloqueio online.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10]"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {feedback ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          {feedback}
        </div>
      ) : null}

      <search className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="search"
            aria-label="Buscar clientes"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Buscar por nome, WhatsApp ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#232730] bg-[#14171D] pr-4 pl-10 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyWithAccount((prev) => !prev)}
          className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 text-xs font-bold ${
            onlyWithAccount
              ? 'border-[#D97706] bg-[#D97706]/15 text-[#F59E0B]'
              : 'border-[#232730] bg-[#14171D] text-[#94A3B8]'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Com Conta Online
        </button>
        <button
          type="button"
          onClick={() => setOnlyBlocked((prev) => !prev)}
          className={`min-h-[44px] rounded-xl border px-4 text-xs font-bold ${
            onlyBlocked
              ? 'border-rose-500 bg-rose-500/15 text-rose-400'
              : 'border-[#232730] bg-[#14171D] text-[#94A3B8]'
          }`}
        >
          Apenas Bloqueados
        </button>
      </search>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(onlyWithAccount
          ? clients.filter((item) => item.has_account)
          : clients
        ).map((c) => (
          <div
            key={c.id}
            className="flex flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-[#F8FAFC]">{c.name}</h3>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {c.has_account ? (
                    <SpellBadge variant="amber" size="sm">
                      CONTA ONLINE
                    </SpellBadge>
                  ) : null}
                  {c.is_blocked ? (
                    <SpellBadge variant="rose" size="sm">
                      BLOQUEADO
                    </SpellBadge>
                  ) : (
                    <SpellBadge variant="emerald" size="sm">
                      ATIVO
                    </SpellBadge>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                {formatPhoneMask(c.phone_number)}
                {c.email ? ` • ${c.email}` : ''}
              </p>
              {c.birth_date ? (
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Aniversário: {formatDateBR(c.birth_date)}
                </p>
              ) : null}
              {c.notes ? (
                <p className="mt-2 rounded-lg bg-[#0B0D10] px-2.5 py-1.5 text-xs text-[#94A3B8]">
                  {c.notes}
                </p>
              ) : null}
            </div>

            <div className="mt-5 space-y-3 border-t border-[#232730] pt-3">
              <div className="text-xs text-[#94A3B8]">
                Visitas:{' '}
                <strong className="text-[#F8FAFC]">{c.total_visits}</strong> •
                Faltas:{' '}
                <strong
                  className={
                    c.no_show_count > 0 ? 'text-orange-400' : 'text-[#F8FAFC]'
                  }
                >
                  {c.no_show_count}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/admin/whatsapp?phone=${encodeURIComponent(
                    c.phone_number
                  )}&name=${encodeURIComponent(c.name)}`}
                  className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D97706]/40 bg-[#D97706]/10 px-3 text-xs font-bold text-[#F59E0B] hover:bg-[#D97706]/20"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </Link>

                <button
                  type="button"
                  onClick={() => openEditModal(c)}
                  className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-bold text-[#F8FAFC] hover:border-[#D97706]/50"
                >
                  <Edit3 className="h-3.5 w-3.5 text-[#D97706]" />
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleBlock(c.id)}
                  className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                    c.is_blocked
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {c.is_blocked ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Desbloquear
                    </>
                  ) : (
                    <>
                      <Ban className="h-3.5 w-3.5" />
                      Bloquear
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingClient
            ? `Editar Cliente — ${editingClient.name}`
            : 'Cadastrar Novo Cliente'
        }
      >
        <form onSubmit={handleSaveClient} className="space-y-4">
          {formError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-medium text-rose-300"
            >
              {formError}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="cli-name"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Nome Completo *
            </label>
            <input
              id="cli-name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cli-phone"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                WhatsApp com DDD *
              </label>
              <input
                id="cli-phone"
                type="tel"
                inputMode="tel"
                required
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label
                htmlFor="cli-birth"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Data de Nascimento
              </label>
              <input
                id="cli-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="cli-email"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              E-mail
            </label>
            <input
              id="cli-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            />
          </div>
          <div>
            <label
              htmlFor="cli-notes"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Observações Internas (preferências de corte, etc.)
            </label>
            <textarea
              id="cli-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-[#232730] bg-[#0B0D10] p-3 text-sm text-[#F8FAFC]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              {saving
                ? 'Salvando...'
                : editingClient
                ? 'Salvar Alterações'
                : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
