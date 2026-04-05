'use client';

/**
 * HR Employee Detail Page
 * Shows employee profile and payroll info with edit/back navigation.
 */

import { use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Edit2, Shield, AlertTriangle } from 'lucide-react';
import { Button, Badge, Card, PageHeader, Breadcrumbs } from '@/src/components/ui';

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
    <div className="flex items-start gap-4 py-3 border-b border-park-gray-800 last:border-0">
      <span className="text-park-gray-500 text-sm w-40 shrink-0">{label}</span>
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
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <Card padding="none">
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-4 space-y-6">
        <div className="mb-4">
          <Breadcrumbs items={[{ label: 'Empleados HR', href: '/admin/hr/employees' }, { label: 'Error' }]} />
        </div>
        <PageHeader title="Error" />
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Error al cargar empleado
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: 'Empleados HR', href: '/admin/hr/employees' },
            { label: employee.name },
          ]}
        />
      </div>
      <PageHeader
        title={employee.name}
        actions={
          <Button
            variant="secondary"
            icon={<Edit2 className="w-4 h-4" />}
            onClick={() => router.push(`/admin/hr/employees/${id}/edit`)}
          >
            Editar
          </Button>
        }
      />
      <div className="flex items-center gap-2 -mt-4 mb-2">
        <Badge variant="warning"><Shield className="w-3 h-3" /> {ROLE_LABELS[employee.role] ?? employee.role}</Badge>
        <Badge variant={employee.is_active ? 'success' : 'neutral'} dot>
          {employee.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      <Card className="max-w-2xl space-y-0">
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
      </Card>
    </div>
  );
}
