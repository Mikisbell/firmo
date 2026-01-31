/**
 * API Documentation Route
 * 
 * Serves OpenAPI/Swagger documentation for the PARK POS API
 */

import { NextRequest, NextResponse } from 'next/server';
import DocumentationGenerator from '@/src/lib/api-docs.generator';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const docGenerator = new DocumentationGenerator(prisma);

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
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    }

    // Return OpenAPI JSON
    if (format === 'json') {
      return NextResponse.json(documentation.openapi, {
        headers: {
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
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
          'Access-Control-Allow-Origin': '*',
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
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Documentation generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate documentation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

// Also support OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}