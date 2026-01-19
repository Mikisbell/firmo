'use client';

/**
 * Edit Employee Page
 * Requirements: 1.3, 1.7, 6.1, 6.2, 6.3, 6.4, 6.5
 * Note: PIN cannot be changed (per requirement 1.3)
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { handleApiCall, formatApiError } from '@/src/lib/api-utils';

const VALID_ROLES = [
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

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    name: '',
    role: 'WAITER',
    is_active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        setLoading(true);
        const data = await handleApiCall<Employee>(`/api/admin/employees/${employeeId}`, {
          method: 'GET',
        });
        setEmployee(data);
        setForm({
          name: data.name,
          role: data.role,
          is_active: data.is_active,
        });
      } catch (err) {
        setError(formatApiError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Client-side validation
      if (!form.name.trim()) {
        throw new Error('El nombre es requerido');
      }

      await handleApiCall(`/api/admin/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      router.push('/admin/empleados');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          Empleado no encontrado
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Editar Empleado</h1>
          <p className="text-zinc-400 mt-1">Modificar información del empleado</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Nombre Completo *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none transition-colors"
            placeholder="Ej: Juan Pérez"
            required
            maxLength={100}
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Rol *
          </label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none transition-colors"
            required
          >
            {VALID_ROLES.map(role => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 mt-1">
            El rol determina los permisos del empleado en el sistema
          </p>
        </div>

        {/* PIN Notice */}
        <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
          <p className="text-sm text-zinc-400">
            <strong className="text-zinc-300">Nota:</strong> El PIN no puede ser modificado por seguridad. 
            Si necesitas cambiar el PIN, contacta al administrador del sistema.
          </p>
        </div>

        {/* Active Status */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-sm text-zinc-300">Empleado activo</span>
        </label>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
