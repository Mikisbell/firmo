'use client';

/**
 * Ranking Mozos Page
 *
 * Displays waiter performance metrics with sorting, date range filter,
 * export (XLSX/CSV/PDF), and a top-10 bar chart.
 *
 * @module app/admin/ranking-mozos/page
 */

import { useState, useCallback } from 'react';
import { Award, Calendar, ArrowUpDown, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { useWaiterRanking } from '@/src/hooks/useSWRHooks';
import type { RankingSortField } from '@/src/core/types/waiter-ranking';
import { Button, Card, PageHeader, MetricCard, EmptyState } from '@/src/components/ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const SORT_OPTIONS: { value: RankingSortField; label: string }[] = [
  { value: 'sales', label: 'Ventas' },
  { value: 'orders', label: 'Ordenes' },
  { value: 'tips', label: 'Propinas' },
  { value: 'avg_ticket', label: 'Ticket Promedio' },
  { value: 'avg_time', label: 'Tiempo Promedio' },
];

const CHART_COLORS = [
  '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
];

function formatCurrency(cents: number) {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function RankingMozosPage() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [sort, setSort] = useState<RankingSortField>('sales');
  const [exporting, setExporting] = useState(false);

  const { data, error, isLoading } = useWaiterRanking(
    startDate && endDate ? { start: startDate, end: endDate, sort } : null,
  );

  const handleExport = useCallback(async (format: 'xlsx' | 'csv' | 'pdf') => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        sort,
        format,
      });
      const res = await fetch(`/api/admin/waiter-ranking/export?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al exportar');

      if (format === 'pdf') {
        const html = await res.text();
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
        }
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ranking-mozos-${startDate}-${endDate}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Exportado como ${format.toUpperCase()}`);
    } catch {
      toast.error('Error al exportar ranking');
    } finally {
      setExporting(false);
    }
  }, [startDate, endDate, sort]);

  const chartData = data?.rankings.slice(0, 10).map((r) => ({
    name: r.employeeName.length > 12
      ? r.employeeName.slice(0, 12) + '...'
      : r.employeeName,
    ventas: r.totalSalesCents / 100,
    ordenes: r.totalOrders,
  })) ?? [];

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><div className="h-16 bg-park-gray-800 rounded animate-pulse" /></Card>
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
      <PageHeader
        title="Ranking Mozos"
        description="Rendimiento de mozos por periodo"
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<FileSpreadsheet size={16} />}
              onClick={() => handleExport('xlsx')}
              disabled={exporting || !data}
            >
              Excel
            </Button>
            <Button
              variant="secondary"
              icon={<FileDown size={16} />}
              onClick={() => handleExport('csv')}
              disabled={exporting || !data}
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              icon={<FileText size={16} />}
              onClick={() => handleExport('pdf')}
              disabled={exporting || !data}
            >
              PDF
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-park-gray-400" />
            <label className="text-sm text-park-gray-400">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-park-gray-400">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-park-gray-400" />
            <label className="text-sm text-park-gray-400">Ordenar por</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as RankingSortField)}
              className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px]"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Mozos" value={data.summary.totalWaiters} />
          <MetricCard label="Total Ordenes" value={data.summary.totalOrdersAll} />
          <MetricCard
            label="Total Ventas"
            value={data.summary.totalSalesAllCents}
            format="currency"
          />
          <MetricCard
            label="Mejor Mozo"
            value={data.summary.bestPerformerName || '\u2014'}
            icon={<Award className="w-5 h-5 text-amber-400" />}
          />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al cargar ranking. Intenta de nuevo.
        </div>
      )}

      {/* Chart - Top 10 */}
      {data && chartData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">Top 10 Mozos por Ventas</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} tickFormatter={(v) => `S/ ${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                labelStyle={{ color: '#fafafa' }}
                formatter={(value: number | undefined) => [`S/ ${(value ?? 0).toFixed(2)}`, 'Ventas']}
              />
              <Bar dataKey="ventas" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      {data && data.rankings.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Mozo</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Ordenes</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Ventas</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Ticket Prom.</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Propinas</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Tiempo Prom.</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Salon</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Llevar</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Delivery</th>
                </tr>
              </thead>
              <tbody>
                {data.rankings.map((r, i) => (
                  <tr
                    key={r.employeeId}
                    className={`border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors ${
                      i === 0 ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono">
                      {i === 0 ? (
                        <span className="text-amber-400 font-bold">1</span>
                      ) : (
                        i + 1
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{r.employeeName}</td>
                    <td className="px-4 py-3 text-right">{r.totalOrders}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                      {formatCurrency(r.totalSalesCents)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(r.averageTicketCents)}</td>
                    <td className="px-4 py-3 text-right text-amber-400">
                      {formatCurrency(r.totalTipsCents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.averageServiceMinutes} min
                    </td>
                    <td className="px-4 py-3 text-right">{r.ordersByType.DINE_IN}</td>
                    <td className="px-4 py-3 text-right">{r.ordersByType.TAKEOUT}</td>
                    <td className="px-4 py-3 text-right">{r.ordersByType.DELIVERY}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {data && data.rankings.length === 0 && (
        <Card padding="none">
          <EmptyState
            icon={<Award />}
            title="No hay datos para el periodo seleccionado"
            description="Ajusta las fechas o verifica que haya ordenes con mozo asignado"
          />
        </Card>
      )}
    </div>
  );
}
