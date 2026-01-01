"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { POSActions } from "@/src/core/actions/pos.actions";

interface ShiftModalProps {
    isOpen: boolean;
    mode: "open" | "close";
    tenantId: string;
    terminalId: string;
    actorId: string;
    currentShiftId?: string;
    expectedCash?: number;
    onClose: () => void;
    onSuccess: () => void;
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
}: ShiftModalProps) {
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount) return;

        setLoading(true);
        try {
            const cents = Math.round(parseFloat(amount) * 100);

            if (mode === "open") {
                await POSActions.openShift(tenantId, terminalId, actorId, cents);
            } else if (currentShiftId) {
                await POSActions.closeShift(tenantId, terminalId, actorId, currentShiftId, cents, notes || undefined);
            }

            onSuccess();
            onClose();
            setAmount("");
            setNotes("");
        } catch (error) {
            console.error("Error with shift:", error);
            alert("Error al procesar el turno");
        } finally {
            setLoading(false);
        }
    };

    const diff = mode === "close" ? Math.round(parseFloat(amount || "0") * 100) - expectedCash : 0;

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
                        className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold text-white mb-4">
                            {mode === "open" ? "🔓 Abrir Turno" : "🔒 Cerrar Turno"}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">
                                    {mode === "open" ? "Efectivo Inicial (S/)" : "Efectivo Contado (S/)"}
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
                                    required
                                />
                            </div>

                            {mode === "close" && (
                                <>
                                    <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-400">Esperado:</span>
                                            <span className="text-white font-mono">S/ {(expectedCash / 100).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-400">Diferencia:</span>
                                            <span className={`font-mono font-bold ${diff === 0 ? "text-emerald-400" :
                                                    diff > 0 ? "text-blue-400" : "text-red-400"
                                                }`}>
                                                {diff >= 0 ? "+" : ""}{(diff / 100).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-1">Notas (opcional)</label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Observaciones del cierre..."
                                            rows={2}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !amount}
                                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${mode === "open"
                                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                            : "bg-red-600 hover:bg-red-500 text-white"
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {loading ? "..." : mode === "open" ? "Abrir Turno" : "Cerrar Turno"}
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
    onOpenClick: () => void;
    onCloseClick: () => void;
}

export function ShiftStatus({ isOpen, shiftId, expectedCash, onOpenClick, onCloseClick }: ShiftStatusProps) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${isOpen
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
            <span className={`w-2 h-2 rounded-full ${isOpen ? "bg-emerald-500" : "bg-red-500"}`} />
            <span>{isOpen ? "TURNO ABIERTO" : "TURNO CERRADO"}</span>
            {isOpen && (
                <span className="text-zinc-500 ml-1">
                    S/ {(expectedCash / 100).toFixed(2)}
                </span>
            )}
            <button
                onClick={isOpen ? onCloseClick : onOpenClick}
                className="ml-2 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
            >
                {isOpen ? "Cerrar" : "Abrir"}
            </button>
        </div>
    );
}
