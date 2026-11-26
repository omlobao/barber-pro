import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ExternalLink,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Receipt,
  Scissors,
  Ticket,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SlideDrawer } from '@/components/ui/SlideDrawer';
import { SpellBadge } from '@/components/spell/SpellBadge';

const NAV_ITEMS = [
  { to: '/admin/agenda', label: 'Agenda do Dia', icon: CalendarDays },
  { to: '/admin/caixa', label: 'Frente de Caixa (PDV)', icon: Receipt },
  { to: '/admin/financeiro', label: 'Financeiro & Comissões', icon: Wallet },
  { to: '/admin/catalogo', label: 'Serviços & Estoque', icon: Package },
  { to: '/admin/cupons', label: 'Cupons & Promoções', icon: Ticket },
  { to: '/admin/equipe', label: 'Equipe & Horários', icon: UserCog },
  { to: '/admin/clientes', label: 'Clientes (CRM)', icon: Users },
  { to: '/admin/whatsapp', label: 'WhatsApp CRM', icon: MessageCircle },
];

function SidebarContent({ onNavigate }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onNavigate?.();
    navigate('/admin/login');
  };

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[#232730]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D97706]/40 bg-[#0B0D10] text-[#D97706]">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <span className="font-display block text-base font-bold text-[#F8FAFC]">
              BARBER<span className="text-[#D97706]">PRO</span>
            </span>
            <span className="block text-[10px] uppercase tracking-widest text-[#94A3B8]">
              Painel Operacional
            </span>
          </div>
        </div>

        <nav className="mt-4 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex min-h-[46px] items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[#D97706] text-[#0B0D10] shadow-md shadow-[#D97706]/20'
                      : 'text-[#94A3B8] hover:bg-[#0B0D10] hover:text-[#F8FAFC]'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[#232730] p-4 space-y-3">
        <div className="rounded-xl border border-[#232730] bg-[#0B0D10] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-[#F8FAFC]">
              {user?.professional?.display_name || user?.username}
            </p>
            <SpellBadge variant={isAdmin ? 'amber' : 'sky'} size="sm">
              {isAdmin ? 'ADMIN' : 'BARBEIRO'}
            </SpellBadge>
          </div>
          <p className="mt-0.5 truncate text-xs text-[#94A3B8]">
            @{user?.username}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/"
            onClick={onNavigate}
            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold text-[#94A3B8] transition hover:border-[#D97706]/40 hover:text-[#F8FAFC]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Vitrine
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#0B0D10] text-[#F8FAFC]">
      {/* Sidebar fixa no Desktop */}
      <aside className="hidden w-68 shrink-0 border-r border-[#232730] bg-[#14171D] lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* Menu Gaveta no Mobile */}
      <SlideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="left"
        title="Menu do Painel"
        widthClass="max-w-xs"
      >
        <div className="-m-6 h-[calc(100svh-73px)]">
          <SidebarContent onNavigate={() => setDrawerOpen(false)} />
        </div>
      </SlideDrawer>

      {/* Conteúdo Principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#232730] bg-[#0B0D10]/90 px-4 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-2.5">
            <Scissors className="h-5 w-5 text-[#D97706]" />
            <span className="font-display text-base font-bold">
              BARBER<span className="text-[#D97706]">PRO</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu lateral"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#232730] bg-[#14171D] text-[#F8FAFC]"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
