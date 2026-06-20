'use client';

/**
 * useSalesNoteForCheck — deriva el estado de la Nota de Venta de un check
 * foldeando los eventos SALES_NOTE_* de Dexie (db.events) con el reducer puro
 * applySalesNoteEvent. Offline-first: NO consulta red ni toca el sale.reducer core.
 * Los appenders escriben en db.events de forma sincrona, asi que useLiveQuery da
 * feedback instantaneo (la caja ve la nota del mozo ya sincronizada; el mozo/caja
 * ven al instante su propia anulacion).
 *
 * @module hooks/useSalesNoteForCheck
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/core/db/schema';
import type { ParkEvent } from '@/src/core/domain/events';
import { applySalesNoteEvent, type SalesNoteProjection } from '@/src/core/projections/sales-note.reducer';

const SALES_NOTE_EVENT_TYPES = ['SALES_NOTE_ISSUED', 'SALES_NOTE_CONVERTED', 'SALES_NOTE_VOIDED'];

/** Encuentra el sales_note_id de un check entre eventos ISSUED. */
export function findSalesNoteId(events: ParkEvent[], orderId: string, checkId: string): string | null {
  for (const e of events) {
    if (e.event_type === 'SALES_NOTE_ISSUED') {
      const p = e.payload as { sales_note_id: string; order_id: string; check_id: string };
      if (p.order_id === orderId && p.check_id === checkId) return p.sales_note_id;
    }
  }
  return null;
}

/** Foldea todos los eventos de una nota (ordenados por occurred_at) con el reducer puro. */
export function projectNote(events: ParkEvent[], salesNoteId: string): SalesNoteProjection | null {
  const ofNote = events
    .filter((e) => (e.payload as { sales_note_id?: string }).sales_note_id === salesNoteId)
    .sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));

  let state: SalesNoteProjection | null = null;
  for (const e of ofNote) {
    state = applySalesNoteEvent(state, e).state;
  }
  return state;
}

export function useSalesNoteForCheck(
  orderId: string | null,
  checkId: string | null,
): SalesNoteProjection | null {
  // Replica del servidor (Dexie): eventos SALES_NOTE_* ya sincronizados.
  const replica = useLiveQuery(async () => {
    if (!orderId || !checkId) return null;
    return (await db.events
      .where('event_type')
      .anyOf(SALES_NOTE_EVENT_TYPES)
      .toArray()) as ParkEvent[];
  }, [orderId, checkId]);

  // Calculo derivado directo: el React Compiler (React 19) memoiza por nosotros.
  if (!orderId || !checkId) return null;

  const events = replica ?? [];
  if (events.length === 0) return null;

  const salesNoteId = findSalesNoteId(events, orderId, checkId);
  if (!salesNoteId) return null;

  return projectNote(events, salesNoteId);
}
