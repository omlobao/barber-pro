import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Headphones,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import api from '@/api/client';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import { extractErrorMessage, formatPhoneMask } from '@/utils/formatters';

const COLUMNS = [
  { id: 'new', title: 'Novo Contato', badge: 'amber' },
  { id: 'interested', title: 'Interessado', badge: 'sky' },
  { id: 'scheduled', title: 'Agendado', badge: 'emerald' },
  { id: 'vip', title: 'Recorrente / VIP', badge: 'amber' },
  { id: 'reactivation', title: 'Em Reativação', badge: 'rose' },
  { id: 'lost', title: 'Perdido', badge: 'neutral' },
];

export function WhatsAppFunnelTab({ onOpenConversation, onStatsChange }) {
  const [queue, setQueue] = useState([]);
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    stage: 'new',
    interest: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const [queueRes, leadsRes] = await Promise.all([
        api.get('/api/admin/whatsapp/queue/'),
        api.get('/api/admin/whatsapp/leads/', { params }),
      ]);
      setQueue(Array.isArray(queueRes.data) ? queueRes.data : []);
      setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao carregar funil e fila.'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = window.setTimeout(loadData, 180);
    return () => window.clearTimeout(t);
  }, [loadData]);

  const handleQueueAction = async (entryId, actionName, convId) => {
    try {
      await api.post(`/api/admin/whatsapp/queue/${entryId}/${actionName}/`);
      await loadData();
      onStatsChange?.();
      if (actionName === 'claim' && convId) {
        onOpenConversation(convId);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao atualizar fila humana.'));
    }
  };

  const handleMoveStage = async (leadId, stage) => {
    try {
      const { data } = await api.patch(`/api/admin/whatsapp/leads/${leadId}/`, {
        stage,
      });
      setLeads((curr) => curr.map((l) => (l.id === leadId ? data : l)));
      onStatsChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao mover etapa do lead.'));
    }
  };

  const handleDeleteLead = async (leadId) => {
    try {
      await api.delete(`/api/admin/whatsapp/leads/${leadId}/`);
      setLeads((curr) => curr.filter((l) => l.id !== leadId));
      onStatsChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao remover lead.'));
    }
  };

  const handleOpenLeadChat = async (lead) => {
    try {
      const { data } = await api.post(
        '/api/admin/whatsapp/conversations/start/',
        {
          phone: lead.phone,
          contact_name: lead.name,
        }
      );
      onOpenConversation(data.id);
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao abrir conversa do lead.'));
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/api/admin/whatsapp/leads/', {
        ...form,
        source: 'painel',
      });
      setLeads((curr) => [data, ...curr]);
      setModalOpen(false);
      setForm({ name: '', phone: '', stage: 'new', interest: '', notes: '' });
      onStatsChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao criar lead.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          {error}
        </div>
      ) : null}

      {/* Fila de Atendimento Humano */}
      <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Headphones className="h-5 w-5 text-[#D97706]" />
            <div>
              <h3 className="font-display text-base font-bold text-[#F8FAFC]">
                Fila de Atendimento Humano ({queue.length})
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Clientes que pediram para falar diretamente com a recepção ou
                barbeiro no WhatsApp.
              </p>
            </div>
          </div>
        </div>

        {queue.length === 0 ? (
          <p className="mt-4 rounded-xl border border-[#232730] bg-[#0B0D10] p-4 text-xs text-[#94A3B8]">
            Nenhum cliente aguardando atendimento humano no momento. O bot está
            respondendo normalmente!
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {queue.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col justify-between rounded-xl border border-[#232730] bg-[#0B0D10] p-4 space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm font-bold text-[#F8FAFC]">
                      {entry.contact_name || entry.phone}
                    </strong>
                    <SpellBadge
                      variant={entry.status === 'waiting' ? 'amber' : 'sky'}
                      size="sm"
                    >
                      {entry.status === 'waiting'
                        ? 'AGUARDANDO'
                        : `COM ${entry.assigned_to_name || 'EQUIPE'}`}
                    </SpellBadge>
                  </div>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">+{entry.phone}</p>
                  {entry.reason ? (
                    <p className="mt-2 text-xs text-[#94A3B8]">
                      &ldquo;{entry.reason}&rdquo;
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleQueueAction(entry.id, 'claim', entry.conversation_id)
                    }
                    className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D97706] px-3 text-xs font-bold text-[#0B0D10]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Assumir Chat
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQueueAction(entry.id, 'close', entry.conversation_id)
                    }
                    className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-300"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Concluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra de Busca + Novo Lead */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar leads por nome, WhatsApp ou serviço de interesse..."
            aria-label="Filtrar leads"
            className="h-11 w-full rounded-xl border border-[#232730] bg-[#14171D] pr-4 pl-10 text-xs text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:border-[#D97706] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10]"
        >
          <Plus className="h-4 w-4" />
          Novo Lead CRM
        </button>
      </div>

      {/* Kanban de Leads */}
      {loading ? (
        <p className="py-10 text-center text-xs text-[#94A3B8]">
          Carregando funil comercial...
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {COLUMNS.map((col) => {
            const colLeads = leads.filter((l) => l.stage === col.id);
            return (
              <div
                key={col.id}
                className="flex flex-col rounded-2xl border border-[#232730] bg-[#14171D] p-4"
              >
                <div className="mb-3 flex items-center justify-between border-b border-[#232730] pb-2.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#F8FAFC]">
                    {col.title}
                  </h4>
                  <SpellBadge variant={col.badge} size="sm">
                    {colLeads.length}
                  </SpellBadge>
                </div>

                <div className="space-y-3">
                  {colLeads.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-[#94A3B8]/60">
                      Sem contatos nesta etapa
                    </p>
                  ) : (
                    colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="rounded-xl border border-[#232730] bg-[#0B0D10] p-3.5 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <strong className="block text-xs font-bold text-[#F8FAFC]">
                              {lead.name || 'Contato WhatsApp'}
                            </strong>
                            <span className="text-[11px] text-[#94A3B8]">
                              +{lead.phone}
                            </span>
                          </div>
                          {lead.client_visits > 0 ? (
                            <span className="rounded bg-[#D97706]/15 px-2 py-0.5 text-[10px] font-bold text-[#E5A93C]">
                              {lead.client_visits} visitas
                            </span>
                          ) : null}
                        </div>

                        {lead.interest ? (
                          <p className="text-[11px] font-medium text-[#E5A93C]">
                            ✂️ {lead.interest}
                          </p>
                        ) : null}

                        {lead.latest_message ? (
                          <p className="line-clamp-2 rounded-lg bg-[#14171D] px-2.5 py-1.5 text-[11px] text-[#94A3B8]">
                            &ldquo;{lead.latest_message}&rdquo;
                          </p>
                        ) : null}

                        <div className="flex items-center gap-2 pt-1">
                          <label
                            htmlFor={`lead-stage-${lead.id}`}
                            className="sr-only"
                          >
                            Mover etapa
                          </label>
                          <select
                            id={`lead-stage-${lead.id}`}
                            value={lead.stage}
                            onChange={(e) =>
                              handleMoveStage(lead.id, e.target.value)
                            }
                            className="h-8 flex-1 rounded-lg border border-[#232730] bg-[#14171D] px-2 text-[11px] font-semibold text-[#F8FAFC]"
                          >
                            {COLUMNS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.title}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleOpenLeadChat(lead)}
                            title="Abrir conversa no painel"
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#D97706] px-2.5 text-[11px] font-bold text-[#0B0D10]"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Chat
                          </button>

                          <a
                            href={`https://wa.me/${lead.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir no WhatsApp externo"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#232730] bg-[#14171D] text-[#94A3B8] hover:text-[#F8FAFC]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead.id)}
                            title="Remover lead"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Adicionar Lead ao Funil CRM"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="lead-name"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Nome do Contato *
              </label>
              <input
                id="lead-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label
                htmlFor="lead-phone"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                WhatsApp com DDD *
              </label>
              <input
                id="lead-phone"
                type="tel"
                required
                placeholder="(11) 99999-9999"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: formatPhoneMask(e.target.value) })
                }
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="lead-stage"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Etapa Inicial
              </label>
              <select
                id="lead-stage"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="lead-interest"
                className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
              >
                Serviço de Interesse
              </label>
              <input
                id="lead-interest"
                placeholder="Ex.: Combo VIP, Degradê"
                value={form.interest}
                onChange={(e) => setForm({ ...form, interest: e.target.value })}
                className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="lead-notes"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Observações Comerciais
            </label>
            <textarea
              id="lead-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              {saving ? 'Salvando...' : 'Salvar Lead'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
