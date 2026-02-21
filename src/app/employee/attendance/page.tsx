'use client';

/**
 * Employee Attendance Page - My Attendance
 *
 * Shows monthly attendance records with clock-in/out times,
 * status badges, and a monthly summary section.
 * Month selector allows navigating between months.
 */

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Timer,
  CalendarCheck,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar');
  return r.json();
});

interface AttendanceRecord {
  id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  worked_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
  status: string;
  notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PRESENT: { label: 'Presente', color: 'bg-green-500/20 text-green-400', icon: CheckCircle2 },
  ABSENT: { label: 'Ausente', color: 'bg-red-500/20 text-red-400', icon: XCircle },
  LATE: { label: 'Tardanza', color: 'bg-amber-500/20 text-amber-400', icon: AlertCircle },
  JUSTIFIED: { label: 'Justificado', color: 'bg-blue-500/20 text-blue-400', icon: ShieldCheck },
};

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1);
  const label = date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + delta);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function AttendancePage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data, error, isLoading } = useSWR<AttendanceRecord[]>(
    `/api/hr/me/attendance?month=${selectedMonth}`,
    fetcher,
  );

  const isCurrentMonth = selectedMonth === currentMonth;

  // Cannot go into the future
  const canGoForward = selectedMonth < currentMonth;

  // Monthly summary
  const summary = useMemo(() => {
    if (!Array.isArray(data)) {
      return { present: 0, absent: 0, late: 0, justified: 0, totalMinutes: 0, overtimeMinutes: 0 };
    }
    return data.reduce(
      (acc, record) => {
        if (record.status === 'PRESENT') acc.present++;
        else if (record.status === 'ABSENT') acc.absent++;
        else if (record.status === 'LATE') acc.late++;
        else if (record.status === 'JUSTIFIED') acc.justified++;
        acc.totalMinutes += record.worked_minutes || 0;
        acc.overtimeMinutes += record.overtime_minutes || 0;
        return acc;
      },
      { present: 0, absent: 0, late: 0, justified: 0, totalMinutes: 0, overtimeMinutes: 0 },
    );
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Mi Asistencia</h2>
        <p className="text-zinc-400 text-sm mt-0.5">Registro de marcaciones</p>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-3 border border-zinc-800">
        <button
          onClick={() => setSelectedMonth((prev) => shiftMonth(prev, -1))}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">{getMonthLabel(selectedMonth)}</p>
          {isCurrentMonth && (
            <p className="text-[10px] text-amber-400 font-medium">Mes actual</p>
          )}
        </div>
        <button
          onClick={() => canGoForward && setSelectedMonth((prev) => shiftMonth(prev, 1))}
          disabled={!canGoForward}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Siguiente mes"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Monthly Summary */}
      {!isLoading && !error && Array.isArray(data) && data.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            label="Presentes"
            value={summary.present}
            color="text-green-400"
            bg="bg-green-500/10"
          />
          <SummaryCard
            label="Ausentes"
            value={summary.absent}
            color="text-red-400"
            bg="bg-red-500/10"
          />
          <SummaryCard
            label="Tardanzas"
            value={summary.late}
            color="text-amber-400"
            bg="bg-amber-500/10"
          />
          <SummaryCard
            label="Justificados"
            value={summary.justified}
            color="text-blue-400"
            bg="bg-blue-500/10"
          />
          <SummaryCard
            label="Total horas"
            value={formatMinutesToHours(summary.totalMinutes)}
            color="text-zinc-300"
            bg="bg-zinc-800"
            isText
          />
          <SummaryCard
            label="Horas extra"
            value={formatMinutesToHours(summary.overtimeMinutes)}
            color="text-purple-400"
            bg="bg-purple-500/10"
            isText
          />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-7 h-7 text-zinc-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center py-12 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-zinc-400 text-sm">No se pudo cargar la asistencia</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && Array.isArray(data) && data.length === 0 && (
        <div className="text-center py-10">
          <CalendarCheck className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No hay registros para este mes</p>
        </div>
      )}

      {/* Attendance List */}
      {!isLoading && !error && Array.isArray(data) && data.length > 0 && (
        <div className="space-y-2">
          {data
            .slice()
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((record) => {
              const config = STATUS_CONFIG[record.status] || STATUS_CONFIG.PRESENT;
              const StatusIcon = config.icon;
              const dateObj = new Date(record.date);
              const dayLabel = dateObj.toLocaleDateString('es-PE', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              });

              return (
                <div
                  key={record.id}
                  className="bg-zinc-900 rounded-xl p-3 border border-zinc-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 text-center shrink-0">
                        <p className="text-sm font-bold">{dateObj.getDate()}</p>
                        <p className="text-[10px] text-zinc-500 uppercase">
                          {dateObj.toLocaleDateString('es-PE', { weekday: 'short' })}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="font-medium">
                            {formatTime(record.clock_in)}
                            {record.clock_out ? ` - ${formatTime(record.clock_out)}` : ' (abierto)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {record.worked_minutes > 0 && (
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                              <Timer className="w-3 h-3" />
                              {formatMinutesToHours(record.worked_minutes)}
                            </span>
                          )}
                          {record.overtime_minutes > 0 && (
                            <span className="text-xs text-purple-400">
                              +{formatMinutesToHours(record.overtime_minutes)} extra
                            </span>
                          )}
                          {record.late_minutes > 0 && (
                            <span className="text-xs text-amber-400">
                              {record.late_minutes} min tarde
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium shrink-0 ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  {record.notes && (
                    <p className="text-xs text-zinc-500 mt-2 pl-[52px]">{record.notes}</p>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  bg,
  isText = false,
}: {
  label: string;
  value: number | string;
  color: string;
  bg: string;
  isText?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 border border-zinc-800 ${bg}`}>
      <p className={`${isText ? 'text-sm' : 'text-lg'} font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">{label}</p>
    </div>
  );
}
