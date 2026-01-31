'use client';

/**
 * Employees Management Page
 * Lista de empleados con búsqueda, filtros y CRUD
 * 
 * Requirements: 4.1, 4.2
 */

import { useRouter } from 'next/navigation';
import { Plus, Edit2, Check, X, Shield } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../components/DataTable';
import { useAdminData } from '@/src/hooks/useAdminData';

interface Employee {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Dueño' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'CASHIER', label: 'Cajero' },
  { value: 'WAITER', label: 'Mesero' },
  { value: 'KITCHEN', label: 'Cocina' },
  { value: 'DRIVER', label: 'Repartidor' },
];

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activo' },
  { value: 'false', label: 'Inactivo' },
];

const filters: FilterConfig[] = [
  { key: 'role', label: 'Rol', options: ROLE_OPTIONS },
  { key: 'is_active', label: 'Estado', options: STATUS_OPTIONS },
];

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-amber-500/20 text-amber-400',
  ADMIN: 'bg-purple-500/20 text-purple-400',
  MANAGER: 'bg-blue-500/20 text-blue-400',
  CASHIER: 'bg-green-500/20 text-green-400',
  WAITER: 'bg-cyan-500/20 text-cyan-400',
  KITCHEN: 'bg-orange-500/20 text-orange-400',
  DRIVER: 'bg-pink-500/20 text-pink-400',
};

export default function EmployeesPage() {
  const router = useRouter();
  const { data: employees, loading, error } = useAdminData<Employee>('/api/admin/employees');

  const columns: Column<Employee>[] = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'role',
      label: 'Rol',
      width: '150px',
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
      width: '80px',
      render: (e) => (
        <button
          onClick={(ev) => {
            ev.stopPropagation();
            router.push(`/admin/empleados/${e.id}`);
          }}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          title="Editar"
        >
          <Edit2 className="w-4 h-4 text-zinc-400" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empleados</h1>
          <p className="text-zinc-400 mt-1">Gestionar personal y accesos</p>
        </div>
        <button
          onClick={() => router.push('/admin/empleados/nuevo')}
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
        searchPlaceholder="Buscar por nombre..."
        searchKeys={['name']}
        loading={loading}
        emptyMessage="No hay empleados"
        onRowClick={(e) => router.push(`/admin/empleados/${e.id}`)}
      />
    </div>
  );
}
