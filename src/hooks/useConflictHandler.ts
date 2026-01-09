// src/hooks/useConflictHandler.ts
// Hook for handling conflict events in UI

import { useEffect, useCallback, useState } from 'react';
import { logger, logEvents } from '@/src/core/observability/logger';

export type ConflictType = 'REVISION_CONFLICT' | 'PAYMENT_CONFLICT' | 'MERGED';

export interface ConflictDetail {
  type: ConflictType;
  event_id: string;
  aggregate_id?: string;
  details?: Record<string, unknown>;
}

export interface ConflictState {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
  lastConflict: ConflictDetail | null;
}

interface UseConflictHandlerOptions {
  onConflict?: (conflict: ConflictDetail) => void;
  onMerge?: (conflict: ConflictDetail) => void;
  onPaymentConflict?: (conflict: ConflictDetail) => void;
  showToast?: (message: string, type: 'info' | 'warning' | 'error') => void;
}

/**
 * Hook to handle conflict events from SyncClient.
 * Listens for 'conflict-detected' and 'order-refreshed' events.
 */
export function useConflictHandler(options: UseConflictHandlerOptions = {}) {
  const [state, setState] = useState<ConflictState>({
    hasConflict: false,
    conflicts: [],
    lastConflict: null,
  });

  const handleConflict = useCallback((event: CustomEvent<ConflictDetail>) => {
    const conflict = event.detail;
    
    setState(prev => ({
      hasConflict: true,
      conflicts: [...prev.conflicts, conflict],
      lastConflict: conflict,
    }));

    // Call appropriate handler based on conflict type
    switch (conflict.type) {
      case 'PAYMENT_CONFLICT':
        options.onPaymentConflict?.(conflict);
        options.showToast?.(
          'Conflicto de pago detectado. Por favor, verifica el estado de la orden.',
          'error'
        );
        break;
      
      case 'REVISION_CONFLICT':
        options.onConflict?.(conflict);
        options.showToast?.(
          'La orden fue modificada por otro terminal. Se actualizó automáticamente.',
          'warning'
        );
        break;
      
      case 'MERGED':
        options.onMerge?.(conflict);
        // Merges are usually silent, but can show info toast
        break;
    }
  }, [options]);

  const handleOrderRefreshed = useCallback((event: CustomEvent<{ orderId: string; order: unknown; revision: number }>) => {
    const { orderId, revision } = event.detail;
    logger.debug(logEvents.CONFLICT_RESOLVED, 'Order refreshed after conflict', { orderId, revision });
    
    // Could trigger a UI refresh here if needed
  }, []);

  const clearConflicts = useCallback(() => {
    setState({
      hasConflict: false,
      conflicts: [],
      lastConflict: null,
    });
  }, []);

  const dismissConflict = useCallback((eventId: string) => {
    setState(prev => {
      const conflicts = prev.conflicts.filter(c => c.event_id !== eventId);
      return {
        hasConflict: conflicts.length > 0,
        conflicts,
        lastConflict: conflicts.length > 0 ? conflicts[conflicts.length - 1] : null,
      };
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const conflictHandler = (e: Event) => handleConflict(e as CustomEvent<ConflictDetail>);
    const refreshHandler = (e: Event) => handleOrderRefreshed(e as CustomEvent<{ orderId: string; order: unknown; revision: number }>);

    window.addEventListener('conflict-detected', conflictHandler);
    window.addEventListener('order-refreshed', refreshHandler);

    return () => {
      window.removeEventListener('conflict-detected', conflictHandler);
      window.removeEventListener('order-refreshed', refreshHandler);
    };
  }, [handleConflict, handleOrderRefreshed]);

  return {
    ...state,
    clearConflicts,
    dismissConflict,
  };
}
