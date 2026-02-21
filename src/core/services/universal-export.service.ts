/**
 * Universal Export Service
 *
 * Exports any registered entity in xlsx, csv, or pdf format.
 * Uses ExportService for file generation and export-config for entity definitions.
 *
 * @module core/services/universal-export.service
 */

import type { PrismaClient } from '@prisma/client';
import { ExportService } from './export.service';
import { getExportConfig, type ExportFilters } from './export-config';

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

// Content type mapping
const CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  pdf: 'text/html; charset=utf-8',
};

// ============================================================================
// Service
// ============================================================================

export class UniversalExportService {
  private exportService = new ExportService();

  constructor(private prisma: PrismaClient) {}

  async exportEntity(
    tenantId: string,
    entityKey: string,
    format: ExportFormat,
    filters?: ExportFilters,
  ): Promise<Result<ExportResult>> {
    // Validate entity
    const config = getExportConfig(entityKey);
    if (!config) {
      return { success: false, error: { message: `Entidad no soportada: ${entityKey}` } };
    }

    // Validate format
    if (!CONTENT_TYPES[format]) {
      return { success: false, error: { message: `Formato no soportado: ${format}` } };
    }

    // Fetch data
    const rows = await config.queryFn(this.prisma, tenantId, filters);

    // Generate date for filename
    const dateStr = new Date().toISOString().split('T')[0];
    const ext = format === 'pdf' ? 'html' : format;
    const filename = `${entityKey}_${dateStr}.${ext}`;

    let buffer: Buffer;

    switch (format) {
      case 'xlsx': {
        buffer = await this.exportService.generateExcel({
          sheetName: config.label,
          title: config.label,
          columns: config.columns,
          rows,
        });
        break;
      }
      case 'csv': {
        const csvString = this.exportService.generateCSV({
          columns: config.columns,
          rows,
        });
        buffer = Buffer.from(csvString, 'utf-8');
        break;
      }
      case 'pdf': {
        const html = this.exportService.generatePDFHtml({
          title: config.label,
          subtitle: filters?.start && filters?.end
            ? `Período: ${filters.start} al ${filters.end}`
            : undefined,
          columns: config.columns,
          rows,
          orientation: config.columns.length > 5 ? 'landscape' : 'portrait',
        });
        buffer = Buffer.from(html, 'utf-8');
        break;
      }
    }

    return {
      success: true,
      data: {
        buffer,
        filename,
        contentType: CONTENT_TYPES[format],
      },
    };
  }
}
