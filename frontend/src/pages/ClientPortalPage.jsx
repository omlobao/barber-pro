import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Award,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  LogOut,
  Scissors,
  Sparkles,
  Ticket,
  UserCheck,
  XCircle,
} from 'lucide-react';
import clientApi from '@/api/clientApi';
import api from '@/api/client';
import { useClientAuth } from '@/context/ClientAuthContext';
import { PublicNavbar } from '@/components/PublicNavbar';
import { ClientAuthForms } from '@/components/client/ClientAuthForms';
import { SpellBadge } from '@/components/spell/SpellBadge';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  APPOINTMENT_STATUS_META,
  buildGoogleCalendarUrl,
  extractErrorMessage,
  formatCurrency,
  formatDateBR,
  formatPhoneMask,
} from '@/utils/formatters';

export default function ClientPortalPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nextPath = searchParams.get('next');
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  const {
    client,
    loadingClient,
    isClientAuthenticated,
    updateClientProfile,
    logoutClient,
  } = useClientAuth();

  const [coupons, setCoupons] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [portalFeedback, setPortalFeedback] = useState('');

  // Modal de edição de perfil
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Modal de cancelamento rápido
  const [cancelTarget, setCancelTarget] = useState(null);
  const [canceling, setCanceling] = useState(false);

  const loadPortalData = useCallback(async () => {
    if (!isClientAuthenticated) return;
    setLoadingPortal(true);
    try {
      const [couponsRes, appsRes] = await Promise.all([
        clientApi.get('/api/client/coupons/'),
        clientApi.get('/api/client/appointments/'),
      ]);
      setCoupons(Array.isArray(couponsRes.data) ? couponsRes.data : []);
      setAppointments(Array.isArray(appsRes.data) ? appsRes.data : []);
    } catch (err) {
      setPortalFeedback(
        extractErrorMessage(err, 'Erro ao carregar seus dados.')
      );
    } finally {
      setLoadingPortal(false);
    }
  }, [isClientAuthenticated]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  const openEditModal = () => {
    if (!client) return;
    setEditName(client.name || '');
    setEditPhone(formatPhoneMask(client.phone_number || ''));
    setEditEmail(client.email || '');
    setEditBirth(client.birth_date || '');
    setEditOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setPortalFeedback('');
    try {
      await updateClientProfile({
        name: editName.trim(),
        phone_number: editPhone,
        email: editEmail.trim() || null,
        birth_date: editBirth || null,
      });
      setEditOpen(false);
    } catch (err) {
      setPortalFeedback(
        extractErrorMessage(err, 'Não foi possível atualizar seu perfil.')
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCopyCoupon = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2200);
    } catch {
      setCopiedCode(code);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCanceling(true);
    setPortalFeedback('');
    try {
      await api.post(`/api/public/bookings/${cancelTarget.cancel_token}/cancel/`);
      setCancelTarget(null);
      await loadPortalData();
    } catch (err) {
      setPortalFeedback(
        extractErrorMessage(err, 'Não foi possível cancelar este agendamento.')
      );
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D10] pb-16 text-[#F8FAFC]">
      <PublicNavbar />

      <main className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        {loadingClient ? (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        ) : !isClientAuthenticated ? (
          <div className="mx-auto max-w-xl">
            <div className="mb-6 text-center">
              <SpellBadge variant="amber">ÁREA DO CLIENTE VIP</SpellBadge>
              <h1 className="font-display mt-3 text-3xl font-bold text-[#F8FAFC] sm:text-4xl">
                Sua Conta na Barber<span className="text-[#D97706]">Pro</span>
              </h1>
              <p className="mt-2 text-sm text-[#94A3B8]">
                Cadastre-se ou entre para reservar horários em segundos,
                acompanhar seu histórico de cortes e desbloquear cupons de
                desconto exclusivos.
              </p>
            </div>

            <ClientAuthForms
              defaultMode={initialTab}
              onSuccess={() => {
                if (nextPath) navigate(nextPath);
              }}
            />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Cabeçalho do Cliente Autenticado */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col justify-between gap-5 rounded-3xl border border-[#232730] bg-[#14171D] p-6 sm:flex-row sm:items-center sm:p-8"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D97706]/40 bg-[#0B0D10] text-[#F59E0B]">
                  <UserCheck className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
                      Olá, {client.name}
                    </h1>
                    <SpellBadge variant="amber" size="sm">
                      CLIENTE CADASTRADO
                    </SpellBadge>
                  </div>
                  <p className="mt-1 text-xs text-[#94A3B8] sm:text-sm">
                    {formatPhoneMask(client.phone_number)}
                    {client.email ? ` • ${client.email}` : ''}
                  </p>
                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-[#232730] bg-[#0B0D10] px-3 py-1 text-xs font-semibold text-[#F8FAFC]">
                    <Award className="h-3.5 w-3.5 text-[#F59E0B]" />
                    <span>
                      {client.total_visits} atendimento(s) concluído(s) na
                      barbearia
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  to="/agendar"
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 transition hover:bg-[#F59E0B] sm:text-sm"
                >
                  <Calendar className="h-4 w-4" />
                  Agendar Horário
                </Link>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-4 text-xs font-semibold text-[#F8FAFC] hover:border-[#D97706]/40"
                >
                  <Edit3 className="h-3.5 w-3.5 text-[#D97706]" />
                  Editar Dados
                </button>
                <button
                  type="button"
                  onClick={logoutClient}
                  className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 text-xs font-bold text-rose-400 hover:bg-rose-500/20"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </button>
              </div>
            </motion.section>

            {portalFeedback ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300"
              >
                {portalFeedback}
              </div>
            ) : null}

            {/* Seção de Cupons e Promoções Liberadas pelo Dono */}
            <section>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display flex items-center gap-2 text-xl font-bold text-[#F8FAFC] sm:text-2xl">
                    <Ticket className="h-5 w-5 text-[#F59E0B]" />
                    Meus Cupons & Benefícios
                  </h2>
                  <p className="mt-0.5 text-xs text-[#94A3B8] sm:text-sm">
                    Promoções ativas liberadas pela barbearia para sua conta.
                  </p>
                </div>
                <span role="status" aria-live="polite" className="sr-only">
                  {copiedCode ? `Cupom ${copiedCode} copiado` : ''}
                </span>
              </div>

              {loadingPortal ? (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </div>
              ) : coupons.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-[#232730] bg-[#14171D] p-6 text-center text-sm text-[#94A3B8]">
                  Nenhum cupom promocional ativo no momento. Fique de olho nas
                  próximas campanhas!
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {coupons.map((cp) => {
                    const isPct = cp.discount_type === 'PERCENTAGE';
                    const discountLabel = isPct
                      ? `${Number(cp.discount_value)}% OFF`
                      : `${formatCurrency(cp.discount_value)} OFF`;
                    const isCopied = copiedCode === cp.code;

                    return (
                      <div
                        key={cp.id}
                        className="flex flex-col justify-between rounded-2xl border border-[#D97706]/35 bg-gradient-to-br from-[#14171D] to-[#0B0D10] p-5 shadow-lg"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D97706]/50 bg-[#D97706]/15 px-3 py-1 font-mono text-sm font-extrabold tracking-wider text-[#F59E0B]">
                              <Sparkles className="h-3.5 w-3.5" />
                              {cp.code}
                            </span>
                            <span className="text-lg font-extrabold text-emerald-400">
                              {discountLabel}
                            </span>
                          </div>

                          <p className="mt-2.5 text-sm font-medium text-[#F8FAFC]">
                            {cp.description || 'Desconto especial no agendamento online'}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#94A3B8]">
                            {Number(cp.min_order_amount) > 0 ? (
                              <span>
                                Pedido mín.:{' '}
                                <strong className="text-[#F8FAFC]">
                                  {formatCurrency(cp.min_order_amount)}
                                </strong>
                              </span>
                            ) : (
                              <span>Sem valor mínimo</span>
                            )}
                            {cp.valid_until ? (
                              <span>
                                • Válido até {formatDateBR(cp.valid_until)}
                              </span>
                            ) : null}
                            {cp.only_first_visit ? (
                              <span className="text-[#F59E0B]">
                                • Exclusivo 1ª visita
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2.5 border-t border-[#232730] pt-3.5">
                          <button
                            type="button"
                            onClick={() => handleCopyCoupon(cp.code)}
                            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-bold text-[#F8FAFC] transition hover:border-[#D97706]/50"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                Código Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 text-[#D97706]" />
                                Copiar Código
                              </>
                            )}
                          </button>

                          <Link
                            to={`/agendar?coupon=${encodeURIComponent(cp.code)}`}
                            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D97706] px-3 text-xs font-bold text-[#0B0D10] transition hover:bg-[#F59E0B]"
                          >
                            Usar Agora
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Seção de Histórico e Próximos Agendamentos */}
            <section>
              <h2 className="font-display flex items-center gap-2 text-xl font-bold text-[#F8FAFC] sm:text-2xl">
                <Scissors className="h-5 w-5 text-[#D97706]" />
                Meus Agendamentos ({appointments.length})
              </h2>
              <p className="mt-0.5 text-xs text-[#94A3B8] sm:text-sm">
                Acompanhe seus horários confirmados e seu histórico completo.
              </p>

              {loadingPortal ? (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : appointments.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-[#232730] bg-[#14171D] p-8 text-center">
                  <Calendar className="mx-auto h-9 w-9 text-[#94A3B8]" />
                  <p className="mt-3 text-base font-bold text-[#F8FAFC]">
                    Você ainda não possui agendamentos registrados
                  </p>
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    Escolha seu barbeiro favorito e aproveite seus cupons de
                    desconto!
                  </p>
                  <Link
                    to="/agendar"
                    className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#D97706] px-6 text-sm font-bold text-[#0B0D10]"
                  >
                    Fazer Meu Primeiro Agendamento
                  </Link>
                </div>
              ) : (
                <div className="mt-4 space-y-3.5">
                  {appointments.map((app) => {
                    const meta =
                      APPOINTMENT_STATUS_META[app.status] ||
                      APPOINTMENT_STATUS_META.CONFIRMED;
                    const canCancel = ['PENDING', 'CONFIRMED'].includes(
                      app.status
                    );
                    const hasDiscount = Number(app.discount_amount || 0) > 0;

                    return (
                      <div
                        key={app.id}
                        className="flex flex-col justify-between gap-4 rounded-2xl border border-[#232730] bg-[#14171D] p-5 sm:flex-row sm:items-center"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#F59E0B]">
                              <Clock className="h-4 w-4" />
                              {formatDateBR(app.date)} às{' '}
                              {String(app.start_time).slice(0, 5)}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.badge}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                              />
                              {app.status_display || meta.label}
                            </span>
                            {app.coupon_code ? (
                              <SpellBadge variant="emerald" size="sm">
                                CUPOM {app.coupon_code}
                              </SpellBadge>
                            ) : null}
                          </div>

                          <p className="text-sm font-bold text-[#F8FAFC]">
                            Barbeiro: {app.professional_name}
                          </p>
                          <p className="text-xs text-[#94A3B8]">
                            {(app.items || [])
                              .map((i) => i.service_name)
                              .join(' + ')}
                          </p>
                        </div>

                        <div className="flex flex-col items-start gap-3 sm:items-end">
                          <div className="sm:text-right">
                            {hasDiscount ? (
                              <span className="mr-2 text-xs text-[#94A3B8] line-through">
                                {formatCurrency(app.subtotal_price)}
                              </span>
                            ) : null}
                            <span className="text-lg font-extrabold text-[#F59E0B]">
                              {formatCurrency(app.total_price)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/meu-agendamento/${app.cancel_token}`}
                              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold text-[#F8FAFC] hover:border-[#D97706]/50"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-[#D97706]" />
                              Comprovante
                            </Link>

                            {canCancel ? (
                              <>
                                <a
                                  href={buildGoogleCalendarUrl({
                                    title: `BarberPro — ${app.professional_name}`,
                                    date: app.date,
                                    startTime: app.start_time,
                                    endTime: app.end_time,
                                  })}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC]"
                                >
                                  <CalendarPlus className="h-3.5 w-3.5 text-[#D97706]" />
                                  Agenda
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setCancelTarget(app)}
                                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-bold text-rose-400 hover:bg-rose-500/20"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Cancelar
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Modal de Edição de Perfil */}
      <ModalDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Atualizar Meus Dados"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label
              htmlFor="portal-edit-name"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Nome Completo *
            </label>
            <input
              id="portal-edit-name"
              name="name"
              required
              autoComplete="name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3.5 text-sm text-[#F8FAFC]"
            />
          </div>
          <div>
            <label
              htmlFor="portal-edit-phone"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              WhatsApp com DDD *
            </label>
            <input
              id="portal-edit-phone"
              name="tel"
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(formatPhoneMask(e.target.value))}
              className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3.5 text-sm text-[#F8FAFC]"
            />
          </div>
          <div>
            <label
              htmlFor="portal-edit-email"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              E-mail
            </label>
            <input
              id="portal-edit-email"
              name="email"
              type="email"
              autoComplete="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3.5 text-sm text-[#F8FAFC]"
            />
          </div>
          <div>
            <label
              htmlFor="portal-edit-birth"
              className="mb-1 block text-xs font-semibold text-[#F8FAFC]"
            >
              Data de Nascimento
            </label>
            <input
              id="portal-edit-birth"
              name="bday"
              type="date"
              autoComplete="bday"
              value={editBirth}
              onChange={(e) => setEditBirth(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-[#232730] bg-[#0B0D10] px-3.5 text-sm text-[#F8FAFC]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="min-h-[44px] rounded-xl border border-[#232730] px-4 text-xs font-semibold text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingProfile}
              className="min-h-[44px] rounded-xl bg-[#D97706] px-5 text-xs font-bold text-[#0B0D10]"
            >
              {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal de Confirmação de Cancelamento */}
      <ModalDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancelar este agendamento?"
        subtitle="A vaga será liberada imediatamente na agenda do barbeiro."
      >
        <p className="text-sm text-[#94A3B8]">
          Confirma o cancelamento do horário em{' '}
          <strong className="text-[#F8FAFC]">
            {formatDateBR(cancelTarget?.date)} às{' '}
            {String(cancelTarget?.start_time || '').slice(0, 5)}
          </strong>{' '}
          com <strong className="text-[#F8FAFC]">{cancelTarget?.professional_name}</strong>?
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            onClick={() => setCancelTarget(null)}
            className="min-h-[48px] rounded-xl border border-[#232730] bg-[#0B0D10] px-5 text-sm font-semibold text-[#F8FAFC]"
          >
            Manter Horário
          </button>
          <button
            type="button"
            disabled={canceling}
            onClick={handleConfirmCancel}
            className="min-h-[48px] rounded-xl bg-rose-600 px-5 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {canceling ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
