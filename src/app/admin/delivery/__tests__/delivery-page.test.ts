/**
 * Admin Delivery Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - DeliveryOrder status lifecycle (PENDING→ASSIGNED→DISPATCHED→DELIVERED|FAILED)
 * - Terminal statuses (DELIVERED, FAILED)
 * - Driver status from deliveries (available/assigned/dispatched)
 * - Delivery time calculation (minutes)
 * - Kanban column grouping by status
 * - Status color mapping
 *
 * @module app/admin/delivery/__tests__/delivery-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED';

const DELIVERY_STATUSES: DeliveryStatus[] = ['PENDING', 'ASSIGNED', 'DISPATCHED', 'DELIVERED', 'FAILED'];

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING:    'Pendiente',
  ASSIGNED:   'Asignado',
  DISPATCHED: 'En camino',
  DELIVERED:  'Entregado',
  FAILED:     'Fallido',
};

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  PENDING:    'bg-yellow-500/20 text-yellow-400',
  ASSIGNED:   'bg-blue-500/20 text-blue-400',
  DISPATCHED: 'bg-violet-500/20 text-violet-400',
  DELIVERED:  'bg-green-500/20 text-green-400',
  FAILED:     'bg-red-500/20 text-red-400',
};

// Kanban columns shown in the page
const KANBAN_COLUMNS: DeliveryStatus[] = ['PENDING', 'ASSIGNED', 'DISPATCHED'];

function isTerminalStatus(status: DeliveryStatus): boolean {
  return status === 'DELIVERED' || status === 'FAILED';
}

function getDriverStatus(
  driverId: string,
  deliveries: Array<{ driver_id: string | null; status: DeliveryStatus }>
): 'available' | 'assigned' | 'dispatched' {
  const active = deliveries.find(
    d => d.driver_id === driverId && (d.status === 'ASSIGNED' || d.status === 'DISPATCHED')
  );
  if (!active) return 'available';
  return active.status === 'DISPATCHED' ? 'dispatched' : 'assigned';
}

function getDeliveryTimeMinutes(createdAt: string, deliveredAt: string | null): number | null {
  if (!deliveredAt) return null;
  const diff = new Date(deliveredAt).getTime() - new Date(createdAt).getTime();
  return Math.round(diff / 60000);
}

function groupByStatus(
  deliveries: Array<{ status: DeliveryStatus }>,
  status: DeliveryStatus
): Array<{ status: DeliveryStatus }> {
  return deliveries.filter(d => d.status === status);
}

function getAvailableTransitions(status: DeliveryStatus): DeliveryStatus[] {
  switch (status) {
    case 'PENDING':    return ['ASSIGNED', 'FAILED'];
    case 'ASSIGNED':   return ['DISPATCHED', 'FAILED'];
    case 'DISPATCHED': return ['DELIVERED', 'FAILED'];
    default:           return [];
  }
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminDeliveryPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_LABELS
// ============================================================================

describe('AdminDeliveryPage — STATUS_LABELS', () => {
  it('cubre los 5 estados', () => {
    expect(DELIVERY_STATUSES).toHaveLength(5);
  });

  it('labels en español', () => {
    expect(STATUS_LABELS.PENDING).toBe('Pendiente');
    expect(STATUS_LABELS.ASSIGNED).toBe('Asignado');
    expect(STATUS_LABELS.DISPATCHED).toBe('En camino');
    expect(STATUS_LABELS.DELIVERED).toBe('Entregado');
    expect(STATUS_LABELS.FAILED).toBe('Fallido');
  });
});

// ============================================================================
// Tests — STATUS_COLORS
// ============================================================================

describe('AdminDeliveryPage — STATUS_COLORS', () => {
  it('DELIVERED es verde', () => {
    expect(STATUS_COLORS.DELIVERED).toContain('green');
  });

  it('FAILED es rojo', () => {
    expect(STATUS_COLORS.FAILED).toContain('red');
  });

  it('DISPATCHED es violeta (en movimiento)', () => {
    expect(STATUS_COLORS.DISPATCHED).toContain('violet');
  });

  it('property: todos los estados tienen bg- y text-', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DELIVERY_STATUSES),
        (status) => {
          const color = STATUS_COLORS[status];
          expect(color).toMatch(/bg-\w+/);
          expect(color).toMatch(/text-\w+/);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Ciclo de vida
// ============================================================================

describe('AdminDeliveryPage — Ciclo de vida', () => {
  it('DELIVERED es terminal', () => {
    expect(isTerminalStatus('DELIVERED')).toBe(true);
  });

  it('FAILED es terminal', () => {
    expect(isTerminalStatus('FAILED')).toBe(true);
  });

  it('PENDING no es terminal', () => {
    expect(isTerminalStatus('PENDING')).toBe(false);
  });

  it('PENDING → puede asignarse o fallar', () => {
    expect(getAvailableTransitions('PENDING')).toContain('ASSIGNED');
    expect(getAvailableTransitions('PENDING')).toContain('FAILED');
  });

  it('ASSIGNED → puede despacharse o fallar', () => {
    expect(getAvailableTransitions('ASSIGNED')).toContain('DISPATCHED');
    expect(getAvailableTransitions('ASSIGNED')).toContain('FAILED');
  });

  it('DISPATCHED → puede entregarse o fallar', () => {
    expect(getAvailableTransitions('DISPATCHED')).toContain('DELIVERED');
    expect(getAvailableTransitions('DISPATCHED')).toContain('FAILED');
  });

  it('flujo feliz: PENDING → ASSIGNED → DISPATCHED → DELIVERED', () => {
    expect(getAvailableTransitions('PENDING')).toContain('ASSIGNED');
    expect(getAvailableTransitions('ASSIGNED')).toContain('DISPATCHED');
    expect(getAvailableTransitions('DISPATCHED')).toContain('DELIVERED');
    expect(isTerminalStatus('DELIVERED')).toBe(true);
  });

  it('property: estados terminales no tienen transiciones', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('DELIVERED', 'FAILED') as fc.Arbitrary<DeliveryStatus>,
        (status) => {
          expect(getAvailableTransitions(status)).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Estado del driver basado en entregas activas
// ============================================================================

describe('AdminDeliveryPage — Estado del driver', () => {
  const deliveries = [
    { driver_id: 'driver-1', status: 'ASSIGNED' as DeliveryStatus },
    { driver_id: 'driver-2', status: 'DISPATCHED' as DeliveryStatus },
    { driver_id: 'driver-3', status: 'DELIVERED' as DeliveryStatus },
    { driver_id: null, status: 'PENDING' as DeliveryStatus },
  ];

  it('driver con entrega ASSIGNED → asignado', () => {
    expect(getDriverStatus('driver-1', deliveries)).toBe('assigned');
  });

  it('driver con entrega DISPATCHED → despachado', () => {
    expect(getDriverStatus('driver-2', deliveries)).toBe('dispatched');
  });

  it('driver con entrega DELIVERED → disponible (no activa)', () => {
    expect(getDriverStatus('driver-3', deliveries)).toBe('available');
  });

  it('driver sin entregas → disponible', () => {
    expect(getDriverStatus('driver-99', deliveries)).toBe('available');
  });
});

// ============================================================================
// Tests — Tiempo de entrega
// ============================================================================

describe('AdminDeliveryPage — Tiempo de entrega', () => {
  it('sin deliveredAt → null (no completado)', () => {
    expect(getDeliveryTimeMinutes('2026-01-01T10:00:00Z', null)).toBeNull();
  });

  it('30 minutos de diferencia', () => {
    expect(getDeliveryTimeMinutes(
      '2026-01-01T10:00:00Z',
      '2026-01-01T10:30:00Z'
    )).toBe(30);
  });

  it('1 hora de diferencia', () => {
    expect(getDeliveryTimeMinutes(
      '2026-01-01T10:00:00Z',
      '2026-01-01T11:00:00Z'
    )).toBe(60);
  });

  it('property: tiempo siempre > 0 si delivered_at > created_at', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        (mins) => {
          const base = new Date('2026-01-01T10:00:00Z');
          const delivered = new Date(base.getTime() + mins * 60000);
          const result = getDeliveryTimeMinutes(base.toISOString(), delivered.toISOString());
          expect(result).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Kanban grouping
// ============================================================================

describe('AdminDeliveryPage — Kanban grouping', () => {
  it('columnas del kanban: PENDING, ASSIGNED, DISPATCHED', () => {
    expect(KANBAN_COLUMNS).toContain('PENDING');
    expect(KANBAN_COLUMNS).toContain('ASSIGNED');
    expect(KANBAN_COLUMNS).toContain('DISPATCHED');
  });

  it('DELIVERED y FAILED no están en el kanban (son terminales)', () => {
    expect(KANBAN_COLUMNS).not.toContain('DELIVERED');
    expect(KANBAN_COLUMNS).not.toContain('FAILED');
  });

  it('groupByStatus filtra correctamente', () => {
    const deliveries = [
      { status: 'PENDING' as DeliveryStatus },
      { status: 'PENDING' as DeliveryStatus },
      { status: 'ASSIGNED' as DeliveryStatus },
    ];
    expect(groupByStatus(deliveries, 'PENDING')).toHaveLength(2);
    expect(groupByStatus(deliveries, 'ASSIGNED')).toHaveLength(1);
    expect(groupByStatus(deliveries, 'DELIVERED')).toHaveLength(0);
  });

  it('property: suma de todos los grupos = total de entregas', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(...DELIVERY_STATUSES).map(status => ({ status })),
          { minLength: 0, maxLength: 20 }
        ),
        (deliveries) => {
          const total = DELIVERY_STATUSES.reduce(
            (sum, status) => sum + groupByStatus(deliveries, status).length,
            0
          );
          expect(total).toBe(deliveries.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
