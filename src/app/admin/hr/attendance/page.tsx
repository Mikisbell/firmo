'use client';

/**
 * HR Attendance Management Page
 *
 * Date-filtered attendance listing with employee selector,
 * clock-in modal, and monthly summary metrics.
 */

import { useState, useEffect, useCallback } from 'react';
import { Clock, UserCheck, AlertTriangle, Calendar, Plus, X, Check, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  worked_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
  status: string;
  notes: string | null;
  employee?: { id: string; name: string };
}

interface EmployeeOption {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-500/20 text-green-400',
  ABSENT: 'bg-red-500/20 text-red-400',
  LATE: 'bg-yellow-500/20 text-yellow-400',
  JUSTIFIED: 'bg-blue-500/20 text-blue-400',
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  LATE: 'Tardanza',
  JUSTIFIED: 'Justificado',
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AttendancePage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockInEmployeeId, setClockInEmployeeId] = useState('');

  // Fetch employees for selector
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch('/api/hr/employees?pageSize=1000');
        if (!res.ok) return;
        const data = await res.json();
        const list = data?.items || data?.data || data || [];
        setEmployees(Array.isArray(list) ? list.filter((e: EmployeeOption) => e.is_active) : []);
      } catch {
        // Silently fail
      }
    }
    loadEmployees();
  }, []);

  // Fetch attendance records when employee or month changes
  const fetchAttendance = useCallback(async () => {
    if (!selectedEmployee) {
      setRecords([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

      const url = `/api/hr/attendance?employee_id=${selectedEmployee}&start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al cargar asistencias');
      }

      const data = await res.json();
      const list = data?.items || data?.data || data || [];
      setRecords(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, selectedMonth]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Clock In handler
  const handleClockIn = async () => {
    if (!clockInEmployeeId) {
      toast.error('Seleccione un empleado');
      return;
    }

    try {
      setClockingIn(true);
      const res = await fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: clockInEmployeeId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al registrar entrada');
      }

      toast.success('Entrada registrada exitosamente');
      setShowClockInModal(false);
      setClockInEmployeeId('');
      fetchAttendance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar entrada');
    } finally {
      setClockingIn(false);
    }
  };

  // Clock Out handler
  const handleClockOut = async (recordId: string) => {
    if (!confirm('¿Registrar salida para este empleado?')) return;

    try {
      const res = await fetch(`/api/hr/attendance/${recordId}/clock-out`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al registrar salida');
      }

      toast.success('Salida registrada');
      fetchAttendance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar salida');
    }
  };

  // Summary metrics
  const totalPresent = records.filter((r) => r.status === 'PRESENT').length;
  const totalLate = records.filter((r) => r.status === 'LATE').length;
  const totalAbsent = records.filter((r) => r.status === 'ABSENT').length;
  const totalWorkedMinutes = records.reduce((sum, r) => sum + (r.worked_minutes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Asistencia</h1>
          <p className="text-zinc-400 mt-1">Control de marcaciones y reportes</p>
        </div>
        <button
          onClick={() => setShowClockInModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors min-h-[44px]"
        >
          <LogIn className="w-4 h-4" />
          Marcar Entrada
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Calendar className="w-4 h-4 text-zinc-500" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-zinc-700 min-h-[44px]"
          />
        </div>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-zinc-700 min-h-[44px] min-w-[250px]"
        >
          <option value="">Seleccionar empleado...</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name} ({emp.role})
            </option>
          ))}
        </select>
      </div>

      {/* Summary metrics */}
      {selectedEmployee && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-green-400" />
              <span className="text-xs text-zinc-500">Presentes</span>
            </div>
            <p className="text-xl font-bold">{totalPresent}</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-zinc-500">Tardanzas</span>
            </div>
            <p className="text-xl font-bold">{totalLate}</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <X className="w-4 h-4 text-red-400" />
              <span className="text-xs text-zinc-500">Ausencias</span>
            </div>
            <p className="text-xl font-bold">{totalAbsent}</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-zinc-500">Horas Trabajadas</span>
            </div>
            <p className="text-xl font-bold">{formatMinutes(totalWorkedMinutes)}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Attendance Table */}
      {!selectedEmployee ? (
        <div className="text-center py-12 text-zinc-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Seleccione un empleado para ver su asistencia</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-zinc-500">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin mx-auto mb-3" />
          <p>Cargando...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay registros de asistencia para este periodo</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Entrada</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Salida</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Horas Trabajadas</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Horas Extra</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Tardanza</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {records.map((record) => (
                <tr key={record.id} className="bg-zinc-950 hover:bg-zinc-900 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {new Date(record.date).toLocaleDateString('es-PE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">{formatTime(record.clock_in)}</td>
                  <td className="px-4 py-3 text-sm font-mono">{formatTime(record.clock_out)}</td>
                  <td className="px-4 py-3 text-sm">{formatMinutes(record.worked_minutes || 0)}</td>
                  <td className="px-4 py-3 text-sm">
                    {record.overtime_minutes > 0 ? (
                      <span className="text-amber-400">{formatMinutes(record.overtime_minutes)}</span>
                    ) : (
                      <span className="text-zinc-600">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {record.late_minutes > 0 ? (
                      <span className="text-red-400">{record.late_minutes} min</span>
                    ) : (
                      <span className="text-zinc-600">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        STATUS_COLORS[record.status] || 'bg-zinc-500/20 text-zinc-400'
                      }`}
                    >
                      {STATUS_LABELS[record.status] || record.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {record.clock_in && !record.clock_out && (
                      <button
                        onClick={() => handleClockOut(record.id)}
                        className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        Marcar Salida
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Clock-in Modal */}
      {showClockInModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Registrar Entrada</h2>
              <button
                onClick={() => setShowClockInModal(false)}
                className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Empleado</label>
                <select
                  value={clockInEmployeeId}
                  onChange={(e) => setClockInEmployeeId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-600"
                >
                  <option value="">Seleccionar empleado...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center text-zinc-400 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p>
                  Hora actual:{' '}
                  <span className="font-mono font-bold text-white">
                    {new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowClockInModal(false)}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClockIn}
                  disabled={clockingIn || !clockInEmployeeId}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clockingIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Registrar Entrada
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
