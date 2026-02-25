'use client';

/**
 * Create Employee Page
 * Form to create new employee with name, role, PIN, and active status
 * 
 * Requirements: 1.1, 1.2, 1.5, 1.7, 6.1, 6.2, 6.3, 6.4, 6.5
 * UX Improvements: Toast notifications (P0)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Shield, Lock, CreditCard } from 'lucide-react';

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

export default function NewEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    role: 'WAITER',
    pin: '',
    is_active: true,
    dni: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear empleado');
      }

      toast.success('Empleado creado exitosamente', {
        description: `${form.name} ha sido agregado al sistema`,
      });
      router.push('/admin/empleados');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      setError(errorMessage);
      toast.error('Error al crear empleado', {
        description: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Nuevo Empleado</h1>
          <p className="text-zinc-400 mt-1">Crear nuevo usuario del sistema</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* DNI */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <CreditCard className="w-4 h-4 inline mr-1" />
              DNI
              <span className="text-zinc-500 font-normal ml-1">(para login)</span>
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
              pattern="\d{8}"
            />
            <p className="text-xs text-zinc-500 mt-1">
              8 dígitos. El empleado lo usará junto a su PIN para ingresar.
            </p>
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

          {/* PIN */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              PIN de acceso *
            </label>
            <input
              type="text"
              value={form.pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 6) {
                  setForm({ ...form, pin: value });
                }
              }}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors font-mono text-lg tracking-widest"
              placeholder="••••"
              required
              pattern="\d{4,6}"
              maxLength={6}
            />
            <p className="text-xs text-zinc-500 mt-1">
              4-6 dígitos numéricos. Debe ser único en el sistema.
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
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creando...' : 'Crear Empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
