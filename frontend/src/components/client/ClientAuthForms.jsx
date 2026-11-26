import React, { useId, useState } from 'react';
import {
  Eye,
  EyeOff,
  LogIn,
  Mail,
  Phone,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react';
import { useClientAuth } from '@/context/ClientAuthContext';
import { extractErrorMessage, formatPhoneMask } from '@/utils/formatters';

export function ClientAuthForms({
  defaultMode = 'login',
  onSuccess,
  compact = false,
}) {
  const { loginClient, registerClient } = useClientAuth();
  const baseId = useId();

  const [mode, setMode] = useState(defaultMode);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Campos de Login
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Campos de Cadastro
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const logged = await loginClient(identifier.trim(), loginPassword);
      onSuccess?.(logged);
    } catch (err) {
      setError(
        extractErrorMessage(err, 'WhatsApp/e-mail ou senha incorretos.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Informe seu WhatsApp completo com DDD.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await registerClient({
        name: fullName.trim(),
        phone_number: digits,
        email: email.trim() || null,
        birth_date: birthDate || null,
        password: newPassword,
      });
      onSuccess?.(created);
    } catch (err) {
      setError(
        extractErrorMessage(
          err,
          'Não foi possível concluir seu cadastro. Verifique os dados.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoClient = () => {
    setMode('login');
    setError('');
    setIdentifier('(11) 98800-3344');
    setLoginPassword('cliente123');
  };

  return (
    <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5 sm:p-6">
      {/* Seletor de Abas (Entrar x Criar Conta) */}
      <div
        role="tablist"
        aria-label="Acesso à conta do cliente"
        className="grid grid-cols-2 gap-2 rounded-xl border border-[#232730] bg-[#0B0D10] p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          onClick={() => switchMode('register')}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition sm:text-sm ${
            mode === 'register'
              ? 'bg-[#D97706] text-[#0B0D10] shadow-md shadow-[#D97706]/20'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          <span>Criar Cadastro</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          onClick={() => switchMode('login')}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition sm:text-sm ${
            mode === 'login'
              ? 'bg-[#D97706] text-[#0B0D10] shadow-md shadow-[#D97706]/20'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <LogIn className="h-4 w-4 shrink-0" />
          <span>Já Tenho Conta</span>
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-300"
        >
          {error}
        </div>
      ) : null}

      {mode === 'login' ? (
        <form
          onSubmit={handleLoginSubmit}
          method="POST"
          action="/api/client/login/"
          aria-label="Entrar na conta do cliente"
          className="mt-5 space-y-4"
        >
          <div>
            <label
              htmlFor={`${baseId}-login-id`}
              className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
            >
              Seu WhatsApp (com DDD) ou E-mail *
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                id={`${baseId}-login-id`}
                name="username"
                type="text"
                required
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="(11) 99999-9999 ou seu@email.com"
                value={identifier}
                onChange={(e) => {
                  setError('');
                  const val = e.target.value;
                  const looksLikePhone =
                    !val.includes('@') && /^[\d()\s-]+$/.test(val) && val.length > 0;
                  setIdentifier(looksLikePhone ? formatPhoneMask(val) : val);
                }}
                className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-4 pl-10 text-base text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={`${baseId}-login-password`}
              className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
            >
              Senha *
            </label>
            <div className="relative">
              <input
                id={`${baseId}-login-password`}
                name="password"
                type={showLoginPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                enterKeyHint="done"
                placeholder="Digite sua senha"
                value={loginPassword}
                onChange={(e) => {
                  setError('');
                  setLoginPassword(e.target.value);
                }}
                className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-12 pl-4 text-base text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none sm:text-sm"
              />
              <button
                type="button"
                aria-pressed={showLoginPassword}
                aria-label={
                  showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'
                }
                onClick={() => setShowLoginPassword((prev) => !prev)}
                className="absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                {showLoginPassword ? (
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
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#D97706] px-6 text-sm font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 transition hover:bg-[#F59E0B] disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {submitting ? 'Entrando...' : 'Entrar na Minha Conta'}
          </button>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={fillDemoClient}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D97706]/30 bg-[#D97706]/10 px-3 py-1.5 text-[11px] font-semibold text-[#F59E0B] transition hover:bg-[#D97706]/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Preencher Cliente Demo (Felipe • 1ª Visita)
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={handleRegisterSubmit}
          method="POST"
          action="/api/client/register/"
          aria-label="Criar cadastro de cliente"
          className="mt-5 space-y-4"
        >
          <div>
            <label
              htmlFor={`${baseId}-reg-name`}
              className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
            >
              Nome Completo *
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                id={`${baseId}-reg-name`}
                name="full-name"
                type="text"
                required
                autoComplete="name"
                enterKeyHint="next"
                placeholder="Ex.: Gabriel Almeida"
                value={fullName}
                onChange={(e) => {
                  setError('');
                  setFullName(e.target.value);
                }}
                className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-4 pl-10 text-base text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none sm:text-sm"
              />
            </div>
          </div>

          <div
            className={`grid grid-cols-1 gap-4 ${
              compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'
            }`}
          >
            <div>
              <label
                htmlFor={`${baseId}-reg-phone`}
                className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
              >
                WhatsApp com DDD *
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  id={`${baseId}-reg-phone`}
                  name="tel"
                  type="tel"
                  inputMode="tel"
                  required
                  autoComplete="tel"
                  enterKeyHint="next"
                  placeholder="(11) 99999-9999"
                  value={phoneNumber}
                  onChange={(e) => {
                    setError('');
                    setPhoneNumber(formatPhoneMask(e.target.value));
                  }}
                  className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-4 pl-10 text-base text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor={`${baseId}-reg-birth`}
                className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
              >
                Data de Nascimento (opcional)
              </label>
              <input
                id={`${baseId}-reg-birth`}
                name="bday"
                type="date"
                autoComplete="bday"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3.5 text-base text-[#F8FAFC] focus:border-[#D97706] focus:outline-none sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={`${baseId}-reg-email`}
              className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
            >
              E-mail (opcional — para recuperar acesso e promoções)
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                id={`${baseId}-reg-email`}
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => {
                  setError('');
                  setEmail(e.target.value);
                }}
                className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-4 pl-10 text-base text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={`${baseId}-reg-password`}
              className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
            >
              Crie uma Senha * (mínimo de 6 caracteres)
            </label>
            <div className="relative">
              <input
                id={`${baseId}-reg-password`}
                name="new-password"
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                enterKeyHint="done"
                aria-describedby={`${baseId}-pwd-hint`}
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => {
                  setError('');
                  setNewPassword(e.target.value);
                }}
                className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] pr-12 pl-4 text-base text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none sm:text-sm"
              />
              <button
                type="button"
                aria-pressed={showNewPassword}
                aria-label={
                  showNewPassword ? 'Ocultar senha' : 'Mostrar senha'
                }
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p
              id={`${baseId}-pwd-hint`}
              className="mt-1 text-[11px] text-[#94A3B8]"
            >
              Se você já cortou conosco no balcão, seu histórico de visitas será
              vinculado automaticamente pelo WhatsApp.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#D97706] px-6 text-sm font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 transition hover:bg-[#F59E0B] disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {submitting ? 'Criando sua conta...' : 'Criar Minha Conta'}
          </button>
        </form>
      )}
    </div>
  );
}
