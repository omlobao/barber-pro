import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Award,
  Beer,
  Calendar,
  Clock,
  Flame,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Wifi,
} from 'lucide-react';
import api from '@/api/client';
import { PublicNavbar } from '@/components/PublicNavbar';
import { BlurReveal } from '@/components/spell/BlurReveal';
import { ShimmerText } from '@/components/spell/ShimmerText';
import { Marquee } from '@/components/spell/Marquee';
import { TiltCard } from '@/components/spell/TiltCard';
import { SpellBadge } from '@/components/spell/SpellBadge';
import SpotlightCard from '@/components/react-bits/SpotlightCard';
import FadeContent from '@/components/react-bits/FadeContent';
import ShinyText from '@/components/react-bits/ShinyText';
import CountUp from '@/components/react-bits/CountUp';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  CATEGORY_LABELS,
  SERVICE_CATEGORIES,
  formatCurrency,
} from '@/utils/formatters';

const WHATSAPP_URL =
  'https://wa.me/5511991110001?text=Ol%C3%A1%21%20Gostaria%20de%20saber%20mais%20sobre%20a%20BarberPro.';

const AMENITIES = [
  {
    icon: Flame,
    title: 'Ritual de Toalha Quente',
    desc: 'Óleos essenciais de cedro, vaporização facial e lâmina descartável premium em cada barba.',
  },
  {
    icon: Beer,
    title: 'Bar & Cerveja Artesanal',
    desc: 'Primeira cerveja IPA ou café espresso especial cortesia enquanto aguarda ou realiza seu corte.',
  },
  {
    icon: Award,
    title: 'Visagismo Especializado',
    desc: 'Análise do formato de rosto e textura capilar para um corte sob medida e fácil de manter.',
  },
  {
    icon: Wifi,
    title: 'Ambiente Climatizado & Lounge',
    desc: 'Poltronas clássicas em couro legítimo, som ambiente selecionado, Wi-Fi de alta velocidade e estacionamento.',
  },
];

const MARQUEE_ITEMS = [
  'CORTE DEGRADÊ NAVALHADO',
  'BARBOTERAPIA COM TOALHA QUENTE',
  'VISAGISMO MASCULINO',
  'COMBOS VIP COM DESCONTO',
  'AGENDAMENTO ONLINE EM 30 SEGUNDOS',
  'CERVEJA ARTESANAL GELADA',
];

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default function LandingPage() {
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroParallaxY = useTransform(scrollYProgress, [0, 1], [0, 95]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.3]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/api/public/services/'),
      api.get('/api/public/professionals/'),
    ])
      .then(([srvRes, profRes]) => {
        if (!active) return;
        setServices(Array.isArray(srvRes.data) ? srvRes.data : []);
        setProfessionals(Array.isArray(profRes.data) ? profRes.data : []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredServices = useMemo(() => {
    if (selectedCategory === 'ALL') return services;
    return services.filter((s) => s.category === selectedCategory);
  }, [services, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#0B0D10] text-[#F8FAFC]">
      <PublicNavbar />

      {/* HERO SECTION COM PARALLAX SUTIL */}
      <section
        ref={heroRef}
        className="relative overflow-hidden border-b border-[#232730] pt-12 pb-20 sm:pt-20 sm:pb-28"
      >
        <motion.div
          style={{ y: heroParallaxY, opacity: heroOpacity }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute top-[-10%] left-1/2 h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-[#D97706]/12 blur-[130px]" />
          <div className="absolute right-[-8%] bottom-[-10%] h-[360px] w-[360px] rounded-full bg-amber-500/8 blur-[100px]" />
        </motion.div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D97706]/35 bg-[#14171D]/90 px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#F59E0B]" />
              <ShinyText
                text="EXPERIÊNCIA DARK LUXURY EM BARBEARIA"
                speed={3}
                color="#94A3B8"
                shineColor="#F59E0B"
                className="text-xs font-semibold tracking-[0.18em]"
              />
            </div>

            <BlurReveal
              as="h1"
              speedReveal={2}
              className="font-display text-4xl font-extrabold tracking-tight text-[#F8FAFC] sm:text-6xl lg:text-[64px] lg:leading-[1.08]"
            >
              Precisão Clássica, Estilo Inconfundível.
            </BlurReveal>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#94A3B8] sm:text-lg">
              Do degradê milimétrico à barboterapia com toalha quente. Escolha
              seu mestre barbeiro e garanta seu horário online em menos de{' '}
              <ShimmerText className="font-semibold">30 segundos</ShimmerText>,
              sem filas e sem espera.
            </p>

            <div className="mt-9 flex flex-col items-stretch justify-center gap-3.5 sm:flex-row sm:items-center">
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/agendar"
                  className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl bg-[#D97706] px-8 text-base font-bold text-[#0B0D10] shadow-xl shadow-[#D97706]/25 transition hover:bg-[#F59E0B]"
                >
                  <Calendar className="h-5 w-5" />
                  Agendar Horário
                </Link>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl border border-[#232730] bg-[#14171D] px-7 text-base font-semibold text-[#F8FAFC] transition hover:border-[#D97706]/50"
                >
                  <MessageCircle className="h-5 w-5 text-emerald-400" />
                  Falar no WhatsApp
                </a>
              </motion.div>
            </div>

            {/* Indicadores rápidos com CountUp (@react-bits) */}
            <div className="mt-14 grid grid-cols-3 gap-4 rounded-2xl border border-[#232730] bg-[#14171D]/80 p-5 backdrop-blur-xs sm:gap-8 sm:p-6">
              <div>
                <div className="font-display text-2xl font-bold text-[#F59E0B] sm:text-3xl">
                  +<CountUp to={4800} duration={1.8} separator="." />
                </div>
                <p className="mt-1 text-xs text-[#94A3B8] sm:text-sm">
                  Atendimentos realizados
                </p>
              </div>
              <div className="border-x border-[#232730] px-2">
                <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
                  <span>4.9</span>
                  <Star className="h-5 w-5 fill-[#F59E0B] text-[#F59E0B]" />
                </div>
                <p className="mt-1 text-xs text-[#94A3B8] sm:text-sm">
                  Avaliação média dos clientes
                </p>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-[#F8FAFC] sm:text-3xl">
                  <CountUp to={100} duration={1.5} />%
                </div>
                <p className="mt-1 text-xs text-[#94A3B8] sm:text-sm">
                  Pontualidade na cadeira
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAIXA ANIMADA (@spell/marquee) */}
      <div className="border-b border-[#232730] bg-[#14171D]/60 py-4">
        <Marquee duration={32}>
          {MARQUEE_ITEMS.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-[#94A3B8]"
            >
              <Scissors className="h-3.5 w-3.5 text-[#D97706]" />
              {item}
            </span>
          ))}
        </Marquee>
      </div>

      {/* VITRINE DE SERVIÇOS */}
      <section id="servicos" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeContent blur duration={0.6}>
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <SpellBadge variant="amber">NOSSO MENU</SpellBadge>
                <h2 className="font-display mt-3 text-3xl font-bold text-[#F8FAFC] sm:text-4xl">
                  Serviços & Experiências
                </h2>
                <p className="mt-2 max-w-xl text-sm text-[#94A3B8] sm:text-base">
                  Selecione o serviço ideal e inicie seu agendamento com valor e
                  tempo já calculados.
                </p>
              </div>

              {/* Abas de filtro por Category */}
              <div className="flex w-full gap-2 overflow-x-auto pb-1 md:w-auto">
                {SERVICE_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`min-h-[44px] shrink-0 rounded-xl px-4 text-xs font-bold tracking-wide transition ${
                        active
                          ? 'bg-[#D97706] text-[#0B0D10] shadow-md shadow-[#D97706]/25'
                          : 'border border-[#232730] bg-[#14171D] text-[#94A3B8] hover:border-[#D97706]/40 hover:text-[#F8FAFC]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </FadeContent>

          {loading ? (
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Skeleton key={n} className="h-60 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-[#232730] bg-[#14171D] p-10 text-center text-[#94A3B8]">
              Nenhum serviço encontrado nesta categoria no momento.
            </div>
          ) : (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.08 } },
              }}
              className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {filteredServices.map((service) => {
                const promoPrice =
                  service.promotion_price ?? service.promotional_price;
                const hasPromo =
                  promoPrice !== null &&
                  promoPrice !== undefined &&
                  Number(promoPrice) < Number(service.price);

                return (
                  <motion.div
                    key={service.id}
                    variants={{
                      hidden: { opacity: 0, y: 22 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    whileHover={{ y: -3 }}
                  >
                    <SpotlightCard
                      spotlightColor="#D97706"
                      intensity={0.18}
                      borderGlow={0.7}
                      className="flex h-full flex-col justify-between !rounded-2xl border border-[#232730] !bg-[#14171D] !p-6"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <SpellBadge variant="outline" size="sm">
                            {CATEGORY_LABELS[service.category] ||
                              service.category}
                          </SpellBadge>
                          {hasPromo ? (
                            <SpellBadge variant="amber" size="sm">
                              OFERTA ESPECIAL
                            </SpellBadge>
                          ) : service.is_featured ? (
                            <SpellBadge variant="emerald" size="sm">
                              DESTAQUE
                            </SpellBadge>
                          ) : null}
                        </div>

                        <h3 className="mt-4 text-lg font-bold text-[#F8FAFC]">
                          {service.name}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm text-[#94A3B8]">
                          {service.description ||
                            'Atendimento personalizado com produtos de linha profissional.'}
                        </p>
                      </div>

                      <div className="mt-6 border-t border-[#232730] pt-4">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                              <Clock className="h-3.5 w-3.5 text-[#D97706]" />
                              <span>{service.duration_minutes} min</span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                              {hasPromo ? (
                                <>
                                  <span className="text-xl font-extrabold text-[#F59E0B]">
                                    {formatCurrency(promoPrice)}
                                  </span>
                                  <span className="text-xs text-[#94A3B8] line-through">
                                    {formatCurrency(service.price)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xl font-extrabold text-[#F8FAFC]">
                                  {formatCurrency(service.effective_price ?? service.price)}
                                </span>
                              )}
                            </div>
                          </div>

                          <Link
                            to={`/agendar?service=${service.id}`}
                            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#D97706] px-4 text-xs font-bold text-[#0B0D10] transition hover:bg-[#F59E0B]"
                          >
                            Agendar este
                          </Link>
                        </div>
                      </div>
                    </SpotlightCard>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </section>

      {/* EQUIPE DE MESTRES BARBEIROS */}
      <section
        id="equipe"
        className="border-t border-[#232730] bg-[#14171D]/35 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeContent blur duration={0.6}>
            <div className="text-center">
              <SpellBadge variant="amber">MESTRES DA LÂMINA</SpellBadge>
              <h2 className="font-display mt-3 text-3xl font-bold text-[#F8FAFC] sm:text-4xl">
                Nossa Equipe
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-[#94A3B8] sm:text-base">
                Profissionais especialistas prontos para entregar precisão e
                estilo no seu atendimento.
              </p>
            </div>
          </FadeContent>

          {loading ? (
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-80 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.1 } },
              }}
              className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {professionals.map((prof) => (
                <motion.div
                  key={prof.id}
                  variants={{
                    hidden: { opacity: 0, y: 24 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  <TiltCard
                    tiltLimit={5}
                    className="flex h-full flex-col justify-between rounded-2xl border border-[#232730] bg-[#14171D] p-6"
                  >
                    <div>
                      <div className="flex items-center gap-4">
                        {prof.profile_picture ? (
                          <img
                            src={prof.profile_picture}
                            alt={prof.display_name}
                            className="h-18 w-18 rounded-2xl border border-[#D97706]/40 object-cover"
                          />
                        ) : (
                          <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-2xl border border-[#D97706]/40 bg-[#0B0D10] font-display text-xl font-bold text-[#F59E0B]">
                            {getInitials(prof.display_name)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-bold text-[#F8FAFC]">
                            {prof.display_name}
                          </h3>
                          <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#F59E0B]">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Master Barber
                          </span>
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-relaxed text-[#94A3B8]">
                        {prof.bio ||
                          'Especialista em cortes modernos, degradê na navalha e alinhamento de barba.'}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#232730]">
                      <Link
                        to={`/agendar?professional=${prof.id}`}
                        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#D97706]/50 bg-[#0B0D10] px-4 text-sm font-bold text-[#F59E0B] transition hover:bg-[#D97706] hover:text-[#0B0D10]"
                      >
                        <Calendar className="h-4 w-4" />
                        Agendar com {prof.display_name.split(' ')[0]}
                      </Link>
                    </div>
                  </TiltCard>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ESTRUTURA & DIFERENCIAIS */}
      <section id="estrutura" className="border-t border-[#232730] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <SpellBadge variant="amber">ESTRUTURA PREMIUM</SpellBadge>
            <h2 className="font-display mt-3 text-3xl font-bold text-[#F8FAFC] sm:text-4xl">
              Mais que um Corte, um Ritual
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {AMENITIES.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  whileHover={{ y: -3 }}
                  className="rounded-2xl border border-[#232730] bg-[#14171D] p-6"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#D97706]/30 bg-[#0B0D10] text-[#D97706]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#F8FAFC]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                    {item.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* RODAPÉ & LOCALIZAÇÃO */}
      <footer
        id="localizacao"
        className="border-t border-[#232730] bg-[#14171D]/70 pt-16 pb-12"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D97706]/40 bg-[#0B0D10] text-[#D97706]">
                  <Scissors className="h-5 w-5" />
                </div>
                <span className="font-display text-lg font-bold text-[#F8FAFC]">
                  BARBER<span className="text-[#D97706]">PRO</span>
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[#94A3B8]">
                Tradição da barbearia clássica aliada à praticidade do
                agendamento inteligente em tempo real.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram da BarberPro"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#232730] bg-[#0B0D10] text-[#94A3B8] transition hover:border-[#D97706] hover:text-[#F59E0B]"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp da BarberPro"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#232730] bg-[#0B0D10] text-[#94A3B8] transition hover:border-emerald-500 hover:text-emerald-400"
                >
                  <Phone className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#F8FAFC]">
                Horário de Funcionamento
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#94A3B8]">
                <li className="flex justify-between border-b border-[#232730] pb-2">
                  <span>Segunda a Sexta</span>
                  <span className="font-semibold text-[#F8FAFC]">
                    09:00 às 19:00
                  </span>
                </li>
                <li className="flex justify-between border-b border-[#232730] pb-2">
                  <span>Sábado</span>
                  <span className="font-semibold text-[#F8FAFC]">
                    09:00 às 19:00
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Domingo e Feriados</span>
                  <span className="text-rose-400">Fechado</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#F8FAFC]">
                Endereço & Contato
              </h3>
              <p className="mt-4 flex items-start gap-2.5 text-sm text-[#94A3B8]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
                <span>
                  Av. Paulista, 1500 — Bela Vista, São Paulo - SP
                </span>
              </p>
              <a
                href="https://maps.google.com/?q=Av.+Paulista+1500+Sao+Paulo"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#232730] bg-[#0B0D10] px-4 text-xs font-bold text-[#F59E0B] transition hover:border-[#D97706]"
              >
                <MapPin className="h-4 w-4" />
                Abrir no Google Maps
              </a>
            </div>
          </div>

          <div className="mt-12 border-t border-[#232730] pt-6 text-center text-xs text-[#94A3B8]">
            © {new Date().getFullYear()} BarberPro. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
