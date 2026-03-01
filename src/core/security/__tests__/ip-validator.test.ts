/**
 * Tests for IP Validator Module
 *
 * Tests IP validation, client IP extraction, private IP detection,
 * geolocation stub, and IP access logging.
 *
 * Uses vi.mock for Prisma and includes property-based tests
 * for isPrivateIP and getClientIP.
 *
 * @module core/security/__tests__/ip-validator.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock Prisma before importing module under test
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    active_sessions: {
      findFirst: vi.fn(),
    },
    session_audit_log: {
      create: vi.fn(),
    },
  },
}));

import prisma from '@/src/core/db/prisma';
import {
  validateIP,
  getClientIP,
  isPrivateIP,
  getIPGeolocation,
  logIPAccess,
} from '../ip-validator';

// Configure fast-check
fc.configureGlobal({
  numRuns: 100,
  verbose: false,
});

// Arbitraries
const tenantIdArb = fc.uuid();
const employeeIdArb = fc.uuid();

const ipv4Arb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

const privateIPv4Arb = fc.oneof(
  // 10.x.x.x
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([b, c, d]) => `10.${b}.${c}.${d}`),
  // 192.168.x.x
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([c, d]) => `192.168.${c}.${d}`),
  // 172.16-31.x.x
  fc.tuple(
    fc.integer({ min: 16, max: 31 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([b, c, d]) => `172.${b}.${c}.${d}`),
  // 127.x.x.x
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([b, c, d]) => `127.${b}.${c}.${d}`)
);

const publicIPv4Arb = fc.tuple(
  fc.integer({ min: 1, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 1, max: 255 })
).filter(([a, b]) => {
  // Exclude private ranges
  if (a === 10) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 127) return false;
  return true;
}).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

describe('IP Validator Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateIP', () => {
    it('should return not suspicious for first session (no existing session)', async () => {
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue(null);

      const result = await validateIP('tenant-1', 'emp-1', '192.168.1.1');

      expect(result).toEqual({ isSuspicious: false });
    });

    it('should return not suspicious when IP matches last session', async () => {
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue({
        id: 'session-1',
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        ip_address: '192.168.1.100',
        is_active: true,
        last_activity_at: new Date(),
      } as any);

      const result = await validateIP('tenant-1', 'emp-1', '192.168.1.100');

      expect(result).toEqual({ isSuspicious: false });
    });

    it('should return suspicious when IP differs from last session', async () => {
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue({
        id: 'session-1',
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        ip_address: '192.168.1.100',
        is_active: true,
        last_activity_at: new Date(),
      } as any);

      const result = await validateIP('tenant-1', 'emp-1', '10.0.0.5');

      expect(result.isSuspicious).toBe(true);
      expect(result.reason).toContain('192.168.1.100');
      expect(result.reason).toContain('10.0.0.5');
    });

    it('should query Prisma with correct tenant and employee filters', async () => {
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue(null);

      await validateIP('tenant-abc', 'emp-xyz', '1.2.3.4');

      expect(prisma.active_sessions.findFirst).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-abc',
          employee_id: 'emp-xyz',
          is_active: true,
        },
        orderBy: {
          last_activity_at: 'desc',
        },
      });
    });

    it('should query only active sessions', async () => {
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue(null);

      await validateIP('t1', 'e1', '1.1.1.1');

      const call = vi.mocked(prisma.active_sessions.findFirst).mock.calls[0][0];
      expect(call?.where?.is_active).toBe(true);
    });
  });

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '203.0.113.50');

      expect(getClientIP(headers)).toBe('203.0.113.50');
    });

    it('should extract first IP from x-forwarded-for with multiple IPs', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '203.0.113.50, 70.41.3.18, 150.172.238.178');

      expect(getClientIP(headers)).toBe('203.0.113.50');
    });

    it('should trim whitespace from x-forwarded-for', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '  203.0.113.50  , 70.41.3.18');

      expect(getClientIP(headers)).toBe('203.0.113.50');
    });

    it('should fall back to x-real-ip if x-forwarded-for is absent', () => {
      const headers = new Headers();
      headers.set('x-real-ip', '198.51.100.10');

      expect(getClientIP(headers)).toBe('198.51.100.10');
    });

    it('should fall back to cf-connecting-ip if others are absent', () => {
      const headers = new Headers();
      headers.set('cf-connecting-ip', '104.16.0.1');

      expect(getClientIP(headers)).toBe('104.16.0.1');
    });

    it('should return 127.0.0.1 when no IP headers are present', () => {
      const headers = new Headers();

      expect(getClientIP(headers)).toBe('127.0.0.1');
    });

    it('should prioritize x-forwarded-for over x-real-ip', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '1.1.1.1');
      headers.set('x-real-ip', '2.2.2.2');

      expect(getClientIP(headers)).toBe('1.1.1.1');
    });

    it('should prioritize x-real-ip over cf-connecting-ip', () => {
      const headers = new Headers();
      headers.set('x-real-ip', '2.2.2.2');
      headers.set('cf-connecting-ip', '3.3.3.3');

      expect(getClientIP(headers)).toBe('2.2.2.2');
    });
  });

  describe('isPrivateIP', () => {
    it('should detect 10.x.x.x as private', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);
    });

    it('should detect 172.16-31.x.x as private', () => {
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
    });

    it('should not detect 172.15.x.x or 172.32.x.x as private', () => {
      expect(isPrivateIP('172.15.0.1')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false);
    });

    it('should detect 192.168.x.x as private', () => {
      expect(isPrivateIP('192.168.0.1')).toBe(true);
      expect(isPrivateIP('192.168.255.255')).toBe(true);
    });

    it('should detect 127.x.x.x as private (loopback)', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('127.255.255.255')).toBe(true);
    });

    it('should detect ::1 as private (IPv6 loopback)', () => {
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('should detect fc00: prefixed addresses as private (IPv6 ULA)', () => {
      expect(isPrivateIP('fc00:1234:5678::1')).toBe(true);
    });

    it('should detect fe80: prefixed addresses as private (IPv6 link-local)', () => {
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should return false for public IPs', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('203.0.113.50')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
    });
  });

  describe('getIPGeolocation', () => {
    it('should return null for private IPs', async () => {
      const result = await getIPGeolocation('192.168.1.1');
      expect(result).toBeNull();
    });

    it('should return null for loopback', async () => {
      const result = await getIPGeolocation('127.0.0.1');
      expect(result).toBeNull();
    });

    it('should return null for public IPs (mock implementation)', async () => {
      const result = await getIPGeolocation('8.8.8.8');
      expect(result).toBeNull();
    });
  });

  describe('logIPAccess', () => {
    it('should create an audit log entry with correct fields', async () => {
      vi.mocked(prisma.session_audit_log.create).mockResolvedValue({} as any);

      await logIPAccess('tenant-1', 'emp-1', '192.168.1.1', 'Mozilla/5.0');

      expect(prisma.session_audit_log.create).toHaveBeenCalledWith({
        data: {
          tenant_id: 'tenant-1',
          employee_id: 'emp-1',
          action: 'LOGIN',
          ip_address: '192.168.1.1',
          details: {
            userAgent: 'Mozilla/5.0',
            timestamp: expect.any(String),
          },
        },
      });
    });

    it('should handle undefined userAgent', async () => {
      vi.mocked(prisma.session_audit_log.create).mockResolvedValue({} as any);

      await logIPAccess('tenant-1', 'emp-1', '10.0.0.1');

      const callData = vi.mocked(prisma.session_audit_log.create).mock.calls[0][0].data;
      expect((callData.details as any)?.userAgent).toBeUndefined();
    });

    it('should include ISO timestamp in details', async () => {
      vi.mocked(prisma.session_audit_log.create).mockResolvedValue({} as any);

      const before = new Date().toISOString();
      await logIPAccess('tenant-1', 'emp-1', '1.2.3.4');
      const after = new Date().toISOString();

      const callData = vi.mocked(prisma.session_audit_log.create).mock.calls[0][0].data;
      const ts = (callData.details as any)?.timestamp as string;

      // Timestamp should be between before and after
      expect(ts >= before).toBe(true);
      expect(ts <= after).toBe(true);
    });

    it('should always set action to LOGIN', async () => {
      vi.mocked(prisma.session_audit_log.create).mockResolvedValue({} as any);

      await logIPAccess('t', 'e', '0.0.0.0');

      const callData = vi.mocked(prisma.session_audit_log.create).mock.calls[0][0].data;
      expect(callData.action).toBe('LOGIN');
    });
  });

  describe('Property: isPrivateIP correctness for generated private IPs', () => {
    it('should always return true for private range IPs (100 runs)', () => {
      fc.assert(
        fc.property(privateIPv4Arb, (ip) => {
          expect(isPrivateIP(ip)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should always return false for public range IPs (100 runs)', () => {
      fc.assert(
        fc.property(publicIPv4Arb, (ip) => {
          expect(isPrivateIP(ip)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: validateIP consistency', () => {
    it('should return not suspicious when IP matches session (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          employeeIdArb,
          ipv4Arb,
          async (tenantId, employeeId, ip) => {
            // Mock: session with matching IP
            vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue({
              id: 'session-1',
              tenant_id: tenantId,
              employee_id: employeeId,
              ip_address: ip,
              is_active: true,
              last_activity_at: new Date(),
            } as any);

            const result = await validateIP(tenantId, employeeId, ip);

            expect(result.isSuspicious).toBe(false);
            expect(result.reason).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return suspicious when IP differs from session (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          employeeIdArb,
          ipv4Arb,
          ipv4Arb,
          async (tenantId, employeeId, sessionIP, currentIP) => {
            // Ensure IPs are different
            fc.pre(sessionIP !== currentIP);

            vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue({
              id: 'session-1',
              tenant_id: tenantId,
              employee_id: employeeId,
              ip_address: sessionIP,
              is_active: true,
              last_activity_at: new Date(),
            } as any);

            const result = await validateIP(tenantId, employeeId, currentIP);

            expect(result.isSuspicious).toBe(true);
            expect(result.reason).toBeDefined();
            expect(result.reason).toContain(sessionIP);
            expect(result.reason).toContain(currentIP);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: getClientIP always returns a string', () => {
    it('should always return a non-empty string regardless of headers (50 runs)', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.constantFrom('x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'host', 'user-agent'),
            fc.string({ minLength: 1, maxLength: 45 }),
            { minKeys: 0, maxKeys: 5 }
          ),
          (headerDict) => {
            const headers = new Headers();
            for (const [key, value] of Object.entries(headerDict)) {
              headers.set(key, value);
            }

            const result = getClientIP(headers);

            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
