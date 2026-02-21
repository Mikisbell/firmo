"use client";

/**
 * KDSTicket - Kitchen Display System Ticket Card
 * Responsive with larger typography for readability at distance
 * 
 * Task 12.2, 12.3 - Mobile Responsive Spec
 * Requirements: 7.5, 7.6
 */

import { motion } from "framer-motion";
import { Play, CheckCircle2, Check, Lock, LucideIcon } from "lucide-react";
import { type ItemStatus } from "@/src/core/domain/events";

export interface KDSTicketItem {
    line_id: string;
    name: string;
    qty: number;
    status: ItemStatus;
    course?: number;
    held?: boolean;
}

export interface KDSTicketProps {
    orderId: string;
    orderNumber: number;
    orderType: "DINE_IN" | "DELIVERY" | "TAKEOUT";
    items: KDSTicketItem[];
    accentColor: "amber" | "sky" | "red" | "emerald";
    cookingIcon: LucideIcon;
    onItemClick: (orderId: string, lineId: string, currentStatus: ItemStatus) => void;
    // Timer (optional)
    elapsedMinutes?: number;
    warningThreshold?: number;  // Minutes before warning color
    dangerThreshold?: number;   // Minutes before danger color
}

// Color schemes
const ticketColors = {
    amber: {
        border: "border-amber-500/30",
        shadow: "shadow-[0_0_25px_rgba(245,158,11,0.1)]",
        headerGradient: "from-amber-950/50 to-yellow-950/30",
        headerBorder: "border-amber-500/30",
        cookingBg: "bg-amber-900/30",
        cookingBorder: "border-amber-500",
        cookingText: "text-amber-100",
        cookingShadow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
        cookingQty: "text-amber-400",
        cookingIcon: "text-amber-400",
        hoverBorder: "hover:border-amber-500/50",
    },
    sky: {
        border: "border-sky-500/30",
        shadow: "shadow-[0_0_25px_rgba(14,165,233,0.15)]",
        headerGradient: "from-sky-950/50 to-blue-950/30",
        headerBorder: "border-sky-500/30",
        cookingBg: "bg-sky-900/30",
        cookingBorder: "border-sky-500",
        cookingText: "text-sky-100",
        cookingShadow: "shadow-[0_0_15px_rgba(14,165,233,0.2)]",
        cookingQty: "text-sky-400",
        cookingIcon: "text-sky-400",
        hoverBorder: "hover:border-sky-500/50",
    },
    red: {
        border: "border-red-500/30",
        shadow: "shadow-[0_0_25px_rgba(239,68,68,0.1)]",
        headerGradient: "from-red-950/50 to-orange-950/30",
        headerBorder: "border-red-500/30",
        cookingBg: "bg-red-900/30",
        cookingBorder: "border-red-500",
        cookingText: "text-red-100",
        cookingShadow: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
        cookingQty: "text-red-400",
        cookingIcon: "text-red-400",
        hoverBorder: "hover:border-red-500/50",
    },
    emerald: {
        border: "border-emerald-500/30",
        shadow: "shadow-[0_0_25px_rgba(16,185,129,0.1)]",
        headerGradient: "from-emerald-950/50 to-teal-950/30",
        headerBorder: "border-emerald-500/30",
        cookingBg: "bg-emerald-900/30",
        cookingBorder: "border-emerald-500",
        cookingText: "text-emerald-100",
        cookingShadow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
        cookingQty: "text-emerald-400",
        cookingIcon: "text-emerald-400",
        hoverBorder: "hover:border-emerald-500/50",
    },
};

export function KDSTicket({
    orderId,
    orderNumber,
    orderType,
    items,
    accentColor,
    cookingIcon: CookingIcon,
    onItemClick,
    elapsedMinutes,
    warningThreshold = 5,
    dangerThreshold = 10,
}: KDSTicketProps) {
    const colors = ticketColors[accentColor];

    // Timer color based on elapsed time
    const getTimerColor = () => {
        if (elapsedMinutes === undefined) return "text-zinc-400";
        if (elapsedMinutes >= dangerThreshold) return "text-red-400 animate-pulse";
        if (elapsedMinutes >= warningThreshold) return "text-amber-400";
        return "text-emerald-400";
    };

    const getTimerBg = () => {
        if (elapsedMinutes === undefined) return "bg-zinc-800/50";
        if (elapsedMinutes >= dangerThreshold) return "bg-red-500/20 border-red-500/50";
        if (elapsedMinutes >= warningThreshold) return "bg-amber-500/20 border-amber-500/50";
        return "bg-emerald-500/20 border-emerald-500/50";
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            data-testid="kds-ticket"
            className={`
                bg-zinc-900/90 rounded-xl md:rounded-2xl 
                border-2 ${colors.border} 
                overflow-hidden ${colors.shadow}
            `}
        >
            {/* Ticket Header */}
            <div className={`p-3 md:p-4 bg-gradient-to-r ${colors.headerGradient} border-b-2 ${colors.headerBorder}`}>
                <div className="flex justify-between items-center">
                    <span className="text-2xl md:text-3xl font-black text-white">#{orderNumber}</span>
                    <div className="flex items-center gap-2">
                        {/* Timer Badge */}
                        {elapsedMinutes !== undefined && (
                            <span className={`
                                text-sm md:text-base font-bold px-2 py-0.5 rounded-full border
                                ${getTimerBg()} ${getTimerColor()}
                            `}>
                                {elapsedMinutes}m
                            </span>
                        )}
                        {/* Order Type Badge */}
                        <span className={`text-[10px] md:text-xs font-bold uppercase px-2 md:px-3 py-1 rounded-full ${
                            orderType === "DELIVERY" 
                                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                                : "bg-zinc-500/20 text-zinc-300 border border-zinc-500/30"
                        }`}>
                            {orderType === "DELIVERY" ? "🛵 Delivery" : "🍽️ Mesa"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Items */}
            <div className="p-2 md:p-3 space-y-1.5 md:space-y-2">
                {items
                    .sort((a, b) => {
                        // Sort by course first, then by line_id
                        const ca = a.course ?? 999;
                        const cb = b.course ?? 999;
                        if (ca !== cb) return ca - cb;
                        return a.line_id.localeCompare(b.line_id);
                    })
                    .map((item) => {
                    const isHeld = item.held === true;
                    return (
                    <motion.button
                        key={item.line_id}
                        layout
                        onClick={() => !isHeld && onItemClick(orderId, item.line_id, item.status)}
                        whileTap={isHeld ? undefined : { scale: 0.98 }}
                        data-testid="kds-item"
                        className={`
                            w-full text-left p-3 md:p-3.5 rounded-lg md:rounded-xl
                            text-base md:text-lg font-bold transition-all
                            touch-manipulation min-h-[48px] md:min-h-[56px]
                            ${isHeld
                                ? "bg-zinc-800/40 text-zinc-500 border-2 border-dashed border-zinc-600 opacity-60 cursor-not-allowed"
                                : item.status === "DONE"
                                    ? "bg-zinc-800/50 text-zinc-600 line-through border-2 border-zinc-700/50"
                                    : item.status === "COOKING"
                                        ? `border-2 ${colors.cookingBg} ${colors.cookingBorder} ${colors.cookingText} ${colors.cookingShadow}`
                                        : item.status === "READY"
                                            ? "bg-emerald-900/30 border-2 border-emerald-500 text-emerald-200"
                                            : `bg-zinc-800/80 text-white border-2 border-zinc-600 ${colors.hoverBorder}`
                            }
                        `}
                    >
                        <div className="flex justify-between items-center">
                            <span className="flex-1 min-w-0 flex items-center gap-1.5">
                                {item.course && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        isHeld
                                            ? 'bg-zinc-700 text-zinc-400'
                                            : 'bg-cyan-500/20 text-cyan-300'
                                    }`}>
                                        T{item.course}
                                    </span>
                                )}
                                <span className={`font-mono ${item.status === "COOKING" ? colors.cookingQty : "text-zinc-500"}`}>
                                    {item.qty}x
                                </span>
                                <span className="truncate" data-testid="kds-item-name">{item.name}</span>
                            </span>
                            <span className="ml-2 flex-shrink-0" data-testid="kds-item-status">
                                {isHeld && <Lock size={18} className="text-zinc-500" />}
                                {!isHeld && item.status === "PENDING" && <Play size={18} className="text-zinc-500" />}
                                {!isHeld && item.status === "COOKING" && <CookingIcon size={18} className={`${colors.cookingIcon} animate-pulse`} />}
                                {!isHeld && item.status === "READY" && <CheckCircle2 size={18} className="text-emerald-400" />}
                                {!isHeld && item.status === "DONE" && <Check size={18} className="text-zinc-600" />}
                            </span>
                        </div>
                    </motion.button>
                    );
                })}
            </div>
        </motion.div>
    );
}

export default KDSTicket;
