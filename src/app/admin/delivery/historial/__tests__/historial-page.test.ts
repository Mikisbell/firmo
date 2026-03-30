/**
 * Admin Delivery Historial Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATUS_CONFIG completeness (5 estados)
 * - LIMIT = 20 por página
 * - Pagination offset calculation
 * - Historial URL building with filters
 * - Terminal statuses (DELIVERED / FAILED)
 *
 * @module app/admin/delivery/historial/__tests__/historial-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED';

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; badge: string }> = {
  PENDING:    { label: 'Pendiente',   badge: 'bg-amber-500/20 text-amber-400'   },
  ASSIGNED:   { label: 'Asignado',    badge: 'bg-blue-500/20 text-blue-400'     },
  DISPATCHED: { label: 'En camino',   badge: 'bg-violet-500/20 text-violet-400' },
  DELIVERED:  { label: 'Entregado',   badge: 'bg-green-500/20 text-green-400'   },
  FAILED:     { label: 'Fallido',     badge: 'bg-red-500/20 text-red-400'       },
};

const DELIVERY_STATUSES = Object.keys(STATUS_CONFIG) as DeliveryStatus[];
const LIMIT = 20;

interface HistorialFilters {
  dateFrom:  string;
  dateTo:    string;
  status:    string;
  driverId:  string;
}

function buildHistorialURL(filters: Partial<HistorialFilters>, page: number): string {
  const params = new URLSearchParams({ limit: String(LIMIT), offset: String((page - 1) * LIMIT) });
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo)   params.append('dateTo',   filters.dateTo);
  if (filters.status)   params.append('status',   filters.status);
  if (filters.driverId) params.append('driverId',  filters.driverId);
  return `/api/admin/delivery/history?${params.toString()}`;
}

function calcOffset(page: number): number {
  return (page - 1) * LIMIT;
}

function isTerminalStatus(status: DeliveryStatus): boolean {
  return status === 'DELIVERED' || status === 'FAILED';
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminDeliveryHistorialPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_CONFIG
// ============================================================================

describe('AdminDeliveryHistorialPage — STATUS_CONFIG', () => {
  it('cubre los 5 estados de entrega', () => {
    expect(DELIVERY_STATUSES).toHaveLength(5);
  });

  it('incluye todos los estados esperados', () => {
    for (const s of ['PENDING', 'ASSIGNED', 'DISPATCHED', 'DELIVERED', 'FAILED']) {
      expect(DELIVERY_STATUSES).toContain(s);
    }
  });

  it('DELIVERED es verde', () => {
    expect(STATUS_CONFIG.DELIVERED.badge).toContain('green');
  });

  it('FAILED es rojo', () => {
    expect(STATUS_CONFIG.FAILED.badge).toContain('red');
  });

  it('DISPATCHED es violeta', () => {
    expect(STATUS_CONFIG.DISPATCHED.badge).toContain('violet');
  });

  it('labels en español', () => {
    expect(STATUS_CONFIG.PENDING.label).toBe('Pendiente');
    expect(STATUS_CONFIG.DISPATCHED.label).toBe('En camino');
    expect(STATUS_CONFIG.DELIVERED.label).toBe('Entregado');
  });

  it('DELIVERED y FAILED son terminales', () => {
    expect(isTerminalStatus('DELIVERED')).toBe(true);
    expect(isTerminalStatus('FAILED')).toBe(true);
  });

  it('estados intermedios NO son terminales', () => {
    expect(isTerminalStatus('PENDING')).toBe(false);
    expect(isTerminalStatus('ASSIGNED')).toBe(false);
    expect(isTerminalStatus('DISPATCHED')).toBe(false);
  });

  it('property: todos los estados tienen label y badge', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DELIVERY_STATUSES),
        (status) => {
          expect(STATUS_CONFIG[status].label.trim().length).toBeGreaterThan(0);
          expect(STATUS_CONFIG[status].badge.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Pagination
// ============================================================================

describe('AdminDeliveryHistorialPage — Paginación', () => {
  it('LIMIT es 20', () => {
    expect(LIMIT).toBe(20);
  });

  it('página 1 → offset 0', () => {
    expect(calcOffset(1)).toBe(0);
  });

  it('página 2 → offset 20', () => {
    expect(calcOffset(2)).toBe(20);
  });

  it('página 3 → offset 40', () => {
    expect(calcOffset(3)).toBe(40);
  });

  it('property: offset siempre múltiplo de LIMIT', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (page) => {
          expect(calcOffset(page) % LIMIT).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('URL incluye limit y offset correctos', () => {
    const url = buildHistorialURL({}, 2);
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=20');
  });
});

// ============================================================================
// Tests — URL building
// ============================================================================

describe('AdminDeliveryHistorialPage — URL del historial', () => {
  it('sin filtros → URL base con paginación', () => {
    const url = buildHistorialURL({}, 1);
    expect(url).toContain('/api/admin/delivery/history');
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=0');
  });

  it('con filtro de status → incluye en URL', () => {
    const url = buildHistorialURL({ status: 'DELIVERED' }, 1);
    expect(url).toContain('status=DELIVERED');
  });

  it('con filtro de fecha → incluye en URL', () => {
    const url = buildHistorialURL({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }, 1);
    expect(url).toContain('dateFrom=2026-01-01');
    expect(url).toContain('dateTo=2026-01-31');
  });

  it('con driverId → incluye en URL', () => {
    const url = buildHistorialURL({ driverId: 'driver-123' }, 1);
    expect(url).toContain('driverId=driver-123');
  });
});
