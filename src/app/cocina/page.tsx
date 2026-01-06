"use client";

import { useKitchenTickets } from "./hooks/useKitchenTickets";
import { useState, useEffect } from "react";
import { POSActions } from "@/src/core/actions/pos.actions";
import { Clock, CheckCircle2, Flame, ChefHat, Play, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type ItemStatus } from "@/src/core/domain/events";
import { Toaster } from "sonner";

// Config (MVP)
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TERM_ID = "kds_1";
const ACTOR_ID = "00000000-0000-0000-0000-000000000002"; // Chef

const STATIONS = ["All", "Cocina", "Parrilla", "Bar"];

export default function KDSPage() {
    const [station, setStation] = useState("All");
    const tickets = useKitchenTickets(station);
    const [now, setNow] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    // Hydration fix - only set time on client
    useEffect(() => {
        setNow(Date.now());
        setMounted(true);
    }, []);

    // Update time every minute to refresh "elapsed time" display
    useEffect(() => {
        if (!mounted) return;
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, [mounted]);

    const handleStatusClick = async (orderId: string, lineId: string, currentStatus: ItemStatus) => {
        let newStatus: ItemStatus = "COOKING";
        if (currentStatus === "PENDING") newStatus = "COOKING";
        else if (currentStatus === "COOKING") newStatus = "READY";
        else if (currentStatus === "READY") newStatus = "DONE";
        else return; // Already done

        await POSActions.updateItemStatus(TENANT_ID, TERM_ID, ACTOR_ID, orderId, lineId, currentStatus, newStatus, station);
    };

    const getElapsedTime = (isoDate?: string | null) => {
        if (!isoDate || !now) return "0m";
        const diff = Math.floor((now - new Date(isoDate).getTime()) / 60000);
        return `${diff}m`;
    };

    return (
        <div className="flex flex-col h-screen bg-park-black text-park-text font-sans overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-park-black to-park-black">
            <Toaster position="top-right" theme="dark" />

            {/* Header */}
            <div className="h-16 border-b border-park-border/50 flex items-center justify-between px-6 bg-park-black/50 backdrop-blur-xl z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-park-brand-500/10 rounded-lg border border-park-brand-500/20">
                        <ChefHat className="text-park-brand-500" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-white text-glow">KITCHEN<span className="text-park-brand-500">DISPLAY</span></h1>
                </div>

                <div className="flex gap-2">
                    {STATIONS.map(s => (
                        <button
                            key={s}
                            onClick={() => setStation(s)}
                            className={`px-4 py-1.5 rounded-full font-medium text-sm border transition-all duration-200 ${station === s
                                ? "bg-park-brand-500 text-white border-park-brand-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 text-zinc-500 text-sm font-mono bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800">
                    <Clock size={14} />
                    <span>{mounted && now ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                </div>
            </div>

            {/* Board */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
                <div className="flex gap-6 h-full">
                    <AnimatePresence mode="popLayout">
                        {tickets.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 animate-in fade-in duration-500">
                                <div className="p-8 rounded-full bg-zinc-900/50 mb-6 border border-zinc-800">
                                    <Flame size={64} className="opacity-20" />
                                </div>
                                <h2 className="text-2xl font-bold uppercase tracking-widest opacity-40">Todo Listo Chef</h2>
                                <p className="text-zinc-700 mt-2 font-mono text-sm">ESPERANDO NUEVOS PEDIDOS...</p>
                            </div>
                        )}

                        {tickets.map(ticket => {
                            const isDelivery = ticket.order_type === "DELIVERY";

                            return (
                                <motion.div
                                    key={ticket.order_id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, filter: "blur(5px)" }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className="min-w-[340px] max-w-[340px] flex flex-col h-full max-h-full glass rounded-xl overflow-hidden group hover:border-park-brand-500/30 transition-colors"
                                >
                                    {/* Ticket Header */}
                                    <div className={`p-4 border-b border-white/5 relative overflow-hidden ${isDelivery ? "bg-blue-950/30" : "bg-zinc-900/30"}`}>
                                        <div className="flex justify-between items-start mb-1 relative z-10">
                                            <span className="text-3xl font-black tracking-tighter text-white">#{ticket.order_number}</span>
                                            <span className="text-xl font-mono text-park-muted">{getElapsedTime(null)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-park-muted relative z-10 mt-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-2 h-2 rounded-full ${isDelivery ? "bg-blue-500" : "bg-emerald-500"}`}></span>
                                                <span>{isDelivery ? "DELIVERY" : "MESA 04"}</span>
                                            </div>
                                            <span>Mozo: T-01</span>
                                        </div>
                                        {/* Background sheen */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                                    </div>

                                    {/* Items List */}
                                    <div className="p-3 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                                        {Object.values(ticket.lines).map((item) => (
                                            <motion.button
                                                layout
                                                key={item.line_id}
                                                onClick={() => handleStatusClick(ticket.order_id, item.line_id, item.status)}
                                                whileTap={{ scale: 0.98 }}
                                                className={`w-full text-left p-3.5 rounded-lg border text-lg font-bold leading-tight transition-all relative overflow-hidden ${item.status === "DONE" ? "bg-zinc-900/50 text-zinc-600 line-through border-transparent" :
                                                        item.status === "COOKING" ? "bg-park-brand-900/20 border-park-brand-500/50 text-white shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
                                                            item.status === "READY" ? "bg-emerald-900/20 border-emerald-500/50 text-emerald-200" :
                                                                "bg-white/5 text-park-text border-white/5 hover:bg-white/10 hover:border-white/10"
                                                    }`}
                                            >
                                                {/* Animated Progress Bar for COOKING */}
                                                {item.status === "COOKING" && (
                                                    <motion.div
                                                        layoutId={`progress-${item.line_id}`}
                                                        className="absolute bottom-0 left-0 h-0.5 bg-park-brand-500 box-content"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: "100%" }}
                                                        transition={{ duration: 300, ease: "linear" }}
                                                    />
                                                )}

                                                <div className="flex justify-between items-start gap-4">
                                                    <span className="z-10 relative flex-1">
                                                        <span className={`mr-2 font-mono ${item.status === "COOKING" ? "text-park-brand-400" : "text-zinc-500"}`}>{item.qty}x</span>
                                                        {item.name}
                                                    </span>
                                                    <span className="z-10 pt-1">
                                                        {item.status === "PENDING" && <Play size={16} className="text-zinc-600" />}
                                                        {item.status === "COOKING" && <Flame size={16} className="text-park-brand-500 animate-pulse fill-park-brand-500/50" />}
                                                        {item.status === "READY" && <CheckCircle2 size={16} className="text-emerald-400" />}
                                                        {item.status === "DONE" && <Check size={16} className="text-zinc-700" />}
                                                    </span>
                                                </div>
                                            </motion.button>
                                        ))}
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="p-3 border-t border-white/5 bg-black/20">
                                        <button className="w-full py-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold uppercase rounded-lg text-xs tracking-widest transition-colors flex items-center justify-center gap-2">
                                            <span>Opciones</span>
                                            <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                                            <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                                            <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
