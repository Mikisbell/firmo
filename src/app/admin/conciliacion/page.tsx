'use client';

/**
 * Conciliacion de Pagos Page
 *
 * Payment reconciliation: generate settlement periods,
 * record actual received amounts, detect discrepancies.
 *
 * @module app/admin/conciliacion/page
 */

import { useState, useCallback } from 'react';
import { Scale, Calendar, Download, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useSettlements } from '@/src/hooks/useSWRHooks';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState } from '@/src/components/ui';

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'critical'; label: string }> = {
  PENDING: { variant: 'warning', label: 'Pendiente' },
  MATCHED: { variant: 'success', label: 'Conciliado' },
  DISCREPANCY: { variant: 'critical', label: 'Discrepancia' },
};

function formatCurrency(cents: number | null) {
  if (cents === null) return '\u2014';
  const abs = Math.abs(cents);
  const formatted = `S/ ${(abs / 100).toFixed(2)}`;
  return cents < 0 ? `-${formatted}` : formatted;
}

function getDefaultWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek - 7); // Last Monday
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Last Sunday
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function ConciliacionPage() {
  const defaults = getDefaultWeek();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [statusFilter, setStatusFilter] = useState('');
  const { data, error, isLoading, mutate } = useSettlements(
    statusFilter ? { status: statusFilter } : undefined,
  );
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ start: startDate, end: endDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      const result = await res.json();
      toast.success(`${result.settlements.length} liquidaciones generadas`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al generar');
    } finally {
      setGenerating(false);
    }
  }, [startDate, endDate, mutate]);

  const handleReconcile = useCallback(async (settlementId: string) => {
    try {
      const res = await fetch(`/api/admin/reconciliation/${settlementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receivedCents: Math.round(parseFloat(receivedAmount) * 100),
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      toast.success('Liquidacion actualizada');
      setEditingId(null);
      setReceivedAmount('');
      setNotes('');
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al reconciliar');
    }
  }, [receivedAmount, notes, mutate]);

  const handleExport = useCallback(async () => {
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      const res = await fetch(`/api/admin/reconciliation/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conciliacion-${startDate}-${endDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportado');
    } catch {
      toast.error('Error al exportar');
    }
  }, [startDate, endDate]);

  const settlements = data?.settlements ?? [];
  const totalExpected = settlements.reduce((s, t) => s + t.expectedCents, 0);
  const totalReceived = settlements.reduce((s, t) => s + (t.receivedCents ?? 0), 0);

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
        title="Conciliacion"
        description="Control de liquidaciones por metodo de pago"
        actions={
          <Button
            variant="primary"
            icon={<Download size={16} />}
            onClick={handleExport}
            disabled={!settlements.length}
          >
            Excel
          </Button>
        }
      />

      {/* Generate Period */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-park-gray-400" />
            <div>
              <label className="text-xs text-park-gray-500">Desde</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="block bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px]" />
            </div>
          </div>
          <div>
            <label className="text-xs text-park-gray-500">Hasta</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="block bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px]" />
          </div>
          <Button onClick={handleGenerate} disabled={generating} loading={generating}>
            {generating ? 'Generando...' : 'Generar Liquidacion'}
          </Button>
          <div>
            <label className="text-xs text-park-gray-500">Filtrar</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="block bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px]">
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="MATCHED">Conciliado</option>
              <option value="DISCREPANCY">Discrepancia</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      {settlements.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard label="Total Esperado" value={formatCurrency(totalExpected)} />
          <MetricCard
            label="Total Recibido"
            value={formatCurrency(totalReceived)}
            className="[&_p:last-child]:text-emerald-400"
          />
          <MetricCard
            label="Diferencia"
            value={formatCurrency(totalExpected - totalReceived)}
            className={totalExpected - totalReceived === 0 ? '[&_p:last-child]:text-emerald-400' : '[&_p:last-child]:text-red-400'}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al cargar liquidaciones.
        </div>
      )}

      {/* Settlements Table */}
      {settlements.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Metodo</th>
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Periodo</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Esperado</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Recibido</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Diferencia</th>
                  <th className="text-center px-4 py-3 text-park-gray-400 font-medium">Estado</th>
                  <th className="text-center px-4 py-3 text-park-gray-400 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => {
                  const badge = STATUS_BADGE[s.status] || STATUS_BADGE.PENDING;
                  return (
                    <tr key={s.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{s.paymentMethod}</td>
                      <td className="px-4 py-3 text-park-gray-500 text-xs">
                        {s.periodStart} — {s.periodEnd}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(s.expectedCents)}</td>
                      <td className="px-4 py-3 text-right">
                        {editingId === s.id ? (
                          <input type="number" step="0.01" value={receivedAmount}
                            onChange={(e) => setReceivedAmount(e.target.value)}
                            className="w-28 bg-park-gray-800 border border-park-gray-600 rounded px-2 py-1 text-right text-sm"
                            autoFocus
                          />
                        ) : (
                          formatCurrency(s.receivedCents)
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right ${
                        s.differenceCents && s.differenceCents !== 0 ? 'text-red-400' : ''
                      }`}>
                        {formatCurrency(s.differenceCents)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={badge.variant} dot>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.status === 'PENDING' && editingId !== s.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingId(s.id); setReceivedAmount(''); setNotes(''); }}
                          >
                            Registrar
                          </Button>
                        )}
                        {editingId === s.id && (
                          <div className="flex items-center gap-1 justify-center">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleReconcile(s.id)}
                              disabled={!receivedAmount}
                            >
                              Guardar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!isLoading && settlements.length === 0 && (
        <Card padding="none">
          <EmptyState
            icon={<Scale />}
            title="No hay liquidaciones"
            description="Selecciona un periodo y genera una liquidacion"
          />
        </Card>
      )}
    </div>
  );
}
