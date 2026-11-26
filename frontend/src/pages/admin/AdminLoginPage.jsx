import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Lock, Scissors, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { extractErrorMessage } from '@/utils/formatters';

export default function AdminLoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    const dest = location.state?.from?.pathname || '/admin/agenda';
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password);
      const dest = location.state?.from?.pathname || '/admin/agenda';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(
        extractErrorMessage(
          err,
          'Usuário ou senha inválidos. Verifique suas credenciais.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0D10] px-4 py-12 text-[#F8FAFC]">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[#94A3B8] transition hover:text-[#F8FAFC]"
        >
          <ArrowLeft className="h-4 w-4 text-[#D97706]" />
          Voltar para a vitrine pública
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-[#232730] bg-[#14171D] p-7 shadow-2xl sm:p-9"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D97706]/40 bg-[#0B0D10] text-[#D97706]">
              <Scissors className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-[#F8FAFC]">
                Acesso da Equipe
              </h1>
              <p className="text-xs text-[#94A3B8]">
                Painel Administrativo & Barbeiros
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-medium text-rose-300">
                {error}
              </div>
            ) : null}

            <div>
              <label
                htmlFor="login-username"
                className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
              >
                Usuário
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  enterKeyHint="next"
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-4 pl-10 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  enterKeyHint="done"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-12 pl-10 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute top-1/2 right-2.5 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex min-h-[50px] w-full items-center justify-center rounded-xl bg-[#D97706] px-5 text-sm font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/25 transition hover:bg-[#F59E0B] disabled:opacity-60"
            >
              {submitting ? 'Autenticando...' : 'Entrar no Painel'}
            </button>
          </form>

          {/* Atalho de credenciais demo geradas no seed */}
          <div className="mt-6 border-t border-[#232730] pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              Acesso Rápido (Ambiente Demo)
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('admin', 'admin123')}
                className="min-h-[40px] rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold text-[#F59E0B] transition hover:border-[#D97706]"
              >
                Admin (Dono)
              </button>
              <button
                type="button"
                onClick={() => fillDemo('matheus', 'barber123')}
                className="min-h-[40px] rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold text-[#94A3B8] transition hover:border-[#D97706] hover:text-[#F8FAFC]"
              >
                Barbeiro (Matheus)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
