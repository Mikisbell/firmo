"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Delete, Check, X } from "lucide-react";

interface NumpadCalculatorProps {
    initialValue?: number;
    onConfirm: (value: number) => void;
    onCancel: () => void;
    label?: string;
    maxValue?: number;
}

export function NumpadCalculator({ 
    initialValue = 0, 
    onConfirm, 
    onCancel, 
    label = "Monto",
    maxValue = 999999 
}: NumpadCalculatorProps) {
    const [display, setDisplay] = useState(initialValue > 0 ? String(initialValue / 100) : "");

    const handleDigit = (digit: string) => {
        const newDisplay = display + digit;
        const value = parseFloat(newDisplay) * 100;
        if (value <= maxValue) {
            setDisplay(newDisplay);
        }
    };

    const handleDecimal = () => {
        if (!display.includes(".")) {
            setDisplay((display || "0") + ".");
        }
    };

    const handleBackspace = () => {
        setDisplay(display.slice(0, -1));
    };

    const handleClear = () => {
        setDisplay("");
    };

    const handleConfirm = () => {
        const value = Math.round(parseFloat(display || "0") * 100);
        onConfirm(value);
    };

    const currentValue = parseFloat(display || "0") * 100;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div 
                className="bg-zinc-900 rounded-2xl p-6 w-80 shadow-2xl border border-zinc-800"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center mb-4">
                    <p className="text-zinc-400 text-sm">{label}</p>
                    <div className="text-4xl font-mono font-bold text-white mt-2">
                        S/ {display || "0.00"}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    {["1", "2", "3", "C", "4", "5", "6", "⌫", "7", "8", "9", ".", "0", "00"].map(key => (
                        <button
                            key={key}
                            onClick={() => {
                                if (key === "⌫") handleBackspace();
                                else if (key === "C") handleClear();
                                else if (key === ".") handleDecimal();
                                else if (key === "00") { handleDigit("0"); handleDigit("0"); }
                                else handleDigit(key);
                            }}
                            className={`min-h-[60px] h-[60px] rounded-xl text-white text-xl font-bold transition-colors active:scale-95 touch-manipulation ${
                                key === "C" 
                                    ? "bg-amber-600 hover:bg-amber-500 active:bg-amber-400" 
                                    : "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600"
                            }`}
                        >
                            {key === "⌫" ? <Delete className="mx-auto" size={20} /> : key}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                        onClick={onCancel}
                        className="min-h-[56px] h-14 rounded-xl bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-zinc-300 font-bold flex items-center justify-center gap-2 touch-manipulation"
                    >
                        <X size={18} /> Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={currentValue <= 0}
                        className="min-h-[56px] h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-2 touch-manipulation"
                    >
                        <Check size={18} /> Confirmar
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
