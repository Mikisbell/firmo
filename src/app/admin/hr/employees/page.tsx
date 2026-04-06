'use client';

/**
 * HR Employee Management Page
 *
 * Full CRUD for HR employees with search, filters, role badges,
 * and status management. Uses the DataTable component and useAdminData hook.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Check, X, Shield, UserX, Eye, Search, MoreVertical } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../../components/DataTable';
import { useAdminData } from '@/src/hooks/useAdminData';
import { toast } from 'sonner';
import { Button, Badge, PageHeader, Breadcrumbs, Avatar } from '@/src/components/ui';
import { Dropdown } from '@/src/components/ui/Dropdown';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HREmployee {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  dni: string | null;
  email: string | null;
  phone: string | null;
  position: string;
  base_salary_cents: number;
  contract_type: string;
  hire_date: string;
  commission_rate: number | null;
  pension_system: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

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

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activo' },
  { value: 'false', label: 'Inactivo' },
];

const ROLE_COLORS: Record<string, string> = {
  OWNER:      'bg-amber-500/20 text-amber-400',
  ADMIN:      'bg-purple-500/20 text-purple-400',
  MANAGER:    'bg-blue-500/20 text-blue-400',
  SUPERVISOR: 'bg-indigo-500/20 text-indigo-400',
  CASHIER:    'bg-green-500/20 text-green-400',
  WAITER:     'bg-cyan-500/20 text-cyan-400',
  KITCHEN:    'bg-orange-500/20 text-orange-400',
  COOK:       'bg-orange-400/20 text-orange-300',
  PACKER:     'bg-yellow-500/20 text-yellow-400',
  BAR:        'bg-teal-500/20 text-teal-400',
  DRIVER:     'bg-pink-500/20 text-pink-400',
};

const CONTRACT_LABELS: Record<string, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo Fijo',
  PART_TIME: 'Part Time',
};

const filters: FilterConfig[] = [
  { key: 'role', label: 'Rol', options: ROLE_OPTIONS },
  { key: 'is_active', label: 'Estado', options: STATUS_OPTIONS },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HREmployeesPage() {
  const router = useRouter();
  const { data: employees, loading, error, refetch } = useAdminData<HREmployee>('/api/hr/employees?pageSize=100');
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const handleDeactivate = async (employee: HREmployee) => {
    if (!confirm(`¿Desea ${employee.is_active ? 'desactivar' : 'reactivar'} a ${employee.name}?`)) return;

    try {
      setDeactivating(employee.id);
      const res = await fetch(`/api/hr/employees/${employee.id}`, {
        method: employee.is_active ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: !employee.is_active ? JSON.stringify({ is_active: true }) : undefined,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error en la operacion');
      }

      toast.success(employee.is_active ? 'Empleado desactivado' : 'Empleado reactivado');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar');
    } finally {
      setDeactivating(null);
    }
  };

  const columns: Column<HREmployee>[] = [
    {
      key: 'name',
      label: 'Nombre',
      render: (e) => (
        <div className="flex items-center gap-2">
          <Avatar name={e.name} size="sm" status={e.is_active ? 'online' : undefined} />
          <div>
            <span className="font-medium">{e.name}</span>
            {e.dni && <p className="text-xs text-park-gray-500">DNI: {e.dni}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rol',
      width: '140px',
      render: (e) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            ROLE_COLORS[e.role] || 'bg-park-gray-500/20 text-park-gray-400'
          }`}
        >
          <Shield className="w-3 h-3" />
          {ROLE_OPTIONS.find((r) => r.value === e.role)?.label || e.role}
        </span>
      ),
    },
    {
      key: 'position',
      label: 'Puesto',
      width: '150px',
      render: (e) => (
        <div>
          <span className="text-sm">{e.position}</span>
          <p className="text-xs text-park-gray-500">{CONTRACT_LABELS[e.contract_type] || e.contract_type}</p>
        </div>
      ),
    },
    {
      key: 'base_salary_cents',
      label: 'Salario Base',
      width: '140px',
      render: (e) => (
        <span className="text-sm font-mono">{formatCurrency(e.base_salary_cents)}</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Estado',
      width: '100px',
      render: (e) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            e.is_active
              ? 'bg-green-500/20 text-green-400'
              : 'bg-park-gray-500/20 text-park-gray-400'
          }`}
        >
          {e.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {e.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '60px',
      render: (e) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <Dropdown
            align="end"
            trigger={<Button variant="ghost" size="sm" icon={<MoreVertical size={16} />} aria-label="Acciones" />}
            items={[
              { label: 'Ver detalles', icon: <Eye size={14} />, onClick: () => router.push(`/admin/hr/employees/${e.id}`) },
              { label: 'Editar', icon: <Edit2 size={14} />, onClick: () => router.push(`/admin/hr/employees/${e.id}/edit`) },
              { separator: true, label: '' },
              { label: e.is_active ? 'Desactivar' : 'Reactivar', icon: <UserX size={14} />, variant: e.is_active ? 'destructive' : 'default', onClick: () => handleDeactivate(e), disabled: deactivating === e.id },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: 'Recursos Humanos', href: '/admin/hr' }, { label: 'Empleados HR' }]} />
      </div>
      <PageHeader
        title="Empleados HR"
        description="Gestion completa del personal"
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => router.push('/admin/hr/employees/new')}
          >
            Nuevo Empleado
          </Button>
        }
      />

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Employees table */}
      <DataTable
        data={employees || []}
        columns={columns}
        filters={filters}
        searchPlaceholder="Buscar por nombre o DNI..."
        searchKeys={['name', 'dni']}
        loading={loading}
        emptyMessage="No hay empleados registrados"
        onRowClick={(e) => router.push(`/admin/hr/employees/${e.id}`)}
        rowTestId="hr-employee-row"
      />
    </div>
  );
}
