"use client";

/**
 * PaymentModal - Payment processing modal
 * Fullscreen on mobile, centered modal on desktop
 * Shows QR code for Yape/Plin digital payments
 * Includes tip selection, auto-change calculation, and quick-pay buttons
 *
 * Task 13.3 - Mobile Responsive Spec
 * Requirements: 8.4
 */

import { useState, useEffect, useMemo } from "react";
import { X, CreditCard, Banknote, Smartphone, Check, Wallet, Loader2, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePaymentQR } from "@/src/hooks/usePaymentQR";

interface PaymentModalProps {
    totalDueCents: number;
    remainingCents: number;
    subtotalCents?: number;
    tipCents?: number;
    orderNumber?: number | string;
    onClose: () => void;
    onConfirm: (method: "CASH" | "CARD" | "YAPE" | "PLIN", amountCents: number, reference?: string) => void;
    onTipChange?: (tipCents: number) => void;
}

const TIP_OPTIONS = [
    { label: "Sin propina", percent: 0 },
    { label: "10%", percent: 10 },
    { label: "15%", percent: 15 },
    { label: "20%", percent: 20 },
] as const;

export function PaymentModal({ totalDueCents, remainingCents, subtotalCents, tipCents = 0, orderNumber, onClose, onConfirm, onTipChange }: PaymentModalProps) {
    const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
    const [selectedMethod, setSelectedMethod] = useState<"CASH" | "CARD" | "YAPE" | "PLIN">("CASH");
    const [reference, setReference] = useState("");
    const [selectedTipPercent, setSelectedTipPercent] = useState<number | null>(tipCents > 0 ? null : 0);
    const [customTipInput, setCustomTipInput] = useState("");
    const { qrData, isLoading: qrLoading, error: qrError, generateQR, clearQR } = usePaymentQR();

    // Base for tip calculation: subtotal (before tip)
    const tipBaseCents = subtotalCents ?? (totalDueCents - tipCents);

    // Active tip in centavos
    const activeTipCents = useMemo(() => {
        if (selectedTipPercent !== null && selectedTipPercent > 0) {
            return Math.round(tipBaseCents * selectedTipPercent / 100);
        }
        const custom = parseFloat(customTipInput);
        if (!isNaN(custom) && custom > 0) {
            return Math.round(custom * 100);
        }
        return 0;
    }, [selectedTipPercent, customTipInput, tipBaseCents]);

    const isDigitalMethod = selectedMethod === "YAPE" || selectedMethod === "PLIN";

    // Total with tip applied
    const effectiveRemainingCents = remainingCents - tipCents + activeTipCents;

    // Sync amount input when remaining changes due to tip
    useEffect(() => {
        if (!isDigitalMethod) {
            setAmount((effectiveRemainingCents / 100).toFixed(2));
        }
    }, [effectiveRemainingCents, isDigitalMethod]);

    // Notify parent of tip changes
    useEffect(() => {
        if (onTipChange && activeTipCents !== tipCents) {
            onTipChange(activeTipCents);
        }
    }, [activeTipCents, onTipChange, tipCents]);

    // Change calculation for cash
    const enteredAmountCents = Math.round((parseFloat(amount) || 0) * 100);
    const changeCents = enteredAmountCents - effectiveRemainingCents;
    const isShortfall = changeCents < 0;

    // Generate QR when Yape/Plin selected
    useEffect(() => {
        if (isDigitalMethod && effectiveRemainingCents > 0) {
            generateQR(selectedMethod, effectiveRemainingCents, orderNumber ?? 0);
        } else {
            clearQR();
        }
    }, [selectedMethod, effectiveRemainingCents, orderNumber, isDigitalMethod, generateQR, clearQR]);

    const handleConfirm = () => {
        if (isDigitalMethod) {
            if (!reference.trim()) return;
            onConfirm(selectedMethod, effectiveRemainingCents, reference.trim());
        } else {
            const val = parseFloat(amount);
            if (isNaN(val) || val <= 0) return;
            onConfirm(selectedMethod, Math.round(val * 100));
        }
    };

    const handleQuickPay = (method: "CASH" | "CARD" | "YAPE") => {
        if (method === "CASH") {
            onConfirm("CASH", effectiveRemainingCents);
        } else if (method === "CARD") {
            onConfirm("CARD", effectiveRemainingCents);
        } else {
            setSelectedMethod("YAPE");
        }
    };

    // Round up to next S/5 or S/10
    const roundUpAmount = useMemo(() => {
        const soles = effectiveRemainingCents / 100;
        const next5 = Math.ceil(soles / 5) * 5;
        const next10 = Math.ceil(soles / 10) * 10;
        // Use next5 if it's different from current, otherwise next10
        if (next5 * 100 > effectiveRemainingCents) return next5 * 100;
        return next10 * 100;
    }, [effectiveRemainingCents]);

    const shortcuts = [10, 20, 50, 100];

    const methods = [
        { id: "CASH", label: "Efectivo", icon: Banknote, selected: "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500", iconBg: "bg-emerald-200", iconText: "text-emerald-700", checkText: "text-emerald-600" },
        { id: "CARD", label: "Tarjeta", icon: CreditCard, selected: "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500", iconBg: "bg-blue-200", iconText: "text-blue-700", checkText: "text-blue-600" },
        { id: "YAPE", label: "Yape", icon: Smartphone, selected: "border-purple-500 bg-purple-50 text-purple-700 ring-1 ring-purple-500", iconBg: "bg-purple-200", iconText: "text-purple-700", checkText: "text-purple-600" },
        { id: "PLIN", label: "Plin", icon: Smartphone, selected: "border-cyan-500 bg-cyan-50 text-cyan-700 ring-1 ring-cyan-500", iconBg: "bg-cyan-200", iconText: "text-cyan-700", checkText: "text-cyan-600" },
    ] as const;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal - Fullscreen on mobile, centered on desktop */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="
                        relative bg-white shadow-2xl overflow-hidden border border-gray-100
                        w-full h-full md:h-auto md:max-h-[90vh]
                        md:w-full md:max-w-md md:rounded-2xl
                        flex flex-col
                    "
                >
                    {/* Header */}
                    <div className="bg-gray-900 px-4 md:px-6 py-4 md:py-5 flex justify-between items-center flex-shrink-0">
                        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-emerald-400" />
                            Procesar Pago
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-full text-gray-400 hover:text-white transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
                        {/* Amount Display with Tip Breakdown */}
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-1">Monto Pendiente</span>
                            <div className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight tabular-nums">
                                <span className="text-xl md:text-2xl text-gray-400 mr-1">S/</span>
                                {(effectiveRemainingCents / 100).toFixed(2)}
                            </div>
                            {activeTipCents > 0 ? (
                                <div className="mt-2 flex flex-col items-center gap-1">
                                    <div className="text-xs text-gray-500 font-medium">
                                        Subtotal: S/ {(tipBaseCents / 100).toFixed(2)} + Propina: S/ {(activeTipCents / 100).toFixed(2)}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-2 text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                                    Total Orden: S/ {(totalDueCents / 100).toFixed(2)}
                                </div>
                            )}
                        </div>

                        {/* Tip Section */}
                        {onTipChange && (
                            <div className="bg-amber-50 p-3 md:p-4 rounded-xl border border-amber-200">
                                <label className="block text-xs font-bold text-amber-700 uppercase mb-2">Propina</label>
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                    {TIP_OPTIONS.map((opt) => {
                                        const isActive = selectedTipPercent === opt.percent && customTipInput === "";
                                        const tipAmountForOption = opt.percent > 0 ? Math.round(tipBaseCents * opt.percent / 100) : 0;
                                        return (
                                            <button
                                                key={opt.percent}
                                                onClick={() => {
                                                    setSelectedTipPercent(opt.percent);
                                                    setCustomTipInput("");
                                                }}
                                                className={`
                                                    py-2.5 rounded-lg text-sm font-bold transition-all touch-manipulation min-h-[44px]
                                                    ${isActive
                                                        ? "bg-amber-500 text-white shadow-md"
                                                        : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 active:bg-amber-200"
                                                    }
                                                `}
                                            >
                                                <div>{opt.label}</div>
                                                {opt.percent > 0 && (
                                                    <div className={`text-[10px] ${isActive ? "text-amber-100" : "text-amber-500"}`}>
                                                        S/ {(tipAmountForOption / 100).toFixed(2)}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 font-bold text-sm">S/</span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="Monto personalizado"
                                        value={customTipInput}
                                        onChange={(e) => {
                                            setCustomTipInput(e.target.value);
                                            setSelectedTipPercent(null);
                                        }}
                                        className="w-full pl-8 pr-4 py-2.5 text-sm font-medium text-gray-900 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-shadow"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Quick Pay Buttons */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => handleQuickPay("CASH")}
                                className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all touch-manipulation min-h-[48px]"
                            >
                                <Banknote className="w-4 h-4" />
                                Efectivo S/ {(effectiveRemainingCents / 100).toFixed(2)}
                            </button>
                            <button
                                onClick={() => handleQuickPay("CARD")}
                                className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all touch-manipulation min-h-[48px]"
                            >
                                <CreditCard className="w-4 h-4" />
                                Tarjeta
                            </button>
                            <button
                                onClick={() => setAmount((roundUpAmount / 100).toFixed(2))}
                                className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white font-bold text-sm transition-all touch-manipulation min-h-[48px]"
                            >
                                Redondear S/ {(roundUpAmount / 100).toFixed(0)}
                            </button>
                        </div>

                        {/* Payment Methods */}
                        <div className="grid grid-cols-2 gap-2 md:gap-3">
                            {methods.map((m) => {
                                const isSelected = selectedMethod === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedMethod(m.id)}
                                        className={`
                                            relative p-3 md:p-4 rounded-xl border flex flex-col items-center gap-2 md:gap-3
                                            transition-all duration-200 group touch-manipulation min-h-[80px] md:min-h-[100px]
                                            ${isSelected
                                                ? `${m.selected} shadow-md`
                                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 text-gray-600"
                                            }
                                        `}
                                    >
                                        <div className={`p-2 rounded-full ${isSelected ? m.iconBg : "bg-gray-100 group-hover:bg-white"} transition-colors`}>
                                            <m.icon className={`w-5 h-5 md:w-6 md:h-6 ${isSelected ? m.iconText : "text-gray-500"}`} />
                                        </div>
                                        <span className="font-bold text-sm">{m.label}</span>
                                        {isSelected && (
                                            <motion.div
                                                layoutId="check"
                                                className={`absolute top-2 right-2 ${m.checkText}`}
                                            >
                                                <Check className="w-4 h-4" />
                                            </motion.div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* QR Code Section (Yape/Plin) */}
                        {isDigitalMethod && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200"
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                        <QrCode className="w-4 h-4" />
                                        QR de Pago {selectedMethod}
                                    </div>

                                    {qrLoading && (
                                        <div className="w-[200px] h-[200px] flex items-center justify-center bg-white rounded-lg border border-gray-200">
                                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                                        </div>
                                    )}

                                    {qrError && (
                                        <div className="w-full text-center py-4">
                                            <p className="text-sm text-red-600 font-medium">{qrError}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Configure {selectedMethod} en Administración → Yape/Plin
                                            </p>
                                        </div>
                                    )}

                                    {qrData && !qrLoading && (
                                        <>
                                            <img
                                                src={qrData.qrDataUrl}
                                                alt={`QR ${selectedMethod}`}
                                                className="w-[200px] h-[200px] rounded-lg border border-gray-200 bg-white p-1"
                                            />
                                            <p className="text-xs text-gray-500 text-center">
                                                {selectedMethod} de{" "}
                                                <span className="font-bold text-gray-700">
                                                    {qrData.merchantName ?? qrData.merchantPhone}
                                                </span>
                                            </p>
                                        </>
                                    )}

                                    {/* Reference input */}
                                    <div className="w-full mt-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            Nro. Operación {selectedMethod}
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            placeholder="Ingrese el número de operación"
                                            className="w-full px-3 py-2.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-shadow"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Cash/Card Input Area */}
                        {!isDigitalMethod && (
                            <div className="bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">A Pagar Ahora</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">S/</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full pl-8 pr-4 py-3 text-xl md:text-2xl font-bold text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow text-center min-h-[56px]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 w-14 md:w-16">
                                        {shortcuts.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setAmount(s.toString())}
                                                className="bg-white border hover:bg-gray-50 active:bg-gray-100 text-gray-600 text-xs font-bold py-1.5 rounded shadow-sm active:scale-95 transition-transform touch-manipulation min-h-[32px]"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Auto-Calculate Change */}
                                {selectedMethod === "CASH" && enteredAmountCents > 0 && (
                                    <div className={`mt-3 text-center py-2.5 px-4 rounded-lg font-bold tabular-nums ${
                                        isShortfall
                                            ? "bg-red-50 border border-red-200 text-red-600"
                                            : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                    }`}>
                                        <span className="text-xs uppercase tracking-wider block mb-0.5">
                                            {isShortfall ? "Falta" : "Vuelto"}
                                        </span>
                                        <span className="text-2xl md:text-3xl">
                                            S/ {(Math.abs(changeCents) / 100).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Confirm Button - Sticky at bottom on mobile */}
                    <div className="p-4 md:p-6 pt-0 md:pt-0 flex-shrink-0 bg-white border-t border-gray-100 md:border-0">
                        <button
                            onClick={handleConfirm}
                            disabled={isDigitalMethod && !reference.trim()}
                            className={`
                                w-full py-4 rounded-xl text-lg font-bold shadow-xl flex items-center justify-center gap-2 touch-manipulation min-h-[56px] transition-all
                                ${isDigitalMethod && !reference.trim()
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-gray-900 hover:bg-black active:bg-gray-800 text-white hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0"
                                }
                            `}
                        >
                            <span>{isDigitalMethod ? "Pago Recibido" : "Confirmar Pago"}</span>
                            <div className={`${isDigitalMethod && !reference.trim() ? "bg-gray-400/30" : "bg-white/20"} p-1 rounded-full`}>
                                <Check className="w-4 h-4" />
                            </div>
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
