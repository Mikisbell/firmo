import { useState } from "react";
import { CheckProjection, SaleProjection } from "@/src/core/projections/types";
import { PaymentModal } from "./PaymentModal";
import { InvoiceModal } from "./InvoiceModal";
import { SplitBillModal } from "./SplitBillModal";
import { ArrowLeft, Receipt, Printer, FileText, CreditCard, CheckCircle, Split, Plus, Minus, Trash2 } from "lucide-react";
import { printComponent, TicketTemplate } from "@/src/core/printing/templates";
import { transformLinesToPrint, OrderLineInput } from "@/src/core/printing/utils";
import { AnimatePresence } from "framer-motion";
import { asCentavos } from "@/src/core/types/shared";
import { ParkLogo } from "@/src/components/icons";

interface CheckDetailProps {
    check: CheckProjection;
    order: SaleProjection;
    tenantId: string;
    terminalId: string;
    actorId: string; // New Prop
    onBack: () => void;
    onPayment: (method: "CASH" | "CARD" | "YAPE" | "PLIN", amountCents: number) => void;
    onInvoice: (type: "BOLETA" | "FACTURA") => void;
    onUpdateQty?: (lineId: string, newQty: number) => void;
    // New Props for Selector
    checks: CheckProjection[];
    selectedCheckId: string;
    onSelectCheck: (id: string) => void;
}

export function CheckDetail({ check, order, tenantId, terminalId, actorId, onBack, onPayment, onInvoice, onUpdateQty, checks, selectedCheckId, onSelectCheck }: CheckDetailProps) {
    const [showPayModal, setShowPayModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);

    // Derived
    const allLines = order.lines;

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
                orderNumber={999}
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
        <div className="h-full flex flex-col bg-gray-50 border-l border-gray-200 shadow-xl">
            {/* Header */}
            <div className="bg-white border-b shadow-sm sticky top-0 z-10 flex flex-col">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex-1">
                        <h2 className="font-bold text-lg text-gray-900 leading-tight">Mesa / {check.name || "Principal"}</h2>
                        <div className="flex items-center gap-2 text-xs font-medium">
                            <span className={`px-2 py-0.5 rounded-full ${isPaid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                {isPaid ? "PAGADO" : "PENDIENTE"}
                            </span>
                            <span className="text-gray-400">#{check.check_id.slice(0, 4)}</span>
                        </div>
                    </div>
                    {/* DIVIDIR Button (Only if > 1 check or order is unpaid) */}
                    {(!isPaid || checks.length > 1) && (
                        <button
                            onClick={() => setShowSplitModal(true)}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-2 rounded-lg text-xs font-bold border border-zinc-300 flex items-center gap-2"
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
                                            ? "bg-gray-900 text-white border-gray-900 shadow-md transform scale-105"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#f8f9fa] relative">
                {/* Zigzag decoration top */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMCAxMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHBhdGggZD0iTTAgMTBMMTAgMEwyMCAxMEgwWiIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg==')] bg-contain opacity-50"></div>

                {check.lines.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Receipt className="w-12 h-12 mb-2 opacity-20" />
                        <p className="font-mono text-xs uppercase tracking-widest">Ticket Vacío</p>
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
                    <div className="bg-white shadow-sm border border-gray-200 rounded-sm p-4 min-h-full flex flex-col">
                        <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
                            <ParkLogo size={48} className="mx-auto mb-2" />
                            <h3 className="font-black text-xl uppercase tracking-widest text-gray-900">PARK POS</h3>
                            <p className="text-xs text-gray-500 font-mono mt-1">{new Date().toLocaleDateString()}</p>
                        </div>

                        <div className="flex-1 space-y-3">
                            {check.lines.map((l, idx) => {
                                const lineDetail = allLines[l.line_id];
                                const name = lineDetail?.name || `Item ${l.line_id.slice(0, 4)}`;
                                const unitPrice = lineDetail?.unit_price_cents || 0;
                                const total = unitPrice * l.qty;

                                return (
                                    <div key={l.line_id + idx} className="flex justify-between items-center group py-1">
                                        <div className="flex items-center gap-2 text-sm text-gray-800">
                                            {onUpdateQty && !isPaid && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => onUpdateQty(l.line_id, l.qty - 1)}
                                                        className="w-6 h-6 rounded bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-500 hover:text-red-600"
                                                    >
                                                        {l.qty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdateQty(l.line_id, l.qty + 1)}
                                                        className="w-6 h-6 rounded bg-gray-100 hover:bg-green-100 flex items-center justify-center text-gray-500 hover:text-green-600"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                            )}
                                            <span className="font-mono font-bold w-6 text-right">{l.qty}</span>
                                            <span className="font-medium group-hover:text-black">{name}</span>
                                        </div>
                                        <div className="text-sm font-mono text-gray-600">
                                            S/ {(total / 100).toFixed(2)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Totals */}
            <div className="bg-white border-t border-dashed border-gray-300 p-6 pb-8 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] sticky bottom-0 z-20">
                {/* Math Summary */}
                <div className="space-y-4 mb-6">
                    <div className="flex-1">
                        {/* Removed redundant flex layout */}
                    </div>
                    <div className="flex justify-between text-gray-500 font-mono text-sm">
                        <span>SUB TOTAL</span>
                        <span>S/ {(check.subtotal_cents / 100).toFixed(2)}</span>
                    </div>
                    {check.discount_cents > 0 && (
                        <div className="flex justify-between text-red-500 font-mono text-sm">
                            <span>DESCUENTO</span>
                            <span>- S/ {(check.discount_cents / 100).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-baseline text-gray-900 border-t-2 border-gray-900 pt-4">
                        <span className="font-black text-2xl tracking-tighter">TOTAL</span>
                        <span className="font-mono text-3xl font-bold">S/ {(check.total_cents / 100).toFixed(2)}</span>
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
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handlePrintPreCheck}
                                disabled={check.total_cents <= 0}
                                className="col-span-1 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 border-2 border-gray-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <Printer className="w-5 h-5" />
                                PRE-CUENTA
                            </button>
                            <button
                                onClick={() => setShowPayModal(true)}
                                disabled={check.total_cents <= 0}
                                className="col-span-1 bg-gray-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-xl shadow-gray-900/20 active:scale-95"
                            >
                                <CreditCard className="w-5 h-5" />
                                COBRAR
                            </button>
                        </div>
                    ) : (
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
                                EMITIR DOT
                            </button>
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
                        onClose={() => setShowPayModal(false)}
                        onConfirm={(method, amount) => {
                            onPayment(method, amount);
                            setShowPayModal(false);
                        }}
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
            </AnimatePresence>
        </div>
    );
}
