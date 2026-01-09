import { useState } from "react";
import { X, FileText, Printer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InvoiceModalProps {
    checkId: string;
    totalCents: number;
    onClose: () => void;
    onIssue: (type: "BOLETA" | "FACTURA") => void;
}

export function InvoiceModal({ checkId: _checkId, totalCents, onClose, onIssue }: InvoiceModalProps) {
    const [type, setType] = useState<"BOLETA" | "FACTURA">("BOLETA");
    const [docNumber, setDocNumber] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const handleIssue = async () => {
        setIsProcessing(true);
        // Simulate processing delay for UX sweetness
        await new Promise(r => setTimeout(r, 800));
        onIssue(type);
        setIsProcessing(false);
    };

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
                    className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
                >
                    {/* Header */}
                    <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-800 to-indigo-950" />
                        <h2 className="relative text-xl font-bold text-white flex items-center gap-2">
                            <Printer className="w-5 h-5 text-indigo-300" />
                            Emitir Comprobante
                        </h2>
                        <button
                            onClick={onClose}
                            className="relative p-2 bg-indigo-800/50 hover:bg-indigo-700 rounded-full text-indigo-200 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Type Selection */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                            {(["BOLETA", "FACTURA"] as const).map((t) => {
                                const isSelected = type === t;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => setType(t)}
                                        className={`relative py-2.5 text-sm font-bold rounded-lg transition-all ${isSelected
                                            ? "bg-white text-indigo-700 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                            }`}
                                    >
                                        {isSelected && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className="absolute inset-0 bg-white rounded-lg shadow-sm z-0"
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            />
                                        )}
                                        <span className="relative z-10">{t}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Amount Card */}
                        <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col items-center">
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Total a Facturar</span>
                            <div className="text-3xl font-black text-indigo-900">
                                S/ {(totalCents / 100).toFixed(2)}
                            </div>
                        </div>

                        {/* Client Data */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">
                                {type === "FACTURA" ? "RUC del Cliente" : "DNI (Opcional)"}
                            </label>
                            <input
                                type="text"
                                value={docNumber}
                                onChange={(e) => setDocNumber(e.target.value)}
                                placeholder={type === "FACTURA" ? "Ingrese RUC válido (11 dígitos)" : "Ingrese DNI"}
                                className="w-full p-4 text-lg font-mono tracking-wide border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>

                        {/* Issue Button */}
                        <button
                            onClick={handleIssue}
                            disabled={isProcessing || (type === "FACTURA" && docNumber.length < 11)}
                            className={`w-full py-4 rounded-xl text-lg font-bold flex justify-center items-center gap-3 transition-all relative overflow-hidden group ${isProcessing
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0"
                                }`}
                        >
                            {isProcessing ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                >
                                    <Printer className="w-5 h-5" />
                                </motion.div>
                            ) : (
                                <>
                                    <FileText className="w-5 h-5" />
                                    <span>Generar {type}</span>
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
