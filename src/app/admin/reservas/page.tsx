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
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState } from '@/src/components/ui';

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
const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'critical' | 'info' | 'neutral'; label: string }> = {
  PENDING:   { variant: 'warning', label: 'Pendiente' },
  CONFIRMED: { variant: 'success', label: 'Confirmada' },
  REJECTED:  { variant: 'critical', label: 'Rechazada' },
  CANCELLED: { variant: 'neutral', label: 'Cancelada' },
  ARRIVED:   { variant: 'info', label: 'Llego' },
  SEATED:    { variant: 'info', label: 'Sentada' },
  NO_SHOW:   { variant: 'critical', label: 'No-show' },
  COMPLETED: { variant: 'neutral', label: 'Completada' },
};

/** Available actions per status */
const ACTIONS_BY_STATUS: Record<string, { action: ReservationAction; label: string; icon: React.ElementType; variant: 'primary' | 'destructive' | 'secondary' }[]> = {
  PENDING: [
    { action: 'confirm', label: 'Confirmar', icon: Check, variant: 'primary' },
    { action: 'reject', label: 'Rechazar', icon: X, variant: 'destructive' },
    { action: 'cancel', label: 'Cancelar', icon: Ban, variant: 'secondary' },
  ],
  CONFIRMED: [
    { action: 'arrive', label: 'Llego', icon: UserCheck, variant: 'primary' },
    { action: 'no_show', label: 'No-show', icon: AlertTriangle, variant: 'destructive' },
    { action: 'cancel', label: 'Cancelar', icon: Ban, variant: 'secondary' },
  ],
  ARRIVED: [
    { action: 'seat', label: 'Sentar', icon: Armchair, variant: 'primary' },
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
    <div className="p-4 space-y-6">
      {/* ── Header ── */}
      <PageHeader
        title="Reservas"
        description="Gestion de reservas de mesa del dia"
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => mutate()}
          >
            Actualizar
          </Button>
        }
      />

      {/* ── Date Navigator ── */}
      <Card padding="sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="p-2 rounded-lg hover:bg-park-gray-800 transition-colors text-park-gray-400 hover:text-park-gray-200"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <CalendarDays className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-park-gray-200">
                {formatDateDisplay(selectedDate)}
              </span>
              {isToday && (
                <Badge variant="warning">Hoy</Badge>
              )}
            </div>
          </div>

          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            className="p-2 rounded-lg hover:bg-park-gray-800 transition-colors text-park-gray-400 hover:text-park-gray-200"
            aria-label="Dia siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(getTodayStr())}
            >
              Hoy
            </Button>
          )}
        </div>
      </Card>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard label="Total" value={summary.total} />
        <MetricCard label="Pendientes" value={summary.pending} />
        <MetricCard label="Confirmadas" value={summary.confirmed} />
        <MetricCard label="No-show" value={summary.no_show} />
        <MetricCard label="Canceladas" value={summary.cancelled} />
      </div>

      {/* ── Status Filter ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-park-gray-600 flex-shrink-0" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border',
              statusFilter === f.value
                ? 'bg-park-brand-600/15 text-park-brand-400 border-park-brand-600/30'
                : 'bg-park-gray-900 text-park-gray-400 border-park-gray-800 hover:border-park-gray-700 hover:text-park-gray-300',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Reservation List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-park-gray-600 animate-spin" />
          <span className="ml-3 text-sm text-park-gray-400">Cargando reservas...</span>
        </div>
      ) : error ? (
        <Card padding="sm">
          <p className="text-red-400 text-sm">
            {error instanceof Error ? error.message : 'Error al cargar reservas'}
          </p>
        </Card>
      ) : reservations.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<CalendarDays />}
            title="Sin reservas"
            description={
              statusFilter
                ? 'No hay reservas con ese filtro para este dia'
                : 'No hay reservas para este dia'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => {
            const badgeCfg = STATUS_BADGE[res.status] || { variant: 'neutral' as const, label: res.status };
            const actions = ACTIONS_BY_STATUS[res.status] || [];
            const isExpanded = expandedId === res.id;
            const isActionLoading = actionLoading === res.id;

            return (
              <Card key={res.id} padding="none">
                {/* Main row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-park-gray-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : res.id)}
                >
                  {/* Time */}
                  <div className="text-center min-w-[56px]">
                    <span className="text-lg font-bold text-white">{res.time}</span>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-10 bg-park-gray-800" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-park-gray-200 truncate">
                        {res.customer_name}
                      </span>
                      <Badge variant={badgeCfg.variant}>{badgeCfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-park-gray-400">
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
                    'w-4 h-4 text-park-gray-600 flex-shrink-0 transition-transform',
                    isExpanded && 'text-park-gray-400',
                  )} />
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-park-gray-800">
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
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-park-gray-800">
                        {actions.map((act) => {
                          const ActionIcon = act.icon;
                          return (
                            <Button
                              key={act.action}
                              variant={act.variant}
                              size="sm"
                              icon={<ActionIcon className="w-3.5 h-3.5" />}
                              loading={isActionLoading}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAction(res.id, act.action);
                              }}
                            >
                              {act.label}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
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
      <Icon className="w-3.5 h-3.5 text-park-gray-600 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-park-gray-600 uppercase tracking-wide">{label}</p>
        <p className="text-park-gray-300 text-sm truncate">{value}</p>
      </div>
    </div>
  );
}
