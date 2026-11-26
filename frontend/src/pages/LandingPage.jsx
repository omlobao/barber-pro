import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Clock,
  Droplets,
  Flame,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Quote,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
} from 'lucide-react';
import api from '@/api/client';
import { PublicNavbar } from '@/components/PublicNavbar';
import CountUp from '@/components/react-bits/CountUp';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  CATEGORY_LABELS,
  SERVICE_CATEGORIES,
  formatCurrency,
} from '@/utils/formatters';

const WHATSAPP_URL =
  'https://wa.me/5511991110001?text=Ol%C3%A1%21%20Gostaria%20de%20agendar%20um%20hor%C3%A1rio%20na%20BarberPro.';

const LEFT_CRAFT_ITEMS = [
  {
    icon: Scissors,
    title: 'Visagismo & Tesoura',
    desc: 'Estudo das linhas do rosto e caimento natural para um corte sob medida e fácil de estilizar.',
  },
  {
    icon: Droplets,
    title: 'Vapor de Ozônio',
    desc: 'Névoa aquecida que abre os poros, hidrata profundamente a pele e proporciona deslize zero irritação.',
  },
  {
    icon: ShieldCheck,
    title: 'Barba Esculpida',
    desc: 'Alinhamento geométrico na navalha com óleos essenciais de cedro e balm pós-barba calmante.',
  },
];

const RIGHT_CRAFT_ITEMS = [
  {
    icon: Sparkles,
    title: 'Degradê Milimétrico',
    desc: 'Transições limpas do Skin Fade ao Taper Clássico com acabamento cirúrgico.',
  },
  {
    icon: Flame,
    title: 'Ritual Toalha Quente',
    desc: 'Compressas aromáticas quentes e massagem facial relaxante para renovar a expressão.',
  },
  {
    icon: Award,
    title: 'Selagem & Estética',
    desc: 'Alinhamento térmico dos fios, design de sobrancelha na navalha e cuidado completo.',
  },
];

const TESTIMONIALS_LEFT = [
  {
    name: 'Henrique Vasconcelos',
    role: 'Cliente Assíduo',
    quote:
      'O ritual com vapor de ozônio e toalha quente está em outro patamar. Você senta na cadeira para cortar o cabelo e sai completamente renovado.',
  },
  {
    name: 'Gustavo Ribeiro',
    role: 'Empresário',
    quote:
      'Pontualidade britânica pelo agendamento online e degradê impecável. Melhor experiência de barbearia clássica que já conheci.',
  },
];

const TESTIMONIALS_RIGHT = [
  {
    name: 'Rafael Mendonça',
    role: 'Arquiteto',
    quote:
      'Ambiente sofisticado, atendimento de respeito e cuidado real em cada detalhe da barba. Usei o cupom de primeira visita e virei cliente fixo.',
  },
  {
    name: 'Leonardo Martins',
    role: 'Advogado',
    quote:
      'A precisão na tesoura e o alinhamento na navalha duram semanas. Dá para ver na hora que a equipe domina visagismo de verdade.',
  },
];

const GALLERY_ITEMS = [
  {
    src: '/images/ig-barba-vapor.jpg',
    alt: 'Barbeiro esculpindo barba envolto em vapor de ozônio',
    caption: 'Barboterapia no Vapor de Ozônio',
  },
  {
    src: '/images/ig-relax-ouro.jpg',
    alt: 'Cliente relaxando na poltrona com iluminação âmbar e vapor quente',
    caption: 'Relaxamento & Toalha Quente',
  },
  {
    src: '/images/ig-fade-barba.jpg',
    alt: 'Acabamento de degradê e barba alinhada na navalha',
    caption: 'Acabamento Cirúrgico na Navalha',
  },
  {
    src: '/images/lounge-banner.jpg',
    alt: 'Salão clássico em couro legítimo, tijolo escuro e espelhos iluminados',
    caption: 'Ambiente Clássico & Exclusivo',
  },
  {
    src: '/images/hero-noir.jpg',
    alt: 'Mestre barbeiro executando corte de precisão na tesoura',
    caption: 'Precisão na Tesoura & Pente',
  },
  {
    src: '/images/cut-executive.jpg',
    alt: 'Corte masculino clássico executivo finalizado com pomada matte',
    caption: 'Visagismo & Finalização Matte',
  },
];

const BARBER_PORTRAIT_FALLBACKS = [
  '/images/ig-barba-vapor.jpg',
  '/images/barber-lucas.jpg',
  '/images/barber-rafael.jpg',
];

function getServiceImage(service, index) {
  if (service.image) return service.image;
  const cat = service.category;
  const slug = (service.slug || '').toLowerCase();

  if (slug.includes('social') || slug.includes('selagem') || cat === 'CHEMISTRY') {
    return '/images/cut-executive.jpg';
  }
  if (cat === 'BEARD') {
    return '/images/ig-relax-ouro.jpg';
  }
  if (cat === 'COMBO') {
    return '/images/ig-barba-vapor.jpg';
  }
  if (cat === 'HAIR') {
    return '/images/ig-fade-barba.jpg';
  }
  const pool = [
    '/images/ig-fade-barba.jpg',
    '/images/cut-executive.jpg',
    '/images/ig-relax-ouro.jpg',
    '/images/ig-barba-vapor.jpg',
  ];
  return pool[index % pool.length];
}

function SectionTag({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#E5A93C]/30 bg-[#E5A93C]/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E5A93C]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#E5A93C]" />
      {children}
    </span>
  );
}

function GoldPillLink({ to, children, variant = 'solid', className = '' }) {
  const isSolid = variant === 'solid';
  return (
    <Link
      to={to}
      className={`group inline-flex min-h-[48px] items-center gap-3 rounded-full py-1.5 pr-2 pl-6 text-xs font-bold tracking-wide transition sm:text-sm ${
        isSolid
          ? 'bg-[#E5A93C] text-[#0B0D10] shadow-lg shadow-[#E5A93C]/20 hover:bg-[#F5B942]'
          : 'border border-[#E5A93C]/45 bg-[#14171D]/85 text-[#F8FAFC] hover:border-[#E5A93C] hover:bg-[#E5A93C]/10'
      } ${className}`}
    >
      <span>{children}</span>
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 ${
          isSolid
            ? 'bg-[#0B0D10] text-[#E5A93C]'
            : 'bg-[#E5A93C] text-[#0B0D10]'
        }`}
      >
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export default function LandingPage() {
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const galleryRef = useRef(null);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroBgY = useTransform(scrollYProgress, [0, 1], ['0%', '12%']);

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

  const scrollGallery = (dir) => {
    const el = galleryRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0B0D10] text-[#F8FAFC]">
      <PublicNavbar />

      {/* 1. HERO EDITORIAL CINEMATOGRÁFICO (NOIR & BLADE) */}
      <section
        id="inicio"
        ref={heroRef}
        className="relative isolate overflow-hidden border-b border-white/[0.07]"
      >
        {/* Imagem de Fundo com Prioridade LCP Alta e Vinheta Editorial */}
        <motion.div
          style={{ y: heroBgY }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
        >
          <img
            src="/images/hero-noir.jpg"
            alt=""
            fetchPriority="high"
            width="1376"
            height="768"
            className="h-full w-full scale-105 object-cover object-[72%_center] opacity-95 sm:object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D10] via-[#0B0D10]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10] via-transparent to-[#0B0D10]/35" />
        </motion.div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 sm:pt-24 sm:pb-14 lg:px-8">
          <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-12">
            {/* Coluna Esquerda: Título Serifado Bicolor */}
            <div className="lg:col-span-8">
              <SectionTag>Experiência de Respeito</SectionTag>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="font-display mt-5 text-4xl leading-[1.08] font-bold text-[#F8FAFC] sm:text-6xl lg:text-[68px]"
              >
                A Arte da Precisão
                <span className="mt-1 block text-[#E5A93C]">
                  Além de Cada Corte.
                </span>
              </motion.h1>

              <p className="mt-6 max-w-xl text-sm leading-relaxed text-[#CBD5E1] sm:text-base">
                Não é só fazer a barba — é viver um ritual clássico com vapor de
                ozônio, toalha quente e visagismo sob medida. Reserve sua
                cadeira online em segundos e aproveite benefícios exclusivos na
                sua conta.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <GoldPillLink to="/agendar" variant="solid">
                  Reservar Cadeira
                </GoldPillLink>

                <a
                  href="#servicos"
                  className="group inline-flex min-h-[48px] items-center gap-3 rounded-full border border-[#E5A93C]/45 bg-[#14171D]/80 py-1.5 pr-2 pl-6 text-xs font-bold text-[#F8FAFC] backdrop-blur-sm transition hover:border-[#E5A93C] sm:text-sm"
                >
                  <span>Ver Serviços</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E5A93C] text-[#0B0D10] transition-transform group-hover:translate-x-0.5">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </a>
              </div>
            </div>

            {/* Coluna Direita: Selo Circular Giratório & Contato Rápido */}
            <div className="flex flex-col items-start justify-between gap-6 lg:col-span-4 lg:items-end">
              <a
                href="#galeria"
                aria-label="Conhecer a experiência da barbearia"
                className="group relative flex h-28 w-28 items-center justify-center rounded-full border border-white/15 bg-[#0B0D10]/65 backdrop-blur-md"
              >
                <svg
                  viewBox="0 0 120 120"
                  className="animate-spin-slow h-24 w-24 fill-[#CBD5E1]"
                  aria-hidden="true"
                >
                  <defs>
                    <path
                      id="heroCircleText"
                      d="M 60, 60 m -44, 0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0"
                    />
                  </defs>
                  <text className="text-[9.2px] font-bold uppercase tracking-[0.24em]">
                    <textPath href="#heroCircleText">
                      • VAPOR DE OZÔNIO • VISAGISMO CLÁSSICO
                    </textPath>
                  </text>
                </svg>
                <span className="absolute flex h-11 w-11 items-center justify-center rounded-full bg-[#E5A93C] text-[#0B0D10] shadow-lg shadow-[#E5A93C]/30 transition group-hover:scale-105">
                  <Scissors className="h-4 w-4" />
                </span>
              </a>

              <div className="space-y-2 text-xs text-[#CBD5E1] lg:text-right">
                <div className="flex items-center gap-2.5 lg:justify-end">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-[#14171D]/80 text-[#E5A93C] transition hover:bg-[#E5A93C] hover:text-[#0B0D10]"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-[#14171D]/80 text-[#E5A93C] transition hover:bg-[#E5A93C] hover:text-[#0B0D10]"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                  <Link
                    to="/cliente"
                    aria-label="Cupons para clientes"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E5A93C]/35 bg-[#14171D]/80 px-3 text-[11px] font-bold text-[#E5A93C] transition hover:bg-[#E5A93C] hover:text-[#0B0D10]"
                  >
                    <Ticket className="h-3.5 w-3.5" />
                    15% OFF 1ª Visita
                  </Link>
                </div>
                <p className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
                  <Phone className="h-3.5 w-3.5 text-[#E5A93C]" />
                  Atendimento com hora marcada • Sem filas
                </p>
              </div>
            </div>
          </div>

          {/* Barra Inferior de 4 Indicadores (Estilo Noir & Blade) */}
          <div className="mt-14 grid grid-cols-2 gap-6 border-t border-white/12 pt-8 sm:grid-cols-4">
            <div className="text-center sm:border-r sm:border-white/10 sm:pr-4">
              <p className="font-display text-3xl font-bold text-[#E5A93C] sm:text-4xl">
                10+
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Anos de Experiência
              </p>
            </div>
            <div className="text-center sm:border-r sm:border-white/10 sm:px-4">
              <p className="font-display text-3xl font-bold text-[#E5A93C] sm:text-4xl">
                +<CountUp to={4800} duration={1.8} separator="." />
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Clientes Satisfeitos
              </p>
            </div>
            <div className="text-center sm:border-r sm:border-white/10 sm:px-4">
              <p className="font-display text-3xl font-bold text-[#E5A93C] sm:text-4xl">
                100%
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Pontualidade na Cadeira
              </p>
            </div>
            <div className="text-center sm:pl-4">
              <p className="font-display text-3xl font-bold text-[#E5A93C] sm:text-4xl">
                4.9/5
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Avaliação dos Clientes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SOBRE NÓS + EXPEDIENTE (COM FOTO REAL TRATADA) */}
      <section id="sobre" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Foto Real Editada do Instagram */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-5"
            >
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#14171D] shadow-2xl">
                <img
                  src="/images/ig-relax-ouro.jpg"
                  alt="Cliente relaxando durante o ritual de barboterapia com vapor quente"
                  loading="lazy"
                  width="944"
                  height="940"
                  className="aspect-[4/4.3] w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10]/75 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[#0B0D10]/80 px-4 py-3 backdrop-blur-md">
                  <div>
                    <p className="text-xs font-bold text-[#E5A93C]">
                      Ritual Exclusivo no Vapor
                    </p>
                    <p className="text-[11px] text-[#CBD5E1]">
                      O cuidado que você não encontra em qualquer lugar
                    </p>
                  </div>
                  <Flame className="h-5 w-5 shrink-0 text-[#E5A93C]" />
                </div>
              </div>
            </motion.div>

            {/* Manifesto Editorial + Selo + Horários */}
            <div className="lg:col-span-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SectionTag>Sobre a Barbearia</SectionTag>
                  <h2 className="font-display mt-5 text-2xl leading-[1.32] font-medium text-[#F8FAFC] sm:text-3xl lg:text-[34px]">
                    Acreditamos que estilo é respeito próprio. Combinamos mais
                    de uma década de precisão clássica, visagismo masculino e
                    vapor de ozônio para que você saia impecável — por fora e
                    por dentro.
                  </h2>
                </div>

                <div
                  aria-hidden="true"
                  className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[#E5A93C]/45 bg-[#E5A93C]/10 text-[#E5A93C] sm:flex"
                >
                  <Award className="h-8 w-8" />
                </div>
              </div>

              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#94A3B8]">
                Cada atendimento é planejado sem pressa: lâminas descartáveis
                premium, produtos de alta fixação matte, ambiente climatizado e
                sistema inteligente de agendamento e fidelidade.
              </p>

              {/* Grade de Horários estilo Noir & Blade */}
              <div className="mt-10 grid grid-cols-1 gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
                <div className="sm:border-r sm:border-white/10 sm:pr-6">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E5A93C]">
                    SEG – SEX
                  </span>
                  <p className="font-display mt-1.5 text-xl font-semibold text-[#F8FAFC]">
                    09:00 – 19:00
                  </p>
                </div>
                <div className="sm:border-r sm:border-white/10 sm:px-6">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E5A93C]">
                    SÁBADO
                  </span>
                  <p className="font-display mt-1.5 text-xl font-semibold text-[#F8FAFC]">
                    09:00 – 19:00
                  </p>
                </div>
                <div className="sm:pl-6">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E5A93C]">
                    DOMINGO
                  </span>
                  <p className="font-display mt-1.5 text-xl font-semibold text-[#94A3B8]">
                    Fechado
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ESPECIALIDADES SIMÉTRICAS ("PRECISION IN EVERY CUT") */}
      <section className="border-t border-white/[0.06] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionTag>Especialidades</SectionTag>
            <h2 className="font-display mt-4 text-3xl font-bold text-[#F8FAFC] sm:text-5xl">
              Precisão em Cada Corte
            </h2>
            <p className="mt-3 text-sm text-[#94A3B8] sm:text-base">
              Técnicas tradicionais aperfeiçoadas para o homem contemporâneo.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            {/* Coluna Esquerda (Alinhada à direita no desktop) */}
            <div className="space-y-8 lg:col-span-4">
              {LEFT_CRAFT_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-4 lg:flex-row-reverse lg:text-right"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E5A93C] text-[#0B0D10] shadow-lg shadow-[#E5A93C]/20">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-[#F8FAFC]">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Retrato Central do Mestre Barbeiro */}
            <div className="relative mx-auto max-w-xs lg:col-span-4 lg:max-w-none">
              <div className="relative overflow-hidden rounded-3xl">
                <img
                  src="/images/barber-centerpiece.jpg"
                  alt="Mestre barbeiro de braços cruzados com avental de couro"
                  loading="lazy"
                  width="800"
                  height="1066"
                  className="mx-auto max-h-[440px] w-full object-cover object-top"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0B0D10] to-transparent" />
              </div>
            </div>

            {/* Coluna Direita */}
            <div className="space-y-8 lg:col-span-4">
              {RIGHT_CRAFT_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E5A93C] text-[#0B0D10] shadow-lg shadow-[#E5A93C]/20">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-[#F8FAFC]">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-12 text-center">
            <GoldPillLink to="/agendar">Reservar Minha Cadeira</GoldPillLink>
          </div>
        </div>
      </section>

      {/* 4. THE GROOMING MENU — GRADE 2x2 DE CARDS HORIZONTAIS COM FOTO */}
      <section
        id="servicos"
        className="border-t border-white/[0.06] bg-[#0E1015]/60 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionTag>Valores & Menu</SectionTag>
            <h2 className="font-display mt-4 text-3xl font-bold text-[#F8FAFC] sm:text-5xl">
              Menu de Cortes &amp; Barba
            </h2>
            <p className="mt-3 text-sm text-[#94A3B8] sm:text-base">
              Escolha sua experiência e inicie o agendamento com tempo e valor
              calculados automaticamente.
            </p>
          </div>

          {/* Abas de Filtro em Pílulas Estilo Noir & Blade */}
          <div className="mt-8 flex justify-start gap-2 overflow-x-auto pb-2 sm:justify-center">
            {SERVICE_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    if (!active) setSelectedCategory(cat.value);
                  }}
                  className={`min-h-[42px] shrink-0 rounded-full px-5 text-xs font-bold tracking-wide transition ${
                    active
                      ? 'bg-[#E5A93C] text-[#0B0D10] shadow-md shadow-[#E5A93C]/25'
                      : 'border border-white/10 bg-[#14171D] text-[#94A3B8] hover:border-[#E5A93C]/40 hover:text-[#F8FAFC]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-56 w-full rounded-3xl" />
              ))}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-white/10 bg-[#14171D] p-10 text-center text-[#94A3B8]">
              Nenhum serviço encontrado nesta categoria no momento.
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {filteredServices.map((service, index) => {
                const promoPrice =
                  service.promotion_price ?? service.promotional_price;
                const hasPromo =
                  promoPrice !== null &&
                  promoPrice !== undefined &&
                  Number(promoPrice) < Number(service.price);
                const imgSrc = getServiceImage(service, index);

                return (
                  <motion.div
                    key={`${selectedCategory}-${service.id}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: index * 0.04,
                      ease: 'easeOut',
                    }}
                    whileHover={{ y: -3 }}
                    className="group relative flex min-h-[228px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#17191F] via-[#13151A] to-[#261F13] shadow-xl transition hover:border-[#E5A93C]/45"
                  >
                    {/* Conteúdo Textual à Esquerda */}
                    <div className="relative z-10 flex flex-1 flex-col justify-between p-6 sm:p-7">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E5A93C]">
                            {CATEGORY_LABELS[service.category] ||
                              service.category}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#94A3B8]">
                            • <Clock className="h-3 w-3 text-[#E5A93C]" />
                            {service.duration_minutes} min
                          </span>
                          {hasPromo ? (
                            <span className="rounded-full bg-[#E5A93C]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#E5A93C]">
                              OFERTA
                            </span>
                          ) : null}
                        </div>

                        <h3 className="font-display mt-2 text-2xl font-bold text-[#F8FAFC]">
                          {service.name}
                        </h3>
                        <p className="mt-2 line-clamp-2 max-w-sm text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
                          {service.description ||
                            'Atendimento personalizado com acabamento na navalha e finalização profissional.'}
                        </p>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="flex items-baseline gap-2">
                          {hasPromo ? (
                            <>
                              <span className="font-display text-2xl font-bold text-[#E5A93C]">
                                {formatCurrency(promoPrice)}
                              </span>
                              <span className="text-xs text-[#94A3B8] line-through">
                                {formatCurrency(service.price)}
                              </span>
                            </>
                          ) : (
                            <span className="font-display text-2xl font-bold text-[#F8FAFC]">
                              {formatCurrency(
                                service.effective_price ?? service.price
                              )}
                            </span>
                          )}
                        </div>

                        <Link
                          to={`/agendar?service=${service.id}`}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#E5A93C] px-4 text-xs font-bold text-[#0B0D10] shadow-md shadow-[#E5A93C]/20 transition hover:bg-[#F5B942]"
                        >
                          <span>Agendar</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Retrato Fotográfico Integrado à Direita */}
                    <div className="relative hidden w-40 shrink-0 sm:block md:w-48">
                      <img
                        src={imgSrc}
                        alt={service.name}
                        loading="lazy"
                        width="380"
                        height="440"
                        className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#16171C] to-transparent" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="mt-12 text-center">
            <GoldPillLink to="/agendar">Montar Meu Combo Agora</GoldPillLink>
          </div>
        </div>
      </section>

      {/* 5. EQUIPE EM CARDS RETRATO ("THE HANDS BEHIND THE CRAFT") */}
      <section
        id="equipe"
        className="border-t border-white/[0.06] py-20 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <SectionTag>Mestres da Lâmina</SectionTag>
              <h2 className="font-display mt-4 text-3xl font-bold text-[#F8FAFC] sm:text-5xl">
                As Mãos por Trás da Arte
              </h2>
              <p className="mt-2 max-w-xl text-sm text-[#94A3B8]">
                Escolha seu especialista preferido e agende direto na agenda
                dele.
              </p>
            </div>

            <GoldPillLink to="/agendar" variant="outline">
              Ver Horários Livres
            </GoldPillLink>
          </div>

          {loading ? (
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="aspect-[3/4] w-full rounded-3xl" />
              ))}
            </div>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {professionals.map((prof, index) => {
                const portraitSrc =
                  prof.profile_picture ||
                  BARBER_PORTRAIT_FALLBACKS[
                    index % BARBER_PORTRAIT_FALLBACKS.length
                  ];

                return (
                  <motion.div
                    key={prof.id}
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{
                      duration: 0.35,
                      delay: index * 0.08,
                      ease: 'easeOut',
                    }}
                    className="group relative aspect-[3/3.9] overflow-hidden rounded-3xl border border-white/10 bg-[#14171D]"
                  >
                    <img
                      src={portraitSrc}
                      alt={prof.display_name}
                      loading="lazy"
                      width="720"
                      height="936"
                      className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10] via-[#0B0D10]/35 to-transparent" />

                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#E5A93C]">
                            Master Barber
                          </span>
                          <h3 className="font-display mt-0.5 text-2xl font-bold text-[#F8FAFC]">
                            {prof.display_name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-[#CBD5E1]">
                            {prof.bio ||
                              'Especialista em degradê navalhado, visagismo e barboterapia no vapor.'}
                          </p>
                        </div>

                        <Link
                          to={`/agendar?professional=${prof.id}`}
                          aria-label={`Agendar com ${prof.display_name}`}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E5A93C] text-[#0B0D10] shadow-lg shadow-[#E5A93C]/30 transition group-hover:scale-105 group-hover:bg-[#F5B942]"
                        >
                          <ArrowUpRight className="h-5 w-5" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 6. DEPOIMENTOS COM POLTRONA CLÁSSICA AO CENTRO */}
      <section className="border-t border-white/[0.06] bg-[#0E1015]/50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionTag>Depoimentos</SectionTag>
            <h2 className="font-display mt-4 text-3xl font-bold text-[#F8FAFC] sm:text-5xl">
              A Voz dos Nossos Clientes
            </h2>
            <p className="mt-3 text-sm text-[#94A3B8]">
              Quem vive a experiência na nossa cadeira não troca por outra.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            {/* 2 Cards à Esquerda */}
            <div className="space-y-6 lg:col-span-4">
              {TESTIMONIALS_LEFT.map((t) => (
                <div
                  key={t.name}
                  className="rounded-3xl border border-white/10 bg-[#14171D]/90 p-6 text-center shadow-lg"
                >
                  <Quote className="mx-auto h-6 w-6 text-[#E5A93C]" />
                  <div className="mt-3 flex justify-center gap-1 text-[#E5A93C]">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-[#CBD5E1] sm:text-sm">
                    “{t.quote}”
                  </p>
                  <p className="font-display mt-4 text-sm font-bold text-[#F8FAFC]">
                    — {t.name}
                  </p>
                  <span className="text-[11px] text-[#94A3B8]">{t.role}</span>
                </div>
              ))}
            </div>

            {/* Poltrona Clássica em Couro Cognac ao Centro */}
            <div className="mx-auto max-w-xs lg:col-span-4 lg:max-w-none">
              <div className="relative overflow-hidden rounded-3xl">
                <img
                  src="/images/vintage-chair.jpg"
                  alt="Poltrona clássica de barbearia em couro cognac e metal cromado"
                  loading="lazy"
                  width="800"
                  height="1066"
                  className="mx-auto max-h-[480px] w-full object-contain"
                />
              </div>
            </div>

            {/* 2 Cards à Direita */}
            <div className="space-y-6 lg:col-span-4">
              {TESTIMONIALS_RIGHT.map((t) => (
                <div
                  key={t.name}
                  className="rounded-3xl border border-white/10 bg-[#14171D]/90 p-6 text-center shadow-lg"
                >
                  <Quote className="mx-auto h-6 w-6 text-[#E5A93C]" />
                  <div className="mt-3 flex justify-center gap-1 text-[#E5A93C]">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-[#CBD5E1] sm:text-sm">
                    “{t.quote}”
                  </p>
                  <p className="font-display mt-4 text-sm font-bold text-[#F8FAFC]">
                    — {t.name}
                  </p>
                  <span className="text-[11px] text-[#94A3B8]">{t.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. GALERIA EDITORIAL ("NÃO É SÓ BARBA. É EXPERIÊNCIA") */}
      <section
        id="galeria"
        className="border-t border-white/[0.06] py-20 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <SectionTag>Galeria Real</SectionTag>
              <h2 className="font-display mt-4 text-3xl font-bold text-[#F8FAFC] sm:text-5xl">
                Não é Só Barba. É Experiência.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-[#94A3B8]">
                Registros reais do nosso ritual com vapor de ozônio, acabamento
                na navalha e ambiente exclusivo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollGallery(-1)}
                aria-label="Rolar galeria para a esquerda"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#E5A93C]/20 text-[#E5A93C] transition hover:bg-[#E5A93C] hover:text-[#0B0D10]"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollGallery(1)}
                aria-label="Rolar galeria para a direita"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#E5A93C] text-[#0B0D10] transition hover:bg-[#F5B942]"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            ref={galleryRef}
            className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {GALLERY_ITEMS.map((item) => (
              <div
                key={item.src}
                className="group relative aspect-[4/3.6] overflow-hidden rounded-3xl border border-white/10 bg-[#14171D]"
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  width="640"
                  height="576"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10]/85 via-transparent to-transparent opacity-90" />
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="text-xs font-bold tracking-wide text-[#F8FAFC]">
                    {item.caption}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. BANNER DE CONVERSÃO PRÉ-RODAPÉ */}
      <section className="relative isolate overflow-hidden border-y border-white/10 py-20 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
        >
          <img
            src="/images/lounge-banner.jpg"
            alt=""
            loading="lazy"
            width="1376"
            height="768"
            className="h-full w-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D10]/75 via-[#0B0D10]/55 to-[#0B0D10]/85" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <SectionTag>Benefício Exclusivo Online</SectionTag>
          <h2 className="font-display mt-4 text-3xl font-bold text-[#F8FAFC] sm:text-5xl">
            O Que Você Está Esperando?
            <span className="mt-1 block text-[#E5A93C]">
              Sua Cadeira Já Está Pronta.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[#CBD5E1] sm:text-base">
            Crie seu cadastro rápido na hora de agendar e use o cupom{' '}
            <strong className="font-mono text-[#E5A93C]">BEMVINDO15</strong>{' '}
            para ganhar <strong>15% OFF</strong> na sua primeira visita.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3.5">
            <GoldPillLink to="/agendar?coupon=BEMVINDO15">
              Agendar com 15% OFF
            </GoldPillLink>
            <GoldPillLink to="/cliente" variant="outline">
              Acessar Área do Cliente
            </GoldPillLink>
          </div>
        </div>
      </section>

      {/* 9. RODAPÉ EDITORIAL + MARCA D'ÁGUA MONUMENTAL */}
      <footer id="localizacao" className="overflow-hidden pt-16 pb-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#171511] to-[#0E1015] p-8 sm:p-12">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
              <div className="md:col-span-1">
                <span className="font-display text-2xl font-bold text-[#E5A93C]">
                  Barber<span className="italic text-[#F8FAFC]">&amp;</span>Pro
                </span>
                <p className="mt-3 text-xs leading-relaxed text-[#94A3B8]">
                  Barbearia clássica, visagismo masculino e barboterapia no
                  vapor de ozônio com agendamento inteligente em tempo real.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#F8FAFC]">
                  Navegação
                </h3>
                <ul className="mt-4 space-y-2.5 text-xs text-[#94A3B8]">
                  <li>
                    <a href="#inicio" className="hover:text-[#E5A93C]">
                      Início
                    </a>
                  </li>
                  <li>
                    <a href="#sobre" className="hover:text-[#E5A93C]">
                      Sobre Nós
                    </a>
                  </li>
                  <li>
                    <a href="#servicos" className="hover:text-[#E5A93C]">
                      Menu de Serviços
                    </a>
                  </li>
                  <li>
                    <a href="#equipe" className="hover:text-[#E5A93C]">
                      Nossos Barbeiros
                    </a>
                  </li>
                  <li>
                    <Link to="/cliente" className="hover:text-[#E5A93C]">
                      Minha Conta &amp; Cupons
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#F8FAFC]">
                  Endereço &amp; Contato
                </h3>
                <div className="mt-4 space-y-3 text-xs text-[#94A3B8]">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#E5A93C]" />
                    <span>Av. Paulista, 1500 — Bela Vista, São Paulo - SP</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-[#E5A93C]" />
                    <span>(11) 99111-0001</span>
                  </p>
                  <a
                    href="https://maps.google.com/?q=Av.+Paulista+1500+Sao+Paulo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-bold text-[#E5A93C] hover:underline"
                  >
                    Abrir no Google Maps
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#F8FAFC]">
                  Redes Sociais
                </h3>
                <div className="mt-4 flex items-center gap-2.5">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-[#0B0D10] text-[#94A3B8] transition hover:border-[#E5A93C] hover:text-[#E5A93C]"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-[#0B0D10] text-[#94A3B8] transition hover:border-emerald-500 hover:text-emerald-400"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </div>
                <p className="mt-4 text-[11px] text-[#94A3B8]">
                  Seg a Sáb: 09h às 19h • Dom: Fechado
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[11px] text-[#94A3B8] sm:flex-row">
              <span>
                © {new Date().getFullYear()} BarberPro. Todos os direitos
                reservados.
              </span>
              <span>Tradição, Precisão &amp; Respeito.</span>
            </div>
          </div>

          {/* Marca d'água monumental estilo Noir & Blade */}
          <div
            aria-hidden="true"
            className="font-display pointer-events-none mt-6 select-none text-center text-[14vw] leading-none font-bold tracking-tight text-white/[0.06] sm:text-[12.5vw]"
          >
            Barber &amp; Pro
          </div>
        </div>
      </footer>
    </div>
  );
}
