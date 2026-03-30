/**
 * Admin Alerts Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - Tab types (configurations / history / maintenance)
 * - Tab completeness
 *
 * @module app/admin/alerts/__tests__/alerts-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type TabType = 'configurations' | 'history' | 'maintenance';

const TABS: TabType[] = ['configurations', 'history', 'maintenance'];

function isValidTab(tab: string): tab is TabType {
  return TABS.includes(tab as TabType);
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminAlertsPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — Tabs
// ============================================================================

describe('AdminAlertsPage — Tabs', () => {
  it('hay exactamente 3 tabs', () => {
    expect(TABS).toHaveLength(3);
  });

  it('incluye configurations, history, maintenance', () => {
    expect(TABS).toContain('configurations');
    expect(TABS).toContain('history');
    expect(TABS).toContain('maintenance');
  });

  it('configurations es un tab válido', () => {
    expect(isValidTab('configurations')).toBe(true);
  });

  it('string desconocido no es tab válido', () => {
    expect(isValidTab('unknown')).toBe(false);
    expect(isValidTab('')).toBe(false);
  });

  it('property: todos los tabs son válidos', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TABS),
        (tab) => {
          expect(isValidTab(tab)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
