"use client";

import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "@/src/core/domain/money";
import { Trash2, Plus, Minus } from "lucide-react";

export interface LineItemData {
    line_id: string;
    product_id: string;
    name: string;
    qty: number;
    unit_price_cents: number;
    line_total_cents: number;
    status?: string;
}

interface LineItemProps {
    item: LineItemData;
    onIncrement?: (lineId: string) => void;
    onDecrement?: (lineId: string) => void;
    onRemove?: (lineId: string) => void;
    readonly?: boolean;
    compact?: boolean;
}

export function LineItem({
    item,
    onIncrement,
    onDecrement,
    onRemove,
    readonly = false,
    compact = false,
}: LineItemProps) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            data-testid="order-item"
            className={`flex items-center justify-between bg-zinc-800/50 rounded-lg border border-zinc-700/50 hover:border-zinc-600/50 transition-colors group ${compact ? "p-2" : "p-3"
                }`}
        >
            <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${compact ? "text-xs" : "text-sm"}`} data-testid="order-item-name">
                    {item.name}
                </p>
                <p className="text-xs text-zinc-500">
                    S/ {formatCents(item.unit_price_cents)} c/u
                </p>
            </div>

            <div className="flex items-center gap-2 ml-2">
                {!readonly && (
                    <div className="flex items-center gap-1 bg-zinc-900 rounded-lg px-1">
                        <button
                            onClick={() => onDecrement?.(item.line_id)}
                            className="p-1 text-zinc-500 hover:text-white transition-colors"
                        >
                            <Minus size={14} />
                        </button>
                        <span className="w-6 text-center font-mono text-sm">{item.qty}</span>
                        <button
                            onClick={() => onIncrement?.(item.line_id)}
                            className="p-1 text-zinc-500 hover:text-white transition-colors"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                )}

                {readonly && (
                    <span className="font-mono text-sm bg-zinc-900 px-2 py-1 rounded">
                        ×{item.qty}
                    </span>
                )}

                <span className={`font-bold text-right ${compact ? "text-xs w-14" : "text-sm w-16"}`}>
                    S/ {formatCents(item.line_total_cents)}
                </span>

                {!readonly && (
                    <button
                        onClick={() => onRemove?.(item.line_id)}
                        className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
        </motion.div>
    );
}

interface LineItemListProps {
    items: LineItemData[];
    onIncrement?: (lineId: string) => void;
    onDecrement?: (lineId: string) => void;
    onRemove?: (lineId: string) => void;
    readonly?: boolean;
    compact?: boolean;
    emptyMessage?: string;
}

export function LineItemList({
    items,
    onIncrement,
    onDecrement,
    onRemove,
    readonly = false,
    compact = false,
    emptyMessage = "Sin productos aún",
}: LineItemListProps) {
    return (
        <div className="space-y-2">
            <AnimatePresence mode="popLayout">
                {items.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600">
                        <p className="text-sm">{emptyMessage}</p>
                        <p className="text-xs mt-1 opacity-60">Toca para agregar</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <LineItem
                            key={item.line_id}
                            item={item}
                            onIncrement={onIncrement}
                            onDecrement={onDecrement}
                            onRemove={onRemove}
                            readonly={readonly}
                            compact={compact}
                        />
                    ))
                )}
            </AnimatePresence>
        </div>
    );
}
