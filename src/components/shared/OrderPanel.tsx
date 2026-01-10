"use client";

import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "@/src/core/domain/money";
import { LineItemList, LineItemData } from "./LineItem";
import {
    QrCode,
    Printer,
    Send,
    CreditCard,
    Banknote,
    Smartphone,
    Receipt
} from "lucide-react";
import { useState } from "react";

// Mode determines which buttons are visible
export type OrderPanelMode = "waiter" | "cashier";

interface OrderPanelProps {
    mode: OrderPanelMode;
    items: LineItemData[];
    subtotalCents: number;
    orderNumber?: number;
    tableId?: string;
    checkName?: string;

    // Item actions
    onIncrement?: (lineId: string) => void;
    onDecrement?: (lineId: string) => void;
    onRemove?: (lineId: string) => void;

    // Waiter actions
    onSendToKitchen?: () => void;
    onCallBill?: () => void;
    onPrintPrecheck?: () => void;

    // Cashier actions
    onPayCash?: () => void;
    onPayYape?: () => void;
    onPayCard?: () => void;
    onIssueInvoice?: (type: "BOLETA" | "FACTURA") => void;
    onPrintReceipt?: () => void;

    // Common
    onShowQR?: () => void;

    // State flags
    isPaid?: boolean;
    isLoading?: boolean;
    
    // Layout
    compact?: boolean;  // For mobile bottom sheet mode
}

export function OrderPanel({
    mode,
    items,
    subtotalCents,
    orderNumber,
    tableId,
    checkName = "Cuenta 1",
    onIncrement,
    onDecrement,
    onRemove,
    onSendToKitchen,
    onCallBill,
    onPrintPrecheck,
    onPayCash,
    onPayYape,
    onPayCard,
    onIssueInvoice,
    onPrintReceipt,
    onShowQR: _onShowQR,
    isPaid = false,
    isLoading = false,
    compact = false,
}: OrderPanelProps) {
    const [showQR, setShowQR] = useState(false);

    const itemCount = items.reduce((a, b) => a + b.qty, 0);
    const isWaiter = mode === "waiter";
    const isCashier = mode === "cashier";

    // Compact mode: render without the aside wrapper (for use in BottomSheet)
    if (compact) {
        return (
            <div className="flex flex-col h-full">
                {/* Items List */}
                <div className="flex-1 overflow-y-auto">
                    <LineItemList
                        items={items}
                        onIncrement={onIncrement}
                        onDecrement={onDecrement}
                        onRemove={onRemove}
                        readonly={isPaid}
                    />
                </div>

                {/* Summary & Actions - Sticky at bottom */}
                <div className="sticky bottom-0 pt-3 pb-safe border-t border-zinc-800/50 bg-zinc-900 space-y-3">
                    {/* Totals */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm text-zinc-400">
                            <span>Subtotal ({itemCount} items)</span>
                            <span>S/ {formatCents(subtotalCents)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold">
                            <span>Total</span>
                            <span className="text-park-brand-500">S/ {formatCents(subtotalCents)}</span>
                        </div>
                    </div>

                    {/* WAITER MODE ACTIONS - Compact */}
                    {isWaiter && !isPaid && (
                        <>
                            <button
                                onClick={onSendToKitchen}
                                disabled={items.length === 0 || isLoading}
                                className="w-full py-4 bg-park-brand-500 hover:bg-park-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-park-brand-500/20 min-h-[56px]"
                            >
                                <Send size={20} />
                                <span>ENVIAR A COCINA</span>
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={onPrintPrecheck}
                                    className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium text-sm transition-colors min-h-[48px]"
                                >
                                    <Printer size={18} />
                                    <span>Pre-cuenta</span>
                                </button>
                                <button
                                    onClick={onCallBill}
                                    disabled={items.length === 0}
                                    className="flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors min-h-[48px]"
                                >
                                    <Receipt size={18} />
                                    <span>Pedir Cuenta</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* CASHIER MODE ACTIONS - Compact */}
                    {isCashier && !isPaid && (
                        <>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={onPayCash}
                                    disabled={items.length === 0}
                                    className="flex flex-col items-center justify-center gap-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors min-h-[64px]"
                                >
                                    <Banknote size={24} />
                                    <span>CASH</span>
                                </button>
                                <button
                                    onClick={onPayYape}
                                    disabled={items.length === 0}
                                    className="flex flex-col items-center justify-center gap-1 py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors min-h-[64px]"
                                >
                                    <Smartphone size={24} />
                                    <span>YAPE</span>
                                </button>
                                <button
                                    onClick={onPayCard}
                                    disabled={items.length === 0}
                                    className="flex flex-col items-center justify-center gap-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors min-h-[64px]"
                                >
                                    <CreditCard size={24} />
                                    <span>TARJETA</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <aside className="w-80 lg:w-96 border-l border-zinc-800/50 bg-zinc-900/30 flex flex-col shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800/50">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-lg text-white">
                            {tableId ? `Mesa ${tableId}` : checkName}
                        </h2>
                        {orderNumber && (
                            <span className="text-xs text-zinc-500">Pedido #{orderNumber}</span>
                        )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isPaid
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-park-brand-500/20 text-park-brand-500"
                        }`}>
                        {isPaid ? "PAGADO" : `${itemCount} items`}
                    </span>
                </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4">
                <LineItemList
                    items={items}
                    onIncrement={onIncrement}
                    onDecrement={onDecrement}
                    onRemove={onRemove}
                    readonly={isPaid}
                />
            </div>

            {/* Summary & Actions */}
            <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/50 space-y-3">
                {/* Totals */}
                <div className="space-y-1">
                    <div className="flex justify-between text-sm text-zinc-400">
                        <span>Subtotal</span>
                        <span>S/ {formatCents(subtotalCents)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-park-brand-500">S/ {formatCents(subtotalCents)}</span>
                    </div>
                </div>

                {/* QR Code Section (Both modes) */}
                <AnimatePresence>
                    {showQR && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 bg-white rounded-lg text-center">
                                <div className="w-32 h-32 mx-auto bg-zinc-100 rounded-lg flex items-center justify-center mb-2">
                                    {/* Placeholder QR */}
                                    <div className="grid grid-cols-5 gap-1 p-2">
                                        {[...Array(25)].map((_, i) => (
                                            <div key={i} className={`w-4 h-4 ${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`} />
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-600">Escanear para pagar con Yape/Plin</p>
                                <p className="font-bold text-black">S/ {formatCents(subtotalCents)}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* WAITER MODE ACTIONS */}
                {isWaiter && !isPaid && (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setShowQR(!showQR)}
                                className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium text-sm transition-colors"
                            >
                                <QrCode size={16} />
                                <span>QR Pago</span>
                            </button>
                            <button
                                onClick={onPrintPrecheck}
                                className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium text-sm transition-colors"
                            >
                                <Printer size={16} />
                                <span>Pre-cuenta</span>
                            </button>
                        </div>

                        <button
                            onClick={onSendToKitchen}
                            disabled={items.length === 0 || isLoading}
                            className="w-full py-3 bg-park-brand-500 hover:bg-park-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-park-brand-500/20"
                        >
                            <Send size={16} />
                            <span>ENVIAR A COCINA</span>
                        </button>

                        <button
                            onClick={onCallBill}
                            disabled={items.length === 0}
                            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            <Receipt size={16} />
                            <span>LLAMAR CUENTA</span>
                        </button>
                    </>
                )}

                {/* CASHIER MODE ACTIONS */}
                {isCashier && !isPaid && (
                    <>
                        {/* Payment Methods */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={onPayCash}
                                disabled={items.length === 0}
                                className="flex flex-col items-center justify-center gap-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg font-medium text-xs transition-colors"
                            >
                                <Banknote size={20} />
                                <span>CASH</span>
                            </button>
                            <button
                                onClick={onPayYape}
                                disabled={items.length === 0}
                                className="flex flex-col items-center justify-center gap-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-medium text-xs transition-colors"
                            >
                                <Smartphone size={20} />
                                <span>YAPE</span>
                            </button>
                            <button
                                onClick={onPayCard}
                                disabled={items.length === 0}
                                className="flex flex-col items-center justify-center gap-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-xs transition-colors"
                            >
                                <CreditCard size={20} />
                                <span>TARJETA</span>
                            </button>
                        </div>

                        {/* Invoice Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => onIssueInvoice?.("BOLETA")}
                                disabled={items.length === 0}
                                className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors"
                            >
                                <Receipt size={16} />
                                <span>Boleta</span>
                            </button>
                            <button
                                onClick={() => onIssueInvoice?.("FACTURA")}
                                disabled={items.length === 0}
                                className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors"
                            >
                                <Receipt size={16} />
                                <span>Factura</span>
                            </button>
                        </div>
                    </>
                )}

                {/* Post-payment actions */}
                {isPaid && (
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={onPrintReceipt}
                            className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium text-sm transition-colors"
                        >
                            <Printer size={16} />
                            <span>Imprimir</span>
                        </button>
                        <button
                            onClick={() => setShowQR(!showQR)}
                            className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium text-sm transition-colors"
                        >
                            <QrCode size={16} />
                            <span>QR</span>
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
