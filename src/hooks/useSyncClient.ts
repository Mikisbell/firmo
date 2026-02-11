/**
 * Hook para inicializar el SyncClient automáticamente
 * 
 * Este hook asegura que el SyncClient se inicie cuando el componente se monta,
 * permitiendo que la página reciba eventos en tiempo real vía SSE.
 * 
 * CRÍTICO para:
 * - KDS (recibir pedidos de meseros)
 * - Mesero (recibir actualizaciones de cocina)
 * - Caja (recibir pedidos listos)
 */

import { useEffect } from 'react';
import { getSyncClient } from '@/src/core/sync/client';

export function useSyncClient() {
    useEffect(() => {
        // Iniciar SyncClient cuando el componente se monta
        const client = getSyncClient();
        client.start();

        // Cleanup: detener SyncClient cuando el componente se desmonta
        return () => {
            client.stop();
        };
    }, []);
}
