'use client';

/**
 * Payslip Print Page — Boleta de Pago
 *
 * Printable payslip with @media print styles.
 * Query params: ?employee_id=uuid&month=2026-04
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';

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

interface EmployeeInfo {
  id: string;
  full_name: string;
  dni: string | null;
  role: string;
}

function fmt(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function PayslipRow({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <tr className={bold ? 'font-bold' : ''}>
      <td className="py-1 pr-4">{label}</td>
      <td className={`py-1 text-right font-mono ${negative ? 'text-red-700' : ''}`}>{value}</td>
    </tr>
  );
}

export default function PayslipPrintPage() {
  const searchParams = useSearchParams();
  const employeeId = searchParams.get('employee_id');
  const month = searchParams.get('month');

  const [payroll, setPayroll] = useState<PayrollRecord | null>(null);
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [tenantName, setTenantName] = useState<string>('Restaurante');
  const [tenantRuc, setTenantRuc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId || !month) {
      setError('Parametros faltantes: employee_id y month son requeridos');
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [payrollRes, employeeRes, configRes] = await Promise.all([
          fetch(`/api/hr/payroll/period/${month}`, { credentials: 'include' }),
          fetch(`/api/hr/employees/${employeeId}`, { credentials: 'include' }),
          fetch('/api/admin/config', { credentials: 'include' }),
        ]);

        if (payrollRes.ok) {
          const records: PayrollRecord[] = await payrollRes.json();
          const record = records.find((r) => r.employee_id === employeeId);
          setPayroll(record || null);
          if (!record) setError('No se encontro registro de planilla para este empleado');
        } else {
          setError('Error al cargar planilla');
        }

        if (employeeRes.ok) {
          const empData = await employeeRes.json();
          setEmployee(empData);
        }

        if (configRes.ok) {
          const config = await configRes.json();
          setTenantName(config.legal_name || 'Restaurante');
          setTenantRuc(config.ruc || null);
        }
      } catch {
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [employeeId, month]);

  useEffect(() => {
    if (payroll && !loading) {
      const timer = setTimeout(() => window.print(), 1000);
      return () => clearTimeout(timer);
    }
  }, [payroll, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando boleta...</p>
      </div>
    );
  }

  if (error || !payroll) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error || 'No se encontraron datos'}</p>
      </div>
    );
  }

  const periodLabel = month
    ? new Date(`${month}-01`).toLocaleDateString('es-PE', { year: 'numeric', month: 'long' })
    : payroll.period_month;

  return (
    <>
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-page { padding: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="print-page max-w-2xl mx-auto p-8 bg-white text-black min-h-screen">
        {/* Print Button */}
        <div className="no-print mb-6">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold">{tenantName}</h1>
          {tenantRuc && <p className="text-sm">RUC: {tenantRuc}</p>}
          <p className="text-lg font-bold mt-3">BOLETA DE PAGO</p>
          <p className="text-sm">Periodo: {periodLabel}</p>
        </div>

        {/* Employee Info */}
        <section className="mb-6 border border-gray-300 rounded p-4">
          <h2 className="font-bold text-sm mb-2 border-b border-gray-200 pb-1">DATOS DEL TRABAJADOR</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Nombre: </span>
              <span className="font-medium">{employee?.full_name || `Empleado ${employeeId?.slice(0, 8)}`}</span>
            </div>
            <div>
              <span className="text-gray-600">DNI: </span>
              <span className="font-medium">{employee?.dni || '—'}</span>
            </div>
            <div>
              <span className="text-gray-600">Cargo: </span>
              <span className="font-medium">{employee?.role || '—'}</span>
            </div>
            <div>
              <span className="text-gray-600">Dias Trabajados: </span>
              <span className="font-medium">{payroll.days_worked}</span>
            </div>
          </div>
        </section>

        {/* Ingresos */}
        <section className="mb-6">
          <h2 className="font-bold text-sm border-b border-gray-300 pb-1 mb-2">INGRESOS</h2>
          <table className="w-full text-sm">
            <tbody>
              <PayslipRow label="Sueldo Base" value={fmt(payroll.base_salary_cents)} />
              {payroll.commission_cents > 0 && (
                <PayslipRow label="Comisiones" value={fmt(payroll.commission_cents)} />
              )}
              {payroll.tips_cents > 0 && (
                <PayslipRow label="Propinas" value={fmt(payroll.tips_cents)} />
              )}
              {payroll.overtime_cents > 0 && (
                <PayslipRow label={`Horas Extra (${payroll.overtime_hours}h)`} value={fmt(payroll.overtime_cents)} />
              )}
              {payroll.bonuses_cents > 0 && (
                <PayslipRow label="Bonificaciones" value={fmt(payroll.bonuses_cents)} />
              )}
              <tr><td colSpan={2}><hr className="my-1 border-gray-300" /></td></tr>
              <PayslipRow label="TOTAL INGRESOS (Bruto)" value={fmt(payroll.gross_salary_cents)} bold />
            </tbody>
          </table>
        </section>

        {/* Deducciones */}
        <section className="mb-6">
          <h2 className="font-bold text-sm border-b border-gray-300 pb-1 mb-2">DEDUCCIONES</h2>
          <table className="w-full text-sm">
            <tbody>
              {payroll.pension_cents > 0 && (
                <PayslipRow label="Pension (AFP/ONP)" value={fmt(payroll.pension_cents)} negative />
              )}
              {payroll.essalud_cents > 0 && (
                <PayslipRow label="EsSalud" value={fmt(payroll.essalud_cents)} negative />
              )}
              {payroll.advances_cents > 0 && (
                <PayslipRow label="Adelantos" value={fmt(payroll.advances_cents)} negative />
              )}
              {payroll.absences_cents > 0 && (
                <PayslipRow label={`Faltas (${payroll.absences_count})`} value={fmt(payroll.absences_cents)} negative />
              )}
              <tr><td colSpan={2}><hr className="my-1 border-gray-300" /></td></tr>
              <PayslipRow
                label="TOTAL DEDUCCIONES"
                value={fmt(payroll.essalud_cents + payroll.pension_cents + payroll.advances_cents + payroll.absences_cents)}
                bold
              />
            </tbody>
          </table>
        </section>

        {/* Neto */}
        <section className="mb-6 bg-gray-100 p-4 rounded">
          <table className="w-full">
            <tbody>
              <tr className="font-bold text-lg">
                <td>SUELDO NETO A PAGAR</td>
                <td className="text-right font-mono">{fmt(payroll.net_salary_cents)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Signature Lines */}
        <div className="mt-16 pt-8">
          <div className="flex justify-between">
            <div className="text-center w-48">
              <div className="border-t border-black pt-2">
                <p className="text-sm font-medium">Empleador</p>
              </div>
            </div>
            <div className="text-center w-48">
              <div className="border-t border-black pt-2">
                <p className="text-sm font-medium">Empleado</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8">
          <p>Generado por FIRMO POS — {new Date().toLocaleString('es-PE')}</p>
        </div>
      </div>
    </>
  );
}
