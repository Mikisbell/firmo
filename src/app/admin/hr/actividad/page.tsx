'use client';

/**
 * Daily Employee Activity Page — /admin/hr/actividad
 *
 * Shows per-employee attendance and order stats for a selected day.
 * Date picker: Yesterday / Today / custom date input.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Activity, Clock, ShoppingBag, DollarSign, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyActivity {
  employee_id: string;
  employee_name: string;
  role: string;
  clock_in: string;
  clock_out: string | null;
  worked_minutes: number;
  status: string;
  orders_count: number;
  revenue_cents: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  // YYYY-MM-DD in local time
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatMinutes(min: number): string {
  if (min === 0) return '0h 0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatSoles(cents: number): string {
  return `S/. ${(cents / 100).toFixed(2)}`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const ROLE_BADGE: Record<string, string> = {
  OWNER:      'bg-violet-500/20 text-violet-400',
  ADMIN:      'bg-blue-500/20 text-blue-400',
  MANAGER:    'bg-indigo-500/20 text-indigo-400',
  SUPERVISOR: 'bg-cyan-500/20 text-cyan-400',
  CASHIER:    'bg-blue-500/20 text-blue-400',
  WAITER:     'bg-amber-500/20 text-amber-400',
  KITCHEN:    'bg-green-500/20 text-green-400',
  COOK:       'bg-green-500/20 text-green-400',
  PACKER:     'bg-teal-500/20 text-teal-400',
  BAR:        'bg-purple-500/20 text-purple-400',
  DRIVER:     'bg-orange-500/20 text-orange-400',
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dueño', ADMIN: 'Admin', MANAGER: 'Gerente', SUPERVISOR: 'Supervisor',
  CASHIER: 'Cajero', WAITER: 'Mozo', KITCHEN: 'Cocina', COOK: 'Cocinero',
  PACKER: 'Empaque', BAR: 'Bar', DRIVER: 'Delivery',
};

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('Error al cargar actividad');
  return r.json();
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DailyActivityPage() {
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const apiUrl = `/api/admin/attendance/daily?date=${selectedDate}`;
  const { data, error, isLoading, mutate } = useSWR<DailyActivity[]>(apiUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const rows = data ?? [];

  // Totals
  const totalWorkedMin = rows.reduce((s, r) => s + r.worked_minutes, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders_count, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue_cents, 0);
  const activeNow = rows.filter((r) => !r.clock_out).length;

  function shiftDate(delta: number) {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + delta);
    setSelectedDate(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`,
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Actividad Diaria</h1>
            <p className="text-zinc-400 text-sm capitalize">{formatDisplayDate(selectedDate)}</p>
          </div>
        </div>
        <button
          onClick={() => mutate()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setSelectedDate(yesterdayStr())}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedDate === yesterdayStr() ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
        >
          Ayer
        </button>
        <button
          onClick={() => setSelectedDate(todayStr())}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedDate === todayStr() ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
        >
          Hoy
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftDate(-1)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => shiftDate(1)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Clock}
          label="En Turno"
          value={`${activeNow}`}
          sub={`de ${rows.length} empleados`}
          color="text-emerald-400"
          bg="bg-emerald-500/20"
        />
        <SummaryCard
          icon={Clock}
          label="Horas Totales"
          value={formatMinutes(totalWorkedMin)}
          sub="tiempo trabajado"
          color="text-blue-400"
          bg="bg-blue-500/20"
        />
        <SummaryCard
          icon={ShoppingBag}
          label="Pedidos"
          value={`${totalOrders}`}
          sub="ordenes del día"
          color="text-amber-400"
          bg="bg-amber-500/20"
        />
        <SummaryCard
          icon={DollarSign}
          label="Ventas"
          value={formatSoles(totalRevenue)}
          sub="total del día"
          color="text-green-400"
          bg="bg-green-500/20"
        />
      </div>

      {/* Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Empleado</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Rol</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Entrada</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Salida</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Horas</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Pedidos</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Ventas</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Cargando...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-red-400">
                    Error al cargar datos
                  </td>
                </tr>
              )}
              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    Sin registros de asistencia para este día
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.employee_id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-100">{row.employee_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[row.role] ?? 'bg-zinc-700 text-zinc-300'}`}>
                      {ROLE_LABEL[row.role] ?? row.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{formatTime(row.clock_in)}</td>
                  <td className="px-4 py-3">
                    {row.clock_out ? (
                      <span className="text-zinc-300">{formatTime(row.clock_out)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        En turno
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300">{formatMinutes(row.worked_minutes)}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{row.orders_count}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{formatSoles(row.revenue_cents)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-700 bg-zinc-800/50">
                  <td colSpan={4} className="px-4 py-3 text-zinc-400 font-medium">Totales</td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-200">{formatMinutes(totalWorkedMin)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-200">{totalOrders}</td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-200">{formatSoles(totalRevenue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-zinc-400 mt-1">{label}</p>
      <p className="text-xs text-zinc-600">{sub}</p>
    </div>
  );
}
