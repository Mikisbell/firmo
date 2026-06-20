/**
 * Tests for Hybrid MAC Address Validation Service
 *
 * Tests: validateMAC, checkTerminalAuthorization, registerMAC, blockMAC,
 *        unblockMAC, getDevicesByEmployee, getTerminalAccessLog,
 *        getUnauthorizedAccess, updateMACTrustLevel, getDeviceInfo,
 *        deactivateEmployeeMACs
 *
 * Includes property-based tests for validation invariants.
 *
 * @module core/security/__tests__/mac-validator-hybrid.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock prisma before importing the module under test
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    device_mac_addresses: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    terminal_mac_registry: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Mock mac-detector's normalizeMACAddress (simple passthrough for tests)
vi.mock('../mac-detector', () => ({
  normalizeMACAddress: vi.fn((mac: string) => mac.toUpperCase().replace(/-/g, ':')),
}));

import prisma from '@/src/core/db/prisma';
import {
  validateMAC,
  checkTerminalAuthorization,
  registerMAC,
  blockMAC,
  unblockMAC,
  getDevicesByEmployee,
  getTerminalAccessLog,
  getUnauthorizedAccess,
  updateMACTrustLevel,
  getDeviceInfo,
  deactivateEmployeeMACs,
} from '../mac-validator-hybrid';

// ============================================================================
// Arbitraries
// ============================================================================

const uuidArb = fc.uuid();
const macArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map((parts) =>
    parts.map((n) => n.toString(16).padStart(2, '0').toUpperCase()).join(':')
  );

const trustLevelArb = fc.constantFrom<'TRUSTED' | 'UNKNOWN' | 'BLOCKED'>(
  'TRUSTED',
  'UNKNOWN',
  'BLOCKED'
);

const ANY_TERMINAL_ID = '00000000-0000-0000-0000-000000000000';

// ============================================================================
// validateMAC
// ============================================================================

describe('validateMAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns UNKNOWN when MAC is not provided (empty string)', async () => {
    const result = await validateMAC('tenant-1', 'emp-1', '');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('MAC_NOT_PROVIDED');
    expect(result.trustLevel).toBe('UNKNOWN');
  });

  it('returns UNKNOWN_MAC when MAC is not found in database', async () => {
    // Modelo multi-device: validateMAC consulta findMany (array). Sin filas → MAC desconocido.
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([] as never);

    const result = await validateMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('UNKNOWN_MAC');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.trustLevel).toBe('UNKNOWN');
  });

  it('is VALID when MAC is TRUSTED by another employee of the tenant (shared terminal)', async () => {
    // Nuevo modelo: confianza a nivel TENANT. Un MAC registrado como TRUSTED por
    // cualquier empleado del tenant es válido para todos (POS de terminal compartido).
    // El antiguo reason DEVICE_MISMATCH fue eliminado a propósito en hardening.
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([
      {
        id: 'device-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
        employee_id: 'different-employee',
        terminal_id: ANY_TERMINAL_ID,
        trust_level: 'TRUSTED',
        first_seen: new Date(),
        last_seen: new Date(),
        is_active: true,
      },
    ] as never);

    const result = await validateMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF');

    expect(result.isValid).toBe(true);
    expect(result.trustLevel).toBe('TRUSTED');
  });

  it('returns BLOCKED_DEVICE when MAC is blocked for THIS employee', async () => {
    // El bloqueo es por empleado: solo se rechaza si existe una fila BLOCKED
    // cuyo employee_id coincide con quien intenta autenticarse.
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([
      {
        id: 'device-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        terminal_id: ANY_TERMINAL_ID,
        trust_level: 'BLOCKED',
        first_seen: new Date(),
        last_seen: new Date(),
        is_active: false,
      },
    ] as never);

    const result = await validateMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('BLOCKED_DEVICE');
    expect(result.trustLevel).toBe('BLOCKED');
  });

  it('is INVALID when MAC is known but NOT trusted by anyone (pending state)', async () => {
    // Conocido pero sin fila TRUSTED → vuelve a requerir confirmación.
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([
      {
        id: 'device-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        terminal_id: ANY_TERMINAL_ID,
        trust_level: 'UNKNOWN',
        first_seen: new Date(),
        last_seen: new Date(),
        is_active: true,
      },
    ] as never);

    const result = await validateMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF');

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('UNKNOWN_MAC');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.trustLevel).toBe('UNKNOWN');
  });

  it('returns valid with DIFFERENT_TERMINAL warning for terminal mismatch', async () => {
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([
      {
        id: 'device-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        terminal_id: 'terminal-A',
        trust_level: 'TRUSTED',
        first_seen: new Date(),
        last_seen: new Date(),
        is_active: true,
      },
    ] as never);

    const result = await validateMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF', 'terminal-B');

    expect(result.isValid).toBe(true);
    expect(result.warning).toBe('DIFFERENT_TERMINAL');
    expect(result.trustLevel).toBe('TRUSTED');
  });

  it('is VALID when terminal_mac_registry authorizes the MAC for the terminal', async () => {
    // Atajo de nivel terminal: si el MAC está autorizado para ESTE terminal,
    // es válido para cualquier empleado sin consultar device_mac_addresses.
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue({
      id: 'registry-1',
      tenant_id: 'tenant-1',
      terminal_id: 'terminal-A',
      mac_address: 'AA:BB:CC:DD:EE:FF',
      is_authorized: true,
    } as never);

    const result = await validateMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF', 'terminal-A');

    expect(result.isValid).toBe(true);
    expect(result.trustLevel).toBe('TRUSTED');
    // No debe consultar device_mac_addresses si el terminal ya autorizó el MAC.
    expect(prisma.device_mac_addresses.findMany).not.toHaveBeenCalled();
  });

  it('returns fully valid when all checks pass (any terminal)', async () => {
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([
      {
        id: 'device-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        terminal_id: ANY_TERMINAL_ID,
        trust_level: 'TRUSTED',
        first_seen: new Date(),
        last_seen: new Date(),
        is_active: true,
      },
    ] as never);

    const result = await validateMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF', 'any-terminal');

    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.warning).toBeUndefined();
    expect(result.trustLevel).toBe('TRUSTED');
  });

  it('returns fully valid when terminal matches exactly', async () => {
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([
      {
        id: 'device-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        terminal_id: 'terminal-A',
        trust_level: 'TRUSTED',
        first_seen: new Date(),
        last_seen: new Date(),
        is_active: true,
      },
    ] as never);

    const result = await validateMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF', 'terminal-A');

    expect(result.isValid).toBe(true);
    expect(result.trustLevel).toBe('TRUSTED');
  });

  it('skips terminal check when no terminalId is provided', async () => {
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([
      {
        id: 'device-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        terminal_id: 'terminal-A',
        trust_level: 'TRUSTED',
        first_seen: new Date(),
        last_seen: new Date(),
        is_active: true,
      },
    ] as never);

    const result = await validateMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF');

    expect(result.isValid).toBe(true);
    expect(result.trustLevel).toBe('TRUSTED');
  });

  // Property: empty MAC always fails with MAC_NOT_PROVIDED
  it('property: empty MAC always fails validation (50 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, async (tenantId, employeeId) => {
        const result = await validateMAC(tenantId, employeeId, '');
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('MAC_NOT_PROVIDED');
      }),
      { numRuns: 50 }
    );
  });

  // Property: unknown MAC always requires confirmation
  it('property: unknown MAC always requires confirmation (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, macArb, async (tenantId, employeeId, mac) => {
        vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([] as never);

        const result = await validateMAC(tenantId, employeeId, mac);

        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('UNKNOWN_MAC');
        expect(result.requiresConfirmation).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Property: devices blocked for THIS employee are always rejected
  it('property: devices blocked for the requesting employee are always rejected (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        macArb,
        async (tenantId, employeeId, mac) => {
          vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
          vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([
            {
              id: 'device-1',
              mac_address: mac.toUpperCase(),
              tenant_id: tenantId,
              employee_id: employeeId, // Mismo empleado
              terminal_id: ANY_TERMINAL_ID,
              trust_level: 'BLOCKED', // Pero bloqueado para él
              first_seen: new Date(),
              last_seen: new Date(),
              is_active: false,
            },
          ] as never);

          const result = await validateMAC(tenantId, employeeId, mac);

          expect(result.isValid).toBe(false);
          expect(result.reason).toBe('BLOCKED_DEVICE');
          expect(result.trustLevel).toBe('BLOCKED');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property (nuevo modelo tenant-trust): un MAC TRUSTED por OTRO empleado del tenant,
  // sin fila BLOCKED para el empleado solicitante, es siempre VÁLIDO (terminal compartido).
  it('property: a MAC trusted by another tenant employee is always valid (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        macArb,
        async (tenantId, employeeId, otherEmployeeId, mac) => {
          fc.pre(employeeId !== otherEmployeeId);

          vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
          vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([
            {
              id: 'device-1',
              mac_address: mac.toUpperCase(),
              tenant_id: tenantId,
              employee_id: otherEmployeeId, // Otro empleado
              terminal_id: ANY_TERMINAL_ID,
              trust_level: 'TRUSTED',
              first_seen: new Date(),
              last_seen: new Date(),
              is_active: true,
            },
          ] as never);

          const result = await validateMAC(tenantId, employeeId, mac);

          expect(result.isValid).toBe(true);
          expect(result.trustLevel).toBe('TRUSTED');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// checkTerminalAuthorization
// ============================================================================

describe('checkTerminalAuthorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates audit record and authorizes on first access', async () => {
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.terminal_mac_registry.create).mockResolvedValue({} as never);

    const result = await checkTerminalAuthorization(
      'tenant-1',
      'terminal-1',
      'AA:BB:CC:DD:EE:FF',
      'emp-1'
    );

    expect(result.isAuthorized).toBe(true);
    expect(result.reason).toBe('FIRST_ACCESS_TO_TERMINAL');
    expect(result.shouldAlert).toBe(false);

    expect(prisma.terminal_mac_registry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 'tenant-1',
        terminal_id: 'terminal-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        employee_id: 'emp-1',
        is_authorized: true,
        access_count: 1,
      }),
    });
  });

  it('rejects unauthorized terminal access and triggers alert', async () => {
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue({
      id: 'registry-1',
      tenant_id: 'tenant-1',
      terminal_id: 'terminal-1',
      mac_address: 'AA:BB:CC:DD:EE:FF',
      employee_id: 'emp-1',
      is_authorized: false,
      first_seen: new Date(),
      last_seen: new Date(),
      access_count: 5,
    } as never);

    const result = await checkTerminalAuthorization(
      'tenant-1',
      'terminal-1',
      'AA:BB:CC:DD:EE:FF',
      'emp-1'
    );

    expect(result.isAuthorized).toBe(false);
    expect(result.reason).toBe('UNAUTHORIZED_TERMINAL_ACCESS');
    expect(result.shouldAlert).toBe(true);
  });

  it('updates last_seen and increments access_count on authorized re-access', async () => {
    vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue({
      id: 'registry-1',
      tenant_id: 'tenant-1',
      terminal_id: 'terminal-1',
      mac_address: 'AA:BB:CC:DD:EE:FF',
      employee_id: 'emp-1',
      is_authorized: true,
      first_seen: new Date(),
      last_seen: new Date(),
      access_count: 10,
    } as never);
    vi.mocked(prisma.terminal_mac_registry.update).mockResolvedValue({} as never);

    const result = await checkTerminalAuthorization(
      'tenant-1',
      'terminal-1',
      'AA:BB:CC:DD:EE:FF',
      'emp-1'
    );

    expect(result.isAuthorized).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.shouldAlert).toBeUndefined();

    expect(prisma.terminal_mac_registry.update).toHaveBeenCalledWith({
      where: { id: 'registry-1' },
      data: expect.objectContaining({
        access_count: { increment: 1 },
      }),
    });
  });

  // Property: first-time access always creates an audit record
  it('property: first access always creates audit record (50 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        macArb,
        uuidArb,
        async (tenantId, terminalId, mac, employeeId) => {
          vi.mocked(prisma.terminal_mac_registry.findFirst).mockResolvedValue(null);
          vi.mocked(prisma.terminal_mac_registry.create).mockResolvedValue({} as never);

          const result = await checkTerminalAuthorization(
            tenantId,
            terminalId,
            mac,
            employeeId
          );

          expect(result.isAuthorized).toBe(true);
          expect(result.reason).toBe('FIRST_ACCESS_TO_TERMINAL');
          expect(prisma.terminal_mac_registry.create).toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// registerMAC
// ============================================================================

describe('registerMAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a new MAC for an employee', async () => {
    vi.mocked(prisma.device_mac_addresses.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.upsert).mockResolvedValue({} as never);

    await registerMAC('tenant-1', 'emp-1', 'aa:bb:cc:dd:ee:ff');

    expect(prisma.device_mac_addresses.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mac_address_employee_id_terminal_id: {
            mac_address: 'AA:BB:CC:DD:EE:FF',
            employee_id: 'emp-1',
            terminal_id: ANY_TERMINAL_ID,
          },
        },
        create: expect.objectContaining({
          mac_address: 'AA:BB:CC:DD:EE:FF',
          tenant_id: 'tenant-1',
          employee_id: 'emp-1',
          terminal_id: ANY_TERMINAL_ID,
          trust_level: 'TRUSTED',
          is_active: true,
        }),
        update: expect.objectContaining({
          is_active: true,
          trust_level: 'TRUSTED',
        }),
      })
    );
  });

  it('registers MAC with specific terminal ID', async () => {
    vi.mocked(prisma.device_mac_addresses.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device_mac_addresses.upsert).mockResolvedValue({} as never);

    await registerMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF', 'terminal-X');

    expect(prisma.device_mac_addresses.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mac_address_employee_id_terminal_id: {
            mac_address: 'AA:BB:CC:DD:EE:FF',
            employee_id: 'emp-1',
            terminal_id: 'terminal-X',
          },
        },
      })
    );
  });

  it('allows registering a MAC already owned by another employee (shared terminal)', async () => {
    // Nuevo modelo: los terminales POS son compartidos. registerMAC ya NO lanza
    // cuando otro empleado tiene el MAC; hace upsert de la fila del nuevo empleado.
    vi.mocked(prisma.device_mac_addresses.findFirst).mockResolvedValue({
      id: 'existing-1',
      mac_address: 'AA:BB:CC:DD:EE:FF',
      tenant_id: 'tenant-1',
      employee_id: 'other-employee',
      terminal_id: ANY_TERMINAL_ID,
      trust_level: 'TRUSTED',
      first_seen: new Date(),
      last_seen: new Date(),
      is_active: true,
    } as never);
    vi.mocked(prisma.device_mac_addresses.upsert).mockResolvedValue({} as never);

    await expect(
      registerMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF')
    ).resolves.not.toThrow();

    expect(prisma.device_mac_addresses.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          employee_id: 'emp-1',
          trust_level: 'TRUSTED',
        }),
      })
    );
  });

  it('allows re-registering MAC for the same employee', async () => {
    vi.mocked(prisma.device_mac_addresses.findFirst).mockResolvedValue({
      id: 'existing-1',
      mac_address: 'AA:BB:CC:DD:EE:FF',
      tenant_id: 'tenant-1',
      employee_id: 'emp-1',
      terminal_id: ANY_TERMINAL_ID,
      trust_level: 'TRUSTED',
      first_seen: new Date(),
      last_seen: new Date(),
      is_active: true,
    } as never);
    vi.mocked(prisma.device_mac_addresses.upsert).mockResolvedValue({} as never);

    await expect(
      registerMAC('tenant-1', 'emp-1', 'AA:BB:CC:DD:EE:FF')
    ).resolves.not.toThrow();
  });

  // Property (nuevo modelo): el registro cruzado entre empleados NUNCA lanza
  // y siempre hace upsert de la fila del empleado solicitante (terminal compartido).
  it('property: cross-employee registration never throws and upserts (50 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        macArb,
        async (tenantId, empId, otherEmpId, mac) => {
          fc.pre(empId !== otherEmpId);

          vi.clearAllMocks();
          vi.mocked(prisma.device_mac_addresses.findFirst).mockResolvedValue({
            id: 'existing',
            mac_address: mac,
            tenant_id: tenantId,
            employee_id: otherEmpId,
          } as never);
          vi.mocked(prisma.device_mac_addresses.upsert).mockResolvedValue({} as never);

          await expect(registerMAC(tenantId, empId, mac)).resolves.not.toThrow();
          expect(prisma.device_mac_addresses.upsert).toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// blockMAC
// ============================================================================

describe('blockMAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks all instances of a MAC and marks terminal access as unauthorized', async () => {
    vi.mocked(prisma.device_mac_addresses.updateMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.terminal_mac_registry.updateMany).mockResolvedValue({ count: 3 } as never);

    await blockMAC('tenant-1', 'AA:BB:CC:DD:EE:FF');

    expect(prisma.device_mac_addresses.updateMany).toHaveBeenCalledWith({
      where: {
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
      },
      data: {
        trust_level: 'BLOCKED',
        is_active: false,
      },
    });

    expect(prisma.terminal_mac_registry.updateMany).toHaveBeenCalledWith({
      where: {
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
      },
      data: {
        is_authorized: false,
      },
    });
  });

  it('normalizes MAC before blocking', async () => {
    vi.mocked(prisma.device_mac_addresses.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.terminal_mac_registry.updateMany).mockResolvedValue({ count: 1 } as never);

    await blockMAC('tenant-1', 'aa-bb-cc-dd-ee-ff');

    expect(prisma.device_mac_addresses.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          mac_address: 'AA:BB:CC:DD:EE:FF',
        }),
      })
    );
  });
});

// ============================================================================
// unblockMAC
// ============================================================================

describe('unblockMAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unblocks a MAC address by setting TRUSTED and is_active', async () => {
    vi.mocked(prisma.device_mac_addresses.updateMany).mockResolvedValue({ count: 1 } as never);

    await unblockMAC('tenant-1', 'AA:BB:CC:DD:EE:FF');

    expect(prisma.device_mac_addresses.updateMany).toHaveBeenCalledWith({
      where: {
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
      },
      data: {
        trust_level: 'TRUSTED',
        is_active: true,
      },
    });
  });

  // Property: block then unblock restores TRUSTED state
  it('property: block then unblock restores TRUSTED state (50 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, macArb, async (tenantId, mac) => {
        vi.mocked(prisma.device_mac_addresses.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.terminal_mac_registry.updateMany).mockResolvedValue({ count: 1 } as never);

        await blockMAC(tenantId, mac);

        // Verify blockMAC set BLOCKED
        const blockCall = vi.mocked(prisma.device_mac_addresses.updateMany).mock.calls[0][0];
        expect((blockCall as any).data.trust_level).toBe('BLOCKED');

        await unblockMAC(tenantId, mac);

        // Verify unblockMAC restored TRUSTED
        const unblockCall = vi.mocked(prisma.device_mac_addresses.updateMany).mock.calls[1][0];
        expect((unblockCall as any).data.trust_level).toBe('TRUSTED');
        expect((unblockCall as any).data.is_active).toBe(true);
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// getDevicesByEmployee
// ============================================================================

describe('getDevicesByEmployee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns active devices for an employee ordered by last_seen', async () => {
    const mockDevices = [
      { id: '1', mac_address: 'AA:BB:CC:DD:EE:FF', last_seen: new Date() },
      { id: '2', mac_address: '11:22:33:44:55:66', last_seen: new Date() },
    ];
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue(mockDevices as never);

    const result = await getDevicesByEmployee('tenant-1', 'emp-1');

    expect(result).toEqual(mockDevices);
    expect(prisma.device_mac_addresses.findMany).toHaveBeenCalledWith({
      where: {
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        is_active: true,
      },
      orderBy: {
        last_seen: 'desc',
      },
    });
  });

  it('returns empty array when no devices found', async () => {
    vi.mocked(prisma.device_mac_addresses.findMany).mockResolvedValue([]);

    const result = await getDevicesByEmployee('tenant-1', 'emp-1');
    expect(result).toEqual([]);
  });
});

// ============================================================================
// getTerminalAccessLog
// ============================================================================

describe('getTerminalAccessLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns access log with default limit of 100', async () => {
    vi.mocked(prisma.terminal_mac_registry.findMany).mockResolvedValue([]);

    await getTerminalAccessLog('tenant-1', 'terminal-1');

    expect(prisma.terminal_mac_registry.findMany).toHaveBeenCalledWith({
      where: {
        tenant_id: 'tenant-1',
        terminal_id: 'terminal-1',
      },
      orderBy: {
        last_seen: 'desc',
      },
      take: 100,
    });
  });

  it('respects custom limit parameter', async () => {
    vi.mocked(prisma.terminal_mac_registry.findMany).mockResolvedValue([]);

    await getTerminalAccessLog('tenant-1', 'terminal-1', 25);

    expect(prisma.terminal_mac_registry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 })
    );
  });
});

// ============================================================================
// getUnauthorizedAccess
// ============================================================================

describe('getUnauthorizedAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only unauthorized access records', async () => {
    const mockRecords = [
      { id: '1', is_authorized: false, mac_address: 'AA:BB:CC:DD:EE:FF' },
    ];
    vi.mocked(prisma.terminal_mac_registry.findMany).mockResolvedValue(mockRecords as never);

    const result = await getUnauthorizedAccess('tenant-1');

    expect(result).toEqual(mockRecords);
    expect(prisma.terminal_mac_registry.findMany).toHaveBeenCalledWith({
      where: {
        tenant_id: 'tenant-1',
        is_authorized: false,
      },
      orderBy: {
        last_seen: 'desc',
      },
    });
  });
});

// ============================================================================
// updateMACTrustLevel
// ============================================================================

describe('updateMACTrustLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates trust level for all instances of a MAC', async () => {
    vi.mocked(prisma.device_mac_addresses.updateMany).mockResolvedValue({ count: 1 } as never);

    await updateMACTrustLevel('tenant-1', 'AA:BB:CC:DD:EE:FF', 'UNKNOWN');

    expect(prisma.device_mac_addresses.updateMany).toHaveBeenCalledWith({
      where: {
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
      },
      data: {
        trust_level: 'UNKNOWN',
      },
    });
  });

  // Property: trust level is always set to the provided value
  it('property: trust level is always set to the provided value (50 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        macArb,
        trustLevelArb,
        async (tenantId, mac, level) => {
          vi.clearAllMocks();
          vi.mocked(prisma.device_mac_addresses.updateMany).mockResolvedValue({
            count: 1,
          } as never);

          await updateMACTrustLevel(tenantId, mac, level);

          const calls = vi.mocked(prisma.device_mac_addresses.updateMany).mock.calls;
          const lastCall = calls[calls.length - 1][0];
          expect((lastCall as any).data.trust_level).toBe(level);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// getDeviceInfo
// ============================================================================

describe('getDeviceInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns device info for a valid MAC', async () => {
    const mockDevice = {
      id: 'device-1',
      mac_address: 'AA:BB:CC:DD:EE:FF',
      tenant_id: 'tenant-1',
      employee_id: 'emp-1',
      trust_level: 'TRUSTED',
    };
    vi.mocked(prisma.device_mac_addresses.findFirst).mockResolvedValue(mockDevice as never);

    const result = await getDeviceInfo('tenant-1', 'AA:BB:CC:DD:EE:FF');

    expect(result).toEqual(mockDevice);
    expect(prisma.device_mac_addresses.findFirst).toHaveBeenCalledWith({
      where: {
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
      },
    });
  });

  it('returns null when device not found', async () => {
    vi.mocked(prisma.device_mac_addresses.findFirst).mockResolvedValue(null);

    const result = await getDeviceInfo('tenant-1', 'AA:BB:CC:DD:EE:FF');
    expect(result).toBeNull();
  });

  it('normalizes MAC before query', async () => {
    vi.mocked(prisma.device_mac_addresses.findFirst).mockResolvedValue(null);

    await getDeviceInfo('tenant-1', 'aa-bb-cc-dd-ee-ff');

    expect(prisma.device_mac_addresses.findFirst).toHaveBeenCalledWith({
      where: {
        mac_address: 'AA:BB:CC:DD:EE:FF',
        tenant_id: 'tenant-1',
      },
    });
  });
});

// ============================================================================
// deactivateEmployeeMACs
// ============================================================================

describe('deactivateEmployeeMACs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deactivates all MACs for a terminated employee', async () => {
    vi.mocked(prisma.device_mac_addresses.updateMany).mockResolvedValue({ count: 3 } as never);

    await deactivateEmployeeMACs('tenant-1', 'emp-1');

    expect(prisma.device_mac_addresses.updateMany).toHaveBeenCalledWith({
      where: {
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
      },
      data: {
        is_active: false,
      },
    });
  });

  it('does not fail when employee has no MACs', async () => {
    vi.mocked(prisma.device_mac_addresses.updateMany).mockResolvedValue({ count: 0 } as never);

    await expect(
      deactivateEmployeeMACs('tenant-1', 'emp-1')
    ).resolves.not.toThrow();
  });

  // Property: deactivation always scopes to tenant + employee
  it('property: deactivation always scopes to tenant + employee (50 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, async (tenantId, employeeId) => {
        vi.clearAllMocks();
        vi.mocked(prisma.device_mac_addresses.updateMany).mockResolvedValue({
          count: 0,
        } as never);

        await deactivateEmployeeMACs(tenantId, employeeId);

        const calls = vi.mocked(prisma.device_mac_addresses.updateMany).mock.calls;
        const lastCall = calls[calls.length - 1][0];
        expect((lastCall as any).where.tenant_id).toBe(tenantId);
        expect((lastCall as any).where.employee_id).toBe(employeeId);
        expect((lastCall as any).data.is_active).toBe(false);
      }),
      { numRuns: 50 }
    );
  });
});
