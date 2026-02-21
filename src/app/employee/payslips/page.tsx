'use client';

/**
 * Employee Payslips Page - My Payroll History
 *
 * Lists payroll records ordered by period. Each payslip shows period,
 * gross/net salary, and deductions summary. Click to expand full breakdown
 * with Peruvian payroll components (base, tips, commission, overtime,
 * EsSalud, pension, advances).
 */

import { useState } from 'react';
import useSWR from 'swr';
import {
  DollarSign,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Receipt,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Error al cargar');
  return r.json();
});

interface PayslipRecord {
  id: string;
  period_month: string;
  base_salary_cents: number;
  commission_cents: number;
  tips_cents: number;
  overtime_cents: number;
  bonuses_cents: number;
  advances_cents: number;
  absences_cents: number;
  other_deductions_cents: number;
  essalud_cents: number;
  pension_cents: number;
  gross_salary_cents: number;
  net_salary_cents: number;
  days_worked: number;
  hours_worked: number;
  overtime_hours: number;
  absences_count: number;
  payslip_url: string | null;
  calculated_at: string;
  paid_at: string | null;
}

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

function formatPeriod(periodMonth: string): string {
  const [year, month] = periodMonth.split('-').map(Number);
  const date = new Date(year, month - 1);
  const label = date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function PayslipsPage() {
  const { data, error, isLoading } = useSWR<PayslipRecord[]>(
    '/api/hr/me/payslips',
    fetcher,
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Mis Boletas de Pago</h2>
        <p className="text-zinc-400 text-sm mt-0.5">Historial de remuneraciones</p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-7 h-7 text-zinc-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center py-12 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-zinc-400 text-sm">No se pudo cargar las boletas</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && Array.isArray(data) && data.length === 0 && (
        <div className="text-center py-10">
          <Receipt className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No hay boletas de pago</p>
        </div>
      )}

      {/* Payslips List */}
      {!isLoading && !error && Array.isArray(data) && data.length > 0 && (
        <div className="space-y-3">
          {data
            .slice()
            .sort((a, b) => b.period_month.localeCompare(a.period_month))
            .map((payslip) => {
              const isExpanded = expandedId === payslip.id;
              const totalDeductions =
                payslip.advances_cents +
                payslip.absences_cents +
                payslip.other_deductions_cents +
                payslip.pension_cents;

              return (
                <div
                  key={payslip.id}
                  className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"
                >
                  {/* Summary row */}
                  <button
                    onClick={() => toggleExpand(payslip.id)}
                    className="w-full p-4 text-left flex items-center gap-3 hover:bg-zinc-800/50 transition-colors min-h-[72px]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{formatPeriod(payslip.period_month)}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-zinc-500">
                          Bruto: {formatCurrency(payslip.gross_salary_cents)}
                        </span>
                        {totalDeductions > 0 && (
                          <span className="text-xs text-red-400">
                            -{formatCurrency(totalDeductions)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-green-400">
                        {formatCurrency(payslip.net_salary_cents)}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {payslip.paid_at ? (
                          <span className="text-[10px] text-green-400">Pagado</span>
                        ) : (
                          <span className="text-[10px] text-amber-400">Pendiente</span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
                      {/* Earnings */}
                      <div>
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-green-400" />
                          Ingresos
                        </p>
                        <div className="space-y-1.5">
                          <DetailRow label="Sueldo Base" amount={payslip.base_salary_cents} />
                          {payslip.commission_cents > 0 && (
                            <DetailRow label="Comisiones" amount={payslip.commission_cents} />
                          )}
                          {payslip.tips_cents > 0 && (
                            <DetailRow label="Propinas" amount={payslip.tips_cents} />
                          )}
                          {payslip.overtime_cents > 0 && (
                            <DetailRow label="Horas Extra" amount={payslip.overtime_cents} />
                          )}
                          {payslip.bonuses_cents > 0 && (
                            <DetailRow label="Bonificaciones" amount={payslip.bonuses_cents} />
                          )}
                          <div className="border-t border-zinc-800 pt-1.5">
                            <DetailRow
                              label="Total Bruto"
                              amount={payslip.gross_salary_cents}
                              bold
                            />
                          </div>
                        </div>
                      </div>

                      {/* Deductions */}
                      <div>
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-red-400" />
                          Descuentos
                        </p>
                        <div className="space-y-1.5">
                          {payslip.pension_cents > 0 && (
                            <DetailRow label="Pension (ONP/AFP)" amount={-payslip.pension_cents} negative />
                          )}
                          {payslip.advances_cents > 0 && (
                            <DetailRow label="Adelantos" amount={-payslip.advances_cents} negative />
                          )}
                          {payslip.absences_cents > 0 && (
                            <DetailRow label="Ausencias" amount={-payslip.absences_cents} negative />
                          )}
                          {payslip.other_deductions_cents > 0 && (
                            <DetailRow label="Otros Descuentos" amount={-payslip.other_deductions_cents} negative />
                          )}
                        </div>
                      </div>

                      {/* Employer contributions (info only) */}
                      {payslip.essalud_cents > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Minus className="w-3 h-3 text-blue-400" />
                            Aportes del Empleador
                          </p>
                          <DetailRow label="EsSalud (9%)" amount={payslip.essalud_cents} info />
                        </div>
                      )}

                      {/* Net total */}
                      <div className="border-t border-zinc-700 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">Neto a Recibir</span>
                          <span className="text-lg font-bold text-green-400">
                            {formatCurrency(payslip.net_salary_cents)}
                          </span>
                        </div>
                      </div>

                      {/* Work summary */}
                      <div className="grid grid-cols-4 gap-2 pt-2">
                        <MiniStat label="Dias" value={payslip.days_worked} />
                        <MiniStat label="Horas" value={payslip.hours_worked} />
                        <MiniStat label="H. Extra" value={payslip.overtime_hours} />
                        <MiniStat label="Faltas" value={payslip.absences_count} />
                      </div>

                      {/* Download button */}
                      {payslip.payslip_url && (
                        <a
                          href={payslip.payslip_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-medium min-h-[44px]"
                        >
                          <Download className="w-4 h-4" />
                          Descargar Boleta
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  amount,
  bold = false,
  negative = false,
  info = false,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  negative?: boolean;
  info?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`${bold ? 'font-semibold' : 'text-zinc-400'}`}>{label}</span>
      <span
        className={`font-mono ${
          bold
            ? 'font-semibold'
            : negative
            ? 'text-red-400'
            : info
            ? 'text-blue-400 text-xs'
            : 'text-zinc-300'
        }`}
      >
        {formatCurrency(Math.abs(amount))}
        {negative && amount !== 0 ? '' : ''}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center bg-zinc-800/50 rounded-lg py-2">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[9px] text-zinc-500">{label}</p>
    </div>
  );
}
