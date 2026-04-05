'use client';

/**
 * HR Attendance Management Page
 *
 * Date-filtered attendance listing with employee selector,
 * clock-in modal, and monthly summary metrics.
 */

import { useState, useEffect, useCallback } from 'react';
import { Clock, UserCheck, AlertTriangle, Calendar, X, Check, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState, Breadcrumbs } from '@/src/components/ui';

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

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'critical' | 'info'; label: string }> = {
  PRESENT: { variant: 'success', label: 'Presente' },
  ABSENT: { variant: 'critical', label: 'Ausente' },
  LATE: { variant: 'warning', label: 'Tardanza' },
  JUSTIFIED: { variant: 'info', label: 'Justificado' },
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
    <div className="p-4 space-y-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: 'Recursos Humanos', href: '/admin/hr' }, { label: 'Asistencia' }]} />
      </div>
      <PageHeader
        title="Asistencia"
        description="Control de marcaciones y reportes"
        actions={
          <Button
            variant="primary"
            icon={<LogIn className="w-4 h-4" />}
            onClick={() => setShowClockInModal(true)}
          >
            Marcar Entrada
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Calendar className="w-4 h-4 text-park-gray-500" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2.5 bg-park-gray-900 border border-park-gray-800 rounded-lg text-sm focus:outline-none focus:border-park-gray-700 min-h-[44px]"
          />
        </div>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="px-3 py-2.5 bg-park-gray-900 border border-park-gray-800 rounded-lg text-sm focus:outline-none focus:border-park-gray-700 min-h-[44px] min-w-[250px]"
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
          <MetricCard
            label="Presentes"
            value={totalPresent}
            icon={<UserCheck className="w-5 h-5 text-green-400" />}
          />
          <MetricCard
            label="Tardanzas"
            value={totalLate}
            icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />}
          />
          <MetricCard
            label="Ausencias"
            value={totalAbsent}
            icon={<X className="w-5 h-5 text-red-400" />}
          />
          <MetricCard
            label="Horas Trabajadas"
            value={formatMinutes(totalWorkedMinutes)}
            icon={<Clock className="w-5 h-5 text-blue-400" />}
          />
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Attendance Table */}
      <Card padding="none">
        {!selectedEmployee ? (
          <EmptyState
            icon={<Clock />}
            title="Seleccione un empleado"
            description="Seleccione un empleado para ver su asistencia"
          />
        ) : loading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={<Calendar />}
            title="Sin registros"
            description="No hay registros de asistencia para este periodo"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Entrada</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Salida</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Horas Trabajadas</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Horas Extra</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Tardanza</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const badge = STATUS_BADGE[record.status] || { variant: 'neutral' as const, label: record.status };
                  return (
                    <tr key={record.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-white">
                        {new Date(record.date).toLocaleDateString('es-PE', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-park-gray-300">{formatTime(record.clock_in)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-park-gray-300">{formatTime(record.clock_out)}</td>
                      <td className="px-4 py-3 text-sm text-park-gray-300">{formatMinutes(record.worked_minutes || 0)}</td>
                      <td className="px-4 py-3 text-sm">
                        {record.overtime_minutes > 0 ? (
                          <span className="text-amber-400">{formatMinutes(record.overtime_minutes)}</span>
                        ) : (
                          <span className="text-park-gray-600">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {record.late_minutes > 0 ? (
                          <span className="text-red-400">{record.late_minutes} min</span>
                        ) : (
                          <span className="text-park-gray-600">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant} dot>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {record.clock_in && !record.clock_out && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleClockOut(record.id)}
                          >
                            Marcar Salida
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Clock-in Modal */}
      {showClockInModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-park-gray-900 rounded-xl border border-park-gray-800 p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Registrar Entrada</h2>
              <button
                onClick={() => setShowClockInModal(false)}
                className="p-2 rounded-lg hover:bg-park-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-park-gray-400 mb-2">Empleado</label>
                <select
                  value={clockInEmployeeId}
                  onChange={(e) => setClockInEmployeeId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm focus:outline-none focus:border-park-gray-600"
                >
                  <option value="">Seleccionar empleado...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center text-park-gray-400 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p>
                  Hora actual:{' '}
                  <span className="font-mono font-bold text-white">
                    {new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowClockInModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleClockIn}
                  disabled={clockingIn || !clockInEmployeeId}
                  loading={clockingIn}
                  icon={!clockingIn ? <Check className="w-4 h-4" /> : undefined}
                >
                  {clockingIn ? 'Registrando...' : 'Registrar Entrada'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
