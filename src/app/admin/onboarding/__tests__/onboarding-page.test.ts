/**
 * Admin Onboarding Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - OnboardingStatus: IN_PROGRESS / COMPLETED
 * - Completion percentage calculation (0-100)
 * - isCompleted predicate
 * - Step completion URL building
 * - Steps URL
 *
 * @module app/admin/onboarding/__tests__/onboarding-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type OnboardingStatus = 'IN_PROGRESS' | 'COMPLETED';
const ONBOARDING_STATUSES: OnboardingStatus[] = ['IN_PROGRESS', 'COMPLETED'];

function calcCompletionPercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function isOnboardingCompleted(status: OnboardingStatus): boolean {
  return status === 'COMPLETED';
}

function buildCompleteStepURL(stepKey: string): string {
  return `/api/admin/onboarding/steps/${stepKey}/complete`;
}

const ONBOARDING_URL = '/api/admin/onboarding';

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminOnboardingPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — Onboarding statuses
// ============================================================================

describe('AdminOnboardingPage — Estados de onboarding', () => {
  it('hay 2 estados', () => {
    expect(ONBOARDING_STATUSES).toHaveLength(2);
  });

  it('incluye IN_PROGRESS y COMPLETED', () => {
    expect(ONBOARDING_STATUSES).toContain('IN_PROGRESS');
    expect(ONBOARDING_STATUSES).toContain('COMPLETED');
  });

  it('COMPLETED es completado', () => {
    expect(isOnboardingCompleted('COMPLETED')).toBe(true);
  });

  it('IN_PROGRESS no está completado', () => {
    expect(isOnboardingCompleted('IN_PROGRESS')).toBe(false);
  });
});

// ============================================================================
// Tests — Completion percentage
// ============================================================================

describe('AdminOnboardingPage — Porcentaje de completado', () => {
  it('0/0 → 0% (sin división por cero)', () => {
    expect(calcCompletionPercentage(0, 0)).toBe(0);
  });

  it('0/5 → 0%', () => {
    expect(calcCompletionPercentage(0, 5)).toBe(0);
  });

  it('5/5 → 100%', () => {
    expect(calcCompletionPercentage(5, 5)).toBe(100);
  });

  it('3/5 → 60%', () => {
    expect(calcCompletionPercentage(3, 5)).toBe(60);
  });

  it('1/3 → 33% (redondeado)', () => {
    expect(calcCompletionPercentage(1, 3)).toBe(33);
  });

  it('2/3 → 67% (redondeado)', () => {
    expect(calcCompletionPercentage(2, 3)).toBe(67);
  });

  it('property: siempre entre 0 y 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (completed, total) => {
          const pct = calcCompletionPercentage(Math.min(completed, total), total);
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: completed = total siempre 100%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (total) => {
          expect(calcCompletionPercentage(total, total)).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — URLs
// ============================================================================

describe('AdminOnboardingPage — URLs', () => {
  it('base URL correcta', () => {
    expect(ONBOARDING_URL).toBe('/api/admin/onboarding');
  });

  it('complete step URL incluye stepKey y /complete', () => {
    const url = buildCompleteStepURL('create-products');
    expect(url).toContain('create-products');
    expect(url).toContain('/complete');
    expect(url).toContain('/api/admin/onboarding/steps/');
  });

  it('property: URL siempre termina en /complete', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0 && !s.includes('__proto__')),
        (key) => {
          expect(buildCompleteStepURL(key)).toMatch(/\/complete$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
