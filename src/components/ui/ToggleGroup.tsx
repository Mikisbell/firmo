'use client';

/**
 * ToggleGroup — Grupo de botones exclusivos (tipo radio).
 *
 * Casos de uso comunes:
 * - Selectores de periodo (Hoy / Semana / Mes)
 * - Modos de vista (Lista / Grid)
 * - Filtros de estado
 *
 * Solo un valor activo a la vez. Cada opcion puede tener icono opcional.
 */

import { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

export type ToggleGroupSize = 'sm' | 'md';

export interface ToggleOption {
  /** Valor unico del option (se compara con prop value) */
  value: string;
  /** Label visible */
  label: string;
  /** Icono opcional a la izquierda del label */
  icon?: ReactNode;
}

export interface ToggleGroupProps {
  /** Valor actualmente seleccionado */
  value: string;
  /** Callback al cambiar de seleccion */
  onChange: (value: string) => void;
  /** Opciones del grupo */
  options: ToggleOption[];
  /** Tamano de los botones (default: md) */
  size?: ToggleGroupSize;
}

const sizeStyles: Record<ToggleGroupSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export function ToggleGroup({
  value,
  onChange,
  options,
  size = 'md',
}: ToggleGroupProps) {
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-lg border border-park-gray-800 bg-park-gray-900 p-1"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-park-brand-500',
              sizeStyles[size],
              isActive
                ? 'bg-park-brand-600 text-white'
                : 'text-park-gray-400 hover:text-park-gray-200 hover:bg-park-gray-800',
            )}
          >
            {option.icon && (
              <span className="flex items-center [&>svg]:h-4 [&>svg]:w-4">
                {option.icon}
              </span>
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
