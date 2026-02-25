'use client';

/**
 * EmployeeProfileDrawer - Right-side slide-in panel showing employee profile
 * Shows: avatar, name, role, terminal info, session time, logout button
 * Pattern matches NotificationPanel from mozo page
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Monitor, Shield, Clock } from 'lucide-react';
import { cn } from '@/src/lib/utils';

type AccentColor = 'emerald' | 'violet' | 'amber' | 'sky' | 'red';

interface EmployeeProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  employeeRole: string;
  terminalId: string;
  terminalRole?: string;
  sessionCreatedAt?: Date | string;
  accentColor: AccentColor;
  onLogout: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero(a)',
  WAITER: 'Mesero(a)',
  KITCHEN: 'Cocina',
  BAR: 'Barman',
  DRIVER: 'Repartidor(a)',
};

const TERMINAL_ROLE_LABELS: Record<string, string> = {
  CASHIER: 'Caja',
  WAITER: 'Mesero',
  MOZO: 'Mesero',
  KDS: 'Cocina',
  KDS_COCINA: 'Cocina',
  KDS_HORNO: 'Horno/Parrilla',
  KDS_BAR: 'Bar',
  BAR: 'Bar',
  ADMIN: 'Admin',
};

const ACCENT_CONFIG: Record<AccentColor, {
  gradient: string;
  border: string;
  text: string;
  avatarBg: string;
  avatarRing: string;
  avatarText: string;
}> = {
  emerald: {
    gradient: 'from-emerald-950/80 to-zinc-950',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    avatarBg: 'bg-emerald-500/20',
    avatarRing: 'ring-emerald-500/50',
    avatarText: 'text-emerald-300',
  },
  violet: {
    gradient: 'from-violet-950/80 to-zinc-950',
    border: 'border-violet-500/30',
    text: 'text-violet-400',
    avatarBg: 'bg-violet-500/20',
    avatarRing: 'ring-violet-500/50',
    avatarText: 'text-violet-300',
  },
  amber: {
    gradient: 'from-amber-950/80 to-zinc-950',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    avatarBg: 'bg-amber-500/20',
    avatarRing: 'ring-amber-500/50',
    avatarText: 'text-amber-300',
  },
  sky: {
    gradient: 'from-sky-950/80 to-zinc-950',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    avatarBg: 'bg-sky-500/20',
    avatarRing: 'ring-sky-500/50',
    avatarText: 'text-sky-300',
  },
  red: {
    gradient: 'from-red-950/80 to-zinc-950',
    border: 'border-red-500/30',
    text: 'text-red-400',
    avatarBg: 'bg-red-500/20',
    avatarRing: 'ring-red-500/50',
    avatarText: 'text-red-300',
  },
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatSessionTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `hace ${diffHrs}h ${diffMin % 60}m`;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Monitor; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4">
      <Icon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
      <span className="text-sm text-zinc-500 w-24">{label}</span>
      <span className="text-sm text-zinc-200 font-medium">{value}</span>
    </div>
  );
}

export function EmployeeProfileDrawer({
  isOpen,
  onClose,
  employeeName,
  employeeRole,
  terminalId,
  terminalRole,
  sessionCreatedAt,
  accentColor,
  onLogout,
}: EmployeeProfileDrawerProps) {
  const colors = ACCENT_CONFIG[accentColor];
  const initials = getInitials(employeeName);
  const roleLabel = ROLE_LABELS[employeeRole] || employeeRole;
  const terminalRoleLabel = terminalRole ? (TERMINAL_ROLE_LABELS[terminalRole] || terminalRole) : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              'fixed right-0 top-0 bottom-0 w-full sm:w-[360px]',
              'bg-zinc-950 border-l-2 shadow-2xl z-50 flex flex-col',
              colors.border
            )}
          >
            {/* Header */}
            <div className={cn(
              'flex items-center justify-between px-5 py-4 border-b border-zinc-800',
              `bg-gradient-to-r ${colors.gradient}`
            )}>
              <h2 className="text-lg font-bold text-white">Mi Perfil</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-zinc-800 transition-colors touch-manipulation"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Avatar + Name */}
            <div className="py-8 px-6 flex flex-col items-center text-center border-b border-zinc-800">
              <div className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center ring-2 mb-4',
                colors.avatarBg, colors.avatarRing
              )}>
                <span className={cn('text-2xl font-black', colors.avatarText)}>{initials}</span>
              </div>
              <h3 className="text-xl font-bold text-white">{employeeName}</h3>
              <span className={cn('text-sm font-medium mt-1', colors.text)}>{roleLabel}</span>
            </div>

            {/* Info */}
            <div className="py-2">
              <InfoRow icon={Monitor} label="Terminal" value={terminalId} />
              {terminalRoleLabel && (
                <InfoRow icon={Shield} label="Estación" value={terminalRoleLabel} />
              )}
              {sessionCreatedAt && (
                <InfoRow icon={Clock} label="Sesión" value={formatSessionTime(sessionCreatedAt)} />
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Logout */}
            <div className="p-4 border-t border-zinc-800">
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl
                  bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300
                  border border-red-500/30 font-medium text-base transition-all touch-manipulation"
              >
                <LogOut size={20} />
                Cerrar Sesión
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
