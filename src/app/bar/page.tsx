"use client";

import { useKitchenTickets } from "../cocina/hooks/useKitchenTickets";
import { useState, useEffect } from "react";
import { POSActions } from "@/src/core/actions/pos.actions";
import { Clock, CheckCircle2, Wine, Play, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type ItemStatus } from "@/src/core/domain/events";
import { Toaster } from "sonner";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TERM_ID = "kds_bar";
const ACTOR_ID = "00000000-0000-0000-0000-000000000006"; // Barman

export default function BarKDSPage() {
    const tickets = useKitchenTickets("Bar");
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
        let newStatus: ItemStatus = "COOKING";
        if (currentStatus === "PENDING") newStatus = "COOKING";
        else if (currentStatus === "COOKING") newStatus = "READY";
        else if (currentStatus === "READY") newStatus = "DONE";
        else return;

        await POSActions.updateItemStatus(TENANT_ID, TERM_ID, ACTOR_ID, orderId, lineId, currentStatus, newStatus, "Bar");
    };

    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-white font-sans overflow-hidden">
            <Toaster position="top-right" theme="dark" />

            {/* Header */}
            <header className="h-16 bg-amber-950/50 border-b-4 border-amber-600 flex items-center px-6 justify-between">
                <div className="flex items-center gap-3">
                    <Wine className="text-amber-500" size={28} />
                    <h1 className="text-2xl font-black tracking-widest">
                        <span className="text-amber-500">BAR</span> DISPLAY
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-lg font-bold">
                        <span className="text-yellow-400">PENDIENTE:</span>
                        <span>{tickets.reduce((acc, t) => acc + Object.values(t.lines).filter(l => l.status === "PENDING").length, 0)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-500 text-sm font-mono bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800">
                        <Clock size={14} />
                        <span>{mounted && now ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                    </div>
                </div>
            </header>

            {/* Board */}
            <main className="flex-1 p-6 overflow-x-auto">
                <div className="flex gap-6 h-full">
                    <AnimatePresence mode="popLayout">
                        {tickets.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                                <Wine size={64} className="opacity-20 mb-6" />
                                <h2 className="text-2xl font-bold uppercase tracking-widest opacity-40">Sin Pedidos</h2>
                                <p className="text-zinc-700 mt-2 text-sm">Esperando bebidas...</p>
                            </div>
                        )}

                        {tickets.map(ticket => (
                            <motion.div
                                key={ticket.order_id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="min-w-[320px] max-w-[320px] bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"
                            >
                                <div className="p-4 bg-amber-950/30 border-b border-zinc-800">
                                    <div className="flex justify-between items-center">
                                        <span className="text-3xl font-black text-white">#{ticket.order_number}</span>
                                        <span className="text-sm text-zinc-500">{ticket.order_type}</span>
                                    </div>
                                </div>

                                <div className="p-3 space-y-2">
                                    {Object.values(ticket.lines).map((item) => (
                                        <motion.button
                                            key={item.line_id}
                                            onClick={() => handleStatusClick(ticket.order_id, item.line_id, item.status)}
                                            className={`w-full text-left p-3 rounded-lg border text-lg font-bold transition-all ${
                                                item.status === "DONE" ? "bg-zinc-800 text-zinc-600 line-through border-transparent" :
                                                item.status === "COOKING" ? "bg-amber-900/30 border-amber-500/50 text-amber-200" :
                                                item.status === "READY" ? "bg-emerald-900/30 border-emerald-500/50 text-emerald-200" :
                                                "bg-zinc-800 text-white border-zinc-700 hover:border-amber-500/50"
                                            }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span>
                                                    <span className="text-amber-400 mr-2">{item.qty}x</span>
                                                    {item.name}
                                                </span>
                                                {item.status === "PENDING" && <Play size={16} className="text-zinc-500" />}
                                                {item.status === "COOKING" && <Wine size={16} className="text-amber-400 animate-pulse" />}
                                                {item.status === "READY" && <CheckCircle2 size={16} className="text-emerald-400" />}
                                                {item.status === "DONE" && <Check size={16} className="text-zinc-600" />}
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
