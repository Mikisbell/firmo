'use client';

/**
 * EmployeeProfileDrawer
 *
 * Panel lateral deslizante que muestra el perfil del empleado durante su turno.
 * Se abre al tocar el botón con el nombre/iniciales del empleado en la barra
 * superior de POS, Mozo y Cocina.
 *
 * ## Decisiones de diseño (basadas en análisis de Toast POS, Square, Lightspeed)
 *
 * ### "Liberar dispositivo" vs "Cerrar Sesión"
 * En todos los POS de restaurante modernos (Toast, Square, Revel), cerrar sesión
 * en el dispositivo NO equivale a terminar el turno del empleado. El botón libera
 * la pantalla para que otro colaborador ingrese su PIN. El historial y turno del
 * empleado anterior permanece intacto en el sistema.
 *
 * ### Terminal ID: nunca mostrar IDs internos
 * Las sesiones por PIN generan terminales COLAB_<id> internamente. Mostrar este
 * valor técnico confunde al usuario ("¿qué es COLAB_abc123?"). Referencia: ningún
 * POS del rubro expone IDs de sesión al empleado. Se normaliza a texto legible.
 *
 * ### Stat por rol (inspirado en Toast POS y Square for Restaurants)
 * Toast muestra mesas activas del mesero en su perfil. Square muestra ventas del
 * turno para cajeros. Lightspeed muestra tickets para cocina. Se implementa
 * mediante una prop `stat` opcional para no acoplar el drawer a ninguna fuente
 * de datos específica.
 *
 * ## Props
 * @prop stat - Indicador clave para el rol actual. Cada página pasa el dato
 *   relevante: mesas activas (mozo), órdenes en cola (cajero/POS), tickets (cocina).
 * @prop terminalId - Se normaliza internamente: COLAB_* → "Por PIN",
 *   CAJA_01 → "Caja 01". Nunca se muestra el ID técnico crudo.
 * @prop sessionCreatedAt - Acepta Date o string ISO (sessionStorage devuelve string
 *   al parsear JSON, no Date nativo).
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Shield, Clock, Smartphone, ExternalLink } from 'lucide-react';
import { cn } from '@/src/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AccentColor = 'emerald' | 'violet' | 'amber' | 'sky' | 'red';

export interface EmployeeProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nombre completo del empleado. Se usa para generar iniciales del avatar. */
  employeeName: string;
  /** Rol del sistema: WAITER | CASHIER | KITCHEN | BAR | DRIVER | ADMIN etc. */
  employeeRole: string;
  /**
   * ID del terminal. Se normaliza para ocultar valores técnicos internos:
   * - COLAB_* → "Por PIN"
   * - CAJA_01 → "Caja 01"
   */
  terminalId: string;
  /** Rol del terminal. Se muestra como "Estación" si difiere del rol del empleado. */
  terminalRole?: string;
  /**
   * Momento de inicio de sesión. Acepta Date o string ISO porque sessionStorage
   * devuelve strings al parsear JSON (JSON.parse no reconstruye objetos Date).
   */
  sessionCreatedAt?: Date | string;
  /** Color del tema del panel: debe coincidir con el color de la página. */
  accentColor: AccentColor;
  /**
   * Indicador clave relevante para el rol. Inspirado en Toast POS (mesas activas
   * para meseros) y Square (ventas de turno para cajeros).
   *
   * @example
   * // Mozo: mesas ocupadas
   * stat={{ label: 'Mesas activas', value: occupiedCount }}
   *
   * @example
   * // POS/Cajero: órdenes en cola
   * stat={{ label: 'Órdenes en espera', value: orders.length }}
   *
   * @example
   * // Cocina: tickets pendientes
   * stat={{ label: 'Tickets pendientes', value: tickets.length }}
   */
  stat?: { label: string; value: string | number };
  /** Acción al presionar "Liberar dispositivo". Limpia la sesión local y redirige. */
  onLogout: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

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

const TERMINAL_ROLE_LABELS: Record<string, string> = {
  CASHIER:   'Caja',
  WAITER:    'Mesero',
  MOZO:      'Mesero',
  KDS:       'Cocina',
  KDS_COCINA:'Cocina',
  KDS_HORNO: 'Horno / Parrilla',
  KDS_BAR:   'Bar',
  BAR:       'Bar',
  ADMIN:     'Admin',
};

const ACCENT_CONFIG: Record<AccentColor, {
  gradient: string; border: string; text: string;
  avatarBg: string; avatarRing: string; avatarText: string;
  statBg: string; statBorder: string;
}> = {
  emerald: {
    gradient:   'from-emerald-950/80 to-zinc-950',
    border:     'border-emerald-500/30',
    text:       'text-emerald-400',
    avatarBg:   'bg-emerald-500/20',
    avatarRing: 'ring-emerald-500/50',
    avatarText: 'text-emerald-300',
    statBg:     'bg-emerald-500/10',
    statBorder: 'border-emerald-500/30',
  },
  violet: {
    gradient:   'from-violet-950/80 to-zinc-950',
    border:     'border-violet-500/30',
    text:       'text-violet-400',
    avatarBg:   'bg-violet-500/20',
    avatarRing: 'ring-violet-500/50',
    avatarText: 'text-violet-300',
    statBg:     'bg-violet-500/10',
    statBorder: 'border-violet-500/30',
  },
  amber: {
    gradient:   'from-amber-950/80 to-zinc-950',
    border:     'border-amber-500/30',
    text:       'text-amber-400',
    avatarBg:   'bg-amber-500/20',
    avatarRing: 'ring-amber-500/50',
    avatarText: 'text-amber-300',
    statBg:     'bg-amber-500/10',
    statBorder: 'border-amber-500/30',
  },
  sky: {
    gradient:   'from-sky-950/80 to-zinc-950',
    border:     'border-sky-500/30',
    text:       'text-sky-400',
    avatarBg:   'bg-sky-500/20',
    avatarRing: 'ring-sky-500/50',
    avatarText: 'text-sky-300',
    statBg:     'bg-sky-500/10',
    statBorder: 'border-sky-500/30',
  },
  red: {
    gradient:   'from-red-950/80 to-zinc-950',
    border:     'border-red-500/30',
    text:       'text-red-400',
    avatarBg:   'bg-red-500/20',
    avatarRing: 'ring-red-500/50',
    avatarText: 'text-red-300',
    statBg:     'bg-red-500/10',
    statBorder: 'border-red-500/30',
  },
};

// ─── Utilidades ───────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Normaliza el ID del terminal a texto legible para el empleado.
 * Los IDs internos (COLAB_*, UUIDs) nunca se muestran al usuario final.
 */
function formatTerminalId(id: string): string {
  if (!id) return '';
  // Sesión por PIN (colaborador): no tiene terminal física asignada
  if (id.startsWith('COLAB_')) return 'Por PIN';
  // Terminal con guión bajo: CAJA_01 → "Caja 01", MESA_03 → "Mesa 03"
  if (id.includes('_')) {
    const [prefix, ...rest] = id.split('_');
    const labels: Record<string, string> = { CAJA: 'Caja', MESA: 'Mesa', BAR: 'Bar', KDS: 'KDS' };
    return `${labels[prefix] ?? prefix} ${rest.join(' ')}`;
  }
  return id;
}

/**
 * Calcula el tiempo transcurrido desde el inicio de sesión.
 * Acepta Date o string ISO (sessionStorage devuelve strings al parsear JSON).
 */
function formatSessionTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1)  return 'Ahora mismo';
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4">
      <Icon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
      <span className="text-sm text-zinc-500 w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-zinc-200 font-medium truncate">{value}</span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function EmployeeProfileDrawer({
  isOpen,
  onClose,
  employeeName,
  employeeRole,
  terminalId,
  terminalRole,
  sessionCreatedAt,
  accentColor,
  stat,
  onLogout,
}: EmployeeProfileDrawerProps) {
  const colors = ACCENT_CONFIG[accentColor];
  const initials = getInitials(employeeName);
  const roleLabel = ROLE_LABELS[employeeRole] || employeeRole;
  const terminalRoleLabel = terminalRole ? (TERMINAL_ROLE_LABELS[terminalRole] || terminalRole) : '';
  const terminalDisplay = formatTerminalId(terminalId);
  const isColabSession = terminalId.startsWith('COLAB_');

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
                aria-label="Cerrar panel"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Avatar + Nombre + Rol */}
            <div className="py-7 px-6 flex flex-col items-center text-center border-b border-zinc-800">
              <div className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center ring-2 mb-4',
                colors.avatarBg, colors.avatarRing
              )}>
                <span className={cn('text-2xl font-black', colors.avatarText)}>{initials}</span>
              </div>
              <h3 className="text-xl font-bold text-white">{employeeName}</h3>
              <span className={cn('text-sm font-medium mt-1', colors.text)}>{roleLabel}</span>
              <a
                href="/employee"
                className={cn(
                  'mt-3 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                  colors.statBg, colors.statBorder, colors.text,
                  'hover:opacity-80'
                )}
              >
                <ExternalLink className="w-3 h-3" />
                Ver mi portada
              </a>
            </div>

            {/* Stat del turno (opcional, por rol) */}
            {stat !== undefined && (
              <div className="px-4 pt-4">
                <div className={cn(
                  'rounded-xl border px-5 py-4 flex items-center gap-4',
                  colors.statBg, colors.statBorder
                )}>
                  <span className={cn('text-4xl font-black tabular-nums', colors.text)}>
                    {stat.value}
                  </span>
                  <span className="text-sm text-zinc-400 leading-snug">{stat.label}</span>
                </div>
              </div>
            )}

            {/* Info de sesión */}
            <div className="py-2 mt-2">
              {terminalRoleLabel && (
                <InfoRow icon={Shield} label="Estación" value={terminalRoleLabel} />
              )}
              {sessionCreatedAt && (
                <InfoRow icon={Clock} label="En turno" value={formatSessionTime(sessionCreatedAt)} />
              )}
              {/* Mostrar acceso solo si hay info útil (ocultar IDs técnicos) */}
              {terminalDisplay && (
                <InfoRow
                  icon={Smartphone}
                  label="Acceso"
                  value={isColabSession ? 'Por PIN' : terminalDisplay}
                />
              )}
            </div>

            <div className="flex-1" />

            {/* Botón liberar dispositivo */}
            <div className="p-4 border-t border-zinc-800">
              <button
                onClick={onLogout}
                className="w-full flex flex-col items-center justify-center gap-1 py-4 rounded-xl
                  bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-200 hover:text-white
                  border border-zinc-700 font-medium text-base transition-all touch-manipulation"
              >
                <span className="flex items-center gap-2">
                  <LogOut size={18} />
                  Liberar dispositivo
                </span>
                <span className="text-xs text-zinc-500 font-normal">
                  Otro colaborador podrá ingresar con su PIN
                </span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
