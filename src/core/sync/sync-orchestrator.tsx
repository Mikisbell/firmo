/**
 * Sync Orchestrator (Infrastructure Layer)
 * 
 * Gestiona el ciclo de vida del Web Worker de sincronización y lo conecta con Zustand.
 * Previene:
 * - Fugas de memoria en desarrollo (HMR).
 * - Errores 500 en Server-Side Rendering.
 * - Acoplamiento de infraestructura en la máquina de estados pura.
 */

import { useEffect, useRef } from 'react';
import { usePosStore } from '../store/usePosStore';
import type { SyncBatchUpdate, WorkerMessage } from '../workers/master-sync.worker';

export function SyncOrchestrator() {
  const workerRef = useRef<Worker | null>(null);
  const applySyncBatch = usePosStore((state) => state.applySyncBatch);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Inicialización segura del Web Worker (solo cliente)
    workerRef.current = new Worker(new URL('../workers/master-sync.worker.ts', import.meta.url), { type: 'module' });

    // 2. Puente Worker -> Zustand
    workerRef.current.onmessage = (event: MessageEvent<SyncBatchUpdate>) => {
      if (event.data?.type === 'SYNC_BATCH_UPDATE') {
        // Mutación pura O(N) delegada a Zustand
        applySyncBatch(event.data.payload);
      }
    };

    // 3. El Ping de Arranque Inicial (Boot Ping)
    const bootMessage: WorkerMessage = { type: 'WAKE_UP_AND_SYNC' };
    workerRef.current.postMessage(bootMessage);

    // 4. Limpieza Estricta (Prevención de Fugas en HMR)
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [applySyncBatch]);

  // Suscribirse a la métrica de eventos locales para despertar al Worker dinámicamente
  // (Ping Main -> Worker)
  const unpushedCount = usePosStore((state) => state.unpushedEventsCount);

  useEffect(() => {
    // 1. Filtro de Cero (Guard): Rompe el Bucle Infinito de Ping-Pong
    if (unpushedCount === 0) return;

    // 2. El Silenciador (Debounce): Absorbe las ráfagas del mesero
    const timer = setTimeout(() => {
      if (workerRef.current) {
        const wakeUpMessage: WorkerMessage = { type: 'WAKE_UP_AND_SYNC' };
        workerRef.current.postMessage(wakeUpMessage);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [unpushedCount]);

  // Este componente no renderiza nada, opera puramente en la infraestructura
  return null;
}
