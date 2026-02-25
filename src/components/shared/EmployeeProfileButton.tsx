'use client';

/**
 * EmployeeProfileButton - Compact chip showing employee initials + name
 * Used in POS, Mozo, and Cocina headers as profile trigger
 */

import { cn } from '@/src/lib/utils';

type AccentColor = 'emerald' | 'violet' | 'amber' | 'sky' | 'red';

interface EmployeeProfileButtonProps {
  employeeName: string;
  accentColor: AccentColor;
  onClick: () => void;
  compact?: boolean;
}

const COLOR_MAP: Record<AccentColor, { bg: string; border: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300', ring: 'ring-emerald-500/30' },
  violet:  { bg: 'bg-violet-500/20',  border: 'border-violet-500/40',  text: 'text-violet-300',  ring: 'ring-violet-500/30' },
  amber:   { bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   text: 'text-amber-300',   ring: 'ring-amber-500/30' },
  sky:     { bg: 'bg-sky-500/20',      border: 'border-sky-500/40',     text: 'text-sky-300',     ring: 'ring-sky-500/30' },
  red:     { bg: 'bg-red-500/20',      border: 'border-red-500/40',     text: 'text-red-300',     ring: 'ring-red-500/30' },
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function EmployeeProfileButton({ employeeName, accentColor, onClick, compact = false }: EmployeeProfileButtonProps) {
  const colors = COLOR_MAP[accentColor];
  const initials = getInitials(employeeName);

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-lg border transition-all touch-manipulation',
          colors.bg, colors.border,
          `hover:ring-2 ${colors.ring}`
        )}
        title={employeeName}
        aria-label={`Perfil de ${employeeName}`}
      >
        <span className={cn('text-sm font-bold', colors.text)}>{initials}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all touch-manipulation',
        colors.bg, colors.border,
        `hover:ring-2 ${colors.ring}`
      )}
      aria-label={`Perfil de ${employeeName}`}
    >
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center ring-1', colors.bg, colors.ring)}>
        <span className={cn('text-xs font-bold', colors.text)}>{initials}</span>
      </div>
      <span className="text-sm text-zinc-300 truncate max-w-[120px]">{employeeName}</span>
    </button>
  );
}
