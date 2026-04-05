'use client';

/**
 * Checkbox custom-styled del Design System.
 * Input nativo oculto (sr-only) con visual custom.
 * Compatible con react-hook-form via forwardRef.
 */

import { forwardRef, useId } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className, id, disabled, checked, ...props }, ref) => {
    const autoId = useId();
    const checkboxId = id ?? autoId;

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'flex items-start gap-3',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className,
        )}
      >
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative flex items-center justify-center h-5 w-5 shrink-0 rounded border-2 transition-colors mt-0.5',
            'bg-park-gray-900 border-park-gray-700',
            'peer-checked:bg-park-brand-600 peer-checked:border-park-brand-600',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-park-brand-500/40',
          )}
        >
          {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-park-gray-200 leading-tight">{label}</span>
          {description && (
            <span className="text-xs text-park-gray-500">{description}</span>
          )}
        </div>
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';
