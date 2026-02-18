/**
 * Profitability Report API - GET (reporte completo)
 * Requirements: 6.1, 6.4, 6.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { ProfitabilityService } from '@/src/core/services/profitability.service';
import { z, ZodError } from 'zod';
import {
  ValidationError,
  NotFoundError,
  CalculationError,
  InfrastructureError,
  getErrorStatusCode,
  formatErrorForLogging,
} from '@/src/core/errors/profitability-errors';

// ============================================================================
// Zod Schema para Validación
// ============================================================================

const ProfitabilityQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  productIds: z.string().optional().transform((val) => val ? val.split(',') : undefined),
  categoryIds: z.string().optional().transform((val) => val ? val.split(',') : undefined),
});

type ProfitabilityQuery = z.infer<typeof ProfitabilityQuerySchema>;

// ============================================================================
// GET - Reporte Completo de Rentabilidad
// ============================================================================

/**
 * GET /api/admin/reports/profitability
 * 
 * Obtiene un reporte completo de rentabilidad con métricas financieras
 * de todos los productos que cumplen con los filtros especificados.
 * 
 * Query Parameters:
 * - startDate (opcional): Fecha de inicio en formato ISO 8601
 * - endDate (opcional): Fecha de fin en formato ISO 8601
 * - productIds (opcional): IDs de productos separados por coma
 * - categoryIds (opcional): IDs de categorías separados por coma
 * 
 * Response:
 * - 200: Reporte completo con productos y resumen
 * - 400: Parámetros inválidos
 * - 401: No autenticado
 * - 500: Error del servidor
 */
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    // ✅ PASO 1: Validar autenticación admin
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // ✅ PASO 2: Usar tenant_id del JWT del usuario autenticado
    const tenantId = authResult.user.tenantId;
    
    log.info({ operation: 'get_profitability_report', tenantId }, 'Obteniendo reporte de rentabilidad');
    
    // ✅ PASO 3: Parsear y validar query parameters con Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = ProfitabilityQuerySchema.parse(queryParams);
    
    // ✅ PASO 4: Construir filtros
    const filters = {
      tenantId,
      startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
      endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined,
      productIds: validatedQuery.productIds,
      categoryIds: validatedQuery.categoryIds,
    };
    
    // Validar que startDate <= endDate
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      throw new ValidationError(
        'La fecha de inicio debe ser anterior o igual a la fecha de fin',
        'startDate',
        { startDate: filters.startDate, endDate: filters.endDate }
      );
    }
    
    // ✅ PASO 5: Obtener reporte usando ProfitabilityService
    const serviceStart = Date.now();
    const profitabilityService = new ProfitabilityService();
    const report = await profitabilityService.getProfitabilityReport(filters);
    logPerformance('profitability_service_get_report', Date.now() - serviceStart, {
      productCount: report.products.length,
      tenantId,
    });
    
    log.info({
      operation: 'get_profitability_report_success',
      productCount: report.products.length,
      totalRevenueCents: report.summary.totalRevenueCents,
      totalProfitCents: report.summary.totalProfitCents,
      tenantId,
      durationMs: Date.now() - startTime,
    }, 'Reporte de rentabilidad obtenido exitosamente');
    
    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    // Manejo de errores de validación Zod
    if (error instanceof ZodError) {
      const validationError = new ValidationError(
        'Parámetros de consulta inválidos',
        error.errors[0]?.path.join('.'),
        error.errors
      );
      
      log.warn({
        operation: 'get_profitability_report_validation_error',
        ...formatErrorForLogging(validationError),
      }, validationError.message);
      
      return NextResponse.json(
        {
          error: validationError.message,
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: validationError.statusCode }
      );
    }
    
    // Manejo de errores personalizados
    if (error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof CalculationError ||
        error instanceof InfrastructureError) {
      
      const statusCode = getErrorStatusCode(error);
      const errorLog = formatErrorForLogging(error);
      
      log.error({
        operation: 'get_profitability_report_error',
        ...errorLog,
        durationMs: Date.now() - startTime,
      }, error.message);
      
      return NextResponse.json(
        { error: error.message },
        { status: statusCode }
      );
    }
    
    // Manejo de errores genéricos
    const errorLog = formatErrorForLogging(error);
    log.error({
      operation: 'get_profitability_report_error',
      ...errorLog,
      durationMs: Date.now() - startTime,
    }, 'Error al obtener reporte de rentabilidad');
    
    return NextResponse.json(
      { error: 'Error al obtener reporte de rentabilidad' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
