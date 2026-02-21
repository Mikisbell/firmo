'use client';

/**
 * Payroll Management Page - Gestión de Planilla
 * Calculate and view monthly payroll for all employees.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { DollarSign, Calculator, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planilla</h1>
          <p className="text-zinc-400 text-sm">Cálculo y gestión de planilla mensual</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Calculator className="w-4 h-4" />
            {calculating ? 'Calculando...' : 'Calcular Planilla'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Total Empleados</p>
          <p className="text-2xl font-bold text-white">{records?.length ?? 0}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Total Bruto</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalGross)}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-400 text-sm">Total Neto</p>
          <p className="text-2xl font-bold text-blue-400">{formatCurrency(totalNet)}</p>
        </div>
      </div>

      {/* Payroll Table */}
      {isLoading ? (
        <div className="text-zinc-400 text-center py-12">Cargando...</div>
      ) : error ? (
        <div className="text-red-400 text-center py-12 flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Error al cargar planilla
        </div>
      ) : !records?.length ? (
        <div className="text-zinc-500 text-center py-12">
          No hay registros de planilla para este período. Haz clic en &quot;Calcular Planilla&quot; para generar.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-400 text-left">
                <th className="py-3 px-4">Empleado</th>
                <th className="py-3 px-4 text-right">Base</th>
                <th className="py-3 px-4 text-right">Comisión</th>
                <th className="py-3 px-4 text-right">Propinas</th>
                <th className="py-3 px-4 text-right">H.Extra</th>
                <th className="py-3 px-4 text-right">Bruto</th>
                <th className="py-3 px-4 text-right">EsSalud</th>
                <th className="py-3 px-4 text-right">Pensión</th>
                <th className="py-3 px-4 text-right">Adelantos</th>
                <th className="py-3 px-4 text-right font-bold">Neto</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                  <td className="py-3 px-4 text-white">{r.employee_id.slice(0, 8)}...</td>
                  <td className="py-3 px-4 text-right text-zinc-300">{formatCurrency(r.base_salary_cents)}</td>
                  <td className="py-3 px-4 text-right text-zinc-300">{formatCurrency(r.commission_cents)}</td>
                  <td className="py-3 px-4 text-right text-zinc-300">{formatCurrency(r.tips_cents)}</td>
                  <td className="py-3 px-4 text-right text-zinc-300">{formatCurrency(r.overtime_cents)}</td>
                  <td className="py-3 px-4 text-right text-emerald-400">{formatCurrency(r.gross_salary_cents)}</td>
                  <td className="py-3 px-4 text-right text-orange-400">{formatCurrency(r.essalud_cents)}</td>
                  <td className="py-3 px-4 text-right text-orange-400">{formatCurrency(r.pension_cents)}</td>
                  <td className="py-3 px-4 text-right text-red-400">{formatCurrency(r.advances_cents)}</td>
                  <td className="py-3 px-4 text-right text-blue-400 font-bold">{formatCurrency(r.net_salary_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
