/**
 * RFM Worker - Tests
 *
 * Tests for RFM classification and worker execution.
 *
 * @module core/jobs/__tests__/rfm-worker.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { classifyRfm, RfmWorker } from '../rfm-worker';

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

vi.mock('@/src/core/observability/logger-pino', () => {
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), child: vi.fn() };
  logger.child.mockReturnValue(logger);
  return { pinoLogger: logger };
});

// ============================================================================
// classifyRfm
// ============================================================================

describe('classifyRfm', () => {
  it('classifies VIP correctly', () => {
    expect(classifyRfm(5, 10, 20000)).toBe('VIP');
  });

  it('classifies FRECUENTE correctly', () => {
    expect(classifyRfm(10, 5, 3000)).toBe('FRECUENTE');
  });

  it('classifies NUEVO correctly', () => {
    expect(classifyRfm(15, 1, 2000)).toBe('NUEVO');
  });

  it('classifies EN_RIESGO correctly', () => {
    expect(classifyRfm(45, 0, 0)).toBe('EN_RIESGO');
  });

  it('classifies DORMIDO correctly', () => {
    expect(classifyRfm(90, 0, 0)).toBe('DORMIDO');
  });

  it('classifies REGULAR for middle-ground customers', () => {
    expect(classifyRfm(20, 3, 8000)).toBe('REGULAR');
  });

  it('handles null values (no data)', () => {
    expect(classifyRfm(null, null, null)).toBe('DORMIDO');
  });
});

// ============================================================================
// Property tests
// ============================================================================

describe('classifyRfm property tests', () => {
  const VALID_SEGMENTS = ['VIP', 'FRECUENTE', 'NUEVO', 'EN_RIESGO', 'DORMIDO', 'REGULAR'];

  it('always returns a valid segment label', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 365 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (recency, frequency, monetary) => {
          const segment = classifyRfm(recency, frequency, monetary);
          expect(VALID_SEGMENTS).toContain(segment);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('null inputs always produce a valid segment', () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 365 }), { nil: undefined }),
        fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
        fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: undefined }),
        (recency, frequency, monetary) => {
          const segment = classifyRfm(
            recency ?? null,
            frequency ?? null,
            monetary ?? null,
          );
          expect(VALID_SEGMENTS).toContain(segment);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('high recency always produces DORMIDO or EN_RIESGO', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 61, max: 365 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (recency, frequency, monetary) => {
          const segment = classifyRfm(recency, frequency, monetary);
          expect(segment).toBe('DORMIDO');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// RfmWorker
// ============================================================================

describe('RfmWorker', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      tenants: {
        findMany: vi.fn().mockResolvedValue([
          { id: '11111111-1111-1111-1111-111111111111' },
        ]),
      },
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    };
  });

  it('processes all active tenants', async () => {
    const worker = new RfmWorker(prisma);
    const result = await worker.computeAll();

    expect(result.tenants_processed).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2); // metrics + classify
  });

  it('captures errors per tenant without failing', async () => {
    prisma.$queryRawUnsafe.mockRejectedValue(new Error('DB error'));

    const worker = new RfmWorker(prisma);
    const result = await worker.computeAll();

    expect(result.tenants_processed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('DB error');
  });

  it('returns 0 when no tenants', async () => {
    prisma.tenants.findMany.mockResolvedValue([]);

    const worker = new RfmWorker(prisma);
    const result = await worker.computeAll();

    expect(result.tenants_processed).toBe(0);
    expect(result.customers_updated).toBe(0);
  });
});
