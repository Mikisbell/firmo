'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function OfflinePage() {
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        setIsOnline(navigator.onLine);
        
        const handleOnline = () => {
            setIsOnline(true);
            // Auto-redirect cuando vuelve la conexión
            setTimeout(() => window.location.href = '/', 1000);
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center p-8">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-zinc-400">Reconectando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <WifiOff className="w-10 h-10 text-amber-500" />
                </div>
                
                <h1 className="text-2xl font-bold text-white mb-2">
                    Sin conexión
                </h1>
                
                <p className="text-zinc-400 mb-6">
                    No hay conexión a internet. Verifica tu conexión e intenta de nuevo.
                </p>

                <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                    <RefreshCw className="w-5 h-5" />
                    Reintentar
                </button>

                <p className="text-zinc-500 text-sm mt-8">
                    PARK POS funciona offline. Si ya estabas usando la app,
                    tus datos están guardados localmente.
                </p>
            </div>
        </div>
    );
}
