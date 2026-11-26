import React, { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Copy,
  LogOut,
  MessageSquare,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Smartphone,
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { SpellBadge } from '@/components/spell/SpellBadge';
import { extractErrorMessage } from '@/utils/formatters';

const QUICK_SIM_PROMPTS = [
  { label: 'Menu (Oi)', text: 'Oi' },
  { label: '1 · Serviços', text: '1' },
  { label: '2 · Agendar + Cupom', text: '2' },
  { label: '3 · Meu Horário', text: '3' },
  { label: '5 · Fila Humana', text: '5' },
  { label: '6 · Endereço', text: '6' },
];

export function WhatsAppConnectionTab({ onOpenConversation, onStatsChange }) {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState(null);
  const [apiTokenInput, setApiTokenInput] = useState('');
  const [qrState, setQrState] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // Estado do Simulador Local
  const [simPhone, setSimPhone] = useState('5511988002233');
  const [simName, setSimName] = useState('Bruno Henrique');
  const [simInput, setSimInput] = useState('');
  const [simLog, setSimLog] = useState([
    {
      role: 'bot',
      text: 'Simulador Local pronto! Clique em um comando rápido abaixo ou digite como se fosse um cliente no WhatsApp.',
    },
  ]);
  const [simLastConvId, setSimLastConvId] = useState(null);
  const [simSending, setSimSending] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/whatsapp/settings/');
      setSettings(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao carregar configurações.'));
    }
  }, []);

  const fetchQrStatus = useCallback(async () => {
    setQrLoading(true);
    try {
      const { data } = await api.get('/api/admin/whatsapp/qrcode/');
      setQrState(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao consultar Evolution GO.'));
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    fetchQrStatus();
  }, [loadSettings, fetchQrStatus]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const payload = {
        shop_name: settings.shop_name,
        shop_address: settings.shop_address,
        shop_hours: settings.shop_hours,
        booking_url: settings.booking_url,
        welcome_message: settings.welcome_message,
        provider: settings.provider,
        api_url: settings.api_url,
        instance_name: settings.instance_name,
        bot_enabled: settings.bot_enabled,
        auto_lead_capture: settings.auto_lead_capture,
      };
      if (apiTokenInput.trim()) {
        payload.api_token = apiTokenInput.trim();
      }
      const { data } = await api.patch(
        '/api/admin/whatsapp/settings/',
        payload
      );
      setSettings(data);
      setApiTokenInput('');
      setFeedback('Configurações do WhatsApp CRM salvas com sucesso!');
      fetchQrStatus();
      onStatsChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao salvar configurações.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutDevice = async () => {
    setError('');
    try {
      await api.post('/api/admin/whatsapp/logout/');
      setFeedback('Sessão desconectada. Gere um novo QR Code para parear.');
      fetchQrStatus();
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível desconectar sessão.'));
    }
  };

  const sendSimulated = async (rawMessage) => {
    const text = String(rawMessage ?? simInput).trim();
    if (!text || simSending) return;
    setSimSending(true);
    setSimInput('');
    setSimLog((curr) => [...curr, { role: 'client', text }]);
    try {
      const { data } = await api.post('/api/admin/whatsapp/simulate/', {
        phone: simPhone,
        push_name: simName,
        message: text,
      });
      const replies = data.replies || [];
      if (replies.length === 0) {
        setSimLog((curr) => [
          ...curr,
          {
            role: 'bot',
            text: '(Conversa em Fila Humana — o bot ficou em silêncio para o barbeiro/recepção responder na Central de Conversas.)',
          },
        ]);
      } else {
        setSimLog((curr) => [
          ...curr,
          ...replies.map((r) => ({ role: 'bot', text: r })),
        ]);
      }
      if (data.conversation_id) {
        setSimLastConvId(data.conversation_id);
      }
      onStatsChange?.();
    } catch (err) {
      setSimLog((curr) => [
        ...curr,
        {
          role: 'bot',
          text: `Erro: ${extractErrorMessage(err, 'Falha na simulação.')}`,
        },
      ]);
    } finally {
      setSimSending(false);
    }
  };

  const handleSimKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (event.nativeEvent?.isComposing || event.keyCode === 229) {
        return;
      }
      void sendSimulated();
    }
  };

  const copyWebhookUrl = async () => {
    if (!settings?.webhook_path) return;
    const fullUrl = `${window.location.origin}${settings.webhook_path}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setFeedback('URL do Webhook copiada para a área de transferência!');
    } catch {
      setFeedback(`Webhook: ${fullUrl}`);
    }
  };

  const qrImgSrc =
    qrState?.base64 && !String(qrState.base64).startsWith('data:')
      ? `data:image/png;base64,${qrState.base64}`
      : qrState?.base64 || '';

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Conexão Evolution GO + Formulário */}
        <div className="space-y-6 xl:col-span-7">
          <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <QrCode className="h-5 w-5 text-[#D97706]" />
                <div>
                  <h3 className="font-display text-base font-bold text-[#F8FAFC]">
                    Conexão Evolution GO / QR Code
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Pareie o WhatsApp oficial da barbearia ou opere em modo
                    local.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {qrState?.connected ? (
                  <SpellBadge variant="emerald">APARELHO CONECTADO</SpellBadge>
                ) : qrState?.configured ? (
                  <SpellBadge variant="amber">AGUARDANDO LEITURA QR</SpellBadge>
                ) : (
                  <SpellBadge variant="sky">MODO SIMULADOR LOCAL</SpellBadge>
                )}

                <button
                  type="button"
                  onClick={fetchQrStatus}
                  disabled={qrLoading}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-bold text-[#F8FAFC]"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 text-[#D97706] ${
                      qrLoading ? 'animate-spin' : ''
                    }`}
                  />
                  Atualizar
                </button>
              </div>
            </div>

            {qrState?.connected ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2.5 text-xs text-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span>
                    Instância <strong>{qrState.instance}</strong> autenticada e
                    pronta para receber e enviar mensagens em tempo real!
                  </span>
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={handleLogoutDevice}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-bold text-rose-300"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Desconectar
                  </button>
                ) : null}
              </div>
            ) : qrImgSrc ? (
              <div className="flex flex-col items-center rounded-xl border border-[#232730] bg-[#0B0D10] p-6 text-center">
                <img
                  src={qrImgSrc}
                  alt="QR Code de conexão WhatsApp"
                  className="h-52 w-52 rounded-xl bg-white p-2"
                />
                <p className="mt-3 text-xs text-[#94A3B8]">
                  Abra o WhatsApp no celular da barbearia →{' '}
                  <strong className="text-[#F8FAFC]">
                    Aparelhos conectados → Conectar aparelho
                  </strong>
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-[#232730] bg-[#0B0D10] p-4 text-xs text-[#94A3B8]">
                <Smartphone className="mb-1.5 h-4 w-4 text-[#D97706]" />
                {qrState?.error ||
                  'Configure a URL e o Token do Evolution GO abaixo para gerar o QR Code.'}
              </div>
            )}

            {settings?.webhook_path ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#232730] bg-[#0B0D10] px-3.5 py-2.5 text-xs">
                <span className="truncate font-mono text-[11px] text-[#94A3B8]">
                  Webhook: {settings.webhook_path}
                </span>
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#D97706]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </button>
              </div>
            ) : null}
          </div>

          {settings ? (
            <form
              onSubmit={handleSaveSettings}
              className="rounded-2xl border border-[#232730] bg-[#14171D] p-5 space-y-4"
            >
              <h3 className="font-display text-base font-bold text-[#F8FAFC]">
                Configurações do Bot & Servidor Evolution
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="cfg-shop"
                    className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                  >
                    Nome da Barbearia
                  </label>
                  <input
                    id="cfg-shop"
                    disabled={!isAdmin}
                    value={settings.shop_name || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, shop_name: e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cfg-hours"
                    className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                  >
                    Horário de Funcionamento
                  </label>
                  <input
                    id="cfg-hours"
                    disabled={!isAdmin}
                    value={settings.shop_hours || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, shop_hours: e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="cfg-addr"
                    className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                  >
                    Endereço Completo
                  </label>
                  <input
                    id="cfg-addr"
                    disabled={!isAdmin}
                    value={settings.shop_address || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, shop_address: e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cfg-book"
                    className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                  >
                    Link Público de Agendamento
                  </label>
                  <input
                    id="cfg-book"
                    disabled={!isAdmin}
                    value={settings.booking_url || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, booking_url: e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cfg-welcome"
                  className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                >
                  Saudação do Menu Automático
                </label>
                <textarea
                  id="cfg-welcome"
                  rows={2}
                  disabled={!isAdmin}
                  value={settings.welcome_message || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      welcome_message: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-[#232730] bg-[#0B0D10] p-3 text-xs text-[#F8FAFC]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="cfg-provider"
                    className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                  >
                    Gateway
                  </label>
                  <select
                    id="cfg-provider"
                    disabled={!isAdmin}
                    value={settings.provider || 'evolution_go'}
                    onChange={(e) =>
                      setSettings({ ...settings, provider: e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                  >
                    <option value="evolution_go">Evolution GO</option>
                    <option value="legacy">Evolution API (Legado)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="cfg-url"
                    className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                  >
                    URL do Evolution
                  </label>
                  <input
                    id="cfg-url"
                    disabled={!isAdmin}
                    placeholder="http://localhost:8080"
                    value={settings.api_url || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, api_url: e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cfg-inst"
                    className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                  >
                    Instância
                  </label>
                  <input
                    id="cfg-inst"
                    disabled={!isAdmin}
                    placeholder="barberpro"
                    value={settings.instance_name || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        instance_name: e.target.value,
                      })
                    }
                    className="h-10 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cfg-token"
                  className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
                >
                  Token / API Key da Instância{' '}
                  {settings.has_api_token ? (
                    <span className="text-emerald-400">(Configurado ✓)</span>
                  ) : null}
                </label>
                <input
                  id="cfg-token"
                  type="password"
                  disabled={!isAdmin}
                  autoComplete="new-password"
                  placeholder={
                    settings.has_api_token
                      ? '•••••••• (preencha apenas se quiser substituir)'
                      : 'Cole o token da instância Evolution GO'
                  }
                  value={apiTokenInput}
                  onChange={(e) => setApiTokenInput(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC]"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#F8FAFC]">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={Boolean(settings.bot_enabled)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        bot_enabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#D97706]"
                  />
                  Autoatendimento do Bot Ativo
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#F8FAFC]">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={Boolean(settings.auto_lead_capture)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        auto_lead_capture: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#D97706]"
                  />
                  Capturar Leads Automaticamente
                </label>
              </div>

              {isAdmin ? (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              ) : null}
            </form>
          ) : null}
        </div>

        {/* Simulador Local Interativo (igual KrosERP) */}
        <div className="flex h-[680px] flex-col rounded-2xl border border-[#232730] bg-[#14171D] p-5 xl:col-span-5">
          <div className="flex items-center justify-between gap-2 border-b border-[#232730] pb-3">
            <div className="flex items-center gap-2.5">
              <Bot className="h-5 w-5 text-[#D97706]" />
              <div>
                <h3 className="font-display text-base font-bold text-[#F8FAFC]">
                  Simulador Local do Bot
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  Teste cardápio, cupons, consulta de horário e fila humana sem
                  celular!
                </p>
              </div>
            </div>
            {simLastConvId ? (
              <button
                type="button"
                onClick={() => onOpenConversation(simLastConvId)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#D97706]/40 bg-[#D97706]/15 px-2.5 text-[11px] font-bold text-[#F59E0B]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Abrir no Inbox
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="sim-phone"
                className="mb-1 block text-[10px] font-bold uppercase text-[#94A3B8]"
              >
                WhatsApp Simulado
              </label>
              <input
                id="sim-phone"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#232730] bg-[#0B0D10] px-2.5 text-xs text-[#F8FAFC]"
              />
            </div>
            <div>
              <label
                htmlFor="sim-name"
                className="mb-1 block text-[10px] font-bold uppercase text-[#94A3B8]"
              >
                Nome no WhatsApp
              </label>
              <input
                id="sim-name"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#232730] bg-[#0B0D10] px-2.5 text-xs text-[#F8FAFC]"
              />
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {QUICK_SIM_PROMPTS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => void sendSimulated(chip.text)}
                className="rounded-lg border border-[#232730] bg-[#0B0D10] px-2.5 py-1 text-[11px] font-semibold text-[#E5A93C] hover:border-[#D97706]"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-[#232730] bg-[#0B0D10] p-3.5">
            {simLog.map((entry, index) => (
              <div
                key={index}
                className={`flex ${
                  entry.role === 'client' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    entry.role === 'client'
                      ? 'rounded-br-sm bg-emerald-600/25 border border-emerald-500/30 text-[#F8FAFC]'
                      : 'rounded-bl-sm bg-[#14171D] border border-[#232730] text-[#F8FAFC]'
                  }`}
                >
                  {entry.text}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendSimulated();
            }}
            className="mt-3 flex gap-2"
          >
            <label htmlFor="sim-message-input" className="sr-only">
              Mensagem simulada do cliente
            </label>
            <input
              id="sim-message-input"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              onKeyDown={handleSimKeyDown}
              placeholder="Digite como cliente (ex.: 1, 3, ATENDENTE)..."
              className="h-11 flex-1 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs text-[#F8FAFC] focus:border-[#D97706] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!simInput.trim() || simSending}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Testar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
