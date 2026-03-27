/**
 * Pollo Control Service Unit Tests
 *
 * Tests para registro de producción, completar cocción,
 * equivalentes en tiempo real, resumen diario, y detección de anomalías.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PolloControlService,
  EXPECTED_YIELD_PERCENT,
  YIELD_RANGE_LOW,
  YIELD_RANGE_HIGH,
  YIELD_CRITICAL_LOW,
  YIELD_CRITICAL_HIGH,
} from '../pollo-control.service';
import type { LogProductionDTO, CompleteProductionDTO } from '@/src/core/admin/schemas/pollo-control.schema';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockTx: any = {
  pollo_production_logs: {
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/src/core/db/transaction', () => ({
  withTransaction: vi.fn(async (_prisma: any, operation: any) => {
    try {
      const result = await operation(mockTx);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error };
    }
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LOCATION_ID = '33333333-4444-5555-6666-777777777777';
const LOG_ID = '44444444-5555-6666-7777-888888888888';
const USER_ID = '99999999-8888-7777-6666-555555555555';

function makeLogInput(overrides?: Partial<LogProductionDTO>): LogProductionDTO {
  return {
    location_id: LOCATION_ID,
    raw_units: 20,
    raw_weight_kg: 50, // 20 pollos × 2.5kg
    notes: 'Lote mañana',
    ...overrides,
  };
}

function makeProductionLogRow(overrides?: Record<string, unknown>) {
  return {
    id: LOG_ID,
    tenant_id: TENANT_ID,
    location_id: LOCATION_ID,
    shift_id: null,
    batch_number: 1,
    raw_units: 20,
    raw_weight_kg: 50,
    cooked_units: null,
    cooked_weight_kg: null,
    yield_percent: null,
    waste_units: null,
    waste_reason: null,
    status: 'CRUDO',
    started_at: new Date('2026-02-20T08:00:00Z'),
    completed_at: null,
    recorded_by: USER_ID,
    notes: 'Lote mañana',
    created_at: new Date('2026-02-20T08:00:00Z'),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('PolloControlService', () => {
  let service: PolloControlService;
  const mockPrisma: any = {
    pollo_production_logs: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PolloControlService(mockPrisma);
  });

  // ==========================================================================
  // Constants
  // ==========================================================================

  describe('constantes de negocio', () => {
    it('rendimiento esperado debe ser 72%', () => {
      expect(EXPECTED_YIELD_PERCENT).toBe(72);
    });

    it('rango normal debe ser 68-76%', () => {
      expect(YIELD_RANGE_LOW).toBe(68);
      expect(YIELD_RANGE_HIGH).toBe(76);
    });

    it('rango crítico debe ser <60% o >85%', () => {
      expect(YIELD_CRITICAL_LOW).toBe(60);
      expect(YIELD_CRITICAL_HIGH).toBe(85);
    });
  });

  // ==========================================================================
  // Log Production
  // ==========================================================================

  describe('logProduction', () => {
    it('debe registrar un nuevo lote con batch_number incrementado', async () => {
      mockPrisma.pollo_production_logs.findFirst.mockResolvedValue({ batch_number: 2 });
      mockTx.pollo_production_logs.create.mockResolvedValue(makeProductionLogRow({ batch_number: 3 }));

      const result = await service.logProduction(TENANT_ID, makeLogInput(), USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batch_number).toBe(3);
        expect(result.data.raw_units).toBe(20);
        expect(result.data.raw_weight_kg).toBe(50);
        expect(result.data.status).toBe('CRUDO');
      }
    });

    it('debe empezar con batch_number 1 si no hay lotes previos', async () => {
      mockPrisma.pollo_production_logs.findFirst.mockResolvedValue(null);
      mockTx.pollo_production_logs.create.mockResolvedValue(makeProductionLogRow({ batch_number: 1 }));

      const result = await service.logProduction(TENANT_ID, makeLogInput(), USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batch_number).toBe(1);
      }
    });
  });

  // ==========================================================================
  // Complete Production
  // ==========================================================================

  describe('completeProduction', () => {
    it('debe completar lote con cálculo de rendimiento', async () => {
      mockPrisma.pollo_production_logs.findFirst.mockResolvedValue(
        makeProductionLogRow({ status: 'CRUDO', raw_weight_kg: 50 }),
      );

      const completeData: CompleteProductionDTO = {
        cooked_units: 19,
        cooked_weight_kg: 36, // 36/50 = 72%
        waste_units: 1,
        waste_reason: 'Quemado',
      };

      mockTx.pollo_production_logs.update.mockResolvedValue(
        makeProductionLogRow({
          status: 'COCIDO',
          cooked_units: 19,
          cooked_weight_kg: 36,
          yield_percent: 72,
          waste_units: 1,
          waste_reason: 'Quemado',
          completed_at: new Date(),
        }),
      );

      const result = await service.completeProduction(TENANT_ID, LOG_ID, completeData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.log.status).toBe('COCIDO');
        expect(result.data.log.yield_percent).toBe(72);
        expect(result.data.anomalies).toHaveLength(0); // 72% está en rango normal
      }
    });

    it('debe detectar rendimiento bajo (WARNING)', async () => {
      mockPrisma.pollo_production_logs.findFirst.mockResolvedValue(
        makeProductionLogRow({ status: 'CRUDO', raw_weight_kg: 50 }),
      );

      // 32.5/50 = 65% → bajo del rango normal pero no crítico
      mockTx.pollo_production_logs.update.mockResolvedValue(
        makeProductionLogRow({ status: 'COCIDO', yield_percent: 65 }),
      );

      const result = await service.completeProduction(TENANT_ID, LOG_ID, {
        cooked_units: 18,
        cooked_weight_kg: 32.5,
        waste_units: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.anomalies.some((a) => a.type === 'RENDIMIENTO' && a.level === 'WARNING')).toBe(true);
      }
    });

    it('debe detectar rendimiento crítico (<60%)', async () => {
      mockPrisma.pollo_production_logs.findFirst.mockResolvedValue(
        makeProductionLogRow({ status: 'CRUDO', raw_weight_kg: 50 }),
      );

      // 27.5/50 = 55% → CRÍTICO
      mockTx.pollo_production_logs.update.mockResolvedValue(
        makeProductionLogRow({ status: 'COCIDO', yield_percent: 55 }),
      );

      const result = await service.completeProduction(TENANT_ID, LOG_ID, {
        cooked_units: 15,
        cooked_weight_kg: 27.5,
        waste_units: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.anomalies.some((a) => a.type === 'RENDIMIENTO' && a.level === 'CRITICAL')).toBe(true);
      }
    });

    it('debe detectar merma alta (>5 unidades = CRITICAL)', async () => {
      mockPrisma.pollo_production_logs.findFirst.mockResolvedValue(
        makeProductionLogRow({ status: 'CRUDO', raw_weight_kg: 50, raw_units: 20 }),
      );

      mockTx.pollo_production_logs.update.mockResolvedValue(
        makeProductionLogRow({ status: 'COCIDO', yield_percent: 72, waste_units: 7 }),
      );

      const result = await service.completeProduction(TENANT_ID, LOG_ID, {
        cooked_units: 13,
        cooked_weight_kg: 36,
        waste_units: 7,
        waste_reason: 'Varios quemados',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.anomalies.some((a) => a.type === 'MERMA' && a.level === 'CRITICAL')).toBe(true);
      }
    });

    it('debe fallar si el lote no existe', async () => {
      mockPrisma.pollo_production_logs.findFirst.mockResolvedValue(null);

      const result = await service.completeProduction(TENANT_ID, 'no-existe', {
        cooked_units: 10,
        cooked_weight_kg: 25,
        waste_units: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('debe fallar si el lote ya fue completado', async () => {
      mockPrisma.pollo_production_logs.findFirst.mockResolvedValue(
        makeProductionLogRow({ status: 'COCIDO' }),
      );

      const result = await service.completeProduction(TENANT_ID, LOG_ID, {
        cooked_units: 10,
        cooked_weight_kg: 25,
        waste_units: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('ALREADY_COMPLETED');
      }
    });
  });

  // ==========================================================================
  // Realtime Equivalents
  // ==========================================================================

  describe('getRealtimeEquivalents', () => {
    it('debe agregar equivalentes de todos los lotes del día', async () => {
      mockPrisma.pollo_production_logs.findMany.mockResolvedValue([
        makeProductionLogRow({ status: 'CRUDO', raw_units: 20 }),
        makeProductionLogRow({
          id: 'other',
          status: 'COCIDO',
          raw_units: 15,
          cooked_units: 14,
          waste_units: 1,
        }),
        makeProductionLogRow({
          id: 'another',
          status: 'COCINANDO',
          raw_units: 10,
        }),
      ]);

      const result = await service.getRealtimeEquivalents(TENANT_ID, LOCATION_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.raw_in_stock).toBe(20);
        expect(result.data.cooking).toBe(10);
        expect(result.data.cooked_available).toBe(14);
        expect(result.data.wasted_today).toBe(1);
        expect(result.data.total_entered_today).toBe(45); // 20 + 15 + 10
      }
    });

    it('debe retornar ceros si no hay lotes hoy', async () => {
      mockPrisma.pollo_production_logs.findMany.mockResolvedValue([]);

      const result = await service.getRealtimeEquivalents(TENANT_ID, LOCATION_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.raw_in_stock).toBe(0);
        expect(result.data.cooking).toBe(0);
        expect(result.data.cooked_available).toBe(0);
        expect(result.data.total_entered_today).toBe(0);
      }
    });
  });

  // ==========================================================================
  // Daily Summary
  // ==========================================================================

  describe('getDailySummary', () => {
    it('debe calcular resumen diario con promedios', async () => {
      mockPrisma.pollo_production_logs.findMany.mockResolvedValue([
        makeProductionLogRow({
          raw_units: 20,
          cooked_units: 19,
          waste_units: 1,
          yield_percent: 72,
        }),
        makeProductionLogRow({
          id: 'other',
          raw_units: 15,
          cooked_units: 14,
          waste_units: 0,
          yield_percent: 74,
        }),
      ]);

      const result = await service.getDailySummary(TENANT_ID, LOCATION_ID, '2026-02-20');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_raw_units).toBe(35);
        expect(result.data.total_cooked_units).toBe(33);
        expect(result.data.total_waste_units).toBe(1);
        expect(result.data.avg_yield_percent).toBe(73); // (72+74)/2
        expect(result.data.business_date).toMatch(/^2026-02-/); // timezone-safe
      }
    });

    it('debe retornar ceros si no hay datos', async () => {
      mockPrisma.pollo_production_logs.findMany.mockResolvedValue([]);

      const result = await service.getDailySummary(TENANT_ID, LOCATION_ID, '2026-02-20');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_raw_units).toBe(0);
        expect(result.data.avg_yield_percent).toBe(0);
      }
    });
  });

  // ==========================================================================
  // Production History
  // ==========================================================================

  describe('getProductionHistory', () => {
    it('debe retornar historial paginado', async () => {
      mockPrisma.pollo_production_logs.findMany.mockResolvedValue([
        makeProductionLogRow(),
      ]);
      mockPrisma.pollo_production_logs.count.mockResolvedValue(1);

      const result = await service.getProductionHistory(TENANT_ID, LOCATION_ID, 1, 20);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(1);
        expect(result.data.total).toBe(1);
      }
    });
  });
});
