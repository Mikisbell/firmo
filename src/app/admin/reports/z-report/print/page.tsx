'use client';

/**
 * Z-Report Print Page
 *
 * Printable Z-report with @media print styles.
 * Query param: ?shift_id=uuid
 * Auto-calls window.print() after data loads.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';

interface ZReportData {
  id: string;
  reportType: string;
  reportNumber: number;
  grossSalesCents: number;
  netSalesCents: number;
  discountCents: number;
  voidsCents: number;
  refundsCents: number;
  tipsCents: number;
  gravadoBaseCents: number;
  gravadoIgvCents: number;
  exoneradoCents: number;
  inafectoCents: number;
  boletasCount: number;
  boletasTotalCents: number;
  facturasCount: number;
  facturasTotalCents: number;
  voidedInvoicesCount: number;
  creditNotesCount: number;
  paymentsBreakdown: Record<string, { count: number; totalCents: number }>;
  cashOpeningCents: number;
  cashExpectedCents: number;
  cashCountedCents: number | null;
  cashDiffCents: number | null;
  ordersCount: number;
  generatedBy: string;
  generatedAt: string;
  terminalId: string;
}

interface TenantInfo {
  legal_name: string;
  ruc: string | null;
  address_text: string | null;
}

function fmt(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function PrintRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className={bold ? 'font-bold' : ''}>
      <td className="py-1 pr-4">{label}</td>
      <td className="py-1 text-right font-mono">{value}</td>
    </tr>
  );
}

export default function ZReportPrintPage() {
  const searchParams = useSearchParams();
  const shiftId = searchParams.get('shift_id');

  const [report, setReport] = useState<ZReportData | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shiftId) {
      setError('No se proporcionó shift_id');
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [reportRes, configRes] = await Promise.all([
          fetch(`/api/pos/z-reports?shiftId=${shiftId}`, { credentials: 'include' }),
          fetch('/api/admin/config', { credentials: 'include' }),
        ]);

        if (reportRes.ok) {
          const reportData = await reportRes.json();
          setReport(reportData.report || null);
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          setTenant(configData);
        }
      } catch {
        setError('Error al cargar datos del reporte');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [shiftId]);

  useEffect(() => {
    if (report && !loading) {
      const timer = setTimeout(() => window.print(), 1000);
      return () => clearTimeout(timer);
    }
  }, [report, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando reporte...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error || 'No se encontró el reporte'}</p>
      </div>
    );
  }

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
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold">{tenant?.legal_name || 'Restaurante'}</h1>
          {tenant?.ruc && <p className="text-sm">RUC: {tenant.ruc}</p>}
          {tenant?.address_text && <p className="text-sm">{tenant.address_text}</p>}
          <p className="text-lg font-bold mt-3">
            REPORTE {report.reportType} - #{String(report.reportNumber).padStart(4, '0')}
          </p>
          <p className="text-sm">
            Terminal: {report.terminalId} | Generado: {new Date(report.generatedAt).toLocaleString('es-PE')}
          </p>
        </div>

        {/* Ventas */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2">VENTAS</h2>
          <table className="w-full text-sm">
            <tbody>
              <PrintRow label="Ventas Brutas" value={fmt(report.grossSalesCents)} />
              <PrintRow label="(-) Descuentos" value={fmt(report.discountCents)} />
              <PrintRow label="(-) Anulaciones" value={fmt(report.voidsCents)} />
              <PrintRow label="(-) Devoluciones" value={fmt(report.refundsCents)} />
              <PrintRow label="Propinas" value={fmt(report.tipsCents)} />
              <tr><td colSpan={2}><hr className="my-1 border-gray-300" /></td></tr>
              <PrintRow label="Ventas Netas" value={fmt(report.netSalesCents)} bold />
              <PrintRow label="Total Ordenes" value={String(report.ordersCount)} />
            </tbody>
          </table>
        </section>

        {/* IGV SUNAT */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2">DESGLOSE IGV (SUNAT)</h2>
          <table className="w-full text-sm">
            <tbody>
              <PrintRow label="Base Gravada" value={fmt(report.gravadoBaseCents)} />
              <PrintRow label="IGV 18%" value={fmt(report.gravadoIgvCents)} bold />
              <PrintRow label="Exonerado" value={fmt(report.exoneradoCents)} />
              <PrintRow label="Inafecto" value={fmt(report.inafectoCents)} />
            </tbody>
          </table>
        </section>

        {/* Comprobantes */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2">COMPROBANTES</h2>
          <table className="w-full text-sm">
            <tbody>
              <PrintRow label={`Boletas (${report.boletasCount})`} value={fmt(report.boletasTotalCents)} />
              <PrintRow label={`Facturas (${report.facturasCount})`} value={fmt(report.facturasTotalCents)} />
              <PrintRow label={`Anulados (${report.voidedInvoicesCount})`} value="—" />
              <PrintRow label={`Notas de Credito (${report.creditNotesCount})`} value="—" />
            </tbody>
          </table>
        </section>

        {/* Pagos por Metodo */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2">PAGOS POR METODO</h2>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(report.paymentsBreakdown).map(([method, data]) => (
                <PrintRow key={method} label={`${method} (${data.count})`} value={fmt(data.totalCents)} />
              ))}
            </tbody>
          </table>
        </section>

        {/* Caja */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2">RESUMEN DE CAJA</h2>
          <table className="w-full text-sm">
            <tbody>
              <PrintRow label="Apertura" value={fmt(report.cashOpeningCents)} />
              <PrintRow label="Esperado" value={fmt(report.cashExpectedCents)} />
              {report.cashCountedCents !== null && (
                <PrintRow label="Contado" value={fmt(report.cashCountedCents)} />
              )}
              {report.cashDiffCents !== null && (
                <>
                  <tr><td colSpan={2}><hr className="my-1 border-gray-300" /></td></tr>
                  <PrintRow
                    label="Diferencia"
                    value={`${report.cashDiffCents >= 0 ? '+' : ''}${fmt(report.cashDiffCents)}`}
                    bold
                  />
                </>
              )}
            </tbody>
          </table>
        </section>

        {/* Signature Line */}
        <div className="mt-16 pt-8">
          <div className="flex justify-between">
            <div className="text-center w-48">
              <div className="border-t border-black pt-2">
                <p className="text-sm font-medium">Responsable de Turno</p>
              </div>
            </div>
            <div className="text-center w-48">
              <div className="border-t border-black pt-2">
                <p className="text-sm font-medium">Supervisor</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8">
          <p>Generado por PARK POS — {new Date(report.generatedAt).toLocaleString('es-PE')}</p>
        </div>
      </div>
    </>
  );
}
