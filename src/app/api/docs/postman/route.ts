/**
 * Postman Collection download endpoint
 * 
 * Generates and returns a Postman Collection v2.1 file for API testing
 */

import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/src/lib/openapi/generator';
import { exportToPostman } from '@/src/lib/openapi/postman-exporter';
import { logger } from '@/src/core/observability/structured-logger';

export async function GET() {
  try {
    // Generate OpenAPI spec
    const spec = generateOpenAPISpec();

    // Export to Postman Collection
    const collection = exportToPostman(spec);

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(collection, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="PARK-POS-API.postman_collection.json"',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    logger.error('Error al generar colección Postman', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        error: {
          code: 'POSTMAN_EXPORT_ERROR',
          message: 'Error al generar colección Postman',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
