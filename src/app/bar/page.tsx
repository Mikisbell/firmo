"use client";

import { useKitchenTicketsByGroup } from "../cocina/hooks/useKitchenTickets";
import { useState, useEffect } from "react";
import { POSActions } from "@/src/core/actions/pos.actions";
import { Clock, CheckCircle2, Beer, Play, Check, GlassWater } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type ItemStatus } from "@/src/core/domain/events";
import { Toaster } from "sonner";
import { getTerminalConfig } from "@/src/core/config/terminal";
import { canTransition, getNextNormalState } from "@/src/core/domain/item-status-machine";

const config = getTerminalConfig("SPC_BAR");

export default function BarKDSPage() {
    const tickets = useKitchenTicketsByGroup("BAR");
    const [now, setNow] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setNow(Date.now());
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, [mounted]);

    const handleStatusClick = async (orderId: string, lineId: string, currentStatus: ItemStatus) => {
        const nextStatus = getNextNormalState(currentStatus);
        if (!nextStatus || !canTransition(currentStatus, nextStatus)) return;

        await POSActions.updateItemStatus(
            config.tenant_id, 
            config.terminal_id, 
            config.actor_id, 
            orderId, 
            lineId, 
            currentStatus, 
            nextStatus, 
            "BAR"
        );
    };

    const pendingCount = tickets.reduce((acc, t) => acc + Object.values(t.lines).filter(l => l.status === "PENDING").length, 0);
    const preparingCount = tickets.reduce((acc, t) => acc + Object.values(t.lines).filter(l => l.status === "COOKING").length, 0);

    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-white font-sans overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-950/40 via-zinc-950 to-zinc-950">
            <Toaster position="top-right" theme="dark" />

            {/* Header - Estilo Bar/Azul */}
            <header className="h-20 bg-gradient-to-r from-sky-950/80 to-blue-950/60 border-b-4 border-sky-500 flex items-center px-6 justify-between shadow-[0_4px_20px_rgba(14,165,233,0.25)]">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-sky-500/20 rounded-xl border-2 border-sky-500/50">
                        <Beer className="text-sky-400" size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-wider">
                            <span className="text-sky-400">BAR</span>
                        </h1>
                        <p className="text-sky-300/50 text-xs uppercase tracking-widest">Bebidas • Jugos • Chicha</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Counters */}
                    <div className="flex gap-4">
                        <div className="text-center px-4 py-2 bg-sky-950/50 rounded-lg border border-sky-500/30">
                            <div className="text-2xl font-black text-sky-400">{pendingCount}</div>
                            <div className="text-[10px] uppercase tracking-wider text-sky-300/60">Pendiente</div>
                        </div>
                        <div className="text-center px-4 py-2 bg-blue-950/50 rounded-lg border border-blue-500/30">
                            <div className="text-2xl font-black text-blue-400">{preparingCount}</div>
                            <div className="text-[10px] uppercase tracking-wider text-blue-300/60">Preparando</div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-zinc-400 text-sm font-mono bg-zinc-900/80 px-4 py-2 rounded-lg border border-zinc-700">
                        <Clock size={16} />
                        <span className="text-lg">{mounted && now ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                    </div>
                </div>
            </header>

            {/* Board */}
            <main className="flex-1 p-6 overflow-x-auto">
                <div className="flex gap-5 h-full">
                    <AnimatePresence mode="popLayout">
                        {tickets.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="p-10 rounded-full bg-sky-950/30 border-2 border-sky-500/20 mb-6">
                                    <GlassWater size={80} className="text-sky-500/30" />
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-widest text-sky-500/40">Bar Listo</h2>
                                <p className="text-sky-300/30 mt-2 text-sm uppercase tracking-wider">Esperando bebidas...</p>
                            </div>
                        )}

                        {tickets.map(ticket => (
                            <motion.div
                                key={ticket.order_id}
                                layout
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="min-w-[320px] max-w-[320px] bg-zinc-900/90 rounded-2xl border-2 border-sky-500/30 overflow-hidden shadow-[0_0_25px_rgba(14,165,233,0.15)]"
                            >
                                {/* Ticket Header */}
                                <div className="p-4 bg-gradient-to-r from-sky-950/50 to-blue-950/30 border-b-2 border-sky-500/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-3xl font-black text-white">#{ticket.order_number}</span>
                                        <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                                            ticket.order_type === "DELIVERY" 
                                                ? "bg-blue-500/30 text-blue-200 border border-blue-400/30" 
                                                : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                        }`}>
                                            {ticket.order_type === "DELIVERY" ? "🛵 Delivery" : "🍽️ Mesa"}
                                        </span>
                                    </div>
                                </div>

                                {/* Items - ordenados por line_id para consistencia */}
                                <div className="p-3 space-y-2">
                                    {Object.values(ticket.lines)
                                        .sort((a, b) => a.line_id.localeCompare(b.line_id))
                                        .map((item) => (
                                        <motion.button
                                            key={item.line_id}
                                            layout
                                            onClick={() => handleStatusClick(ticket.order_id, item.line_id, item.status)}
                                            whileTap={{ scale: 0.98 }}
                                            className={`w-full text-left p-3.5 rounded-xl border-2 text-lg font-bold transition-all ${
                                                item.status === "DONE" 
                                                    ? "bg-zinc-800/50 text-zinc-600 line-through border-zinc-700/50" 
                                                    : item.status === "COOKING" 
                                                        ? "bg-sky-900/30 border-sky-500 text-sky-100 shadow-[0_0_15px_rgba(14,165,233,0.2)]" 
                                                        : item.status === "READY" 
                                                            ? "bg-emerald-900/30 border-emerald-500 text-emerald-200" 
                                                            : "bg-zinc-800/80 text-white border-zinc-600 hover:border-sky-500/50"
                                            }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span>
                                                    <span className={`mr-2 font-mono ${item.status === "COOKING" ? "text-sky-400" : "text-zinc-500"}`}>
                                                        {item.qty}x
                                                    </span>
                                                    {item.name}
                                                </span>
                                                <span>
                                                    {item.status === "PENDING" && <Play size={18} className="text-zinc-500" />}
                                                    {item.status === "COOKING" && <Beer size={18} className="text-sky-400 animate-pulse" />}
                                                    {item.status === "READY" && <CheckCircle2 size={18} className="text-emerald-400" />}
                                                    {item.status === "DONE" && <Check size={18} className="text-zinc-600" />}
                                                </span>
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
