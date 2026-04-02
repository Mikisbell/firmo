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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-7 w-7" />
          Cola de Impresion
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Ultima actualizacion: {lastUpdate.toLocaleTimeString('es-PE')}
          </span>
          <button
            onClick={fetchData}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

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
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Impresora</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Orden #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Intentos</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Creado</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3">
                    <JobTypeBadge type={job.jobType} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {job.printerName || job.printerId?.slice(0, 8) || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                    {job.orderId ? job.orderId.slice(0, 8) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">
                    {job.attempts}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(job.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {job.status === 'FAILED' && (
                      <button
                        onClick={() => handleRetry(job)}
                        disabled={retryingId === job.id}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-orange-600 hover:bg-orange-50 rounded disabled:opacity-40"
                        title="Reintentar"
                      >
                        {retryingId === job.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Reintentar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 && (
          <p className="p-8 text-center text-gray-500">
            No hay trabajos de impresion
          </p>
        )}
      </div>
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
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  const iconColorMap = {
    yellow: 'text-yellow-500',
    blue: 'text-blue-500',
    green: 'text-green-500',
    red: 'text-red-500',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="text-2xl font-bold">{count}</p>
        </div>
        <Icon className={`h-8 w-8 ${iconColorMap[color]} opacity-60`} />
      </div>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    QUEUED: 'bg-yellow-100 text-yellow-700',
    SENT: 'bg-blue-100 text-blue-700',
    PRINTED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };

  const labels: Record<string, string> = {
    QUEUED: 'En Cola',
    SENT: 'Enviado',
    PRINTED: 'Impreso',
    FAILED: 'Fallido',
  };

  return (
    <span className={`text-xs px-2 py-1 rounded ${styles[status] || 'bg-gray-100'}`}>
      {labels[status] || status}
    </span>
  );
}

function JobTypeBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; icon: typeof Receipt; label: string }> = {
    RECEIPT: { bg: 'bg-emerald-100 text-emerald-700', icon: Receipt, label: 'Recibo' },
    KITCHEN_TICKET: { bg: 'bg-orange-100 text-orange-700', icon: ChefHat, label: 'Cocina' },
    PRE_CHECK: { bg: 'bg-indigo-100 text-indigo-700', icon: FileText, label: 'Pre-cuenta' },
    INVOICE: { bg: 'bg-cyan-100 text-cyan-700', icon: FileText, label: 'Factura' },
    TEST: { bg: 'bg-purple-100 text-purple-700', icon: FileText, label: 'Prueba' },
  };

  const { bg, icon: Icon, label } = config[type] || {
    bg: 'bg-gray-100 text-gray-700',
    icon: FileText,
    label: type,
  };

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${bg}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
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
