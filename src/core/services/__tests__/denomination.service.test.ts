/**
 * Denomination Service Tests
 *
 * @module core/services/__tests__/denomination.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DenominationService } from '../denomination.service';

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    shifts: {
      findFirst: vi.fn(),
    },
    shift_denominations: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: DenominationService;

const TENANT = 'tenant-1';
const SHIFT_ID = 'shift-1';

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new DenominationService(mockPrisma as any);
});

// ============================================================================
// saveCounts
// ============================================================================

describe('saveCounts', () => {
  it('debe guardar denominaciones válidas', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue({ id: SHIFT_ID, tenant_id: TENANT });
    mockPrisma.shift_denominations.upsert.mockResolvedValue({});

    const counts = {
      10_000: 2,  // 2x S/100 = S/200
      5_000: 1,   // 1x S/50  = S/50
      100: 5,     // 5x S/1   = S/5
    };

    const result = await service.saveCounts(TENANT, SHIFT_ID, counts);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.grandTotalCents).toBe(25_500); // 20000 + 5000 + 500
      expect(result.data.counts).toHaveLength(3);
      expect(result.data.shiftId).toBe(SHIFT_ID);
    }
  });

  it('debe rechazar turno no encontrado', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue(null);

    const result = await service.saveCounts(TENANT, 'nonexistent', { 10_000: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('debe rechazar denominaciones inválidas', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue({ id: SHIFT_ID, tenant_id: TENANT });

    const counts = { 999: 1 }; // 999 no es denominación PEN

    const result = await service.saveCounts(TENANT, SHIFT_ID, counts);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('inválidas');
    }
  });

  it('debe rechazar cantidades negativas', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue({ id: SHIFT_ID, tenant_id: TENANT });

    const counts = { 10_000: -1 };

    const result = await service.saveCounts(TENANT, SHIFT_ID, counts);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('negativa');
    }
  });

  it('debe ignorar denominaciones con cantidad 0', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue({ id: SHIFT_ID, tenant_id: TENANT });
    mockPrisma.shift_denominations.upsert.mockResolvedValue({});

    const counts = {
      10_000: 1,
      5_000: 0,   // Should be skipped
    };

    const result = await service.saveCounts(TENANT, SHIFT_ID, counts);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts).toHaveLength(1);
      expect(result.data.grandTotalCents).toBe(10_000);
    }
  });

  it('debe llamar upsert para cada denominación con cantidad > 0', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue({ id: SHIFT_ID, tenant_id: TENANT });
    mockPrisma.shift_denominations.upsert.mockResolvedValue({});

    const counts = {
      20_000: 1,  // S/200
      500: 3,     // S/5 x3
    };

    await service.saveCounts(TENANT, SHIFT_ID, counts);

    expect(mockPrisma.shift_denominations.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.shift_denominations.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shift_id_face_value: { shift_id: SHIFT_ID, face_value: 20_000 } },
        create: expect.objectContaining({
          face_value: 20_000,
          count: 1,
          total_cents: 20_000,
        }),
      }),
    );
  });
});

// ============================================================================
// getCounts
// ============================================================================

describe('getCounts', () => {
  it('debe retornar conteos guardados', async () => {
    mockPrisma.shift_denominations.findMany.mockResolvedValue([
      { face_value: 10_000, count: 5, total_cents: 50_000 },
      { face_value: 500, count: 10, total_cents: 5_000 },
    ]);

    const result = await service.getCounts(TENANT, SHIFT_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts).toHaveLength(2);
      expect(result.data.grandTotalCents).toBe(55_000);
      expect(result.data.counts[0].label).toBe('S/ 100');
    }
  });

  it('debe retornar vacío si no hay conteos', async () => {
    mockPrisma.shift_denominations.findMany.mockResolvedValue([]);

    const result = await service.getCounts(TENANT, SHIFT_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts).toHaveLength(0);
      expect(result.data.grandTotalCents).toBe(0);
    }
  });
});
