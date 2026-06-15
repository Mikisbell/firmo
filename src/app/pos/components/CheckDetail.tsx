import { useState } from "react";
import { CheckProjection, SaleProjection } from "@/src/core/projections/types";
import { PaymentModal } from "./PaymentModal";
import { InvoiceModal } from "./InvoiceModal";
import { SplitBillModal } from "./SplitBillModal";
import { RefundModal } from "./RefundModal";
import { ReceiptPreviewModal } from "./ReceiptPreviewModal";
import { DiscountModal } from "./DiscountModal";
import { ArrowLeft, Receipt, Printer, FileText, CreditCard, CheckCircle, Split, Plus, Minus, Trash2, Banknote, RotateCcw, MessageSquare, ArrowRightLeft, X, Percent, Eye } from "lucide-react";
import { printComponent, TicketTemplate } from "@/src/core/printing/templates";
import { transformLinesToPrint, OrderLineInput } from "@/src/core/printing/utils";
import { AnimatePresence } from "framer-motion";
import { asCentavos } from "@/src/core/types/shared";
import { ParkLogo } from "@/src/components/icons";
import { POSActions } from "@/src/core/actions/pos.actions";
import { TableTransferModal } from "./TableTransferModal";
import { toast } from "sonner";

interface CheckDetailProps {
    check: CheckProjection;
    order: SaleProjection;
    tenantId: string;
    terminalId: string;
    actorId: string; // New Prop
    onBack: () => void;
    onPayment: (method: "CASH" | "CARD" | "YAPE" | "PLIN", amountCents: number, changeCents?: number) => void;
    onInvoice: (type: "BOLETA" | "FACTURA") => void;
    onUpdateQty?: (lineId: string, newQty: number) => void;
    onTipChange?: (tipCents: number) => void;
    onDiscount?: (discountType: "PERCENTAGE" | "FIXED", discountValue: number) => void;
    onRefund?: () => void;
    // New Props for Selector
    checks: CheckProjection[];
    selectedCheckId: string;
    onSelectCheck: (id: string) => void;
}

// Quick note presets for kitchen instructions
const QUICK_NOTES = [
    "Sin cebolla",
    "Sin ensalada",
    "Bien cocido",
    "Punto medio",
    "Extra ají",
    "Extra papas",
    "Para llevar",
    "Sin sal",
];

export function CheckDetail({ check, order, tenantId, terminalId, actorId, onBack, onPayment, onInvoice, onUpdateQty, onTipChange, onDiscount, onRefund, checks, selectedCheckId, onSelectCheck }: CheckDetailProps) {
    const [showPayModal, setShowPayModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [showTableTransferModal, setShowTableTransferModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);

    // Item note state
    const [editingNoteLineId, setEditingNoteLineId] = useState<string | null>(null);
    const [noteText, setNoteText] = useState("");

    // Derived
    const allLines = order.lines;
    const isDineIn = order.order_type === "DINE_IN";
    const currentTable = order.fulfillment?.table_number;

    // Open note editor for an item
    const handleOpenNote = (lineId: string) => {
        const existingNote = allLines[lineId]?.notes ?? "";
        setNoteText(existingNote);
        setEditingNoteLineId(lineId);
    };

    // Save note for an item
    const handleSaveNote = async () => {
        if (!editingNoteLineId) return;
        await POSActions.addItemNote(tenantId, terminalId, actorId, order.order_id, editingNoteLineId, noteText.trim());
        toast.success(noteText.trim() ? "Nota guardada" : "Nota eliminada");
        setEditingNoteLineId(null);
        setNoteText("");
    };

    // Add a quick note (append to existing)
    const handleQuickNote = (quickNote: string) => {
        setNoteText(prev => {
            if (!prev.trim()) return quickNote;
            // Avoid duplicates
            if (prev.includes(quickNote)) return prev;
            return `${prev}, ${quickNote}`;
        });
    };

    // Handle table transfer
    const handleTableTransfer = async (toTable: string) => {
        const fromTable = currentTable || "";
        await POSActions.transferTable(tenantId, terminalId, actorId, order.order_id, fromTable, toTable);
        toast.success(`Mesa transferida: ${fromTable || "?"} → ${toTable}`);
        setShowTableTransferModal(false);
    };

    // Calc totals
    const paidCents = check.payment.payments.reduce((sum, p) => sum + p.amount_cents, 0);
    const remainingCents = check.total_cents - paidCents;
    const isPaid = remainingCents <= 0;

    const handlePrintPreCheck = () => {
        // Transform check lines to OrderLineInput format for the common function
        const orderLines: OrderLineInput[] = check.lines.map(l => {
            const item = allLines[l.line_id];
            const unitPrice = item?.unit_price_cents || 0;
            return {
                line_id: l.line_id,
                product_id: l.line_id,
                name: item?.name || "Unknown",
                qty: l.qty,
                unit_price_cents: asCentavos(unitPrice),
                line_total_cents: asCentavos(unitPrice * l.qty)
            };
        });

        const linesToPrint = transformLinesToPrint(orderLines);

        printComponent(
            <TicketTemplate
                tenantName="PARK POS"
                date={new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()}
                orderNumber={order.order_number}
                lines={linesToPrint}
                subtotal={check.subtotal_cents}
                discount={check.discount_cents}
                total={check.total_cents}
                invoiceType="PRE-CUENTA"
            />,
            "Pre-cuenta"
        );
    };

    return (
        <div className="h-full flex flex-col bg-park-black border-l border-white/10 shadow-2xl">
            {/* Header */}
            <div className="bg-zinc-900/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-10 flex flex-col">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex-1">
                        <h2 className="font-bold text-lg text-white leading-tight">
                            {isDineIn && currentTable ? `Mesa ${currentTable}` : check.name || "Principal"}
                        </h2>
                        <div className="flex items-center gap-2 text-xs font-medium">
                            <span className={`px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px] font-bold ${isPaid ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                {isPaid ? "PAGADO" : "PENDIENTE"}
                            </span>
                            <span className="text-zinc-500 font-mono">#{check.check_id.slice(0, 4)}</span>
                        </div>
                    </div>
                    {/* Transfer Table Button (Only for DINE_IN and unpaid) */}
                    {isDineIn && !isPaid && (
                        <button
                            onClick={() => setShowTableTransferModal(true)}
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-2 rounded-lg text-xs font-bold border border-amber-500/30 flex items-center gap-2 min-h-[44px] touch-manipulation"
                        >
                            <ArrowRightLeft size={14} /> TRANSFERIR
                        </button>
                    )}
                    {/* DIVIDIR Button (Only if > 1 check or order is unpaid) */}
                    {(!isPaid || checks.length > 1) && (
                        <button
                            onClick={() => setShowSplitModal(true)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-xs font-bold border border-zinc-700 flex items-center gap-2 min-h-[44px] touch-manipulation"
                        >
                            <Split size={14} /> DIVIDIR
                        </button>
                    )}
                </div>

                {/* Tabs Selector */}
                {checks.length > 1 && (
                    <div className="flex overflow-x-auto px-4 gap-2 pb-3 scrollbar-hide">
                        {checks.map(c => {
                            // Status of this specific check
                            const cPaidCents = c.payment.payments.reduce((sum, p) => sum + p.amount_cents, 0);
                            const cIsPaid = (c.total_cents - cPaidCents) <= 0;

                            return (
                                <button
                                    key={c.check_id}
                                    onClick={() => onSelectCheck(c.check_id)}
                                    className={`
                                        flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2
                                        ${selectedCheckId === c.check_id
                                            ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20 transform scale-105"
                                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-white"
                                        }
                                    `}
                                >
                                    <span>{c.name || (c.check_id === checks[0].check_id ? "Principal" : "Cuenta " + c.check_id.slice(-2))}</span>
                                    {cIsPaid && <CheckCircle className="w-3 h-3 text-green-500" />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Items List - Virtual Ticket Style */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-park-black relative">
                {/* Zigzag decoration top */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-transparent bg-contain opacity-50"></div>

                {check.lines.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Receipt className="w-12 h-12 mb-2 opacity-20" />
                        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Ticket Vacío</p>
                        {checks.length > 1 && (
                            <p className="text-xs text-indigo-500 mt-2 animate-pulse">
                                ☝️ Selecciona otra cuenta arriba
                            </p>
                        )}
                        {/* Rescue Button for Stuck State */}
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-8 text-xs text-gray-400 hover:text-red-500 underline"
                        >
                            ¿Atascado? Recargar
                        </button>
                    </div>
                ) : (
                    <div className="bg-zinc-900 shadow-lg border border-white/5 rounded-2xl p-4 min-h-full flex flex-col">
                        <div className="text-center border-b border-dashed border-white/10 pb-4 mb-4">
                            <ParkLogo size={48} className="mx-auto mb-2" />
                            <h3 className="font-black text-xl uppercase tracking-widest text-white">PARK POS</h3>
                            <p className="text-xs text-gray-500 font-mono mt-1">{new Date().toLocaleDateString()}</p>
                        </div>

                        <div className="flex-1 space-y-1">
                            {check.lines.map((l, idx) => {
                                const lineDetail = allLines[l.line_id];
                                const name = lineDetail?.name || `Item ${l.line_id.slice(0, 4)}`;
                                const unitPrice = lineDetail?.unit_price_cents || 0;
                                const total = unitPrice * l.qty;
                                const itemNotes = lineDetail?.notes;
                                const isEditingThis = editingNoteLineId === l.line_id;

                                return (
                                    <div key={l.line_id + idx} className="group py-1.5">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3 text-sm text-zinc-200 flex-1 min-w-0">
                                                {onUpdateQty && !isPaid && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => onUpdateQty(l.line_id, l.qty - 1)}
                                                            className="w-7 h-7 rounded bg-zinc-800 hover:bg-red-500/20 flex items-center justify-center text-zinc-400 hover:text-red-400 border border-transparent hover:border-red-500/30 min-h-[44px] min-w-[28px] touch-manipulation"
                                                        >
                                                            {l.qty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                                                        </button>
                                                        <button
                                                            onClick={() => onUpdateQty(l.line_id, l.qty + 1)}
                                                            className="w-7 h-7 rounded bg-zinc-800 hover:bg-emerald-500/20 flex items-center justify-center text-zinc-400 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30 min-h-[44px] min-w-[28px] touch-manipulation"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                                <span className="font-mono font-bold w-8 text-center bg-zinc-800 text-emerald-400 py-1 rounded-md flex-shrink-0">{l.qty}</span>
                                                <span className="font-medium group-hover:text-white truncate">{name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {/* Note button */}
                                                {!isPaid && (
                                                    <button
                                                        onClick={() => handleOpenNote(l.line_id)}
                                                        className={`p-1.5 rounded transition-colors min-h-[44px] min-w-[32px] flex items-center justify-center touch-manipulation ${
                                                            itemNotes
                                                                ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                                                                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100"
                                                        }`}
                                                        title={itemNotes || "Agregar nota"}
                                                    >
                                                        <MessageSquare size={13} />
                                                    </button>
                                                )}
                                                <span className="text-base font-mono font-bold text-white tracking-tight">
                                                    S/ {(total / 100).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Display existing note */}
                                        {itemNotes && !isEditingThis && (
                                            <div className="ml-8 mt-0.5">
                                                <span className="text-xs text-amber-700 italic bg-amber-50 px-2 py-0.5 rounded-full">
                                                    {itemNotes}
                                                </span>
                                            </div>
                                        )}

                                        {/* Inline note editor */}
                                        {isEditingThis && (
                                            <div className="ml-8 mt-2 space-y-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={noteText}
                                                        onChange={(e) => setNoteText(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") handleSaveNote();
                                                            if (e.key === "Escape") { setEditingNoteLineId(null); setNoteText(""); }
                                                        }}
                                                        placeholder="Ej: sin cebolla, bien cocido..."
                                                        className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white text-white min-h-[44px]"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={handleSaveNote}
                                                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold min-h-[44px] touch-manipulation"
                                                    >
                                                        OK
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingNoteLineId(null); setNoteText(""); }}
                                                        className="p-2 text-gray-400 hover:text-gray-600 min-h-[44px] touch-manipulation"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                                {/* Quick note chips */}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {QUICK_NOTES.map((qn) => (
                                                        <button
                                                            key={qn}
                                                            onClick={() => handleQuickNote(qn)}
                                                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors min-h-[32px] touch-manipulation ${
                                                                noteText.includes(qn)
                                                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                                                    : "bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-700"
                                                            }`}
                                                        >
                                                            {qn}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Totals */}
            <div className="bg-zinc-950 border-t border-white/10 p-6 pb-8 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.5)] sticky bottom-0 z-20">
                {/* Math Summary */}
                <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-zinc-400 font-mono text-sm">
                        <span>SUB TOTAL</span>
                        <span>S/ {(check.subtotal_cents / 100).toFixed(2)}</span>
                    </div>
                    {check.discount_cents > 0 && (
                        <div className="flex justify-between text-red-500 font-mono text-sm">
                            <span>DESCUENTO</span>
                            <span>- S/ {(check.discount_cents / 100).toFixed(2)}</span>
                        </div>
                    )}
                    {check.tip_cents > 0 && (
                        <div className="flex justify-between text-amber-600 font-mono text-sm">
                            <span>PROPINA</span>
                            <span>+ S/ {(check.tip_cents / 100).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-baseline text-white border-t border-white/20 pt-4">
                        <span className="font-black text-3xl tracking-tighter text-emerald-400">TOTAL</span>
                        <span className="font-mono text-4xl font-black tabular-nums text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">S/ {(check.total_cents / 100).toFixed(2)}</span>
                    </div>

                    {/* Payment Progress Bar */}
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
                        <div
                            className="bg-green-500 h-full transition-all duration-500"
                            style={{ width: `${check.total_cents > 0 ? Math.min((paidCents / check.total_cents) * 100, 100) : 0}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                        <span className="text-green-600">Pagado: S/ {(paidCents / 100).toFixed(2)}</span>
                        {!isPaid && <span className="text-red-600">Resta: S/ {(remainingCents / 100).toFixed(2)}</span>}
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    {!isPaid ? (
                        <>
                            {/* Quick Pay Buttons */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        // Quick pay = exact amount tendered → no change
                                        onPayment("CASH", remainingCents, 0);
                                    }}
                                    disabled={check.total_cents <= 0}
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-park-black py-4 rounded-2xl font-black text-lg uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/30 active:scale-95 touch-manipulation min-h-[60px]"
                                >
                                    <Banknote className="w-5 h-5" />
                                    Efectivo S/ {(remainingCents / 100).toFixed(2)}
                                </button>
                                <button
                                    onClick={() => {
                                        onPayment("CARD", remainingCents, 0);
                                    }}
                                    disabled={check.total_cents <= 0}
                                    className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 touch-manipulation min-h-[48px]"
                                >
                                    <CreditCard className="w-4 h-4" />
                                </button>
                            </div>
                            {/* Discount + Pre-Check + Pay */}
                            <div className="grid grid-cols-3 gap-2">
                                {onDiscount && (
                                    <button
                                        onClick={() => setShowDiscountModal(true)}
                                        disabled={check.subtotal_cents <= 0}
                                        className="bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-amber-400 border border-amber-500/40 py-4 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm min-h-[60px] touch-manipulation"
                                    >
                                        <Percent className="w-4 h-4" />
                                        DCTO
                                    </button>
                                )}
                                <button
                                    onClick={handlePrintPreCheck}
                                    disabled={check.total_cents <= 0}
                                    className="bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-white border-2 border-gray-900 py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm min-h-[48px] touch-manipulation"
                                >
                                    <Printer className="w-4 h-4" />
                                    PRE-CUENTA
                                </button>
                                <button
                                    onClick={() => setShowPayModal(true)}
                                    disabled={check.total_cents <= 0}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black text-lg uppercase flex justify-center items-center gap-1.5 transition-all shadow-xl shadow-indigo-600/30 active:scale-95 min-h-[60px] touch-manipulation"
                                >
                                    <CreditCard className="w-4 h-4" />
                                    COBRAR
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="flex-1 bg-green-50 text-green-700 border border-green-200 py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-wide">
                                    <CheckCircle className="w-5 h-5" />
                                    Pagado
                                </div>
                                <button
                                    onClick={() => setShowInvoiceModal(true)}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-indigo-500/30 shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <FileText className="w-5 h-5" />
                                    EMITIR DOC
                                </button>
                            </div>
                            {/* Receipt preview + Refund for paid orders */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowReceiptPreview(true)}
                                    className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-sm min-h-[44px] touch-manipulation"
                                >
                                    <Eye className="w-4 h-4" />
                                    Ver Boleta
                                </button>
                                <button
                                    onClick={() => onRefund ? onRefund() : setShowRefundModal(true)}
                                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-sm min-h-[44px] touch-manipulation"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Devolucion
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showPayModal && (
                    <PaymentModal
                        totalDueCents={check.total_cents}
                        remainingCents={remainingCents}
                        subtotalCents={check.subtotal_cents}
                        tipCents={check.tip_cents}
                        orderNumber={order.order_number}
                        onClose={() => setShowPayModal(false)}
                        onConfirm={(method, amount, _reference, changeCents) => {
                            onPayment(method, amount, changeCents ?? 0);
                            setShowPayModal(false);
                        }}
                        onTipChange={onTipChange}
                    />
                )}

                {showInvoiceModal && (
                    <InvoiceModal
                        orderId={order.order_id}
                        checkId={check.check_id}
                        totalCents={check.total_cents}
                        onClose={() => setShowInvoiceModal(false)}
                        onEmit={(data) => {
                            onInvoice(data.invoiceType);
                            setShowInvoiceModal(false);
                        }}
                        onSkip={() => setShowInvoiceModal(false)}
                    />
                )}

                {showSplitModal && (
                    <SplitBillModal
                        order={order}
                        currentTenantId={tenantId}
                        currentTerminalId={terminalId}
                        actorId={actorId}
                        onClose={() => setShowSplitModal(false)}
                    />
                )}

                {showRefundModal && (
                    <RefundModal
                        check={check}
                        order={order}
                        onClose={() => setShowRefundModal(false)}
                        onConfirm={(params) => {
                            // onRefund callback handles the actual event dispatch from page.tsx
                            if (onRefund) {
                                onRefund();
                            }
                            setShowRefundModal(false);
                        }}
                    />
                )}

                {showTableTransferModal && (
                    <TableTransferModal
                        currentTable={currentTable || ""}
                        onClose={() => setShowTableTransferModal(false)}
                        onConfirm={handleTableTransfer}
                    />
                )}

                {showDiscountModal && onDiscount && (
                    <DiscountModal
                        subtotalCents={check.subtotal_cents}
                        currentDiscountCents={check.discount_cents}
                        onClose={() => setShowDiscountModal(false)}
                        onApply={(type, value) => {
                            onDiscount(type, value);
                            setShowDiscountModal(false);
                        }}
                    />
                )}

                {showReceiptPreview && (
                    <ReceiptPreviewModal
                        open={showReceiptPreview}
                        onClose={() => setShowReceiptPreview(false)}
                        order={order}
                        check={check}
                        onPrint={handlePrintPreCheck}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
