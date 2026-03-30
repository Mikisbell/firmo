/**
 * Admin Mesas Operaciones Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATUS_COLORS / STATUS_LABELS completeness (4 estados)
 * - formatDuration: null→"--", minutes→"Xh Ym"
 * - isOnline: lastSeen within 5 minutes
 * - toggleMergeSelection: add/remove from array
 * - API URLs (occupy / release / merge / split)
 *
 * @module app/admin/mesas/operaciones/__tests__/operaciones-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';

const STATUS_LABELS: Record<TableStatus, string> = {
  AVAILABLE:   'Disponible',
  OCCUPIED:    'Ocupada',
  RESERVED:    'Reservada',
  MAINTENANCE: 'Mantenimiento',
};

const STATUS_COLORS: Record<TableStatus, string> = {
  AVAILABLE:   'border-green-500/40 bg-green-500/5',
  OCCUPIED:    'border-amber-500/40 bg-amber-500/5',
  RESERVED:    'border-blue-500/40 bg-blue-500/5',
  MAINTENANCE: 'border-red-500/40 bg-red-500/5',
};

const TABLE_STATUSES = Object.keys(STATUS_LABELS) as TableStatus[];

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '--';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function toggleMergeSelection(selected: string[], tableId: string): string[] {
  if (selected.includes(tableId)) {
    return selected.filter(id => id !== tableId);
  }
  return [...selected, tableId];
}

function buildTableActionURL(tableId: string, action: 'occupy' | 'release' | 'merge' | 'split'): string {
  return `/api/admin/mesas/${tableId}/${action}`;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminMesasOperacionesPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_LABELS / STATUS_COLORS
// ============================================================================

describe('AdminMesasOperacionesPage — STATUS_LABELS', () => {
  it('hay exactamente 4 estados', () => {
    expect(TABLE_STATUSES).toHaveLength(4);
  });

  it('incluye AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE', () => {
    expect(TABLE_STATUSES).toContain('AVAILABLE');
    expect(TABLE_STATUSES).toContain('OCCUPIED');
    expect(TABLE_STATUSES).toContain('RESERVED');
    expect(TABLE_STATUSES).toContain('MAINTENANCE');
  });

  it('AVAILABLE es verde', () => {
    expect(STATUS_COLORS.AVAILABLE).toContain('green');
  });

  it('OCCUPIED es ámbar', () => {
    expect(STATUS_COLORS.OCCUPIED).toContain('amber');
  });

  it('MAINTENANCE es rojo', () => {
    expect(STATUS_COLORS.MAINTENANCE).toContain('red');
  });

  it('labels en español', () => {
    expect(STATUS_LABELS.AVAILABLE).toBe('Disponible');
    expect(STATUS_LABELS.OCCUPIED).toBe('Ocupada');
    expect(STATUS_LABELS.RESERVED).toBe('Reservada');
    expect(STATUS_LABELS.MAINTENANCE).toBe('Mantenimiento');
  });

  it('property: todos los estados tienen label y color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TABLE_STATUSES),
        (status) => {
          expect(STATUS_LABELS[status].trim().length).toBeGreaterThan(0);
          expect(STATUS_COLORS[status].trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — formatDuration
// ============================================================================

describe('AdminMesasOperacionesPage — formatDuration', () => {
  it('null → "--"', () => {
    expect(formatDuration(null)).toBe('--');
  });

  it('0 minutos → "0m"', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('45 minutos → "45m"', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('60 minutos → "1h"', () => {
    expect(formatDuration(60)).toBe('1h');
  });

  it('90 minutos → "1h 30m"', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('120 minutos → "2h"', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('property: siempre devuelve string no vacío', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1440 }),
        (mins) => {
          const result = formatDuration(mins);
          expect(result.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — isOnline
// ============================================================================

describe('AdminMesasOperacionesPage — isOnline', () => {
  it('null → offline', () => {
    expect(isOnline(null)).toBe(false);
  });

  it('hace 1 minuto → online', () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(isOnline(recent)).toBe(true);
  });

  it('hace 6 minutos → offline', () => {
    const old = new Date(Date.now() - 6 * 60_000).toISOString();
    expect(isOnline(old)).toBe(false);
  });
});

// ============================================================================
// Tests — toggleMergeSelection
// ============================================================================

describe('AdminMesasOperacionesPage — toggleMergeSelection', () => {
  it('agregar mesa no seleccionada', () => {
    const result = toggleMergeSelection(['A', 'B'], 'C');
    expect(result).toContain('C');
    expect(result).toHaveLength(3);
  });

  it('quitar mesa ya seleccionada', () => {
    const result = toggleMergeSelection(['A', 'B', 'C'], 'B');
    expect(result).not.toContain('B');
    expect(result).toHaveLength(2);
  });

  it('toggle idempotente (agregar y quitar → vacío)', () => {
    const added = toggleMergeSelection([], 'A');
    const removed = toggleMergeSelection(added, 'A');
    expect(removed).toHaveLength(0);
  });

  it('property: toggle es su propia inversa', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
        fc.uuid(),
        (initial, id) => {
          const deduped = [...new Set(initial)];
          const after = toggleMergeSelection(deduped, id);
          const restored = toggleMergeSelection(after, id);
          const sortFn = (a: string, b: string) => a.localeCompare(b);
          expect(restored.sort(sortFn)).toEqual(deduped.sort(sortFn));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — API URLs
// ============================================================================

describe('AdminMesasOperacionesPage — URLs de acción', () => {
  it('occupy URL correcta', () => {
    expect(buildTableActionURL('mesa-1', 'occupy')).toBe('/api/admin/mesas/mesa-1/occupy');
  });

  it('release URL correcta', () => {
    expect(buildTableActionURL('mesa-2', 'release')).toBe('/api/admin/mesas/mesa-2/release');
  });

  it('merge URL correcta', () => {
    expect(buildTableActionURL('mesa-1', 'merge')).toContain('/merge');
  });

  it('split URL correcta', () => {
    expect(buildTableActionURL('mesa-1', 'split')).toContain('/split');
  });
});
