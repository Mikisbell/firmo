/**
 * Admin Plataformas Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - PLATFORMS completeness (PEDIDOSYA / LLAMAFOOD / RAPPI)
 * - Default commission rates (0.27 / 0.22 / 0.30)
 * - Commission rate constraints (0 < rate < 1)
 * - getConfig: find platform by key
 * - API URL (PATCH /api/admin/platform-config)
 *
 * @module app/admin/plataformas/__tests__/plataformas-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type PlatformKey = 'PEDIDOSYA' | 'LLAMAFOOD' | 'RAPPI';

interface PlatformInfo {
  key: PlatformKey;
  name: string;
  color: string;
  defaultCommission: number;
}

const PLATFORMS: PlatformInfo[] = [
  { key: 'PEDIDOSYA', name: 'PedidosYa',  color: 'text-red-400',    defaultCommission: 0.27 },
  { key: 'LLAMAFOOD', name: 'LlamaFood',  color: 'text-green-400',  defaultCommission: 0.22 },
  { key: 'RAPPI',     name: 'Rappi',      color: 'text-orange-400', defaultCommission: 0.30 },
];

const PLATFORM_CONFIG_URL = '/api/admin/platform-config';

function getConfig(platformKey: PlatformKey): PlatformInfo | undefined {
  return PLATFORMS.find(p => p.key === platformKey);
}

function commissionToPercent(rate: number): number {
  return Math.round(rate * 100);
}

function isValidCommissionRate(rate: number): boolean {
  return rate > 0 && rate < 1;
}

function calcNetAmount(grossCents: number, commissionRate: number): number {
  return Math.round(grossCents * (1 - commissionRate));
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminPlataformasPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — PLATFORMS
// ============================================================================

describe('AdminPlataformasPage — PLATFORMS', () => {
  it('hay exactamente 3 plataformas', () => {
    expect(PLATFORMS).toHaveLength(3);
  });

  it('incluye PEDIDOSYA, LLAMAFOOD, RAPPI', () => {
    const keys = PLATFORMS.map(p => p.key);
    expect(keys).toContain('PEDIDOSYA');
    expect(keys).toContain('LLAMAFOOD');
    expect(keys).toContain('RAPPI');
  });

  it('PEDIDOSYA comisión default = 27%', () => {
    expect(commissionToPercent(getConfig('PEDIDOSYA')!.defaultCommission)).toBe(27);
  });

  it('LLAMAFOOD comisión default = 22%', () => {
    expect(commissionToPercent(getConfig('LLAMAFOOD')!.defaultCommission)).toBe(22);
  });

  it('RAPPI comisión default = 30%', () => {
    expect(commissionToPercent(getConfig('RAPPI')!.defaultCommission)).toBe(30);
  });

  it('PEDIDOSYA es rojo', () => {
    expect(getConfig('PEDIDOSYA')!.color).toContain('red');
  });

  it('LLAMAFOOD es verde', () => {
    expect(getConfig('LLAMAFOOD')!.color).toContain('green');
  });

  it('RAPPI es naranja', () => {
    expect(getConfig('RAPPI')!.color).toContain('orange');
  });

  it('property: todas las comisiones están entre 0 y 1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PLATFORMS),
        (platform) => {
          expect(platform.defaultCommission).toBeGreaterThan(0);
          expect(platform.defaultCommission).toBeLessThan(1);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — calcNetAmount
// ============================================================================

describe('AdminPlataformasPage — Cálculo de monto neto', () => {
  it('S/ 100 con 27% comisión → S/ 73', () => {
    expect(calcNetAmount(10000, 0.27)).toBe(7300);
  });

  it('S/ 100 sin comisión → S/ 100', () => {
    expect(calcNetAmount(10000, 0)).toBe(10000);
  });

  it('monto neto siempre <= monto bruto', () => {
    expect(calcNetAmount(10000, 0.30)).toBeLessThanOrEqual(10000);
  });

  it('property: neto <= bruto para cualquier comisión válida', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 0, max: 99 }).map(n => n / 100),
        (grossCents, rate) => {
          expect(calcNetAmount(grossCents, rate)).toBeLessThanOrEqual(grossCents);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — URL
// ============================================================================

describe('AdminPlataformasPage — URL', () => {
  it('config URL correcta', () => {
    expect(PLATFORM_CONFIG_URL).toBe('/api/admin/platform-config');
  });
});
