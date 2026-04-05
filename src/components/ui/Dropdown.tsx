'use client';

/**
 * Dropdown — Menu contextual del Design System.
 *
 * Caracteristicas:
 * - Trigger personalizable (cualquier ReactNode)
 * - Items con icono, variante destructiva, disabled y separadores
 * - Alineacion left/right via prop align
 * - Cierra al hacer click fuera, Escape o al seleccionar un item
 * - Animacion fade + translate-y
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';

export interface DropdownItem {
  /** Texto del item */
  label: string;
  /** Icono opcional a la izquierda */
  icon?: ReactNode;
  /** Callback al hacer click */
  onClick?: () => void;
  /** Variante visual: default o destructive (rojo) */
  variant?: 'default' | 'destructive';
  /** Deshabilita el item */
  disabled?: boolean;
  /** Renderiza un divisor en lugar del item */
  separator?: boolean;
}

export interface DropdownProps {
  /** Boton o elemento que abre el menu */
  trigger: ReactNode;
  /** Items del menu */
  items: DropdownItem[];
  /** Alineacion del menu respecto al trigger (default: start) */
  align?: 'start' | 'end';
}

export function Dropdown({ trigger, items, align = 'start' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Click fuera + Escape ---
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleItemClick = (item: DropdownItem) => {
    if (item.disabled || item.separator) return;
    item.onClick?.();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setOpen((prev) => !prev)}>{trigger}</div>

      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          'absolute z-50 mt-1 min-w-[180px] py-1',
          'bg-park-gray-900 border border-park-gray-800 rounded-lg shadow-xl',
          'transition-all duration-150 ease-out',
          align === 'end' ? 'right-0' : 'left-0',
          open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-1 pointer-events-none',
        )}
      >
        {items.map((item, idx) => {
          if (item.separator) {
            return (
              <div
                key={`sep-${idx}`}
                className="h-px bg-park-gray-800 my-1"
                role="separator"
                aria-hidden="true"
              />
            );
          }

          const isDestructive = item.variant === 'destructive';

          return (
            <button
              key={`${item.label}-${idx}`}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => handleItemClick(item)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                isDestructive
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-park-gray-200 hover:bg-park-gray-800',
                item.disabled
                  ? 'opacity-50 cursor-not-allowed hover:bg-transparent'
                  : 'cursor-pointer',
              )}
            >
              {item.icon && (
                <span
                  className={cn(
                    'flex items-center [&>svg]:h-4 [&>svg]:w-4',
                    isDestructive ? 'text-red-400' : 'text-park-gray-400',
                  )}
                >
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
