'use client';

/**
 * FormField wrapper generico del Design System.
 * Provee espaciado consistente para label, control, error y hint.
 * Util cuando el control no es Input/Select/Textarea estandar.
 */

import { cn } from '@/src/lib/utils';

export interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

export function FormField({
  label,
  error,
  hint,
  required,
  children,
  className,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-park-gray-300"
        >
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-park-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}
