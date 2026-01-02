import { useState, useMemo } from "react";
import { Check } from "@/src/core/domain/events"; // Check is compatible
import { SaleProjection } from "@/src/core/projections/types";
import { POSActions } from "@/src/core/actions/pos.actions";
import { toast } from "sonner";
import { Plus, X, ArrowRight, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface SplitBillModalProps {
    order: SaleProjection;
    onClose: () => void;
    currentTenantId: string;
    currentTerminalId: string;
    actorId: string;
}

export function SplitBillModal({ order, onClose, currentTenantId, currentTerminalId, actorId }: SplitBillModalProps) {
    const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);

    // Filter out checks that are not 'ITEMS' mode or are already PAID
    const activeChecks = useMemo(() => {
        return order.checks.filter(c => c.payment.status !== "PAID");
    }, [order.checks]);

    const mainCheck = order.checks[0]; // Assuming first is main
    const subChecks = order.checks.slice(1);

    async function handleCreateCheck() {
        console.log("handleCreateCheck called", { actorId });
        if (!mainCheck) return;

        try {
            const nextIdx = subChecks.length + 2;
            console.log("Creating check with index:", nextIdx);
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
        // Source Check extraction logic
        const sourceCheck = order.checks.find(c => c.lines.some(l => l.line_id === lineId && l.qty > 0));

        // Safety checks
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

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl border border-zinc-800 flex overflow-hidden"
            >
                {/* Left: Main Check (Source) */}
                <div className="w-1/2 border-r border-zinc-800 p-6 flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <span className="bg-indigo-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                        Cuenta Principal
                        <span className="ml-auto text-sm font-mono text-zinc-400">
                            {mainCheck?.lines.reduce((acc, l) => acc + l.qty, 0)} items
                        </span>
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-2">
                        {mainCheck?.lines.map(line => {
                            // Correct lookup using Record
                            const orderItem = order.lines[line.line_id];
                            if (!orderItem) return null;

                            return (
                                <div key={line.line_id} className="bg-zinc-800/50 p-3 rounded-lg flex justify-between items-center group">
                                    <div>
                                        <div className="text-white font-medium">{orderItem.name}</div>
                                        <div className="text-xs text-zinc-500 font-mono">Qty: {line.qty}</div>
                                    </div>

                                    {/* Actions to move */}
                                    <div className="flex gap-1 opacity-100 transition-opacity">
                                        {subChecks.map((target, idx) => (
                                            <button
                                                key={target.check_id}
                                                onClick={() => handleMoveItem(line.line_id, 1, target.check_id)}
                                                className="bg-zinc-700 hover:bg-indigo-600 text-white w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                                                title={`Mover a Cuenta ${idx + 2}`}
                                            >
                                                {idx + 2}
                                            </button>
                                        ))}
                                        {subChecks.length === 0 && (
                                            <span className="text-xs text-zinc-600 italic">Crea una cuenta para dividir</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Sub Checks */}
                <div className="w-1/2 p-6 bg-zinc-900/50 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Sub-Cuentas</h3>
                        <button
                            onClick={handleCreateCheck}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                            <Plus size={16} /> Nueva Cuenta
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4">
                        {subChecks.map((check, idx) => (
                            <div key={check.check_id} className="border border-zinc-700 rounded-xl p-4 bg-zinc-900">
                                <div className="flex justify-between mb-2">
                                    <span className="font-bold text-indigo-400">Cuenta {idx + 2}</span>
                                    <span className="font-mono text-white">S/ {(check.total_cents / 100).toFixed(2)}</span>
                                </div>

                                {check.lines.length === 0 ? (
                                    <div className="text-center py-8 text-zinc-600 text-sm dashed-box">
                                        Arrastra o selecciona items de la izquierda
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {check.lines.map(line => {
                                            const orderItem = order.lines[line.line_id];
                                            return (
                                                <div key={line.line_id} className="flex justify-between text-sm text-zinc-300">
                                                    <span>{line.qty}x {orderItem?.name}</span>
                                                    <button
                                                        onClick={() => handleMoveItem(line.line_id, 1, mainCheck.check_id)}
                                                        className="text-zinc-500 hover:text-red-400"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}

                        {subChecks.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50">
                                <ArrowRight size={48} className="mb-4" />
                                <p>No hay sub-cuentas activas</p>
                            </div>
                        )}
                    </div>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
                    <X size={24} />
                </button>
            </motion.div>
        </div>
    );
}
