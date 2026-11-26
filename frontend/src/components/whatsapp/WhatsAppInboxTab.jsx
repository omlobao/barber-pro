import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Bot,
  CalendarClock,
  CheckCheck,
  ExternalLink,
  Headphones,
  MessageCircle,
  Plus,
  Search,
  Send,
  UserCheck,
  Volume2,
} from 'lucide-react';
import api from '@/api/client';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SpellBadge } from '@/components/spell/SpellBadge';
import {
  extractErrorMessage,
  formatCurrency,
  formatDateBR,
  formatPhoneMask,
} from '@/utils/formatters';

const STAGE_OPTIONS = [
  { value: 'new', label: 'Novo Contato' },
  { value: 'interested', label: 'Interessado' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'vip', label: 'Cliente Recorrente' },
  { value: 'reactivation', label: 'Em Reativação' },
  { value: 'lost', label: 'Perdido' },
];

function formatShortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function getInitials(label) {
  const clean = String(label || '?').trim();
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

function renderLinkedText(text) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, idx) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={`${part}-${idx}`}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-[#D97706] underline-offset-2 hover:text-[#F59E0B]"
      >
        {part}
      </a>
    ) : (
      <span key={`${idx}`}>{part}</span>
    )
  );
}

export function WhatsAppInboxTab({
  selectedConvId,
  onSelectConvId,
  onStatsChange,
}) {
  const [conversations, setConversations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [contactCtx, setContactCtx] = useState(null);
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notifPerm, setNotifPerm] = useState(
    () => (typeof window !== 'undefined' && window.Notification?.permission) || 'unsupported'
  );
  const [soundReady, setSoundReady] = useState(false);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [startingChat, setStartingChat] = useState(false);

  const prevConvsRef = useRef(null);
  const viewportRef = useRef(null);
  const stickBottomRef = useRef(true);
  const audioCtxRef = useRef(null);

  const unlockAudio = useCallback(async () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      setSoundReady(audioCtxRef.current.state === 'running');
    } catch {
      // Ignora bloqueio de autoplay do navegador
    }
  }, []);

  const playChime = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174.66, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {
      // Sem suporte de áudio
    }
  }, []);

  const requestNotifications = async () => {
    await unlockAudio();
    if (!window.Notification) return;
    const perm = await window.Notification.requestPermission();
    setNotifPerm(perm);
  };

  const loadConversations = useCallback(
    async (initial = false) => {
      if (initial) setLoadingList(true);
      try {
        const params = {};
        if (statusFilter) params.status = statusFilter;
        const { data } = await api.get('/api/admin/whatsapp/conversations/', {
          params,
        });
        const list = Array.isArray(data) ? data : [];
        const prev = prevConvsRef.current;
        if (prev && !initial) {
          const prevMap = new Map(prev.map((c) => [c.id, c.unread_count || 0]));
          const incoming = list.find(
            (c) => (c.unread_count || 0) > (prevMap.get(c.id) || 0)
          );
          if (incoming) {
            const label = incoming.client_name || incoming.phone;
            setNotice(`Nova mensagem recebida de ${label}`);
            window.setTimeout(() => setNotice(''), 5000);
            playChime();
            if (window.Notification?.permission === 'granted') {
              new window.Notification(`WhatsApp · ${label}`, {
                body: incoming.last_message_preview || 'Nova mensagem recebida',
                tag: `barber-wa-${incoming.id}`,
              });
            }
          }
        }
        prevConvsRef.current = list;
        setConversations(list);
        if (!selectedConvId && list.length > 0) {
          onSelectConvId(list[0].id);
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Erro ao carregar conversas.'));
      } finally {
        if (initial) setLoadingList(false);
      }
    },
    [statusFilter, selectedConvId, onSelectConvId, playChime]
  );

  useEffect(() => {
    loadConversations(true);
    const timer = window.setInterval(() => {
      loadConversations(false);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadConversations]);

  const loadThread = useCallback(
    async (convId, markRead = true) => {
      if (!convId) return;
      if (markRead) setLoadingMsgs(true);
      try {
        const { data } = await api.get(
          `/api/admin/whatsapp/conversations/${convId}/messages/`
        );
        setMessages(data.messages || []);
        setActiveConv(data.conversation || null);
        if (markRead && data.conversation?.unread_count > 0) {
          await api.post(`/api/admin/whatsapp/conversations/${convId}/read/`);
          setConversations((curr) =>
            curr.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
          );
          onStatsChange?.();
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Erro ao carregar histórico.'));
      } finally {
        if (markRead) setLoadingMsgs(false);
      }
    },
    [onStatsChange]
  );

  const loadContext = useCallback(async (convId) => {
    if (!convId) {
      setContactCtx(null);
      return;
    }
    try {
      const { data } = await api.get(
        `/api/admin/whatsapp/conversations/${convId}/contact/`
      );
      setContactCtx(data);
    } catch {
      setContactCtx(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedConvId) return undefined;
    stickBottomRef.current = true;
    loadThread(selectedConvId, true);
    loadContext(selectedConvId);
    const timer = window.setInterval(() => {
      loadThread(selectedConvId, false);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [selectedConvId, loadThread, loadContext]);

  useEffect(() => {
    const el = viewportRef.current;
    if (el && stickBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR');
    if (!q) return conversations;
    return conversations.filter((item) =>
      `${item.client_name} ${item.contact_name} ${item.phone}`
        .toLocaleLowerCase('pt-BR')
        .includes(q)
    );
  }, [conversations, search]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !selectedConvId || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await api.post(
        `/api/admin/whatsapp/conversations/${selectedConvId}/send/`,
        { text }
      );
      if (data.message) {
        setMessages((curr) => [...curr, data.message]);
      }
      setDraft('');
      stickBottomRef.current = true;
      loadConversations(false);
      onStatsChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Falha ao enviar mensagem.'));
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (event.nativeEvent?.isComposing || event.keyCode === 229) {
        return;
      }
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleStatusToggle = async (nextStatus) => {
    if (!selectedConvId) return;
    try {
      const { data } = await api.post(
        `/api/admin/whatsapp/conversations/${selectedConvId}/status/`,
        { status: nextStatus }
      );
      setActiveConv(data);
      loadConversations(false);
      loadContext(selectedConvId);
      onStatsChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao atualizar modo da conversa.'));
    }
  };

  const handleLeadStageChange = async (newStage) => {
    const leadId = contactCtx?.lead?.id;
    if (!leadId) return;
    try {
      await api.patch(`/api/admin/whatsapp/leads/${leadId}/`, {
        stage: newStage,
      });
      loadContext(selectedConvId);
      onStatsChange?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Erro ao atualizar etapa do lead.'));
    }
  };

  const handleStartConversation = async (e) => {
    e.preventDefault();
    setStartingChat(true);
    setError('');
    try {
      const { data } = await api.post(
        '/api/admin/whatsapp/conversations/start/',
        {
          phone: newPhone,
          contact_name: newName,
        }
      );
      setNewChatOpen(false);
      setNewPhone('');
      setNewName('');
      await loadConversations(false);
      onSelectConvId(data.id);
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível iniciar conversa.'));
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="font-bold underline"
          >
            Fechar
          </button>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-[#D97706]/40 bg-[#D97706]/15 px-4 py-2.5 text-xs font-semibold text-[#F59E0B]"
        >
          <span className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* COLUNA 1: Lista de Conversas */}
        <aside className="flex h-[640px] flex-col rounded-2xl border border-[#232730] bg-[#14171D] xl:col-span-3">
          <div className="border-b border-[#232730] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                Conversas ({conversations.length})
              </span>
              <div className="flex items-center gap-1.5">
                {notifPerm !== 'granted' && notifPerm !== 'unsupported' ? (
                  <button
                    type="button"
                    onClick={requestNotifications}
                    title="Ativar som e notificações"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#232730] bg-[#0B0D10] px-2 text-[11px] font-semibold text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    <Bell className="h-3.5 w-3.5 text-[#D97706]" />
                    Alertas
                  </button>
                ) : soundReady ? (
                  <span
                    title="Alertas sonoros ativos"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setNewChatOpen(true)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#D97706] px-2.5 text-[11px] font-bold text-[#0B0D10]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome ou WhatsApp..."
                aria-label="Buscar conversa"
                className="h-9 w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-3 pl-9 text-xs text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:border-[#D97706] focus:outline-none"
              />
            </div>

            <div className="flex gap-1">
              {[
                { id: '', label: 'Todas' },
                { id: 'human', label: 'Humano' },
                { id: 'active', label: 'Bot' },
              ].map((pill) => (
                <button
                  key={pill.id || 'all'}
                  type="button"
                  onClick={() => setStatusFilter(pill.id)}
                  className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
                    statusFilter === pill.id
                      ? 'bg-[#D97706]/20 text-[#F59E0B] border border-[#D97706]/40'
                      : 'bg-[#0B0D10] text-[#94A3B8] border border-transparent hover:text-[#F8FAFC]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#232730]/60">
            {loadingList ? (
              <p className="p-5 text-center text-xs text-[#94A3B8]">
                Carregando conversas...
              </p>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <MessageCircle className="mx-auto h-7 w-7 text-[#94A3B8]/50" />
                <p className="text-xs font-semibold text-[#F8FAFC]">
                  Nenhuma conversa encontrada
                </p>
                <p className="text-[11px] text-[#94A3B8]">
                  Use o Simulador Local ou clique em &ldquo;Nova&rdquo; para
                  iniciar um atendimento.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const selected = conv.id === selectedConvId;
                const title = conv.client_name || conv.contact_name || conv.phone;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      unlockAudio();
                      onSelectConvId(conv.id);
                    }}
                    className={`flex w-full items-start gap-3 p-3.5 text-left transition ${
                      selected
                        ? 'bg-[#D97706]/12 border-l-2 border-l-[#D97706]'
                        : 'hover:bg-[#0B0D10]/70'
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D97706]/30 bg-[#0B0D10] text-xs font-bold text-[#E5A93C]">
                      {getInitials(title)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="truncate text-xs font-bold text-[#F8FAFC]">
                          {title}
                        </strong>
                        <time className="shrink-0 text-[10px] text-[#94A3B8]">
                          {formatShortDate(conv.last_message_at)}
                        </time>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
                        {conv.last_message_preview || conv.phone}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            conv.status === 'human'
                              ? 'bg-sky-500/15 text-sky-300'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          {conv.status === 'human' ? 'Fila Humana' : 'Bot Ativo'}
                        </span>
                        {conv.unread_count > 0 ? (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D97706] px-1.5 text-[10px] font-extrabold text-[#0B0D10]">
                            {conv.unread_count}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* COLUNA 2: Thread de Mensagens */}
        <section className="flex h-[640px] flex-col rounded-2xl border border-[#232730] bg-[#14171D] xl:col-span-6">
          {!activeConv ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <MessageCircle className="h-10 w-10 text-[#D97706]/50" />
              <h3 className="mt-3 font-display text-lg font-bold text-[#F8FAFC]">
                Central de Conversas BarberPro
              </h3>
              <p className="mt-1 max-w-sm text-xs text-[#94A3B8]">
                Selecione um cliente à esquerda para acompanhar o autoatendimento
                do bot ou responder manualmente pela barbearia.
              </p>
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#232730] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D97706]/40 bg-[#0B0D10] text-xs font-bold text-[#D97706]">
                    {getInitials(activeConv.client_name || activeConv.phone)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#F8FAFC]">
                      {contactCtx?.client?.name ||
                        activeConv.client_name ||
                        activeConv.phone}
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      +{activeConv.phone}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {activeConv.status === 'human' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusToggle('active')}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-300"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      Devolver ao Bot
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusToggle('human')}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-bold text-sky-300"
                    >
                      <Headphones className="h-3.5 w-3.5" />
                      Assumir Humano
                    </button>
                  )}

                  {contactCtx?.wa_me_url ? (
                    <a
                      href={contactCtx.wa_me_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold text-[#94A3B8] hover:border-[#D97706]/50 hover:text-[#F8FAFC]"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-[#D97706]" />
                      wa.me
                    </a>
                  ) : null}
                </div>
              </header>

              <div
                ref={viewportRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  stickBottomRef.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 56;
                }}
                className="flex-1 space-y-3 overflow-y-auto bg-[#0B0D10]/60 p-4"
              >
                {loadingMsgs ? (
                  <p className="text-center text-xs text-[#94A3B8]">
                    Carregando mensagens...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="py-12 text-center text-xs text-[#94A3B8]">
                    Nenhuma mensagem registrada ainda. Envie uma mensagem abaixo!
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <div
                        key={msg.id || msg.message_id}
                        className={`flex ${
                          isOutbound ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                            isOutbound
                              ? 'rounded-br-sm border border-[#D97706]/35 bg-[#D97706]/15 text-[#F8FAFC]'
                              : 'rounded-bl-sm border border-[#232730] bg-[#14171D] text-[#F8FAFC]'
                          }`}
                        >
                          {msg.sender ? (
                            <p className="mb-1 text-[10px] font-bold text-[#E5A93C]">
                              {msg.sender}
                            </p>
                          ) : null}
                          <p className="whitespace-pre-wrap break-words">
                            {renderLinkedText(msg.text)}
                          </p>
                          <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] text-[#94A3B8]">
                            <time>{formatShortTime(msg.created_at)}</time>
                            {isOutbound ? (
                              <span
                                title={
                                  msg.status === 'simulated'
                                    ? 'Registrada em modo local/simulador'
                                    : msg.status === 'failed'
                                    ? 'Falha no envio'
                                    : 'Enviada via Evolution'
                                }
                              >
                                {msg.status === 'failed' ? (
                                  <strong className="text-rose-400">!</strong>
                                ) : msg.status === 'simulated' ? (
                                  <span className="text-amber-300">⚡ Local</span>
                                ) : (
                                  <CheckCheck className="inline h-3.5 w-3.5 text-emerald-400" />
                                )}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={handleSend}
                className="flex items-end gap-2 border-t border-[#232730] bg-[#14171D] p-3"
              >
                <label htmlFor="wa-composer-input" className="sr-only">
                  Digite uma mensagem para o cliente
                </label>
                <textarea
                  id="wa-composer-input"
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)"
                  className="[field-sizing:content] h-auto min-h-[44px] max-h-[8lh] w-full resize-none rounded-xl border border-[#232730] bg-[#0B0D10] px-3.5 py-2.5 text-xs text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:border-[#D97706] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10] transition hover:bg-[#F59E0B] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>{sending ? 'Enviando...' : 'Enviar'}</span>
                </button>
              </form>
            </>
          )}
        </section>

        {/* COLUNA 3: Contexto CRM da Barbearia */}
        <aside className="flex h-[640px] flex-col overflow-y-auto rounded-2xl border border-[#232730] bg-[#14171D] p-4 space-y-4 xl:col-span-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#D97706]">
              Ficha Inteligente
            </p>
            <h3 className="font-display text-base font-bold text-[#F8FAFC]">
              Contexto do Cliente
            </h3>
          </div>

          {!activeConv ? (
            <p className="text-xs text-[#94A3B8]">
              Selecione uma conversa para visualizar histórico de cortes, gastos,
              agendamento futuro e etapa do funil.
            </p>
          ) : (
            <>
              {contactCtx?.queue ? (
                <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-200">
                  <strong className="block font-bold">
                    {contactCtx.queue.status === 'assigned'
                      ? 'Em atendimento humano'
                      : `Aguardando na fila · Posição #${contactCtx.queue.position}`}
                  </strong>
                  {contactCtx.queue.reason ? (
                    <span className="mt-0.5 block text-[11px] text-sky-300/80">
                      Motivo: {contactCtx.queue.reason}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {contactCtx?.client ? (
                <div className="rounded-xl border border-[#232730] bg-[#0B0D10] p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#F8FAFC]">
                        {contactCtx.client.name}
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {formatPhoneMask(contactCtx.client.phone_number)}
                      </p>
                    </div>
                    <SpellBadge
                      variant={
                        contactCtx.client.whatsapp_opt_in ? 'emerald' : 'rose'
                      }
                      size="sm"
                    >
                      {contactCtx.client.whatsapp_opt_in ? 'OPT-IN' : 'OPT-OUT'}
                    </SpellBadge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-[#232730] bg-[#14171D] p-2">
                      <span className="block text-[10px] text-[#94A3B8]">
                        Visitas
                      </span>
                      <strong className="text-sm text-[#F8FAFC]">
                        {contactCtx.client.total_visits}
                      </strong>
                    </div>
                    <div className="rounded-lg border border-[#232730] bg-[#14171D] p-2">
                      <span className="block text-[10px] text-[#94A3B8]">
                        Faltas
                      </span>
                      <strong
                        className={`text-sm ${
                          contactCtx.client.no_show_count > 0
                            ? 'text-rose-400'
                            : 'text-[#F8FAFC]'
                        }`}
                      >
                        {contactCtx.client.no_show_count}
                      </strong>
                    </div>
                    <div className="rounded-lg border border-[#232730] bg-[#14171D] p-2">
                      <span className="block text-[10px] text-[#94A3B8]">
                        LTV Pago
                      </span>
                      <strong className="text-xs text-[#E5A93C]">
                        {formatCurrency(contactCtx.client.total_spent)}
                      </strong>
                    </div>
                  </div>

                  {contactCtx.client.notes ? (
                    <p className="rounded-lg bg-[#14171D] p-2 text-[11px] text-[#94A3B8]">
                      <strong className="text-[#F8FAFC]">Preferências:</strong>{' '}
                      {contactCtx.client.notes}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-[#232730] bg-[#0B0D10] p-3 text-xs text-[#94A3B8]">
                  <UserCheck className="mb-1.5 h-4 w-4 text-[#D97706]" />
                  Contato ainda sem ficha de cliente vinculada. Assim que agendar,
                  o histórico será unificado automaticamente pelo WhatsApp.
                </div>
              )}

              {contactCtx?.next_appointment ? (
                <div className="rounded-xl border border-[#D97706]/35 bg-[#D97706]/10 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#F59E0B]">
                    <CalendarClock className="h-4 w-4" />
                    Próximo Horário Marcado
                  </div>
                  <p className="text-xs font-semibold text-[#F8FAFC]">
                    {formatDateBR(contactCtx.next_appointment.date)} às{' '}
                    {contactCtx.next_appointment.start_time}
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    Barbeiro: {contactCtx.next_appointment.professional}
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    {contactCtx.next_appointment.services.join(', ')} •{' '}
                    <strong className="text-[#F8FAFC]">
                      {formatCurrency(contactCtx.next_appointment.total_price)}
                    </strong>
                  </p>
                </div>
              ) : null}

              {contactCtx?.lead ? (
                <div className="rounded-xl border border-[#232730] bg-[#0B0D10] p-3.5 space-y-2">
                  <label
                    htmlFor="ctx-lead-stage"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]"
                  >
                    Etapa no Funil CRM
                  </label>
                  <select
                    id="ctx-lead-stage"
                    value={contactCtx.lead.stage}
                    onChange={(e) => handleLeadStageChange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#232730] bg-[#14171D] px-3 text-xs font-semibold text-[#F8FAFC]"
                  >
                    {STAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {contactCtx.lead.interest ? (
                    <p className="text-[11px] text-[#94A3B8]">
                      Interesse: {contactCtx.lead.interest}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {contactCtx?.recent_appointments?.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                    Últimos Agendamentos
                  </p>
                  {contactCtx.recent_appointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between rounded-lg border border-[#232730] bg-[#0B0D10] px-3 py-2 text-[11px]"
                    >
                      <div>
                        <p className="font-semibold text-[#F8FAFC]">
                          {formatDateBR(appt.date)} • {appt.start_time}
                        </p>
                        <p className="text-[#94A3B8]">{appt.professional}</p>
                      </div>
                      <span className="font-bold text-[#E5A93C]">
                        {formatCurrency(appt.total_price)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>

      <ModalDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        title="Iniciar Conversa no WhatsApp CRM"
      >
        <form onSubmit={handleStartConversation} className="space-y-4">
          <div>
            <label
              htmlFor="new-wa-phone"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              WhatsApp com DDD *
            </label>
            <input
              id="new-wa-phone"
              type="tel"
              required
              placeholder="(11) 98888-7777"
              value={newPhone}
              onChange={(e) => setNewPhone(formatPhoneMask(e.target.value))}
              className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            />
          </div>
          <div>
            <label
              htmlFor="new-wa-name"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Nome do Contato (opcional)
            </label>
            <input
              id="new-wa-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Rafael Almeida"
              className="h-11 w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-sm text-[#F8FAFC]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewChatOpen(false)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={startingChat}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              {startingChat ? 'Abrindo...' : 'Abrir Conversa'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
