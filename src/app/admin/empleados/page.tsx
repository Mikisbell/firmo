'use client';

/**
 * Employees Management Page
 * Lista de empleados con búsqueda, filtros y CRUD
 * 
 * Requirements: 4.1, 4.2
 */

import { useRouter } from 'next/navigation';
import { Plus, Edit2, Shield, Eye, EyeOff } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../components/DataTable';
import { useAdminData } from '@/src/hooks/useAdminData';
import { Button, Badge, Card, PageHeader } from '@/src/components/ui';
import { useQueryState, useQueryStates } from '@/src/hooks/useQueryState';

interface Employee {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
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

const filters: FilterConfig[] = [
  { key: 'role', label: 'Rol', options: ROLE_OPTIONS },
];

const ROLE_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'critical' | 'info' | 'neutral'> = {
  OWNER:      'critical',
  ADMIN:      'critical',
  MANAGER:    'warning',
  SUPERVISOR: 'warning',
  CASHIER:    'info',
  WAITER:     'success',
  KITCHEN:    'neutral',
  COOK:       'neutral',
  PACKER:     'neutral',
  BAR:        'neutral',
  DRIVER:     'info',
};

export default function EmployeesPage() {
  const router = useRouter();
  const [status, setStatus] = useQueryState<'active' | 'inactive'>('status', 'active');
  const showInactive = status === 'inactive';
  const [employeeFilters, setEmployeeFilters] = useQueryStates({ role: '' });
  const endpoint = showInactive ? '/api/admin/employees?is_active=false&pageSize=100' : '/api/admin/employees?pageSize=100';
  const { data: employees, loading, error } = useAdminData<Employee>(endpoint);

  const columns: Column<Employee>[] = [
    { 
      key: 'name', 
      label: 'Nombre',
      render: (e) => (
        <span data-testid="employee-name">{e.name}</span>
      ),
    },
    {
      key: 'role',
      label: 'Rol',
      width: '150px',
      render: (e) => (
        <Badge variant={ROLE_BADGE_VARIANT[e.role] || 'neutral'}>
          <span className="inline-flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {ROLE_OPTIONS.find((r) => r.value === e.role)?.label || e.role}
          </span>
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: 'Estado',
      width: '100px',
      render: (e) => (
        <Badge variant={e.is_active ? 'success' : 'neutral'} dot>
          {e.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '80px',
      render: (e) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(ev) => {
            ev.stopPropagation();
            router.push(`/admin/empleados/${e.id}`);
          }}
          icon={<Edit2 className="w-4 h-4" />}
        >
          Editar
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <Card padding="none">
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empleados"
        description="Gestionar personal y accesos"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant={showInactive ? 'secondary' : 'ghost'}
              icon={showInactive ? <EyeOff size={16} /> : <Eye size={16} />}
              onClick={() => setStatus(showInactive ? 'active' : 'inactive')}
            >
              {showInactive ? 'Inactivos' : 'Activos'}
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => router.push('/admin/empleados/nuevo')}
            >
              Nuevo Empleado
            </Button>
          </div>
        }
      />

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Employees table */}
      <Card padding="none">
        <DataTable
          data={employees || []}
          columns={columns}
          filters={filters}
          searchPlaceholder="Buscar por nombre..."
          searchKeys={['name']}
          loading={loading}
          emptyMessage="No hay empleados"
          onRowClick={(e) => router.push(`/admin/empleados/${e.id}`)}
          rowTestId="employee-row"
          activeFilters={employeeFilters}
          onFiltersChange={(f) => setEmployeeFilters({ role: f.role || '' })}
        />
      </Card>
    </div>
  );
}
