const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCurrency(value) {
  const num = Number(value || 0);
  return BRL_FORMATTER.format(Number.isFinite(num) ? num : 0);
}

export function resolveMediaUrl(url) {
  if (!url) return '';
  const raw = String(url);
  if (!import.meta.env.VITE_API_URL && raw.includes('/media/')) {
    const idx = raw.indexOf('/media/');
    return raw.slice(idx);
  }
  return raw;
}

export function formatPhoneMask(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = String(dateStr).split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function toLocalISODate(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getNextDays(count = 30) {
  const days = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);

  const weekNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  for (let i = 0; i < count; i += 1) {
    const dt = new Date(base);
    dt.setDate(base.getDate() + i);
    days.push({
      iso: toLocalISODate(dt),
      dayNumber: String(dt.getDate()).padStart(2, '0'),
      weekShort: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : weekNames[dt.getDay()],
      monthShort: monthNames[dt.getMonth()],
      isSunday: dt.getDay() === 0,
    });
  }
  return days;
}

export function groupSlotsByPeriod(slots = []) {
  const groups = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  for (const item of slots) {
    const timeStr = typeof item === 'string' ? item : item.time;
    const hour = Number(String(timeStr).split(':')[0]);
    if (hour < 12) {
      groups.morning.push(item);
    } else if (hour < 18) {
      groups.afternoon.push(item);
    } else {
      groups.evening.push(item);
    }
  }
  return groups;
}

export function buildGoogleCalendarUrl({
  title,
  date,
  startTime,
  endTime,
  details,
  location = 'BarberPro — Av. Paulista, 1500 - São Paulo, SP',
}) {
  if (!date || !startTime) return '#';
  const cleanDate = String(date).replace(/-/g, '');
  const cleanStart = String(startTime).slice(0, 5).replace(':', '') + '00';
  const cleanEnd = endTime
    ? String(endTime).slice(0, 5).replace(':', '') + '00'
    : cleanStart;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Agendamento BarberPro',
    dates: `${cleanDate}T${cleanStart}/${cleanDate}T${cleanEnd}`,
    details: details || 'Seu horário confirmado na BarberPro.',
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const SERVICE_CATEGORIES = [
  { value: 'ALL', label: 'Todos' },
  { value: 'HAIR', label: 'Cabelo' },
  { value: 'BEARD', label: 'Barba' },
  { value: 'COMBO', label: 'Combos VIP' },
  { value: 'AESTHETICS', label: 'Estética' },
  { value: 'CHEMISTRY', label: 'Química' },
];

export const CATEGORY_LABELS = {
  HAIR: 'Cabelo',
  BEARD: 'Barba',
  COMBO: 'Combo VIP',
  AESTHETICS: 'Estética / Sobrancelha',
  CHEMISTRY: 'Química',
};

export const APPOINTMENT_STATUS_META = {
  PENDING: {
    label: 'Pendente',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  CONFIRMED: {
    label: 'Confirmado',
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    dot: 'bg-sky-400',
  },
  IN_PROGRESS: {
    label: 'Em Atendimento',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    dot: 'bg-purple-400',
  },
  COMPLETED: {
    label: 'Concluído',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  CANCELED: {
    label: 'Cancelado',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    dot: 'bg-rose-400',
  },
  NO_SHOW: {
    label: 'Não Compareceu',
    badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    dot: 'bg-orange-400',
  },
};

export const PAYMENT_METHOD_LABELS = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  CASH: 'Dinheiro',
  MIXED: 'Pagamento Misto',
};

export function extractErrorMessage(error, fallback = 'Não foi possível concluir a operação.') {
  const data = error?.response?.data;
  if (!data) return error?.message || fallback;
  if (typeof data === 'string') return data;
  if (Array.isArray(data.detail)) return data.detail.join(' ');
  if (typeof data.detail === 'string') return data.detail;
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const val = data[firstKey];
    if (Array.isArray(val)) return val.join(' ');
    if (typeof val === 'string') return val;
  }
  return fallback;
}
