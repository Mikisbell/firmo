'use client';

/**
 * Formulario para crear/editar motorizado
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Modal, Input, Select, Button } from '@/src/components/ui';

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

  const employeeOptions = [
    { value: '', label: '-- Sin vincular --' },
    ...employees.map((emp) => ({
      value: emp.id,
      label: `${emp.name} (${emp.role})`,
    })),
  ];

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={driver ? 'Editar Motorizado' : 'Nuevo Motorizado'}
      size="sm"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" form="driver-form" loading={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="driver-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre *"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del motorizado"
          required
        />

        <Input
          label="Telefono"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="987654321"
        />

        <Select
          label="Vincular a empleado"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          options={employeeOptions}
          hint="Opcional. Vincula este motorizado a un empleado existente."
        />
      </form>
    </Modal>
  );
}
