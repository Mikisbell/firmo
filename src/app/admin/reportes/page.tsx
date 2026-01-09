'use client';

/**
 * Sales Reports Page
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Download, TrendingUp, CreditCard, Banknote, Percent } from 'lucide-react';

interface ReportData {
  period: string;
  sales_net: number;
  discounts: number;
  tips: number;
  order_count: number;
  by_payment_method: { method: string; total: number }[];
}

type Period = 'daily' | 'weekly' | 'monthly';

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('daily');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/reports?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch');
      setReport(await res.json());
      setError(null);
    } catch {
      setError('Error al cargar reporte');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const formatCurrency = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  const exportCSV = () => {
    if (!report) return;
    const rows = [
      ['Métrica', 'Valor'],
      ['Ventas Netas', formatCurrency(report.sales_net)],
      ['Descuentos', formatCurrency(report.discounts)],
      ['Propinas', formatCurrency(report.tips)],
      ['Órdenes', report.order_count.toString()],
      ...report.by_payment_method.map((m) => [m.method, formatCurrency(m.total)]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-zinc-400 mt-1">Estadísticas de ventas</p>
        </div>
        <button onClick={exportCSV} disabled={!report} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors min-h-[44px] disabled:opacity-50">
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-lg transition-colors min-h-[44px] ${period === p ? 'bg-amber-500 text-black' : 'bg-zinc-800 hover:bg-zinc-700'}`}>
            <Calendar className="w-4 h-4 inline mr-2" />
            {p === 'daily' ? 'Diario' : p === 'weekly' ? 'Semanal' : 'Mensual'}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" /></div>
      ) : report && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={TrendingUp} label="Ventas Netas" value={formatCurrency(report.sales_net)} color="text-green-400" />
            <StatCard icon={Percent} label="Descuentos" value={formatCurrency(report.discounts)} color="text-red-400" />
            <StatCard icon={Banknote} label="Propinas" value={formatCurrency(report.tips)} color="text-amber-400" />
            <StatCard icon={CreditCard} label="Órdenes" value={report.order_count.toString()} color="text-blue-400" />
          </div>

          {/* Payment methods breakdown */}
          <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <h2 className="font-medium mb-4">Por Método de Pago</h2>
            <div className="space-y-2">
              {report.by_payment_method.map((m) => (
                <div key={m.method} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-zinc-400">{m.method}</span>
                  <span className="font-medium">{formatCurrency(m.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
