'use client';

/**
 * Advances Management Page - Adelantos de Sueldo
 * Admin view to manage salary advance requests.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Briefcase, Check, X, DollarSign, AlertTriangle, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState, Breadcrumbs } from '@/src/components/ui';

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

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'success' | 'critical' | 'info' }> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  APPROVED: { label: 'Aprobado', variant: 'success' },
  REJECTED: { label: 'Rechazado', variant: 'critical' },
  PAID: { label: 'Pagado', variant: 'info' },
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

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
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
      <div className="mb-4">
        <Breadcrumbs items={[{ label: 'Recursos Humanos', href: '/admin/hr' }, { label: 'Adelantos' }]} />
      </div>
      <PageHeader
        title="Adelantos"
        description="Solicitudes y aprobación de adelantos de sueldo"
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          label={`Solicitudes (${STATUS_BADGE[statusFilter]?.label})`}
          value={advances.length}
          icon={<Briefcase className="w-5 h-5" />}
        />
        <MetricCard
          label="Monto Total"
          value={totalPending}
          format="currency"
          icon={<DollarSign className="w-5 h-5" />}
        />
      </div>

      {/* Status Filter */}
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

      {/* Table */}
      <Card padding="none">
        {error ? (
          <EmptyState
            icon={<AlertTriangle />}
            title="Error al cargar adelantos"
            description="No se pudieron cargar los datos. Intente nuevamente."
          />
        ) : !advances.length ? (
          <EmptyState
            icon={<Briefcase />}
            title="Sin adelantos"
            description={`No hay adelantos ${STATUS_BADGE[statusFilter]?.label.toLowerCase()} para mostrar.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Empleado</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Monto</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Motivo</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Fecha Solicitud</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Estado</th>
                  <th className="px-4 py-3 text-center text-park-gray-400 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((a) => {
                  const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.PENDING;
                  return (
                    <tr key={a.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white">{a.employee_name ?? a.employee_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-right text-amber-400 font-medium">{formatCurrency(a.amount_cents)}</td>
                      <td className="px-4 py-3 text-park-gray-400 max-w-[200px] truncate">{a.reason}</td>
                      <td className="px-4 py-3 text-park-gray-300">{a.requested_at?.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant} dot>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {a.status === 'PENDING' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAction(a.id, 'approve')}
                                icon={<Check className="w-4 h-4 text-green-400" />}
                              >
                                Aprobar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAction(a.id, 'reject')}
                                icon={<X className="w-4 h-4 text-red-400" />}
                              >
                                Rechazar
                              </Button>
                            </>
                          )}
                          {a.status === 'APPROVED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(a.id, 'mark-paid')}
                              icon={<DollarSign className="w-4 h-4 text-blue-400" />}
                            >
                              Marcar Pagado
                            </Button>
                          )}
                          {(a.status === 'REJECTED' || a.status === 'PAID') && (
                            <span className="text-park-gray-600 text-xs">—</span>
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
      </Card>
    </div>
  );
}
