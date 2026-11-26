import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SlideDrawer({
  open,
  onClose,
  title,
  subtitle,
  side = 'right',
  widthClass = 'max-w-xl',
  children,
  footer,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const initialX = side === 'right' ? '100%' : '-100%';

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
          />
          <motion.aside
            role="dialog"
            aria-label={title}
            initial={{ x: initialX }}
            animate={{ x: 0 }}
            exit={{ x: initialX }}
            transition={{ type: 'spring', damping: 28, stiffness: 290 }}
            className={cn(
              'relative z-10 flex h-[100svh] w-full flex-col border-[#232730] bg-[#14171D] text-[#F8FAFC] shadow-2xl',
              side === 'right' ? 'ml-auto border-l' : 'mr-auto border-r',
              widthClass
            )}
          >
            <div className="flex items-center justify-between border-b border-[#232730] px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#F8FAFC]">{title}</h2>
                {subtitle ? (
                  <p className="mt-0.5 text-xs text-[#94A3B8]">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar painel lateral"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#232730] bg-[#0B0D10] text-[#94A3B8] transition hover:border-[#D97706]/50 hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">{children}</div>

            {footer ? (
              <div className="border-t border-[#232730] bg-[#0B0D10]/90 p-5">
                {footer}
              </div>
            ) : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
