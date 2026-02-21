'use client';

/**
 * Conciliación de Pagos Page
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400', icon: Clock },
  MATCHED: { label: 'Conciliado', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle },
  DISCREPANCY: { label: 'Discrepancia', color: 'bg-red-500/20 text-red-400', icon: AlertTriangle },
};

function formatCurrency(cents: number | null) {
  if (cents === null) return '—';
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
      toast.success('Liquidación actualizada');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-7 h-7 text-cyan-400" />
            Conciliación de Pagos
          </h1>
          <p className="text-zinc-400 mt-1">Control de liquidaciones por método de pago</p>
        </div>
        <button onClick={handleExport} disabled={!settlements.length}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm min-h-[40px] disabled:opacity-50">
          <Download className="w-4 h-4" /> Excel
        </button>
      </div>

      {/* Generate Period */}
      <div className="flex flex-wrap items-end gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <div>
            <label className="text-xs text-zinc-500">Desde</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="block bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[40px]" />
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Hasta</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="block bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[40px]" />
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium min-h-[40px] disabled:opacity-50">
          {generating ? 'Generando...' : 'Generar Liquidación'}
        </button>
        <div>
          <label className="text-xs text-zinc-500">Filtrar</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="block bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[40px]">
            <option value="">Todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="MATCHED">Conciliado</option>
            <option value="DISCREPANCY">Discrepancia</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {settlements.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-xs text-zinc-500 uppercase">Total Esperado</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalExpected)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-xs text-zinc-500 uppercase">Total Recibido</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{formatCurrency(totalReceived)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-xs text-zinc-500 uppercase">Diferencia</p>
            <p className={`text-2xl font-bold mt-1 ${
              totalExpected - totalReceived === 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {formatCurrency(totalExpected - totalReceived)}
            </p>
          </div>
        </div>
      )}

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al cargar liquidaciones.
        </div>
      )}

      {/* Settlements Table */}
      {settlements.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-zinc-400">Método</th>
                  <th className="text-left px-4 py-3 text-zinc-400">Período</th>
                  <th className="text-right px-4 py-3 text-zinc-400">Esperado</th>
                  <th className="text-right px-4 py-3 text-zinc-400">Recibido</th>
                  <th className="text-right px-4 py-3 text-zinc-400">Diferencia</th>
                  <th className="text-center px-4 py-3 text-zinc-400">Estado</th>
                  <th className="text-center px-4 py-3 text-zinc-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => {
                  const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.PENDING;
                  const Icon = cfg.icon;
                  return (
                    <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/50">
                      <td className="px-4 py-3 font-medium">{s.paymentMethod}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">
                        {s.periodStart} — {s.periodEnd}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(s.expectedCents)}</td>
                      <td className="px-4 py-3 text-right">
                        {editingId === s.id ? (
                          <input type="number" step="0.01" value={receivedAmount}
                            onChange={(e) => setReceivedAmount(e.target.value)}
                            className="w-28 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-right text-sm"
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
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.status === 'PENDING' && editingId !== s.id && (
                          <button onClick={() => { setEditingId(s.id); setReceivedAmount(''); setNotes(''); }}
                            className="text-xs text-cyan-400 hover:text-cyan-300">
                            Registrar
                          </button>
                        )}
                        {editingId === s.id && (
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={() => handleReconcile(s.id)}
                              disabled={!receivedAmount}
                              className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                              Guardar
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="text-xs text-zinc-500 hover:text-zinc-400 ml-1">
                              Cancelar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && settlements.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <Scale className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No hay liquidaciones</p>
          <p className="text-zinc-500 text-sm mt-1">Selecciona un período y genera una liquidación</p>
        </div>
      )}
    </div>
  );
}
