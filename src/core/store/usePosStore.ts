/**
 * POS Global Store (Zustand)
 * Single Source of Truth para la UI del Punto de Venta.
 * 
 * Se comunica unidireccionalmente con el Web Worker de Sincronización
 * sin bloquear el renderizado de React (O(1)).
 */

import { create } from 'zustand';
import { getLocalEventStore, type LocalEvent } from '../db/local-event-store';
import type { SyncBatchUpdate } from '../workers/master-sync.worker';

interface PosState {
  unpushedEventsCount: number;
  poisonPillsByAggregate: Record<string, Array<{ eventId: string; error: string }>>;
  localOptimisticEvents: LocalEvent[];
  recent_processed_event_ids: string[];

  // Mutaciones puras (Síncronas O(1))
  applySyncBatch: (payload: SyncBatchUpdate['payload']) => void;
  purgeConfirmedEvents: (eventIds: string[]) => void;
  incrementUnpushedCount: () => void;
  
  // Acciones compuestas (Persistencia + Mutación de Memoria)
  dispatchLocalEvent: (event: Omit<LocalEvent, 'id' | 'sync_status' | 'retry_count'>) => Promise<void>;
  discardPoisonPill: (aggregateId: string, eventId: string) => Promise<void>;
  retryPoisonPill: (aggregateId: string, eventId: string) => Promise<void>;
}

export const usePosStore = create<PosState>((set) => ({
  unpushedEventsCount: 0,
  poisonPillsByAggregate: {},
  localOptimisticEvents: [],
  recent_processed_event_ids: [],

  // Reducer puro O(N), ciego a la red y a los Workers
  applySyncBatch: (payload) => {
    const { synced_event_ids, poison_pills } = payload;
    
    set((state) => {
      const newPoisonPills = { ...state.poisonPillsByAggregate };
      
      for (const pill of poison_pills) {
        if (!newPoisonPills[pill.aggregate_id]) {
          newPoisonPills[pill.aggregate_id] = [];
        }
        const exists = newPoisonPills[pill.aggregate_id].find(p => p.eventId === pill.event_id);
        if (!exists) {
          newPoisonPills[pill.aggregate_id].push({ eventId: pill.event_id, error: pill.error });
        }
      }

      // Escudo Absoluto: No borramos los eventos optimistas de la RAM inmediatamente
      // para evitar el "Ghost Item" (flicker). Solo los marcamos como synced.
      // useOrder.ts los filtrará y llamará a purgeConfirmedEvents cuando lleguen por SSE.
      let nextEvents = state.localOptimisticEvents.map(e => 
        synced_event_ids.includes(e.event_id) ? { ...e, sync_status: 'synced' as const } : e
      );

      for (const pill of poison_pills) {
        nextEvents = nextEvents.map(e => 
          e.event_id === pill.event_id ? { ...e, sync_status: 'poison_pill' as const, last_error: pill.error } : e
        );
      }

      const newRecent = [...state.recent_processed_event_ids, ...synced_event_ids].slice(-200);

      return {
        unpushedEventsCount: Math.max(0, state.unpushedEventsCount - synced_event_ids.length),
        poisonPillsByAggregate: newPoisonPills,
        localOptimisticEvents: nextEvents,
        recent_processed_event_ids: newRecent
      };
    });
  },

  purgeConfirmedEvents: (eventIds) => {
    set((state) => ({
      localOptimisticEvents: state.localOptimisticEvents.filter(e => !eventIds.includes(e.event_id))
    }));
  },

  incrementUnpushedCount: () => {
    set((state) => ({ unpushedEventsCount: state.unpushedEventsCount + 1 }));
  },

  dispatchLocalEvent: async (event) => {
    const db = getLocalEventStore();
    await db.addEvent(event);
    
    // Add to RAM immediately for Optimistic UI derived state
    const fullEvent: LocalEvent = {
      ...event,
      sync_status: 'pending',
      retry_count: 0
    };

    set((state) => ({ 
      unpushedEventsCount: state.unpushedEventsCount + 1,
      localOptimisticEvents: [...state.localOptimisticEvents, fullEvent]
    }));
  },

  discardPoisonPill: async (aggregateId, eventId) => {
    const db = getLocalEventStore();
    await db.discardEvent(eventId);

    set((state) => {
      const currentPills = state.poisonPillsByAggregate[aggregateId] || [];
      const newPills = currentPills.filter(p => p.eventId !== eventId);
      
      const newState = { ...state.poisonPillsByAggregate };
      if (newPills.length === 0) {
        delete newState[aggregateId];
      } else {
        newState[aggregateId] = newPills;
      }

      return {
        poisonPillsByAggregate: newState,
        unpushedEventsCount: Math.max(0, state.unpushedEventsCount - 1),
        // Magical UI Rollback: The event evaporates from the UI reducer
        localOptimisticEvents: state.localOptimisticEvents.filter(e => e.event_id !== eventId)
      };
    });
  },

  retryPoisonPill: async (aggregateId, eventId) => {
    const db = getLocalEventStore();
    await db.retryPoisonPill(eventId);

    set((state) => {
      const currentPills = state.poisonPillsByAggregate[aggregateId] || [];
      const newPills = currentPills.filter(p => p.eventId !== eventId);
      
      const newState = { ...state.poisonPillsByAggregate };
      if (newPills.length === 0) {
        delete newState[aggregateId];
      } else {
        newState[aggregateId] = newPills;
      }

      // Reset the status flag in memory to 'pending'
      const nextEvents = state.localOptimisticEvents.map(e => 
        e.event_id === eventId ? { ...e, sync_status: 'pending' as const, last_error: undefined } : e
      );

      return { 
        poisonPillsByAggregate: newState,
        localOptimisticEvents: nextEvents
      };
    });
  }
}));
