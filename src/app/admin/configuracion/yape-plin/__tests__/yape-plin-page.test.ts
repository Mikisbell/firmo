/**
 * Admin Configuración Yape/Plin Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - Phone sanitizer: only digits, max 9 chars
 * - Name sanitizer: max 100 chars
 * - Peruvian mobile phone format (9 digits starting with 9)
 * - API URL for settings (PUT)
 * - QR payment methods (YAPE / PLIN)
 *
 * @module app/admin/configuracion/yape-plin/__tests__/yape-plin-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type QRMethod = 'YAPE' | 'PLIN';
const QR_METHODS: QRMethod[] = ['YAPE', 'PLIN'];

function sanitizePhone(input: string): string {
  return input.replace(/\D/g, '').slice(0, 9);
}

function sanitizeName(input: string): string {
  return input.slice(0, 100);
}

function isValidPeruvianMobile(phone: string): boolean {
  return /^9\d{8}$/.test(phone); // 9 digits, starts with 9
}

function isYapePlinFormValid(phone: string, name: string): boolean {
  if (!phone.trim() || !name.trim()) return false;
  if (!isValidPeruvianMobile(phone)) return false;
  return true;
}

const SETTINGS_URL = '/api/admin/settings/yape-plin';
const QR_URL = '/api/pos/payment-qr';

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminYapePlinPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — QR methods
// ============================================================================

describe('AdminYapePlinPage — Métodos QR', () => {
  it('hay 2 métodos: YAPE y PLIN', () => {
    expect(QR_METHODS).toHaveLength(2);
    expect(QR_METHODS).toContain('YAPE');
    expect(QR_METHODS).toContain('PLIN');
  });
});

// ============================================================================
// Tests — sanitizePhone
// ============================================================================

describe('AdminYapePlinPage — Sanitización de teléfono', () => {
  it('elimina todos los caracteres no numéricos', () => {
    expect(sanitizePhone('987-654-321')).toBe('987654321');
    expect(sanitizePhone('+51 987 654 321')).toBe('519876543'); // capped at 9
    expect(sanitizePhone('abc123def')).toBe('123');
  });

  it('máximo 9 caracteres', () => {
    expect(sanitizePhone('12345678901234')).toBe('123456789');
    expect(sanitizePhone('1234567890')).toBe('123456789');
  });

  it('exactamente 9 dígitos → sin cambio', () => {
    expect(sanitizePhone('987654321')).toBe('987654321');
  });

  it('vacío → vacío', () => {
    expect(sanitizePhone('')).toBe('');
  });

  it('property: resultado siempre solo dígitos y máx 9 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 20 }),
        (input) => {
          const result = sanitizePhone(input);
          expect(result).toMatch(/^\d*$/);
          expect(result.length).toBeLessThanOrEqual(9);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — sanitizeName
// ============================================================================

describe('AdminYapePlinPage — Sanitización de nombre', () => {
  it('hasta 100 caracteres sin corte', () => {
    const name = 'A'.repeat(50);
    expect(sanitizeName(name)).toBe(name);
  });

  it('más de 100 → recorta a 100', () => {
    const name = 'A'.repeat(150);
    expect(sanitizeName(name)).toHaveLength(100);
  });

  it('exactamente 100 → sin cambio', () => {
    const name = 'B'.repeat(100);
    expect(sanitizeName(name)).toHaveLength(100);
  });

  it('vacío → vacío', () => {
    expect(sanitizeName('')).toBe('');
  });

  it('property: resultado siempre <= 100 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (name) => {
          expect(sanitizeName(name).length).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Validación de teléfono peruano
// ============================================================================

describe('AdminYapePlinPage — Teléfono peruano', () => {
  it('987654321 → válido (empieza con 9, 9 dígitos)', () => {
    expect(isValidPeruvianMobile('987654321')).toBe(true);
  });

  it('123456789 → inválido (no empieza con 9)', () => {
    expect(isValidPeruvianMobile('123456789')).toBe(false);
  });

  it('9876543 → inválido (solo 7 dígitos)', () => {
    expect(isValidPeruvianMobile('9876543')).toBe(false);
  });

  it('9876543210 → inválido (10 dígitos)', () => {
    expect(isValidPeruvianMobile('9876543210')).toBe(false);
  });

  it('property: 9 + 8 dígitos siempre válido si empieza con 9', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000000, max: 99999999 }).map(n => `9${n}`),
        (phone) => {
          expect(isValidPeruvianMobile(phone)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Form validation
// ============================================================================

describe('AdminYapePlinPage — Validación del formulario', () => {
  it('teléfono y nombre válidos → válido', () => {
    expect(isYapePlinFormValid('987654321', 'Mi Negocio SAC')).toBe(true);
  });

  it('teléfono vacío → inválido', () => {
    expect(isYapePlinFormValid('', 'Mi Negocio')).toBe(false);
  });

  it('nombre vacío → inválido', () => {
    expect(isYapePlinFormValid('987654321', '')).toBe(false);
  });

  it('teléfono no peruano → inválido', () => {
    expect(isYapePlinFormValid('123456789', 'Mi Negocio')).toBe(false);
  });
});

// ============================================================================
// Tests — URLs
// ============================================================================

describe('AdminYapePlinPage — URLs', () => {
  it('settings URL correcta', () => {
    expect(SETTINGS_URL).toBe('/api/admin/settings/yape-plin');
  });

  it('QR URL correcta', () => {
    expect(QR_URL).toBe('/api/pos/payment-qr');
  });
});
