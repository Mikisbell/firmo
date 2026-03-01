/**
 * Unit + Property Tests for Location Validator
 *
 * Tests cover:
 * 1. calculateDistance — Haversine distance calculation
 * 2. validateLocation — impossible travel detection
 * 3. getClientLocation — SSR-safe geolocation
 * 4. logLocationAccess — audit log creation
 * 5. Property: Haversine symmetry, triangle inequality, zero distance
 *
 * @module core/security/__tests__/location-validator.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------- mocks (before any SUT import) ----------
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
  calculateDistance,
  validateLocation,
  getClientLocation,
  logLocationAccess,
} from '../location-validator';
import type { Location } from '../location-validator';

// ============================================================================
// Arbitraries
// ============================================================================

// Valid latitude: -90 to 90
const latArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true });

// Valid longitude: -180 to 180
const lngArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

const locationArb: fc.Arbitrary<Location> = fc.record({
  lat: latArb,
  lng: lngArb,
});

const tenantIdArb = fc.uuid();
const employeeIdArb = fc.uuid();
const ipAddressArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// ============================================================================
// Unit Tests
// ============================================================================

describe('Location Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- calculateDistance ----------
  describe('calculateDistance', () => {
    it('returns 0 for the same point', () => {
      const dist = calculateDistance(-12.04, -77.03, -12.04, -77.03);
      expect(dist).toBeCloseTo(0, 5);
    });

    it('calculates distance between Lima and Cusco correctly (~580 km)', () => {
      // Lima: -12.0464, -77.0428 / Cusco: -13.5320, -71.9675
      const dist = calculateDistance(-12.0464, -77.0428, -13.5320, -71.9675);
      expect(dist).toBeGreaterThan(550);
      expect(dist).toBeLessThan(620);
    });

    it('calculates distance between known antipodal-ish points', () => {
      // North Pole to South Pole: ~20,015 km (half circumference)
      const dist = calculateDistance(90, 0, -90, 0);
      expect(dist).toBeGreaterThan(20000);
      expect(dist).toBeLessThan(20100);
    });

    it('calculates equatorial distance correctly (~111 km per degree)', () => {
      // 1 degree of latitude at the equator ~ 111 km
      const dist = calculateDistance(0, 0, 1, 0);
      expect(dist).toBeGreaterThan(110);
      expect(dist).toBeLessThan(112);
    });
  });

  // ---------- validateLocation ----------
  describe('validateLocation', () => {
    it('returns isValid: true when no previous session exists', async () => {
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue(null);

      const result = await validateLocation('tenant-1', 'emp-1', { lat: -12.04, lng: -77.03 });

      expect(result.isValid).toBe(true);
    });

    it('returns isValid: true when previous session has no location', async () => {
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue({
        location_lat: null,
        location_lng: null,
        last_activity_at: new Date(),
      } as any);

      const result = await validateLocation('tenant-1', 'emp-1', { lat: -12.04, lng: -77.03 });

      expect(result.isValid).toBe(true);
    });

    it('returns isValid: true when travel is physically possible', async () => {
      // 10 km in 60 minutes = 10 km/h (walking speed)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue({
        location_lat: -12.0464,
        location_lng: -77.0428,
        last_activity_at: oneHourAgo,
      } as any);

      // ~10 km away from Lima center
      const result = await validateLocation('tenant-1', 'emp-1', {
        lat: -12.1364,
        lng: -77.0228,
      });

      expect(result.isValid).toBe(true);
    });

    it('returns isValid: false when travel is impossible (too far too fast)', async () => {
      // Lima to Cusco (~580 km) in 1 minute = impossible
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue({
        location_lat: -12.0464,
        location_lng: -77.0428,
        last_activity_at: oneMinuteAgo,
      } as any);

      // Cusco
      const result = await validateLocation('tenant-1', 'emp-1', {
        lat: -13.5320,
        lng: -71.9675,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Viaje imposible');
    });

    it('allows travel at plane speed (900 km/h)', async () => {
      // 450 km in 30 minutes = 900 km/h (exactly at limit)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue({
        location_lat: 0,
        location_lng: 0,
        last_activity_at: thirtyMinAgo,
      } as any);

      // ~450 km away (approximately 4 degrees longitude at equator)
      const result = await validateLocation('tenant-1', 'emp-1', {
        lat: 0,
        lng: 4.05,
      });

      expect(result.isValid).toBe(true);
    });

    it('queries only the correct tenant and employee', async () => {
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue(null);

      await validateLocation('tenant-X', 'emp-Y', { lat: 0, lng: 0 });

      expect(prisma.active_sessions.findFirst).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-X',
          employee_id: 'emp-Y',
          is_active: true,
        },
        orderBy: { last_activity_at: 'desc' },
      });
    });
  });

  // ---------- getClientLocation ----------
  describe('getClientLocation', () => {
    it('returns null in SSR (no window)', async () => {
      // In Vitest/Node, typeof window === "undefined"
      const result = await getClientLocation();
      expect(result).toBeNull();
    });
  });

  // ---------- logLocationAccess ----------
  describe('logLocationAccess', () => {
    it('creates an audit log entry with location data', async () => {
      vi.mocked(prisma.session_audit_log.create).mockResolvedValue({} as any);

      const location: Location = { lat: -12.04, lng: -77.03 };
      await logLocationAccess('tenant-1', 'emp-1', location, '192.168.1.1');

      const createArg = vi.mocked(prisma.session_audit_log.create).mock.calls[0][0] as any;
      expect(createArg.data.tenant_id).toBe('tenant-1');
      expect(createArg.data.employee_id).toBe('emp-1');
      expect(createArg.data.action).toBe('LOCATION_ACCESS');
      expect(createArg.data.ip_address).toBe('192.168.1.1');
      expect(createArg.data.details.location.lat).toBe(-12.04);
      expect(createArg.data.details.location.lng).toBe(-77.03);
      expect(createArg.data.details.timestamp).toBeDefined();
    });

    it('logs null location when no location provided', async () => {
      vi.mocked(prisma.session_audit_log.create).mockResolvedValue({} as any);

      await logLocationAccess('tenant-1', 'emp-1', null, '10.0.0.1');

      const createArg = vi.mocked(prisma.session_audit_log.create).mock.calls[0][0] as any;
      expect(createArg.data.details.location).toBeNull();
    });
  });
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Location Validator - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Invariant 1: Haversine distance is always non-negative.
   */
  it('Invariant 1: Distance is always >= 0 (200 runs)', () => {
    fc.assert(
      fc.property(latArb, lngArb, latArb, lngArb, (lat1, lng1, lat2, lng2) => {
        const dist = calculateDistance(lat1, lng1, lat2, lng2);
        expect(dist).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Invariant 2: Haversine distance is symmetric — d(A,B) == d(B,A).
   */
  it('Invariant 2: Distance is symmetric d(A,B) === d(B,A) (200 runs)', () => {
    fc.assert(
      fc.property(latArb, lngArb, latArb, lngArb, (lat1, lng1, lat2, lng2) => {
        const d1 = calculateDistance(lat1, lng1, lat2, lng2);
        const d2 = calculateDistance(lat2, lng2, lat1, lng1);
        expect(d1).toBeCloseTo(d2, 10);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Invariant 3: Distance from a point to itself is 0.
   */
  it('Invariant 3: Distance from a point to itself is 0 (200 runs)', () => {
    fc.assert(
      fc.property(latArb, lngArb, (lat, lng) => {
        const dist = calculateDistance(lat, lng, lat, lng);
        expect(dist).toBeCloseTo(0, 10);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Invariant 4: Maximum distance on Earth is ~20,037 km (half circumference).
   */
  it('Invariant 4: No distance exceeds half the Earths circumference (~20,037 km) (200 runs)', () => {
    fc.assert(
      fc.property(latArb, lngArb, latArb, lngArb, (lat1, lng1, lat2, lng2) => {
        const dist = calculateDistance(lat1, lng1, lat2, lng2);
        expect(dist).toBeLessThanOrEqual(20100); // small margin for floating point
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Invariant 5: validateLocation always returns isValid: true when there is no previous session.
   */
  it('Invariant 5: First session is always valid regardless of location (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(tenantIdArb, employeeIdArb, locationArb, async (tenantId, employeeId, loc) => {
        vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue(null);

        const result = await validateLocation(tenantId, employeeId, loc);
        expect(result.isValid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Invariant 6: validateLocation returns isValid: true when previous session has no location.
   */
  it('Invariant 6: Session without prior location is always valid (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(tenantIdArb, employeeIdArb, locationArb, async (tenantId, employeeId, loc) => {
        vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue({
          location_lat: null,
          location_lng: null,
          last_activity_at: new Date(),
        } as any);

        const result = await validateLocation(tenantId, employeeId, loc);
        expect(result.isValid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Invariant 7: Triangle inequality — d(A,C) <= d(A,B) + d(B,C) (with tolerance).
   */
  it('Invariant 7: Triangle inequality holds d(A,C) <= d(A,B) + d(B,C) (100 runs)', () => {
    fc.assert(
      fc.property(
        locationArb,
        locationArb,
        locationArb,
        (a, b, c) => {
          const dAB = calculateDistance(a.lat, a.lng, b.lat, b.lng);
          const dBC = calculateDistance(b.lat, b.lng, c.lat, c.lng);
          const dAC = calculateDistance(a.lat, a.lng, c.lat, c.lng);
          // Small epsilon for floating point rounding
          expect(dAC).toBeLessThanOrEqual(dAB + dBC + 0.001);
        }
      ),
      { numRuns: 100 }
    );
  });
});
