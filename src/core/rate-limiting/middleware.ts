/**
 * Rate Limiting Middleware
 * 
 * Middleware para aplicar rate limiting en endpoints de API.
 * 
 * Features:
 * - Verificación de rate limit por tenant_id
 * - HTTP 429 con header Retry-After
 * - Respuestas estructuradas con error_code
 * - Logging de requests rechazados
 * 
 * @module core/rate-limiting/middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from './rate-limiter';
import { pinoLogger } from '@/src/core/observability/logger-pino';

/**
 * Código de error para rate limiting
 */
export enum RateLimitErrorCode {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  BURST_LIMIT_EXCEEDED = 'BURST_LIMIT_EXCEEDED',
}

/**
 * Respuesta de error de rate limiting
 */
interface RateLimitErrorResponse {
  accepted: false;
  error: {
    error_code: RateLimitErrorCode;
    severity: 'WARN';
    message: string;
    user_action: string;
    retryable: true;
    context: {
      current_count: number;
      limit: number;
      retry_after: number;
      limit_type: 'normal' | 'burst';
    };
  };
}

/**
 * Middleware de rate limiting para Next.js API routes
 * 
 * Uso:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResponse = await rateLimitMiddleware(request);
 *   if (rateLimitResponse) {
 *     return rateLimitResponse;
 *   }
 *   
 *   // Continuar con el procesamiento normal
 *   // ...
 * }
 * ```
 */
export async function rateLimitMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    // Obtener tenant_id del body
    const body = await request.json();
    const tenantId = body.tenant_id;

    if (!tenantId) {
      pinoLogger.warn('Rate limit: tenant_id missing in request');
      return NextResponse.json(
        {
          accepted: false,
          error: {
            error_code: 'INVALID_REQUEST',
            severity: 'ERROR',
            message: 'Se requiere tenant_id',
            user_action: 'Incluya tenant_id en el cuerpo de la solicitud',
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    // Verificar rate limit
    const result = await rateLimiter.checkLimit(tenantId);

    if (!result.allowed) {
      // Rate limit excedido
      const errorCode =
        result.limitType === 'burst'
          ? RateLimitErrorCode.BURST_LIMIT_EXCEEDED
          : RateLimitErrorCode.RATE_LIMIT_EXCEEDED;

      const errorResponse: RateLimitErrorResponse = {
        accepted: false,
        error: {
          error_code: errorCode,
          severity: 'WARN',
          message:
            result.limitType === 'burst'
              ? 'Límite de ráfaga excedido'
              : 'Límite de solicitudes excedido',
          user_action: `Espere ${result.retryAfter} segundo(s) antes de reintentar`,
          retryable: true,
          context: {
            current_count: result.currentCount,
            limit: result.limit,
            retry_after: result.retryAfter || 1,
            limit_type: result.limitType,
          },
        },
      };

      pinoLogger.warn(
        {
          tenantId,
          currentCount: result.currentCount,
          limit: result.limit,
          limitType: result.limitType,
        },
        'Rate limit: Request rejected'
      );

      return NextResponse.json(errorResponse, {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter || 1),
        },
      });
    }

    // Rate limit OK, continuar
    pinoLogger.debug(
      {
        tenantId,
        currentCount: result.currentCount,
        limit: result.limit,
      },
      'Rate limit: Request allowed'
    );

    return null; // Continuar con el procesamiento normal
  } catch (error) {
    // Error en rate limiting, permitir el request
    pinoLogger.error(
      { error },
      'Rate limit: Error in middleware, allowing request'
    );
    return null;
  }
}

/**
 * Helper para crear request con body parseado
 * (Next.js no permite leer el body múltiples veces)
 */
export async function withRateLimit(
  request: NextRequest,
  handler: (body: any) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Leer body una sola vez
    const body = await request.json();

    // Verificar tenant_id
    const tenantId = body.tenant_id;
    if (!tenantId) {
      return NextResponse.json(
        {
          accepted: false,
          error: {
            error_code: 'INVALID_REQUEST',
            severity: 'ERROR',
            message: 'Se requiere tenant_id',
            user_action: 'Incluya tenant_id en el cuerpo de la solicitud',
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    // Verificar rate limit
    const result = await rateLimiter.checkLimit(tenantId);

    if (!result.allowed) {
      // Rate limit excedido
      const errorCode =
        result.limitType === 'burst'
          ? RateLimitErrorCode.BURST_LIMIT_EXCEEDED
          : RateLimitErrorCode.RATE_LIMIT_EXCEEDED;

      const errorResponse: RateLimitErrorResponse = {
        accepted: false,
        error: {
          error_code: errorCode,
          severity: 'WARN',
          message:
            result.limitType === 'burst'
              ? 'Límite de ráfaga excedido'
              : 'Límite de solicitudes excedido',
          user_action: `Espere ${result.retryAfter} segundo(s) antes de reintentar`,
          retryable: true,
          context: {
            current_count: result.currentCount,
            limit: result.limit,
            retry_after: result.retryAfter || 1,
            limit_type: result.limitType,
          },
        },
      };

      return NextResponse.json(errorResponse, {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter || 1),
        },
      });
    }

    // Rate limit OK, ejecutar handler con body
    return await handler(body);
  } catch (error) {
    pinoLogger.error({ error }, 'Rate limit: Error in withRateLimit');
    return NextResponse.json(
      {
        accepted: false,
        error: {
          error_code: 'INTERNAL_ERROR',
          severity: 'ERROR',
          message: 'Error interno del servidor',
          user_action: 'Reintente la solicitud',
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}
