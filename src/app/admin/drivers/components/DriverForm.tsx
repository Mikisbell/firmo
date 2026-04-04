'use client';

/**
 * Formulario para crear/editar motorizado
 */

import { useState, useEffect } from 'react';
import useSWR from 'swr';

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  employee_id?: string | null;
}

interface EmployeeOption {
  id: string;
  name: string;
  role: string;
}

interface Props {
  driver: Driver | null;
  onSave: (data: { name: string; phone?: string; employeeId?: string }) => void;
  onCancel: () => void;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

export function DriverForm({ driver, onSave, onCancel }: Props) {
  const [name, setName] = useState(driver?.name || '');
  const [phone, setPhone] = useState(driver?.phone || '');
  const [employeeId, setEmployeeId] = useState(driver?.employee_id || '');
  const [saving, setSaving] = useState(false);

  const { data: employeesData } = useSWR<{ items: EmployeeOption[] }>(
    '/api/admin/employees?pageSize=200&role=DRIVER',
    fetcher,
  );

  // Also fetch all active employees as fallback (DRIVER role might not filter server-side)
  const { data: allEmployeesData } = useSWR<{ items: EmployeeOption[] }>(
    '/api/admin/employees?pageSize=200',
    fetcher,
  );

  const employees = (employeesData?.items ?? allEmployeesData?.items ?? []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('El nombre es requerido');
      return;
    }
    setSaving(true);
    await onSave({
      name: name.trim(),
      phone: phone.trim() || undefined,
      employeeId: employeeId || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-park-gray-900 border border-park-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4 text-white">
          {driver ? 'Editar Motorizado' : 'Nuevo Motorizado'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-park-gray-400 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white focus:border-amber-500 outline-none"
              placeholder="Nombre del motorizado"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-park-gray-400 mb-1">
              Telefono
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white focus:border-amber-500 outline-none"
              placeholder="987654321"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-park-gray-400 mb-1">
              Vincular a empleado
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white focus:border-amber-500 outline-none"
            >
              <option value="">-- Sin vincular --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>
            <p className="text-xs text-park-gray-500 mt-1">
              Opcional. Vincula este motorizado a un empleado existente.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 border border-park-gray-700 rounded-lg text-park-gray-300 hover:bg-park-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
