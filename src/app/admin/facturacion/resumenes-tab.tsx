'use client';

/**
 * Daily Summaries Tab — Table of SUNAT daily summary submissions (Resumen Diario de Boletas).
 *
 * @module app/admin/facturacion/resumenes-tab
 */

import { useState } from 'react';
import { CalendarDays, Loader2, RefreshCw, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useDailySummaries } from '@/src/hooks/useFacturacion';

function centsToSoles(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  ACCEPTED: { icon: CheckCircle, color: 'text-green-400 bg-green-400/10', label: 'Aceptado' },
  PENDING: { icon: Clock, color: 'text-zinc-400 bg-zinc-400/10', label: 'Pendiente' },
  SENT: { icon: Clock, color: 'text-yellow-400 bg-yellow-400/10', label: 'Enviado' },
  REJECTED: { icon: XCircle, color: 'text-red-400 bg-red-400/10', label: 'Rechazado' },
  FAILED: { icon: AlertTriangle, color: 'text-red-400 bg-red-400/10', label: 'Error' },
};

export default function ResumenesTab() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { summaries, pagination, isLoading, mutate } = useDailySummaries({
    page,
    limit: 10,
    from: from || undefined,
    to: to || undefined,
  });

  const handleResend = async (summaryId: string) => {
    try {
      const res = await fetch('/api/admin/facturacion/resumenes-diarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Error al reenviar');
        return;
      }

      toast.success('Resumen marcado para reenvío');
      mutate();
    } catch {
      toast.error('Error de conexión');
    }
  };

  return (
    <div className="space-y-4">
      {/* Date Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        {(from || to) && (
          <button
            onClick={() => { setFrom(''); setTo(''); setPage(1); }}
            className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <CalendarDays className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">No hay resúmenes diarios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-900/50">
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Número</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-zinc-400 uppercase">Boletas</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-zinc-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Ticket SUNAT</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-zinc-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-zinc-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => {
                  const sc = statusConfig[s.sunat_status] ?? statusConfig.PENDING;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={s.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/30">
                      <td className="px-4 py-3 text-zinc-300 text-xs">
                        {new Date(s.summary_date).toLocaleDateString('es-PE')}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-100">{s.summary_number}</td>
                      <td className="px-4 py-3 text-right text-zinc-200">{s.boletas_count}</td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-100">
                        {centsToSoles(s.boletas_total_cents)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                        {s.ticket_number ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(s.sunat_status === 'REJECTED' || s.sunat_status === 'FAILED' || s.sunat_status === 'PENDING') && (
                          <button
                            onClick={() => handleResend(s.id)}
                            className="p-1.5 hover:bg-zinc-600 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
                            title="Reenviar"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error details */}
      {summaries.some((s) => s.last_error) && (
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase mb-2">Errores Recientes</h3>
          {summaries
            .filter((s) => s.last_error)
            .map((s) => (
              <div key={s.id} className="text-xs text-red-300 bg-red-500/5 p-2 rounded mb-1">
                <span className="text-zinc-500">{s.summary_number}:</span> {s.last_error}
              </div>
            ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-zinc-400">
            Página {page} de {pagination.pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pagination.pages, page + 1))}
            disabled={page >= pagination.pages}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
