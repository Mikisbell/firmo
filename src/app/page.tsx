'use client';

// Página principal - Selector de Terminal
// Redirige automáticamente si ya hay un terminal configurado

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TerminalSetup } from '@/src/components/auth/TerminalSetup';
import { getStoredTerminalConfig, clearTerminalConfig } from '@/src/core/auth/fingerprint';
import type { TerminalConfig } from '@/src/core/auth/types';

// TEMPORAL: Reset IndexedDB cuando hay error de schema
async function resetIndexedDB() {
    if (typeof window === 'undefined') return;
    try {
        // Borrar la base de datos de Dexie
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase('ParkDB');
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            req.onblocked = () => {
                console.warn('DB delete blocked, forcing...');
                resolve();
            };
        });
        // Limpiar config de terminal
        clearTerminalConfig();
        // Recargar
        window.location.reload();
    } catch (e) {
        console.error('Error resetting DB:', e);
        alert('Error al resetear. Intenta limpiar datos del sitio manualmente.');
    }
}

// Detectar errores de IndexedDB y mostrar botón de reset
function useIndexedDBErrorDetection() {
    const [hasDBError, setHasDBError] = useState(false);
    
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            const msg = event.message || '';
            if (msg.includes('UpgradeError') || 
                msg.includes('DatabaseClosedError') || 
                msg.includes('primary key') ||
                msg.includes('IndexedDB')) {
                console.error('[IndexedDB Error Detected]', msg);
                setHasDBError(true);
            }
        };
        
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = String(event.reason || '');
            if (reason.includes('UpgradeError') || 
                reason.includes('DatabaseClosedError') || 
                reason.includes('primary key')) {
                console.error('[IndexedDB Promise Rejection]', reason);
                setHasDBError(true);
            }
        };
        
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);
    
    return hasDBError;
}

// Map terminal IDs to their routes
function getRouteForTerminal(terminalId: string): string {
    if (terminalId.startsWith('CAJA')) return '/pos';
    if (terminalId.startsWith('MOZO')) return '/mozo';
    if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return '/cocina/horno';
    if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return '/cocina';
    if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return '/bar';
    return '/pos';
}

// Get terminal display name
function getTerminalDisplayName(terminalId: string): string {
    if (terminalId.startsWith('CAJA')) return 'Caja';
    if (terminalId.startsWith('MOZO')) {
        const num = terminalId.replace('MOZO_', '');
        return `Mesero ${parseInt(num)}`;
    }
    if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return 'Horno/Parrilla';
    if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return 'Cocina';
    if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return 'Bar';
    return terminalId;
}

export default function HomePage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [existingConfig, setExistingConfig] = useState<TerminalConfig | null>(null);
    const [showSelector, setShowSelector] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const hasDBError = useIndexedDBErrorDetection();

    useEffect(() => {
        // Skip check if we're already navigating away
        if (isNavigating) return;
        
        // Check if terminal is already configured
        const config = getStoredTerminalConfig();
        if (config?.terminal_id) {
            setExistingConfig(config);
            setChecking(false);
        } else {
            setShowSelector(true);
            setChecking(false);
        }
    }, [isNavigating]);

    const handleContinueWithExisting = () => {
        if (existingConfig?.terminal_id) {
            const route = getRouteForTerminal(existingConfig.terminal_id);
            router.push(route);
        }
    };

    const handleChangeTerminal = () => {
        clearTerminalConfig();
        setExistingConfig(null);
        setShowSelector(true);
    };

    const handleTerminalSetup = (config: TerminalConfig) => {
        setIsNavigating(true);
        const route = getRouteForTerminal(config.terminal_id);
        router.push(route);
    };

    // Mostrar pantalla de error si hay problema con IndexedDB
    if (hasDBError) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center max-w-md p-8">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-red-500 text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Error de Base de Datos Local</h2>
                    <p className="text-zinc-400 text-sm mb-6">
                        La base de datos local está corrupta o tiene una versión incompatible.
                        Haz clic en el botón para resetear y continuar.
                    </p>
                    <button
                        onClick={resetIndexedDB}
                        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
                    >
                        🔄 Resetear Base de Datos
                    </button>
                    <p className="text-zinc-600 text-xs mt-4">
                        Esto limpiará los datos locales. Los datos del servidor no se afectan.
                    </p>
                </div>
            </div>
        );
    }

    if (checking) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Cargando...</p>
                    {/* TEMPORAL: Botón de reset si hay problemas */}
                    <button
                        onClick={resetIndexedDB}
                        className="mt-8 px-4 py-2 text-xs text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                    >
                        🔄 Reset DB (si hay error)
                    </button>
                </div>
            </div>
        );
    }

    // Show existing session prompt
    if (existingConfig && !showSelector) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <span className="text-3xl">🍗</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">PARK POS</h1>
                        <p className="text-zinc-400">Sesión activa detectada</p>
                    </div>

                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 mb-4">
                        <div className="text-center">
                            <p className="text-zinc-400 text-sm mb-2">Terminal actual:</p>
                            <p className="text-2xl font-bold text-white mb-1">
                                {getTerminalDisplayName(existingConfig.terminal_id)}
                            </p>
                            <p className="text-xs text-zinc-500">{existingConfig.terminal_id}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleContinueWithExisting}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                        >
                            Continuar como {getTerminalDisplayName(existingConfig.terminal_id)}
                        </button>
                        
                        <button
                            onClick={handleChangeTerminal}
                            className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors border border-zinc-700"
                        >
                            🔄 Cambiar Terminal
                        </button>
                    </div>

                    <p className="text-center text-xs text-zinc-600 mt-6">
                        Selecciona &quot;Cambiar Terminal&quot; para usar otro rol
                    </p>
                </div>
            </div>
        );
    }

    return <TerminalSetup onComplete={handleTerminalSetup} />;
}
