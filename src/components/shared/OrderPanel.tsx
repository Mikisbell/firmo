"use client";

import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "@/src/core/domain/money";
import { LineItemList, LineItemData } from "./LineItem";
import { SwipeableItem } from "@/src/components/ui/SwipeableItem";
import { useResponsive } from "@/src/hooks/useResponsive";
import {
    QrCode,
    Printer,
    Send,
    CreditCard,
    Banknote,
    Smartphone,
    Receipt,
    Trash2,
    ArrowLeftRight,
    Scissors,
} from "lucide-react";
import { useState, useMemo } from "react";

// Mode determines which buttons are visible
export type OrderPanelMode = "waiter" | "cashier";

// Layout mode: sidebar (desktop), sheet (mobile), or auto (detect)
export type OrderPanelLayout = "sidebar" | "sheet" | "auto";

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
    onAddNote?: (lineId: string) => void;

    // Waiter actions
    onSendToKitchen?: () => void;
    onCallBill?: () => void;
    onPrintPrecheck?: () => void;
    onTransferTable?: () => void;
    onSplitBill?: () => void;

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
    layout?: OrderPanelLayout;  // 'auto' detects viewport, 'sidebar' forces desktop, 'sheet' forces mobile
    compact?: boolean;  // Deprecated: use layout="sheet" instead
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
    onAddNote,
    onSendToKitchen,
    onCallBill,
    onPrintPrecheck,
    onTransferTable,
    onSplitBill,
    onPayCash,
    onPayYape,
    onPayCard,
    onIssueInvoice,
    onPrintReceipt,
    onShowQR: _onShowQR,
    isPaid = false,
    isLoading = false,
    layout = "auto",
    compact = false,
}: OrderPanelProps) {
    const [showQR, setShowQR] = useState(false);
    const { isMobile } = useResponsive();

    // Optimización: Memoizar conteo de items para evitar reduce en cada render
    const itemCount = useMemo(() => {
        return items.reduce((a, b) => a + b.qty, 0);
    }, [items]);
    
    const isWaiter = mode === "waiter";
    const isCashier = mode === "cashier";

    // Determine effective layout based on mode and viewport
    const effectiveLayout = useMemo(() => {
        if (layout === "auto") {
            return isMobile ? "sheet" : "sidebar";
        }
        return layout;
    }, [layout, isMobile]);

    // Use sheet layout if compact is true (backwards compatibility)
    const isSheetMode = effectiveLayout === "sheet" || compact;

    // Sheet/Compact mode: render without the aside wrapper (for use in BottomSheet)
    if (isSheetMode) {
        return (
            <div className="flex flex-col h-full">
                {/* Items List with Swipeable support on mobile */}
                <div className="flex-1 overflow-y-auto px-1">
                    {items.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600">
                            <p className="text-sm">Sin productos aún</p>
                            <p className="text-xs mt-1 opacity-60">Toca para agregar</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {items.map((item) => (
                                    <SwipeableItem
                                        key={item.line_id}
                                        onSwipeLeft={() => onRemove?.(item.line_id)}
                                        disabled={isPaid}
                                        rightAction={<Trash2 size={20} />}
                                        rightActionClassName="bg-red-500"
                                    >
                                        <MobileLineItem
                                            item={item}
                                            onIncrement={onIncrement}
                                            onDecrement={onDecrement}
                                            onAddNote={!isPaid ? onAddNote : undefined}
                                            readonly={isPaid}
                                        />
                                    </SwipeableItem>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Summary & Actions - Sticky at bottom */}
                <div className="sticky bottom-0 pt-3 pb-safe border-t border-zinc-800/50 bg-zinc-900 space-y-3 px-1">
                    {/* Totals */}
                    <div className="space-y-1 mb-2">
                        <div className="flex justify-between text-sm text-zinc-400 font-medium">
                            <span>Subtotal ({itemCount} items)</span>
                            <span className="tabular-nums">S/ {formatCents(subtotalCents)}</span>
                        </div>
                        <div className="flex justify-between items-baseline text-2xl font-black">
                            <span className="tracking-tight">TOTAL</span>
                            <span className="text-park-brand-500 text-3xl tabular-nums drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                                S/ {formatCents(subtotalCents)}
                            </span>
                        </div>
                    </div>

                    {/* WAITER MODE ACTIONS - Mobile optimized */}
                    {isWaiter && !isPaid && (
                        <>
                            <button
                                onClick={onSendToKitchen}
                                disabled={items.length === 0 || isLoading}
                                className="w-full py-4 bg-park-brand-500 hover:bg-park-brand-600 active:bg-park-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-park-brand-500/20 min-h-[56px] touch-manipulation"
                            >
                                <Send size={20} />
                                <span>ENVIAR A COCINA</span>
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={onPrintPrecheck}
                                    className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl font-medium text-sm transition-colors min-h-[48px] touch-manipulation"
                                >
                                    <Printer size={18} />
                                    <span>Pre-cuenta</span>
                                </button>
                                <button
                                    onClick={onCallBill}
                                    disabled={items.length === 0}
                                    className="flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-400 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors min-h-[48px] touch-manipulation"
                                >
                                    <Receipt size={18} />
                                    <span>Pedir Cuenta</span>
                                </button>
                            </div>

                            {(onTransferTable || onSplitBill) && (
                                <div className="grid grid-cols-2 gap-2">
                                    {onTransferTable && (
                                        <button
                                            onClick={onTransferTable}
                                            disabled={items.length === 0}
                                            className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors min-h-[48px] touch-manipulation"
                                        >
                                            <ArrowLeftRight size={18} />
                                            <span>Transferir</span>
                                        </button>
                                    )}
                                    {onSplitBill && (
                                        <button
                                            onClick={onSplitBill}
                                            disabled={items.length === 0}
                                            className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors min-h-[48px] touch-manipulation"
                                        >
                                            <Scissors size={18} />
                                            <span>Dividir</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* CASHIER MODE ACTIONS - Mobile optimized */}
                    {isCashier && !isPaid && (
                        <>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={onPayCash}
                                    disabled={items.length === 0}
                                    className="group flex flex-col items-center justify-center gap-1.5 py-4 bg-zinc-800 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-zinc-800 border border-emerald-500/20 hover:border-emerald-500 rounded-2xl font-bold text-xs transition-all shadow-lg"
                                >
                                    <Banknote size={26} className="text-emerald-500 group-hover:text-white transition-colors" />
                                    <span>CASH</span>
                                </button>
                                <button
                                    onClick={onPayYape}
                                    disabled={items.length === 0}
                                    className="group flex flex-col items-center justify-center gap-1.5 py-4 bg-zinc-800 hover:bg-purple-600 active:bg-purple-700 disabled:opacity-50 disabled:hover:bg-zinc-800 border border-purple-500/20 hover:border-purple-500 rounded-2xl font-bold text-xs transition-all shadow-lg"
                                >
                                    <Smartphone size={26} className="text-purple-500 group-hover:text-white transition-colors" />
                                    <span>YAPE</span>
                                </button>
                                <button
                                    onClick={onPayCard}
                                    disabled={items.length === 0}
                                    className="group flex flex-col items-center justify-center gap-1.5 py-4 bg-zinc-800 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:hover:bg-zinc-800 border border-blue-500/20 hover:border-blue-500 rounded-2xl font-bold text-xs transition-all shadow-lg"
                                >
                                    <CreditCard size={26} className="text-blue-500 group-hover:text-white transition-colors" />
                                    <span>TARJETA</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Sidebar mode (desktop)
    return (
        <aside className="w-80 lg:w-[400px] border-l border-zinc-800/80 bg-zinc-950/90 flex flex-col shrink-0 shadow-2xl z-20">
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
                    onAddNote={!isPaid ? onAddNote : undefined}
                    readonly={isPaid}
                />
            </div>

            {/* Summary & Actions - Sticky */}
            <div className="sticky bottom-0 p-4 border-t border-zinc-800/50 bg-zinc-900/95 backdrop-blur-sm space-y-3">
                {/* Totals */}
                <div className="space-y-1 mb-4">
                    <div className="flex justify-between text-sm text-zinc-400 font-medium px-1">
                        <span>Subtotal</span>
                        <span className="tabular-nums">S/ {formatCents(subtotalCents)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-3xl font-black px-1 mt-1">
                        <span className="tracking-tight">TOTAL</span>
                        <span className="text-park-brand-500 tabular-nums drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                            S/ {formatCents(subtotalCents)}
                        </span>
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

                        {(onTransferTable || onSplitBill) && (
                            <div className="grid grid-cols-2 gap-2">
                                {onTransferTable && (
                                    <button
                                        onClick={onTransferTable}
                                        disabled={items.length === 0}
                                        className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors"
                                    >
                                        <ArrowLeftRight size={16} />
                                        <span>Transferir</span>
                                    </button>
                                )}
                                {onSplitBill && (
                                    <button
                                        onClick={onSplitBill}
                                        disabled={items.length === 0}
                                        className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors"
                                    >
                                        <Scissors size={16} />
                                        <span>Dividir</span>
                                    </button>
                                )}
                            </div>
                        )}

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
                        <div className="grid grid-cols-3 gap-3 mb-2">
                            <button
                                onClick={onPayCash}
                                disabled={items.length === 0}
                                className="group flex flex-col items-center justify-center gap-2 py-5 bg-zinc-900 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-zinc-900 border border-emerald-500/30 hover:border-emerald-500 rounded-2xl font-bold text-sm transition-all shadow-lg"
                            >
                                <Banknote size={28} className="text-emerald-500 group-hover:text-white transition-colors" />
                                <span>CASH</span>
                            </button>
                            <button
                                onClick={onPayYape}
                                disabled={items.length === 0}
                                className="group flex flex-col items-center justify-center gap-2 py-5 bg-zinc-900 hover:bg-purple-600 active:bg-purple-700 disabled:opacity-50 disabled:hover:bg-zinc-900 border border-purple-500/30 hover:border-purple-500 rounded-2xl font-bold text-sm transition-all shadow-lg"
                            >
                                <Smartphone size={28} className="text-purple-500 group-hover:text-white transition-colors" />
                                <span>YAPE</span>
                            </button>
                            <button
                                onClick={onPayCard}
                                disabled={items.length === 0}
                                className="group flex flex-col items-center justify-center gap-2 py-5 bg-zinc-900 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:hover:bg-zinc-900 border border-blue-500/30 hover:border-blue-500 rounded-2xl font-bold text-sm transition-all shadow-lg"
                            >
                                <CreditCard size={28} className="text-blue-500 group-hover:text-white transition-colors" />
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

// Status badge for mobile items
function MobileStatusBadge({ status }: { status: string }) {
    switch (status) {
        case "COOKING":
        case "SUBMITTED":
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-400">
                    En cocina
                </span>
            );
        case "READY":
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 animate-pulse">
                    ¡Listo!
                </span>
            );
        case "DONE":
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-700/50 text-zinc-500">
                    Servido
                </span>
            );
        default:
            return null;
    }
}

// Mobile-optimized line item component with larger touch targets
function MobileLineItem({
    item,
    onIncrement,
    onDecrement,
    onAddNote,
    readonly = false,
}: {
    item: LineItemData;
    onIncrement?: (lineId: string) => void;
    onDecrement?: (lineId: string) => void;
    onAddNote?: (lineId: string) => void;
    readonly?: boolean;
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            data-testid="order-item"
            className="flex items-center justify-between bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-3"
        >
            <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate" data-testid="order-item-name">{item.name}</p>
                    {item.status && item.status !== "PENDING" && (
                        <MobileStatusBadge status={item.status} />
                    )}
                </div>
                <p className="text-xs text-zinc-500">
                    S/ {formatCents(item.unit_price_cents)} c/u
                </p>
                {item.notes && (
                    <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                        <span className="truncate">📝 {item.notes}</span>
                    </p>
                )}
            </div>

            <div className="flex items-center gap-3">
                {!readonly && (
                    <div className="flex items-center gap-1 bg-zinc-900 rounded-xl">
                        <button
                            onClick={() => onDecrement?.(item.line_id)}
                            className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white active:bg-zinc-700 rounded-l-xl transition-colors touch-manipulation"
                            aria-label="Disminuir cantidad"
                        >
                            <span className="text-xl font-bold">−</span>
                        </button>
                        <span className="w-8 text-center font-mono text-base font-bold">{item.qty}</span>
                        <button
                            onClick={() => onIncrement?.(item.line_id)}
                            className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white active:bg-zinc-700 rounded-r-xl transition-colors touch-manipulation"
                            aria-label="Aumentar cantidad"
                        >
                            <span className="text-xl font-bold">+</span>
                        </button>
                    </div>
                )}

                {readonly && (
                    <span className="font-mono text-sm bg-zinc-900 px-3 py-2 rounded-lg">
                        ×{item.qty}
                    </span>
                )}

                {!readonly && onAddNote && (
                    <button
                        onClick={() => onAddNote(item.line_id)}
                        title="Agregar nota"
                        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors touch-manipulation ${item.notes ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"}`}
                        aria-label="Nota del item"
                    >
                        <span className="text-base">📝</span>
                    </button>
                )}

                <span className="font-bold text-sm w-16 text-right">
                    S/ {formatCents(item.line_total_cents)}
                </span>
            </div>
        </motion.div>
    );
}
