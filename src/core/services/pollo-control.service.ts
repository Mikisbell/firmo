/**
 * Pollo Control Service - Dashboard de Control de Pollo
 *
 * Tracking en tiempo real de equivalentes de pollo entero:
 * crudo → cocinando → cocido → vendido, con detección de merma y anomalías.
 *
 * Reglas de negocio:
 * - Rendimiento esperado: 72% (2.5kg crudo → 1.8kg cocido)
 * - Rango verde (normal): 68-76%
 * - Rango rojo (sospechoso): <60% o >85%
 * - Aderezo: 20L balde → 300 pollos = 0.0667 L/pollo
 * - Merma = cocido_disponible - vendido - desperdicio (debe ser ≈0)
 *
 * @module core/services/pollo-control.service
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, NotFoundError } from '@/src/core/result';
import { withTransaction } from '@/src/core/db/transaction';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import prisma from '@/src/core/db/prisma';
import type { LogProductionDTO, CompleteProductionDTO } from '@/src/core/admin/schemas/pollo-control.schema';

// ============================================================================
// Constants
// ============================================================================

/** Rendimiento esperado crudo → cocido */
export const EXPECTED_YIELD_PERCENT = 72;

/** Rango normal de rendimiento */
export const YIELD_RANGE_LOW = 68;
export const YIELD_RANGE_HIGH = 76;

/** Rango crítico (posible fraude o error) */
export const YIELD_CRITICAL_LOW = 60;
export const YIELD_CRITICAL_HIGH = 85;

/** Aderezo: litros por pollo */
export const ADEREZO_LITERS_PER_CHICKEN = 0.0667;

// ============================================================================
// Types
// ============================================================================

export type AnomalyLevel = 'OK' | 'WARNING' | 'CRITICAL';

export interface Anomaly {
  type: string;
  level: AnomalyLevel;
  message: string;
  value: number;
  expected?: number;
}

export interface ProductionLog {
  id: string;
  batch_number: number;
  raw_units: number;
  raw_weight_kg: number;
  cooked_units: number | null;
  cooked_weight_kg: number | null;
  yield_percent: number | null;
  waste_units: number | null;
  waste_reason: string | null;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  recorded_by: string;
  notes: string | null;
}

export interface RealtimeEquivalents {
  raw_in_stock: number;
  cooking: number;
  cooked_available: number;
  sold_today: number;
  wasted_today: number;
  total_entered_today: number;
}

export interface DailySummaryResult {
  business_date: string;
  total_raw_units: number;
  total_cooked_units: number;
  total_sold_units: number;
  total_waste_units: number;
  unaccounted_units: number;
  avg_yield_percent: number;
  anomalies: Anomaly[];
}

// ============================================================================
// PolloControlService
// ============================================================================

export class PolloControlService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // Log Production (registrar lote de pollos crudos)
  // ==========================================================================

  async logProduction(
    tenantId: string,
    data: LogProductionDTO,
    userId: string,
  ): Promise<Result<ProductionLog, DomainError>> {
    // Obtener próximo batch_number del día
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastBatch = await this.prisma.pollo_production_logs.findFirst({
      where: {
        tenant_id: tenantId,
        location_id: data.location_id,
        created_at: { gte: today },
      },
      orderBy: { batch_number: 'desc' },
      select: { batch_number: true },
    });

    const batchNumber = (lastBatch?.batch_number ?? 0) + 1;
    const logId = uuidv4();

    const txResult = await withTransaction(this.prisma, async (tx) => {
      const log = await tx.pollo_production_logs.create({
        data: {
          id: logId,
          tenant_id: tenantId,
          location_id: data.location_id,
          shift_id: data.shift_id ?? null,
          batch_number: batchNumber,
          raw_units: data.raw_units,
          raw_weight_kg: data.raw_weight_kg,
          status: 'CRUDO',
          recorded_by: userId,
          notes: data.notes ?? null,
        },
      });
      return log;
    });

    if (!txResult.success) {
      pinoLogger.error({ error: txResult.error, tenantId }, 'Error logging production');
      return err(new DomainError('Error al registrar producción', 'LOG_PRODUCTION_FAILED'));
    }

    pinoLogger.info({ logId, tenantId, batchNumber, rawUnits: data.raw_units }, 'Production batch logged');

    return ok(this.toProductionLog(txResult.data));
  }

  // ==========================================================================
  // Complete Production (registrar resultado de cocción)
  // ==========================================================================

  async completeProduction(
    tenantId: string,
    logId: string,
    data: CompleteProductionDTO,
  ): Promise<Result<{ log: ProductionLog; anomalies: Anomaly[] }, DomainError>> {
    const existing = await this.prisma.pollo_production_logs.findFirst({
      where: { id: logId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Registro de producción', logId));
    }

    if (existing.status === 'COCIDO' || existing.status === 'SERVIDO') {
      return err(new DomainError('Este lote ya fue completado', 'ALREADY_COMPLETED'));
    }

    // Calcular rendimiento
    const rawWeightKg = Number(existing.raw_weight_kg);
    const cookedWeightKg = data.cooked_weight_kg;
    const yieldPercent = rawWeightKg > 0
      ? Math.round((cookedWeightKg / rawWeightKg) * 10000) / 100
      : 0;

    const txResult = await withTransaction(this.prisma, async (tx) => {
      const log = await tx.pollo_production_logs.update({
        where: { id: logId },
        data: {
          cooked_units: data.cooked_units,
          cooked_weight_kg: data.cooked_weight_kg,
          yield_percent: yieldPercent,
          waste_units: data.waste_units ?? 0,
          waste_reason: data.waste_reason ?? null,
          status: 'COCIDO',
          completed_at: new Date(),
        },
      });
      return log;
    });

    if (!txResult.success) {
      pinoLogger.error({ error: txResult.error, tenantId, logId }, 'Error completing production');
      return err(new DomainError('Error al completar producción', 'COMPLETE_PRODUCTION_FAILED'));
    }

    // Detectar anomalías
    const anomalies = this.detectAnomalies(yieldPercent, data.waste_units ?? 0, Number(existing.raw_units));

    pinoLogger.info(
      { logId, tenantId, yieldPercent, anomalies: anomalies.length },
      'Production batch completed',
    );

    return ok({
      log: this.toProductionLog(txResult.data),
      anomalies,
    });
  }

  // ==========================================================================
  // Realtime Equivalents
  // ==========================================================================

  async getRealtimeEquivalents(
    tenantId: string,
    locationId: string,
  ): Promise<Result<RealtimeEquivalents, DomainError>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const logs = await this.prisma.pollo_production_logs.findMany({
        where: {
          tenant_id: tenantId,
          location_id: locationId,
          created_at: { gte: today },
        },
        select: {
          raw_units: true,
          cooked_units: true,
          waste_units: true,
          status: true,
        },
      });

      let rawInStock = 0;
      let cooking = 0;
      let cookedAvailable = 0;
      let wastedToday = 0;
      let totalEnteredToday = 0;

      for (const log of logs) {
        const rawUnits = Number(log.raw_units);
        totalEnteredToday += rawUnits;

        switch (log.status) {
          case 'CRUDO':
            rawInStock += rawUnits;
            break;
          case 'COCINANDO':
            cooking += rawUnits;
            break;
          case 'COCIDO':
          case 'SERVIDO':
            cookedAvailable += Number(log.cooked_units ?? 0);
            wastedToday += Number(log.waste_units ?? 0);
            break;
        }
      }

      // TODO: En el futuro, calcular sold_today desde órdenes con productos de pollo
      const soldToday = 0;

      return ok({
        raw_in_stock: rawInStock,
        cooking,
        cooked_available: cookedAvailable,
        sold_today: soldToday,
        wasted_today: wastedToday,
        total_entered_today: totalEnteredToday,
      });
    } catch (error) {
      pinoLogger.error({ error, tenantId, locationId }, 'Error getting realtime equivalents');
      return err(new DomainError('Error al obtener equivalentes en tiempo real', 'REALTIME_FAILED'));
    }
  }

  // ==========================================================================
  // Daily Summary
  // ==========================================================================

  async getDailySummary(
    tenantId: string,
    locationId: string,
    date?: string,
  ): Promise<Result<DailySummaryResult, DomainError>> {
    const businessDate = date ? new Date(date) : new Date();
    businessDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(businessDate);
    nextDay.setDate(nextDay.getDate() + 1);

    try {
      const logs = await this.prisma.pollo_production_logs.findMany({
        where: {
          tenant_id: tenantId,
          location_id: locationId,
          created_at: { gte: businessDate, lt: nextDay },
        },
      });

      let totalRaw = 0;
      let totalCooked = 0;
      let totalWaste = 0;
      let yieldSum = 0;
      let yieldCount = 0;

      for (const log of logs) {
        totalRaw += Number(log.raw_units);
        if (log.cooked_units != null) {
          totalCooked += Number(log.cooked_units);
        }
        if (log.waste_units != null) {
          totalWaste += Number(log.waste_units);
        }
        if (log.yield_percent != null) {
          yieldSum += Number(log.yield_percent);
          yieldCount++;
        }
      }

      const avgYield = yieldCount > 0 ? Math.round((yieldSum / yieldCount) * 100) / 100 : 0;
      // TODO: Calcular sold_today desde órdenes
      const totalSold = 0;
      const unaccounted = totalCooked - totalSold - totalWaste;

      const anomalies = this.detectAnomalies(avgYield, totalWaste, totalRaw);

      return ok({
        business_date: businessDate.toISOString().split('T')[0],
        total_raw_units: totalRaw,
        total_cooked_units: totalCooked,
        total_sold_units: totalSold,
        total_waste_units: totalWaste,
        unaccounted_units: unaccounted,
        avg_yield_percent: avgYield,
        anomalies,
      });
    } catch (error) {
      pinoLogger.error({ error, tenantId, locationId }, 'Error getting daily summary');
      return err(new DomainError('Error al obtener resumen diario', 'DAILY_SUMMARY_FAILED'));
    }
  }

  // ==========================================================================
  // Production History
  // ==========================================================================

  async getProductionHistory(
    tenantId: string,
    locationId?: string,
    page = 1,
    limit = 20,
  ): Promise<Result<{ data: ProductionLog[]; total: number }, DomainError>> {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (locationId) where.location_id = locationId;

    try {
      const [logs, total] = await Promise.all([
        this.prisma.pollo_production_logs.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        this.prisma.pollo_production_logs.count({ where }),
      ]);

      return ok({
        data: logs.map((l: any) => this.toProductionLog(l)),
        total,
      });
    } catch (error) {
      pinoLogger.error({ error, tenantId }, 'Error getting production history');
      return err(new DomainError('Error al obtener historial', 'HISTORY_FAILED'));
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private detectAnomalies(yieldPercent: number, wasteUnits: number, rawUnits: number): Anomaly[] {
    const anomalies: Anomaly[] = [];

    if (yieldPercent > 0) {
      // Rendimiento
      if (yieldPercent < YIELD_CRITICAL_LOW || yieldPercent > YIELD_CRITICAL_HIGH) {
        anomalies.push({
          type: 'RENDIMIENTO',
          level: 'CRITICAL',
          message: yieldPercent < YIELD_CRITICAL_LOW
            ? `Rendimiento muy bajo: ${yieldPercent}% (esperado ${EXPECTED_YIELD_PERCENT}%)`
            : `Rendimiento anormalmente alto: ${yieldPercent}% (posible error de medición)`,
          value: yieldPercent,
          expected: EXPECTED_YIELD_PERCENT,
        });
      } else if (yieldPercent < YIELD_RANGE_LOW || yieldPercent > YIELD_RANGE_HIGH) {
        anomalies.push({
          type: 'RENDIMIENTO',
          level: 'WARNING',
          message: `Rendimiento fuera de rango normal: ${yieldPercent}% (esperado ${YIELD_RANGE_LOW}-${YIELD_RANGE_HIGH}%)`,
          value: yieldPercent,
          expected: EXPECTED_YIELD_PERCENT,
        });
      }
    }

    // Merma
    if (wasteUnits > 5) {
      anomalies.push({
        type: 'MERMA',
        level: 'CRITICAL',
        message: `Merma alta: ${wasteUnits} unidades`,
        value: wasteUnits,
      });
    } else if (wasteUnits > 2) {
      anomalies.push({
        type: 'MERMA',
        level: 'WARNING',
        message: `Merma elevada: ${wasteUnits} unidades`,
        value: wasteUnits,
      });
    }

    return anomalies;
  }

  private toProductionLog(data: any): ProductionLog {
    return {
      id: data.id,
      batch_number: data.batch_number,
      raw_units: Number(data.raw_units),
      raw_weight_kg: Number(data.raw_weight_kg),
      cooked_units: data.cooked_units != null ? Number(data.cooked_units) : null,
      cooked_weight_kg: data.cooked_weight_kg != null ? Number(data.cooked_weight_kg) : null,
      yield_percent: data.yield_percent != null ? Number(data.yield_percent) : null,
      waste_units: data.waste_units != null ? Number(data.waste_units) : null,
      waste_reason: data.waste_reason ?? null,
      status: data.status,
      started_at: data.started_at,
      completed_at: data.completed_at ?? null,
      recorded_by: data.recorded_by,
      notes: data.notes ?? null,
    };
  }
}

// Singleton
export const polloControlService = new PolloControlService(prisma);
