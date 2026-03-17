/**
 * Peru Identity Schemas - Tests
 *
 * Validates Zod schemas for API responses and lookup query params.
 *
 * @module core/integrations/peru-identity/__tests__/schemas.test
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  LookupQuerySchema,
  ApisPeruDniSchema,
  ApisPeruRucSchema,
  ApisNetPeV1DniSchema,
} from '../schemas';

// ============================================================================
// LookupQuerySchema
// ============================================================================

describe('LookupQuerySchema', () => {
  it('accepts valid DNI (8 digits)', () => {
    const result = LookupQuerySchema.safeParse({ doc_number: '43708661', doc_type: 'DNI' });
    expect(result.success).toBe(true);
  });

  it('accepts valid RUC starting with 10 (persona natural)', () => {
    const result = LookupQuerySchema.safeParse({ doc_number: '10437086619', doc_type: 'RUC' });
    expect(result.success).toBe(true);
  });

  it('accepts valid RUC starting with 20 (persona jurídica)', () => {
    const result = LookupQuerySchema.safeParse({ doc_number: '20100047218', doc_type: 'RUC' });
    expect(result.success).toBe(true);
  });

  it('rejects DNI with wrong length', () => {
    expect(LookupQuerySchema.safeParse({ doc_number: '1234567', doc_type: 'DNI' }).success).toBe(false);
    expect(LookupQuerySchema.safeParse({ doc_number: '123456789', doc_type: 'DNI' }).success).toBe(false);
  });

  it('rejects RUC with wrong prefix', () => {
    expect(LookupQuerySchema.safeParse({ doc_number: '30100047218', doc_type: 'RUC' }).success).toBe(false);
    expect(LookupQuerySchema.safeParse({ doc_number: '15100047218', doc_type: 'RUC' }).success).toBe(false);
  });

  it('rejects RUC with wrong length', () => {
    expect(LookupQuerySchema.safeParse({ doc_number: '2010004721', doc_type: 'RUC' }).success).toBe(false);
    expect(LookupQuerySchema.safeParse({ doc_number: '201000472180', doc_type: 'RUC' }).success).toBe(false);
  });

  it('rejects non-numeric doc_number', () => {
    expect(LookupQuerySchema.safeParse({ doc_number: 'ABCDEFGH', doc_type: 'DNI' }).success).toBe(false);
  });

  it('rejects invalid doc_type', () => {
    expect(LookupQuerySchema.safeParse({ doc_number: '43708661', doc_type: 'CE' }).success).toBe(false);
  });

  // Property: any 8-digit number is valid DNI
  it('property: any 8-digit string is valid DNI', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{8}$/),
        (dni) => {
          const result = LookupQuerySchema.safeParse({ doc_number: dni, doc_type: 'DNI' });
          return result.success === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property: RUC must start with 10 or 20 and be 11 digits
  it('property: valid RUC starts with 10|20 + 9 digits', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant('10'), fc.constant('20')),
        fc.stringMatching(/^\d{9}$/),
        (prefix, rest) => {
          const ruc = prefix + rest;
          const result = LookupQuerySchema.safeParse({ doc_number: ruc, doc_type: 'RUC' });
          return result.success === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property: RUC with bad prefix always fails
  it('property: RUC with prefix != 10|20 always fails', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 11, max: 99 }).filter((n) => n !== 20),
        fc.stringMatching(/^\d{9}$/),
        (prefix, rest) => {
          const ruc = String(prefix) + rest;
          const result = LookupQuerySchema.safeParse({ doc_number: ruc, doc_type: 'RUC' });
          return result.success === false;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// ApisPeruDniSchema
// ============================================================================

describe('ApisPeruDniSchema', () => {
  it('parses successful DNI response with full name', () => {
    const result = ApisPeruDniSchema.safeParse({
      success: true,
      dni: '43708661',
      nombres: 'MIGUEL ANGEL',
      apellidoPaterno: 'RIVERA',
      apellidoMaterno: 'OSPINA',
      codVerifica: '5',
    });
    expect(result.success).toBe(true);
    expect(result.data?.nombres).toBe('MIGUEL ANGEL');
  });

  it('parses response with nombre field (full name shortcut)', () => {
    const result = ApisPeruDniSchema.safeParse({
      success: true,
      nombre: 'RIVERA OSPINA MIGUEL ANGEL',
    });
    expect(result.success).toBe(true);
    expect(result.data?.nombre).toBe('RIVERA OSPINA MIGUEL ANGEL');
  });

  it('parses failed response', () => {
    const result = ApisPeruDniSchema.safeParse({ success: false });
    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(false);
  });

  it('rejects missing success field', () => {
    expect(ApisPeruDniSchema.safeParse({ dni: '43708661' }).success).toBe(false);
  });
});

// ============================================================================
// ApisPeruRucSchema
// ============================================================================

describe('ApisPeruRucSchema', () => {
  it('parses successful RUC response', () => {
    const result = ApisPeruRucSchema.safeParse({
      success: true,
      ruc: '20100047218',
      razonSocial: 'SUNAT - SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      direccion: 'AV. GARCILASO DE LA VEGA NRO. 1472',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'LIMA',
    });
    expect(result.success).toBe(true);
    expect(result.data?.razonSocial).toContain('SUNAT');
  });

  it('parses failed RUC response', () => {
    const result = ApisPeruRucSchema.safeParse({ success: false });
    expect(result.success).toBe(true);
    expect(result.data?.razonSocial).toBeUndefined();
  });

  it('parses partial response (some fields missing)', () => {
    const result = ApisPeruRucSchema.safeParse({
      success: true,
      razonSocial: 'EMPRESA SAC',
    });
    expect(result.success).toBe(true);
    expect(result.data?.estado).toBeUndefined();
  });
});

// ============================================================================
// ApisNetPeV1DniSchema (fallback)
// ============================================================================

describe('ApisNetPeV1DniSchema', () => {
  it('parses v1 DNI response', () => {
    const result = ApisNetPeV1DniSchema.safeParse({
      nombre: 'RIVERA OSPINA MIGUEL ANGEL',
      tipoDocumento: '1',
      numeroDocumento: '43708661',
    });
    expect(result.success).toBe(true);
    expect(result.data?.nombre).toBe('RIVERA OSPINA MIGUEL ANGEL');
  });

  it('parses v1 response with separate name fields', () => {
    const result = ApisNetPeV1DniSchema.safeParse({
      nombres: 'MIGUEL ANGEL',
      apellidoPaterno: 'RIVERA',
      apellidoMaterno: 'OSPINA',
    });
    expect(result.success).toBe(true);
    expect(result.data?.nombres).toBe('MIGUEL ANGEL');
  });

  it('parses empty response (all optional)', () => {
    const result = ApisNetPeV1DniSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
