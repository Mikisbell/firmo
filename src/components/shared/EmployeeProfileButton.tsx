'use client';

/**
 * EmployeeProfileButton - Dropdown chip showing employee initials + name.
 * Opens a dropdown menu with portal navigation and session actions.
 * Used in POS, Mozo, and Cocina headers.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, User, LayoutDashboard, LogOut } from 'lucide-react';
import { cn } from '@/src/lib/utils';

type AccentColor = 'emerald' | 'violet' | 'amber' | 'sky' | 'red';

interface EmployeeProfileButtonProps {
  employeeName: string;
  employeeRole: string;
  accentColor: AccentColor;
  /** Opens the session detail drawer */
  onOpenDrawer: () => void;
  /** Releases the device (clears session) */
  onLogout: () => void;
  compact?: boolean;
}

const COLOR_MAP: Record<AccentColor, { bg: string; border: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300', ring: 'ring-emerald-500/30' },
  violet:  { bg: 'bg-violet-500/20',  border: 'border-violet-500/40',  text: 'text-violet-300',  ring: 'ring-violet-500/30' },
  amber:   { bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   text: 'text-amber-300',   ring: 'ring-amber-500/30' },
  sky:     { bg: 'bg-sky-500/20',     border: 'border-sky-500/40',     text: 'text-sky-300',     ring: 'ring-sky-500/30' },
  red:     { bg: 'bg-red-500/20',     border: 'border-red-500/40',     text: 'text-red-300',     ring: 'ring-red-500/30' },
};

const ROLE_LABELS: Record<string, string> = {
  OWNER:   'Propietario',
  ADMIN:   'Administrador',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero(a)',
  WAITER:  'Mesero(a)',
  KITCHEN: 'Cocina',
  BAR:     'Barman',
  DRIVER:  'Repartidor(a)',
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function EmployeeProfileButton({
  employeeName,
  employeeRole,
  accentColor,
  onOpenDrawer,
  onLogout,
  compact = false,
}: EmployeeProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const colors = COLOR_MAP[accentColor];
  const initials = getInitials(employeeName);
  const roleLabel = ROLE_LABELS[employeeRole] ?? employeeRole;

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">

      {/* ── Trigger ── */}
      {compact ? (
        <button
          onClick={() => setIsOpen(o => !o)}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg border transition-all touch-manipulation',
            colors.bg, colors.border,
            isOpen && `ring-2 ${colors.ring}`,
          )}
          title={employeeName}
          aria-label={`Perfil de ${employeeName}`}
          aria-expanded={isOpen}
        >
          <span className={cn('text-sm font-bold', colors.text)}>{initials}</span>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(o => !o)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all touch-manipulation',
            colors.bg, colors.border,
            isOpen && `ring-2 ${colors.ring}`,
          )}
          aria-label={`Perfil de ${employeeName}`}
          aria-expanded={isOpen}
        >
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center ring-1', colors.bg, colors.ring)}>
            <span className={cn('text-xs font-bold', colors.text)}>{initials}</span>
          </div>
          <span className="text-sm text-zinc-300 truncate max-w-[120px]">{employeeName}</span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-500 transition-transform', isOpen && 'rotate-180')} />
        </button>
      )}

      {/* ── Dropdown ── */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl z-50 overflow-hidden">

          {/* Header: avatar + name + role */}
          <div className={cn('px-4 py-3 border-b border-zinc-800', colors.bg)}>
            <div className="flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center ring-1 flex-shrink-0', colors.bg, colors.ring)}>
                <span className={cn('text-sm font-bold', colors.text)}>{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{employeeName}</p>
                <p className={cn('text-xs', colors.text)}>{roleLabel}</p>
              </div>
            </div>
          </div>

          {/* Navigation items */}
          <div className="py-1">
            <a
              href="/employee"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <User className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              Ver mi portada
            </a>
            <button
              onClick={() => { setIsOpen(false); onOpenDrawer(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              Detalles del turno
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-zinc-800 py-1">
            <button
              onClick={() => { setIsOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Liberar dispositivo
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
