"use client";

/**
 * Z-Report Page - Fiscal shift close report viewer
 *
 * Shows Z/X reports with IGV breakdown, comprobantes, and cash reconciliation.
 * Accessible from shift management page after closing a shift.
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/src/components/auth";
import Link from "next/link";

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

function fmt(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function Row({ label, value, bold, testId }: { label: string; value: string; bold?: boolean; testId?: string }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-bold" : ""}`} data-testid={testId}>
      <span className="text-zinc-400">{label}</span>
      <span className={`font-mono ${bold ? "text-white" : "text-zinc-300"}`}>{value}</span>
    </div>
  );
}

export default function ZReportPage() {
  const { terminal } = useAuth();
  const searchParams = useSearchParams();
  const shiftId = searchParams.get("shiftId");

  const [report, setReport] = useState<ZReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!shiftId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/z-reports?shiftId=${shiftId}`, {
        credentials: "include",
      });
      const data = await res.json();
      setReport(data.report || null);
    } catch {
      toast.error("Error al cargar reporte");
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleGenerate = async (type: "Z" | "X") => {
    if (!shiftId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/pos/z-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ shiftId, reportType: type }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Error al generar reporte");
        return;
      }
      const data = await res.json();
      setReport(data);
      toast.success(`Reporte ${type} generado`);
    } catch {
      toast.error("Error al generar reporte");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6" data-testid="z-report-page">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/pos/shift" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors" data-testid="z-report-back-link">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2" data-testid="z-report-title">
                <FileText className="w-5 h-5 text-amber-400" />
                Reporte {report?.reportType || "Z"} — #{report?.reportNumber ?? "—"}
              </h1>
              <p className="text-zinc-400 text-sm">Terminal: {terminal?.terminal_id || report?.terminalId}</p>
            </div>
          </div>
          {report && (
            <button
              onClick={() => window.print()}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              title="Imprimir"
              data-testid="z-report-print-btn"
            >
              <Printer className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Generate buttons if no report */}
        {!report && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 text-center space-y-4">
            <p className="text-zinc-400">No hay reporte para este turno</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleGenerate("X")}
                disabled={generating}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium transition-colors disabled:opacity-50"
                data-testid="z-report-generate-x"
              >
                {generating ? "..." : "Generar Reporte X (Parcial)"}
              </button>
              <button
                onClick={() => handleGenerate("Z")}
                disabled={generating}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium transition-colors disabled:opacity-50"
                data-testid="z-report-generate-z"
              >
                {generating ? "..." : "Generar Reporte Z (Final)"}
              </button>
            </div>
          </div>
        )}

        {report && (
          <>
            {/* Ventas */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-2">
              <h3 className="font-semibold text-sm text-zinc-400 uppercase mb-3">Ventas</h3>
              <Row label="Ventas Brutas" value={fmt(report.grossSalesCents)} bold testId="z-report-gross-sales" />
              <Row label="Descuentos" value={`-${fmt(report.discountCents)}`} />
              <Row label="Anulaciones" value={`-${fmt(report.voidsCents)}`} />
              <Row label="Devoluciones" value={`-${fmt(report.refundsCents)}`} />
              <Row label="Propinas" value={fmt(report.tipsCents)} />
              <div className="border-t border-zinc-700 pt-2 mt-2">
                <Row label="Ventas Netas" value={fmt(report.netSalesCents)} bold testId="z-report-net-sales" />
              </div>
              <Row label="Ordenes" value={String(report.ordersCount)} testId="z-report-orders-count" />
            </div>

            {/* IGV SUNAT */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-2">
              <h3 className="font-semibold text-sm text-zinc-400 uppercase mb-3">Desglose IGV (SUNAT)</h3>
              <Row label="Base Gravada" value={fmt(report.gravadoBaseCents)} />
              <Row label="IGV 18%" value={fmt(report.gravadoIgvCents)} bold testId="z-report-igv" />
              <Row label="Exonerado" value={fmt(report.exoneradoCents)} />
              <Row label="Inafecto" value={fmt(report.inafectoCents)} />
            </div>

            {/* Comprobantes */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-2">
              <h3 className="font-semibold text-sm text-zinc-400 uppercase mb-3">Comprobantes</h3>
              <Row label={`Boletas (${report.boletasCount})`} value={fmt(report.boletasTotalCents)} />
              <Row label={`Facturas (${report.facturasCount})`} value={fmt(report.facturasTotalCents)} />
              <Row label={`Anulados (${report.voidedInvoicesCount})`} value="" />
              <Row label={`Notas de Crédito (${report.creditNotesCount})`} value="" />
            </div>

            {/* Pagos por método */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-2" data-testid="z-report-payments-section">
              <h3 className="font-semibold text-sm text-zinc-400 uppercase mb-3">Pagos por Método</h3>
              {Object.entries(report.paymentsBreakdown).map(([method, data]) => (
                <Row key={method} label={`${method} (${data.count})`} value={fmt(data.totalCents)} />
              ))}
              <div className="border-t border-zinc-700 pt-2 mt-2">
                <Row label="Total" value={fmt(report.grossSalesCents)} bold />
              </div>
            </div>

            {/* Caja */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-2">
              <h3 className="font-semibold text-sm text-zinc-400 uppercase mb-3">Caja</h3>
              <Row label="Apertura" value={fmt(report.cashOpeningCents)} testId="z-report-cash-opening" />
              <Row label="Esperado" value={fmt(report.cashExpectedCents)} testId="z-report-cash-expected" />
              {report.cashCountedCents !== null && (
                <Row label="Contado" value={fmt(report.cashCountedCents)} testId="z-report-cash-counted" />
              )}
              {report.cashDiffCents !== null && (
                <div className="border-t border-zinc-700 pt-2 mt-2">
                  <div className="flex justify-between text-sm font-bold" data-testid="z-report-cash-diff">
                    <span className="text-zinc-400">Diferencia</span>
                    <span className={`font-mono ${
                      report.cashDiffCents === 0 ? "text-emerald-400" :
                      report.cashDiffCents > 0 ? "text-blue-400" : "text-red-400"
                    }`}>
                      {report.cashDiffCents >= 0 ? "+" : ""}{fmt(report.cashDiffCents)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="text-xs text-zinc-600 text-center space-y-1" data-testid="z-report-meta">
              <p>Generado: {new Date(report.generatedAt).toLocaleString("es-PE")}</p>
              <p>Reporte {report.reportType}-{String(report.reportNumber).padStart(4, "0")}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
