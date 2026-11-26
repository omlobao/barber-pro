import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  LogOut,
  Share2,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import api from '@/api/client';
import clientApi from '@/api/clientApi';
import { useClientAuth } from '@/context/ClientAuthContext';
import { PublicNavbar } from '@/components/PublicNavbar';
import { ClientAuthForms } from '@/components/client/ClientAuthForms';
import { SpellBadge } from '@/components/spell/SpellBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  CATEGORY_LABELS,
  buildGoogleCalendarUrl,
  extractErrorMessage,
  formatCurrency,
  formatDateBR,
  formatPhoneMask,
  getNextDays,
  groupSlotsByPeriod,
} from '@/utils/formatters';

const STEPS = [
  { num: 1, label: 'Serviços' },
  { num: 2, label: 'Profissional' },
  { num: 3, label: 'Data & Hora' },
  { num: 4, label: 'Confirmação' },
];

export default function BookingWizardPage() {
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get('service');
  const preselectedProf = searchParams.get('professional');
  const preselectedCoupon = searchParams.get('coupon');

  const {
    client,
    isClientAuthenticated,
    logoutClient,
  } = useClientAuth();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [selectedProfChoice, setSelectedProfChoice] = useState('ANY');

  const days = useMemo(() => getNextDays(30), []);
  const [selectedDate, setSelectedDate] = useState(() => {
    const firstNonSunday = days.find((d) => !d.isSunday);
    return firstNonSunday ? firstNonSunday.iso : days[0]?.iso;
  });

  const [availability, setAvailability] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Cupons & Confirmação no Passo 4
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponInput, setCouponInput] = useState(preselectedCoupon || '');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState('');

  const [clientNotes, setClientNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdBooking, setCreatedBooking] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/api/public/services/'),
      api.get('/api/public/professionals/'),
    ])
      .then(([srvRes, profRes]) => {
        if (!active) return;
        const srvList = Array.isArray(srvRes.data) ? srvRes.data : [];
        const profList = Array.isArray(profRes.data) ? profRes.data : [];
        setServices(srvList);
        setProfessionals(profList);

        if (preselectedService && srvList.some((s) => s.id === preselectedService)) {
          setSelectedServiceIds([preselectedService]);
        }
        if (preselectedProf && profList.some((p) => p.id === preselectedProf)) {
          setSelectedProfChoice(preselectedProf);
        }
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });

    return () => {
      active = false;
    };
  }, [preselectedService, preselectedProf]);

  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)),
    [services, selectedServiceIds]
  );

  const subtotalPrice = useMemo(
    () =>
      selectedServices.reduce(
        (acc, s) => acc + Number(s.effective_price ?? s.price ?? 0),
        0
      ),
    [selectedServices]
  );

  const discountAmount = Number(appliedCoupon?.discount_amount || 0);
  const finalPrice = Math.max(0, subtotalPrice - discountAmount);

  const totalDuration = useMemo(
    () =>
      selectedServices.reduce(
        (acc, s) => acc + Number(s.duration_minutes || 0),
        0
      ),
    [selectedServices]
  );

  const eligibleProfessionals = useMemo(() => {
    if (selectedServiceIds.length === 0) return professionals;
    return professionals.filter((prof) => {
      const profServiceSet = new Set((prof.services || []).map(String));
      return selectedServiceIds.every((id) => profServiceSet.has(String(id)));
    });
  }, [professionals, selectedServiceIds]);

  useEffect(() => {
    if (
      selectedProfChoice !== 'ANY' &&
      !eligibleProfessionals.some((p) => p.id === selectedProfChoice)
    ) {
      setSelectedProfChoice('ANY');
    }
  }, [eligibleProfessionals, selectedProfChoice]);

  // Limpa o cupom aplicado se os serviços mudarem ou o cliente deslogar
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponFeedback('');
  }, [selectedServiceIds, isClientAuthenticated]);

  const validateAndApplyCoupon = useCallback(
    async (rawCode) => {
      const code = (rawCode || '').trim().toUpperCase();
      if (!code || !isClientAuthenticated || selectedServiceIds.length === 0) {
        return;
      }
      setValidatingCoupon(true);
      setCouponFeedback('');
      try {
        const { data } = await clientApi.post('/api/client/validate-coupon/', {
          code,
          service_ids: selectedServiceIds,
        });
        setAppliedCoupon(data);
        setCouponInput(data.code);
      } catch (err) {
        setAppliedCoupon(null);
        setCouponFeedback(
          extractErrorMessage(err, 'Não foi possível aplicar este cupom.')
        );
      } finally {
        setValidatingCoupon(false);
      }
    },
    [isClientAuthenticated, selectedServiceIds]
  );

  // Carrega cupons elegíveis quando autenticado no Passo 4
  useEffect(() => {
    if (step !== 4 || !isClientAuthenticated) return;
    let active = true;
    clientApi
      .get('/api/client/coupons/')
      .then(({ data }) => {
        if (!active) return;
        setAvailableCoupons(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setAvailableCoupons([]);
      });

    return () => {
      active = false;
    };
  }, [step, isClientAuthenticated]);

  // Se veio com ?coupon=CODIGO da Área do Cliente, aplica automaticamente no Passo 4
  useEffect(() => {
    if (
      step === 4 &&
      isClientAuthenticated &&
      preselectedCoupon &&
      !appliedCoupon &&
      selectedServiceIds.length > 0
    ) {
      validateAndApplyCoupon(preselectedCoupon);
    }
  }, [
    step,
    isClientAuthenticated,
    preselectedCoupon,
    appliedCoupon,
    selectedServiceIds,
    validateAndApplyCoupon,
  ]);

  // Consulta disponibilidade no Passo 3
  useEffect(() => {
    if (step !== 3 || !selectedDate || selectedServiceIds.length === 0) return;

    let active = true;
    setLoadingSlots(true);
    setSelectedSlot(null);

    const params = {
      date: selectedDate,
      service_ids: selectedServiceIds.join(','),
    };
    if (selectedProfChoice && selectedProfChoice !== 'ANY') {
      params.professional_id = selectedProfChoice;
    }

    api
      .get('/api/public/availability/', { params })
      .then(({ data }) => {
        if (!active) return;
        setAvailability(
          Array.isArray(data?.availability) ? data.availability : []
        );
      })
      .catch(() => {
        if (active) setAvailability([]);
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [step, selectedDate, selectedServiceIds, selectedProfChoice]);

  const slotEntries = useMemo(() => {
    if (selectedProfChoice !== 'ANY') {
      const profBlock = availability[0];
      if (!profBlock) return [];
      return (profBlock.slots || []).map((t) => ({
        time: t,
        professionalId: profBlock.professional_id,
        professionalName: profBlock.professional_name,
      }));
    }

    const mapByTime = new Map();
    for (const profBlock of availability) {
      for (const t of profBlock.slots || []) {
        if (!mapByTime.has(t)) {
          mapByTime.set(t, {
            time: t,
            professionalId: profBlock.professional_id,
            professionalName: profBlock.professional_name,
            optionsCount: 1,
          });
        } else {
          mapByTime.get(t).optionsCount += 1;
        }
      }
    }
    return Array.from(mapByTime.values()).sort((a, b) =>
      a.time.localeCompare(b.time)
    );
  }, [availability, selectedProfChoice]);

  const groupedSlots = useMemo(
    () => groupSlotsByPeriod(slotEntries),
    [slotEntries]
  );

  const goToStep = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setSubmitError('');
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleService = (id) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const canAdvance =
    (step === 1 && selectedServiceIds.length > 0) ||
    (step === 2 &&
      (selectedProfChoice === 'ANY' || Boolean(selectedProfChoice))) ||
    (step === 3 && Boolean(selectedSlot));

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !isClientAuthenticated) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const { data } = await clientApi.post('/api/public/bookings/', {
        professional_id: selectedSlot.professionalId,
        service_ids: selectedServiceIds,
        date: selectedDate,
        start_time: selectedSlot.time,
        coupon_code: appliedCoupon?.code || '',
        client_notes: clientNotes.trim(),
      });
      setCreatedBooking(data);
    } catch (err) {
      setSubmitError(
        extractErrorMessage(
          err,
          'Não foi possível confirmar este horário. Tente outro horário.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  // TELA DE SUCESSO PÓS-AGENDAMENTO
  if (createdBooking) {
    const managePath = `/meu-agendamento/${createdBooking.cancel_token}`;
    const fullManageUrl = `${window.location.origin}${managePath}`;
    const gcalUrl = buildGoogleCalendarUrl({
      title: `BarberPro — ${createdBooking.professional_name}`,
      date: createdBooking.date,
      startTime: createdBooking.start_time,
      endTime: createdBooking.end_time,
      details: `Serviços: ${(createdBooking.items || [])
        .map((i) => i.service_name)
        .join(', ')}. Gerenciar horário: ${fullManageUrl}`,
    });
    const whatsappShareText = encodeURIComponent(
      `Meu horário na BarberPro está confirmado!\n` +
        `📅 Data: ${formatDateBR(createdBooking.date)} às ${String(
          createdBooking.start_time
        ).slice(0, 5)}\n` +
        `💈 Profissional: ${createdBooking.professional_name}\n` +
        `🔗 Comprovante / Gerenciar: ${fullManageUrl}`
    );
    const hasBookingDiscount = Number(createdBooking.discount_amount || 0) > 0;

    return (
      <div className="min-h-screen bg-[#0B0D10] text-[#F8FAFC]">
        <PublicNavbar />
        <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="rounded-3xl border border-[#232730] bg-[#14171D] p-6 shadow-2xl sm:p-10"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="mt-5 text-center">
              <SpellBadge variant="emerald">HORÁRIO CONFIRMADO</SpellBadge>
              <h1 className="font-display mt-3 text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
                Tudo pronto, {createdBooking.client_name}!
              </h1>
              <p className="mt-2 text-sm text-[#94A3B8]">
                Sua cadeira já está reservada e vinculada à sua conta. Confira os
                detalhes abaixo.
              </p>
            </div>

            <div className="mt-8 space-y-3 rounded-2xl border border-[#232730] bg-[#0B0D10] p-5 text-sm">
              <div className="flex justify-between border-b border-[#232730] pb-2.5">
                <span className="text-[#94A3B8]">Profissional</span>
                <span className="font-bold text-[#F8FAFC]">
                  {createdBooking.professional_name}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#232730] pb-2.5">
                <span className="text-[#94A3B8]">Data e Horário</span>
                <span className="font-bold text-[#F59E0B]">
                  {formatDateBR(createdBooking.date)} •{' '}
                  {String(createdBooking.start_time).slice(0, 5)} às{' '}
                  {String(createdBooking.end_time).slice(0, 5)}
                </span>
              </div>
              <div className="border-b border-[#232730] pb-2.5">
                <span className="block text-[#94A3B8]">Serviços</span>
                <ul className="mt-1.5 space-y-1">
                  {(createdBooking.items || []).map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between text-[#F8FAFC]"
                    >
                      <span>{item.service_name}</span>
                      <span className="text-[#94A3B8]">
                        {formatCurrency(item.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {hasBookingDiscount ? (
                <>
                  <div className="flex justify-between text-xs text-[#94A3B8]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(createdBooking.subtotal_price)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-400">
                    <span>
                      Cupom Aplicado ({createdBooking.coupon_code})
                    </span>
                    <span>
                      -{formatCurrency(createdBooking.discount_amount)}
                    </span>
                  </div>
                </>
              ) : null}

              <div className="flex justify-between pt-1 text-base font-bold">
                <span>Total Final</span>
                <span className="text-[#F59E0B]">
                  {formatCurrency(createdBooking.total_price)}
                </span>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#D97706] px-4 text-sm font-bold text-[#0B0D10] transition hover:bg-[#F59E0B]"
              >
                <CalendarPlus className="h-4 w-4" />
                Adicionar ao Google Agenda
              </a>
              <a
                href={`https://wa.me/?text=${whatsappShareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-400 transition hover:bg-emerald-500/20"
              >
                <Share2 className="h-4 w-4" />
                Compartilhar no WhatsApp
              </a>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                to={managePath}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#232730] bg-[#0B0D10] px-4 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#D97706]/50"
              >
                <ExternalLink className="h-4 w-4 text-[#D97706]" />
                Comprovante Direto
              </Link>
              <Link
                to="/cliente"
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#D97706]/40 bg-[#D97706]/10 px-4 text-sm font-bold text-[#F59E0B] transition hover:bg-[#D97706]/20"
              >
                <UserCheck className="h-4 w-4" />
                Minha Área do Cliente
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D10] pb-32 text-[#F8FAFC] md:pb-16">
      <PublicNavbar />

      <main className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        {/* Barra de Progresso Animada */}
        <nav
          aria-label="Etapas do agendamento"
          className="mb-8 rounded-2xl border border-[#232730] bg-[#14171D] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#94A3B8]">
            {STEPS.map((s) => {
              const active = step === s.num;
              const done = step > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  disabled={s.num > step}
                  onClick={() => s.num < step && goToStep(s.num)}
                  className={`flex items-center gap-2 transition ${
                    active
                      ? 'text-[#F59E0B]'
                      : done
                      ? 'cursor-pointer text-[#F8FAFC]'
                      : 'cursor-default text-[#94A3B8]/60'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      active
                        ? 'bg-[#D97706] text-[#0B0D10]'
                        : done
                        ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                        : 'border border-[#232730] bg-[#0B0D10]'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#0B0D10]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#D97706] to-[#F59E0B]"
              initial={false}
              animate={{ width: `${(step / STEPS.length) * 100}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
        </nav>

        {/* Conteúdo dos Passos com AnimatePresence Horizontal */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            {/* PASSO 1: SERVIÇOS */}
            {step === 1 ? (
              <section>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">
                  1. Escolha os Serviços
                </h1>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Você pode selecionar um ou mais serviços para o mesmo horário.
                </p>

                {loadingCatalog ? (
                  <div className="mt-6 space-y-3">
                    {[1, 2, 3, 4].map((n) => (
                      <Skeleton key={n} className="h-24 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {services.map((srv) => {
                      const checked = selectedServiceIds.includes(srv.id);
                      const promo =
                        srv.promotion_price ?? srv.promotional_price;
                      const hasPromo =
                        promo !== null &&
                        promo !== undefined &&
                        Number(promo) < Number(srv.price);

                      return (
                        <motion.button
                          key={srv.id}
                          type="button"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleService(srv.id)}
                          className={`flex min-h-[96px] flex-col justify-between rounded-2xl border p-4 text-left transition ${
                            checked
                              ? 'border-[#D97706] bg-[#D97706]/10 shadow-lg shadow-[#D97706]/10'
                              : 'border-[#232730] bg-[#14171D] hover:border-[#D97706]/40'
                          }`}
                        >
                          <div className="flex w-full items-start justify-between gap-3">
                            <div>
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                                {CATEGORY_LABELS[srv.category] || srv.category}
                              </span>
                              <h3 className="mt-0.5 text-base font-bold text-[#F8FAFC]">
                                {srv.name}
                              </h3>
                            </div>
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                                checked
                                  ? 'border-[#D97706] bg-[#D97706] text-[#0B0D10]'
                                  : 'border-[#232730] bg-[#0B0D10]'
                              }`}
                            >
                              {checked ? <Check className="h-4 w-4" /> : null}
                            </span>
                          </div>

                          <div className="mt-4 flex w-full items-center justify-between border-t border-[#232730]/70 pt-2">
                            <span className="inline-flex items-center gap-1 text-xs text-[#94A3B8]">
                              <Clock className="h-3.5 w-3.5 text-[#D97706]" />
                              {srv.duration_minutes} min
                            </span>
                            <div className="flex items-baseline gap-2">
                              {hasPromo ? (
                                <>
                                  <span className="text-xs text-[#94A3B8] line-through">
                                    {formatCurrency(srv.price)}
                                  </span>
                                  <span className="text-base font-extrabold text-[#F59E0B]">
                                    {formatCurrency(promo)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-base font-extrabold text-[#F8FAFC]">
                                  {formatCurrency(
                                    srv.effective_price ?? srv.price
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {/* PASSO 2: PROFISSIONAL */}
            {step === 2 ? (
              <section>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="font-display text-2xl font-bold sm:text-3xl">
                      2. Escolha o Profissional
                    </h1>
                    <p className="mt-1 text-sm text-[#94A3B8]">
                      Exibindo profissionais habilitados para todos os serviços
                      escolhidos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#232730] bg-[#14171D] px-3.5 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedProfChoice('ANY')}
                    className={`flex min-h-[96px] items-center gap-4 rounded-2xl border p-5 text-left transition ${
                      selectedProfChoice === 'ANY'
                        ? 'border-[#D97706] bg-[#D97706]/10'
                        : 'border-[#232730] bg-[#14171D] hover:border-[#D97706]/40'
                    }`}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D97706]/40 bg-[#0B0D10] text-[#F59E0B]">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#F8FAFC]">
                          Qualquer profissional disponível
                        </h3>
                        <Sparkles className="h-4 w-4 text-[#F59E0B]" />
                      </div>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        Mostra a maior quantidade de horários livres na agenda.
                      </p>
                    </div>
                  </motion.button>

                  {eligibleProfessionals.map((prof) => {
                    const selected = selectedProfChoice === prof.id;
                    return (
                      <motion.button
                        key={prof.id}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedProfChoice(prof.id)}
                        className={`flex min-h-[96px] items-center gap-4 rounded-2xl border p-5 text-left transition ${
                          selected
                            ? 'border-[#D97706] bg-[#D97706]/10'
                            : 'border-[#232730] bg-[#14171D] hover:border-[#D97706]/40'
                        }`}
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#232730] bg-[#0B0D10] font-display text-lg font-bold text-[#F59E0B]">
                          {prof.display_name
                            .split(' ')
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join('')}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#F8FAFC]">
                            {prof.display_name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-[#94A3B8]">
                            {prof.bio || 'Master Barber'}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* PASSO 3: DATA E HORÁRIO */}
            {step === 3 ? (
              <section>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="font-display text-2xl font-bold sm:text-3xl">
                      3. Data & Horário
                    </h1>
                    <p className="mt-1 text-sm text-[#94A3B8]">
                      Escolha o dia e o melhor horário disponível.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#232730] bg-[#14171D] px-3.5 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                </div>

                <div className="mt-6 flex gap-2.5 overflow-x-auto pb-2">
                  {days.map((d) => {
                    const active = selectedDate === d.iso;
                    return (
                      <motion.button
                        key={d.iso}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setSelectedDate(d.iso)}
                        className={`flex min-h-[78px] min-w-[74px] shrink-0 flex-col items-center justify-center rounded-2xl border px-3 py-2 transition ${
                          active
                            ? 'border-[#D97706] bg-[#D97706] text-[#0B0D10] shadow-lg shadow-[#D97706]/20'
                            : 'border-[#232730] bg-[#14171D] text-[#F8FAFC] hover:border-[#D97706]/40'
                        }`}
                      >
                        <span
                          className={`text-[11px] font-semibold uppercase ${
                            active ? 'text-[#0B0D10]/80' : 'text-[#94A3B8]'
                          }`}
                        >
                          {d.weekShort}
                        </span>
                        <span className="mt-0.5 text-lg font-extrabold">
                          {d.dayNumber}
                        </span>
                        <span
                          className={`text-[10px] ${
                            active ? 'text-[#0B0D10]/80' : 'text-[#94A3B8]'
                          }`}
                        >
                          {d.monthShort}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-2xl border border-[#232730] bg-[#14171D] p-5">
                  {loadingSlots ? (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                      {Array.from({ length: 12 }).map((_, idx) => (
                        <Skeleton key={idx} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : slotEntries.length === 0 ? (
                    <div className="py-10 text-center">
                      <Calendar className="mx-auto h-9 w-9 text-[#94A3B8]" />
                      <p className="mt-3 text-base font-semibold text-[#F8FAFC]">
                        Nenhum horário livre nesta data
                      </p>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        Selecione outro dia no calendário acima para consultar
                        novas vagas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {[
                        {
                          key: 'morning',
                          title: 'Manhã',
                          items: groupedSlots.morning,
                        },
                        {
                          key: 'afternoon',
                          title: 'Tarde',
                          items: groupedSlots.afternoon,
                        },
                        {
                          key: 'evening',
                          title: 'Noite',
                          items: groupedSlots.evening,
                        },
                      ]
                        .filter((period) => period.items.length > 0)
                        .map((period) => (
                          <div key={period.key}>
                            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                              {period.title}
                            </h3>
                            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                              {period.items.map((entry) => {
                                const isSelected =
                                  selectedSlot?.time === entry.time &&
                                  selectedSlot?.professionalId ===
                                    entry.professionalId;
                                return (
                                  <motion.button
                                    key={`${entry.time}-${entry.professionalId}`}
                                    type="button"
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedSlot(entry)}
                                    className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border px-2 py-1.5 transition ${
                                      isSelected
                                        ? 'border-[#D97706] bg-[#D97706] font-bold text-[#0B0D10] shadow-md shadow-[#D97706]/25'
                                        : 'border-[#232730] bg-[#0B0D10] text-[#F8FAFC] hover:border-[#D97706]/50'
                                    }`}
                                  >
                                    <span className="text-sm font-bold">
                                      {entry.time}
                                    </span>
                                    {selectedProfChoice === 'ANY' ? (
                                      <span
                                        className={`mt-0.5 max-w-full truncate text-[10px] ${
                                          isSelected
                                            ? 'text-[#0B0D10]/85'
                                            : 'text-[#94A3B8]'
                                        }`}
                                      >
                                        {entry.professionalName.split(' ')[0]}
                                      </span>
                                    ) : null}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {/* PASSO 4: CONTA DO CLIENTE, CUPOM DE DESCONTO E CONFIRMAÇÃO */}
            {step === 4 ? (
              <section>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="font-display text-2xl font-bold sm:text-3xl">
                      4. Sua Conta, Cupom & Confirmação
                    </h1>
                    <p className="mt-1 text-sm text-[#94A3B8]">
                      {isClientAuthenticated
                        ? 'Confira seus benefícios disponíveis e confirme sua reserva.'
                        : 'Entre na sua conta ou crie seu cadastro rápido para desbloquear cupons e confirmar.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#232730] bg-[#14171D] px-3.5 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
                  <div className="space-y-5 lg:col-span-3">
                    {!isClientAuthenticated ? (
                      <>
                        <div className="flex items-start gap-3 rounded-2xl border border-[#D97706]/40 bg-[#D97706]/10 p-4 text-xs text-[#F8FAFC] sm:text-sm">
                          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#F59E0B]" />
                          <div>
                            <p className="font-bold text-[#F59E0B]">
                              Cadastro Obrigatório com Benefícios Exclusivos
                            </p>
                            <p className="mt-0.5 text-xs text-[#94A3B8]">
                              Ao criar sua conta ou entrar abaixo, você mantém
                              esta reserva intacta, acompanha seus cortes e pode
                              aplicar cupons promocionais na hora.
                            </p>
                          </div>
                        </div>

                        <ClientAuthForms defaultMode="register" compact />
                      </>
                    ) : (
                      <>
                        {/* Card de Cliente Autenticado */}
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-[#14171D] p-4 sm:p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                              <UserCheck className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#F8FAFC]">
                                {client?.name}
                              </p>
                              <p className="text-xs text-[#94A3B8]">
                                {formatPhoneMask(client?.phone_number)} •{' '}
                                {client?.total_visits || 0} visita(s)
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={logoutClient}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#232730] bg-[#0B0D10] px-3 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC]"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            Trocar conta
                          </button>
                        </div>

                        {/* Bloco de Cupom Promocional (Separado do <form> principal para evitar forms aninhados) */}
                        <div className="rounded-2xl border border-[#232730] bg-[#14171D] p-5">
                          <label
                            htmlFor="booking-coupon-code"
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F59E0B]"
                          >
                            <Ticket className="h-4 w-4" />
                            Cupom de Desconto / Promoção
                          </label>

                          {appliedCoupon ? (
                            <div
                              role="status"
                              aria-live="polite"
                              className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3"
                            >
                              <div>
                                <p className="text-xs font-extrabold text-emerald-400">
                                  Cupom {appliedCoupon.code} aplicado! (-
                                  {formatCurrency(appliedCoupon.discount_amount)}
                                  )
                                </p>
                                {appliedCoupon.description ? (
                                  <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                                    {appliedCoupon.description}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setAppliedCoupon(null);
                                  setCouponInput('');
                                  setCouponFeedback('');
                                }}
                                aria-label="Remover cupom aplicado"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#232730] bg-[#0B0D10] text-[#94A3B8] hover:text-[#F8FAFC]"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 flex gap-2">
                              <input
                                id="booking-coupon-code"
                                name="coupon_code"
                                type="text"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                enterKeyHint="done"
                                placeholder="Digite seu código (ex.: BEMVINDO15)"
                                value={couponInput}
                                onChange={(e) => {
                                  setCouponFeedback('');
                                  setCouponInput(e.target.value.toUpperCase());
                                }}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === 'Enter' &&
                                    !e.nativeEvent.isComposing
                                  ) {
                                    e.preventDefault();
                                    validateAndApplyCoupon(couponInput);
                                  }
                                }}
                                className="min-h-[48px] flex-1 rounded-xl border border-[#232730] bg-[#0B0D10] px-3.5 font-mono text-sm uppercase text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={
                                  validatingCoupon || !couponInput.trim()
                                }
                                onClick={() =>
                                  validateAndApplyCoupon(couponInput)
                                }
                                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#D97706]/50 bg-[#D97706]/15 px-4 text-xs font-bold text-[#F59E0B] transition hover:bg-[#D97706] hover:text-[#0B0D10] disabled:opacity-40"
                              >
                                {validatingCoupon ? 'Validando...' : 'Aplicar'}
                              </button>
                            </div>
                          )}

                          {couponFeedback ? (
                            <p
                              role="alert"
                              className="mt-2 text-xs font-medium text-rose-400"
                            >
                              {couponFeedback}
                            </p>
                          ) : null}

                          {/* Sugestões clicáveis de cupons liberados pelo dono */}
                          {!appliedCoupon && availableCoupons.length > 0 ? (
                            <div className="mt-3.5">
                              <span className="block text-[11px] text-[#94A3B8]">
                                Cupons disponíveis para sua conta (clique para
                                aplicar):
                              </span>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {availableCoupons.map((cp) => {
                                  const label =
                                    cp.discount_type === 'PERCENTAGE'
                                      ? `${Number(cp.discount_value)}% OFF`
                                      : `${formatCurrency(cp.discount_value)} OFF`;
                                  return (
                                    <button
                                      key={cp.id}
                                      type="button"
                                      onClick={() =>
                                        validateAndApplyCoupon(cp.code)
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D97706]/35 bg-[#0B0D10] px-2.5 py-1.5 text-xs font-bold text-[#F59E0B] transition hover:border-[#D97706] hover:bg-[#D97706]/10"
                                    >
                                      <Sparkles className="h-3 w-3" />
                                      <span>{cp.code}</span>
                                      <span className="text-[10px] text-emerald-400">
                                        ({label})
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {/* Formulário Final de Confirmação */}
                        <form
                          onSubmit={handleConfirmBooking}
                          method="POST"
                          action="/api/public/bookings/"
                          className="space-y-4 rounded-2xl border border-[#232730] bg-[#14171D] p-5 sm:p-6"
                        >
                          {submitError ? (
                            <div
                              role="alert"
                              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-300"
                            >
                              {submitError}
                            </div>
                          ) : null}

                          <div>
                            <label
                              htmlFor="booking-client-notes"
                              className="mb-1.5 block text-xs font-semibold text-[#F8FAFC]"
                            >
                              Observação para o barbeiro (opcional)
                            </label>
                            <textarea
                              id="booking-client-notes"
                              name="notes"
                              rows={3}
                              enterKeyHint="done"
                              placeholder="Ex.: Prefiro degradê médio na navalha..."
                              value={clientNotes}
                              onChange={(e) => setClientNotes(e.target.value)}
                              className="w-full rounded-xl border border-[#232730] bg-[#0B0D10] p-3.5 text-base text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:border-[#D97706] focus:outline-none sm:text-sm"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={submitting}
                            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#D97706] px-6 text-base font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/25 transition hover:bg-[#F59E0B] disabled:opacity-60"
                          >
                            {submitting
                              ? 'Confirmando horário...'
                              : `Confirmar Agendamento (${formatCurrency(
                                  finalPrice
                                )})`}
                          </button>
                        </form>
                      </>
                    )}
                  </div>

                  {/* Card de Resumo da Reserva */}
                  <div className="h-fit rounded-2xl border border-[#232730] bg-[#14171D] p-6 lg:col-span-2">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[#F59E0B]">
                      Resumo da Reserva
                    </h2>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between border-b border-[#232730] pb-2">
                        <span className="text-[#94A3B8]">Barbeiro</span>
                        <span className="font-semibold text-[#F8FAFC]">
                          {selectedSlot?.professionalName}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-[#232730] pb-2">
                        <span className="text-[#94A3B8]">Data</span>
                        <span className="font-semibold text-[#F8FAFC]">
                          {formatDateBR(selectedDate)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-[#232730] pb-2">
                        <span className="text-[#94A3B8]">Horário</span>
                        <span className="font-bold text-[#F59E0B]">
                          {selectedSlot?.time} ({totalDuration} min)
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {selectedServices.map((s) => (
                          <div
                            key={s.id}
                            className="flex justify-between text-xs text-[#94A3B8]"
                          >
                            <span>{s.name}</span>
                            <span>
                              {formatCurrency(s.effective_price ?? s.price)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {discountAmount > 0 ? (
                        <div className="space-y-1.5 border-t border-[#232730] pt-2.5 text-xs">
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotalPrice)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-emerald-400">
                            <span>Cupom ({appliedCoupon?.code})</span>
                            <span>-{formatCurrency(discountAmount)}</span>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex justify-between border-t border-[#232730] pt-3 text-base font-extrabold">
                        <span>Total</span>
                        <span className="text-[#F59E0B]">
                          {formatCurrency(finalPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Botão Desktop de Avançar nos passos 1 a 3 */}
        {step < 4 ? (
          <div className="mt-8 hidden items-center justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-5 md:flex">
            <div>
              <span className="text-xs text-[#94A3B8]">
                {selectedServiceIds.length} serviço(s) • {totalDuration} min
              </span>
              <p className="text-xl font-extrabold text-[#F59E0B]">
                {formatCurrency(subtotalPrice)}
              </p>
            </div>
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => goToStep(step + 1)}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#D97706] px-7 text-sm font-bold text-[#0B0D10] transition hover:bg-[#F59E0B] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </main>

      {/* STICKY BOTTOM BAR NO MOBILE (Passos 1 a 3) */}
      {step < 4 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#232730] bg-[#14171D]/95 px-4 py-3.5 backdrop-blur-md md:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-[#94A3B8]">
                {selectedServiceIds.length} item(ns) • {totalDuration} min
              </p>
              <p className="text-lg font-extrabold text-[#F59E0B]">
                {formatCurrency(subtotalPrice)}
              </p>
            </div>
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => goToStep(step + 1)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#D97706] px-6 text-sm font-bold text-[#0B0D10] shadow-lg shadow-[#D97706]/20 transition hover:bg-[#F59E0B] disabled:opacity-40"
            >
              Avançar
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
