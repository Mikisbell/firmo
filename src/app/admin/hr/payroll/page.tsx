'use client';

/**
 * Payroll Management Page - Gestión de Planilla
 * Calculate and view monthly payroll for all employees.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { DollarSign, Calculator, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, PageHeader, MetricCard, EmptyState } from '@/src/components/ui';

interface PayrollRecord {
  id: string;
  employee_id: string;
  period_month: string;
  base_salary_cents: number;
  commission_cents: number;
  tips_cents: number;
  overtime_cents: number;
  bonuses_cents: number;
  advances_cents: number;
  absences_cents: number;
  essalud_cents: number;
  pension_cents: number;
  gross_salary_cents: number;
  net_salary_cents: number;
  days_worked: number;
  overtime_hours: number;
  absences_count: number;
}

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar datos');
  return r.json();
});

export default function PayrollPage() {
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [calculating, setCalculating] = useState(false);

  const { data: records, error, isLoading, mutate } = useSWR<PayrollRecord[]>(
    `/api/hr/payroll/period/${periodMonth}`,
    fetcher
  );

  async function handleCalculate() {
    setCalculating(true);
    try {
      const res = await fetch('/api/hr/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_month: periodMonth }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al calcular planilla');
      }
      toast.success('Planilla calculada exitosamente');
      mutate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCalculating(false);
    }
  }

  const totalGross = records?.reduce((sum, r) => sum + r.gross_salary_cents, 0) ?? 0;
  const totalNet = records?.reduce((sum, r) => sum + r.net_salary_cents, 0) ?? 0;

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-park-gray-800 rounded-xl animate-pulse" />
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
        title="Planilla"
        description="Cálculo y gestión de planilla mensual"
        actions={
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              className="bg-park-gray-800 border border-park-gray-700 text-white rounded-lg px-3 py-2 text-sm"
            />
            <Button
              variant="primary"
              icon={<Calculator className="w-4 h-4" />}
              onClick={handleCalculate}
              loading={calculating}
              disabled={calculating}
            >
              {calculating ? 'Calculando...' : 'Calcular Planilla'}
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Total Empleados"
          value={records?.length ?? 0}
        />
        <MetricCard
          label="Total Bruto"
          value={totalGross}
          format="currency"
        />
        <MetricCard
          label="Total Neto"
          value={totalNet}
          format="currency"
        />
      </div>

      {/* Payroll Table */}
      <Card padding="none">
        {error ? (
          <EmptyState
            icon={<AlertTriangle />}
            title="Error al cargar planilla"
            description="No se pudieron cargar los datos. Intente nuevamente."
          />
        ) : !records?.length ? (
          <EmptyState
            icon={<DollarSign />}
            title="Sin registros de planilla"
            description='No hay registros de planilla para este período. Haz clic en "Calcular Planilla" para generar.'
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Empleado</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Base</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Comisión</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Propinas</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">H.Extra</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Bruto</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">EsSalud</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Pensión</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Adelantos</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium font-bold">Neto</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-white">{r.employee_id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-right text-park-gray-300">{formatCurrency(r.base_salary_cents)}</td>
                    <td className="px-4 py-3 text-right text-park-gray-300">{formatCurrency(r.commission_cents)}</td>
                    <td className="px-4 py-3 text-right text-park-gray-300">{formatCurrency(r.tips_cents)}</td>
                    <td className="px-4 py-3 text-right text-park-gray-300">{formatCurrency(r.overtime_cents)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(r.gross_salary_cents)}</td>
                    <td className="px-4 py-3 text-right text-orange-400">{formatCurrency(r.essalud_cents)}</td>
                    <td className="px-4 py-3 text-right text-orange-400">{formatCurrency(r.pension_cents)}</td>
                    <td className="px-4 py-3 text-right text-red-400">{formatCurrency(r.advances_cents)}</td>
                    <td className="px-4 py-3 text-right text-blue-400 font-bold">{formatCurrency(r.net_salary_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
