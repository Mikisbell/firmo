import React from "react";
import { SaleProjection, CheckProjection } from "@/src/core/projections/types";
import { ArrowLeft, Banknote, CreditCard, Smartphone } from "lucide-react";
import { ElapsedTimer } from "./ElapsedTimer";

interface OrderCheckoutPanelProps {
    order: SaleProjection;
    activeCheck: CheckProjection;
    onBack: () => void;
    onQuickPay: (method: "CASH" | "CARD" | "YAPE" | "PLIN") => void;
    onOpenPayment: () => void;
}

export function OrderCheckoutPanel({
    order,
    activeCheck,
    onBack,
    onQuickPay,
    onOpenPayment
}: OrderCheckoutPanelProps) {
    const totalRemainingCents = activeCheck.total_cents - activeCheck.payment.payments.reduce((acc, p) => acc + p.amount_cents, 0);

    // Get table number from fulfillment if DINE_IN
    const tableNumber = order.fulfillment?.table_number;

    return (
        <div className="flex flex-col h-full bg-zinc-900/40 backdrop-blur-md rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-zinc-900/60 border-b border-white/10 shrink-0">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-park-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <ArrowLeft size={18} />
                    Volver a lista
                </button>
                <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-white">
                        #{order.order_number}
                        {tableNumber && ` — Mesa ${tableNumber}`}
                    </span>
                    <ElapsedTimer createdAt={order.created_at ?? new Date().toISOString()} />
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-6 bg-park-black/30 flex flex-col items-center">
                <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl text-gray-900 mb-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
                        Resumen de la Cuenta
                    </h3>
                    
                    <div className="space-y-3 mb-6">
                        {activeCheck.lines.map((line) => {
                            const orderLine = order.lines[line.line_id];
                            if (!orderLine || orderLine.status === "VOIDED") return null;
                            return (
                                <div key={line.line_id} className="flex justify-between text-sm font-medium">
                                    <span className="text-gray-700">
                                        <span className="text-gray-400 mr-2">{line.qty}x</span>
                                        {orderLine.name}
                                    </span>
                                    <span className="text-gray-900">S/ {((line.qty * orderLine.unit_price_cents) / 100).toFixed(2)}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="pt-4 border-t-2 border-dashed border-gray-200">
                        <div className="flex justify-between items-center text-xl font-black">
                            <span>TOTAL</span>
                            <span>S/ {(activeCheck.total_cents / 100).toFixed(2)}</span>
                        </div>
                        {totalRemainingCents < activeCheck.total_cents && (
                            <div className="flex justify-between items-center text-sm font-bold text-red-600 mt-2">
                                <span>Restante</span>
                                <span>S/ {(Math.max(0, totalRemainingCents) / 100).toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full max-w-md space-y-4">
                    <h3 className="text-xs font-bold text-park-gray-400 uppercase tracking-widest text-center">
                        Cobro Rápido Exacto
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => onQuickPay("CASH")}
                            disabled={totalRemainingCents <= 0}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Banknote size={24} />
                            <span className="text-sm font-bold">Efectivo</span>
                        </button>
                        <button
                            onClick={() => onQuickPay("CARD")}
                            disabled={totalRemainingCents <= 0}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CreditCard size={24} />
                            <span className="text-sm font-bold">Tarjeta</span>
                        </button>
                        <button
                            onClick={() => onQuickPay("YAPE")}
                            disabled={totalRemainingCents <= 0}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Smartphone size={24} />
                            <span className="text-sm font-bold">Yape/Plin</span>
                        </button>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={onOpenPayment}
                            disabled={totalRemainingCents <= 0}
                            className="w-full py-4 rounded-xl bg-white text-black text-lg font-black uppercase tracking-wider hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cobrar Ahora — S/ {(Math.max(0, totalRemainingCents) / 100).toFixed(2)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
