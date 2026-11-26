import React from 'react';
import { cn } from '@/lib/utils';

const VARIANT_STYLES = {
  default: 'bg-[#232730] text-[#F8FAFC] border border-[#2E3440]',
  amber: 'bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/35',
  emerald: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  sky: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  purple: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
  rose: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  outline: 'border border-[#232730] bg-transparent text-[#94A3B8]',
};

const SIZE_STYLES = {
  default: 'px-2.5 py-1 text-xs',
  sm: 'px-2 py-0.5 text-[11px]',
};

export function SpellBadge({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold leading-none tracking-wide',
        VARIANT_STYLES[variant] || VARIANT_STYLES.default,
        SIZE_STYLES[size] || SIZE_STYLES.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
