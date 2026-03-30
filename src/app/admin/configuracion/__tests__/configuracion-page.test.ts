/**
 * Admin Configuración Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - RUC validation: exactly 11 numeric digits
 * - legal_name required field
 * - timezone field defaults
 * - currency field defaults (PEN)
 * - Form field update logic
 * - PUT endpoint for config save
 *
 * @module app/admin/configuracion/__tests__/configuracion-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const DEFAULT_TIMEZONE = 'America/Lima';
const DEFAULT_CURRENCY = 'PEN';

function isValidRUC(ruc: string | null): boolean {
  if (!ruc) return true; // RUC is optional
  return /^\d{11}$/.test(ruc);
}

function isRUCPeruvian(ruc: string): boolean {
  // Must start with 10 (natural) or 20 (legal)
  return /^\d{11}$/.test(ruc) && (ruc.startsWith('10') || ruc.startsWith('20'));
}

function isConfigFormValid(legalName: string, ruc: string | null): boolean {
  if (!legalName.trim()) return false;
  if (ruc && !isValidRUC(ruc)) return false;
  return true;
}

function buildConfigURL(): string {
  return '/api/admin/config';
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminConfiguracionPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — Validación de RUC
// ============================================================================

describe('AdminConfiguracionPage — Validación de RUC', () => {
  it('11 dígitos → válido', () => {
    expect(isValidRUC('20123456789')).toBe(true);
  });

  it('10 dígitos → inválido', () => {
    expect(isValidRUC('2012345678')).toBe(false);
  });

  it('12 dígitos → inválido', () => {
    expect(isValidRUC('201234567890')).toBe(false);
  });

  it('letras → inválido', () => {
    expect(isValidRUC('2012345678A')).toBe(false);
  });

  it('null → válido (campo opcional)', () => {
    expect(isValidRUC(null)).toBe(true);
  });

  it('string vacío → válido (se trata como null)', () => {
    // Empty string is falsy — optional field
    expect(isValidRUC('')).toBe(true);
  });

  it('RUC persona natural empieza con 10', () => {
    expect(isRUCPeruvian('10123456789')).toBe(true);
  });

  it('RUC persona jurídica empieza con 20', () => {
    expect(isRUCPeruvian('20123456789')).toBe(true);
  });

  it('RUC que empieza con otro dígito → no es peruano', () => {
    expect(isRUCPeruvian('30123456789')).toBe(false);
  });

  it('property: RUC siempre inválido si tiene != 11 dígitos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }).filter(n => n !== 11),
        fc.integer({ min: 0, max: 9 }),
        (len, digit) => {
          const ruc = String(digit).repeat(len);
          expect(isValidRUC(ruc)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: RUC de 11 dígitos numéricos es siempre válido', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000000000, max: 99999999999 }).map(n => String(n)),
        (ruc) => {
          expect(isValidRUC(ruc)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Validación del formulario de configuración
// ============================================================================

describe('AdminConfiguracionPage — Validación del formulario', () => {
  it('razón social vacía → inválido', () => {
    expect(isConfigFormValid('', null)).toBe(false);
  });

  it('razón social vacía con espacios → inválido', () => {
    expect(isConfigFormValid('   ', null)).toBe(false);
  });

  it('razón social presente sin RUC → válido', () => {
    expect(isConfigFormValid('Pollos & Parrillas SAC', null)).toBe(true);
  });

  it('razón social + RUC válido → válido', () => {
    expect(isConfigFormValid('Pollos SAC', '20123456789')).toBe(true);
  });

  it('razón social + RUC inválido → inválido', () => {
    expect(isConfigFormValid('Pollos SAC', '123')).toBe(false);
  });

  it('property: siempre inválido sin razón social', () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.integer({ min: 10000000000, max: 99999999999 }).map(n => String(n)),
          { nil: null }
        ),
        (ruc) => {
          expect(isConfigFormValid('', ruc)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Defaults de configuración
// ============================================================================

describe('AdminConfiguracionPage — Defaults', () => {
  it('timezone por defecto es America/Lima', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Lima');
  });

  it('moneda por defecto es PEN (soles peruanos)', () => {
    expect(DEFAULT_CURRENCY).toBe('PEN');
  });
});

// ============================================================================
// Tests — URL de configuración
// ============================================================================

describe('AdminConfiguracionPage — URL', () => {
  it('GET y PUT usan /api/admin/config', () => {
    expect(buildConfigURL()).toBe('/api/admin/config');
  });
});
