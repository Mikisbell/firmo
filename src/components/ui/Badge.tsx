'use client';

/**
 * Badge de estado semantico.
 * Variantes: success, warning, critical, info, neutral.
 */

import { cn } from '@/src/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'critical' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  /** Muestra un punto de color antes del texto */
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-park-success-subtle text-green-400',
  warning: 'bg-park-warning-subtle text-amber-400',
  critical: 'bg-park-critical-subtle text-red-400',
  info: 'bg-park-info-subtle text-blue-400',
  neutral: 'bg-park-gray-800 text-park-gray-400',
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-green-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
  info: 'bg-blue-400',
  neutral: 'bg-park-gray-400',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function Badge({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
