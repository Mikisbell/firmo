"use client";

import { Trash2, Plus, Minus, CreditCard, Printer, X, Receipt, CheckCircle } from "lucide-react";
import { useCart, getCartTotals, type CartItem, type Payment } from "../hooks/useCart";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CartSidebarProps {
    onPrint: (data: { items: CartItem[]; subtotal: number; total: number; orderNumber: number }) => void;
}

export function CartSidebar({ onPrint }: CartSidebarProps) {
    const { items, payments, orderNumber, addPayment, removeItem, updateQty, clearCart, completeSale } = useCart();
    const { subtotal, totalPaid, remaining, isPaid } = getCartTotals(items, payments);

    const [showPayModal, setShowPayModal] = useState(false);
    const [payAmount, setPayAmount] = useState("");

    const handleQuickPay = async (method: Payment["method"]) => {
        // Pay exact remaining amount
        addPayment({ method, amount: remaining });
        setShowPayModal(false);
    };

    const handleComplete = async () => {
        const result = await completeSale();
        if (result.success) {
            onPrint({ items, subtotal, total: subtotal, orderNumber: result.orderNumber });
        }
    };

    return (
        <div className="h-full flex flex-col bg-white border-l shadow-xl w-[380px]">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-indigo-600 to-indigo-700">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Ticket #{orderNumber}</h2>
                    {items.length > 0 && (
                        <button
                            onClick={clearCart}
                            className="text-indigo-200 hover:text-white p-2 rounded-lg hover:bg-indigo-500/30 transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4">
                {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Receipt className="w-16 h-16 mb-4 opacity-30" />
                        <p className="font-medium">Carrito Vacío</p>
                        <p className="text-sm mt-1">Agrega productos del catálogo</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-gray-50 rounded-xl p-3 flex items-center gap-3"
                            >
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900">{item.name}</p>
                                    <p className="text-sm text-gray-500">
                                        S/ {(item.price / 100).toFixed(2)} c/u
                                    </p>
                                </div>

                                {/* Qty Controls */}
                                <div className="flex items-center gap-2 bg-white rounded-lg border px-2 py-1">
                                    <button
                                        onClick={() => updateQty(item.id, item.qty - 1)}
                                        className="text-gray-500 hover:text-red-500 p-1"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="font-bold text-gray-900 w-6 text-center">{item.qty}</span>
                                    <button
                                        onClick={() => updateQty(item.id, item.qty + 1)}
                                        className="text-gray-500 hover:text-green-500 p-1"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                {/* Line Total */}
                                <p className="font-bold text-gray-900 w-20 text-right">
                                    S/ {((item.price * item.qty) / 100).toFixed(2)}
                                </p>

                                {/* Remove */}
                                <button
                                    onClick={() => removeItem(item.id)}
                                    className="text-gray-400 hover:text-red-500 p-1"
                                >
                                    <X size={16} />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Totals & Actions */}
            <div className="border-t bg-gray-50 p-4 space-y-4">
                {/* Totals */}
                <div className="space-y-2">
                    <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span className="font-mono">S/ {(subtotal / 100).toFixed(2)}</span>
                    </div>
                    {totalPaid > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Pagado</span>
                            <span className="font-mono">- S/ {(totalPaid / 100).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t">
                        <span>{isPaid ? "PAGADO" : "TOTAL"}</span>
                        <span className="font-mono">S/ {((isPaid ? subtotal : remaining) / 100).toFixed(2)}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                {!isPaid ? (
                    <button
                        onClick={() => setShowPayModal(true)}
                        disabled={items.length === 0}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30"
                    >
                        <CreditCard size={20} />
                        COBRAR S/ {(remaining / 100).toFixed(2)}
                    </button>
                ) : (
                    <button
                        onClick={handleComplete}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/30"
                    >
                        <Printer size={20} />
                        IMPRIMIR TICKET
                    </button>
                )}
            </div>

            {/* Payment Modal */}
            <AnimatePresence>
                {showPayModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6"
                        >
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Método de Pago</h3>
                            <p className="text-gray-600 mb-6">
                                Total: <span className="font-bold text-2xl text-indigo-600">S/ {(remaining / 100).toFixed(2)}</span>
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                {(["CASH", "YAPE", "PLIN", "CARD"] as const).map((method) => (
                                    <button
                                        key={method}
                                        onClick={() => handleQuickPay(method)}
                                        className="py-4 px-4 bg-gray-100 hover:bg-indigo-600 hover:text-white rounded-xl font-bold transition-all flex flex-col items-center gap-2"
                                    >
                                        {method === "CASH" ? "💵" : method === "YAPE" ? "📲" : method === "PLIN" ? "📱" : "💳"}
                                        <span>{method === "CASH" ? "Efectivo" : method}</span>
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setShowPayModal(false)}
                                className="w-full mt-4 py-3 text-gray-500 hover:text-gray-700 font-medium"
                            >
                                Cancelar
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
