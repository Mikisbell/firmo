import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/src/core/tenant/tenant-context';

/**
 * GET /api/tenant/exports/:id/download
 * Download an export file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const contextResult = await getTenantContext(request);

    if (!contextResult.valid) {
      return contextResult.response;
    }

    const { context } = contextResult;
    const { id: exportId } = await params;

    if (!exportId) {
      return NextResponse.json(
        { error: 'Export ID is required' },
        { status: 400 }
      );
    }

    // In production, fetch export from database and verify ownership
    // For now, return a mock response
    const mockExportUrl = `https://exports.parkpos.local/${exportId}.enc`;

    // Verify export belongs to current tenant
    // This would be done by querying the database

    // Return redirect to download URL
    return NextResponse.redirect(mockExportUrl);
  } catch (error) {
    console.error('Download export failed:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Export not found' },
          { status: 404 }
        );
      }

      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    );
  }
}
