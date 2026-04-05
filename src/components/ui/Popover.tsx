'use client';

/**
 * Popover — Tooltip enriquecido con contenido JSX arbitrario.
 *
 * Diferencias con Tooltip:
 * - Tooltip: solo texto plano
 * - Popover: admite JSX (listas, botones, tablas, etc.)
 *
 * Modos de activacion:
 * - 'click' (default): toggle en click, cierra con click fuera + Escape
 * - 'hover': aparece en hover con delay de 200ms
 *
 * Posicionamiento via side + align (sin librerias de floating-ui).
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';
export type PopoverAlign = 'start' | 'center' | 'end';
export type PopoverTriggerMode = 'click' | 'hover';

export interface PopoverProps {
  /** Elemento clickeable que abre el popover */
  trigger: ReactNode;
  /** Contenido del popover (puede ser JSX) */
  children: ReactNode;
  /** Lado donde aparece respecto al trigger (default: bottom) */
  side?: PopoverSide;
  /** Alineacion en el eje perpendicular (default: center) */
  align?: PopoverAlign;
  /** Modo de activacion (default: click) */
  triggerMode?: PopoverTriggerMode;
}

const HOVER_DELAY_MS = 200;

/**
 * Calcula las clases de posicionamiento segun side + align.
 * Combina el eje principal (side) con la alineacion perpendicular (align).
 */
function getPositionClasses(side: PopoverSide, align: PopoverAlign): string {
  // Eje principal: separacion del trigger
  const sideBase: Record<PopoverSide, string> = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  // Alineacion perpendicular
  const isVertical = side === 'top' || side === 'bottom';
  const alignMap: Record<PopoverAlign, string> = isVertical
    ? {
        start: 'left-0',
        center: 'left-1/2 -translate-x-1/2',
        end: 'right-0',
      }
    : {
        start: 'top-0',
        center: 'top-1/2 -translate-y-1/2',
        end: 'bottom-0',
      };

  return cn(sideBase[side], alignMap[align]);
}

export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'center',
  triggerMode = 'click',
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Click fuera + Escape (solo en modo click) ---
  useEffect(() => {
    if (triggerMode !== 'click' || !open) return;

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
  }, [open, triggerMode]);

  // --- Cleanup del timer de hover ---
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (triggerMode !== 'click') return;
    setOpen((prev) => !prev);
  };

  const handleMouseEnter = () => {
    if (triggerMode !== 'hover') return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (triggerMode !== 'hover') return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div onClick={handleClick} className="inline-block">
        {trigger}
      </div>

      <div
        role="dialog"
        aria-hidden={!open}
        className={cn(
          'absolute z-40 min-w-[200px] max-w-[400px] p-4',
          'bg-park-gray-900 border border-park-gray-800 rounded-lg shadow-xl',
          'transition-opacity duration-150',
          getPositionClasses(side, align),
          open
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
      >
        {children}
      </div>
    </div>
  );
}
