import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bot,
  Headphones,
  Kanban,
  Megaphone,
  MessageCircle,
  QrCode,
  Users,
} from 'lucide-react';
import api from '@/api/client';
import { SpellBadge } from '@/components/spell/SpellBadge';
import { WhatsAppInboxTab } from '@/components/whatsapp/WhatsAppInboxTab';
import { WhatsAppFunnelTab } from '@/components/whatsapp/WhatsAppFunnelTab';
import { WhatsAppCampaignsTab } from '@/components/whatsapp/WhatsAppCampaignsTab';
import { WhatsAppConnectionTab } from '@/components/whatsapp/WhatsAppConnectionTab';

const TABS = [
  { id: 'inbox', label: 'Central de Conversas', icon: MessageCircle },
  { id: 'funnel', label: 'Fila Humana & Funil CRM', icon: Kanban },
  { id: 'campaigns', label: 'Campanhas & Reativação', icon: Megaphone },
  { id: 'connection', label: 'Evolution GO & Simulador', icon: QrCode },
];

export default function AdminWhatsAppPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [overview, setOverview] = useState({
    unread_messages: 0,
    conversations_count: 0,
    waiting_queue: 0,
    leads_total: 0,
    opt_in_clients: 0,
    bot_enabled: true,
    gateway_configured: false,
  });

  const tabRefs = useRef({});
  const panelRefs = useRef({});

  const loadOverview = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/whatsapp/overview/');
      setOverview(data);
    } catch {
      // Mantém último snapshot
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const timer = window.setInterval(loadOverview, 10000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  // Suporte a deep-link vindo da tela de Clientes (/admin/whatsapp?phone=...)
  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    const nameParam = searchParams.get('name') || '';
    if (!phoneParam) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post(
          '/api/admin/whatsapp/conversations/start/',
          {
            phone: phoneParam,
            contact_name: nameParam,
          }
        );
        if (!cancelled) {
          setSelectedConvId(data.id);
          setActiveTab('inbox');
          setSearchParams({}, { replace: true });
        }
      } catch {
        // Ignora se número inválido
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

  // Sincroniza o evento beforematch (Find in page) com hidden="until-found"
  useEffect(() => {
    const cleanups = [];
    TABS.forEach((tab) => {
      const panel = panelRefs.current[tab.id];
      if (!panel) return;
      const handleBeforeMatch = () => {
        setActiveTab(tab.id);
      };
      panel.addEventListener('beforematch', handleBeforeMatch);
      cleanups.push(() =>
        panel.removeEventListener('beforematch', handleBeforeMatch)
      );
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const selectTab = (tabId, focusElement = false) => {
    setActiveTab(tabId);
    const btn = tabRefs.current[tabId];
    if (btn) {
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (focusElement) btn.focus();
    }
  };

  const handleTabKeyDown = (event, index) => {
    let nextIdx = null;
    if (event.key === 'ArrowRight') {
      nextIdx = (index + 1) % TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIdx = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = TABS.length - 1;
    }
    if (nextIdx !== null) {
      event.preventDefault();
      selectTab(TABS[nextIdx].id, true);
    }
  };

  const openConversationInInbox = (convId) => {
    setSelectedConvId(convId);
    selectTab('inbox');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho + Status */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#D97706]">
            Atendimento, Retenção & Automação
          </span>
          <h1 className="font-display mt-0.5 text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
            WhatsApp CRM
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Central de conversas ao vivo, bot de agendamentos, funil comercial,
            campanhas com opt-in e integração Evolution GO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SpellBadge variant={overview.bot_enabled ? 'emerald' : 'neutral'}>
            <Bot className="mr-1 inline h-3.5 w-3.5" />
            {overview.bot_enabled ? 'BOT ATIVO' : 'BOT PAUSADO'}
          </SpellBadge>
          <SpellBadge
            variant={overview.gateway_configured ? 'amber' : 'sky'}
          >
            {overview.gateway_configured
              ? `INSTÂNCIA: ${overview.instance_name}`
              : 'MODO SIMULADOR LOCAL'}
          </SpellBadge>
        </div>
      </div>

      {/* KPIs Operacionais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Mensagens Não Lidas</span>
            <MessageCircle className="h-4 w-4 text-[#D97706]" />
          </div>
          <strong className="mt-1.5 block text-2xl font-extrabold text-[#F8FAFC]">
            {overview.unread_messages}
          </strong>
        </div>

        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Aguardando na Fila</span>
            <Headphones className="h-4 w-4 text-sky-400" />
          </div>
          <strong className="mt-1.5 block text-2xl font-extrabold text-[#F8FAFC]">
            {overview.waiting_queue}
          </strong>
        </div>

        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Leads no Funil</span>
            <Kanban className="h-4 w-4 text-emerald-400" />
          </div>
          <strong className="mt-1.5 block text-2xl font-extrabold text-[#F8FAFC]">
            {overview.leads_total}
          </strong>
        </div>

        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Clientes Opt-in</span>
            <Users className="h-4 w-4 text-[#E5A93C]" />
          </div>
          <strong className="mt-1.5 block text-2xl font-extrabold text-[#F8FAFC]">
            {overview.opt_in_clients}
          </strong>
        </div>
      </div>

      {/* Barra de Abas Responsiva (scroll horizontal em linha única + indicador em borda) */}
      <div
        role="tablist"
        aria-label="Módulos do WhatsApp CRM"
        className="flex overflow-x-auto border-b border-[#232730] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab, idx) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              id={`wa-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className="relative flex min-h-[46px] flex-none items-center gap-2 px-4 text-xs font-bold text-[#94A3B8] transition hover:text-[#F8FAFC] aria-selected:text-[#F59E0B] aria-selected:after:absolute aria-selected:after:inset-x-0 aria-selected:after:bottom-0 aria-selected:after:border-b-[3px] aria-selected:after:border-[#D97706] aria-selected:after:content-['']"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.id === 'inbox' && overview.unread_messages > 0 ? (
                <span className="rounded-full bg-[#D97706] px-1.5 py-0.5 text-[10px] font-extrabold text-[#0B0D10]">
                  {overview.unread_messages}
                </span>
              ) : null}
              {tab.id === 'funnel' && overview.waiting_queue > 0 ? (
                <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-extrabold text-[#0B0D10]">
                  {overview.waiting_queue}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Painéis das Abas (sem padding/borda no próprio role="tabpanel" para compatibilidade com hidden="until-found") */}
      <div>
        <div
          ref={(el) => {
            panelRefs.current.inbox = el;
          }}
          role="tabpanel"
          aria-labelledby="wa-tab-inbox"
          hidden={activeTab !== 'inbox' ? 'until-found' : undefined}
        >
          <div className="pt-1">
            <WhatsAppInboxTab
              selectedConvId={selectedConvId}
              onSelectConvId={setSelectedConvId}
              onStatsChange={loadOverview}
            />
          </div>
        </div>

        <div
          ref={(el) => {
            panelRefs.current.funnel = el;
          }}
          role="tabpanel"
          aria-labelledby="wa-tab-funnel"
          hidden={activeTab !== 'funnel' ? 'until-found' : undefined}
        >
          <div className="pt-1">
            <WhatsAppFunnelTab
              onOpenConversation={openConversationInInbox}
              onStatsChange={loadOverview}
            />
          </div>
        </div>

        <div
          ref={(el) => {
            panelRefs.current.campaigns = el;
          }}
          role="tabpanel"
          aria-labelledby="wa-tab-campaigns"
          hidden={activeTab !== 'campaigns' ? 'until-found' : undefined}
        >
          <div className="pt-1">
            <WhatsAppCampaignsTab
              onOpenConversation={openConversationInInbox}
              onStatsChange={loadOverview}
            />
          </div>
        </div>

        <div
          ref={(el) => {
            panelRefs.current.connection = el;
          }}
          role="tabpanel"
          aria-labelledby="wa-tab-connection"
          hidden={activeTab !== 'connection' ? 'until-found' : undefined}
        >
          <div className="pt-1">
            <WhatsAppConnectionTab
              onOpenConversation={openConversationInInbox}
              onStatsChange={loadOverview}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
