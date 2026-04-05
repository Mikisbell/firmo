'use client';

/**
 * DatePicker — Selector de fecha del Design System.
 *
 * Usa el input nativo type="date" con estilos que coinciden con Input.tsx.
 * Accesible, soporta min/max, y muestra icono de calendario a la derecha.
 * El esquema oscuro se aplica via color-scheme: dark para el popup nativo.
 */

import { forwardRef, useId } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface DatePickerProps {
  /** Valor en formato ISO YYYY-MM-DD */
  value?: string;
  /** Callback al cambiar fecha */
  onChange: (date: string) => void;
  /** Etiqueta del campo */
  label?: string;
  /** Mensaje de error */
  error?: string;
  /** Placeholder (limitado soporte en input date nativo) */
  placeholder?: string;
  /** Fecha minima permitida YYYY-MM-DD */
  min?: string;
  /** Fecha maxima permitida YYYY-MM-DD */
  max?: string;
  /** Deshabilita el input */
  disabled?: boolean;
  /** Marca el campo como requerido */
  required?: boolean;
  /** ID opcional para el input */
  id?: string;
  /** Clases extra */
  className?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      label,
      error,
      placeholder,
      min,
      max,
      disabled,
      required,
      id,
      className,
    },
    ref,
  ) => {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-park-gray-300"
          >
            {label}
            {required && (
              <span aria-hidden="true" className="text-red-400 ml-0.5">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="date"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            min={min}
            max={max}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            aria-required={required || undefined}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            style={{ colorScheme: 'dark' }}
            className={cn(
              'h-10 w-full px-3 pr-10 bg-park-gray-900 border rounded-lg text-white placeholder:text-park-gray-500',
              'focus:outline-none focus:ring-2 transition-colors',
              '[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer',
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-park-gray-700 focus:border-park-brand-500 focus:ring-park-brand-500/20',
              disabled && 'opacity-50 cursor-not-allowed',
              className,
            )}
          />
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-park-gray-500 pointer-events-none"
            aria-hidden="true"
          >
            <CalendarDays className="h-4 w-4" />
          </span>
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  },
);

DatePicker.displayName = 'DatePicker';
