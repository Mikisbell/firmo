import { useState } from "react";
import { SaleProjection } from "@/src/core/projections/types";
import { POSActions } from "@/src/core/actions/pos.actions";
import { toast } from "sonner";
import { Plus, X, ArrowRight, Users, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SplitBillModalProps {
    order: SaleProjection;
    onClose: () => void;
    currentTenantId: string;
    currentTerminalId: string;
    actorId: string;
}

type SplitMode = "ITEMS" | "EQUAL" | "CUSTOM";

export function SplitBillModal({ order, onClose, currentTenantId, currentTerminalId, actorId }: SplitBillModalProps) {
    const [splitMode, setSplitMode] = useState<SplitMode>("ITEMS");
    const [equalSplitCount, setEqualSplitCount] = useState(2);
    const [showEqualSplitSetup, setShowEqualSplitSetup] = useState(false);

    const mainCheck = order.checks[0];
    const subChecks = order.checks.slice(1);
    const allChecks = order.checks;

    // Calcular totales
    const orderTotal = order.total_cents ?? 0;
    const mainCheckTotal = mainCheck?.total_cents || 0;
    const subChecksTotal = subChecks.reduce((sum, c) => sum + c.total_cents, 0);

    async function handleCreateCheck() {
        if (!mainCheck) return;

        try {
            const nextIdx = subChecks.length + 2;
            await POSActions.createCheck(
                currentTenantId,
                currentTerminalId,
                actorId,
                order.order_id,
                `Cuenta ${nextIdx}`
            );
            toast.success(`Cuenta ${nextIdx} creada`);
        } catch (e) {
            console.error("Error creating check:", e);
            toast.error("Error al crear cuenta");
        }
    }

    async function handleMoveItem(lineId: string, qty: number, targetCheckId: string) {
        const sourceCheck = order.checks.find(c => c.lines.some(l => l.line_id === lineId && l.qty > 0));

        if (!sourceCheck) return;
        if (sourceCheck.check_id === targetCheckId) return;
        const targetCheck = order.checks.find(c => c.check_id === targetCheckId);
        if (!targetCheck) return;

        try {
            await POSActions.moveCheckItems(
                currentTenantId,
                currentTerminalId,
                actorId,
                order.order_id,
                sourceCheck.check_id,
                targetCheck.check_id,
                [{ line_id: lineId, qty }]
            );
            toast.success("Item movido");
        } catch (e) {
            toast.error("Error al mover item");
            console.error(e);
        }
    }

    async function handleEqualSplit() {
        if (equalSplitCount < 2 || equalSplitCount > 10) {
            toast.error("Número de personas debe ser entre 2 y 10");
            return;
        }

        // Crear las cuentas necesarias
        const checksNeeded = equalSplitCount - allChecks.length;
        
        try {
            for (let i = 0; i < checksNeeded; i++) {
                const nextIdx = allChecks.length + i + 1;
                await POSActions.createCheck(
                    currentTenantId,
                    currentTerminalId,
                    actorId,
                    order.order_id,
                    `Persona ${nextIdx}`
                );
            }

            // Distribuir items equitativamente
            const allLines = mainCheck?.lines || [];
            const checksToUse = equalSplitCount;
            
            let checkIndex = 1; // Empezar desde la segunda cuenta
            for (const line of allLines) {
                if (line.qty > 0 && checkIndex < checksToUse) {
                    // Mover a la siguiente cuenta
                    const targetCheck = order.checks[checkIndex];
                    if (targetCheck) {
                        await handleMoveItem(line.line_id, line.qty, targetCheck.check_id);
                    }
                    checkIndex = (checkIndex + 1) % checksToUse;
                    if (checkIndex === 0) checkIndex = 1;
                }
            }

            toast.success(`Cuenta dividida entre ${equalSplitCount} personas`);
            setShowEqualSplitSetup(false);
        } catch (e) {
            toast.error("Error al dividir cuenta");
            console.error(e);
        }
    }

    function formatCents(cents: number): string {
        return `S/ ${(cents / 100).toFixed(2)}`;
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl border border-zinc-800 flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Dividir Cuenta</h2>
                        <p className="text-sm text-zinc-400">
                            Total: {formatCents(orderTotal)} • {allChecks.length} cuenta(s)
                        </p>
                    </div>

                    {/* Mode Selector */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSplitMode("ITEMS")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                                splitMode === "ITEMS" 
                                    ? "bg-indigo-600 text-white" 
                                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                            }`}
                        >
                            <DollarSign size={16} /> Por Items
                        </button>
                        <button
                            onClick={() => {
                                setSplitMode("EQUAL");
                                setShowEqualSplitSetup(true);
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                                splitMode === "EQUAL" 
                                    ? "bg-indigo-600 text-white" 
                                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                            }`}
                        >
                            <Users size={16} /> Equitativo
                        </button>
                    </div>

                    <button onClick={onClose} className="text-zinc-500 hover:text-white p-2">
                        <X size={24} />
                    </button>
                </div>

                {/* Equal Split Setup */}
                <AnimatePresence>
                    {showEqualSplitSetup && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-b border-zinc-800 bg-indigo-950/30"
                        >
                            <div className="p-4 flex items-center justify-center gap-6">
                                <span className="text-white">Dividir entre</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setEqualSplitCount(Math.max(2, equalSplitCount - 1))}
                                        className="bg-zinc-700 hover:bg-zinc-600 text-white w-10 h-10 rounded-lg flex items-center justify-center"
                                    >
                                        <ChevronDown size={20} />
                                    </button>
                                    <span className="text-3xl font-bold text-white w-12 text-center">
                                        {equalSplitCount}
                                    </span>
                                    <button
                                        onClick={() => setEqualSplitCount(Math.min(10, equalSplitCount + 1))}
                                        className="bg-zinc-700 hover:bg-zinc-600 text-white w-10 h-10 rounded-lg flex items-center justify-center"
                                    >
                                        <ChevronUp size={20} />
                                    </button>
                                </div>
                                <span className="text-white">personas</span>
                                <span className="text-zinc-400 mx-4">→</span>
                                <span className="text-xl font-mono text-indigo-400">
                                    {formatCents(Math.ceil(orderTotal / equalSplitCount))} c/u
                                </span>
                                <button
                                    onClick={handleEqualSplit}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium ml-4"
                                >
                                    Aplicar
                                </button>
                                <button
                                    onClick={() => setShowEqualSplitSetup(false)}
                                    className="text-zinc-500 hover:text-white px-4 py-2"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Main Check (Source) */}
                    <div className="w-1/2 border-r border-zinc-800 p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="bg-indigo-600 w-7 h-7 rounded-full flex items-center justify-center text-sm">1</span>
                                Cuenta Principal
                            </h3>
                            <span className="font-mono text-lg text-indigo-400">
                                {formatCents(mainCheckTotal)}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2">
                            {mainCheck?.lines.length === 0 ? (
                                <div className="text-center py-12 text-zinc-600">
                                    <p>Todos los items han sido movidos</p>
                                </div>
                            ) : (
                                mainCheck?.lines.map(line => {
                                    const orderItem = order.lines[line.line_id];
                                    if (!orderItem) return null;

                                    return (
                                        <div key={line.line_id} className="bg-zinc-800/50 p-3 rounded-lg flex justify-between items-center">
                                            <div className="flex-1">
                                                <div className="text-white font-medium">{orderItem.name}</div>
                                                <div className="text-xs text-zinc-500">
                                                    {line.qty} × {formatCents(orderItem.unit_price_cents)} = {formatCents(line.qty * orderItem.unit_price_cents)}
                                                </div>
                                            </div>

                                            {/* Move buttons */}
                                            <div className="flex gap-1 ml-2">
                                                {subChecks.map((target, idx) => (
                                                    <button
                                                        key={target.check_id}
                                                        onClick={() => handleMoveItem(line.line_id, 1, target.check_id)}
                                                        className="bg-zinc-700 hover:bg-indigo-600 text-white w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
                                                        title={`Mover a Cuenta ${idx + 2}`}
                                                    >
                                                        {idx + 2}
                                                    </button>
                                                ))}
                                                {subChecks.length === 0 && (
                                                    <span className="text-xs text-zinc-600 italic px-2">
                                                        Crea una cuenta →
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Sub Checks */}
                    <div className="w-1/2 p-4 bg-zinc-900/50 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-white">Sub-Cuentas</h3>
                            <button
                                onClick={handleCreateCheck}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                                <Plus size={16} /> Nueva
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {subChecks.map((check, idx) => (
                                <div key={check.check_id} className="border border-zinc-700 rounded-xl p-4 bg-zinc-900">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-bold text-indigo-400 flex items-center gap-2">
                                            <span className="bg-indigo-600/30 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                                                {idx + 2}
                                            </span>
                                            {check.name || `Cuenta ${idx + 2}`}
                                        </span>
                                        <span className="font-mono text-lg text-white">
                                            {formatCents(check.total_cents)}
                                        </span>
                                    </div>

                                    {check.lines.length === 0 ? (
                                        <div className="text-center py-6 text-zinc-600 text-sm border border-dashed border-zinc-700 rounded-lg">
                                            Sin items
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {check.lines.map(line => {
                                                const orderItem = order.lines[line.line_id];
                                                return (
                                                    <div key={line.line_id} className="flex justify-between items-center text-sm text-zinc-300 py-1">
                                                        <span>{line.qty}× {orderItem?.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-zinc-500 font-mono">
                                                                {formatCents((orderItem?.unit_price_cents || 0) * line.qty)}
                                                            </span>
                                                            <button
                                                                onClick={() => handleMoveItem(line.line_id, 1, mainCheck.check_id)}
                                                                className="text-zinc-500 hover:text-red-400 p-1"
                                                                title="Devolver a cuenta principal"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {subChecks.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                                    <ArrowRight size={48} className="mb-4 opacity-30" />
                                    <p className="text-center">
                                        Presiona "Nueva" para crear<br />una sub-cuenta
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Summary */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-6 text-sm">
                            <div>
                                <span className="text-zinc-500">Cuenta Principal:</span>
                                <span className="text-white font-mono ml-2">{formatCents(mainCheckTotal)}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500">Sub-cuentas ({subChecks.length}):</span>
                                <span className="text-white font-mono ml-2">{formatCents(subChecksTotal)}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500">Total:</span>
                                <span className="text-indigo-400 font-mono font-bold ml-2">{formatCents(orderTotal)}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="bg-zinc-700 hover:bg-zinc-600 text-white px-6 py-2 rounded-lg font-medium"
                        >
                            Listo
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
