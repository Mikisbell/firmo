'use client';

/**
 * Leave Requests Management Page - Permisos y Vacaciones
 * Admin view to manage, approve, and reject leave requests.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { FileText, Check, X, AlertTriangle, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'text-yellow-400 bg-yellow-500/20' },
  APPROVED: { label: 'Aprobado', color: 'text-green-400 bg-green-500/20' },
  REJECTED: { label: 'Rechazado', color: 'text-red-400 bg-red-500/20' },
  CANCELLED: { label: 'Cancelado', color: 'text-zinc-400 bg-zinc-500/20' },
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Permisos y Vacaciones</h1>
          <p className="text-zinc-400 text-sm">Gestión de solicitudes de licencia</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por empleado o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-zinc-400 text-center py-12">Cargando...</div>
      ) : error ? (
        <div className="text-red-400 text-center py-12 flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Error al cargar solicitudes
        </div>
      ) : !filtered.length ? (
        <div className="text-zinc-500 text-center py-12">
          No hay solicitudes {STATUS_LABELS[statusFilter]?.label.toLowerCase() || ''} para mostrar.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-400 text-left">
                <th className="py-3 px-4">Empleado</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Desde</th>
                <th className="py-3 px-4">Hasta</th>
                <th className="py-3 px-4 text-center">Días</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4">Estado</th>
                {statusFilter === 'PENDING' && <th className="py-3 px-4 text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const status = STATUS_LABELS[r.status] ?? STATUS_LABELS.PENDING;
                return (
                  <tr key={r.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="py-3 px-4 text-white">{r.employee_name ?? r.employee_id.slice(0, 8)}</td>
                    <td className="py-3 px-4 text-zinc-300">{LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type}</td>
                    <td className="py-3 px-4 text-zinc-300">{r.start_date?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-zinc-300">{r.end_date?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-center text-zinc-300">{r.days_requested}</td>
                    <td className="py-3 px-4 text-zinc-400 max-w-[200px] truncate">{r.reason}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    {statusFilter === 'PENDING' && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleAction(r.id, 'approve')}
                            className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors"
                            title="Aprobar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleAction(r.id, 'reject')}
                            className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
                            title="Rechazar"
                          >
                            <X className="w-4 h-4" />
                          </button>
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
    </div>
  );
}
