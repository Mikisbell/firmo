/**
 * Admin Security Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - Device trust levels (TRUSTED / UNKNOWN / BLOCKED)
 * - Active sessions filter (is_active = true)
 * - Suspicious session detection
 * - API URL patterns (block device / revoke session)
 * - isOnline helper (within 5 minutes)
 *
 * @module app/admin/security/__tests__/security-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type TrustLevel = 'TRUSTED' | 'UNKNOWN' | 'BLOCKED';
const TRUST_LEVELS: TrustLevel[] = ['TRUSTED', 'UNKNOWN', 'BLOCKED'];

interface Session {
  id: string;
  employee_id: string;
  terminal_id: string;
  is_active: boolean;
  is_suspicious: boolean;
  last_activity_at: string;
}

interface Device {
  mac_address: string;
  trust_level: TrustLevel;
  is_active: boolean;
  access_count: number;
}

function filterActiveSessions(sessions: Session[]): Session[] {
  return sessions.filter(s => s.is_active);
}

function filterSuspiciousSessions(sessions: Session[]): Session[] {
  return sessions.filter(s => s.is_suspicious);
}

function buildBlockDeviceURL(macAddress: string): string {
  return `/api/admin/security/devices/${macAddress}/block`;
}

function buildRevokeSessionURL(sessionId: string): string {
  return `/api/admin/security/sessions/${sessionId}/revoke`;
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  const diff = Date.now() - new Date(lastSeen).getTime();
  return diff < 5 * 60 * 1000; // 5 minutes
}

function isTrusted(device: Device): boolean {
  return device.trust_level === 'TRUSTED';
}

function isBlocked(device: Device): boolean {
  return device.trust_level === 'BLOCKED';
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminSecurityPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — Trust levels
// ============================================================================

describe('AdminSecurityPage — Niveles de confianza', () => {
  it('hay 3 niveles de confianza', () => {
    expect(TRUST_LEVELS).toHaveLength(3);
  });

  it('incluye TRUSTED, UNKNOWN, BLOCKED', () => {
    expect(TRUST_LEVELS).toContain('TRUSTED');
    expect(TRUST_LEVELS).toContain('UNKNOWN');
    expect(TRUST_LEVELS).toContain('BLOCKED');
  });

  it('TRUSTED y BLOCKED son opuestos', () => {
    const trustedDevice: Device = { mac_address: 'AA:BB:CC:DD:EE:FF', trust_level: 'TRUSTED', is_active: true, access_count: 10 };
    const blockedDevice: Device = { mac_address: 'AA:BB:CC:DD:EE:FF', trust_level: 'BLOCKED', is_active: false, access_count: 1 };
    expect(isTrusted(trustedDevice)).toBe(true);
    expect(isBlocked(trustedDevice)).toBe(false);
    expect(isTrusted(blockedDevice)).toBe(false);
    expect(isBlocked(blockedDevice)).toBe(true);
  });

  it('UNKNOWN no es trusted ni blocked', () => {
    const device: Device = { mac_address: 'AA:BB', trust_level: 'UNKNOWN', is_active: true, access_count: 1 };
    expect(isTrusted(device)).toBe(false);
    expect(isBlocked(device)).toBe(false);
  });
});

// ============================================================================
// Tests — Active sessions
// ============================================================================

describe('AdminSecurityPage — Sesiones activas', () => {
  const sessions: Session[] = [
    { id: '1', employee_id: 'e1', terminal_id: 'CAJA-01', is_active: true,  is_suspicious: false, last_activity_at: new Date().toISOString() },
    { id: '2', employee_id: 'e2', terminal_id: 'MOZO-01', is_active: false, is_suspicious: false, last_activity_at: new Date().toISOString() },
    { id: '3', employee_id: 'e3', terminal_id: 'KDS-01',  is_active: true,  is_suspicious: true,  last_activity_at: new Date().toISOString() },
  ];

  it('filterActiveSessions retorna solo sesiones activas', () => {
    const active = filterActiveSessions(sessions);
    expect(active).toHaveLength(2);
    expect(active.every(s => s.is_active)).toBe(true);
  });

  it('filterSuspiciousSessions retorna solo sospechosas', () => {
    const suspicious = filterSuspiciousSessions(sessions);
    expect(suspicious).toHaveLength(1);
    expect(suspicious[0].is_suspicious).toBe(true);
  });

  it('sin sesiones → listas vacías', () => {
    expect(filterActiveSessions([])).toHaveLength(0);
    expect(filterSuspiciousSessions([])).toHaveLength(0);
  });

  it('property: sesiones activas <= total de sesiones', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 0, maxLength: 20 }),
        (activeFlags) => {
          const sessions = activeFlags.map((is_active, i) => ({
            id: String(i),
            employee_id: `e${i}`,
            terminal_id: `T${i}`,
            is_active,
            is_suspicious: false,
            last_activity_at: new Date().toISOString(),
          }));
          expect(filterActiveSessions(sessions).length).toBeLessThanOrEqual(sessions.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — isOnline
// ============================================================================

describe('AdminSecurityPage — isOnline', () => {
  it('null → offline', () => {
    expect(isOnline(null)).toBe(false);
  });

  it('actividad hace 1 minuto → online', () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(isOnline(recent)).toBe(true);
  });

  it('actividad hace 6 minutos → offline', () => {
    const old = new Date(Date.now() - 6 * 60_000).toISOString();
    expect(isOnline(old)).toBe(false);
  });

  it('actividad justo hace 5 minutos → offline (strict)', () => {
    const fiveMin = new Date(Date.now() - 5 * 60_000 - 1).toISOString();
    expect(isOnline(fiveMin)).toBe(false);
  });
});

// ============================================================================
// Tests — API URLs
// ============================================================================

describe('AdminSecurityPage — URLs de acciones', () => {
  it('blockDeviceURL incluye mac_address', () => {
    const url = buildBlockDeviceURL('AA:BB:CC:DD:EE:FF');
    expect(url).toContain('AA:BB:CC:DD:EE:FF');
    expect(url).toContain('/api/admin/security/devices/');
    expect(url).toContain('/block');
  });

  it('revokeSessionURL incluye session_id', () => {
    const url = buildRevokeSessionURL('session-123');
    expect(url).toContain('session-123');
    expect(url).toContain('/api/admin/security/sessions/');
    expect(url).toContain('/revoke');
  });

  it('property: block URL siempre contiene /block', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('__proto__')),
        (mac) => {
          expect(buildBlockDeviceURL(mac)).toMatch(/\/block$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
