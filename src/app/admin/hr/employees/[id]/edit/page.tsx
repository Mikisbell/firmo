'use client';

/**
 * HR Employee Edit Page
 * Pre-populated form to update an existing HR employee's profile and payroll data.
 */

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { EMPLOYEE_ROLES } from '@/src/core/constants/roles';

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

interface HREmployee {
  id: string;
  name: string;
  role: string;
  dni: string | null;
  email: string | null;
  phone: string | null;
  position: string;
  base_salary_cents: number;
  contract_type: string;
  work_schedule_type: string;
  pension_system: string | null;
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar empleado');
  return r.json();
});

const inputCls = 'w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500';
const labelCls = 'block text-zinc-400 text-xs mb-1';

export default function EditHREmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: employee, error, isLoading } = useSWR<HREmployee>(
    `/api/hr/employees/${id}`,
    fetcher
  );

  const [form, setForm] = useState({
    name: '',
    role: 'WAITER',
    dni: '',
    email: '',
    phone: '',
    position: '',
    base_salary_cents_display: '',
    contract_type: 'INDEFINIDO',
    work_schedule_type: 'FULL_TIME',
    pension_system: '',
  });
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (employee && !initialized) {
      setForm({
        name: employee.name,
        role: employee.role,
        dni: employee.dni ?? '',
        email: employee.email ?? '',
        phone: employee.phone ?? '',
        position: employee.position,
        base_salary_cents_display: (employee.base_salary_cents / 100).toFixed(2),
        contract_type: employee.contract_type,
        work_schedule_type: employee.work_schedule_type,
        pension_system: employee.pension_system ?? '',
      });
      setInitialized(true);
    }
  }, [employee, initialized]);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const soles = parseFloat(form.base_salary_cents_display);
    if (!form.name.trim() || !form.position.trim() || isNaN(soles)) {
      toast.error('Nombre, puesto y salario son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        role: form.role,
        position: form.position.trim(),
        base_salary_cents: Math.round(soles * 100),
        contract_type: form.contract_type,
        work_schedule_type: form.work_schedule_type,
        dni: form.dni.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        pension_system: form.pension_system || null,
      };

      const res = await fetch(`/api/hr/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al actualizar empleado');
      }
      toast.success('Empleado actualizado');
      router.push(`/admin/hr/employees/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar empleado');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-zinc-400 text-center">Cargando...</div>;
  }

  if (error || !employee) {
    return (
      <div className="p-6 text-red-400 flex items-center gap-2 justify-center">
        <AlertTriangle className="w-5 h-5" /> Error al cargar empleado
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Editar Empleado</h1>
          <p className="text-zinc-400 text-sm">{employee.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nombre completo *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Rol *</label>
            <select value={form.role} onChange={e => set('role', e.target.value)} className={inputCls}>
              {EMPLOYEE_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Puesto *</label>
            <input type="text" value={form.position} onChange={e => set('position', e.target.value)}
              className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Salario base (S/) *</label>
            <input type="number" min={0} step={0.01} value={form.base_salary_cents_display}
              onChange={e => set('base_salary_cents_display', e.target.value)}
              className={inputCls} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tipo de contrato *</label>
            <select value={form.contract_type} onChange={e => set('contract_type', e.target.value)} className={inputCls}>
              {CONTRACT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Horario *</label>
            <select value={form.work_schedule_type} onChange={e => set('work_schedule_type', e.target.value)} className={inputCls}>
              {SCHEDULE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Sistema de pensión</label>
            <select value={form.pension_system} onChange={e => set('pension_system', e.target.value)} className={inputCls}>
              {PENSION_SYSTEMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>DNI</label>
            <input type="text" inputMode="numeric" value={form.dni}
              onChange={e => set('dni', e.target.value.replace(/\D/g, '').slice(0, 8))}
              className={inputCls} maxLength={8} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
              className={inputCls} />
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-zinc-800">
          <button type="button" onClick={() => router.back()}
            className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
