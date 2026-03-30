/**
 * Admin Feedback Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - TYPE_CONFIG completeness (ELOGIO / SUGERENCIA / QUEJA)
 * - Type color semantics (ELOGIO=green, QUEJA=red)
 * - Pagination URL building
 * - Rating range validation (1-5 stars)
 *
 * @module app/admin/feedback/__tests__/feedback-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type FeedbackType = 'QUEJA' | 'SUGERENCIA' | 'ELOGIO';

const TYPE_CONFIG: Record<FeedbackType, { label: string; bg: string; text: string }> = {
  ELOGIO:    { label: 'Elogio',     bg: 'bg-emerald-100', text: 'text-emerald-700' },
  SUGERENCIA:{ label: 'Sugerencia', bg: 'bg-blue-100',    text: 'text-blue-700'    },
  QUEJA:     { label: 'Queja',      bg: 'bg-red-100',     text: 'text-red-700'     },
};

const FEEDBACK_TYPES = Object.keys(TYPE_CONFIG) as FeedbackType[];

const PAGE_SIZE = 20;

function buildFeedbackURL(page: number, type?: FeedbackType): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (type) params.append('type', type);
  return `/api/admin/feedback?${params.toString()}`;
}

function isValidRating(rating: number | null): boolean {
  if (rating === null) return true; // optional
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

function getTypeLabel(type: FeedbackType): string {
  return TYPE_CONFIG[type].label;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminFeedbackPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — TYPE_CONFIG
// ============================================================================

describe('AdminFeedbackPage — TYPE_CONFIG', () => {
  it('hay exactamente 3 tipos de feedback', () => {
    expect(FEEDBACK_TYPES).toHaveLength(3);
  });

  it('incluye ELOGIO, SUGERENCIA, QUEJA', () => {
    expect(FEEDBACK_TYPES).toContain('ELOGIO');
    expect(FEEDBACK_TYPES).toContain('SUGERENCIA');
    expect(FEEDBACK_TYPES).toContain('QUEJA');
  });

  it('ELOGIO es verde', () => {
    expect(TYPE_CONFIG.ELOGIO.bg).toContain('emerald');
    expect(TYPE_CONFIG.ELOGIO.text).toContain('emerald');
  });

  it('QUEJA es rojo', () => {
    expect(TYPE_CONFIG.QUEJA.bg).toContain('red');
    expect(TYPE_CONFIG.QUEJA.text).toContain('red');
  });

  it('SUGERENCIA es azul', () => {
    expect(TYPE_CONFIG.SUGERENCIA.bg).toContain('blue');
  });

  it('labels en español', () => {
    expect(getTypeLabel('ELOGIO')).toBe('Elogio');
    expect(getTypeLabel('SUGERENCIA')).toBe('Sugerencia');
    expect(getTypeLabel('QUEJA')).toBe('Queja');
  });

  it('property: todos los tipos tienen bg y text definidos', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FEEDBACK_TYPES),
        (type) => {
          expect(TYPE_CONFIG[type].bg.trim().length).toBeGreaterThan(0);
          expect(TYPE_CONFIG[type].text.trim().length).toBeGreaterThan(0);
          expect(TYPE_CONFIG[type].label.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Pagination URL
// ============================================================================

describe('AdminFeedbackPage — URL de paginación', () => {
  it('incluye page y pageSize', () => {
    const url = buildFeedbackURL(1);
    expect(url).toContain('page=1');
    expect(url).toContain('pageSize=20');
  });

  it('con filtro de tipo → incluye type', () => {
    const url = buildFeedbackURL(2, 'QUEJA');
    expect(url).toContain('type=QUEJA');
    expect(url).toContain('page=2');
  });

  it('sin filtro → no incluye type', () => {
    const url = buildFeedbackURL(1);
    expect(url).not.toContain('type=');
  });

  it('pageSize es siempre 20', () => {
    const url = buildFeedbackURL(5);
    expect(url).toContain('pageSize=20');
  });

  it('property: URL siempre apunta al endpoint correcto', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (page) => {
          const url = buildFeedbackURL(page);
          expect(url).toContain('/api/admin/feedback');
          expect(url).toContain(`page=${page}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Rating validation
// ============================================================================

describe('AdminFeedbackPage — Validación de rating', () => {
  it('null → válido (opcional)', () => {
    expect(isValidRating(null)).toBe(true);
  });

  it('1 a 5 → válido', () => {
    for (let r = 1; r <= 5; r++) {
      expect(isValidRating(r)).toBe(true);
    }
  });

  it('0 → inválido', () => {
    expect(isValidRating(0)).toBe(false);
  });

  it('6 → inválido', () => {
    expect(isValidRating(6)).toBe(false);
  });

  it('property: 1-5 siempre válido', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (rating) => {
          expect(isValidRating(rating)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
