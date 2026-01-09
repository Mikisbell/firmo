"use client";

import { useKitchenTicketsByGroup } from "../hooks/useKitchenTickets";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { POSActions } from "@/src/core/actions/pos.actions";
import { Clock, CheckCircle2, Flame, Play, Check, LogOut, Home } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type ItemStatus } from "@/src/core/domain/events";
import { Toaster } from "sonner";
import { getTerminalConfig } from "@/src/core/config/terminal";
import { canTransition, getNextNormalState } from "@/src/core/domain/item-status-machine";
import { clearTerminalConfig } from "@/src/core/auth/fingerprint";
import { useRequireTerminal } from "@/src/hooks/useRequireTerminal";

const config = getTerminalConfig("SPC_HORNO");

export default function HornoKDSPage() {
    const tickets = useKitchenTicketsByGroup("HORNO");
    const router = useRouter();
    const { isLoading, isAuthenticated } = useRequireTerminal();
    const [now, setNow] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    const handleExit = () => {
        clearTerminalConfig();
        router.push("/");
    };

    const handleHome = () => {
        router.push("/");
    };

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
            "PARRILLA"
        );
    };

    const pendingCount = tickets.reduce((acc, t) => acc + Object.values(t.lines).filter(l => l.status === "PENDING").length, 0);
    const cookingCount = tickets.reduce((acc, t) => acc + Object.values(t.lines).filter(l => l.status === "COOKING").length, 0);

    // Mostrar loading mientras verifica autenticación
    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-zinc-700 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-white font-sans overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-950/40 via-zinc-950 to-zinc-950">
            <Toaster position="top-right" theme="dark" />

            {/* Header - Estilo Fuego/Horno */}
            <header className="h-20 bg-gradient-to-r from-orange-950/80 to-red-950/80 border-b-4 border-orange-500 flex items-center px-6 justify-between shadow-[0_4px_20px_rgba(249,115,22,0.3)]">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-500/20 rounded-xl border-2 border-orange-500/50">
                        <Flame className="text-orange-400" size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-wider">
                            <span className="text-orange-400">HORNO</span>
                            <span className="text-orange-600/60 text-lg ml-2">PARRILLA</span>
                        </h1>
                        <p className="text-orange-300/50 text-xs uppercase tracking-widest">Pollos • Carnes • Parrilla</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Counters */}
                    <div className="flex gap-4">
                        <div className="text-center px-4 py-2 bg-orange-950/50 rounded-lg border border-orange-500/30">
                            <div className="text-2xl font-black text-orange-400">{pendingCount}</div>
                            <div className="text-[10px] uppercase tracking-wider text-orange-300/60">Pendiente</div>
                        </div>
                        <div className="text-center px-4 py-2 bg-red-950/50 rounded-lg border border-red-500/30">
                            <div className="text-2xl font-black text-red-400">{cookingCount}</div>
                            <div className="text-[10px] uppercase tracking-wider text-red-300/60">En Fuego</div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-zinc-400 text-sm font-mono bg-zinc-900/80 px-4 py-2 rounded-lg border border-zinc-700">
                        <Clock size={16} />
                        <span className="text-lg">{mounted && now ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                    </div>

                    {/* Home Button */}
                    <button
                        onClick={handleHome}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-zinc-700"
                        title="Ir al inicio"
                    >
                        <Home size={18} />
                    </button>

                    {/* Exit Button */}
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/30"
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Cerrar sesión</span>
                    </button>
                </div>
            </header>

            {/* Board */}
            <main className="flex-1 p-6 overflow-x-auto">
                <div className="flex gap-5 h-full">
                    <AnimatePresence mode="popLayout">
                        {tickets.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="p-10 rounded-full bg-orange-950/30 border-2 border-orange-500/20 mb-6">
                                    <Flame size={80} className="text-orange-500/30" />
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-widest text-orange-500/40">Horno Listo</h2>
                                <p className="text-orange-300/30 mt-2 text-sm uppercase tracking-wider">Esperando pollos...</p>
                            </div>
                        )}

                        {tickets.map(ticket => (
                            <motion.div
                                key={ticket.order_id}
                                layout
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="min-w-[360px] max-w-[360px] bg-zinc-900/90 rounded-2xl border-2 border-orange-500/30 overflow-hidden shadow-[0_0_30px_rgba(249,115,22,0.15)]"
                            >
                                {/* Ticket Header */}
                                <div className="p-5 bg-gradient-to-r from-orange-950/60 to-red-950/40 border-b-2 border-orange-500/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-4xl font-black text-white">#{ticket.order_number}</span>
                                        <div className="text-right">
                                            <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                                                ticket.order_type === "DELIVERY" 
                                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                                                    : "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                            }`}>
                                                {ticket.order_type === "DELIVERY" ? "🛵 Delivery" : "🍽️ Mesa"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Items - ordenados por line_id para consistencia */}
                                <div className="p-4 space-y-3">
                                    {Object.values(ticket.lines)
                                        .sort((a, b) => a.line_id.localeCompare(b.line_id))
                                        .map((item) => (
                                        <motion.button
                                            key={item.line_id}
                                            layout
                                            onClick={() => handleStatusClick(ticket.order_id, item.line_id, item.status)}
                                            whileTap={{ scale: 0.98 }}
                                            className={`w-full text-left p-4 rounded-xl border-2 text-xl font-bold transition-all ${
                                                item.status === "DONE" 
                                                    ? "bg-zinc-800/50 text-zinc-600 line-through border-zinc-700/50" 
                                                    : item.status === "COOKING" 
                                                        ? "bg-gradient-to-r from-orange-900/40 to-red-900/30 border-orange-500 text-orange-100 shadow-[0_0_20px_rgba(249,115,22,0.2)]" 
                                                        : item.status === "READY" 
                                                            ? "bg-emerald-900/30 border-emerald-500 text-emerald-200" 
                                                            : "bg-zinc-800/80 text-white border-zinc-600 hover:border-orange-500/50 hover:bg-zinc-800"
                                            }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span>
                                                    <span className={`mr-3 font-mono ${item.status === "COOKING" ? "text-orange-400" : "text-zinc-500"}`}>
                                                        {item.qty}x
                                                    </span>
                                                    {item.name}
                                                </span>
                                                <span>
                                                    {item.status === "PENDING" && <Play size={20} className="text-zinc-500" />}
                                                    {item.status === "COOKING" && <Flame size={20} className="text-orange-400 animate-pulse" />}
                                                    {item.status === "READY" && <CheckCircle2 size={20} className="text-emerald-400" />}
                                                    {item.status === "DONE" && <Check size={20} className="text-zinc-600" />}
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
