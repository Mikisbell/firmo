'use client';

/**
 * Barra de progreso del Design System.
 * Variantes: default (brand), success, warning, critical.
 * Tamanos: sm, md, lg.
 */

import { forwardRef } from 'react';
import { cn } from '@/src/lib/utils';

export type ProgressVariant = 'default' | 'success' | 'warning' | 'critical';
export type ProgressSize = 'sm' | 'md' | 'lg';

export interface ProgressProps {
  /** Valor actual (0-100 por defecto, o 0-max si se provee max) */
  value: number;
  /** Valor maximo (default 100) */
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  /** Muestra label "X / Y" (si hay max !== 100) o "X%" a la derecha */
  showLabel?: boolean;
  /** Label custom que sobreescribe el autogenerado */
  label?: string;
  className?: string;
}

const variantStyles: Record<ProgressVariant, string> = {
  default: 'bg-park-brand-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const sizeStyles: Record<ProgressSize, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value,
      max = 100,
      variant = 'default',
      size = 'md',
      showLabel = false,
      label,
      className,
    },
    ref,
  ) => {
    const clampedValue = Math.max(0, Math.min(value, max));
    const percentage = max > 0 ? (clampedValue / max) * 100 : 0;

    const displayLabel =
      label ??
      (max === 100
        ? `${Math.round(percentage)}%`
        : `${clampedValue} / ${max}`);

    return (
      <div ref={ref} className={cn('flex items-center gap-3', className)}>
        <div
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={max}
          className={cn(
            'flex-1 rounded-full bg-park-gray-800 overflow-hidden',
            sizeStyles[size],
          )}
        >
          <div
            className={cn(
              'h-full transition-all duration-300 rounded-full',
              variantStyles[variant],
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showLabel && (
          <span className="text-xs text-park-gray-400 tabular-nums shrink-0">
            {displayLabel}
          </span>
        )}
      </div>
    );
  },
);

Progress.displayName = 'Progress';
