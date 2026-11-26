import React, { useCallback, useEffect, useState } from 'react';
import {
  ExternalLink,
  Megaphone,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import { extractErrorMessage, formatDateBR } from '@/utils/formatters';

const AUDIENCE_OPTIONS = [
  { value: 'all_opt_in', label: 'Todos os clientes com opt-in ativo' },
  { value: 'inactive_30d', label: 'Clientes sem visita há 30+ dias (Reativação)' },
  { value: 'vip_clients', label: 'Clientes VIP / Recorrentes (3+ visitas)' },
  { value: 'first_visit', label: 'Cadastrados que ainda não fizeram 1ª visita' },
];

export function WhatsAppCampaignsTab({ onOpenConversation, onStatsChange }) {
  const { isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [targets, setTargets] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [confirmCampaign, setConfirmCampaign] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [form, setForm] = useState({
    title: '',
    audience: 'all_opt_in',
    coupon: '',
    message:
      'Fala, {nome}! 💈 Liberamos o cupom *{cupom}* para você garantir seu corte na semana sem fila: {link}',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, targRes, coupRes] = await Promise.all([
        api.get('/api/admin/whatsapp/campaigns/'),
        api.get('/api/admin/whatsapp/reactivation-targets/'),
        api.get('/api/admin/coupons/'),
      ]);
      setCampaigns(Array.isArray(campRes.data) ? campRes.data : []);
      setTargets(targRes.data?.targets || []);
      setCoupons(
        (Array.isArray(coupRes.data) ? coupRes.data : []).filter(
          (c) => c.is_active
        )
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao carregar campanhas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const insertToken = (token) => {
    setForm((curr) => ({ ...curr, message: `${curr.message} ${token}`.trim() }));
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const payload = {
        title: form.title.trim(),
        audience: form.audience,
        coupon: form.coupon || null,
        message: form.message.trim(),
      };
      const { data } = await api.post('/api/admin/whatsapp/campaigns/', payload);
      setCampaigns((curr) => [data, ...curr]);
      setForm((curr) => ({ ...curr, title: '' }));
      setFeedback('Rascunho de campanha criado! Clique em Disparar para enviar.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao salvar campanha.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!confirmCampaign) return;
    setSendingId(confirmCampaign.id);
    setError('');
    setFeedback('');
    try {
      const { data } = await api.post(
        `/api/admin/whatsapp/campaigns/${confirmCampaign.id}/send/`
      );
      setCampaigns((curr) =>
        curr.map((c) => (c.id === confirmCampaign.id ? data.campaign : c))
      );
      setConfirmCampaign(null);
      const modeLabel = data.simulated
        ? 'registrada no histórico local (Evolution não conectado)'
        : 'enviada via Evolution GO';
      setFeedback(
        `Campanha ${modeLabel} para ${data.campaign.recipients_count} cliente(s)!`
      );
      onStatsChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao disparar campanha.'));
      setConfirmCampaign(null);
    } finally {
      setSendingId(null);
    }
  };

  const handleSendReactivationInPanel = async (target) => {
    try {
      const { data: conv } = await api.post(
        '/api/admin/whatsapp/conversations/start/',
        {
          phone: target.phone,
          contact_name: target.name,
        }
      );
      await api.post(`/api/admin/whatsapp/conversations/${conv.id}/send/`, {
        text: target.suggested_message,
      });
      onOpenConversation(conv.id);
    } catch (err) {
      setError(
        extractErrorMessage(err, 'Não foi possível enviar convite pelo painel.')
      );
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

      {feedback ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300"
        >
          {feedback}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Criador de Campanha */}
        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5 lg:col-span-5">
          <div className="flex items-center gap-2.5">
            <Megaphone className="h-5 w-5 text-[#D97706]" />
            <div>
              <h3 className="font-display text-base font-bold text-[#F8FAFC]">
                Nova Campanha Promocional
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Até 100 destinatários por lote com consentimento (opt-in).
              </p>
            </div>
          </div>

          {!isAdmin ? (
            <p className="mt-4 rounded-xl border border-[#232730] bg-[#0B0D10] p-4 text-xs text-[#94A3B8]">
              Apenas o administrador da barbearia pode criar e disparar lotes
              promocionais em massa. Você ainda pode usar a Reativação 1-Clique
              abaixo!
            </p>
          ) : (
            <form onSubmit={handleCreateCampaign} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="camp-title"
                  className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                >
                  Título da Campanha *
                </label>
                <input
                  id="camp-title"
                  required
                  placeholder="Ex.: Terça do Degradê + Barba"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="camp-audience"
                    className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                  >
                    Público-alvo
                  </label>
                  <select
                    id="camp-audience"
                    value={form.audience}
                    onChange={(e) =>
                      setForm({ ...form, audience: e.target.value })
                    }
                    className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                  >
                    {AUDIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="camp-coupon"
                    className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                  >
                    Cupom Vinculado
                  </label>
                  <select
                    id="camp-coupon"
                    value={form.coupon}
                    onChange={(e) =>
                      setForm({ ...form, coupon: e.target.value })
                    }
                    className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                  >
                    <option value="">Sem cupom específico</option>
                    {coupons.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.code} ({cp.description || 'Ativo'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="camp-msg"
                    className="text-xs font-semibold text-[#F8FAFC]"
                  >
                    Mensagem Personalizada *
                  </label>
                  <div className="flex gap-1">
                    {['{nome}', '{cupom}', '{link}'].map((tok) => (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => insertToken(tok)}
                        className="rounded border border-[#232730] bg-[#0B0D10] px-2 py-0.5 text-[10px] font-bold text-[#E5A93C] hover:border-[#D97706]"
                      >
                        {tok}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  id="camp-msg"
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full rounded-xl border border-[#232730] bg-[#0B0D10] p-3 text-xs text-[#F8FAFC]"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10]"
              >
                <Ticket className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar Rascunho de Campanha'}
              </button>
            </form>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3 text-[11px] text-emerald-200/90">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              Conformidade LGPD & Anti-Spam: clientes bloqueados ou que enviaram{' '}
              <strong>SAIR</strong> / <strong>PARAR</strong> nunca recebem
              disparos promocionais.
            </span>
          </div>
        </div>

        {/* Lista de Campanhas */}
        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5 lg:col-span-7">
          <h3 className="font-display text-base font-bold text-[#F8FAFC]">
            Histórico de Campanhas ({campaigns.length})
          </h3>
          <p className="text-xs text-[#94A3B8]">
            Acompanhe rascunhos prontos para envio e campanhas já disparadas.
          </p>

          {loading ? (
            <p className="py-8 text-center text-xs text-[#94A3B8]">
              Carregando campanhas...
            </p>
          ) : campaigns.length === 0 ? (
            <p className="mt-4 rounded-xl border border-[#232730] bg-[#0B0D10] p-6 text-center text-xs text-[#94A3B8]">
              Nenhuma campanha criada ainda.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-[#232730] bg-[#0B0D10] p-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-bold text-[#F8FAFC]">
                        {camp.title}
                      </strong>
                      <SpellBadge
                        variant={camp.status === 'sent' ? 'emerald' : 'amber'}
                        size="sm"
                      >
                        {camp.status_label}
                      </SpellBadge>
                      {camp.coupon_code ? (
                        <SpellBadge variant="sky" size="sm">
                          CUPOM: {camp.coupon_code}
                        </SpellBadge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-[#94A3B8]">
                      Público: {camp.audience_label} • Destinatários:{' '}
                      <strong className="text-[#F8FAFC]">
                        {camp.recipients_count}
                      </strong>
                    </p>
                    <p className="line-clamp-2 text-xs text-[#94A3B8]">
                      {camp.message}
                    </p>
                  </div>

                  {camp.status === 'draft' && isAdmin ? (
                    <button
                      type="button"
                      disabled={sendingId === camp.id}
                      onClick={() => setConfirmCampaign(camp)}
                      className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10]"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {sendingId === camp.id ? 'Disparando...' : 'Disparar'}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reativação 1-Clique (Estilo SGR / KrosERP) */}
      <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-[#D97706]" />
          <div>
            <h3 className="font-display text-base font-bold text-[#F8FAFC]">
              Reativação Rápida 1-Clique
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Convide clientes ausentes para voltar à cadeira com mensagem
              personalizada instantânea.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {targets.map((t) => (
            <div
              key={t.id}
              className="flex flex-col justify-between rounded-xl border border-[#232730] bg-[#0B0D10] p-4 space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm font-bold text-[#F8FAFC]">
                    {t.name}
                  </strong>
                  <SpellBadge
                    variant={t.needs_reactivation ? 'amber' : 'emerald'}
                    size="sm"
                  >
                    {t.last_visit_date
                      ? `${t.days_away}d sem corte`
                      : 'Ainda sem corte'}
                  </SpellBadge>
                </div>
                <p className="mt-0.5 text-xs text-[#94A3B8]">
                  Visitas concluídas: <strong>{t.total_visits}</strong>
                  {t.last_visit_date
                    ? ` • Última: ${formatDateBR(t.last_visit_date)}`
                    : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSendReactivationInPanel(t)}
                  className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D97706] px-3 text-xs font-bold text-[#0B0D10]"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Enviar no Painel
                </button>
                <a
                  href={t.wa_me_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-[#232730] bg-[#14171D] px-3 text-xs font-semibold text-[#F8FAFC] hover:border-[#D97706]/50"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#D97706]" />
                  wa.me
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ModalDialog
        open={Boolean(confirmCampaign)}
        onClose={() => setConfirmCampaign(null)}
        title="Confirmar Disparo de Campanha"
      >
        <div className="space-y-4 text-xs text-[#94A3B8]">
          <p>
            Deseja disparar a campanha{' '}
            <strong className="text-[#F8FAFC]">{confirmCampaign?.title}</strong>{' '}
            agora? Apenas clientes ativos com consentimento de WhatsApp
            receberão a mensagem.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmCampaign(null)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSendCampaign}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              Confirmar Envio
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
