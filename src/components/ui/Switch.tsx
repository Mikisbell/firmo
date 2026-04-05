'use client';

/**
 * Switch (toggle) estilo iOS del Design System.
 * Componente controlado con onCheckedChange.
 */

import { forwardRef, useId } from 'react';
import { cn } from '@/src/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    { checked, onCheckedChange, label, description, disabled, id, className },
    ref,
  ) => {
    const autoId = useId();
    const switchId = id ?? autoId;

    const toggle = (
      <button
        ref={ref}
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-park-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-park-gray-900',
          checked ? 'bg-park-brand-600' : 'bg-park-gray-700',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    );

    if (!label && !description) {
      return <span className={className}>{toggle}</span>;
    }

    return (
      <div
        className={cn(
          'flex items-start gap-3',
          disabled && 'opacity-50',
          className,
        )}
      >
        {toggle}
        <label
          htmlFor={switchId}
          className={cn(
            'flex flex-col gap-0.5',
            !disabled && 'cursor-pointer',
          )}
        >
          {label && (
            <span className="text-sm text-park-gray-200 leading-tight">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-park-gray-500">{description}</span>
          )}
        </label>
      </div>
    );
  },
);

Switch.displayName = 'Switch';
