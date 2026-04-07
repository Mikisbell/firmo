"use client";

/**
 * RefundModal - Process full or partial refunds for paid orders
 * Shows order items with checkboxes for partial refund selection
 * Requires reason and calculates refund amount
 */

import { useState, useMemo } from "react";
import { X, RotateCcw, Check, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CheckProjection, SaleProjection } from "@/src/core/projections/types";
import type { PaymentMethod } from "@/src/core/domain/events";

const REASON_CODES = [
    { code: "CUSTOMER_REQUEST", label: "Solicitud del cliente" },
    { code: "ORDER_ERROR", label: "Error en el pedido" },
    { code: "QUALITY_ISSUE", label: "Problema de calidad" },
    { code: "LATE_DELIVERY", label: "Entrega tardía" },
    { code: "WRONG_ITEM", label: "Producto equivocado" },
    { code: "OTHER", label: "Otro motivo" },
] as const;

type ReasonCode = (typeof REASON_CODES)[number]["code"];

interface RefundItem {
    line_id: string;
    product_id: string;
    name: string;
    qty: number;
    unit_price_cents: number;
    selected: boolean;
    refund_qty: number;
}

interface RefundModalProps {
    check: CheckProjection;
    order: SaleProjection;
    onClose: () => void;
    onConfirm: (params: {
        type: "FULL" | "PARTIAL" | "ITEM";
        reason_code: ReasonCode;
        reason_detail: string;
        refund_amount: number;
        refund_method: PaymentMethod;
        items: Array<{
            line_id: string;
            product_id: string;
            name: string;
            qty: number;
            unit_price_cents: number;
            refund_cents: number;
        }>;
    }) => void;
}

export function RefundModal({ check, order, onClose, onConfirm }: RefundModalProps) {
    const [refundMode, setRefundMode] = useState<"FULL" | "PARTIAL">("FULL");
    const [reasonCode, setReasonCode] = useState<ReasonCode | null>(null);
    const [reasonDetail, setReasonDetail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Build refund items from check lines
    const [items, setItems] = useState<RefundItem[]>(() =>
        check.lines.map((l) => {
            const lineDetail = order.lines[l.line_id];
            return {
                line_id: l.line_id,
                product_id: lineDetail?.product_id || l.line_id,
                name: lineDetail?.name || `Item ${l.line_id.slice(0, 4)}`,
                qty: l.qty,
                unit_price_cents: lineDetail?.unit_price_cents || 0,
                selected: true,
                refund_qty: l.qty,
            };
        })
    );

    // Determine refund method from first payment
    const refundMethod = check.payment.payments[0]?.method ?? "CASH";

    // Calculate total refund
    const refundAmountCents = useMemo(() => {
        if (refundMode === "FULL") return check.total_cents;
        return items
            .filter((i) => i.selected)
            .reduce((sum, i) => sum + i.unit_price_cents * i.refund_qty, 0);
    }, [refundMode, items, check.total_cents]);

    const selectedCount = items.filter((i) => i.selected).length;
    const canSubmit = reasonCode !== null && refundAmountCents > 0 && !isSubmitting;

    const toggleItem = (lineId: string) => {
        setItems((prev) =>
            prev.map((i) =>
                i.line_id === lineId ? { ...i, selected: !i.selected } : i
            )
        );
    };

    const updateRefundQty = (lineId: string, qty: number) => {
        setItems((prev) =>
            prev.map((i) =>
                i.line_id === lineId
                    ? { ...i, refund_qty: Math.max(1, Math.min(qty, i.qty)) }
                    : i
            )
        );
    };

    const handleSubmit = async () => {
        if (!canSubmit || reasonCode === null) return;
        setIsSubmitting(true);

        const selectedItems = refundMode === "FULL"
            ? items.map((i) => ({
                line_id: i.line_id,
                product_id: i.product_id,
                name: i.name,
                qty: i.qty,
                unit_price_cents: i.unit_price_cents,
                refund_cents: i.unit_price_cents * i.qty,
            }))
            : items
                .filter((i) => i.selected)
                .map((i) => ({
                    line_id: i.line_id,
                    product_id: i.product_id,
                    name: i.name,
                    qty: i.refund_qty,
                    unit_price_cents: i.unit_price_cents,
                    refund_cents: i.unit_price_cents * i.refund_qty,
                }));

        const refundType = refundMode === "FULL" ? "FULL" as const : (selectedCount === items.length ? "PARTIAL" as const : "ITEM" as const);

        onConfirm({
            type: refundType,
            reason_code: reasonCode,
            reason_detail: reasonDetail,
            refund_amount: refundAmountCents,
            refund_method: refundMethod,
            items: selectedItems,
        });
    };

    return (
        <AnimatePresence>
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
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="relative bg-white shadow-2xl overflow-hidden border border-gray-100 w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-lg md:rounded-2xl flex flex-col"
                >
                    {/* Header */}
                    <div className="bg-red-600 px-4 md:px-6 py-4 md:py-5 flex justify-between items-center flex-shrink-0">
                        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                            <RotateCcw className="w-5 h-5" />
                            Devolucion
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 bg-red-700 hover:bg-red-800 active:bg-red-900 rounded-full text-red-200 hover:text-white transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                        {/* Warning */}
                        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-bold">Esta accion no se puede deshacer.</p>
                                <p>El reembolso se registrara en el cierre de caja.</p>
                            </div>
                        </div>

                        {/* Refund Mode Toggle */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRefundMode("FULL")}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all touch-manipulation min-h-[44px] ${
                                    refundMode === "FULL"
                                        ? "bg-red-600 text-white shadow-md"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                                Devolucion Total
                            </button>
                            <button
                                onClick={() => setRefundMode("PARTIAL")}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all touch-manipulation min-h-[44px] ${
                                    refundMode === "PARTIAL"
                                        ? "bg-red-600 text-white shadow-md"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                                Devolucion Parcial
                            </button>
                        </div>

                        {/* Items Selection (partial mode) */}
                        {refundMode === "PARTIAL" && (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                    <span className="text-xs font-bold text-gray-500 uppercase">
                                        Selecciona items a devolver ({selectedCount}/{items.length})
                                    </span>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {items.map((item) => (
                                        <div
                                            key={item.line_id}
                                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                                item.selected ? "bg-red-50" : ""
                                            }`}
                                        >
                                            <button
                                                onClick={() => toggleItem(item.line_id)}
                                                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all touch-manipulation ${
                                                    item.selected
                                                        ? "bg-red-600 border-red-600 text-white"
                                                        : "border-gray-300 hover:border-gray-400"
                                                }`}
                                            >
                                                {item.selected && <Check className="w-4 h-4" />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {item.name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    S/ {(item.unit_price_cents / 100).toFixed(2)} c/u
                                                </p>
                                            </div>
                                            {item.selected && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => updateRefundQty(item.line_id, item.refund_qty - 1)}
                                                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold touch-manipulation"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="w-8 text-center text-sm font-bold tabular-nums">
                                                        {item.refund_qty}
                                                    </span>
                                                    <button
                                                        onClick={() => updateRefundQty(item.line_id, item.refund_qty + 1)}
                                                        disabled={item.refund_qty >= item.qty}
                                                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-gray-600 font-bold touch-manipulation"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            )}
                                            <span className="text-sm font-mono text-gray-600 tabular-nums">
                                                S/ {((item.selected ? item.unit_price_cents * item.refund_qty : 0) / 100).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Reason Code */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                Motivo de devolucion *
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {REASON_CODES.map((r) => (
                                    <button
                                        key={r.code}
                                        onClick={() => setReasonCode(r.code)}
                                        className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all touch-manipulation min-h-[44px] ${
                                            reasonCode === r.code
                                                ? "bg-red-600 text-white shadow-md"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reason Detail */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                Detalle (opcional)
                            </label>
                            <textarea
                                value={reasonDetail}
                                onChange={(e) => setReasonDetail(e.target.value)}
                                placeholder="Describe el motivo de la devolucion..."
                                rows={2}
                                className="w-full px-3 py-2.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-shadow resize-none"
                            />
                        </div>

                        {/* Refund Summary */}
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-red-700 uppercase">Monto a devolver</span>
                                <span className="text-2xl font-black text-red-700 tabular-nums">
                                    S/ {(refundAmountCents / 100).toFixed(2)}
                                </span>
                            </div>
                            <div className="text-xs text-red-600 mt-1">
                                Metodo: {refundMethod === "CASH" ? "Efectivo" : refundMethod === "CARD" ? "Tarjeta" : refundMethod}
                            </div>
                        </div>
                    </div>

                    {/* Confirm Button */}
                    <div className="p-4 md:p-6 pt-0 md:pt-0 flex-shrink-0 bg-white border-t border-gray-100 md:border-0">
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className={`w-full py-4 rounded-xl text-lg font-bold shadow-xl flex items-center justify-center gap-2 touch-manipulation min-h-[56px] transition-all ${
                                canSubmit
                                    ? "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white hover:shadow-2xl"
                                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            }`}
                        >
                            <RotateCcw className="w-5 h-5" />
                            {isSubmitting ? "Procesando..." : "Confirmar Devolucion"}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
