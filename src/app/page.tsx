'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStoredTerminalConfig, clearTerminalConfig } from '@/src/core/auth/fingerprint';
import { TerminalSetup } from '@/src/components/auth/TerminalSetup';
import type { TerminalConfig } from '@/src/core/auth/types';
import { 
    ArrowRight, 
    RefreshCw, 
    Sparkles, 
    Monitor, 
    ChefHat, 
    Wine, 
    Flame,
    Smartphone,
    Zap,
    Shield,
    WifiOff
} from 'lucide-react';

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

function getTerminalIcon(terminalId: string) {
    if (terminalId.startsWith('CAJA')) return Monitor;
    if (terminalId.startsWith('MOZO')) return Smartphone;
    if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return Flame;
    if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return ChefHat;
    if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return Wine;
    return Monitor;
}

function getTerminalColor(terminalId: string): { bg: string; border: string; text: string; glow: string } {
    if (terminalId.startsWith('CAJA')) return { 
        bg: 'from-emerald-500/20 to-emerald-600/5', 
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        glow: 'bg-emerald-500/30'
    };
    if (terminalId.startsWith('MOZO')) return { 
        bg: 'from-blue-500/20 to-blue-600/5', 
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        glow: 'bg-blue-500/30'
    };
    if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return { 
        bg: 'from-orange-500/20 to-orange-600/5', 
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        glow: 'bg-orange-500/30'
    };
    if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return { 
        bg: 'from-amber-500/20 to-amber-600/5', 
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        glow: 'bg-amber-500/30'
    };
    if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return { 
        bg: 'from-cyan-500/20 to-cyan-600/5', 
        border: 'border-cyan-500/30',
        text: 'text-cyan-400',
        glow: 'bg-cyan-500/30'
    };
    return { 
        bg: 'from-zinc-500/20 to-zinc-600/5', 
        border: 'border-zinc-500/30',
        text: 'text-zinc-400',
        glow: 'bg-zinc-500/30'
    };
}

// Animated grid background
function GridBackground() {
    return (
        <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        </div>
    );
}

// Floating orbs animation
function FloatingOrbs() {
    const orbs = useMemo(() => 
        Array.from({ length: 6 }, (_, i) => ({
            id: i,
            size: 200 + Math.random() * 300,
            x: Math.random() * 100,
            y: Math.random() * 100,
            duration: 20 + Math.random() * 10,
            delay: Math.random() * 5,
        })), []
    );

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {orbs.map((orb) => (
                <motion.div
                    key={orb.id}
                    className="absolute rounded-full bg-emerald-500/5 blur-3xl"
                    style={{
                        width: orb.size,
                        height: orb.size,
                        left: `${orb.x}%`,
                        top: `${orb.y}%`,
                    }}
                    animate={{
                        x: [0, 50, -30, 0],
                        y: [0, -40, 30, 0],
                        scale: [1, 1.1, 0.9, 1],
                    }}
                    transition={{
                        duration: orb.duration,
                        repeat: Infinity,
                        delay: orb.delay,
                        ease: "easeInOut",
                    }}
                />
            ))}
        </div>
    );
}

// Animated particles
function FloatingParticles() {
    const particles = useMemo(() => 
        Array.from({ length: 30 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 5,
            duration: 4 + Math.random() * 4,
            size: 2 + Math.random() * 4,
        })), []
    );

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    className="absolute bg-emerald-400/40 rounded-full"
                    style={{
                        width: particle.size,
                        height: particle.size,
                        left: `${particle.x}%`,
                        bottom: '-20px',
                    }}
                    animate={{
                        y: [0, -800],
                        opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                        duration: particle.duration,
                        repeat: Infinity,
                        delay: particle.delay,
                        ease: "easeOut",
                    }}
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

    // Loading - Premium loading screen
    if (checking) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/20 via-transparent to-transparent" />
                <GridBackground />
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-6"
                >
                    {/* Animated logo */}
                    <div className="relative">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 w-20 h-20 rounded-2xl border-2 border-emerald-500/30 border-t-emerald-400"
                        />
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/25">
                            <motion.span 
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="text-3xl font-black text-zinc-950"
                            >
                                P
                            </motion.span>
                        </div>
                    </div>
                    
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white">PARK POS</h1>
                        <motion.p 
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-sm text-zinc-500 mt-1"
                        >
                            Iniciando sistema...
                        </motion.p>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Terminal Setup (sin config guardada)
    if (showSetup) {
        return <TerminalSetup onComplete={handleSetupComplete} />;
    }

    // Sesión existente - mostrar opciones con diseño premium
    if (config) {
        const TerminalIcon = getTerminalIcon(config.terminal_id);
        const colors = getTerminalColor(config.terminal_id);

        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Background layers */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-zinc-950 to-zinc-950" />
                <GridBackground />
                <FloatingOrbs />
                <FloatingParticles />
                
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-lg relative z-10"
                >
                    {/* Logo Section */}
                    <div className="text-center mb-10">
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", duration: 1, bounce: 0.4 }}
                            className="relative inline-block"
                        >
                            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150" />
                            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/25">
                                <span className="text-3xl font-black text-zinc-950">P</span>
                            </div>
                        </motion.div>
                        
                        <motion.h1 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-4xl font-black mt-6 tracking-tight"
                        >
                            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">PARK</span>
                            <span className="text-white ml-2">POS</span>
                        </motion.h1>
                        
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-center justify-center gap-3 mt-3"
                        >
                            <div className="h-px w-12 bg-gradient-to-r from-transparent to-zinc-700" />
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <p className="text-zinc-400 text-sm font-medium">Sesión activa</p>
                            </div>
                            <div className="h-px w-12 bg-gradient-to-l from-transparent to-zinc-700" />
                        </motion.div>
                    </div>

                    {/* Terminal Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.4, type: "spring" }}
                        className="relative group"
                    >
                        {/* Glow effect */}
                        <div className={`absolute -inset-1 ${colors.glow} rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-all duration-500`} />
                        
                        <div className={`relative bg-gradient-to-br ${colors.bg} backdrop-blur-xl border ${colors.border} rounded-2xl p-8 overflow-hidden`}>
                            {/* Decorative corner */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full" />
                            
                            <div className="flex items-start gap-6">
                                {/* Icon */}
                                <motion.div 
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    className={`w-16 h-16 rounded-xl bg-zinc-800/80 flex items-center justify-center ${colors.text} flex-shrink-0`}
                                >
                                    <TerminalIcon className="w-8 h-8" />
                                </motion.div>
                                
                                {/* Info */}
                                <div className="flex-1">
                                    <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">Terminal configurado</p>
                                    <h2 className="text-2xl font-bold text-white mb-1">{getTerminalDisplayName(config.terminal_id)}</h2>
                                    <p className="text-sm text-zinc-500 font-mono">{config.terminal_id}</p>
                                </div>
                            </div>

                            {/* Status badges */}
                            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-zinc-800/50">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 text-xs text-zinc-400">
                                    <WifiOff className="w-3 h-3" />
                                    <span>Offline-ready</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 text-xs text-zinc-400">
                                    <Shield className="w-3 h-3" />
                                    <span>Seguro</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 text-xs text-zinc-400">
                                    <Zap className="w-3 h-3" />
                                    <span>Listo</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="space-y-3 mt-6"
                    >
                        <button
                            onClick={handleContinue}
                            disabled={navigating}
                            className="group w-full relative overflow-hidden py-4 px-6 rounded-xl font-bold text-zinc-950 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 bg-[length:200%_100%] opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="relative flex items-center justify-center gap-2">
                                {navigating ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        <span>Conectando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Continuar al sistema</span>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </span>
                        </button>
                        
                        <button
                            onClick={handleChange}
                            disabled={navigating}
                            className="w-full py-4 px-6 bg-zinc-900/50 hover:bg-zinc-800/50 text-zinc-400 hover:text-white font-medium rounded-xl transition-all border border-zinc-800 hover:border-zinc-700 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Cambiar terminal
                        </button>
                    </motion.div>

                    {/* Footer */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="text-center mt-10"
                    >
                        <p className="text-xs text-zinc-600">
                            PARK POS v2.1.1 
                            <span className="mx-2">|</span>
                            Sistema de punto de venta offline-first
                        </p>
                    </motion.div>
                </motion.div>
            </div>
        );
    }

    // Fallback with matching style
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/20 via-transparent to-transparent" />
            <GridBackground />
            
            <div className="relative">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 rounded-2xl border-2 border-zinc-700 border-t-emerald-500"
                />
            </div>
        </div>
    );
}
