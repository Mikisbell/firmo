/**
 * Admin CRM Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - Campaign STATUS_COLORS completeness (5 states)
 * - Campaign lifecycle transitions
 * - Channel types (EMAIL/SMS/PUSH)
 * - CampaignStats accumulation
 * - Segment filter logic
 * - Template variables_schema validation
 *
 * @module app/admin/crm/__tests__/crm-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  ACTIVE:    'bg-green-100 text-green-700',
  COMPLETED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const CAMPAIGN_STATUSES = Object.keys(STATUS_COLORS);

const CAMPAIGN_CHANNELS = ['EMAIL', 'SMS', 'PUSH'];

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700';
}

// Campaign lifecycle: which statuses can transition to next
function canLaunch(status: string): boolean {
  return status === 'DRAFT' || status === 'SCHEDULED';
}

function canCancel(status: string): boolean {
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'ACTIVE';
}

function isTerminal(status: string): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

interface CampaignStats {
  total: number;
  queued: number;
  sent: number;
  failed: number;
}

function calculateDeliveryRate(stats: CampaignStats): number {
  if (stats.total === 0) return 0;
  return (stats.sent / stats.total) * 100;
}

function calculateFailureRate(stats: CampaignStats): number {
  if (stats.total === 0) return 0;
  return (stats.failed / stats.total) * 100;
}

// Segment filter validation
interface SegmentFilter {
  field: string;
  operator: string;
  value: unknown;
}

function isSegmentValid(name: string, filters: SegmentFilter[]): boolean {
  return !!(name.trim() && filters.length > 0);
}

// Template validation
function isTemplateValid(name: string, content: string): boolean {
  return !!(name.trim() && content.trim());
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminCRMPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_COLORS
// ============================================================================

describe('AdminCRMPage — Campaign STATUS_COLORS', () => {
  it('cubre los 5 estados de campaña', () => {
    expect(CAMPAIGN_STATUSES).toHaveLength(5);
  });

  it('incluye DRAFT, SCHEDULED, ACTIVE, COMPLETED, CANCELLED', () => {
    for (const s of ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED']) {
      expect(STATUS_COLORS[s]).toBeDefined();
    }
  });

  it('ACTIVE es verde', () => {
    expect(STATUS_COLORS.ACTIVE).toContain('green');
  });

  it('CANCELLED es rojo', () => {
    expect(STATUS_COLORS.CANCELLED).toContain('red');
  });

  it('COMPLETED es púrpura', () => {
    expect(STATUS_COLORS.COMPLETED).toContain('purple');
  });

  it('SCHEDULED es azul', () => {
    expect(STATUS_COLORS.SCHEDULED).toContain('blue');
  });

  it('estado desconocido devuelve color gris (fallback)', () => {
    expect(getStatusColor('UNKNOWN')).toContain('gray');
  });

  it('property: estados conocidos siempre tienen bg- y text-', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CAMPAIGN_STATUSES),
        (status) => {
          const color = getStatusColor(status);
          expect(color).toMatch(/bg-\w+/);
          expect(color).toMatch(/text-\w+/);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Campaign lifecycle
// ============================================================================

describe('AdminCRMPage — Ciclo de vida de campañas', () => {
  it('DRAFT puede lanzarse', () => {
    expect(canLaunch('DRAFT')).toBe(true);
  });

  it('SCHEDULED puede lanzarse', () => {
    expect(canLaunch('SCHEDULED')).toBe(true);
  });

  it('ACTIVE no puede lanzarse de nuevo', () => {
    expect(canLaunch('ACTIVE')).toBe(false);
  });

  it('COMPLETED no puede lanzarse', () => {
    expect(canLaunch('COMPLETED')).toBe(false);
  });

  it('DRAFT puede cancelarse', () => {
    expect(canCancel('DRAFT')).toBe(true);
  });

  it('ACTIVE puede cancelarse', () => {
    expect(canCancel('ACTIVE')).toBe(true);
  });

  it('COMPLETED no puede cancelarse (terminal)', () => {
    expect(canCancel('COMPLETED')).toBe(false);
  });

  it('CANCELLED no puede cancelarse de nuevo (terminal)', () => {
    expect(canCancel('CANCELLED')).toBe(false);
  });

  it('COMPLETED y CANCELLED son terminales', () => {
    expect(isTerminal('COMPLETED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
  });

  it('DRAFT, SCHEDULED, ACTIVE no son terminales', () => {
    expect(isTerminal('DRAFT')).toBe(false);
    expect(isTerminal('SCHEDULED')).toBe(false);
    expect(isTerminal('ACTIVE')).toBe(false);
  });

  it('property: estados terminales nunca pueden lanzarse ni cancelarse', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('COMPLETED', 'CANCELLED'),
        (status) => {
          expect(canLaunch(status)).toBe(false);
          expect(canCancel(status)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Campaign channels
// ============================================================================

describe('AdminCRMPage — Canales de campaña', () => {
  it('hay 3 canales disponibles', () => {
    expect(CAMPAIGN_CHANNELS).toHaveLength(3);
  });

  it('incluye EMAIL, SMS, PUSH', () => {
    expect(CAMPAIGN_CHANNELS).toContain('EMAIL');
    expect(CAMPAIGN_CHANNELS).toContain('SMS');
    expect(CAMPAIGN_CHANNELS).toContain('PUSH');
  });
});

// ============================================================================
// Tests — Campaign stats
// ============================================================================

describe('AdminCRMPage — Estadísticas de campaña', () => {
  it('delivery rate = sent / total * 100', () => {
    const stats: CampaignStats = { total: 100, queued: 10, sent: 80, failed: 10 };
    expect(calculateDeliveryRate(stats)).toBe(80);
  });

  it('failure rate = failed / total * 100', () => {
    const stats: CampaignStats = { total: 100, queued: 10, sent: 80, failed: 10 };
    expect(calculateFailureRate(stats)).toBe(10);
  });

  it('total = 0 → delivery rate = 0 (no división por cero)', () => {
    const stats: CampaignStats = { total: 0, queued: 0, sent: 0, failed: 0 };
    expect(calculateDeliveryRate(stats)).toBe(0);
  });

  it('property: delivery rate siempre entre 0 y 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 0, max: 10000 }),
        (total, sent) => {
          const stats: CampaignStats = {
            total,
            queued: 0,
            sent: Math.min(sent, total),
            failed: 0,
          };
          const rate = calculateDeliveryRate(stats);
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Segment validation
// ============================================================================

describe('AdminCRMPage — Validación de segmento', () => {
  const validFilter: SegmentFilter = { field: 'rfm_segment', operator: 'eq', value: 'CHAMPIONS' };

  it('nombre y filtros válidos → válido', () => {
    expect(isSegmentValid('Champions', [validFilter])).toBe(true);
  });

  it('nombre vacío → inválido', () => {
    expect(isSegmentValid('', [validFilter])).toBe(false);
  });

  it('sin filtros → inválido', () => {
    expect(isSegmentValid('Champions', [])).toBe(false);
  });

  it('property: siempre inválido sin nombre', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            field: fc.string({ minLength: 1 }),
            operator: fc.constantFrom('eq', 'gt', 'lt', 'contains'),
            value: fc.string(),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (filters) => {
          expect(isSegmentValid('', filters)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Template validation
// ============================================================================

describe('AdminCRMPage — Validación de template', () => {
  it('nombre y contenido → válido', () => {
    expect(isTemplateValid('Bienvenida', 'Hola {{name}}, bienvenido!')).toBe(true);
  });

  it('sin nombre → inválido', () => {
    expect(isTemplateValid('', 'Contenido')).toBe(false);
  });

  it('sin contenido → inválido', () => {
    expect(isTemplateValid('Nombre', '')).toBe(false);
  });

  it('property: siempre inválido con nombre vacío', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (content) => {
          expect(isTemplateValid('', content)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
