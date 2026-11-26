import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Lock, Menu, Scissors, User, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useClientAuth } from '@/context/ClientAuthContext';

const NAV_LINKS = [
  { href: '/#servicos', label: 'Serviços' },
  { href: '/#equipe', label: 'Equipe' },
  { href: '/#estrutura', label: 'Estrutura' },
  { href: '/#localizacao', label: 'Localização' },
];

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated: isStaffAuthenticated } = useAuth();
  const { client, isClientAuthenticated } = useClientAuth();
  const firstName = client?.name ? client.name.trim().split(' ')[0] : '';
  const showStaffShortcut = isStaffAuthenticated && !isClientAuthenticated;

  return (
    <header className="sticky top-0 z-40 border-b border-[#232730]/80 bg-[#0B0D10]/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D97706]/40 bg-[#14171D] text-[#D97706] shadow-inner transition group-hover:border-[#F59E0B] group-hover:text-[#F59E0B]">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <span className="font-display block text-lg font-bold tracking-wider text-[#F8FAFC]">
              BARBER<span className="text-[#D97706]">PRO</span>
            </span>
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[#94A3B8]">
              Clássica & Visagismo
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#94A3B8] transition hover:text-[#F8FAFC]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          <Link
            to="/cliente"
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${
              isClientAuthenticated
                ? 'border-[#D97706]/50 bg-[#D97706]/10 text-[#F59E0B] hover:bg-[#D97706]/20'
                : 'border-[#232730] bg-[#14171D] text-[#F8FAFC] hover:border-[#D97706]/40'
            }`}
          >
            <User className="h-3.5 w-3.5 text-[#D97706]" />
            {isClientAuthenticated ? `Olá, ${firstName}` : 'Área do Cliente'}
          </Link>

          {showStaffShortcut ? (
            <Link
              to="/admin/agenda"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#232730] bg-[#14171D] px-3.5 text-xs font-semibold text-[#94A3B8] transition hover:border-[#D97706]/40 hover:text-[#F8FAFC]"
            >
              <Lock className="h-3.5 w-3.5 text-[#D97706]" />
              Painel
            </Link>
          ) : null}

          <Link
            to="/agendar"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#D97706] px-5 text-sm font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 transition hover:bg-[#F59E0B]"
          >
            <Calendar className="h-4 w-4" />
            Agendar Agora
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Abrir menu de navegação"
          aria-expanded={mobileOpen}
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#232730] bg-[#14171D] text-[#F8FAFC] md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-[#232730] bg-[#14171D] md:hidden"
          >
            <div className="flex flex-col gap-2 px-4 py-5">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[48px] items-center rounded-xl px-3 text-base font-medium text-[#F8FAFC] hover:bg-[#0B0D10]"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-1 gap-2.5 pt-2 border-t border-[#232730]">
                <Link
                  to="/agendar"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#D97706] px-4 text-sm font-bold text-[#0B0D10]"
                >
                  <Calendar className="h-4 w-4" />
                  Agendar Agora
                </Link>
                <Link
                  to="/cliente"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#D97706]/40 bg-[#0B0D10] px-4 text-sm font-semibold text-[#F8FAFC]"
                >
                  <User className="h-4 w-4 text-[#D97706]" />
                  {isClientAuthenticated
                    ? `Minha Conta (${firstName})`
                    : 'Entrar / Criar Cadastro'}
                </Link>
                {showStaffShortcut ? (
                  <Link
                    to="/admin/agenda"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#232730] bg-[#0B0D10] px-4 text-sm font-medium text-[#94A3B8]"
                  >
                    <Lock className="h-4 w-4 text-[#D97706]" />
                    Painel da Equipe
                  </Link>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
