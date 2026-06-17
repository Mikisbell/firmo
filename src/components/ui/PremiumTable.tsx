"use client";

import React from "react";
import { motion } from "framer-motion";
import { Utensils, Users, Clock, Receipt, Merge } from "lucide-react";
import { getTableColors, TableStatus } from "./table-theme";
import { formatCents } from "@/src/core/domain/money";

export interface PremiumTableProps {
    id: string;
    number: string;
    displayName?: string | null;
    status: TableStatus;
    elapsedMinutes?: number;
    inactivityThresholdMin?: number;
    slaStatus?: "NORMAL" | "SLA_WARNING" | "SLA_CRITICAL";
    totalCents?: number;
    readyItemsCount?: number;
    isMerged?: boolean;
    shape?: string;
    zoneColor?: string;
    zoneCode?: string;
    // Mode specific
    mode: "grid" | "canvas";
    // Canvas specific
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    isEditor?: boolean;
    isDragging?: boolean;
    isDraggable?: boolean;
    // Interactions
    onClick?: () => void;
    onDragStart?: () => void;
    onDragEnd?: (e: any, info: any) => void;
    dragConstraints?: React.RefObject<any>;
    isDark?: boolean;
}

export function PremiumTable({
    id,
    number,
    displayName,
    status,
    elapsedMinutes,
    inactivityThresholdMin = 15,
    totalCents,
    readyItemsCount,
    isMerged,
    shape = "SQUARE",
    zoneColor,
    zoneCode,
    mode,
    x = 0,
    y = 0,
    width = 100,
    height = 100,
    rotation = 0,
    isEditor = false,
    isDragging = false,
    isDraggable = false,
    onClick,
    onDragStart,
    onDragEnd,
    dragConstraints,
    isDark = true,
    slaStatus,
}: PremiumTableProps) {
    const colors = getTableColors(status, elapsedMinutes, inactivityThresholdMin, isDark, slaStatus);
    
    const isRound = shape === "ROUND";
    const isBarStool = shape === "BAR_STOOL";
    
    // Geometry classes
    const borderRadius = mode === "grid" 
        ? "rounded-xl md:rounded-2xl" 
        : isRound ? "rounded-full" : isBarStool ? "rounded-t-full rounded-b-xl" : "rounded-2xl";

    const baseClasses = `
        flex flex-col items-center justify-center
        border transition-all overflow-hidden group
        ${colors.bg} ${colors.border} shadow-xl ${colors.shadow}
    `;

    const interactionClasses = mode === "canvas" && isDraggable
        ? "cursor-grab active:cursor-grabbing"
        : onClick ? "cursor-pointer" : "";

    const activeEffects = isDragging
        ? "scale-110 shadow-2xl z-50 ring-4 ring-emerald-500/50"
        : (onClick || isDraggable) ? "hover:ring-2 ring-emerald-500/30 hover:scale-[1.02]" : "";

    const pulseEffect = readyItemsCount && readyItemsCount > 0 
        ? 'border-emerald-400 animate-pulse' 
        : colors.isAlert
        ? 'ring-2 ring-rose-500/60 animate-pulse shadow-rose-500/30' : '';

    const containerStyle = mode === "canvas" ? {
        width, height, top: 0, left: 0, rotate: rotation || 0, position: 'absolute' as const
    } : {};

    const className = `
        ${mode === "canvas" ? "absolute origin-center" : "relative min-h-[80px] md:min-h-[140px] aspect-[4/3] w-full"}
        ${baseClasses}
        ${borderRadius}
        ${interactionClasses}
        ${activeEffects}
        ${pulseEffect}
        z-10
    `;

    const content = (
        <>
            {/* Ambient Background Gradient */}
            {status !== "FREE" && status !== "UNAVAILABLE" && (
                <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} pointer-events-none opacity-60`} />
            )}

            {/* Inner Glass border effect */}
            <div className={`absolute inset-0 rounded-inherit border border-white/5 pointer-events-none`} style={{ borderRadius: 'inherit' }} />

            {/* Top-Left Badges (Ready items / Bill) */}
            {(readyItemsCount || 0) > 0 && (
                <div className="absolute top-1.5 left-1.5 md:top-2 md:left-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] md:text-xs font-bold rounded-full animate-pulse shadow-lg shadow-emerald-500/50 z-20">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    {readyItemsCount}
                </div>
            )}
            
            {status === "BILL_REQUESTED" && (
                <div className="absolute top-1.5 left-1.5 md:top-2 md:left-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] md:text-xs font-bold rounded-full animate-pulse shadow-lg shadow-amber-500/50 z-20">
                    <Receipt size={10} />
                    {mode === "grid" && <span className="hidden md:inline">CUENTA</span>}
                </div>
            )}

            {/* Zone Indicator */}
            {zoneCode && zoneColor && mode === "grid" && (
                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-black/40 z-20"
                     style={{ color: zoneColor }}>
                    {zoneCode}
                </div>
            )}

            {/* Main Content Area */}
            <div className="space-y-1 md:space-y-1.5 z-10 flex flex-col items-center justify-center w-full h-full p-2">
                {/* Icon removed per user request to reduce redundancy */}
                {/* Table Number & Name */}
                <div className="text-center w-full">
                    <div className={`${mode === "canvas" ? "text-xl md:text-3xl" : "text-3xl sm:text-4xl lg:text-5xl"} font-black text-white tracking-tighter drop-shadow-md leading-none`}>
                        {mode === "canvas" ? `${number}` : displayName || number}
                    </div>
                    
                    {mode === "grid" && displayName && (
                        <div className="text-[10px] text-zinc-400 mt-0.5 uppercase font-medium max-w-[90%] truncate mx-auto">
                            {displayName}
                        </div>
                    )}

                    {/* Operational Data (Occupied) */}
                    {status !== "FREE" && status !== "UNAVAILABLE" && !isEditor ? (
                        <div className="mt-1 flex flex-col items-center">
                            {totalCents !== undefined && (
                                <span className={`text-[11px] md:text-sm font-mono font-bold ${colors.text}`}>
                                    {formatCents(totalCents)}
                                </span>
                            )}
                            {mode === "grid" && (
                                <span className={`text-[9px] mt-0.5 flex items-center justify-center gap-0.5 ${colors.isAlert ? 'text-rose-500 font-bold bg-rose-500/10' : colors.text + ' bg-black/20'} px-1.5 py-0.5 rounded-full`}>
                                    <Clock className="w-2 h-2" /> {colors.label} {colors.isAlert && '⚠️'}
                                </span>
                            )}
                        </div>
                    ) : (
                        !isEditor && mode === "grid" && (
                            <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider mt-1 block ${colors.text}`}>
                                {colors.label}
                            </span>
                        )
                    )}
                </div>
            </div>

            {/* Top-Right Order Indicator (only if occupied) */}
            {status !== 'FREE' && status !== 'UNAVAILABLE' && !isEditor && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 md:w-5 md:h-5 bg-black/60 border border-white/10 rounded-full flex items-center justify-center z-20 backdrop-blur-sm">
                    <span className="text-[8px] md:text-[9px] font-bold text-white tabular-nums">1</span>
                </div>
            )}

            {/* Glowing Status Light */}
            {!isEditor && (
                <div className={`absolute ${mode === 'canvas' ? 'top-2 right-2' : status !== 'FREE' ? 'top-2 right-8 md:right-9' : 'top-2 right-2'} w-2 h-2 rounded-full ${colors.light} z-20`} />
            )}

            {/* Merged Indicator */}
            {isMerged && (
                <div className="absolute -bottom-2 -right-2 bg-purple-500 text-white rounded-full p-1 shadow-lg shadow-purple-500/50 z-20">
                    <Merge className="w-3 h-3" />
                </div>
            )}
        </>
    );

    if (mode === "grid") {
        return (
            <motion.button
                layout
                data-testid={`table-${number}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={onClick}
                whileTap={{ scale: 0.95 }}
                className={className}
            >
                {content}
            </motion.button>
        );
    }

    return (
        <motion.div
            data-testid={`table-${number}`}
            drag={isDraggable}
            dragMomentum={false}
            dragConstraints={dragConstraints}
            animate={{ x, y }}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onClick}
            whileTap={onClick ? { scale: 0.95 } : undefined}
            className={className}
            style={containerStyle as any}
        >
            {content}
        </motion.div>
    );
}
