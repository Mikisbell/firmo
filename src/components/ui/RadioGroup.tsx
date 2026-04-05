'use client';

/**
 * RadioGroup — Grupo de botones de radio.
 *
 * Caracteristicas:
 * - Input nativo <input type="radio"> con sr-only para accesibilidad
 * - Visual custom con bullet animado cuando esta seleccionado
 * - Orientacion vertical (default) u horizontal
 * - Label opcional del grupo + mensaje de error
 * - Soporta opciones con descripcion y disabled individual
 */

import { useId } from 'react';
import { cn } from '@/src/lib/utils';

export interface RadioOption {
  /** Valor del radio (usado en onChange) */
  value: string;
  /** Texto visible */
  label: string;
  /** Texto secundario opcional */
  description?: string;
  /** Deshabilita esta opcion */
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Nombre del grupo (compartido entre todos los radios) */
  name: string;
  /** Valor actualmente seleccionado */
  value: string;
  /** Callback cuando cambia la seleccion */
  onChange: (value: string) => void;
  /** Opciones disponibles */
  options: RadioOption[];
  /** Etiqueta del grupo */
  label?: string;
  /** Mensaje de error (muestra debajo) */
  error?: string;
  /** Orientacion (default vertical) */
  orientation?: 'horizontal' | 'vertical';
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  label,
  error,
  orientation = 'vertical',
}: RadioGroupProps) {
  const groupId = useId();
  const errorId = `${groupId}-error`;

  return (
    <div role="radiogroup" aria-labelledby={label ? `${groupId}-label` : undefined} aria-describedby={error ? errorId : undefined}>
      {label && (
        <p
          id={`${groupId}-label`}
          className="text-sm font-medium text-park-gray-200 mb-2"
        >
          {label}
        </p>
      )}

      <div
        className={cn(
          'flex',
          orientation === 'horizontal' ? 'flex-row gap-4' : 'flex-col gap-2',
        )}
      >
        {options.map((option) => {
          const isChecked = option.value === value;
          const isDisabled = option.disabled ?? false;
          const optionId = `${groupId}-${option.value}`;

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                'flex items-start gap-3',
                isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                checked={isChecked}
                disabled={isDisabled}
                onChange={(e) => onChange(e.target.value)}
                className="sr-only peer"
              />

              {/* Radio visual */}
              <span
                className={cn(
                  'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-park-brand-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-park-gray-900',
                  isChecked
                    ? 'border-park-brand-500'
                    : 'border-park-gray-700',
                )}
                aria-hidden="true"
              >
                {isChecked && (
                  <span className="h-2.5 w-2.5 rounded-full bg-park-brand-500" />
                )}
              </span>

              {/* Label + description */}
              <span className="min-w-0">
                <span className="block text-sm text-park-gray-200">
                  {option.label}
                </span>
                {option.description && (
                  <span className="block text-xs text-park-gray-500 mt-0.5">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p id={errorId} className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
