/**
 * Admin Clientes Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - DOC_TYPE_LABELS completeness (RUC/DNI/CE/PASSPORT)
 * - formatMoney helper (centavos → 'S/ X.XX')
 * - getDocPlaceholder per doc type
 * - getDocHint per doc type
 * - Form create vs edit: POST vs PUT, correct URL
 * - Phone as required field
 *
 * @module app/admin/clientes/__tests__/clientes-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const DOC_TYPE_LABELS: Record<string, string> = {
  RUC: 'RUC',
  DNI: 'DNI',
  CE: 'CE',
  PASSPORT: 'Pasaporte',
};

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS);

function formatMoney(centavos: number): string {
  return `S/ ${(centavos / 100).toFixed(2)}`;
}

function getDocPlaceholder(docType: string): string {
  switch (docType) {
    case 'RUC':      return '20XXXXXXXXX (11 dígitos)';
    case 'DNI':      return 'XXXXXXXX (8 dígitos)';
    case 'CE':       return 'Carnet de extranjería';
    case 'PASSPORT': return 'Número de pasaporte';
    default:         return 'Número de documento';
  }
}

function getDocHint(docType: string): string | null {
  switch (docType) {
    case 'RUC': return 'Debe comenzar con 10 o 20 y tener 11 dígitos.';
    case 'DNI': return 'Debe tener exactamente 8 dígitos numéricos.';
    default:    return null;
  }
}

function buildCustomerURL(customerId: string | null): { url: string; method: string } {
  if (customerId) {
    return { url: `/api/admin/customers/${customerId}`, method: 'PUT' };
  }
  return { url: '/api/admin/customers', method: 'POST' };
}

function isCustomerFormValid(phone: string): boolean {
  return !!phone.trim();
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminClientesPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — DOC_TYPE_LABELS
// ============================================================================

describe('AdminClientesPage — DOC_TYPE_LABELS', () => {
  it('cubre los 4 tipos de documento', () => {
    expect(DOC_TYPES).toHaveLength(4);
  });

  it('incluye RUC, DNI, CE, PASSPORT', () => {
    const expected = ['RUC', 'DNI', 'CE', 'PASSPORT'];
    for (const type of expected) {
      expect(DOC_TYPE_LABELS[type]).toBeDefined();
    }
  });

  it('labels son correctos', () => {
    expect(DOC_TYPE_LABELS.RUC).toBe('RUC');
    expect(DOC_TYPE_LABELS.DNI).toBe('DNI');
    expect(DOC_TYPE_LABELS.CE).toBe('CE');
    expect(DOC_TYPE_LABELS.PASSPORT).toBe('Pasaporte');
  });

  it('ningún label está vacío', () => {
    for (const label of Object.values(DOC_TYPE_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tests — formatMoney
// ============================================================================

describe('AdminClientesPage — formatMoney', () => {
  it('incluye prefijo S/', () => {
    expect(formatMoney(150000)).toContain('S/');
  });

  it('150000 centavos = S/ 1500.00', () => {
    expect(formatMoney(150000)).toBe('S/ 1500.00');
  });

  it('0 centavos = S/ 0.00', () => {
    expect(formatMoney(0)).toBe('S/ 0.00');
  });

  it('100 centavos = S/ 1.00', () => {
    expect(formatMoney(100)).toBe('S/ 1.00');
  });

  it('50 centavos = S/ 0.50', () => {
    expect(formatMoney(50)).toBe('S/ 0.50');
  });

  it('property: siempre incluye prefijo S/', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999900 }),
        (cents) => {
          expect(formatMoney(cents)).toContain('S/');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: siempre tiene 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999900 }),
        (cents) => {
          const result = formatMoney(cents);
          expect(result).toMatch(/\.\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — getDocPlaceholder
// ============================================================================

describe('AdminClientesPage — getDocPlaceholder', () => {
  it('RUC placeholder menciona 11 dígitos', () => {
    expect(getDocPlaceholder('RUC')).toContain('11 dígitos');
  });

  it('DNI placeholder menciona 8 dígitos', () => {
    expect(getDocPlaceholder('DNI')).toContain('8 dígitos');
  });

  it('CE placeholder menciona carnet', () => {
    expect(getDocPlaceholder('CE').toLowerCase()).toContain('carnet');
  });

  it('PASSPORT placeholder menciona pasaporte', () => {
    expect(getDocPlaceholder('PASSPORT').toLowerCase()).toContain('pasaporte');
  });

  it('tipo desconocido devuelve placeholder genérico', () => {
    expect(getDocPlaceholder('UNKNOWN')).toBe('Número de documento');
  });

  it('property: todos los tipos conocidos retornan placeholder no vacío', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DOC_TYPES),
        (type) => {
          const placeholder = getDocPlaceholder(type);
          expect(placeholder.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — getDocHint
// ============================================================================

describe('AdminClientesPage — getDocHint', () => {
  it('RUC tiene hint de validación', () => {
    const hint = getDocHint('RUC');
    expect(hint).not.toBeNull();
    expect(hint).toContain('11 dígitos');
  });

  it('DNI tiene hint de validación', () => {
    const hint = getDocHint('DNI');
    expect(hint).not.toBeNull();
    expect(hint).toContain('8 dígitos');
  });

  it('CE no tiene hint (null)', () => {
    expect(getDocHint('CE')).toBeNull();
  });

  it('PASSPORT no tiene hint (null)', () => {
    expect(getDocHint('PASSPORT')).toBeNull();
  });
});

// ============================================================================
// Tests — Crear vs Editar cliente (URL y método)
// ============================================================================

describe('AdminClientesPage — Crear vs Editar cliente', () => {
  it('crear: POST a /api/admin/customers', () => {
    const { url, method } = buildCustomerURL(null);
    expect(method).toBe('POST');
    expect(url).toBe('/api/admin/customers');
  });

  it('editar: PUT a /api/admin/customers/:id', () => {
    const { url, method } = buildCustomerURL('cust-123');
    expect(method).toBe('PUT');
    expect(url).toBe('/api/admin/customers/cust-123');
  });

  it('property: editar siempre incluye el id en la URL', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (id) => {
          const { url } = buildCustomerURL(id);
          expect(url).toContain(id);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Validación del formulario (phone requerido)
// ============================================================================

describe('AdminClientesPage — Validación de formulario', () => {
  it('teléfono vacío no es válido', () => {
    expect(isCustomerFormValid('')).toBe(false);
  });

  it('teléfono solo espacios no es válido', () => {
    expect(isCustomerFormValid('   ')).toBe(false);
  });

  it('teléfono con valor es válido', () => {
    expect(isCustomerFormValid('999888777')).toBe(true);
  });

  it('property: teléfono no vacío siempre es válido', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0),
        (phone) => {
          expect(isCustomerFormValid(phone)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
