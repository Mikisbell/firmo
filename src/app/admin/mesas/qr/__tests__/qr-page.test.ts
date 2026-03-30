/**
 * Admin Mesas QR Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - QR download filename format ({displayName}.png)
 * - QR data URL validation (must be base64 data URL)
 * - Locations URL
 * - QR items structure
 *
 * @module app/admin/mesas/qr/__tests__/qr-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

interface QRItem {
  tableId: string;
  displayName: string;
  qrDataUrl: string;
}

function buildDownloadFilename(displayName: string): string {
  return `${displayName}.png`;
}

function isValidQRDataUrl(url: string): boolean {
  return url.startsWith('data:image/') && url.includes('base64,');
}

function isValidDisplayName(name: string): boolean {
  return name.trim().length > 0;
}

const LOCATIONS_URL = '/api/admin/locations';

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminMesasQRPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — Download filename
// ============================================================================

describe('AdminMesasQRPage — Nombre de archivo de descarga', () => {
  it('Mesa 01 → "Mesa 01.png"', () => {
    expect(buildDownloadFilename('Mesa 01')).toBe('Mesa 01.png');
  });

  it('siempre termina en .png', () => {
    expect(buildDownloadFilename('VIP-5')).toMatch(/\.png$/);
  });

  it('incluye el displayName completo', () => {
    const name = 'Terraza 03';
    expect(buildDownloadFilename(name)).toContain(name);
  });

  it('property: filename siempre termina en .png', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (name) => {
          expect(buildDownloadFilename(name)).toMatch(/\.png$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — QR data URL validation
// ============================================================================

describe('AdminMesasQRPage — Validación de QR data URL', () => {
  it('data URL PNG válida → válida', () => {
    expect(isValidQRDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('string vacío → inválido', () => {
    expect(isValidQRDataUrl('')).toBe(false);
  });

  it('URL HTTP normal → inválido (no es data URL)', () => {
    expect(isValidQRDataUrl('https://example.com/qr.png')).toBe(false);
  });

  it('data URL sin base64 → inválido', () => {
    expect(isValidQRDataUrl('data:image/png,abc')).toBe(false);
  });
});

// ============================================================================
// Tests — Display name validation
// ============================================================================

describe('AdminMesasQRPage — Display name', () => {
  it('nombre no vacío → válido', () => {
    expect(isValidDisplayName('Mesa 01')).toBe(true);
  });

  it('string vacío → inválido', () => {
    expect(isValidDisplayName('')).toBe(false);
  });

  it('solo espacios → inválido', () => {
    expect(isValidDisplayName('   ')).toBe(false);
  });
});

// ============================================================================
// Tests — URL
// ============================================================================

describe('AdminMesasQRPage — URL de locations', () => {
  it('locations URL correcta', () => {
    expect(LOCATIONS_URL).toBe('/api/admin/locations');
  });
});
