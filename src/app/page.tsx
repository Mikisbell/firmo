'use client';

// Página principal - Selector de Terminal
// Redirige automáticamente si ya hay un terminal configurado

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TerminalSetup } from '@/src/components/auth/TerminalSetup';
import { getStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import type { TerminalConfig } from '@/src/core/auth/types';

// Map terminal IDs to their routes
function getRouteForTerminal(terminalId: string): string {
    if (terminalId.startsWith('CAJA')) return '/pos';
    if (terminalId.startsWith('MOZO')) return '/mozo';
    if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return '/cocina/horno';
    if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return '/cocina';
    if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return '/bar';
    return '/pos';
}

export default function HomePage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        // Check if terminal is already configured
        const config = getStoredTerminalConfig();
        if (config?.terminal_id) {
            // Redirect to the appropriate route
            const route = getRouteForTerminal(config.terminal_id);
            router.replace(route);
        } else {
            setChecking(false);
        }
    }, [router]);

    const handleTerminalSetup = (config: TerminalConfig) => {
        const route = getRouteForTerminal(config.terminal_id);
        router.push(route);
    };

    if (checking) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Cargando...</p>
                </div>
            </div>
        );
    }

    return <TerminalSetup onComplete={handleTerminalSetup} />;
}
