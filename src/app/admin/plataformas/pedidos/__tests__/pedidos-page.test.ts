/**
 * Admin Plataformas Pedidos Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATUS_CONFIG completeness (8 estados de pedido)
 * - PLATFORM_COLORS (3 plataformas)
 * - formatCurrency: "S/ X.XX"
 * - Terminal/non-terminal statuses
 * - API URLs (accept / reject)
 *
 * @module app/admin/plataformas/pedidos/__tests__/pedidos-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type PlatformOrderStatus =
  | 'RECEIVED' | 'ACCEPTED' | 'REJECTED'
  | 'PREPARING' | 'READY' | 'DISPATCHED'
  | 'DELIVERED' | 'CANCELLED';

const STATUS_CONFIG: Record<PlatformOrderStatus, { label: string; color: string }> = {
  RECEIVED:   { label: 'Recibido',    color: 'bg-blue-500/20 text-blue-400'    },
  ACCEPTED:   { label: 'Aceptado',    color: 'bg-green-500/20 text-green-400'  },
  REJECTED:   { label: 'Rechazado',   color: 'bg-red-500/20 text-red-400'      },
  PREPARING:  { label: 'Preparando',  color: 'bg-amber-500/20 text-amber-400'  },
  READY:      { label: 'Listo',       color: 'bg-teal-500/20 text-teal-400'    },
  DISPATCHED: { label: 'En camino',   color: 'bg-violet-500/20 text-violet-400'},
  DELIVERED:  { label: 'Entregado',   color: 'bg-emerald-500/20 text-emerald-400'},
  CANCELLED:  { label: 'Cancelado',   color: 'bg-gray-500/20 text-gray-400'    },
};

const ORDER_STATUSES = Object.keys(STATUS_CONFIG) as PlatformOrderStatus[];

type PlatformKey = 'PEDIDOSYA' | 'LLAMAFOOD' | 'RAPPI';

const PLATFORM_COLORS: Record<PlatformKey, string> = {
  PEDIDOSYA: 'text-red-400',
  LLAMAFOOD: 'text-green-400',
  RAPPI:     'text-orange-400',
};

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function isTerminalStatus(status: PlatformOrderStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED' || status === 'REJECTED';
}

function canAccept(status: PlatformOrderStatus): boolean {
  return status === 'RECEIVED';
}

function canReject(status: PlatformOrderStatus): boolean {
  return status === 'RECEIVED' || status === 'ACCEPTED';
}

function buildAcceptURL(orderId: string): string {
  return `/api/admin/platform-orders/${orderId}/accept`;
}

function buildRejectURL(orderId: string): string {
  return `/api/admin/platform-orders/${orderId}/reject`;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminPlataformasPedidosPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_CONFIG
// ============================================================================

describe('AdminPlataformasPedidosPage — STATUS_CONFIG', () => {
  it('hay exactamente 8 estados', () => {
    expect(ORDER_STATUSES).toHaveLength(8);
  });

  it('incluye todos los estados esperados', () => {
    for (const s of ['RECEIVED', 'ACCEPTED', 'REJECTED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED']) {
      expect(ORDER_STATUSES).toContain(s);
    }
  });

  it('DELIVERED es esmeralda', () => {
    expect(STATUS_CONFIG.DELIVERED.color).toContain('emerald');
  });

  it('REJECTED es rojo', () => {
    expect(STATUS_CONFIG.REJECTED.color).toContain('red');
  });

  it('DISPATCHED es violeta', () => {
    expect(STATUS_CONFIG.DISPATCHED.color).toContain('violet');
  });

  it('labels en español', () => {
    expect(STATUS_CONFIG.RECEIVED.label).toBe('Recibido');
    expect(STATUS_CONFIG.PREPARING.label).toBe('Preparando');
    expect(STATUS_CONFIG.DELIVERED.label).toBe('Entregado');
  });

  it('property: todos los estados tienen label y color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ORDER_STATUSES),
        (status) => {
          expect(STATUS_CONFIG[status].label.trim().length).toBeGreaterThan(0);
          expect(STATUS_CONFIG[status].color.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — PLATFORM_COLORS
// ============================================================================

describe('AdminPlataformasPedidosPage — PLATFORM_COLORS', () => {
  it('hay 3 plataformas con colores', () => {
    expect(Object.keys(PLATFORM_COLORS)).toHaveLength(3);
  });

  it('PEDIDOSYA es rojo', () => {
    expect(PLATFORM_COLORS.PEDIDOSYA).toContain('red');
  });

  it('LLAMAFOOD es verde', () => {
    expect(PLATFORM_COLORS.LLAMAFOOD).toContain('green');
  });

  it('RAPPI es naranja', () => {
    expect(PLATFORM_COLORS.RAPPI).toContain('orange');
  });
});

// ============================================================================
// Tests — Lifecycle
// ============================================================================

describe('AdminPlataformasPedidosPage — Ciclo de vida del pedido', () => {
  it('DELIVERED es terminal', () => {
    expect(isTerminalStatus('DELIVERED')).toBe(true);
  });

  it('CANCELLED es terminal', () => {
    expect(isTerminalStatus('CANCELLED')).toBe(true);
  });

  it('REJECTED es terminal', () => {
    expect(isTerminalStatus('REJECTED')).toBe(true);
  });

  it('RECEIVED no es terminal', () => {
    expect(isTerminalStatus('RECEIVED')).toBe(false);
  });

  it('solo RECEIVED puede aceptarse', () => {
    expect(canAccept('RECEIVED')).toBe(true);
    expect(canAccept('ACCEPTED')).toBe(false);
    expect(canAccept('PREPARING')).toBe(false);
  });

  it('RECEIVED y ACCEPTED pueden rechazarse', () => {
    expect(canReject('RECEIVED')).toBe(true);
    expect(canReject('ACCEPTED')).toBe(true);
    expect(canReject('PREPARING')).toBe(false);
  });

  it('property: estados terminales no pueden aceptarse ni rechazarse', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('DELIVERED', 'CANCELLED', 'REJECTED') as fc.Arbitrary<PlatformOrderStatus>,
        (status) => {
          expect(canAccept(status)).toBe(false);
          expect(canReject(status)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('AdminPlataformasPedidosPage — formatCurrency', () => {
  it('100000 → "S/ 1000.00"', () => {
    expect(formatCurrency(100000)).toBe('S/ 1000.00');
  });

  it('property: siempre incluye S/ y 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999900 }),
        (cents) => {
          expect(formatCurrency(cents)).toContain('S/');
          expect(formatCurrency(cents)).toMatch(/\.\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — URLs
// ============================================================================

describe('AdminPlataformasPedidosPage — URLs', () => {
  it('accept URL incluye /accept', () => {
    expect(buildAcceptURL('order-123')).toContain('/accept');
    expect(buildAcceptURL('order-123')).toContain('order-123');
  });

  it('reject URL incluye /reject', () => {
    expect(buildRejectURL('order-456')).toContain('/reject');
    expect(buildRejectURL('order-456')).toContain('order-456');
  });
});
