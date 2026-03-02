"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { POSActions } from "@/src/core/actions/pos.actions";
import { DenominationCounter } from "./DenominationCounter";

interface ShiftModalProps {
    isOpen: boolean;
    mode: "open" | "close" | "movements";
    tenantId: string;
    terminalId: string;
    actorId: string;
    currentShiftId?: string;
    expectedCash?: number;
    onClose: () => void;
    onSuccess: () => void;
    onAdjustCash?: (cents: number, reason: string) => Promise<void>;
}

export function ShiftModal({
    isOpen,
    mode,
    tenantId,
    terminalId,
    actorId,
    currentShiftId,
    expectedCash = 0,
    onClose,
    onSuccess,
    onAdjustCash,
}: ShiftModalProps) {
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [movementType, setMovementType] = useState<"IN" | "OUT">("OUT");
    const [useByDenom, setUseByDenom] = useState(false);
    const denomCountsRef = useRef<Record<number, number>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount) return;

        setLoading(true);
        try {
            const cents = Math.round(parseFloat(amount) * 100);

            if (mode === "open") {
                await POSActions.openShift(tenantId, terminalId, actorId, cents);
            } else if (mode === "close" && currentShiftId) {
                await POSActions.closeShift(tenantId, terminalId, actorId, currentShiftId, cents, notes || undefined);

                // Save denomination counts if used
                if (useByDenom && Object.keys(denomCountsRef.current).length > 0) {
                    try {
                        await fetch("/api/pos/denominations", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                                shiftId: currentShiftId,
                                counts: denomCountsRef.current,
                            }),
                        });
                    } catch {
                        // Non-critical — shift already closed
                    }
                }
            } else if (mode === "movements" && onAdjustCash) {
                const delta = movementType === "IN" ? cents : -cents;
                await onAdjustCash(delta, notes || "Movimiento manual");
            }

            onSuccess();
            onClose();
            setAmount("");
            setNotes("");
            setMovementType("OUT");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error al procesar el turno";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const diff = mode === "close" ? Math.round(parseFloat(amount || "0") * 100) - expectedCash : 0;

    const getTitle = () => {
        if (mode === "open") return "🔓 Abrir Turno";
        if (mode === "close") return "🔒 Cerrar Turno";
        return "💸 Movimiento de Caja";
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: "spring", damping: 20 }}
                        className={`bg-zinc-900 rounded-2xl p-6 w-full border border-zinc-800 shadow-2xl ${useByDenom && mode === "close" ? "max-w-lg" : "max-w-md"}`}
                        onClick={(e) => e.stopPropagation()}
                        data-testid="shift-modal"
                    >
                        <h2 className="text-xl font-bold text-white mb-4" data-testid="shift-modal-title">
                            {getTitle()}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {mode === "movements" && (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setMovementType("IN")}
                                        data-testid="shift-movement-in"
                                        className={`flex-1 py-2 rounded-lg font-medium border ${movementType === "IN"
                                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                                            : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                                            }`}
                                    >
                                        Ingreso (+S/)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMovementType("OUT")}
                                        data-testid="shift-movement-out"
                                        className={`flex-1 py-2 rounded-lg font-medium border ${movementType === "OUT"
                                            ? "bg-red-500/20 border-red-500 text-red-400"
                                            : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                                            }`}
                                    >
                                        Salida (-S/)
                                    </button>
                                </div>
                            )}

                            {/* Denomination toggle for close mode */}
                            {mode === "close" && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setUseByDenom(false)}
                                        data-testid="shift-direct-toggle"
                                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border ${!useByDenom
                                            ? "bg-zinc-700 border-zinc-600 text-white"
                                            : "border-zinc-700 text-zinc-500 hover:bg-zinc-800"
                                            }`}
                                    >
                                        Monto directo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUseByDenom(true)}
                                        data-testid="shift-denom-toggle"
                                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border ${useByDenom
                                            ? "bg-zinc-700 border-zinc-600 text-white"
                                            : "border-zinc-700 text-zinc-500 hover:bg-zinc-800"
                                            }`}
                                    >
                                        Por denominación
                                    </button>
                                </div>
                            )}

                            {/* Direct amount input (always for open/movements, toggle for close) */}
                            {(mode !== "close" || !useByDenom) && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">
                                        {mode === "open" ? "Efectivo Inicial (S/)" :
                                            mode === "close" ? "Efectivo Contado (S/)" :
                                                "Monto (S/)"}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="0.00"
                                        autoFocus
                                        required={!useByDenom}
                                        data-testid="shift-amount-input"
                                    />
                                </div>
                            )}

                            {/* Denomination counter for close mode */}
                            {mode === "close" && useByDenom && (
                                <div className="max-h-64 overflow-y-auto">
                                    <DenominationCounter
                                        onChange={(counts, totalCents) => {
                                            denomCountsRef.current = counts;
                                            setAmount((totalCents / 100).toFixed(2));
                                        }}
                                    />
                                </div>
                            )}

                            {mode === "close" && (
                                <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-400">Esperado:</span>
                                        <span className="text-white font-mono" data-testid="shift-expected-value">S/ {(expectedCash / 100).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-400">Diferencia:</span>
                                        <span data-testid="shift-diff-value" className={`font-mono font-bold ${diff === 0 ? "text-emerald-400" :
                                            diff > 0 ? "text-blue-400" : "text-red-400"
                                            }`}>
                                            {diff >= 0 ? "+" : ""}{(diff / 100).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {(mode === "close" || mode === "movements") && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">
                                        {mode === "movements" ? "Motivo (Requerido)" : "Notas (opcional)"}
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder={mode === "movements" ? "Ej: Compra de hielo" : "Observaciones del cierre..."}
                                        rows={2}
                                        required={mode === "movements"}
                                        data-testid="shift-notes-textarea"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
                                    data-testid="shift-cancel-btn"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !amount || (mode === "movements" && !notes)}
                                    data-testid="shift-submit-btn"
                                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${loading ? "opacity-50" :
                                        mode === "open" ? "bg-emerald-600 hover:bg-emerald-500 text-white" :
                                            mode === "close" ? "bg-red-600 hover:bg-red-500 text-white" :
                                                "bg-blue-600 hover:bg-blue-500 text-white"
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {loading ? "..." : mode === "open" ? "Abrir Turno" : mode === "close" ? "Cerrar Turno" : "Registrar"}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

interface ShiftStatusProps {
    isOpen: boolean;
    shiftId?: string;
    expectedCash: number;
    openedAt?: string | null;
    employeeName?: string;
    onOpenClick: () => void;
    onCloseClick: () => void;
    onMovementsClick: () => void;
}

function formatElapsedTime(openedAt: string | null | undefined): string {
    if (!openedAt) return "";
    const start = new Date(openedAt).getTime();
    const now = Date.now();
    const diffMs = now - start;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

export function ShiftStatus({
    isOpen,
    shiftId: _shiftId,
    expectedCash,
    openedAt,
    employeeName = "Cajero",
    onOpenClick,
    onCloseClick,
    onMovementsClick
}: ShiftStatusProps) {
    const [elapsed, setElapsed] = React.useState(formatElapsedTime(openedAt));

    // Update elapsed time every minute
    React.useEffect(() => {
        if (!isOpen || !openedAt) return;

        const interval = setInterval(() => {
            setElapsed(formatElapsedTime(openedAt));
        }, 60000); // Update every minute

        // Initial update
        setElapsed(formatElapsedTime(openedAt));

        return () => clearInterval(interval);
    }, [isOpen, openedAt]);

    return (
        <div data-testid="shift-status" className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${isOpen
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
            <span data-testid="shift-status-indicator" className={`w-2 h-2 rounded-full ${isOpen ? "bg-emerald-500" : "bg-red-500"}`} />

            {isOpen ? (
                <>
                    <span className="font-semibold" data-testid="shift-status-label">{employeeName}</span>
                    {elapsed && (
                        <span className="text-zinc-400">• {elapsed}</span>
                    )}
                    <span className="text-zinc-500 ml-1" data-testid="shift-cash-display">
                        S/ {(expectedCash / 100).toFixed(2)}
                    </span>
                </>
            ) : (
                <span>TURNO CERRADO</span>
            )}

            {isOpen && (
                <button
                    onClick={onMovementsClick}
                    className="ml-2 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-zinc-700"
                    title="Movimientos de Caja"
                    data-testid="shift-movements-btn"
                >
                    $
                </button>
            )}

            <button
                onClick={isOpen ? onCloseClick : onOpenClick}
                className="ml-2 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                data-testid="shift-open-close-btn"
            >
                {isOpen ? "Cerrar" : "Abrir"}
            </button>
        </div>
    );
}

