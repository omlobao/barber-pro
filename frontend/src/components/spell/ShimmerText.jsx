import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export function ShimmerText({
  children,
  className,
  duration = 2.2,
  delay = 0.6,
}) {
  return (
    <span className="inline-block overflow-hidden align-bottom">
      <motion.span
        className={cn(
          'inline-block text-[#F59E0B] [--shimmer-contrast:rgba(255,251,235,0.92)]',
          className
        )}
        style={{
          WebkitTextFillColor: 'transparent',
          background:
            'currentColor linear-gradient(to right, currentColor 0%, var(--shimmer-contrast) 45%, var(--shimmer-contrast) 55%, currentColor 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '50% 200%',
        }}
        initial={{ backgroundPositionX: '250%' }}
        animate={{ backgroundPositionX: ['-100%', '250%'] }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          repeatDelay: 1.8,
          ease: 'linear',
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}
