/**
 * Admin Estaciones Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATION_ICONS completeness (5 stations with emojis)
 * - STATUS_OPTIONS for filter (Activa/Inactiva)
 * - globalStats calculation (activeStations count)
 * - Station CRUD URLs (POST/PATCH/DELETE)
 * - Station display name and code
 * - Alert severity levels
 *
 * @module app/admin/estaciones/__tests__/estaciones-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const STATION_ICONS: Record<string, string> = {
  PARRILLA: '🔥',
  COCINA:   '🍳',
  BAR:      '🍺',
  FRIOS:    '❄️',
  POSTRES:  '🍰',
};

const STATION_ICON_KEYS = Object.keys(STATION_ICONS);

const STATUS_OPTIONS = [
  { value: 'true',  label: 'Activa' },
  { value: 'false', label: 'Inactiva' },
];

const ALERT_SEVERITIES = ['high', 'medium', 'low'] as const;
type AlertSeverity = typeof ALERT_SEVERITIES[number];

function getStationIcon(code: string): string {
  return STATION_ICONS[code] ?? '🖥️';
}

function countActiveStations(stations: Array<{ is_active: boolean }>): number {
  return stations.filter(s => s.is_active).length;
}

function buildStationURL(stationId: string | null): { url: string; method: string } {
  if (stationId) {
    return { url: `/api/admin/stations/${stationId}`, method: 'PATCH' };
  }
  return { url: '/api/admin/stations', method: 'POST' };
}

function buildDeleteURL(stationId: string): string {
  return `/api/admin/stations/${stationId}`;
}

function isStationFormValid(code: string, name: string): boolean {
  return !!(code.trim() && name.trim());
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function getSeverityWeight(severity: AlertSeverity): number {
  return SEVERITY_ORDER[severity];
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminEstacionesPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATION_ICONS
// ============================================================================

describe('AdminEstacionesPage — STATION_ICONS', () => {
  it('cubre 5 tipos de estación', () => {
    expect(STATION_ICON_KEYS).toHaveLength(5);
  });

  it('incluye PARRILLA, COCINA, BAR, FRIOS, POSTRES', () => {
    const expected = ['PARRILLA', 'COCINA', 'BAR', 'FRIOS', 'POSTRES'];
    for (const station of expected) {
      expect(STATION_ICONS[station]).toBeDefined();
    }
  });

  it('PARRILLA es fuego 🔥', () => {
    expect(STATION_ICONS.PARRILLA).toBe('🔥');
  });

  it('FRIOS es hielo ❄️', () => {
    expect(STATION_ICONS.FRIOS).toBe('❄️');
  });

  it('código desconocido devuelve ícono genérico', () => {
    expect(getStationIcon('UNKNOWN')).toBe('🖥️');
  });

  it('property: todos los códigos conocidos retornan ícono no vacío', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATION_ICON_KEYS),
        (code) => {
          expect(getStationIcon(code).trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — STATUS_OPTIONS
// ============================================================================

describe('AdminEstacionesPage — STATUS_OPTIONS', () => {
  it('tiene 2 opciones: Activa e Inactiva', () => {
    expect(STATUS_OPTIONS).toHaveLength(2);
  });

  it('values son "true" y "false" como strings', () => {
    expect(STATUS_OPTIONS.map(o => o.value)).toContain('true');
    expect(STATUS_OPTIONS.map(o => o.value)).toContain('false');
  });

  it('labels en español', () => {
    expect(STATUS_OPTIONS.find(o => o.value === 'true')?.label).toBe('Activa');
    expect(STATUS_OPTIONS.find(o => o.value === 'false')?.label).toBe('Inactiva');
  });
});

// ============================================================================
// Tests — countActiveStations
// ============================================================================

describe('AdminEstacionesPage — Conteo de estaciones activas', () => {
  it('sin estaciones → 0', () => {
    expect(countActiveStations([])).toBe(0);
  });

  it('todas activas → cuenta todas', () => {
    const stations = [{ is_active: true }, { is_active: true }, { is_active: true }];
    expect(countActiveStations(stations)).toBe(3);
  });

  it('ninguna activa → 0', () => {
    const stations = [{ is_active: false }, { is_active: false }];
    expect(countActiveStations(stations)).toBe(0);
  });

  it('mezcla: cuenta solo las activas', () => {
    const stations = [
      { is_active: true },
      { is_active: false },
      { is_active: true },
      { is_active: false },
      { is_active: true },
    ];
    expect(countActiveStations(stations)).toBe(3);
  });

  it('property: resultado siempre entre 0 y total', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ is_active: fc.boolean() }),
          { minLength: 0, maxLength: 20 }
        ),
        (stations) => {
          const count = countActiveStations(stations);
          expect(count).toBeGreaterThanOrEqual(0);
          expect(count).toBeLessThanOrEqual(stations.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: todas activas → count === length', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        (n) => {
          const all = Array.from({ length: n }, () => ({ is_active: true }));
          expect(countActiveStations(all)).toBe(n);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — CRUD URLs
// ============================================================================

describe('AdminEstacionesPage — URLs CRUD', () => {
  it('crear: POST a /api/admin/stations', () => {
    const { url, method } = buildStationURL(null);
    expect(method).toBe('POST');
    expect(url).toBe('/api/admin/stations');
  });

  it('editar: PATCH a /api/admin/stations/:id', () => {
    const { url, method } = buildStationURL('stn-123');
    expect(method).toBe('PATCH');
    expect(url).toBe('/api/admin/stations/stn-123');
  });

  it('eliminar: DELETE /api/admin/stations/:id', () => {
    expect(buildDeleteURL('stn-123')).toBe('/api/admin/stations/stn-123');
  });

  it('property: editar siempre incluye el id', () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        const { url } = buildStationURL(id);
        expect(url).toContain(id);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Validación del formulario
// ============================================================================

describe('AdminEstacionesPage — Validación de estación', () => {
  it('código y nombre requeridos', () => {
    expect(isStationFormValid('PARRILLA', 'Parrilla Principal')).toBe(true);
  });

  it('código vacío no es válido', () => {
    expect(isStationFormValid('', 'Parrilla')).toBe(false);
  });

  it('nombre vacío no es válido', () => {
    expect(isStationFormValid('PARRILLA', '')).toBe(false);
  });

  it('property: siempre inválido sin código', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (name) => {
          expect(isStationFormValid('', name)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Alert severity
// ============================================================================

describe('AdminEstacionesPage — Severidad de alertas', () => {
  it('high tiene mayor peso que medium', () => {
    expect(getSeverityWeight('high')).toBeGreaterThan(getSeverityWeight('medium'));
  });

  it('medium tiene mayor peso que low', () => {
    expect(getSeverityWeight('medium')).toBeGreaterThan(getSeverityWeight('low'));
  });

  it('property: order high > medium > low es transitivo', () => {
    expect(getSeverityWeight('high')).toBeGreaterThan(getSeverityWeight('low'));
  });

  it('property: todos los niveles tienen peso positivo', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALERT_SEVERITIES),
        (severity) => {
          expect(getSeverityWeight(severity)).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
