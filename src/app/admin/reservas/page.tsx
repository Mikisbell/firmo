'use client';

/**
 * Admin Reservations Page — Dark theme, SWR data fetching
 *
 * Features:
 * - Date picker (default: today)
 * - Summary KPI cards: total, confirmadas, pendientes, canceladas, no-show
 * - Filterable reservation list
 * - Action buttons per reservation: Confirmar, Rechazar, Llego, Sentar, No-show, Cancelar
 * - SWR auto-refresh
 * - Toast notifications via sonner
 *
 * Fetches from:
 * - GET /api/admin/reservations?date=YYYY-MM-DD&status=X
 * - PATCH /api/admin/reservations/[id] { action }
 *
 * @module app/admin/reservas/page
 */

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  CalendarDays,
  Users,
  Clock,
  Check,
  X,
  AlertTriangle,
  Loader2,
  UserCheck,
  Armchair,
  Ban,
  Eye,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface AdminReservation {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  date: string;
  time: string;
  duration_minutes: number;
  party_size: number;
  status: string;
  confirmation_code: string | null;
  table_id: string | null;
  table_number: string | null;
  zone_preference: string | null;
  special_requests: string | null;
  internal_notes: string | null;
  arrived_at: string | null;
  seated_at: string | null;
  no_show_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
}

interface ReservationSummary {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  no_show: number;
  arrived: number;
  seated: number;
  rejected: number;
  completed: number;
}

interface ApiResponse {
  success: boolean;
  data: {
    reservations: AdminReservation[];
    summary: ReservationSummary;
  };
  error?: string;
}

type ReservationAction = 'confirm' | 'reject' | 'arrive' | 'seat' | 'no_show' | 'cancel';

// ============================================================================
// SWR fetcher
// ============================================================================

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al cargar reservas');
  }
  return res.json();
};

// ============================================================================
// Helpers
// ============================================================================

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Status display config */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'Pendiente',  color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  CONFIRMED: { label: 'Confirmada', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  REJECTED:  { label: 'Rechazada',  color: 'text-red-400', bg: 'bg-red-500/15' },
  CANCELLED: { label: 'Cancelada',  color: 'text-zinc-400', bg: 'bg-zinc-500/15' },
  ARRIVED:   { label: 'Llego',      color: 'text-blue-400', bg: 'bg-blue-500/15' },
  SEATED:    { label: 'Sentada',    color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  NO_SHOW:   { label: 'No-show',    color: 'text-red-400', bg: 'bg-red-500/15' },
  COMPLETED: { label: 'Completada', color: 'text-zinc-400', bg: 'bg-zinc-500/15' },
};

/** Available actions per status */
const ACTIONS_BY_STATUS: Record<string, { action: ReservationAction; label: string; icon: React.ElementType; color: string }[]> = {
  PENDING: [
    { action: 'confirm', label: 'Confirmar', icon: Check, color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { action: 'reject', label: 'Rechazar', icon: X, color: 'bg-red-600 hover:bg-red-700 text-white' },
    { action: 'cancel', label: 'Cancelar', icon: Ban, color: 'bg-zinc-600 hover:bg-zinc-700 text-white' },
  ],
  CONFIRMED: [
    { action: 'arrive', label: 'Llego', icon: UserCheck, color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { action: 'no_show', label: 'No-show', icon: AlertTriangle, color: 'bg-orange-600 hover:bg-orange-700 text-white' },
    { action: 'cancel', label: 'Cancelar', icon: Ban, color: 'bg-zinc-600 hover:bg-zinc-700 text-white' },
  ],
  ARRIVED: [
    { action: 'seat', label: 'Sentar', icon: Armchair, color: 'bg-cyan-600 hover:bg-cyan-700 text-white' },
  ],
  SEATED: [],
  REJECTED: [],
  CANCELLED: [],
  NO_SHOW: [],
  COMPLETED: [],
};

/** Status filter options */
const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'ARRIVED', label: 'Llegaron' },
  { value: 'SEATED', label: 'Sentadas' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function AdminReservasPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build URL with filters
  const apiUrl = `/api/admin/reservations?date=${selectedDate}${statusFilter ? `&status=${statusFilter}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    apiUrl,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    },
  );

  const reservations = data?.data?.reservations || [];
  const summary = data?.data?.summary || {
    total: 0, confirmed: 0, pending: 0, cancelled: 0,
    no_show: 0, arrived: 0, seated: 0, rejected: 0, completed: 0,
  };

  // ── Perform action ──
  const handleAction = async (reservationId: string, action: ReservationAction) => {
    setActionLoading(reservationId);

    try {
      const res = await fetch(`/api/admin/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al realizar la accion');
        return;
      }

      const actionLabels: Record<string, string> = {
        confirm: 'confirmada',
        reject: 'rechazada',
        arrive: 'marcada como llegada',
        seat: 'sentada en mesa',
        no_show: 'marcada como no-show',
        cancel: 'cancelada',
      };

      toast.success(`Reserva ${actionLabels[action] || 'actualizada'}`);
      mutate();
    } catch {
      toast.error('Error de conexion. Intente de nuevo.');
    } finally {
      setActionLoading(null);
    }
  };

  const isToday = selectedDate === getTodayStr();

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Reservas</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Gestion de reservas de mesa del dia
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm font-medium text-zinc-300 min-h-[44px]"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* ── Date Navigator ── */}
      <div className="flex items-center gap-3 bg-zinc-900 rounded-xl border border-zinc-800 p-3">
        <button
          onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <CalendarDays className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-zinc-200">
              {formatDateDisplay(selectedDate)}
            </span>
            {isToday && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-400 uppercase">
                Hoy
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          aria-label="Dia siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {!isToday && (
          <button
            onClick={() => setSelectedDate(getTodayStr())}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-colors"
          >
            Hoy
          </button>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard label="Total" value={summary.total} color="text-zinc-100" />
        <SummaryCard label="Pendientes" value={summary.pending} color="text-yellow-400" />
        <SummaryCard label="Confirmadas" value={summary.confirmed} color="text-emerald-400" />
        <SummaryCard label="No-show" value={summary.no_show} color="text-red-400" />
        <SummaryCard label="Canceladas" value={summary.cancelled} color="text-zinc-400" />
      </div>

      {/* ── Status Filter ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border',
              statusFilter === f.value
                ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Reservation List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
          <span className="ml-3 text-sm text-zinc-500">Cargando reservas...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error instanceof Error ? error.message : 'Error al cargar reservas'}
        </div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">
            {statusFilter
              ? 'No hay reservas con ese filtro para este dia'
              : 'No hay reservas para este dia'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => {
            const statusCfg = STATUS_CONFIG[res.status] || STATUS_CONFIG.PENDING;
            const actions = ACTIONS_BY_STATUS[res.status] || [];
            const isExpanded = expandedId === res.id;
            const isActionLoading = actionLoading === res.id;

            return (
              <div
                key={res.id}
                className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"
              >
                {/* Main row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : res.id)}
                >
                  {/* Time */}
                  <div className="text-center min-w-[56px]">
                    <span className="text-lg font-bold text-zinc-100">{res.time}</span>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-10 bg-zinc-800" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {res.customer_name}
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                        statusCfg.bg, statusCfg.color,
                      )}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {res.party_size}
                      </span>
                      {res.confirmation_code && (
                        <span className="font-mono tracking-wider">
                          {res.confirmation_code}
                        </span>
                      )}
                      {res.zone_preference && (
                        <span className="truncate max-w-[120px]">{res.zone_preference}</span>
                      )}
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <Eye className={cn(
                    'w-4 h-4 text-zinc-600 flex-shrink-0 transition-transform',
                    isExpanded && 'text-zinc-400',
                  )} />
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-800">
                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-3 py-3 text-sm">
                      <DetailItem icon={Phone} label="Telefono" value={res.customer_phone} />
                      <DetailItem icon={Clock} label="Duracion" value={`${res.duration_minutes} min`} />
                      {res.special_requests && (
                        <div className="col-span-2">
                          <DetailItem icon={MessageSquare} label="Notas" value={res.special_requests} />
                        </div>
                      )}
                      {res.table_number && (
                        <DetailItem icon={Armchair} label="Mesa" value={res.table_number} />
                      )}
                      {res.cancelled_reason && (
                        <div className="col-span-2">
                          <DetailItem icon={Ban} label="Razon cancelacion" value={res.cancelled_reason} />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-800">
                        {actions.map((act) => {
                          const ActionIcon = act.icon;
                          return (
                            <button
                              key={act.action}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAction(res.id, act.action);
                              }}
                              disabled={isActionLoading}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px]',
                                isActionLoading ? 'opacity-50 cursor-not-allowed' : act.color,
                              )}
                            >
                              {isActionLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ActionIcon className="w-3.5 h-3.5" />
                              )}
                              {act.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-zinc-600 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wide">{label}</p>
        <p className="text-zinc-300 text-sm truncate">{value}</p>
      </div>
    </div>
  );
}
