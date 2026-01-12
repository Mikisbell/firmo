'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getStoredTerminalConfig, clearTerminalConfig } from '@/src/core/auth/fingerprint';
import { TerminalSetup } from '@/src/components/auth/TerminalSetup';
import type { TerminalConfig } from '@/src/core/auth/types';
import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react';

// Map terminal IDs to their routes
function getRouteForTerminal(terminalId: string): string {
    if (terminalId.startsWith('CAJA')) return '/pos';
    if (terminalId.startsWith('MOZO')) return '/mozo';
    if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return '/cocina/horno';
    if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return '/cocina';
    if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return '/bar';
    return '/pos';
}

function getTerminalDisplayName(terminalId: string): string {
    if (terminalId.startsWith('CAJA')) return 'Caja Principal';
    if (terminalId.startsWith('MOZO')) {
        const num = terminalId.replace('MOZO_', '');
        return `Mesero ${parseInt(num)}`;
    }
    if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return 'Horno/Parrilla';
    if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return 'Cocina';
    if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return 'Bar';
    return terminalId;
}

function getRoleEmoji(terminalId: string): string {
    if (terminalId.startsWith('CAJA')) return '💰';
    if (terminalId.startsWith('MOZO')) return '🍽️';
    if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return '🔥';
    if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return '👨‍🍳';
    if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return '🍺';
    return '📱';
}

function FloatingParticles() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-emerald-500/20 rounded-full"
                    initial={{ x: Math.random() * 400, y: Math.random() * 800 }}
                    animate={{ y: [null, -100], opacity: [0, 1, 0] }}
                    transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
                />
            ))}
        </div>
    );
}

export default function HomePage() {
    const [config, setConfig] = useState<TerminalConfig | null>(null);
    const [showSetup, setShowSetup] = useState(false);
    const [checking, setChecking] = useState(true);
    const [navigating, setNavigating] = useState(false);

    useEffect(() => {
        const stored = getStoredTerminalConfig();
        if (stored?.terminal_id) {
            setConfig(stored);
        } else {
            setShowSetup(true);
        }
        setChecking(false);
    }, []);

    const handleSetupComplete = (newConfig: TerminalConfig) => {
        setConfig(newConfig);
        setShowSetup(false);
        setNavigating(true);
        // Navegar directamente a la ruta del rol
        window.location.href = getRouteForTerminal(newConfig.terminal_id);
    };

    const handleContinue = () => {
        if (config && !navigating) {
            setNavigating(true);
            window.location.href = getRouteForTerminal(config.terminal_id);
        }
    };

    const handleChange = () => {
        clearTerminalConfig();
        setConfig(null);
        setShowSetup(true);
    };

    // Loading
    if (checking) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 border-4 border-zinc-800 border-t-emerald-500 rounded-full"
                />
            </div>
        );
    }

    // Terminal Setup (sin config guardada)
    if (showSetup) {
        return <TerminalSetup onComplete={handleSetupComplete} />;
    }

    // Sesión existente - mostrar opciones
    if (config) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-zinc-950 to-zinc-950" />
                <FloatingParticles />
                
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md relative z-10"
                >
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", duration: 0.8 }}
                            className="relative inline-block"
                        >
                            <div className="absolute inset-0 bg-emerald-500/30 blur-3xl rounded-full" />
                            <img src="/logo.svg" alt="PARK POS" className="w-24 h-24 relative z-10 drop-shadow-2xl" />
                        </motion.div>
                        
                        <h1 className="text-4xl font-black mt-6 tracking-tight">
                            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">PARK</span>
                            <span className="text-white ml-2">POS</span>
                        </h1>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <Sparkles className="w-4 h-4 text-emerald-500" />
                            <p className="text-zinc-500 text-sm">Sesión activa detectada</p>
                            <Sparkles className="w-4 h-4 text-emerald-500" />
                        </div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="relative group"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                        <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8">
                            <div className="text-center">
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="text-5xl mb-4"
                                >
                                    {getRoleEmoji(config.terminal_id)}
                                </motion.div>
                                <p className="text-zinc-500 text-sm mb-1">Terminal actual</p>
                                <h2 className="text-2xl font-bold text-white mb-1">{getTerminalDisplayName(config.terminal_id)}</h2>
                                <p className="text-xs text-zinc-600 font-mono">{config.terminal_id}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="space-y-3 mt-6"
                    >
                        <button
                            onClick={handleContinue}
                            disabled={navigating}
                            className="group w-full relative overflow-hidden py-4 px-6 rounded-xl font-bold text-white transition-all disabled:opacity-50"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 bg-[length:200%_100%] animate-gradient" />
                            <span className="relative flex items-center justify-center gap-2">
                                {navigating ? (
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>Continuar <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </span>
                        </button>
                        
                        <button
                            onClick={handleChange}
                            disabled={navigating}
                            className="w-full py-4 px-6 bg-zinc-900/50 hover:bg-zinc-800/50 text-zinc-300 hover:text-white font-medium rounded-xl transition-all border border-zinc-800 hover:border-zinc-700 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Cambiar Terminal
                        </button>
                    </motion.div>

                    <p className="text-center text-xs text-zinc-600 mt-8">PARK POS v2.1.1</p>
                </motion.div>
            </div>
        );
    }

    // Fallback
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
        </div>
    );
}
