/**
 * Tests de la logica pura de useSalesNoteForCheck (findSalesNoteId + projectNote).
 * El foldeo se apoya en applySalesNoteEvent (ya testeado); aca cubrimos el matching
 * por order/check y el orden cross-terminal por occurred_at.
 */
import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { findSalesNoteId, projectNote } from '../useSalesNoteForCheck';
import type { ParkEvent } from '@/src/core/domain/events';

function ev(
  event_type: string,
  payload: Record<string, unknown>,
  occurred_at: string,
): ParkEvent {
  return {
    event_id: uuidv4(),
    tenant_id: uuidv4(),
    terminal_id: 'T1',
    terminal_sequence: 1,
    occurred_at,
    aggregate_type: 'SALES_NOTE',
    aggregate_id: (payload.sales_note_id as string) ?? uuidv4(),
    correlation_id: uuidv4(),
    causation_id: null,
    actor_id: uuidv4(),
    actor_role_snapshot: 'WAITER',
    schema_version: 1,
    payload_version: 1,
    event_type,
    payload,
  } as ParkEvent;
}

describe('findSalesNoteId', () => {
  it('encuentra el id por order+check entre eventos ISSUED', () => {
    const order = uuidv4();
    const sn = uuidv4();
    const events = [
      ev('SALES_NOTE_ISSUED', { sales_note_id: uuidv4(), order_id: uuidv4(), check_id: 'c1' }, '2026-06-20T10:00:00Z'),
      ev('SALES_NOTE_ISSUED', { sales_note_id: sn, order_id: order, check_id: 'c1' }, '2026-06-20T10:01:00Z'),
    ];
    expect(findSalesNoteId(events, order, 'c1')).toBe(sn);
  });

  it('devuelve null si no hay nota para ese check', () => {
    expect(findSalesNoteId([], uuidv4(), 'c1')).toBeNull();
  });
});

describe('projectNote', () => {
  it('foldea ISSUED -> CONVERTED en orden por occurred_at (aunque lleguen desordenados)', () => {
    const sn = uuidv4();
    const inv = uuidv4();
    // CONVERTED listado ANTES que ISSUED -> projectNote debe ordenar por occurred_at
    const events = [
      ev('SALES_NOTE_CONVERTED', { sales_note_id: sn, invoice_id: inv, invoice_type: 'BOLETA' }, '2026-06-20T10:05:00Z'),
      ev('SALES_NOTE_ISSUED', { sales_note_id: sn, order_id: uuidv4(), check_id: 'c1', serie: 'NVT1', numero: '00000001', total_cents: 2500 }, '2026-06-20T10:00:00Z'),
    ];
    const state = projectNote(events, sn);
    expect(state?.status).toBe('CONVERTED');
    expect(state?.invoice_id).toBe(inv);
  });

  it('ignora eventos de OTRAS notas', () => {
    const sn = uuidv4();
    const events = [
      ev('SALES_NOTE_ISSUED', { sales_note_id: sn, order_id: uuidv4(), check_id: 'c1', serie: 'NVT1', numero: '00000001', total_cents: 1000 }, '2026-06-20T10:00:00Z'),
      ev('SALES_NOTE_VOIDED', { sales_note_id: uuidv4(), reason: 'otra nota' }, '2026-06-20T10:02:00Z'),
    ];
    const state = projectNote(events, sn);
    expect(state?.status).toBe('OPEN');
  });

  it('devuelve null si la nota no tiene eventos', () => {
    expect(projectNote([], uuidv4())).toBeNull();
  });
});
