import React from 'react';
import { cn } from '@/lib/utils';

export function Marquee({
  children,
  className,
  duration = 28,
  pauseOnHover = true,
}) {
  const items = React.Children.toArray(children);

  return (
    <div
      className={cn('group flex w-full overflow-hidden', className)}
      style={{
        maskImage:
          'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
        '--duration': `${duration}s`,
        '--gap': '2rem',
      }}
    >
      {[0, 1].map((copyIdx) => (
        <div
          key={copyIdx}
          aria-hidden={copyIdx === 1}
          className={cn(
            'animate-marquee flex shrink-0 items-center gap-8 pr-8',
            pauseOnHover && 'group-hover:[animation-play-state:paused]'
          )}
        >
          {items}
        </div>
      ))}
    </div>
  );
}
