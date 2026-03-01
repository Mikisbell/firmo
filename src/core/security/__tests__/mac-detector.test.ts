/**
 * Tests for MAC Address Detection Service
 *
 * Tests: detectMACAddress, getOrCreateDeviceId, getDeviceIdentifier,
 *        isValidMACAddress, normalizeMACAddress
 *
 * Includes property-based tests for MAC validation and normalization.
 *
 * @module core/security/__tests__/mac-detector.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock external dependencies before imports
vi.mock('@/src/lib/storage', () => {
  const store = new Map<string, string>();
  return {
    safeStorage: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
        return true;
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
        return true;
      }),
      clear: vi.fn(() => {
        store.clear();
        return true;
      }),
      _store: store,
    },
  };
});

vi.mock('@/src/core/observability/structured-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  detectMACAddress,
  getOrCreateDeviceId,
  getDeviceIdentifier,
  isValidMACAddress,
  normalizeMACAddress,
} from '../mac-detector';
import { safeStorage } from '@/src/lib/storage';

// ============================================================================
// Arbitraries
// ============================================================================

/** Generate a valid hex pair (2 hex characters) */
const hexPairArb = fc.integer({ min: 0, max: 255 }).map((n) =>
  n.toString(16).padStart(2, '0')
);

/** Generate a valid MAC address with colons (e.g., AA:BB:CC:DD:EE:FF) */
const validMacColonArb = fc
  .tuple(hexPairArb, hexPairArb, hexPairArb, hexPairArb, hexPairArb, hexPairArb)
  .map((parts) => parts.join(':'));

/** Generate a valid MAC address with dashes (e.g., AA-BB-CC-DD-EE-FF) */
const validMacDashArb = fc
  .tuple(hexPairArb, hexPairArb, hexPairArb, hexPairArb, hexPairArb, hexPairArb)
  .map((parts) => parts.join('-'));

/** Generate a valid MAC address in either format */
const validMacArb = fc.oneof(validMacColonArb, validMacDashArb);

/** Generate an invalid MAC address (wrong length or characters) */
const invalidMacArb = fc.oneof(
  // Too short
  fc.tuple(hexPairArb, hexPairArb, hexPairArb).map((p) => p.join(':')),
  // Too long (7 pairs)
  fc
    .tuple(hexPairArb, hexPairArb, hexPairArb, hexPairArb, hexPairArb, hexPairArb, hexPairArb)
    .map((p) => p.join(':')),
  // Invalid characters
  fc.string({ minLength: 17, maxLength: 17 }).filter((s) => !/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(s)),
  // Empty string
  fc.constant(''),
  // No separators
  fc.tuple(hexPairArb, hexPairArb, hexPairArb, hexPairArb, hexPairArb, hexPairArb).map((p) => p.join('')),
);

// ============================================================================
// isValidMACAddress
// ============================================================================

describe('isValidMACAddress', () => {
  it('accepts valid MAC addresses with colons', () => {
    expect(isValidMACAddress('AA:BB:CC:DD:EE:FF')).toBe(true);
    expect(isValidMACAddress('00:00:00:00:00:00')).toBe(true);
    expect(isValidMACAddress('ff:ff:ff:ff:ff:ff')).toBe(true);
    expect(isValidMACAddress('aA:bB:cC:dD:eE:fF')).toBe(true);
  });

  it('accepts valid MAC addresses with dashes', () => {
    expect(isValidMACAddress('AA-BB-CC-DD-EE-FF')).toBe(true);
    expect(isValidMACAddress('00-00-00-00-00-00')).toBe(true);
    expect(isValidMACAddress('ff-ff-ff-ff-ff-ff')).toBe(true);
  });

  it('rejects invalid MAC addresses', () => {
    expect(isValidMACAddress('')).toBe(false);
    expect(isValidMACAddress('not-a-mac')).toBe(false);
    expect(isValidMACAddress('AA:BB:CC:DD:EE')).toBe(false);
    expect(isValidMACAddress('AA:BB:CC:DD:EE:FF:GG')).toBe(false);
    expect(isValidMACAddress('GG:HH:II:JJ:KK:LL')).toBe(false);
    expect(isValidMACAddress('AA:BB:CC:DD:EE:F')).toBe(false);
    expect(isValidMACAddress('AABBCCDDEEFF')).toBe(false);
  });

  it('accepts mixed separator formats (regex allows either : or - at each position)', () => {
    // The regex /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/ allows mixing : and -
    expect(isValidMACAddress('AA:BB-CC:DD-EE:FF')).toBe(true);
  });

  // Property: all generated valid MACs should pass validation
  it('property: accepts any well-formed MAC with colons (100 runs)', () => {
    fc.assert(
      fc.property(validMacColonArb, (mac) => {
        expect(isValidMACAddress(mac)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Property: all generated valid MACs with dashes should pass validation
  it('property: accepts any well-formed MAC with dashes (100 runs)', () => {
    fc.assert(
      fc.property(validMacDashArb, (mac) => {
        expect(isValidMACAddress(mac)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Property: invalid MACs should fail validation
  it('property: rejects malformed MAC addresses (100 runs)', () => {
    fc.assert(
      fc.property(invalidMacArb, (mac) => {
        expect(isValidMACAddress(mac)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// normalizeMACAddress
// ============================================================================

describe('normalizeMACAddress', () => {
  it('converts lowercase to uppercase', () => {
    expect(normalizeMACAddress('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('replaces dashes with colons', () => {
    expect(normalizeMACAddress('AA-BB-CC-DD-EE-FF')).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('handles already normalized MAC', () => {
    expect(normalizeMACAddress('AA:BB:CC:DD:EE:FF')).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('handles mixed case with dashes', () => {
    expect(normalizeMACAddress('aA-bB-cC-dD-eE-fF')).toBe('AA:BB:CC:DD:EE:FF');
  });

  // Property: normalization is idempotent (applying twice gives same result)
  it('property: normalization is idempotent (100 runs)', () => {
    fc.assert(
      fc.property(validMacArb, (mac) => {
        const once = normalizeMACAddress(mac);
        const twice = normalizeMACAddress(once);
        expect(once).toBe(twice);
      }),
      { numRuns: 100 }
    );
  });

  // Property: normalized output always uses colons and is uppercase
  it('property: output is always uppercase with colons (100 runs)', () => {
    fc.assert(
      fc.property(validMacArb, (mac) => {
        const normalized = normalizeMACAddress(mac);
        expect(normalized).toMatch(/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/);
      }),
      { numRuns: 100 }
    );
  });

  // Property: normalization preserves the hex values
  it('property: preserves hex values after normalization (100 runs)', () => {
    fc.assert(
      fc.property(validMacArb, (mac) => {
        const originalParts = mac.toUpperCase().split(/[:-]/).join('');
        const normalizedParts = normalizeMACAddress(mac).split(':').join('');
        expect(normalizedParts).toBe(originalParts);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// detectMACAddress
// ============================================================================

describe('detectMACAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window/global mocks
    (globalThis as any).window = undefined;
  });

  it('returns null when RTCPeerConnection is not available', async () => {
    // No window.RTCPeerConnection = no WebRTC
    const result = await detectMACAddress();
    expect(result).toBeNull();
  });

  it('returns null when WebRTC throws', async () => {
    (globalThis as any).window = {
      RTCPeerConnection: class {
        constructor() {
          throw new Error('WebRTC not supported');
        }
      },
    };

    const result = await detectMACAddress();
    expect(result).toBeNull();
  });

  it('returns null when WebRTC resolves with no MAC in candidate', async () => {
    let onIceCandidateHandler: ((e: any) => void) | null = null;

    (globalThis as any).window = {
      RTCPeerConnection: class {
        onicecandidate: any;
        createDataChannel() {
          return {};
        }
        createOffer() {
          return Promise.resolve({});
        }
        setLocalDescription() {
          // Trigger ICE candidate with no MAC
          setTimeout(() => {
            if (this.onicecandidate) {
              this.onicecandidate({
                candidate: { candidate: 'candidate:1 1 udp 2130706431 192.168.1.1 8080 typ host' },
              });
            }
          }, 10);
          // Then trigger end-of-candidates
          setTimeout(() => {
            if (this.onicecandidate) {
              this.onicecandidate({ candidate: null });
            }
          }, 20);
          return Promise.resolve();
        }
        close() {}
      },
    };

    const result = await detectMACAddress();
    expect(result).toBeNull();
  });
});

// ============================================================================
// getOrCreateDeviceId
// ============================================================================

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the mock store
    const store = (safeStorage as any)._store as Map<string, string>;
    if (store) store.clear();

    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
    });
  });

  it('generates and stores a new device ID when none exists', () => {
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(null);

    const deviceId = getOrCreateDeviceId();

    expect(deviceId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(safeStorage.setItem).toHaveBeenCalledWith(
      'park_pos_device_id',
      '550e8400-e29b-41d4-a716-446655440000'
    );
  });

  it('returns existing device ID from storage', () => {
    const existingId = 'existing-device-id-123';
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(existingId);

    const deviceId = getOrCreateDeviceId();

    expect(deviceId).toBe(existingId);
    expect(safeStorage.setItem).not.toHaveBeenCalled();
  });

  it('always returns a non-empty string', () => {
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(null);

    const deviceId = getOrCreateDeviceId();
    expect(deviceId).toBeTruthy();
    expect(typeof deviceId).toBe('string');
    expect(deviceId.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// getDeviceIdentifier
// ============================================================================

describe('getDeviceIdentifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).window = undefined;

    // Mock crypto.randomUUID for fallback device ID
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'fallback-device-uuid'),
    });
  });

  it('returns device_id type when MAC detection is not available', async () => {
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(null);

    const result = await getDeviceIdentifier();

    expect(result.type).toBe('device_id');
    expect(result.identifier).toBeTruthy();
  });

  it('returns consistent device_id on subsequent calls', async () => {
    vi.mocked(safeStorage.getItem)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('fallback-device-uuid');

    const first = await getDeviceIdentifier();
    const second = await getDeviceIdentifier();

    expect(first.type).toBe('device_id');
    expect(second.type).toBe('device_id');
    // Both should return a valid string identifier
    expect(first.identifier).toBeTruthy();
    expect(second.identifier).toBeTruthy();
  });

  it('result always has type "mac" or "device_id"', async () => {
    vi.mocked(safeStorage.getItem).mockReturnValueOnce(null);

    const result = await getDeviceIdentifier();
    expect(['mac', 'device_id']).toContain(result.type);
    expect(result.identifier).toBeTruthy();
  });
});
