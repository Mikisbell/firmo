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

  // Mutaciones puras (Síncronas O(1))
  applySyncBatch: (payload: SyncBatchUpdate['payload']) => void;
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

      // SRE Opción A: Flag the poison pills and remove synced events from RAM
      let nextEvents = state.localOptimisticEvents.filter(e => !synced_event_ids.includes(e.event_id));
      for (const pill of poison_pills) {
        nextEvents = nextEvents.map(e => 
          e.event_id === pill.event_id ? { ...e, sync_status: 'poison_pill' as const, last_error: pill.error } : e
        );
      }

      return {
        unpushedEventsCount: Math.max(0, state.unpushedEventsCount - synced_event_ids.length),
        poisonPillsByAggregate: newPoisonPills,
        localOptimisticEvents: nextEvents
      };
    });
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
