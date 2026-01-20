/**
 * Rate Limit Response Helper
 * Facilita el uso del rate limiting en endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, RateLimitConfig, getRetryAfterSeconds } from '@/src/core/middleware/rate-limit';

/**
 * Aplica rate limiting y retorna respuesta 429 si se excede
 * Retorna null si el request está permitido
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const result = await rateLimit(request, config);

  // Si está permitido, retornar null (continuar con el request)
  if (result.allowed) {
    return null;
  }

  // Si excede el límite, retornar respuesta 429
  const retryAfter = getRetryAfterSeconds(result.resetAt);

  return NextResponse.json(
    {
      error: 'Demasiados intentos. Por favor intenta nuevamente más tarde.',
      retryAfter: `${retryAfter} segundos`,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
        'Retry-After': String(retryAfter),
      },
    }
  );
}

/**
 * Configuraciones predefinidas de rate limiting
 */
export const RATE_LIMIT_CONFIGS = {
  // Para endpoints de autenticación (más restrictivo)
  AUTH: { maxRequests: 5, windowMs: 60000 }, // 5 req/min
  
  // Para endpoints de creación/modificación
  MUTATION: { maxRequests: 10, windowMs: 60000 }, // 10 req/min
  
  // Para endpoints de eliminación (más restrictivo)
  DELETE: { maxRequests: 5, windowMs: 60000 }, // 5 req/min
  
  // Para endpoints de lectura (más permisivo)
  READ: { maxRequests: 30, windowMs: 60000 }, // 30 req/min
  
  // Para endpoints públicos
  PUBLIC: { maxRequests: 20, windowMs: 60000 }, // 20 req/min
};
