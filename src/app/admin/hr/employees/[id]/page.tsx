'use client';

/**
 * HR Employee Detail Page
 * Shows employee profile and payroll info with edit/back navigation.
 */

import { use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Edit2, Shield, AlertTriangle } from 'lucide-react';

interface HREmployee {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  dni: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  position: string;
  base_salary_cents: number;
  contract_type: string;
  work_schedule_type: string;
  hire_date: string;
  commission_rate: number | null;
  pension_system: string | null;
  has_health_insurance: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario', ADMIN: 'Administrador', MANAGER: 'Gerente',
  SUPERVISOR: 'Supervisor(a)', CASHIER: 'Cajero(a)', WAITER: 'Mesero(a)',
  KITCHEN: 'Cocina', COOK: 'Cocinero(a)', PACKER: 'Empaquetador(a)',
  BAR: 'Barman', DRIVER: 'Motorizado(a)',
};

const CONTRACT_LABELS: Record<string, string> = {
  INDEFINIDO: 'Indefinido', PLAZO_FIJO: 'Plazo Fijo', PART_TIME: 'Part Time',
};

const SCHEDULE_LABELS: Record<string, string> = {
  FULL_TIME: 'Tiempo Completo', PART_TIME: 'Medio Tiempo', ROTATING: 'Rotativo',
};

function formatCurrency(cents: number) {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar empleado');
  return r.json();
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 text-sm w-40 shrink-0">{label}</span>
      <span className="text-white text-sm">{value ?? '—'}</span>
    </div>
  );
}

export default function HREmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: employee, error, isLoading } = useSWR<HREmployee>(
    `/api/hr/employees/${id}`,
    fetcher
  );

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{employee.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {ROLE_LABELS[employee.role] ?? employee.role}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${employee.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                {employee.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/admin/hr/employees/${id}/edit`)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Editar
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-2xl space-y-0">
        <Row label="Puesto" value={employee.position} />
        <Row label="DNI" value={employee.dni} />
        <Row label="Email" value={employee.email} />
        <Row label="Teléfono" value={employee.phone} />
        <Row label="Dirección" value={employee.address} />
        <Row label="Fecha de ingreso" value={employee.hire_date?.slice(0, 10)} />
        <Row label="Salario base" value={formatCurrency(employee.base_salary_cents)} />
        <Row label="Tipo de contrato" value={CONTRACT_LABELS[employee.contract_type] ?? employee.contract_type} />
        <Row label="Horario" value={SCHEDULE_LABELS[employee.work_schedule_type] ?? employee.work_schedule_type} />
        <Row label="Sistema de pensión" value={employee.pension_system} />
        <Row label="Seguro de salud" value={employee.has_health_insurance ? 'Sí' : 'No'} />
        {employee.commission_rate != null && (
          <Row label="Comisión" value={`${(employee.commission_rate * 100).toFixed(1)}%`} />
        )}
      </div>
    </div>
  );
}
