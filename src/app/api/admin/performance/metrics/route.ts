/**
 * Performance Metrics API
 * 
 * Endpoint para obtener y resetear métricas de performance del sistema de caché.
 * 
 * Spec: react-cache-optimization
 * Requirements: 3.1, 3.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { perfMonitor } from '@/src/lib/performance-monitor';
import { requestCache } from '@/src/lib/fetch-cache';

/**
 * GET /api/admin/performance/metrics
 * 
 * Obtiene las métricas actuales de performance del sistema de caché.
 * 
 * @returns {object} Métricas de performance
 */
export async function GET(request: NextRequest) {
  // Validar autenticación admin
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    // Obtener métricas del performance monitor
    const metrics = perfMonitor.getMetrics();
    
    // Obtener tamaño del caché
    const cacheSize = requestCache.size();
    
    // Estimar uso de memoria (aproximado)
    const memoryUsage = cacheSize * 1024; // ~1KB por entry (estimado)
    
    return NextResponse.json({
      cacheHitRate: metrics.cacheHitRate,
      avgResponseTime: metrics.avgResponseTime,
      cacheSize,
      memoryUsage,
      totalRequests: metrics.totalRequests,
      cacheHits: metrics.cachedRequests,
      cacheMisses: metrics.totalRequests - metrics.cachedRequests,
      p95ResponseTime: metrics.p95ResponseTime,
      p99ResponseTime: metrics.p99ResponseTime,
    });
  } catch (error) {
    console.error('Error al obtener métricas:', error);
    return NextResponse.json(
      { error: 'Error al obtener métricas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/performance/metrics
 * 
 * Resetea las métricas de performance del sistema de caché.
 * 
 * @returns {object} Confirmación de reset
 */
export async function POST(request: NextRequest) {
  // Validar autenticación admin
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    // Resetear métricas del performance monitor
    perfMonitor.reset();
    
    // Limpiar caché
    requestCache.clear();
    
    return NextResponse.json({
      success: true,
      message: 'Métricas reseteadas exitosamente',
    });
  } catch (error) {
    console.error('Error al resetear métricas:', error);
    return NextResponse.json(
      { error: 'Error al resetear métricas' },
      { status: 500 }
    );
  }
}
