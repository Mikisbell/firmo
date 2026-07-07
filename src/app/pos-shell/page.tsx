'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { getDb } from '@/src/core/db/schema';
import { useRouter } from 'next/navigation';

export default function PosShell() {
    const [isOnline, setIsOnline] = useState(false);
    const [status, setStatus] = useState('Verificando conexión...');
    const router = useRouter();

    useEffect(() => {
        // En un dispositivo muy limitado en RAM, no cargamos los componentes pesados de React 
        // de inmediato. Verificamos la red primero.
        setIsOnline(navigator.onLine);
        
        if (navigator.onLine) {
            setStatus('Conexión detectada. Cargando POS...');
            setTimeout(() => {
                window.location.href = '/pos';
            }, 500);
        } else {
            setStatus('Modo Offline Activo. Iniciando base de datos local...');
            // Precargar conexión a IndexedDB para el shell
            const db = getDb();
            if (db) {
                db.transaction('r', db.catalog_items, db.master_tables, async () => {
                    setStatus('Base de datos lista. Redirigiendo a operación offline...');
                    // Redirige usando el router para no hacer reload del navegador
                    router.push('/pos');
                }).catch(e => {
                    setStatus('Error al iniciar base de datos local: ' + e.message);
                });
            }
        }

        const handleOnline = () => {
            setIsOnline(true);
            window.location.href = '/pos';
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [router]);

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
            <div className="text-center max-w-md w-full bg-zinc-900/50 p-8 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    {isOnline ? (
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                    ) : (
                        <WifiOff className="w-10 h-10 text-amber-500" />
                    )}
                </div>
                
                <h1 className="text-2xl font-black text-white mb-2 tracking-tight">
                    FIRMO POS <span className="text-indigo-400">SHELL</span>
                </h1>
                
                <p className="text-zinc-400 mb-6 font-medium">
                    {status}
                </p>

                {!isOnline && (
                    <div className="mt-8 text-xs text-zinc-500 bg-black/40 p-4 rounded-xl border border-white/5 text-left font-mono">
                        <p className="text-zinc-400 mb-2 font-bold uppercase tracking-wider">Memoria Optimizado (Low-RAM)</p>
                        <ul className="space-y-1">
                            <li>• Zero-Network Fallback activo</li>
                            <li>• IndexedDB cursores habilitados</li>
                            <li>• App Shell parseado en disco</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
