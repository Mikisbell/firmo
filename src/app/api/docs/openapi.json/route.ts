/**
 * OpenAPI JSON endpoint
 * 
 * Returns the OpenAPI 3.0 specification as JSON
 */

import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/src/lib/openapi/generator';
import { logger } from '@/src/core/observability/structured-logger';

export async function GET() {
  try {
    const spec = generateOpenAPISpec();
    
    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    logger.error('Error al generar especificación OpenAPI', error instanceof Error ? error : new Error(String(error)));
    
    return NextResponse.json(
      {
        error: {
          code: 'OPENAPI_GENERATION_ERROR',
          message: 'Error al generar especificación OpenAPI',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
