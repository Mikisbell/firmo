import { useState } from "react";
import { X, CreditCard, Banknote, Smartphone, Check, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentModalProps {
    totalDueCents: number;
    remainingCents: number;
    onClose: () => void;
    onConfirm: (method: "CASH" | "CARD" | "YAPE" | "PLIN", amountCents: number) => void;
}

export function PaymentModal({ totalDueCents, remainingCents, onClose, onConfirm }: PaymentModalProps) {
    const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
    const [selectedMethod, setSelectedMethod] = useState<"CASH" | "CARD" | "YAPE" | "PLIN">("CASH");

    const handleConfirm = () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) return;
        onConfirm(selectedMethod, Math.round(val * 100));
    };

    const shortcuts = [10, 20, 50, 100];

    const methods = [
        { id: "CASH", label: "Efectivo", icon: Banknote, color: "emerald" },
        { id: "CARD", label: "Tarjeta", icon: CreditCard, color: "blue" },
        { id: "YAPE", label: "Yape", icon: Smartphone, color: "purple" },
        { id: "PLIN", label: "Plin", icon: Smartphone, color: "cyan" },
    ] as const;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
                >
                    {/* Header */}
                    <div className="bg-gray-900 px-6 py-5 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-emerald-400" />
                            Procesar Pago
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Amount Display */}
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-1">Monto Pendiente</span>
                            <div className="text-5xl font-black text-gray-900 tracking-tight">
                                <span className="text-2xl text-gray-400 mr-1">S/</span>
                                {(remainingCents / 100).toFixed(2)}
                            </div>
                            <div className="mt-2 text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                                Total Orden: S/ {(totalDueCents / 100).toFixed(2)}
                            </div>
                        </div>

                        {/* Payment Methods */}
                        <div className="grid grid-cols-2 gap-3">
                            {methods.map((m) => {
                                const isSelected = selectedMethod === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedMethod(m.id)}
                                        className={`relative p-4 rounded-xl border flex flex-col items-center gap-3 transition-all duration-200 group ${isSelected
                                            ? `border-${m.color}-500 bg-${m.color}-50 text-${m.color}-700 shadow-md ring-1 ring-${m.color}-500`
                                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600"
                                            }`}
                                    >
                                        <div className={`p-2 rounded-full ${isSelected ? `bg-${m.color}-200` : "bg-gray-100 group-hover:bg-white"} transition-colors`}>
                                            <m.icon className={`w-6 h-6 ${isSelected ? `text-${m.color}-700` : "text-gray-500"}`} />
                                        </div>
                                        <span className="font-bold text-sm">{m.label}</span>
                                        {isSelected && (
                                            <motion.div
                                                layoutId="check"
                                                className={`absolute top-2 right-2 text-${m.color}-600`}
                                            >
                                                <Check className="w-4 h-4" />
                                            </motion.div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Input Area */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">A Pagar Ahora</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">S/</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-3 text-2xl font-bold text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow text-center"
                                    />
                                </div>
                                <div className="flex flex-col gap-1 w-16">
                                    {shortcuts.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setAmount(s.toString())}
                                            className="bg-white border hover:bg-gray-50 text-gray-600 text-xs font-bold py-1 rounded shadow-sm active:scale-95 transition-transform"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Confirm Button */}
                        <button
                            onClick={handleConfirm}
                            className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl text-lg font-bold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                        >
                            <span>Confirmar Pago</span>
                            <div className="bg-white/20 p-1 rounded-full">
                                <Check className="w-4 h-4" />
                            </div>
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
