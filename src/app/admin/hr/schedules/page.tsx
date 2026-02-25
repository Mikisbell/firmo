'use client';

/**
 * HR Schedule Management Page
 *
 * List schedule templates, create new ones, and assign to employees.
 * Includes a weekly calendar view.
 */

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Clock, X, Check, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminData } from '@/src/hooks/useAdminData';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduleTemplate {
  id: string;
  name: string;
  schedule_type: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  break_minutes: number;
  is_active: boolean;
  location_id: string;
  created_at: string;
}

interface EmployeeOption {
  id: string;
  name: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = ['', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const DAY_FULL_NAMES = ['', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  FIXED: 'Fijo',
  ROTATING: 'Rotativo',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SchedulesPage() {
  const { data: templates, loading, error, refetch } = useAdminData<ScheduleTemplate>('/api/hr/schedules?pageSize=100');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('FIXED');
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('17:00');
  const [formBreakMinutes, setFormBreakMinutes] = useState(60);
  const [formLocationId, setFormLocationId] = useState('default');

  // Assign modal state
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Fetch employees for assignment
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch('/api/hr/employees?pageSize=1000');
        if (!res.ok) return;
        const data = await res.json();
        const list = data?.items || data?.data || data || [];
        setEmployees(Array.isArray(list) ? list.filter((e: EmployeeOption & { is_active?: boolean }) => e.is_active !== false) : []);
      } catch {
        // Silently fail
      }
    }
    loadEmployees();
  }, []);

  const toggleDay = (day: number) => {
    setFormDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Ingrese un nombre para el horario');
      return;
    }
    if (formDays.length === 0) {
      toast.error('Seleccione al menos un dia');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/hr/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          schedule_type: formType,
          days_of_week: formDays,
          start_time: formStartTime,
          end_time: formEndTime,
          break_minutes: formBreakMinutes,
          location_id: formLocationId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al crear horario');
      }

      toast.success('Horario creado exitosamente');
      setShowCreateModal(false);
      resetForm();
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear horario');
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTemplate || !assignEmployeeId) {
      toast.error('Seleccione un empleado');
      return;
    }

    try {
      setAssigning(true);
      const res = await fetch(`/api/hr/schedules/${selectedTemplate.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: assignEmployeeId,
          effective_from: new Date().toISOString().split('T')[0],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al asignar horario');
      }

      toast.success('Horario asignado exitosamente');
      setShowAssignModal(false);
      setAssignEmployeeId('');
      setSelectedTemplate(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar horario');
    } finally {
      setAssigning(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormType('FIXED');
    setFormDays([1, 2, 3, 4, 5]);
    setFormStartTime('08:00');
    setFormEndTime('17:00');
    setFormBreakMinutes(60);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Horarios</h1>
          <p className="text-zinc-400 mt-1">Plantillas de horarios y asignaciones</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Crear Horario
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Schedule Templates Grid */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin mx-auto mb-3" />
          <p>Cargando...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay plantillas de horario creadas</p>
          <p className="text-xs text-zinc-600 mt-1">Cree una plantilla para empezar a asignar horarios</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  <span className="text-xs text-zinc-500">
                    {SCHEDULE_TYPE_LABELS[template.schedule_type] || template.schedule_type}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    template.is_active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-zinc-500/20 text-zinc-400'
                  }`}
                >
                  {template.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {/* Time display */}
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span className="text-sm font-mono">
                  {template.start_time} - {template.end_time}
                </span>
                {template.break_minutes > 0 && (
                  <span className="text-xs text-zinc-500">({template.break_minutes} min break)</span>
                )}
              </div>

              {/* Days of week */}
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <span
                    key={day}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                      template.days_of_week.includes(day)
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-800 text-zinc-600'
                    }`}
                  >
                    {DAY_NAMES[day]}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <button
                onClick={() => {
                  setSelectedTemplate(template);
                  setShowAssignModal(true);
                }}
                className="w-full px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                Asignar a Empleado
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Crear Plantilla de Horario</h2>
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Turno Manana"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Tipo</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-600"
                >
                  <option value="FIXED">Fijo</option>
                  <option value="ROTATING">Rotativo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Dias de la Semana</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
                        formDays.includes(day)
                          ? 'bg-blue-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {DAY_NAMES[day]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-600"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Hora Fin</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Minutos de Descanso</label>
                <input
                  type="number"
                  value={formBreakMinutes}
                  onChange={(e) => setFormBreakMinutes(parseInt(e.target.value) || 0)}
                  min={0}
                  max={120}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Crear Horario
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Assign Schedule Modal */}
      {showAssignModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Asignar Horario</h2>
              <button
                onClick={() => { setShowAssignModal(false); setSelectedTemplate(null); setAssignEmployeeId(''); }}
                className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="font-medium">{selectedTemplate.name}</p>
                <p className="text-xs text-zinc-400">
                  {selectedTemplate.start_time} - {selectedTemplate.end_time} |{' '}
                  {selectedTemplate.days_of_week.map((d) => DAY_NAMES[d]).join(', ')}
                </p>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Empleado</label>
                <select
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-600"
                >
                  <option value="">Seleccionar empleado...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowAssignModal(false); setSelectedTemplate(null); setAssignEmployeeId(''); }}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAssign}
                  disabled={assigning || !assignEmployeeId}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {assigning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Asignando...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      Asignar
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
