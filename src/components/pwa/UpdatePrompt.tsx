'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Prompt de actualización para PWA
 * 
 * Serwist con skipWaiting:true actualiza automáticamente,
 * pero mostramos un prompt para que el usuario sepa que hay nueva versión.
 */
export function UpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        // Detectar cuando hay un nuevo SW instalado
        navigator.serviceWorker.ready.then((registration) => {
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Nueva versión disponible
                        setShowPrompt(true);
                    }
                });
            });
        });

        // También escuchar el evento controllerchange
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // El SW cambió, recargar para obtener nueva versión
            window.location.reload();
        });
    }, []);

    const handleUpdate = () => {
        setShowPrompt(false);
        window.location.reload();
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-indigo-600 text-white p-4 rounded-xl shadow-2xl z-50 flex items-center gap-3">
            <RefreshCw className="w-6 h-6 flex-shrink-0" />
            <div className="flex-1">
                <p className="font-medium">Nueva versión disponible</p>
                <p className="text-sm text-indigo-200">Actualiza para obtener las últimas mejoras</p>
            </div>
            <button
                onClick={handleUpdate}
                className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-50 transition-colors"
            >
                Actualizar
            </button>
            <button
                onClick={() => setShowPrompt(false)}
                className="text-indigo-200 hover:text-white p-1"
            >
                <X size={20} />
            </button>
        </div>
    );
}
