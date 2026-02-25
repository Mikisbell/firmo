'use client';

/**
 * Edit Employee Page
 * Form to edit employee (name, role, active status, optional PIN change)
 * 
 * Requirements: 1.3, 1.4, 1.7, 6.1, 6.2, 6.3, 6.4, 6.5
 * UX Improvements: Toast notifications (P0)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Shield, Trash2, CheckCircle2, KeyRound } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { useEmployee } from '@/src/hooks/useSWRHooks';

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Dueño' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'CASHIER', label: 'Cajero' },
  { value: 'WAITER', label: 'Mesero' },
  { value: 'KITCHEN', label: 'Cocina' },
  { value: 'BAR', label: 'Bar' },
  { value: 'DRIVER', label: 'Repartidor' },
];

interface Employee {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // Migrado a SWR - deduplicación automática, revalidación inteligente
  const { data: employee, error: fetchError, isLoading: loading, mutate } = useEmployee(employeeId);
  
  const [form, setForm] = useState({
    name: '',
    role: '',
    is_active: true,
  });
  const [newPin, setNewPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setEmployeeId(p.id));
  }, [params]);

  useEffect(() => {
    if (!employee) return;
    
    setForm({
      name: employee.name,
      role: employee.role,
      is_active: employee.is_active,
    });
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;
    
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const payload: Record<string, unknown> = { ...form };
      if (newPin) {
        payload.pin = newPin;
      }

      const res = await fetch(`/api/admin/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar empleado');
      }

      // Revalidar datos: el empleado individual Y la lista
      await mutate();
      await globalMutate('/api/admin/employees');

      // Mostrar feedback visual de éxito en la misma página
      setSaved(true);
      setNewPin('');
      toast.success('Empleado actualizado exitosamente', {
        description: `Los cambios de ${form.name} han sido guardados${newPin ? ' (PIN actualizado)' : ''}`,
      });

      // Redirigir después de que el usuario vea el feedback
      setTimeout(() => {
        router.push('/admin/empleados');
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      setError(errorMessage);
      toast.error('Error al actualizar empleado', {
        description: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!employeeId) return;
    if (!confirm('¿Desactivar este empleado? No podrá iniciar sesión.')) return;

    try {
      const res = await fetch(`/api/admin/employees/${employeeId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al desactivar empleado');
      }

      // Invalidar caché de la lista antes de redirigir
      await globalMutate('/api/admin/employees');

      toast.success('Empleado desactivado', {
        description: 'El empleado ya no podrá iniciar sesión',
      });
      router.push('/admin/empleados');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error('Error al desactivar empleado', {
        description: errorMessage,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Cargando...</div>
      </div>
    );
  }

  if ((fetchError || error) && !employee) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Error</h1>
        </div>
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {fetchError?.message || error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Editar Empleado</h1>
            <p className="text-zinc-400 mt-1">{employee?.name}</p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Desactivar
        </button>
      </div>

      {/* Form */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {saved && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Cambios guardados correctamente. Redirigiendo...
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Nombre completo *
            </label>
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

          {/* Role */}
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
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1">
              Define los permisos y accesos del empleado
            </p>
          </div>

          {/* PIN change */}
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
              minLength={4}
              maxLength={6}
              pattern="\d{4,6}"
              autoComplete="off"
            />
            <p className="text-xs text-zinc-500 mt-1">
              4-6 dígitos numéricos. Solo se actualiza si ingresas un nuevo PIN.
            </p>
          </div>

          {/* Active status */}
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

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || saved}
              className={`flex-1 px-4 py-2.5 font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-black disabled:opacity-50'
              }`}
            >
              {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
