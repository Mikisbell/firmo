'use client';

import { X, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SaleProjection, CheckProjection } from '@/src/core/projections/types';

interface ReceiptPreviewModalProps {
    open: boolean;
    onClose: () => void;
    order: SaleProjection;
    check: CheckProjection;
    onPrint: () => void;
}

function formatMoney(cents: number): string {
    return `S/ ${(cents / 100).toFixed(2)}`;
}

export function ReceiptPreviewModal({ open, onClose, order, check, onPrint }: ReceiptPreviewModalProps) {
    if (!open) return null;

    const lines = check.lines.map(l => {
        const item = order.lines[l.line_id];
        return {
            name: item?.name || 'Item',
            qty: l.qty,
            unitPriceCents: item?.unit_price_cents || 0,
            totalCents: (item?.unit_price_cents || 0) * l.qty,
            taxCategory: item?.tax_category || 'GRAVADO',
        };
    });

    // IGV calculation (18% included in price for GRAVADO items)
    const gravadoCents = lines
        .filter(l => l.taxCategory === 'GRAVADO')
        .reduce((s, l) => s + l.totalCents, 0);
    const baseCents = gravadoCents > 0 ? Math.round(gravadoCents / 1.18) : 0;
    const igvCents = gravadoCents - baseCents;

    const payments = check.payment.payments;
    const isPaid = check.payment.status === 'PAID';
    const tableNumber = order.fulfillment?.table_number;
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-PE');
    const timeStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

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
                className="relative bg-gray-100 shadow-2xl overflow-hidden border border-gray-200 w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-sm md:rounded-2xl flex flex-col"
            >
                {/* Modal header */}
                <div className="bg-gray-900 px-5 py-4 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        Vista Previa de Boleta
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Receipt paper simulation */}
                <div className="flex-1 overflow-y-auto p-4 flex justify-center">
                    <div className="bg-white max-w-[320px] w-full shadow-lg border border-gray-200 p-6 font-mono text-xs text-gray-900 leading-relaxed">
                        {/* Header */}
                        <div className="text-center space-y-1 mb-4">
                            <div className="text-base font-black tracking-widest uppercase">FIRMO POS</div>
                            <div className="text-[10px] text-gray-500">Sistema de Punto de Venta</div>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-dashed border-gray-400 my-3" />

                        {/* Document type */}
                        <div className="text-center font-bold text-sm mb-2">
                            {isPaid ? 'BOLETA DE VENTA' : 'PRE-CUENTA'}
                        </div>

                        {/* Order info */}
                        <div className="space-y-0.5 mb-3 text-[11px]">
                            <div className="flex justify-between">
                                <span>Orden:</span>
                                <span className="font-bold">#{order.order_number}</span>
                            </div>
                            {tableNumber && (
                                <div className="flex justify-between">
                                    <span>Mesa:</span>
                                    <span className="font-bold">{tableNumber}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>Fecha:</span>
                                <span>{dateStr}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Hora:</span>
                                <span>{timeStr}</span>
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-dashed border-gray-400 my-3" />

                        {/* Column headers */}
                        <div className="flex justify-between font-bold text-[10px] uppercase text-gray-500 mb-1">
                            <span>Cant. Descripcion</span>
                            <span>Total</span>
                        </div>

                        <div className="border-t border-gray-300 mb-2" />

                        {/* Items */}
                        <div className="space-y-1.5">
                            {lines.map((l, i) => (
                                <div key={i} className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold">{l.qty}x</span>{' '}
                                        <span className="break-words">{l.name}</span>
                                    </div>
                                    <span className="flex-shrink-0 ml-2 tabular-nums">
                                        {formatMoney(l.totalCents)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Separator */}
                        <div className="border-t border-dashed border-gray-400 my-3" />

                        {/* Totals */}
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span className="tabular-nums">{formatMoney(check.subtotal_cents)}</span>
                            </div>
                            {check.discount_cents > 0 && (
                                <div className="flex justify-between text-red-600">
                                    <span>Descuento</span>
                                    <span className="tabular-nums">-{formatMoney(check.discount_cents)}</span>
                                </div>
                            )}
                            {gravadoCents > 0 && (
                                <>
                                    <div className="flex justify-between text-gray-500 text-[10px]">
                                        <span>Op. Gravada</span>
                                        <span className="tabular-nums">{formatMoney(baseCents)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-500 text-[10px]">
                                        <span>IGV 18%</span>
                                        <span className="tabular-nums">{formatMoney(igvCents)}</span>
                                    </div>
                                </>
                            )}
                            {check.tip_cents > 0 && (
                                <div className="flex justify-between text-amber-600">
                                    <span>Propina</span>
                                    <span className="tabular-nums">+{formatMoney(check.tip_cents)}</span>
                                </div>
                            )}

                            <div className="border-t-2 border-gray-900 pt-2 mt-2">
                                <div className="flex justify-between text-sm font-black">
                                    <span>TOTAL</span>
                                    <span className="tabular-nums">{formatMoney(check.total_cents)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payments */}
                        {payments.length > 0 && (
                            <>
                                <div className="border-t border-dashed border-gray-400 my-3" />
                                <div className="space-y-0.5">
                                    <div className="font-bold text-[10px] uppercase text-gray-500 mb-1">Pagos</div>
                                    {payments.map((p, i) => (
                                        <div key={i} className="flex justify-between">
                                            <span>{p.method}</span>
                                            <span className="tabular-nums">{formatMoney(p.amount_cents)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Footer */}
                        <div className="border-t border-dashed border-gray-400 my-3" />
                        <div className="text-center text-[10px] text-gray-500 space-y-1">
                            <div>Gracias por su preferencia</div>
                            <div>Vuelva pronto</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-white border-t border-gray-200 flex gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors min-h-[48px] touch-manipulation"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={() => {
                            onPrint();
                            onClose();
                        }}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gray-900 hover:bg-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimir
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
