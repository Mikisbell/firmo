'use client';

/**
 * HR Employee Create Page
 * Form to create a new HR employee with full profile and payroll data.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { EMPLOYEE_ROLES } from '@/src/core/constants/roles';
import { Button, Card, CardFooter, PageHeader, Input, Select, Breadcrumbs, FileUpload } from '@/src/components/ui';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario', ADMIN: 'Administrador', MANAGER: 'Gerente',
  SUPERVISOR: 'Supervisor(a)', CASHIER: 'Cajero(a)', WAITER: 'Mesero(a)',
  KITCHEN: 'Cocina', COOK: 'Cocinero(a)', PACKER: 'Empaquetador(a)',
  BAR: 'Barman', DRIVER: 'Motorizado(a)',
};

const CONTRACT_TYPES = [
  { value: 'INDEFINIDO', label: 'Indefinido' },
  { value: 'PLAZO_FIJO', label: 'Plazo Fijo' },
  { value: 'PART_TIME', label: 'Part Time' },
];

const SCHEDULE_TYPES = [
  { value: 'FULL_TIME', label: 'Tiempo Completo' },
  { value: 'PART_TIME', label: 'Medio Tiempo' },
  { value: 'ROTATING', label: 'Rotativo' },
];

const PENSION_SYSTEMS = [
  { value: '', label: '— Sin sistema —' },
  { value: 'ONP', label: 'ONP' },
  { value: 'AFP_INTEGRA', label: 'AFP Integra' },
  { value: 'AFP_PRIMA', label: 'AFP Prima' },
  { value: 'AFP_PROFUTURO', label: 'AFP Profuturo' },
  { value: 'AFP_HABITAT', label: 'AFP Habitat' },
];

const EMPTY_FORM = {
  name: '',
  role: 'WAITER',
  dni: '',
  email: '',
  phone: '',
  position: '',
  hire_date: new Date().toISOString().slice(0, 10),
  base_salary_cents_display: '',
  contract_type: 'INDEFINIDO',
  work_schedule_type: 'FULL_TIME',
  pension_system: '',
};

const ROLE_OPTIONS = EMPLOYEE_ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] ?? r }));

export default function NewHREmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const handlePhotoUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const soles = parseFloat(form.base_salary_cents_display);
    if (!form.name.trim() || !form.position.trim() || !form.hire_date || isNaN(soles)) {
      toast.error('Nombre, puesto, fecha de ingreso y salario son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        role: form.role,
        position: form.position.trim(),
        hire_date: form.hire_date,
        base_salary_cents: Math.round(soles * 100),
        contract_type: form.contract_type,
        work_schedule_type: form.work_schedule_type,
      };
      if (form.dni.trim()) body.dni = form.dni.trim();
      if (form.email.trim()) body.email = form.email.trim();
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.pension_system) body.pension_system = form.pension_system;

      const res = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al crear empleado');
      }
      toast.success('Empleado creado exitosamente');
      router.push('/admin/hr/employees');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear empleado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: 'Empleados HR', href: '/admin/hr/employees' },
            { label: 'Nuevo' },
          ]}
        />
      </div>
      <PageHeader
        title="Nuevo Empleado HR"
        description="Crear ficha de empleado con datos de planilla"
      />

      <form onSubmit={handleSubmit}><Card className="space-y-5 max-w-2xl">
        {/* Profile photo (opcional) */}
        <FileUpload
          label="Foto de perfil (opcional)"
          accept="image/*"
          maxSize={5 * 1024 * 1024}
          preview={photoPreview}
          onUpload={handlePhotoUpload}
        />

        {/* Name + Role */}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre completo *" type="text" value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="Ej. Juan Pérez" required />
          <Select label="Rol *" value={form.role}
            onChange={e => set('role', e.target.value)} options={ROLE_OPTIONS} />
        </div>

        {/* Position + Hire date */}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Puesto *" type="text" value={form.position}
            onChange={e => set('position', e.target.value)} placeholder="Ej. Cajero Principal" required />
          <Input label="Fecha de ingreso *" type="date" value={form.hire_date}
            onChange={e => set('hire_date', e.target.value)} required />
        </div>

        {/* Salary + Contract */}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Salario base (S/) *" type="number" min={0} step={0.01}
            value={form.base_salary_cents_display}
            onChange={e => set('base_salary_cents_display', e.target.value)}
            placeholder="1200.00" required />
          <Select label="Tipo de contrato *" value={form.contract_type}
            onChange={e => set('contract_type', e.target.value)} options={CONTRACT_TYPES} />
        </div>

        {/* Schedule + Pension */}
        <div className="grid grid-cols-2 gap-4">
          <Select label="Horario *" value={form.work_schedule_type}
            onChange={e => set('work_schedule_type', e.target.value)} options={SCHEDULE_TYPES} />
          <Select label="Sistema de pensión" value={form.pension_system}
            onChange={e => set('pension_system', e.target.value)} options={PENSION_SYSTEMS} />
        </div>

        {/* DNI + Email + Phone */}
        <div className="grid grid-cols-3 gap-4">
          <Input label="DNI" type="text" inputMode="numeric" value={form.dni}
            onChange={e => set('dni', e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="12345678" maxLength={8} />
          <Input label="Email" type="email" value={form.email}
            onChange={e => set('email', e.target.value)} placeholder="correo@empresa.com" />
          <Input label="Teléfono" type="tel" value={form.phone}
            onChange={e => set('phone', e.target.value)} placeholder="987654321" />
        </div>

        <CardFooter>
          <Button type="button" variant="secondary" onClick={() => router.back()} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving} className="flex-1">
            {saving ? 'Creando...' : 'Crear Empleado'}
          </Button>
        </CardFooter>
      </Card></form>
    </div>
  );
}
