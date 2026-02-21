'use client';

/**
 * Advances Management Page - Adelantos de Sueldo
 * Admin view to manage salary advance requests.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Briefcase, Check, X, DollarSign, AlertTriangle, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface Advance {
  id: string;
  employee_id: string;
  employee_name?: string;
  amount_cents: number;
  reason: string;
  status: string;
  requested_at: string;
  approved_at?: string;
  paid_at?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'text-yellow-400 bg-yellow-500/20' },
  APPROVED: { label: 'Aprobado', color: 'text-green-400 bg-green-500/20' },
  REJECTED: { label: 'Rechazado', color: 'text-red-400 bg-red-500/20' },
  PAID: { label: 'Pagado', color: 'text-blue-400 bg-blue-500/20' },
};

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar datos');
  return r.json();
});

export default function AdvancesPage() {
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const { data, error, isLoading, mutate } = useSWR<{ items: Advance[] }>(
    `/api/hr/advances?status=${statusFilter}`,
    fetcher
  );

  const advances = data?.items ?? (Array.isArray(data) ? data : []);

  async function handleAction(id: string, action: 'approve' | 'reject' | 'mark-paid') {
    const labels: Record<string, string> = {
      approve: 'aprobar',
      reject: 'rechazar',
      'mark-paid': 'marcar como pagado',
    };
    try {
      const res = await fetch(`/api/hr/advances/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error al ${labels[action]}`);
      }
      toast.success(`Adelanto ${action === 'approve' ? 'aprobado' : action === 'reject' ? 'rechazado' : 'marcado como pagado'}`);
      mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const totalPending = advances.reduce((sum, a) => sum + a.amount_cents, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Adelantos</h1>
          <p className="text-zinc-400 text-sm">Solicitudes y aprobación de adelantos de sueldo</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Solicitudes ({STATUS_CONFIG[statusFilter]?.label})</p>
          <p className="text-2xl font-bold text-white">{advances.length}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Monto Total</p>
          <p className="text-2xl font-bold text-amber-400">{formatCurrency(totalPending)}</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-zinc-500" />
        {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
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

      {/* Table */}
      {isLoading ? (
        <div className="text-zinc-400 text-center py-12">Cargando...</div>
      ) : error ? (
        <div className="text-red-400 text-center py-12 flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Error al cargar adelantos
        </div>
      ) : !advances.length ? (
        <div className="text-zinc-500 text-center py-12">
          No hay adelantos {STATUS_CONFIG[statusFilter]?.label.toLowerCase()} para mostrar.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-400 text-left">
                <th className="py-3 px-4">Empleado</th>
                <th className="py-3 px-4 text-right">Monto</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4">Fecha Solicitud</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {advances.map((a) => {
                const status = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PENDING;
                return (
                  <tr key={a.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="py-3 px-4 text-white">{a.employee_name ?? a.employee_id.slice(0, 8)}</td>
                    <td className="py-3 px-4 text-right text-amber-400 font-medium">{formatCurrency(a.amount_cents)}</td>
                    <td className="py-3 px-4 text-zinc-400 max-w-[200px] truncate">{a.reason}</td>
                    <td className="py-3 px-4 text-zinc-300">{a.requested_at?.slice(0, 10)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {a.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleAction(a.id, 'approve')}
                              className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors"
                              title="Aprobar"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAction(a.id, 'reject')}
                              className="p-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
                              title="Rechazar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {a.status === 'APPROVED' && (
                          <button
                            onClick={() => handleAction(a.id, 'mark-paid')}
                            className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-colors"
                            title="Marcar como pagado"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        {(a.status === 'REJECTED' || a.status === 'PAID') && (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </div>
                    </td>
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
