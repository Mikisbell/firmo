'use client';

import { useEffect, useState } from 'react';
import { UpdatePrompt } from './UpdatePrompt';

interface PWAProviderProps {
    children: React.ReactNode;
}

/**
 * PWA Provider simplificado para Serwist
 * 
 * Serwist maneja el registro del SW automáticamente.
 * Este componente solo maneja:
 * - Indicador de estado offline
 * - Prompt de actualización
 */
export function PWAProvider({ children }: PWAProviderProps) {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        // Track online/offline status
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        setIsOnline(navigator.onLine);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Escuchar mensajes del SW para sync
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SYNC_REQUESTED') {
                    window.dispatchEvent(new CustomEvent('sw-sync-requested'));
                }
            });
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <>
            {children}
            <UpdatePrompt />
            {!isOnline && <OfflineIndicator />}
        </>
    );
}

function OfflineIndicator() {
    return (
        <div className="fixed top-0 left-0 right-0 bg-amber-600 text-white text-center py-1 text-sm font-medium z-50">
            📡 Sin conexión — Los cambios se sincronizarán automáticamente
        </div>
    );
}
