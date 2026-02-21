'use client';

/**
 * Estado de Resultados (P&L) Page
 *
 * Profit & Loss report with export capabilities.
 *
 * @module app/admin/estado-resultados/page
 */

import { useState, useCallback } from 'react';
import { PieChart, Calendar, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { usePnLReport } from '@/src/hooks/useSWRHooks';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PieChart className="w-7 h-7 text-violet-400" />
            Estado de Resultados
          </h1>
          <p className="text-zinc-400 mt-1">Reporte de Pérdidas y Ganancias (P&L)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('xlsx')} disabled={!data}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm min-h-[40px] disabled:opacity-50">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => handleExport('pdf')} disabled={!data}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm min-h-[40px] disabled:opacity-50">
            PDF
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <Calendar className="w-4 h-4 text-zinc-400" />
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Desde</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[40px]" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Hasta</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[40px]" />
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al generar reporte.
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-xs text-zinc-500 uppercase">Ventas Netas</p>
              <p className="text-2xl font-bold mt-1 text-emerald-400">
                {formatCurrency(data.revenue.netSalesCents)}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-xs text-zinc-500 uppercase">Utilidad Bruta</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(data.grossProfit.grossProfitCents)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{data.grossProfit.grossMarginPercent}% margen</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-xs text-zinc-500 uppercase">Gastos Operativos</p>
              <p className="text-2xl font-bold mt-1 text-red-400">
                {formatCurrency(data.operatingExpenses.totalExpensesCents)}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-xs text-zinc-500 uppercase">Utilidad Neta</p>
              <p className={`text-2xl font-bold mt-1 flex items-center gap-1 ${
                data.netIncome.netIncomeCents >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {data.netIncome.netIncomeCents >= 0
                  ? <TrendingUp className="w-5 h-5" />
                  : <TrendingDown className="w-5 h-5" />}
                {formatCurrency(data.netIncome.netIncomeCents)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{data.netIncome.netMarginPercent}% margen</p>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {/* Revenue */}
                <tr className="bg-zinc-800/50">
                  <td className="px-4 py-3 font-bold" colSpan={2}>INGRESOS</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 pl-8 text-zinc-400">Ventas Brutas</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.revenue.grossSalesCents)}</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 pl-8 text-zinc-400">(-) Descuentos</td>
                  <td className="px-4 py-2 text-right text-red-400">{formatCurrency(-data.revenue.discountsCents)}</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 pl-8 text-zinc-400">(-) Devoluciones</td>
                  <td className="px-4 py-2 text-right text-red-400">{formatCurrency(-data.revenue.refundsCents)}</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 pl-8 text-zinc-400">(+) Tarifa Delivery</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.revenue.deliveryFeesCents)}</td>
                </tr>
                <tr className="border-b border-zinc-800 bg-zinc-800/30">
                  <td className="px-4 py-2 font-semibold">Ventas Netas</td>
                  <td className="px-4 py-2 text-right font-bold text-emerald-400">{formatCurrency(data.revenue.netSalesCents)}</td>
                </tr>

                {/* COGS */}
                <tr className="bg-zinc-800/50">
                  <td className="px-4 py-3 font-bold" colSpan={2}>COSTO DE VENTAS</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 pl-8 text-zinc-400">Compras Recibidas</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.cogs.purchasesCents)}</td>
                </tr>
                <tr className="border-b border-zinc-800 bg-zinc-800/30">
                  <td className="px-4 py-2 font-semibold">UTILIDAD BRUTA ({data.grossProfit.grossMarginPercent}%)</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(data.grossProfit.grossProfitCents)}</td>
                </tr>

                {/* Operating Expenses */}
                <tr className="bg-zinc-800/50">
                  <td className="px-4 py-3 font-bold" colSpan={2}>GASTOS OPERATIVOS</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 pl-8 text-zinc-400">Nómina</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.operatingExpenses.payrollCents)}</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 pl-8 text-zinc-400">Caja Chica</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.operatingExpenses.pettyCashExpensesCents)}</td>
                </tr>
                {data.operatingExpenses.byCategory.map((cat) => (
                  <tr key={cat.category} className="border-b border-zinc-800/50">
                    <td className="px-4 py-2 pl-12 text-zinc-500">{cat.category}</td>
                    <td className="px-4 py-2 text-right text-zinc-500">{formatCurrency(cat.amountCents)}</td>
                  </tr>
                ))}
                <tr className="border-b border-zinc-800 bg-zinc-800/30">
                  <td className="px-4 py-2 font-semibold">Total Gastos</td>
                  <td className="px-4 py-2 text-right font-bold text-red-400">{formatCurrency(data.operatingExpenses.totalExpensesCents)}</td>
                </tr>

                {/* Net Income */}
                <tr className="bg-zinc-800">
                  <td className="px-4 py-3 font-bold text-lg">UTILIDAD NETA ({data.netIncome.netMarginPercent}%)</td>
                  <td className={`px-4 py-3 text-right font-bold text-lg ${
                    data.netIncome.netIncomeCents >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(data.netIncome.netIncomeCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Order Count */}
          <div className="text-sm text-zinc-500 text-center">
            Basado en {data.revenue.ordersCount} órdenes · Período: {data.period.start} a {data.period.end}
          </div>
        </>
      )}
    </div>
  );
}
