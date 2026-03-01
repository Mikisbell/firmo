/**
 * Cash Alert Service Tests
 *
 * @module core/services/__tests__/cash-alert.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CashAlertService } from '../cash-alert.service';

// ============================================================================
// Mock dependencies
// ============================================================================

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

function createMockPrisma() {
  return {
    tenant_settings: {
      findFirst: vi.fn(),
    },
    shifts: {
      findFirst: vi.fn(),
    },
    alert_events: {
      create: vi.fn(),
    },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: CashAlertService;

const TENANT = 'tenant-1';
const SHIFT_ID = 'shift-1';

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new CashAlertService(mockPrisma as any);
});

// ============================================================================
// checkVariance
// ============================================================================

describe('checkVariance', () => {
  it('debe retornar null si la diferencia está dentro del umbral', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue({
      cash_variance_alert_cents: 2_000,
    });

    const result = await service.checkVariance(
      TENANT, SHIFT_ID, 50_000, 50_500, 'emp-1',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it('debe crear alerta WARNING si supera el umbral', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue({
      cash_variance_alert_cents: 2_000,
    });
    mockPrisma.shifts.findFirst.mockResolvedValue({ terminal_id: 'term-1' });
    mockPrisma.alert_events.create.mockResolvedValue({ id: 'alert-1' });

    const result = await service.checkVariance(
      TENANT, SHIFT_ID, 50_000, 47_000, 'emp-1', // diff = -3000
    );

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.severity).toBe('WARNING');
      expect(result.data.diffCents).toBe(-3_000);
      expect(result.data.alertEventId).toBe('alert-1');
    }
  });

  it('debe crear alerta CRITICAL si supera 5x el umbral', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue({
      cash_variance_alert_cents: 2_000,
    });
    mockPrisma.shifts.findFirst.mockResolvedValue({ terminal_id: 'term-1' });
    mockPrisma.alert_events.create.mockResolvedValue({ id: 'alert-2' });

    const result = await service.checkVariance(
      TENANT, SHIFT_ID, 50_000, 38_000, 'emp-1', // diff = -12000, > 5*2000=10000
    );

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.severity).toBe('CRITICAL');
    }
  });

  it('debe usar umbral default si no hay settings', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue(null);
    mockPrisma.shifts.findFirst.mockResolvedValue({ terminal_id: 'term-1' });
    mockPrisma.alert_events.create.mockResolvedValue({ id: 'alert-3' });

    // Default threshold is 2000 (S/20)
    const result = await service.checkVariance(
      TENANT, SHIFT_ID, 50_000, 47_500, 'emp-1', // diff = -2500 > 2000
    );

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.severity).toBe('WARNING');
      expect(result.data.thresholdCents).toBe(2_000);
    }
  });

  it('debe detectar sobrante (diferencia positiva)', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue({
      cash_variance_alert_cents: 1_000,
    });
    mockPrisma.shifts.findFirst.mockResolvedValue({ terminal_id: 'term-1' });
    mockPrisma.alert_events.create.mockResolvedValue({ id: 'alert-4' });

    const result = await service.checkVariance(
      TENANT, SHIFT_ID, 50_000, 52_500, 'emp-1', // diff = +2500
    );

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.diffCents).toBe(2_500);
    }
  });

  it('no debe fallar si alert_events.create falla', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue({
      cash_variance_alert_cents: 1_000,
    });
    mockPrisma.shifts.findFirst.mockResolvedValue({ terminal_id: 'term-1' });
    mockPrisma.alert_events.create.mockRejectedValue(new Error('DB error'));

    const result = await service.checkVariance(
      TENANT, SHIFT_ID, 50_000, 47_000, 'emp-1',
    );

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.alertEventId).toBeNull();
    }
  });
});

// ============================================================================
// validateOpeningCash
// ============================================================================

describe('validateOpeningCash', () => {
  it('debe aceptar monto dentro del límite', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue({
      max_cash_opening_cents: 50_000,
    });

    const result = await service.validateOpeningCash(TENANT, 30_000);

    expect(result.success).toBe(true);
  });

  it('debe rechazar monto que excede el límite', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue({
      max_cash_opening_cents: 50_000,
    });

    const result = await service.validateOpeningCash(TENANT, 75_000);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CASH_OPENING_TOO_HIGH');
    }
  });

  it('debe usar default si no hay settings', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue(null);

    // Default is 50_000 (S/500)
    const result = await service.validateOpeningCash(TENANT, 60_000);

    expect(result.success).toBe(false);
  });

  it('debe aceptar monto igual al límite', async () => {
    mockPrisma.tenant_settings.findFirst.mockResolvedValue({
      max_cash_opening_cents: 50_000,
    });

    const result = await service.validateOpeningCash(TENANT, 50_000);

    expect(result.success).toBe(true);
  });
});
