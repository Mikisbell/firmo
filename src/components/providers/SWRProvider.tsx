/**
 * Provider de SWR para PARK POS
 * 
 * Envuelve la aplicación con SWRConfig para habilitar:
 * - Deduplicación de requests HTTP
 * - Revalidación automática
 * - Stale-while-revalidate pattern
 * 
 * @module components/providers/SWRProvider
 */

'use client';

import { SWRConfig } from 'swr';
import { swrConfig, fetcher } from '@/src/lib/swr-config';

interface SWRProviderProps {
  children: React.ReactNode;
}

/**
 * Provider de SWR con configuración global
 * 
 * Debe usarse en el layout principal para envolver toda la aplicación.
 * 
 * Validates: Requirements 2.2
 */
export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig value={{ ...swrConfig, fetcher }}>
      {children}
    </SWRConfig>
  );
}
