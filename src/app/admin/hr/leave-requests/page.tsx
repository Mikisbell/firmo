'use client';

/**
 * Leave Requests Management Page - Permisos y Vacaciones
 * Admin view to manage, approve, and reject leave requests.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { FileText, Check, X, AlertTriangle, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Card, PageHeader, EmptyState } from '@/src/components/ui';

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: string;
  created_at: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacaciones',
  PERSONAL: 'Personal',
  MEDICAL: 'Médico',
  MATERNITY: 'Maternidad',
  PATERNITY: 'Paternidad',
  BEREAVEMENT: 'Duelo',
  UNPAID: 'Sin goce',
};

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'success' | 'critical' | 'neutral' }> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  APPROVED: { label: 'Aprobado', variant: 'success' },
  REJECTED: { label: 'Rechazado', variant: 'critical' },
  CANCELLED: { label: 'Cancelado', variant: 'neutral' },
};

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar datos');
  return r.json();
});

export default function LeaveRequestsPage() {
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [search, setSearch] = useState('');

  const { data, error, isLoading, mutate } = useSWR<{ items: LeaveRequest[] }>(
    `/api/hr/leave-requests?status=${statusFilter}`,
    fetcher
  );

  const requests = data?.items ?? (Array.isArray(data) ? data : []);

  const filtered = requests.filter(r =>
    !search || r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.reason?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAction(id: string, action: 'approve' | 'reject') {
    try {
      const res = await fetch(`/api/hr/leave-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error al ${action === 'approve' ? 'aprobar' : 'rechazar'}`);
      }
      toast.success(action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

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

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Solicitudes de Permiso"
        description="Gestión de solicitudes de licencia"
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-park-gray-500" />
          <input
            type="text"
            placeholder="Buscar por empleado o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-park-gray-800 border border-park-gray-700 text-white rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-park-gray-500" />
          {Object.entries(STATUS_BADGE).map(([key, { label }]) => (
            <Button
              key={key}
              variant={statusFilter === key ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        {error ? (
          <EmptyState
            icon={<AlertTriangle />}
            title="Error al cargar solicitudes"
            description="No se pudieron cargar las solicitudes. Intente nuevamente."
          />
        ) : !filtered.length ? (
          <EmptyState
            icon={<FileText />}
            title="Sin solicitudes"
            description={`No hay solicitudes ${STATUS_BADGE[statusFilter]?.label.toLowerCase() || ''} para mostrar.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Empleado</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Desde</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Hasta</th>
                  <th className="px-4 py-3 text-center text-park-gray-400 font-medium">Días</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Motivo</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Estado</th>
                  {statusFilter === 'PENDING' && <th className="px-4 py-3 text-center text-park-gray-400 font-medium">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.PENDING;
                  return (
                    <tr key={r.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white">{r.employee_name ?? r.employee_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-park-gray-300">{LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type}</td>
                      <td className="px-4 py-3 text-park-gray-300">{r.start_date?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-park-gray-300">{r.end_date?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-center text-park-gray-300">{r.days_requested}</td>
                      <td className="px-4 py-3 text-park-gray-400 max-w-[200px] truncate">{r.reason}</td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant} dot>{badge.label}</Badge>
                      </td>
                      {statusFilter === 'PENDING' && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(r.id, 'approve')}
                              icon={<Check className="w-4 h-4 text-green-400" />}
                            >
                              Aprobar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(r.id, 'reject')}
                              icon={<X className="w-4 h-4 text-red-400" />}
                            >
                              Rechazar
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
