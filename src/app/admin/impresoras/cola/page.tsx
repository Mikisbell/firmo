'use client';

/**
 * Cola de Impresion - Dashboard de trabajos de impresion
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  Receipt,
  ChefHat,
  FileText,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { Button, Badge, Card, CardHeader, PageHeader, EmptyState, Breadcrumbs } from '@/src/components/ui';

// ============================================================================
// Types
// ============================================================================

interface PrintJob {
  id: string;
  printerId: string | null;
  printerName: string | null;
  jobType: string;
  status: string;
  attempts: number;
  orderId: string | null;
  createdAt: string;
  sentAt: string | null;
  printedAt: string | null;
  failedAt: string | null;
}

interface JobStats {
  queued: number;
  sent: number;
  printed: number;
  failed: number;
  total: number;
}

// ============================================================================
// Page
// ============================================================================

export default function PrintQueuePage() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [stats, setStats] = useState<JobStats>({ queued: 0, sent: 0, printed: 0, failed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/print-jobs?all=true&stats=true&limit=200');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        if (data.stats) setStats(data.stats);
        setLastUpdate(new Date());
      }
    } catch {
      // Solo logear en primera carga, no en cada poll
      if (loading) toast.error('Error al cargar cola de impresión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRetry = async (job: PrintJob) => {
    setRetryingId(job.id);
    try {
      const res = await fetch(`/api/admin/print-jobs/${job.id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Job reencolado', { description: `Trabajo ${job.id.slice(0, 8)}... reencolado` });
        await fetchData();
      } else {
        toast.error('Error al reintentar', { description: data.error || 'Error desconocido' });
      }
    } catch (err) {
      toast.error('Error al reintentar', {
        description: err instanceof Error ? err.message : 'Error de conexion',
      });
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <Card>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: 'Impresoras', href: '/admin/impresoras' }, { label: 'Cola' }]} />
      </div>
      <PageHeader
        title="Cola de Impresion"
        description={`Ultima actualizacion: ${lastUpdate.toLocaleTimeString('es-PE')}`}
        actions={
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={fetchData}>
            Actualizar
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="En Cola"
          count={stats.queued}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          label="Enviados"
          count={stats.sent}
          icon={Send}
          color="blue"
        />
        <StatCard
          label="Impresos"
          count={stats.printed}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          label="Fallidos"
          count={stats.failed}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Jobs Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Tipo</th>
                <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Impresora</th>
                <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Orden #</th>
                <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Estado</th>
                <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Intentos</th>
                <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Creado</th>
                <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <JobTypeBadge type={job.jobType} />
                  </td>
                  <td className="px-4 py-3 text-park-gray-400">
                    {job.printerName || job.printerId?.slice(0, 8) || '-'}
                  </td>
                  <td className="px-4 py-3 text-park-gray-400 font-mono">
                    {job.orderId ? job.orderId.slice(0, 8) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-park-gray-400 text-center">
                    {job.attempts}
                  </td>
                  <td className="px-4 py-3 text-park-gray-500">
                    {formatDate(job.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {job.status === 'FAILED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={retryingId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        onClick={() => handleRetry(job)}
                        disabled={retryingId === job.id}
                      >
                        Reintentar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 && (
          <EmptyState
            icon={<ClipboardList />}
            title="No hay trabajos de impresion"
          />
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: typeof Clock;
  color: 'yellow' | 'blue' | 'green' | 'red';
}) {
  const colorMap = {
    yellow: 'text-amber-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
  };

  return (
    <div className="bg-park-gray-900 rounded-xl border border-park-gray-800 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-park-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white">{count}</p>
        </div>
        <Icon className={`h-8 w-8 ${colorMap[color]} opacity-60`} />
      </div>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'warning' | 'info' | 'success' | 'critical' | 'neutral'> = {
    QUEUED: 'warning',
    SENT: 'info',
    PRINTED: 'success',
    FAILED: 'critical',
  };

  const labels: Record<string, string> = {
    QUEUED: 'En Cola',
    SENT: 'Enviado',
    PRINTED: 'Impreso',
    FAILED: 'Fallido',
  };

  return (
    <Badge variant={variants[status] || 'neutral'} dot>
      {labels[status] || status}
    </Badge>
  );
}

function JobTypeBadge({ type }: { type: string }) {
  const config: Record<string, { variant: 'success' | 'warning' | 'info' | 'neutral'; icon: typeof Receipt; label: string }> = {
    RECEIPT: { variant: 'success', icon: Receipt, label: 'Recibo' },
    KITCHEN_TICKET: { variant: 'warning', icon: ChefHat, label: 'Cocina' },
    PRE_CHECK: { variant: 'info', icon: FileText, label: 'Pre-cuenta' },
    INVOICE: { variant: 'info', icon: FileText, label: 'Factura' },
    TEST: { variant: 'neutral', icon: FileText, label: 'Prueba' },
  };

  const { variant, label } = config[type] || {
    variant: 'neutral' as const,
    label: type,
  };

  return (
    <Badge variant={variant}>{label}</Badge>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
