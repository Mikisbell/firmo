"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTableStatus } from "./hooks/useTableStatus";
import { motion, AnimatePresence } from "framer-motion";
import { formatCents } from "@/src/core/domain/money";
import { Users, Utensils, Clock } from "lucide-react";

const PISOS = [
    { id: "P1", name: "Piso 1" },
    { id: "P2", name: "Piso 2" },
    { id: "P3", name: "Terraza" },
];

export default function WaiterPage() {
    const router = useRouter();
    const [piso, setPiso] = useState("P1");
    const tables = useTableStatus();

    // Filter tables for current floor
    const filteredTables = tables.filter(t => {
        const num = parseInt(t.id.replace("M", ""));
        if (piso === "P1" && num <= 3) return true;
        if (piso === "P2" && num > 3 && num <= 6) return true;
        if (piso === "P3" && num > 6) return true;
        return false;
    });

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    return (
        <div className="min-h-screen bg-zinc-950 pb-24 text-zinc-100 font-sans">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span>PARK</span>
                        <span className="text-emerald-500">MOZO</span>
                    </h1>
                    <p className="text-xs text-zinc-500 font-medium">Terminal T-01</p>
                </div>

                {/* Sync Indicator */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    <div className="relative flex h-2 w-2">
                        {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{isOnline ? 'LIVE' : 'OFFLINE'}</span>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Floor Selector */}
                <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl overflow-x-auto gap-2 border border-zinc-800/50">
                    {PISOS.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setPiso(p.id)}
                            className="relative flex-1 py-3 px-4 text-sm font-semibold rounded-xl transition-all outline-none"
                        >
                            {piso === p.id && (
                                <motion.div
                                    layoutId="floor-bg"
                                    className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-900/40"
                                    initial={false}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className={`relative z-10 ${piso === p.id ? "text-white" : "text-zinc-400"}`}>
                                {p.name}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Tables Grid */}
                <motion.div
                    layout
                    className="grid grid-cols-2 md:grid-cols-3 gap-4"
                >
                    <AnimatePresence mode="popLayout">
                        {filteredTables.map((t) => (
                            <motion.button
                                key={t.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={() => router.push(`/mozo/mesa/${t.id}`)} // Real Navigation
                                whileTap={{ scale: 0.97 }}
                                className={`relative aspect-[4/3] rounded-3xl flex flex-col items-center justify-center border transition-all overflow-hidden group ${t.status === "OCCUPIED"
                                    ? "bg-slate-900/80 border-indigo-500/30 shadow-xl shadow-indigo-900/10"
                                    : "bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800/60 hover:border-emerald-500/30"
                                    }`}
                            >
                                {/* Active State Background Gradient */}
                                {t.status === "OCCUPIED" && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
                                )}

                                <div className="space-y-2 z-10 flex flex-col items-center">
                                    <div className={`p-3 rounded-2xl transition-colors ${t.status === "OCCUPIED"
                                        ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-inset ring-indigo-500/20"
                                        : "bg-zinc-800 text-zinc-500 group-hover:text-emerald-400 group-hover:bg-emerald-500/10"
                                        }`}>
                                        {t.status === "OCCUPIED"
                                            ? <Users className="w-6 h-6" />
                                            : <Utensils className="w-6 h-6" />
                                        }
                                    </div>

                                    <div className="text-center">
                                        <div className="text-lg font-bold text-white tracking-tight">{t.name}</div>
                                        {t.status === "OCCUPIED" ? (
                                            <div className="mt-1 flex flex-col animate-in fade-in slide-in-from-bottom-2">
                                                <span className="text-sm font-mono font-medium text-emerald-400">
                                                    {formatCents((t.totalCents || 0) as any)}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 mt-0.5 flex items-center justify-center gap-1">
                                                    <Clock className="w-3 h-3" /> 12m
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs font-medium text-zinc-500 mt-1 block group-hover:text-zinc-400">
                                                Disponible
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Status Light */}
                                <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${t.status === "OCCUPIED" ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" : "bg-zinc-700"
                                    }`} />
                            </motion.button>
                        ))}
                    </AnimatePresence>

                    {/* Add Table Button (Mock) */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="aspect-[4/3] rounded-3xl border-2 border-dashed border-zinc-800 text-zinc-600 flex flex-col items-center justify-center hover:bg-zinc-900 hover:border-zinc-700 hover:text-zinc-400 transition-colors"
                    >
                        <span className="text-2xl font-light mb-1">+</span>
                        <span className="text-xs font-bold uppercase tracking-wider">Barra</span>
                    </motion.button>
                </motion.div>
            </div>
        </div>
    );
}
