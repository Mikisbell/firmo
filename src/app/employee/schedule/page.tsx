'use client';

/**
 * Employee Schedule Page - My Shifts
 *
 * Weekly calendar view of the employee's assigned shifts.
 * Supports previous/next week navigation.
 * Shows shift start time, end time, and break duration.
 */

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  MapPin,
  Loader2,
  AlertTriangle,
  CalendarOff,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar');
  return r.json();
});

interface ScheduleEntry {
  id: string;
  date: string;
  shift_start: string;
  shift_end: string;
  break_minutes: number;
  status: string;
  location_id?: string;
  employee_id: string;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const DAY_NAMES_FULL = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const startStr = start.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = getWeekStart(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const { data: schedule, error, isLoading } = useSWR<ScheduleEntry[]>(
    '/api/hr/me/schedule',
    fetcher,
    { revalidateOnFocus: false },
  );

  const today = new Date();
  const isCurrentWeek = weekOffset === 0;

  // Build the 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const dateStr = date.toISOString().split('T')[0];
      const entries = Array.isArray(schedule)
        ? schedule.filter((s) => {
            const sDate = new Date(s.date).toISOString().split('T')[0];
            return sDate === dateStr;
          })
        : [];
      return { date, dayIndex: i, entries };
    });
  }, [weekStart, schedule]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Mis Turnos</h2>
        <p className="text-zinc-400 text-sm mt-0.5">Horario semanal asignado</p>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-3 border border-zinc-800">
        <button
          onClick={() => setWeekOffset((prev) => prev - 1)}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">{formatWeekRange(weekStart)}</p>
          {isCurrentWeek && (
            <p className="text-[10px] text-amber-400 font-medium">Esta semana</p>
          )}
        </div>
        <button
          onClick={() => setWeekOffset((prev) => prev + 1)}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Siguiente semana"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

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
          <p className="text-zinc-400 text-sm">No se pudo cargar el horario</p>
          <p className="text-zinc-500 text-xs">Es posible que no tengas un turno asignado</p>
        </div>
      )}

      {/* Schedule Grid */}
      {!isLoading && !error && (
        <div className="space-y-2">
          {weekDays.map(({ date, dayIndex, entries }) => {
            const isToday = isSameDay(date, today);
            const isPast = date < today && !isToday;
            const hasShift = entries.length > 0;

            return (
              <div
                key={dayIndex}
                className={`rounded-xl border transition-colors ${
                  isToday
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-zinc-900 border-zinc-800'
                } ${isPast && !isToday ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Day indicator */}
                  <div className={`w-12 text-center shrink-0 ${isToday ? 'text-amber-400' : ''}`}>
                    <p className="text-[10px] uppercase font-medium text-zinc-500">
                      {DAY_NAMES[dayIndex]}
                    </p>
                    <p className={`text-lg font-bold ${isToday ? 'text-amber-400' : ''}`}>
                      {date.getDate()}
                    </p>
                  </div>

                  {/* Shift info */}
                  {hasShift ? (
                    <div className="flex-1 space-y-1">
                      {entries.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-semibold">
                              {entry.shift_start} - {entry.shift_end}
                            </span>
                          </div>
                          {entry.break_minutes > 0 && (
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <Coffee className="w-3 h-3" />
                              {entry.break_minutes} min
                            </div>
                          )}
                          {entry.status && entry.status !== 'ACTIVE' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                              {entry.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-2 text-zinc-500 text-sm">
                      <CalendarOff className="w-4 h-4" />
                      Descanso
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when schedule is empty array */}
      {!isLoading && !error && Array.isArray(schedule) && schedule.length === 0 && (
        <div className="text-center py-8">
          <CalendarOff className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No hay turnos asignados esta semana</p>
          <p className="text-zinc-500 text-xs mt-1">Consulta con tu supervisor</p>
        </div>
      )}
    </div>
  );
}
