/**
 * Export Service - Reusable export engine for Excel, CSV, and PDF/HTML
 *
 * Supports:
 * - Excel (XLSX) via exceljs: formatted headers, auto-width, currency formatting
 * - CSV: comma-separated with papaparse-compatible output
 * - PDF (HTML-based): generates printable HTML string
 *
 * All monetary values are received in centavos and formatted as S/ X.XX
 *
 * @module core/services/export.service
 */

import ExcelJS from 'exceljs';

// ============================================================================
// Types
// ============================================================================

export type ColumnFormat = 'text' | 'number' | 'currency' | 'percent' | 'date';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: ColumnFormat;
}

export interface ExcelConfig {
  sheetName: string;
  title?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  footerRow?: Record<string, unknown>;
}

export interface PDFConfig {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  footerRow?: Record<string, unknown>;
  orientation?: 'portrait' | 'landscape';
}

// ============================================================================
// Helpers
// ============================================================================

function centsToSoles(cents: unknown): string {
  if (typeof cents !== 'number' || isNaN(cents)) return 'S/ 0.00';
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function formatPercent(value: unknown): string {
  if (typeof value !== 'number' || isNaN(value)) return '0.00%';
  return `${value.toFixed(2)}%`;
}

function formatCellValue(value: unknown, format?: ColumnFormat): string {
  if (value === null || value === undefined) return '';
  switch (format) {
    case 'currency': return centsToSoles(value);
    case 'percent': return formatPercent(value);
    case 'number': return String(value);
    case 'date':
      if (value instanceof Date) return value.toLocaleDateString('es-PE');
      if (typeof value === 'string') return new Date(value).toLocaleDateString('es-PE');
      return String(value);
    default: return String(value);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Export Service
// ============================================================================

export class ExportService {
  /**
   * Generate an Excel workbook buffer
   */
  async generateExcel(config: ExcelConfig): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FIRMO POS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(config.sheetName);

    let startRow = 1;

    // Title row (merged)
    if (config.title) {
      sheet.mergeCells(1, 1, 1, config.columns.length);
      const titleCell = sheet.getCell(1, 1);
      titleCell.value = config.title;
      titleCell.font = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: 'center' };
      startRow = 3;
    }

    // Header row
    const headerRow = sheet.getRow(startRow);
    config.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF374151' },
      };
      cell.alignment = { horizontal: col.format === 'currency' || col.format === 'number' ? 'right' : 'left' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
    });

    // Set column widths
    config.columns.forEach((col, i) => {
      sheet.getColumn(i + 1).width = col.width || 15;
    });

    // Data rows
    config.rows.forEach((row, rowIdx) => {
      const excelRow = sheet.getRow(startRow + 1 + rowIdx);
      config.columns.forEach((col, colIdx) => {
        const cell = excelRow.getCell(colIdx + 1);
        const rawValue = row[col.key];

        if (col.format === 'currency' && typeof rawValue === 'number') {
          cell.value = rawValue / 100;
          cell.numFmt = '"S/ "#,##0.00';
        } else if (col.format === 'percent' && typeof rawValue === 'number') {
          cell.value = rawValue / 100;
          cell.numFmt = '0.00%';
        } else if (col.format === 'number' && typeof rawValue === 'number') {
          cell.value = rawValue;
          cell.numFmt = '#,##0';
        } else {
          cell.value = rawValue != null ? String(rawValue) : '';
        }

        // Alternate row colors
        if (rowIdx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' },
          };
        }
      });
    });

    // Footer summary row
    if (config.footerRow) {
      const footerExcelRow = sheet.getRow(startRow + 1 + config.rows.length);
      config.columns.forEach((col, colIdx) => {
        const cell = footerExcelRow.getCell(colIdx + 1);
        const rawValue = config.footerRow![col.key];

        cell.font = { bold: true };
        cell.border = {
          top: { style: 'double', color: { argb: 'FF374151' } },
        };

        if (col.format === 'currency' && typeof rawValue === 'number') {
          cell.value = rawValue / 100;
          cell.numFmt = '"S/ "#,##0.00';
        } else if (col.format === 'number' && typeof rawValue === 'number') {
          cell.value = rawValue;
          cell.numFmt = '#,##0';
        } else {
          cell.value = rawValue != null ? String(rawValue) : '';
        }
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate CSV string
   */
  generateCSV(config: { columns: ExportColumn[]; rows: Record<string, unknown>[] }): string {
    const headers = config.columns.map((c) => c.header);
    const dataRows = config.rows.map((row) =>
      config.columns.map((col) => {
        const val = formatCellValue(row[col.key], col.format);
        // Escape commas and quotes in CSV
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }),
    );

    return [headers.join(','), ...dataRows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Generate printable HTML string (for PDF via browser print)
   */
  generatePDFHtml(config: PDFConfig): string {
    const isLandscape = config.orientation === 'landscape';
    const colAlignments = config.columns.map((col) =>
      col.format === 'currency' || col.format === 'number' || col.format === 'percent' ? 'right' : 'left',
    );

    const headerCells = config.columns
      .map((col, i) => `<th style="text-align:${colAlignments[i]};padding:8px 12px;border-bottom:2px solid #374151;font-size:11px;text-transform:uppercase;color:#6B7280;">${escapeHtml(col.header)}</th>`)
      .join('');

    const bodyRows = config.rows
      .map((row, rowIdx) => {
        const bg = rowIdx % 2 === 1 ? 'background:#F9FAFB;' : '';
        const cells = config.columns
          .map((col, i) => {
            const val = formatCellValue(row[col.key], col.format);
            return `<td style="text-align:${colAlignments[i]};padding:6px 12px;border-bottom:1px solid #E5E7EB;font-size:12px;">${escapeHtml(val)}</td>`;
          })
          .join('');
        return `<tr style="${bg}">${cells}</tr>`;
      })
      .join('');

    let footerHtml = '';
    if (config.footerRow) {
      const footerCells = config.columns
        .map((col, i) => {
          const val = formatCellValue(config.footerRow![col.key], col.format);
          return `<td style="text-align:${colAlignments[i]};padding:8px 12px;border-top:2px solid #374151;font-weight:bold;font-size:12px;">${escapeHtml(val)}</td>`;
        })
        .join('');
      footerHtml = `<tfoot><tr>${footerCells}</tr></tfoot>`;
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(config.title)}</title>
  <style>
    @page { size: ${isLandscape ? 'landscape' : 'portrait'}; margin: 15mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 0; padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 4px 0; }
    .subtitle { color: #6B7280; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    .footer { margin-top: 24px; font-size: 10px; color: #9CA3AF; text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(config.title)}</h1>
  ${config.subtitle ? `<p class="subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
    ${footerHtml}
  </table>
  <p class="footer">Generado por FIRMO POS &mdash; ${new Date().toLocaleDateString('es-PE')}</p>
</body>
</html>`;
  }
}

export const exportService = new ExportService();
