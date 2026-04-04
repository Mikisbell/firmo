'use client';

/**
 * Sales Reports Page
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { useState } from 'react';
import { Calendar, Download, TrendingUp, CreditCard, Banknote, Percent } from 'lucide-react';
import { useAdminReports } from '@/src/hooks/useSWRHooks';
import { Button, Card, PageHeader, MetricCard } from '@/src/components/ui';

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
  
  // Migrado a SWR - deduplicación automática, revalidación inteligente
  const { data: report, error, isLoading: loading } = useAdminReports(period);

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
      <PageHeader
        title="Reportes"
        description="Estadísticas de ventas"
        actions={
          <Button
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
            onClick={exportCSV}
            disabled={!report}
          >
            Exportar CSV
          </Button>
        }
      />

      {/* Period selector */}
      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? 'primary' : 'secondary'}
            icon={<Calendar className="w-4 h-4" />}
            onClick={() => setPeriod(p)}
          >
            {p === 'daily' ? 'Diario' : p === 'weekly' ? 'Semanal' : 'Mensual'}
          </Button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error.message || 'Error al cargar reporte'}</div>}

      {loading ? (
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-park-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : report && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Ventas Netas" value={formatCurrency(report.sales_net)} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Descuentos" value={formatCurrency(report.discounts)} icon={<Percent className="w-5 h-5" />} />
            <MetricCard label="Propinas" value={formatCurrency(report.tips)} icon={<Banknote className="w-5 h-5" />} />
            <MetricCard label="Órdenes" value={report.order_count.toString()} icon={<CreditCard className="w-5 h-5" />} />
          </div>

          {/* Payment methods breakdown */}
          <Card>
            <h2 className="font-medium mb-4 text-white">Por Método de Pago</h2>
            <div className="space-y-2">
              {report.by_payment_method.map((m) => (
                <div key={m.method} className="flex justify-between items-center py-2 border-b border-park-gray-800 last:border-0" data-testid="order-row">
                  <span className="text-park-gray-400" data-testid="order-id">{m.method}</span>
                  <span className="font-medium text-white">{formatCurrency(m.total)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
