/**
 * Rate Limiting Middleware
 * Protege contra brute force y DoS attacks
 * 
 * Uso:
 * const result = await rateLimit(request, { maxRequests: 10, windowMs: 60000 });
 * if (!result.allowed) return NextResponse.json({ error: '...' }, { status: 429 });
 */

import { NextRequest } from 'next/server';

export interface RateLimitConfig {
  maxRequests: number;  // Máximo de requests permitidos
  windowMs: number;     // Ventana de tiempo en milisegundos
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// Map para almacenar contadores por IP + endpoint
const requestCounts = new Map<string, RateLimitEntry>();

/**
 * Aplica rate limiting a un request
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Obtener IP del request
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // Crear key única por IP + endpoint
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();

  // Limpiar entradas expiradas (cada 1000 requests)
  if (requestCounts.size > 1000) {
    cleanupExpiredEntries(now);
  }

  // Obtener o crear entrada
  let entry = requestCounts.get(key);
  
  if (!entry || entry.resetAt < now) {
    // Crear nueva entrada
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    requestCounts.set(key, entry);
  }

  // Incrementar contador
  entry.count++;

  // Verificar si excede el límite
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Limpia entradas expiradas del Map
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of requestCounts.entries()) {
    if (entry.resetAt < now) {
      requestCounts.delete(key);
    }
  }
}

/**
 * Obtiene el tiempo restante hasta el reset en segundos
 */
export function getRetryAfterSeconds(resetAt: number): number {
  return Math.ceil((resetAt - Date.now()) / 1000);
}

/**
 * Limpia todos los contadores (útil para testing)
 */
export function clearRateLimitCounters(): void {
  requestCounts.clear();
}
