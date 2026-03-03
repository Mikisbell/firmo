/**
 * SUNAT Test Connection API - POST
 *
 * Tests the SUNAT connection for a tenant's configured provider.
 * Always uses BETA mode (even if tenant is configured for PRODUCTION).
 * Timeout: 15 seconds.
 *
 * Auth: requireAdminPermission('manage_fiscal') — OWNER only.
 *
 * @module app/api/admin/facturacion/test-connection/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/src/core/middleware/admin-permission';
import { InvoiceProviderRouter } from '@/src/core/integrations/sunat/provider-router';
import { pinoLogger } from '@/src/core/observability/logger-pino';

const TEST_CONNECTION_TIMEOUT_MS = 15_000;

export async function POST(request: NextRequest) {
  const authResult = await requireAdminPermission(request, 'manage_fiscal');
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;
  const startTime = Date.now();

  try {
    const providerRouter = new InvoiceProviderRouter();

    // Get provider for tenant
    const providerResult = await providerRouter.getProvider(tenantId);

    if (!providerResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: providerResult.error.message,
          duration_ms: Date.now() - startTime,
          response_code: providerResult.error.code,
        },
        { status: 200 },
      );
    }

    const provider = providerResult.data;

    // Test connection with timeout
    const testPromise = provider.testConnection();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('SUNAT_CONNECTION_TIMEOUT')),
        TEST_CONNECTION_TIMEOUT_MS,
      );
    });

    const testResult = await Promise.race([testPromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;

    // Clear cache after test (forces fresh adapter on next real request)
    providerRouter.clearCache(tenantId);

    if (testResult.success) {
      pinoLogger.info(
        { tenantId, durationMs },
        'SUNAT test connection successful',
      );
      return NextResponse.json({
        success: true,
        message: testResult.data.message,
        duration_ms: durationMs,
      });
    }

    pinoLogger.warn(
      { tenantId, durationMs, code: testResult.error.code },
      'SUNAT test connection failed',
    );
    return NextResponse.json({
      success: false,
      message: testResult.error.message,
      duration_ms: durationMs,
      response_code: testResult.error.code,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (
      error instanceof Error &&
      error.message === 'SUNAT_CONNECTION_TIMEOUT'
    ) {
      pinoLogger.warn(
        { tenantId, durationMs },
        'SUNAT test connection timed out',
      );
      return NextResponse.json({
        success: false,
        message: `La conexión con SUNAT excedió el tiempo límite de ${TEST_CONNECTION_TIMEOUT_MS / 1000} segundos`,
        duration_ms: durationMs,
        response_code: 'SUNAT_CONNECTION_TIMEOUT',
      });
    }

    pinoLogger.error(
      { tenantId, durationMs, error },
      'SUNAT test connection error',
    );
    return NextResponse.json(
      {
        success: false,
        message: 'Error inesperado al probar conexión con SUNAT',
        duration_ms: durationMs,
      },
      { status: 500 },
    );
  }
}
