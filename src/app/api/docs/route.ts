/**
 * API Documentation Route
 *
 * Serves OpenAPI/Swagger documentation for the PARK POS API
 */

import { NextRequest, NextResponse } from 'next/server';
import DocumentationGenerator from '@/src/lib/api-docs.generator';
import prisma from '@/src/core/db/prisma';

const docGenerator = new DocumentationGenerator(prisma);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS?.split(',')[0] || 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '3600',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'html';

    const documentation = await docGenerator.exportDocumentation();

    // Return HTML documentation by default
    if (format === 'html') {
      return new NextResponse(documentation.swaggerHTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          ...CORS_HEADERS,
        },
      });
    }

    // Return OpenAPI JSON
    if (format === 'json') {
      return NextResponse.json(documentation.openapi, {
        headers: {
          'Cache-Control': 'public, max-age=3600',
          ...CORS_HEADERS,
        },
      });
    }

    // Return specific schema
    if (format === 'schemas') {
      return NextResponse.json({
        schemas: documentation.openapi.components.schemas,
      }, {
        headers: {
          'Cache-Control': 'public, max-age=3600',
          ...CORS_HEADERS,
        },
      });
    }

    // Invalid format
    return NextResponse.json(
      {
        error: 'Invalid format parameter. Use: html, json, or schemas',
        availableFormats: ['html', 'json', 'schemas'],
      },
      {
        status: 400,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    console.error('Documentation generation error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to generate documentation' },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}
