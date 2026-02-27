/**
 * Postman Collection download endpoint
 * 
 * Generates and returns a Postman Collection v2.1 file for API testing
 */

import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/src/lib/openapi/generator';
import { exportToPostman } from '@/src/lib/openapi/postman-exporter';

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
    console.error('Failed to generate Postman collection:', error instanceof Error ? error.message : String(error));

    return NextResponse.json(
      {
        error: {
          code: 'POSTMAN_EXPORT_ERROR',
          message: 'Failed to generate Postman collection',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
