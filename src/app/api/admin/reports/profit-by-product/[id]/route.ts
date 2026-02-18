/**
 * Product Profitability Analysis API - GET (análisis por producto)
 * Requirements: 6.2, 6.4, 6.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { ProfitabilityService } from '@/src/core/services/profitability.service';
import { z, ZodError } from 'zod';
import prisma from '@/src/core/db/prisma';
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

const ProductAnalysisQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

type ProductAnalysisQuery = z.infer<typeof ProductAnalysisQuerySchema>;

// ============================================================================
// GET - Análisis Detallado de Producto
// ============================================================================

/**
 * GET /api/admin/reports/profit-by-product/:id
 * 
 * Obtiene un análisis detallado de rentabilidad para un producto específico,
 * incluyendo desglose de receta, ventas por día y métricas financieras.
 * 
 * Path Parameters:
 * - id: ID del producto
 * 
 * Query Parameters:
 * - startDate (opcional): Fecha de inicio en formato ISO 8601
 * - endDate (opcional): Fecha de fin en formato ISO 8601
 * 
 * Response:
 * - 200: Análisis detallado del producto
 * - 400: Parámetros inválidos
 * - 401: No autenticado
 * - 404: Producto no encontrado
 * - 500: Error del servidor
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    // ✅ PASO 3: Obtener ID del producto desde params (await Promise)
    const { id: productId } = await params;
    
    log.info({
      operation: 'get_product_analysis',
      productId,
      tenantId,
    }, 'Obteniendo análisis de producto');
    
    // ✅ PASO 4: Verificar que el producto existe y pertenece al tenant
    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        tenant_id: tenantId,
      },
    });
    
    if (!product) {
      throw new NotFoundError(
        'Producto no encontrado',
        'product',
        productId
      );
    }
    
    // ✅ PASO 5: Parsear y validar query parameters con Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = ProductAnalysisQuerySchema.parse(queryParams);
    
    // ✅ PASO 6: Construir período de análisis
    const period = {
      startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : new Date(0),
      endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : new Date(),
    };
    
    // Validar que startDate <= endDate
    if (period.startDate > period.endDate) {
      throw new ValidationError(
        'La fecha de inicio debe ser anterior o igual a la fecha de fin',
        'startDate',
        { startDate: period.startDate, endDate: period.endDate }
      );
    }
    
    // ✅ PASO 7: Obtener análisis usando ProfitabilityService
    const serviceStart = Date.now();
    const profitabilityService = new ProfitabilityService();
    const analysis = await profitabilityService.getProductAnalysis(
      productId,
      period,
      tenantId
    );
    logPerformance('profitability_service_get_product_analysis', Date.now() - serviceStart, {
      productId,
      tenantId,
    });
    
    log.info({
      operation: 'get_product_analysis_success',
      productId,
      productName: analysis.productName,
      unitsSold: analysis.unitsSold,
      totalProfitCents: analysis.totalProfitCents,
      tenantId,
      durationMs: Date.now() - startTime,
    }, 'Análisis de producto obtenido exitosamente');
    
    return NextResponse.json({
      success: true,
      data: analysis,
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
        operation: 'get_product_analysis_validation_error',
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
        operation: 'get_product_analysis_error',
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
      operation: 'get_product_analysis_error',
      ...errorLog,
      durationMs: Date.now() - startTime,
    }, 'Error al obtener análisis de producto');
    
    return NextResponse.json(
      { error: 'Error al obtener análisis de producto' },
      { status: 500 }
    );
  }
}
