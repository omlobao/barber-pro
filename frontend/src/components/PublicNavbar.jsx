import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Lock, Menu, User, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useClientAuth } from '@/context/ClientAuthContext';

const NAV_LINKS = [
  { href: '/#inicio', label: 'Início', matchHash: '' },
  { href: '/#sobre', label: 'Sobre', matchHash: '#sobre' },
  { href: '/#servicos', label: 'Serviços', matchHash: '#servicos' },
  { href: '/#equipe', label: 'Barbeiros', matchHash: '#equipe' },
  { href: '/#galeria', label: 'Galeria', matchHash: '#galeria' },
  { href: '/#localizacao', label: 'Contato', matchHash: '#localizacao' },
];

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated: isStaffAuthenticated } = useAuth();
  const { client, isClientAuthenticated } = useClientAuth();

  const firstName = client?.name ? client.name.trim().split(' ')[0] : '';
  const showStaffShortcut = isStaffAuthenticated && !isClientAuthenticated;
  const isLanding = location.pathname === '/';

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0B0D10]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Marca Editorial Estilo Noir & Blade */}
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="font-display text-2xl font-bold tracking-tight text-[#E5A93C] transition group-hover:text-[#F5B942]">
            Barber<span className="font-normal italic text-[#F8FAFC]">&amp;</span>Pro
          </span>
        </Link>

        {/* Menu Central em Pílula Flutuante */}
        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-1 rounded-full border border-white/10 bg-[#14171D]/90 p-1.5 shadow-lg shadow-black/30 backdrop-blur-md lg:flex"
        >
          {NAV_LINKS.map((link, idx) => {
            const isActive =
              isLanding &&
              (location.hash === link.matchHash ||
                (!location.hash && idx === 0));
            return (
              <a
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[#E5A93C] text-[#0B0D10] shadow-sm'
                    : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Ações à Direita (Conta do Cliente + CTA Pílula Dourada) */}
        <div className="hidden items-center gap-2.5 md:flex">
          <Link
            to="/cliente"
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 text-xs font-semibold transition ${
              isClientAuthenticated
                ? 'border-[#E5A93C]/50 bg-[#E5A93C]/10 text-[#E5A93C] hover:bg-[#E5A93C]/20'
                : 'border-white/12 bg-[#14171D]/90 text-[#F8FAFC] hover:border-[#E5A93C]/40'
            }`}
          >
            <User className="h-3.5 w-3.5 text-[#E5A93C]" />
            {isClientAuthenticated ? `Olá, ${firstName}` : 'Minha Conta'}
          </Link>

          {showStaffShortcut ? (
            <Link
              to="/admin/agenda"
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full border border-white/10 bg-[#14171D] px-3.5 text-xs font-semibold text-[#94A3B8] transition hover:border-[#E5A93C]/40 hover:text-[#F8FAFC]"
            >
              <Lock className="h-3.5 w-3.5 text-[#E5A93C]" />
              Painel
            </Link>
          ) : null}

          <Link
            to="/agendar"
            className="group inline-flex min-h-[44px] items-center gap-2.5 rounded-full bg-[#E5A93C] py-1.5 pr-2 pl-5 text-xs font-bold text-[#0B0D10] shadow-lg shadow-[#E5A93C]/20 transition hover:bg-[#F5B942]"
          >
            <span>Agendar Agora</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B0D10] text-[#E5A93C] transition-transform group-hover:translate-x-0.5">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Abrir menu de navegação"
          aria-expanded={mobileOpen}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-[#14171D] text-[#F8FAFC] md:hidden"
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
            <div className="flex flex-col gap-1.5 px-4 py-5">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[46px] items-center rounded-full px-4 text-sm font-medium text-[#F8FAFC] hover:bg-[#0B0D10]"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-[#232730] pt-3">
                <Link
                  to="/agendar"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#E5A93C] px-5 text-sm font-bold text-[#0B0D10]"
                >
                  <span>Agendar Agora</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/cliente"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#E5A93C]/40 bg-[#0B0D10] px-4 text-sm font-semibold text-[#F8FAFC]"
                >
                  <User className="h-4 w-4 text-[#E5A93C]" />
                  {isClientAuthenticated
                    ? `Minha Conta (${firstName})`
                    : 'Entrar / Criar Cadastro'}
                </Link>
                {showStaffShortcut ? (
                  <Link
                    to="/admin/agenda"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#232730] bg-[#0B0D10] px-4 text-sm font-medium text-[#94A3B8]"
                  >
                    <Lock className="h-4 w-4 text-[#E5A93C]" />
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
