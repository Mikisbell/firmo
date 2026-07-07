'use client';

/**
 * P&L Print Page
 *
 * Printable Estado de Resultados with @media print styles.
 * Query param: ?month=2026-04 (defaults to current month)
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';

interface PnLData {
  revenue: {
    grossSalesCents: number;
    discountsCents: number;
    refundsCents: number;
    deliveryFeesCents: number;
    netSalesCents: number;
    ordersCount: number;
  };
  cogs: {
    purchasesCents: number;
  };
  grossProfit: {
    grossProfitCents: number;
    grossMarginPercent: number;
  };
  operatingExpenses: {
    payrollCents: number;
    pettyCashExpensesCents: number;
    totalExpensesCents: number;
    byCategory: Array<{ category: string; amountCents: number }>;
  };
  netIncome: {
    netIncomeCents: number;
    netMarginPercent: number;
  };
  period: {
    start: string;
    end: string;
  };
}

function fmt(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = `S/ ${(abs / 100).toFixed(2)}`;
  return cents < 0 ? `-${formatted}` : formatted;
}

function PnLRow({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  return (
    <tr className={bold ? 'font-bold' : ''}>
      <td className={`py-1 pr-4 ${indent ? 'pl-8' : ''}`}>{label}</td>
      <td className="py-1 text-right font-mono">{value}</td>
    </tr>
  );
}

export default function PnLPrintPage() {
  const searchParams = useSearchParams();
  const monthParam = searchParams.get('month');

  const [data, setData] = useState<PnLData | null>(null);
  const [tenantName, setTenantName] = useState<string>('Restaurante');
  const [tenantRuc, setTenantRuc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Calculate date range from month
        let start: string;
        let end: string;

        if (monthParam) {
          const [year, month] = monthParam.split('-').map(Number);
          start = new Date(year, month - 1, 1).toISOString().split('T')[0];
          end = new Date(year, month, 0).toISOString().split('T')[0];
        } else {
          const now = new Date();
          start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }

        const params = new URLSearchParams({ start, end });
        const [pnlRes, configRes] = await Promise.all([
          fetch(`/api/admin/pnl?${params}`, { credentials: 'include' }),
          fetch('/api/admin/config', { credentials: 'include' }),
        ]);

        if (pnlRes.ok) {
          const pnlData = await pnlRes.json();
          setData(pnlData);
        } else {
          setError('Error al cargar reporte P&L');
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
  }, [monthParam]);

  useEffect(() => {
    if (data && !loading) {
      const timer = setTimeout(() => window.print(), 1000);
      return () => clearTimeout(timer);
    }
  }, [data, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando reporte...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error || 'No se encontraron datos'}</p>
      </div>
    );
  }

  const periodLabel = monthParam
    ? new Date(`${monthParam}-01`).toLocaleDateString('es-PE', { year: 'numeric', month: 'long' })
    : `${data.period.start} a ${data.period.end}`;

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
          <h1 className="text-2xl font-bold">{tenantName}</h1>
          {tenantRuc && <p className="text-sm">RUC: {tenantRuc}</p>}
          <p className="text-lg font-bold mt-3">ESTADO DE RESULTADOS</p>
          <p className="text-sm">Periodo: {periodLabel}</p>
        </div>

        {/* P&L Table */}
        <table className="w-full text-sm">
          <tbody>
            {/* Revenue */}
            <tr className="bg-gray-100">
              <td className="py-2 px-2 font-bold" colSpan={2}>INGRESOS</td>
            </tr>
            <PnLRow label="Ventas Brutas" value={fmt(data.revenue.grossSalesCents)} indent />
            <PnLRow label="(-) Descuentos" value={fmt(-data.revenue.discountsCents)} indent />
            <PnLRow label="(-) Devoluciones" value={fmt(-data.revenue.refundsCents)} indent />
            <PnLRow label="(+) Tarifa Delivery" value={fmt(data.revenue.deliveryFeesCents)} indent />
            <tr><td colSpan={2}><hr className="my-1 border-gray-300" /></td></tr>
            <PnLRow label="Ventas Netas" value={fmt(data.revenue.netSalesCents)} bold />

            {/* COGS */}
            <tr><td colSpan={2} className="py-2" /></tr>
            <tr className="bg-gray-100">
              <td className="py-2 px-2 font-bold" colSpan={2}>COSTO DE VENTAS</td>
            </tr>
            <PnLRow label="Compras Recibidas" value={fmt(data.cogs.purchasesCents)} indent />
            <tr><td colSpan={2}><hr className="my-1 border-gray-300" /></td></tr>
            <PnLRow
              label={`UTILIDAD BRUTA (${data.grossProfit.grossMarginPercent}%)`}
              value={fmt(data.grossProfit.grossProfitCents)}
              bold
            />

            {/* Operating Expenses */}
            <tr><td colSpan={2} className="py-2" /></tr>
            <tr className="bg-gray-100">
              <td className="py-2 px-2 font-bold" colSpan={2}>GASTOS OPERATIVOS</td>
            </tr>
            <PnLRow label="Nomina" value={fmt(data.operatingExpenses.payrollCents)} indent />
            <PnLRow label="Caja Chica" value={fmt(data.operatingExpenses.pettyCashExpensesCents)} indent />
            {data.operatingExpenses.byCategory.map((cat) => (
              <PnLRow key={cat.category} label={cat.category} value={fmt(cat.amountCents)} indent />
            ))}
            <tr><td colSpan={2}><hr className="my-1 border-gray-300" /></td></tr>
            <PnLRow label="Total Gastos" value={fmt(data.operatingExpenses.totalExpensesCents)} bold />

            {/* Net Income */}
            <tr><td colSpan={2} className="py-2" /></tr>
            <tr className="bg-gray-200">
              <td className="py-3 px-2 font-bold text-lg">
                UTILIDAD NETA ({data.netIncome.netMarginPercent}%)
              </td>
              <td className="py-3 text-right font-bold text-lg font-mono">
                {fmt(data.netIncome.netIncomeCents)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Order Count */}
        <div className="text-center text-xs text-gray-500 mt-6">
          <p>Basado en {data.revenue.ordersCount} ordenes</p>
        </div>

        {/* Signature Line */}
        <div className="mt-16 pt-8">
          <div className="flex justify-between">
            <div className="text-center w-48">
              <div className="border-t border-black pt-2">
                <p className="text-sm font-medium">Contador</p>
              </div>
            </div>
            <div className="text-center w-48">
              <div className="border-t border-black pt-2">
                <p className="text-sm font-medium">Gerente General</p>
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
