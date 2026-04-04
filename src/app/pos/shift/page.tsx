"use client";

/**
 * Shift Management Page
 * Shows active shift status, summary, and history.
 */

import { useState, useEffect, useCallback } from "react";
import { Clock, CreditCard, History, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useAuth } from "@/src/components/auth";
import { ShiftModal } from "../components/ShiftModal";

interface ShiftSummaryData {
  shiftId: string;
  ordersCount: number;
  totalSalesCents: number;
  cashOpeningCents: number;
  cashExpectedCents: number | null;
  cashCountedCents: number | null;
  diffCents: number | null;
  paymentBreakdown: Record<string, { count: number; totalCents: number }>;
}

function formatCents(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

export default function ShiftPage() {
  const { terminal, session } = useAuth();
  const terminalId = terminal?.terminal_id || "";
  const tenantId = terminal?.tenant_id || "";
  const actorId = terminal?.actor_id || session?.employee_id || "";

  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [summary, setSummary] = useState<ShiftSummaryData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftMode, setShiftMode] = useState<"open" | "close">("open");

  const fetchData = useCallback(async () => {
    if (!terminalId) return;
    setLoading(true);
    try {
      const activeRes = await fetch(`/api/pos/shifts?action=active&terminalId=${terminalId}`, {
        credentials: "include",
      });
      const activeData = await activeRes.json();
      setActiveShift(activeData.shift || null);

      if (activeData.shift) {
        const summaryRes = await fetch(
          `/api/pos/shifts?action=summary&shiftId=${activeData.shift.id}`,
          { credentials: "include" }
        );
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      } else {
        setSummary(null);
      }

      const historyRes = await fetch(
        `/api/pos/shifts?action=history&terminalId=${terminalId}&limit=10`,
        { credentials: "include" }
      );
      const historyData = await historyRes.json();
      setHistory(historyData.shifts || []);
    } catch {
      toast.error("Error al cargar datos de turno");
    } finally {
      setLoading(false);
    }
  }, [terminalId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!activeShift) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeShift, fetchData]);

  const handleOpenShiftModal = () => {
    setShiftMode(activeShift ? "close" : "open");
    setShowShiftModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-park-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-park-gray-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-park-gray-950 text-white p-6" data-testid="shift-page">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="shift-page-title">Gestión de Turnos</h1>
            <p className="text-park-gray-400 text-sm">Terminal: {terminalId}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-park-gray-800 hover:bg-park-gray-700 transition-colors"
              title="Actualizar"
              data-testid="shift-refresh-btn"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleOpenShiftModal}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium transition-colors"
              data-testid="shift-toggle-btn"
            >
              {activeShift ? "Cerrar Turno" : "Abrir Turno"}
            </button>
          </div>
        </div>

        {/* Active Shift Status */}
        <div className={`rounded-xl border p-6 ${
          activeShift ? "bg-emerald-950/30 border-emerald-800" : "bg-park-gray-900 border-park-gray-800"
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <Clock className={`w-6 h-6 ${activeShift ? "text-emerald-400" : "text-park-gray-500"}`} />
            <div>
              <h2 className="font-semibold text-lg" data-testid="shift-active-label">
                {activeShift ? "Turno Abierto" : "Sin Turno Activo"}
              </h2>
              {activeShift && (
                <p className="text-sm text-park-gray-400">
                  Desde {formatTime(activeShift.opened_at)} — Apertura: {formatCents(activeShift.cash_opening_cents)}
                </p>
              )}
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-park-gray-800/50 rounded-lg p-4">
                <div className="text-park-gray-400 text-xs uppercase mb-1">Ventas</div>
                <div className="text-xl font-bold text-emerald-400" data-testid="shift-summary-sales">
                  {formatCents(summary.totalSalesCents)}
                </div>
              </div>
              <div className="bg-park-gray-800/50 rounded-lg p-4">
                <div className="text-park-gray-400 text-xs uppercase mb-1">Órdenes</div>
                <div className="text-xl font-bold" data-testid="shift-summary-orders">{summary.ordersCount}</div>
              </div>
              <div className="bg-park-gray-800/50 rounded-lg p-4">
                <div className="text-park-gray-400 text-xs uppercase mb-1">Ticket Prom.</div>
                <div className="text-xl font-bold" data-testid="shift-summary-avg">
                  {summary.ordersCount > 0
                    ? formatCents(Math.round(summary.totalSalesCents / summary.ordersCount))
                    : "S/ 0.00"}
                </div>
              </div>
              <div className="bg-park-gray-800/50 rounded-lg p-4">
                <div className="text-park-gray-400 text-xs uppercase mb-1">Apertura Caja</div>
                <div className="text-xl font-bold" data-testid="shift-summary-opening">{formatCents(summary.cashOpeningCents)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Breakdown */}
        {summary && Object.keys(summary.paymentBreakdown).length > 0 && (
          <div className="bg-park-gray-900 rounded-xl border border-park-gray-800 p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Desglose por Método
            </h3>
            <div className="space-y-3">
              {Object.entries(summary.paymentBreakdown).map(([method, data]) => (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{method}</span>
                    <span className="text-park-gray-500 text-sm">({data.count})</span>
                  </div>
                  <span className="font-mono font-medium">{formatCents(data.totalCents)}</span>
                </div>
              ))}
              <div className="border-t border-park-gray-700 pt-3 flex items-center justify-between font-bold">
                <span>Total</span>
                <span className="text-emerald-400">{formatCents(summary.totalSalesCents)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Shift History */}
        <div className="bg-park-gray-900 rounded-xl border border-park-gray-800 p-6" data-testid="shift-history-section">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            Historial de Turnos
          </h3>
          {history.length === 0 ? (
            <p className="text-park-gray-500 text-center py-4">Sin turnos registrados</p>
          ) : (
            <div className="space-y-2">
              {history.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between bg-park-gray-800/50 rounded-lg p-3"
                  data-testid={`shift-history-item-${shift.id}`}
                >
                  <div>
                    <span className="text-sm font-medium">
                      {formatDate(shift.opened_at)} — {formatTime(shift.opened_at)}
                      {shift.closed_at ? ` a ${formatTime(shift.closed_at)}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-park-gray-400">
                      Apertura: {formatCents(shift.cash_opening_cents)}
                    </span>
                    {shift.status === "CLOSED" && (
                      <Link
                        href={`/pos/shift/z-report?shiftId=${shift.id}`}
                        className="p-1.5 rounded bg-park-gray-700 hover:bg-park-gray-600 transition-colors"
                        title="Ver Reporte Z"
                        data-testid={`shift-z-report-link-${shift.id}`}
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                      </Link>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      shift.status === "OPEN"
                        ? "bg-emerald-900 text-emerald-300"
                        : "bg-park-gray-700 text-park-gray-300"
                    }`}>
                      {shift.status === "OPEN" ? "Abierto" : "Cerrado"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shift Modal */}
      {showShiftModal && (
        <ShiftModal
          isOpen={showShiftModal}
          mode={shiftMode}
          tenantId={tenantId}
          terminalId={terminalId}
          actorId={actorId}
          currentShiftId={activeShift?.id}
          expectedCash={summary?.cashExpectedCents ?? summary?.totalSalesCents ?? 0}
          onClose={() => setShowShiftModal(false)}
          onSuccess={() => {
            setShowShiftModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
