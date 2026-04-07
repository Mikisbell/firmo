'use client';

import { useState } from 'react';
import { X, Percent, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

interface DiscountModalProps {
    subtotalCents: number;
    currentDiscountCents: number;
    onClose: () => void;
    onApply: (type: "PERCENTAGE" | "FIXED", value: number) => void;
}

const QUICK_PERCENTAGES = [5, 10, 15, 20];

export function DiscountModal({ subtotalCents, currentDiscountCents, onClose, onApply }: DiscountModalProps) {
    const [mode, setMode] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
    const [customValue, setCustomValue] = useState("");

    const previewCents = mode === "PERCENTAGE"
        ? Math.round(subtotalCents * (Number(customValue) || 0) / 100)
        : Math.round((Number(customValue) || 0) * 100);

    const handleApplyCustom = () => {
        const val = Number(customValue);
        if (!val || val <= 0) return;

        if (mode === "PERCENTAGE") {
            if (val > 100) return;
            onApply("PERCENTAGE", val);
        } else {
            const fixedCents = Math.round(val * 100);
            if (fixedCents > subtotalCents) return;
            onApply("FIXED", fixedCents);
        }
    };

    const handleRemoveDiscount = () => {
        onApply("FIXED", 0);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="relative bg-white shadow-2xl overflow-hidden border border-gray-100 w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-sm md:rounded-2xl flex flex-col"
            >
                {/* Header */}
                <div className="bg-amber-500 px-5 py-4 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Percent className="w-5 h-5" />
                        Descuento
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 bg-amber-600 hover:bg-amber-700 rounded-full text-white transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Current discount info */}
                    {currentDiscountCents > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-amber-700 uppercase">Descuento actual</p>
                                <p className="text-lg font-mono font-bold text-amber-900">
                                    - S/ {(currentDiscountCents / 100).toFixed(2)}
                                </p>
                            </div>
                            <button
                                onClick={handleRemoveDiscount}
                                className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold transition-colors min-h-[44px] touch-manipulation"
                            >
                                Quitar
                            </button>
                        </div>
                    )}

                    {/* Subtotal reference */}
                    <div className="text-center">
                        <span className="text-xs font-bold text-gray-500 uppercase">Subtotal</span>
                        <div className="text-2xl font-mono font-bold text-gray-900">
                            S/ {(subtotalCents / 100).toFixed(2)}
                        </div>
                    </div>

                    {/* Quick percentage buttons */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Descuento rapido</p>
                        <div className="grid grid-cols-4 gap-2">
                            {QUICK_PERCENTAGES.map(pct => {
                                const discountPreview = Math.round(subtotalCents * pct / 100);
                                return (
                                    <button
                                        key={pct}
                                        onClick={() => onApply("PERCENTAGE", pct)}
                                        className="flex flex-col items-center py-3 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors min-h-[64px] touch-manipulation"
                                    >
                                        <span className="text-lg font-bold text-amber-700">{pct}%</span>
                                        <span className="text-[10px] text-amber-500 font-mono">
                                            -S/{(discountPreview / 100).toFixed(2)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Mode toggle */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Monto personalizado</p>
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => { setMode("PERCENTAGE"); setCustomValue(""); }}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2 min-h-[44px] touch-manipulation ${
                                    mode === "PERCENTAGE"
                                        ? "border-amber-500 bg-amber-50 text-amber-700"
                                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                                <Percent className="w-4 h-4" />
                                Porcentaje
                            </button>
                            <button
                                onClick={() => { setMode("FIXED"); setCustomValue(""); }}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2 min-h-[44px] touch-manipulation ${
                                    mode === "FIXED"
                                        ? "border-amber-500 bg-amber-50 text-amber-700"
                                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                                <DollarSign className="w-4 h-4" />
                                Monto Fijo
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={customValue}
                                    onChange={(e) => setCustomValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleApplyCustom(); }}
                                    placeholder={mode === "PERCENTAGE" ? "Ej: 12" : "Ej: 5.00"}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-lg font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent min-h-[48px]"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                                    {mode === "PERCENTAGE" ? "%" : "S/"}
                                </span>
                            </div>
                            <button
                                onClick={handleApplyCustom}
                                disabled={!customValue || Number(customValue) <= 0}
                                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors min-h-[48px] touch-manipulation"
                            >
                                Aplicar
                            </button>
                        </div>

                        {/* Preview */}
                        {customValue && Number(customValue) > 0 && (
                            <div className="mt-2 text-center">
                                <span className="text-sm text-gray-500">
                                    Descuento: <span className="font-bold text-amber-700">- S/ {(previewCents / 100).toFixed(2)}</span>
                                </span>
                                <span className="text-sm text-gray-400 ml-2">
                                    Total: S/ {(Math.max(0, subtotalCents - previewCents) / 100).toFixed(2)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
