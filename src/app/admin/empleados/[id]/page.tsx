'use client';

/**
 * Employee Detail Page — Comprehensive HR Profile
 * Tabs: Perfil | Adelantos | Permisos | Evaluaciones | Capacitación
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Shield, Trash2, CheckCircle2, KeyRound, CreditCard,
  User, DollarSign, Calendar, Star, BookOpen, Check, X, Clock,
  AlertCircle, Plus,
} from 'lucide-react';
import { useSWRConfig } from 'swr';
import { useEmployee } from '@/src/hooks/useSWRHooks';
import useSWR from 'swr';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'OWNER',      label: 'Propietario' },
  { value: 'ADMIN',      label: 'Administrador' },
  { value: 'MANAGER',    label: 'Gerente' },
  { value: 'SUPERVISOR', label: 'Supervisor(a)' },
  { value: 'CASHIER',    label: 'Cajero(a)' },
  { value: 'WAITER',     label: 'Mesero(a)' },
  { value: 'KITCHEN',    label: 'Cocina' },
  { value: 'COOK',       label: 'Cocinero(a)' },
  { value: 'PACKER',     label: 'Empaquetador(a)' },
  { value: 'BAR',        label: 'Barman' },
  { value: 'DRIVER',     label: 'Motorizado(a)' },
];

const TABS = [
  { key: 'perfil',       label: 'Perfil',        icon: User },
  { key: 'adelantos',    label: 'Adelantos',      icon: DollarSign },
  { key: 'permisos',     label: 'Permisos',       icon: Calendar },
  { key: 'evaluaciones', label: 'Evaluaciones',   icon: Star },
  { key: 'capacitacion', label: 'Capacitación',   icon: BookOpen },
] as const;

type TabKey = typeof TABS[number]['key'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  dni?: string | null;
}

interface Advance {
  id: string;
  amount_cents: number;
  reason: string;
  status: string;
  created_at: string;
  requested_by?: string;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string;
  created_at: string;
}

interface Evaluation {
  id: string;
  period_start: string;
  period_end: string;
  scores: Record<string, number>;
  comments?: string;
  status: string;
  created_at: string;
}

interface Training {
  id: string;
  training_type: string;
  title: string;
  status: string;
  completed_at?: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' })
    .then((r) => r.json())
    .then((d) => d.data ?? d.items ?? d);

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING:   'bg-amber-500/20 text-amber-400',
    APPROVED:  'bg-green-500/20 text-green-400',
    REJECTED:  'bg-red-500/20 text-red-400',
    PAID:      'bg-blue-500/20 text-blue-400',
    CANCELLED: 'bg-zinc-500/20 text-zinc-400',
    DRAFT:     'bg-zinc-500/20 text-zinc-400',
    COMPLETED: 'bg-green-500/20 text-green-400',
    IN_PROGRESS:'bg-blue-500/20 text-blue-400',
  };
  const labels: Record<string, string> = {
    PENDING: 'Pendiente', APPROVED: 'Aprobado', REJECTED: 'Rechazado',
    PAID: 'Pagado', CANCELLED: 'Cancelado', DRAFT: 'Borrador',
    COMPLETED: 'Completado', IN_PROGRESS: 'En curso',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-zinc-500/20 text-zinc-400'}`}>
      {labels[status] ?? status}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-zinc-500">
      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Tab: Adelantos ───────────────────────────────────────────────────────────

function AdelantosTab({ employeeId }: { employeeId: string }) {
  const { data, mutate } = useSWR<Advance[]>(
    `/api/hr/advances/employee/${employeeId}`,
    fetcher,
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employee_id: employeeId,
          amount_cents: Math.round(parseFloat(form.amount) * 100),
          reason: form.reason,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al crear adelanto');
      }
      toast.success('Adelanto registrado');
      setForm({ amount: '', reason: '' });
      setShowForm(false);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/hr/advances/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al procesar');
      toast.success(action === 'approve' ? 'Adelanto aprobado' : 'Adelanto rechazado');
      mutate();
    } catch {
      toast.error('Error al procesar el adelanto');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">Adelantos de sueldo</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo adelanto
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Monto (S/)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:border-amber-500 outline-none"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Motivo</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:border-amber-500 outline-none"
                  placeholder="Motivo del adelanto"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg text-sm disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!data || data.length === 0 ? (
        <EmptyState message="Sin adelantos registrados" />
      ) : (
        <div className="space-y-2">
          {data.map((advance) => (
            <div key={advance.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
              <div>
                <p className="text-sm font-medium">{formatMoney(advance.amount_cents)}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{advance.reason}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{formatDate(advance.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={advance.status} />
                {advance.status === 'PENDING' && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAction(advance.id, 'approve')}
                      className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors"
                      title="Aprobar"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAction(advance.id, 'reject')}
                      className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                      title="Rechazar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Permisos ────────────────────────────────────────────────────────────

function PermisosTab({ employeeId }: { employeeId: string }) {
  const { data, mutate } = useSWR<LeaveRequest[]>(
    `/api/hr/leave-requests/employee/${employeeId}`,
    fetcher,
  );

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/hr/leave-requests/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al procesar');
      toast.success(action === 'approve' ? 'Permiso aprobado' : 'Permiso rechazado');
      mutate();
    } catch {
      toast.error('Error al procesar el permiso');
    }
  };

  const leaveTypeLabel: Record<string, string> = {
    VACATION: 'Vacaciones', SICK: 'Enfermedad', PERSONAL: 'Personal',
    MATERNITY: 'Maternidad', PATERNITY: 'Paternidad', OTHER: 'Otro',
  };

  if (!data || data.length === 0) {
    return <EmptyState message="Sin permisos o vacaciones registrados" />;
  }

  return (
    <div className="space-y-2">
      {data.map((req) => (
        <div key={req.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
          <div>
            <p className="text-sm font-medium">{leaveTypeLabel[req.leave_type] ?? req.leave_type}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {formatDate(req.start_date)} — {formatDate(req.end_date)}
            </p>
            {req.reason && <p className="text-xs text-zinc-600 mt-0.5">{req.reason}</p>}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={req.status} />
            {req.status === 'PENDING' && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleAction(req.id, 'approve')}
                  className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors"
                  title="Aprobar"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleAction(req.id, 'reject')}
                  className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                  title="Rechazar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Evaluaciones ────────────────────────────────────────────────────────

function EvaluacionesTab({ employeeId }: { employeeId: string }) {
  const { data } = useSWR<Evaluation[]>(
    `/api/hr/evaluations/employee/${employeeId}`,
    fetcher,
  );

  if (!data || data.length === 0) {
    return <EmptyState message="Sin evaluaciones registradas" />;
  }

  return (
    <div className="space-y-3">
      {data.map((ev) => {
        const scores = Object.entries(ev.scores ?? {});
        const avg = scores.length > 0
          ? scores.reduce((s, [, v]) => s + v, 0) / scores.length
          : 0;
        return (
          <div key={ev.id} className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium">
                  {formatDate(ev.period_start)} — {formatDate(ev.period_end)}
                </p>
                {ev.comments && (
                  <p className="text-xs text-zinc-500 mt-1">{ev.comments}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-amber-400">{avg.toFixed(1)}</span>
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <StatusBadge status={ev.status} />
              </div>
            </div>
            {scores.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {scores.map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 capitalize">{key.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${(val / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-zinc-300 w-5 text-right">{val}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Capacitación ────────────────────────────────────────────────────────

function CapacitacionTab({ employeeId }: { employeeId: string }) {
  const { data } = useSWR<Training[]>(
    `/api/hr/training/employee/${employeeId}`,
    fetcher,
  );

  if (!data || data.length === 0) {
    return <EmptyState message="Sin capacitaciones registradas" />;
  }

  return (
    <div className="space-y-2">
      {data.map((t) => (
        <div key={t.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
          <div>
            <p className="text-sm font-medium">{t.title}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{t.training_type}</p>
            {t.completed_at && (
              <p className="text-xs text-zinc-600 mt-0.5">
                Completado: {formatDate(t.completed_at)}
              </p>
            )}
          </div>
          <StatusBadge status={t.status} />
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Perfil (edit form) ──────────────────────────────────────────────────

function PerfilTab({
  employee,
  onSaved,
}: {
  employee: Employee;
  onSaved: () => void;
}) {
  const { mutate: globalMutate } = useSWRConfig();
  const [form, setForm] = useState({
    name: employee.name,
    role: employee.role,
    is_active: employee.is_active,
    dni: employee.dni ?? '',
  });
  const [newPin, setNewPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        role: form.role,
        is_active: form.is_active,
        dni: form.dni.trim() || null,
      };
      if (newPin) payload.pin = newPin;

      const res = await fetch(`/api/admin/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al actualizar empleado');
      }

      await globalMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/admin/employees'));
      setSaved(true);
      setNewPin('');
      toast.success('Empleado actualizado exitosamente', {
        description: `Los cambios de ${form.name} han sido guardados${newPin ? ' (PIN actualizado)' : ''}`,
      });
      onSaved();
    } catch (err) {
      toast.error('Error al actualizar', {
        description: err instanceof Error ? err.message : 'Error desconocido',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {saved && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Cambios guardados correctamente
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Nombre completo *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
          placeholder="Ej: Juan Pérez"
          required
          maxLength={100}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          <CreditCard className="w-4 h-4 inline mr-1" />
          DNI <span className="text-zinc-500 font-normal">(para login)</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={form.dni}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 8);
            setForm({ ...form, dni: val });
          }}
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors font-mono tracking-widest"
          placeholder="12345678"
          maxLength={8}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          <Shield className="w-4 h-4 inline mr-1" />
          Rol *
        </label>
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
          required
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          <KeyRound className="w-4 h-4 inline mr-1" />
          Cambiar PIN
        </label>
        <input
          type="password"
          inputMode="numeric"
          value={newPin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setNewPin(val);
          }}
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
          placeholder="Dejar vacío para no cambiar"
          autoComplete="off"
        />
        <p className="text-xs text-zinc-500 mt-1">4-6 dígitos. Solo se actualiza si ingresás un nuevo PIN.</p>
      </div>

      <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg">
        <input
          type="checkbox"
          id="is_active"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
        />
        <label htmlFor="is_active" className="text-sm cursor-pointer">
          Empleado activo (puede iniciar sesión)
        </label>
      </div>

      <button
        type="submit"
        disabled={saving || saved}
        className={`w-full px-4 py-2.5 font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-amber-500 hover:bg-amber-600 text-black disabled:opacity-50'
        }`}
      >
        {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
      </button>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('perfil');

  const { data: employee, error: fetchError, isLoading: loading, mutate } = useEmployee(employeeId);

  useEffect(() => {
    params.then((p) => setEmployeeId(p.id));
  }, [params]);

  const handleDelete = async () => {
    if (!employeeId) return;
    if (!confirm('¿Desactivar este empleado? No podrá iniciar sesión.')) return;

    try {
      const res = await fetch(`/api/admin/employees/${employeeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al desactivar empleado');
      }
      toast.success('Empleado desactivado');
      router.push('/admin/empleados');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Clock className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (fetchError || !employee) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Error</h1>
        </div>
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {fetchError?.message ?? 'Empleado no encontrado'}
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_OPTIONS.find((r) => r.value === employee.role)?.label ?? employee.role;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{employee.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-400">
                <Shield className="w-3 h-3" />
                {roleLabel}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                employee.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'
              }`}>
                {employee.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {employee.is_active ? 'Activo' : 'Inactivo'}
              </span>
              {employee.dni && (
                <span className="text-xs text-zinc-600 font-mono">DNI {employee.dni}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" />
          Desactivar
        </button>
      </div>

      {/* Tabs nav */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        {activeTab === 'perfil' && (
          <PerfilTab
            employee={employee}
            onSaved={() => { mutate(); setTimeout(() => router.push('/admin/empleados'), 1500); }}
          />
        )}
        {activeTab === 'adelantos' && employeeId && (
          <AdelantosTab employeeId={employeeId} />
        )}
        {activeTab === 'permisos' && employeeId && (
          <PermisosTab employeeId={employeeId} />
        )}
        {activeTab === 'evaluaciones' && employeeId && (
          <EvaluacionesTab employeeId={employeeId} />
        )}
        {activeTab === 'capacitacion' && employeeId && (
          <CapacitacionTab employeeId={employeeId} />
        )}
      </div>
    </div>
  );
}
