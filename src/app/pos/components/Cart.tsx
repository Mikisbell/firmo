"use client";

import React from "react";
import { formatCents } from "@/src/core/domain/money";
import type { SaleProjection } from "@/src/core/projections/types";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, ShoppingCart } from "lucide-react";

export default function Cart({
    sale,
    onConfirm,
    onStartSale
}: {
    sale: SaleProjection | null;
    onConfirm: () => void;
    onStartSale: () => void;
}) {
    if (!sale || sale.status !== "OPEN") {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-full text-center bg-zinc-900 border-l border-zinc-800">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <ShoppingCart className="text-zinc-600 w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Punto de Venta</h3>
                <p className="text-zinc-500 text-sm mb-8 max-w-[200px]">
                    Listo para una nueva transacción.
                </p>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onStartSale}
                    className="w-full max-w-[200px] px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:shadow-indigo-500/40 transition-all"
                >
                    Nueva Venta
                </motion.button>
            </div>
        );
    }

    const lines = Object.values(sale.lines);

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
            {/* Header Sticky */}
            <div className="p-5 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur z-20 sticky top-0 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="font-bold text-xl text-white tracking-tight">Ticket Actual</h2>
                    <span className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] font-mono text-zinc-400 border border-zinc-700">
                        ID: {sale.sale_id.slice(0, 8)}
                    </span>
                </div>
                <div className="flex gap-2 text-xs">
                    <span className="font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        ABIERTO
                    </span>
                    <span className="text-zinc-500">
                        {lines.length} items
                    </span>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 opacity-40">
                        <Trash2 className="text-zinc-500 w-8 h-8 mb-2" />
                        <p className="text-zinc-500 text-sm">Carrito vacío</p>
                    </div>
                )}
                <AnimatePresence initial={false}>
                    {lines.map((line) => (
                        <motion.div
                            key={line.line_id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20, height: 0 }}
                            className="flex justify-between items-center p-3 rounded-lg bg-zinc-800/40 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-colors group"
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="font-medium text-zinc-200 text-sm truncate mb-0.5">{line.product_id}</div>
                                <div className="text-xs text-zinc-500 group-hover:text-zinc-400">
                                    {line.qty} x ${formatCents(line.unit_price_cents)}
                                </div>
                            </div>
                            <div className="font-mono font-bold text-zinc-100 text-sm">
                                ${formatCents(line.line_total_cents)}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-5 bg-zinc-900 border-t border-zinc-800 z-30 shadow-[0_-8px_30px_rgba(0,0,0,0.3)]">
                <div className="flex justify-between items-end mb-4">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Total</span>
                    <motion.span
                        key={sale.subtotal_cents}
                        initial={{ scale: 1.1, color: "#34d399" }}
                        animate={{ scale: 1, color: "#ffffff" }}
                        className="text-3xl font-bold text-white tracking-tight"
                    >
                        ${formatCents(sale.subtotal_cents)}
                    </motion.span>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onConfirm}
                    disabled={lines.length === 0}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-base rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 disabled:opacity-50 disabled:grayscale transition-all disabled:cursor-not-allowed"
                >
                    COBRAR
                </motion.button>
            </div>
        </div>
    );
}
