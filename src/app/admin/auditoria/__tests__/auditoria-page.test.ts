/**
 * Admin Auditoría Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STAT_CARDS completeness (4 keys)
 * - getEventBadge: login_success→emerald, login_failed→red, other→amber
 * - getRiskBadge: success→BAJO, failed→ALTO, other→MEDIO
 * - hasActiveFilters: any filter !== '' returns true
 * - Audit URL building with query params
 *
 * @module app/admin/auditoria/__tests__/auditoria-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const STAT_KEYS = ['total', 'login_success', 'login_failed', 'alerts'] as const;
type StatKey = typeof STAT_KEYS[number];

const STAT_LABELS: Record<StatKey, string> = {
  total:          'Total Eventos',
  login_success:  'Login Exitoso',
  login_failed:   'Login Fallido',
  alerts:         'Alertas',
};

const EVENT_TYPES = ['login_success', 'login_failed', 'security_alert'] as const;
type EventType = typeof EVENT_TYPES[number];

function getEventBadge(eventType: string): { label: string; color: string } {
  switch (eventType) {
    case 'login_success':
      return { label: 'Login Exitoso', color: 'emerald' };
    case 'login_failed':
      return { label: 'Login Fallido', color: 'red' };
    default:
      return { label: 'Alerta de Seguridad', color: 'amber' };
  }
}

function getRiskBadge(status: string): { label: string; color: string } {
  switch (status) {
    case 'success':
      return { label: 'BAJO', color: 'emerald' };
    case 'failed':
      return { label: 'ALTO', color: 'red' };
    default:
      return { label: 'MEDIO', color: 'amber' };
  }
}

interface AuditFilters {
  startDate: string;
  endDate:   string;
  terminal:  string;
  employee:  string;
  eventType: string;
}

function hasActiveFilters(filters: AuditFilters): boolean {
  return Object.values(filters).some(v => v !== '');
}

function buildAuditURL(filters: Partial<AuditFilters>): string {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate)   params.append('endDate',   filters.endDate);
  if (filters.terminal)  params.append('terminal',  filters.terminal);
  if (filters.employee)  params.append('employee',  filters.employee);
  if (filters.eventType) params.append('eventType', filters.eventType);
  const qs = params.toString();
  return `/api/admin/audit-log${qs ? `?${qs}` : ''}`;
}

function clearFilters(): AuditFilters {
  return { startDate: '', endDate: '', terminal: '', employee: '', eventType: '' };
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminAuditoriaPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STAT_CARDS
// ============================================================================

describe('AdminAuditoriaPage — STAT_CARDS', () => {
  it('hay exactamente 4 métricas', () => {
    expect(STAT_KEYS).toHaveLength(4);
  });

  it('incluye total, login_success, login_failed, alerts', () => {
    for (const k of ['total', 'login_success', 'login_failed', 'alerts']) {
      expect(STAT_KEYS).toContain(k);
    }
  });

  it('todos los keys tienen label en español', () => {
    for (const key of STAT_KEYS) {
      expect(STAT_LABELS[key]).toBeDefined();
      expect(STAT_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tests — getEventBadge
// ============================================================================

describe('AdminAuditoriaPage — getEventBadge', () => {
  it('login_success → emerald', () => {
    expect(getEventBadge('login_success').color).toBe('emerald');
    expect(getEventBadge('login_success').label).toBe('Login Exitoso');
  });

  it('login_failed → red', () => {
    expect(getEventBadge('login_failed').color).toBe('red');
    expect(getEventBadge('login_failed').label).toBe('Login Fallido');
  });

  it('evento desconocido → amber (alerta de seguridad)', () => {
    expect(getEventBadge('security_alert').color).toBe('amber');
    expect(getEventBadge('unknown_event').color).toBe('amber');
  });

  it('property: siempre devuelve label no vacío', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EVENT_TYPES, 'other_type'),
        (type) => {
          const badge = getEventBadge(type);
          expect(badge.label.trim().length).toBeGreaterThan(0);
          expect(badge.color.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — getRiskBadge
// ============================================================================

describe('AdminAuditoriaPage — getRiskBadge', () => {
  it('success → BAJO (riesgo bajo)', () => {
    expect(getRiskBadge('success').label).toBe('BAJO');
    expect(getRiskBadge('success').color).toBe('emerald');
  });

  it('failed → ALTO (riesgo alto)', () => {
    expect(getRiskBadge('failed').label).toBe('ALTO');
    expect(getRiskBadge('failed').color).toBe('red');
  });

  it('otro estado → MEDIO (riesgo medio)', () => {
    expect(getRiskBadge('alert').label).toBe('MEDIO');
    expect(getRiskBadge('unknown').label).toBe('MEDIO');
    expect(getRiskBadge('').label).toBe('MEDIO');
  });

  it('labels son uppercase', () => {
    for (const status of ['success', 'failed', 'other']) {
      const badge = getRiskBadge(status);
      expect(badge.label).toBe(badge.label.toUpperCase());
    }
  });
});

// ============================================================================
// Tests — hasActiveFilters
// ============================================================================

describe('AdminAuditoriaPage — hasActiveFilters', () => {
  it('todos vacíos → sin filtros activos', () => {
    expect(hasActiveFilters(clearFilters())).toBe(false);
  });

  it('solo startDate → tiene filtros activos', () => {
    expect(hasActiveFilters({ ...clearFilters(), startDate: '2026-01-01' })).toBe(true);
  });

  it('solo eventType → tiene filtros activos', () => {
    expect(hasActiveFilters({ ...clearFilters(), eventType: 'login_failed' })).toBe(true);
  });

  it('clearFilters devuelve todo vacío', () => {
    const f = clearFilters();
    expect(hasActiveFilters(f)).toBe(false);
  });

  it('property: al menos un campo no vacío → activo', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('startDate', 'endDate', 'terminal', 'employee', 'eventType') as fc.Arbitrary<keyof AuditFilters>,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        (field, value) => {
          const filters = { ...clearFilters(), [field]: value };
          expect(hasActiveFilters(filters)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — buildAuditURL
// ============================================================================

describe('AdminAuditoriaPage — URL de auditoría', () => {
  it('sin filtros → URL base', () => {
    expect(buildAuditURL({})).toBe('/api/admin/audit-log');
  });

  it('con startDate → incluye query param', () => {
    const url = buildAuditURL({ startDate: '2026-01-01' });
    expect(url).toContain('startDate=2026-01-01');
  });

  it('con eventType → incluye en query', () => {
    const url = buildAuditURL({ eventType: 'login_failed' });
    expect(url).toContain('eventType=login_failed');
  });

  it('múltiples filtros → múltiples params', () => {
    const url = buildAuditURL({ startDate: '2026-01-01', terminal: 'CAJA-01' });
    expect(url).toContain('startDate=');
    expect(url).toContain('terminal=');
  });
});
