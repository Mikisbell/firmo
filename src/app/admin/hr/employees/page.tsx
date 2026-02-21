'use client';

/**
 * HR Employee Management Page
 *
 * Full CRUD for HR employees with search, filters, role badges,
 * and status management. Uses the DataTable component and useAdminData hook.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Check, X, Shield, UserX, Eye, Search } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../../components/DataTable';
import { useAdminData } from '@/src/hooks/useAdminData';
import { toast } from 'sonner';

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
  { value: 'CASHIER', label: 'Cajero' },
  { value: 'WAITER', label: 'Mesero' },
  { value: 'COOK', label: 'Cocinero' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'ADMIN', label: 'Administrador' },
];

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activo' },
  { value: 'false', label: 'Inactivo' },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-500/20 text-purple-400',
  SUPERVISOR: 'bg-blue-500/20 text-blue-400',
  CASHIER: 'bg-green-500/20 text-green-400',
  WAITER: 'bg-cyan-500/20 text-cyan-400',
  COOK: 'bg-orange-500/20 text-orange-400',
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
  const { data: employees, loading, error, refetch } = useAdminData<HREmployee>('/api/hr/employees');
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
        <div>
          <span className="font-medium">{e.name}</span>
          {e.dni && <p className="text-xs text-zinc-500">DNI: {e.dni}</p>}
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
            ROLE_COLORS[e.role] || 'bg-zinc-500/20 text-zinc-400'
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
          <p className="text-xs text-zinc-500">{CONTRACT_LABELS[e.contract_type] || e.contract_type}</p>
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
              : 'bg-zinc-500/20 text-zinc-400'
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
      width: '120px',
      render: (e) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              router.push(`/admin/hr/employees/${e.id}`);
            }}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              router.push(`/admin/hr/employees/${e.id}/edit`);
            }}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Editar"
          >
            <Edit2 className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              handleDeactivate(e);
            }}
            disabled={deactivating === e.id}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
            title={e.is_active ? 'Desactivar' : 'Reactivar'}
          >
            <UserX className={`w-4 h-4 ${e.is_active ? 'text-red-400' : 'text-green-400'}`} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empleados HR</h1>
          <p className="text-zinc-400 mt-1">Gestion completa del personal</p>
        </div>
        <button
          onClick={() => router.push('/admin/hr/employees/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Nuevo Empleado
        </button>
      </div>

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
