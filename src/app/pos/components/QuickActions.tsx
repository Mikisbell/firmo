"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
    Percent, 
    History,
    Banknote, RotateCcw
} from "lucide-react";

interface QuickActionsProps {
    onApplyDiscount: (percent: number) => void;
    onOpenCashDrawer: () => void;
    onViewHistory: () => void;
    shiftOpen: boolean;
}

const QUICK_DISCOUNTS = [5, 10, 15, 20];

export function QuickActions({ onApplyDiscount, onOpenCashDrawer, onViewHistory, shiftOpen }: QuickActionsProps) {
    const [showDiscounts, setShowDiscounts] = useState(false);

    const actions = [
        { icon: Percent, label: "Descuento", onClick: () => setShowDiscounts(!showDiscounts), color: "text-amber-400" },
        { icon: Banknote, label: "Abrir Caja", onClick: onOpenCashDrawer, color: "text-emerald-400" },
        { icon: History, label: "Historial", onClick: onViewHistory, color: "text-blue-400" },
        { icon: RotateCcw, label: "Devolución", onClick: () => {}, color: "text-red-400" },
    ];

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2">
                {actions.map((action, i) => (
                    <motion.button
                        key={i}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={action.onClick}
                        disabled={!shiftOpen}
                        className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-all ${!shiftOpen ? 'opacity-50' : ''}`}
                    >
                        <action.icon size={20} className={action.color} />
                        <span className="text-xs text-zinc-400">{action.label}</span>
                    </motion.button>
                ))}
            </div>

            {/* Quick Discount Buttons */}
            {showDiscounts && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-2 p-2 bg-zinc-800/30 rounded-xl"
                >
                    {QUICK_DISCOUNTS.map(pct => (
                        <button
                            key={pct}
                            onClick={() => {
                                onApplyDiscount(pct);
                                setShowDiscounts(false);
                            }}
                            className="flex-1 py-2 px-3 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-bold hover:bg-amber-500/30 transition-colors"
                        >
                            {pct}%
                        </button>
                    ))}
                    <button
                        onClick={() => setShowDiscounts(false)}
                        className="px-3 py-2 bg-zinc-700 text-zinc-400 rounded-lg text-sm hover:bg-zinc-600"
                    >
                        ✕
                    </button>
                </motion.div>
            )}
        </div>
    );
}
