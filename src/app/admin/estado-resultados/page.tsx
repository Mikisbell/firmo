'use client';

/**
 * Estado de Resultados (P&L) Page
 *
 * Profit & Loss report with export capabilities.
 *
 * @module app/admin/estado-resultados/page
 */

import { useState, useCallback } from 'react';
import { Download, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { usePnLReport } from '@/src/hooks/useSWRHooks';
import { Button, Card, PageHeader, MetricCard } from '@/src/components/ui';

function formatCurrency(cents: number) {
  const abs = Math.abs(cents);
  const formatted = `S/ ${(abs / 100).toFixed(2)}`;
  return cents < 0 ? `-${formatted}` : formatted;
}

function getDefaultPeriod() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  };
}

export default function EstadoResultadosPage() {
  const defaults = getDefaultPeriod();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  const { data, error, isLoading } = usePnLReport(
    startDate && endDate ? { start: startDate, end: endDate } : null,
  );

  const handleExport = useCallback(async (format: 'xlsx' | 'csv' | 'pdf') => {
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate, format });
      const res = await fetch(`/api/admin/pnl/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error');

      if (format === 'pdf') {
        const html = await res.text();
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); }
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `estado-resultados-${startDate}-${endDate}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Exportado como ${format.toUpperCase()}`);
    } catch {
      toast.error('Error al exportar');
    }
  }, [startDate, endDate]);

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
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Estado de Resultados (P&L)"
        description="Reporte de Perdidas y Ganancias"
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<Download size={16} />}
              onClick={() => handleExport('xlsx')}
              disabled={!data}
            >
              Excel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleExport('pdf')}
              disabled={!data}
            >
              PDF
            </Button>
          </div>
        }
      />

      {/* Date Filter */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Calendar className="w-4 h-4 text-park-gray-400" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-park-gray-400">Desde</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px]" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-park-gray-400">Hasta</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px]" />
          </div>
        </div>
      </Card>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al generar reporte.
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Ventas Netas"
              value={formatCurrency(data.revenue.netSalesCents)}
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            />
            <MetricCard
              label="Utilidad Bruta"
              value={`${formatCurrency(data.grossProfit.grossProfitCents)} (${data.grossProfit.grossMarginPercent}%)`}
            />
            <MetricCard
              label="Gastos Operativos"
              value={formatCurrency(data.operatingExpenses.totalExpensesCents)}
              className="[&_p:last-child]:text-red-400"
            />
            <MetricCard
              label="Utilidad Neta"
              value={`${formatCurrency(data.netIncome.netIncomeCents)} (${data.netIncome.netMarginPercent}%)`}
              icon={data.netIncome.netIncomeCents >= 0
                ? <TrendingUp className="w-5 h-5 text-emerald-400" />
                : <TrendingDown className="w-5 h-5 text-red-400" />}
              className={data.netIncome.netIncomeCents >= 0 ? '[&_p:last-child]:text-emerald-400' : '[&_p:last-child]:text-red-400'}
            />
          </div>

          {/* Detailed Breakdown */}
          <Card padding="none">
            <table className="w-full text-sm">
              <tbody>
                {/* Revenue */}
                <tr className="bg-park-gray-800/50">
                  <td className="px-4 py-3 font-bold" colSpan={2}>INGRESOS</td>
                </tr>
                <tr className="border-b border-park-gray-800/50">
                  <td className="px-4 py-2 pl-8 text-park-gray-400">Ventas Brutas</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.revenue.grossSalesCents)}</td>
                </tr>
                <tr className="border-b border-park-gray-800/50">
                  <td className="px-4 py-2 pl-8 text-park-gray-400">(-) Descuentos</td>
                  <td className="px-4 py-2 text-right text-red-400">{formatCurrency(-data.revenue.discountsCents)}</td>
                </tr>
                <tr className="border-b border-park-gray-800/50">
                  <td className="px-4 py-2 pl-8 text-park-gray-400">(-) Devoluciones</td>
                  <td className="px-4 py-2 text-right text-red-400">{formatCurrency(-data.revenue.refundsCents)}</td>
                </tr>
                <tr className="border-b border-park-gray-800/50">
                  <td className="px-4 py-2 pl-8 text-park-gray-400">(+) Tarifa Delivery</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.revenue.deliveryFeesCents)}</td>
                </tr>
                <tr className="border-b border-park-gray-800 bg-park-gray-800/30">
                  <td className="px-4 py-2 font-semibold">Ventas Netas</td>
                  <td className="px-4 py-2 text-right font-bold text-emerald-400">{formatCurrency(data.revenue.netSalesCents)}</td>
                </tr>

                {/* COGS */}
                <tr className="bg-park-gray-800/50">
                  <td className="px-4 py-3 font-bold" colSpan={2}>COSTO DE VENTAS</td>
                </tr>
                <tr className="border-b border-park-gray-800/50">
                  <td className="px-4 py-2 pl-8 text-park-gray-400">Compras Recibidas</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.cogs.purchasesCents)}</td>
                </tr>
                <tr className="border-b border-park-gray-800 bg-park-gray-800/30">
                  <td className="px-4 py-2 font-semibold">UTILIDAD BRUTA ({data.grossProfit.grossMarginPercent}%)</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(data.grossProfit.grossProfitCents)}</td>
                </tr>

                {/* Operating Expenses */}
                <tr className="bg-park-gray-800/50">
                  <td className="px-4 py-3 font-bold" colSpan={2}>GASTOS OPERATIVOS</td>
                </tr>
                <tr className="border-b border-park-gray-800/50">
                  <td className="px-4 py-2 pl-8 text-park-gray-400">Nomina</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.operatingExpenses.payrollCents)}</td>
                </tr>
                <tr className="border-b border-park-gray-800/50">
                  <td className="px-4 py-2 pl-8 text-park-gray-400">Caja Chica</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.operatingExpenses.pettyCashExpensesCents)}</td>
                </tr>
                {data.operatingExpenses.byCategory.map((cat) => (
                  <tr key={cat.category} className="border-b border-park-gray-800/50">
                    <td className="px-4 py-2 pl-12 text-park-gray-500">{cat.category}</td>
                    <td className="px-4 py-2 text-right text-park-gray-500">{formatCurrency(cat.amountCents)}</td>
                  </tr>
                ))}
                <tr className="border-b border-park-gray-800 bg-park-gray-800/30">
                  <td className="px-4 py-2 font-semibold">Total Gastos</td>
                  <td className="px-4 py-2 text-right font-bold text-red-400">{formatCurrency(data.operatingExpenses.totalExpensesCents)}</td>
                </tr>

                {/* Net Income */}
                <tr className="bg-park-gray-800">
                  <td className="px-4 py-3 font-bold text-lg">UTILIDAD NETA ({data.netIncome.netMarginPercent}%)</td>
                  <td className={`px-4 py-3 text-right font-bold text-lg ${
                    data.netIncome.netIncomeCents >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(data.netIncome.netIncomeCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Order Count */}
          <div className="text-sm text-park-gray-500 text-center">
            Basado en {data.revenue.ordersCount} ordenes - Periodo: {data.period.start} a {data.period.end}
          </div>
        </>
      )}
    </div>
  );
}
