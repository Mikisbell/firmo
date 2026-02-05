/**
 * OpenAPI JSON endpoint
 * 
 * Returns the OpenAPI 3.0 specification as JSON
 */

import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/openapi/generator';

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
    console.error('Failed to generate OpenAPI spec:', error);
    
    return NextResponse.json(
      {
        error: {
          code: 'OPENAPI_GENERATION_ERROR',
          message: 'Failed to generate OpenAPI specification',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
