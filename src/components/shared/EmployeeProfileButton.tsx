'use client';

/**
 * EmployeeProfileButton — Dropdown de perfil del empleado.
 *
 * ## Comportamiento
 * - Modo **full** (mozo desktop, POS): muestra avatar + nombre + chevron.
 *   Al hacer click abre un dropdown con navegación (Ver mi portada, Detalles del turno).
 * - Modo **compact** (cocina, mozo mobile): muestra solo las iniciales con un
 *   mini-chevron de indicación. Mismo dropdown que full.
 *
 * ## Decisión de diseño: "Liberar dispositivo" NO está en el dropdown
 * Liberar el dispositivo es una acción destructiva e irreversible durante el turno.
 * Se mantiene exclusivamente dentro del drawer de sesión ("Detalles del turno"),
 * donde el empleado ve el contexto completo antes de actuar. Esto evita taps
 * accidentales en entornos táctiles (cocina, mostrador), alineado con cómo
 * Toast POS y Square manejan el cierre de sesión en tablets.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, User, LayoutDashboard } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ROLE_LABELS } from '@/src/core/constants/roles';

type AccentColor = 'emerald' | 'violet' | 'amber' | 'sky' | 'red';

export interface EmployeeProfileButtonProps {
  employeeName: string;
  employeeRole: string;
  accentColor: AccentColor;
  /** Abre el panel lateral con detalles de sesión y opción de logout */
  onOpenDrawer: () => void;
  /** Libera el dispositivo (usado solo si el padre lo necesita externamente) */
  onLogout?: () => void;
  compact?: boolean;
}

const COLOR_MAP: Record<AccentColor, { bg: string; border: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300', ring: 'ring-emerald-500/30' },
  violet:  { bg: 'bg-violet-500/20',  border: 'border-violet-500/40',  text: 'text-violet-300',  ring: 'ring-violet-500/30' },
  amber:   { bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   text: 'text-amber-300',   ring: 'ring-amber-500/30' },
  sky:     { bg: 'bg-sky-500/20',     border: 'border-sky-500/40',     text: 'text-sky-300',     ring: 'ring-sky-500/30' },
  red:     { bg: 'bg-red-500/20',     border: 'border-red-500/40',     text: 'text-red-300',     ring: 'ring-red-500/30' },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  return parts.map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function EmployeeProfileButton({
  employeeName,
  employeeRole,
  accentColor,
  onOpenDrawer,
  compact = false,
}: EmployeeProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const colors = COLOR_MAP[accentColor];
  const initials = getInitials(employeeName);
  const roleLabel = ROLE_LABELS[employeeRole] ?? employeeRole;

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [isOpen]);

  // Cierra con Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">

      {/* ── Trigger: modo compact ── */}
      {compact ? (
        <button
          onClick={() => setIsOpen(o => !o)}
          className={cn(
            'relative flex items-center justify-center w-10 h-10 rounded-lg border transition-all touch-manipulation',
            colors.bg, colors.border,
            isOpen ? `ring-2 ${colors.ring}` : 'hover:ring-1 hover:ring-zinc-600',
          )}
          title={`${employeeName} — ${roleLabel}`}
          aria-label={`Menú de perfil de ${employeeName}`}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <span className={cn('text-sm font-bold', colors.text)}>{initials}</span>
          {/* Indicador mini de dropdown */}
          <ChevronDown
            className={cn(
              'absolute bottom-0.5 right-0.5 w-2.5 h-2.5 text-zinc-500 transition-transform duration-150',
              isOpen && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      ) : (
        /* ── Trigger: modo full ── */
        <button
          onClick={() => setIsOpen(o => !o)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all touch-manipulation',
            colors.bg, colors.border,
            isOpen ? `ring-2 ${colors.ring}` : `hover:ring-1 ${colors.ring}`,
          )}
          aria-label={`Menú de perfil de ${employeeName}`}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center ring-1 flex-shrink-0',
            colors.bg, colors.ring,
          )}>
            <span className={cn('text-xs font-bold', colors.text)}>{initials}</span>
          </div>
          <span className="text-sm text-zinc-300 truncate max-w-[120px]">{employeeName}</span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 text-zinc-500 transition-transform duration-150', isOpen && 'rotate-180')}
            aria-hidden
          />
        </button>
      )}

      {/* ── Dropdown ── */}
      {isOpen && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-700',
            'bg-zinc-900/95 backdrop-blur-sm shadow-2xl z-50 overflow-hidden',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150',
          )}
        >
          {/* Cabecera: identidad del empleado */}
          <div className={cn('px-4 py-3 border-b border-zinc-800', colors.bg)}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center ring-1 flex-shrink-0',
                colors.bg, colors.ring,
              )}>
                <span className={cn('text-sm font-bold', colors.text)}>{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-snug">{employeeName}</p>
                <p className={cn('text-xs leading-snug', colors.text)}>{roleLabel}</p>
              </div>
            </div>
          </div>

          {/* Opciones de navegación */}
          <div role="group" className="py-1">
            <a
              href="/employee"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <User className="w-4 h-4 text-zinc-500 flex-shrink-0" aria-hidden />
              Ver mi portada
            </a>
            <button
              role="menuitem"
              onClick={() => { setIsOpen(false); onOpenDrawer(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-zinc-500 flex-shrink-0" aria-hidden />
              Detalles del turno
            </button>
          </div>

          {/* Nota de pie: cómo liberar el dispositivo */}
          <p className="px-4 py-2.5 text-[11px] text-zinc-600 border-t border-zinc-800 leading-snug">
            Para liberar el dispositivo, abre{' '}
            <span className="text-zinc-500 font-medium">Detalles del turno</span>
          </p>
        </div>
      )}
    </div>
  );
}
