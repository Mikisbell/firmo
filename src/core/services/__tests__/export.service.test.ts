/**
 * Export Service Tests
 *
 * Tests for Excel (XLSX), CSV, and PDF/HTML generation.
 * Verifies formatting, currency conversion, edge cases.
 *
 * @module core/services/__tests__/export.service.test
 */

import { describe, it, expect } from 'vitest';
import { ExportService } from '../export.service';
import type { ExportColumn, ExcelConfig, PDFConfig } from '../export.service';

const service = new ExportService();

const sampleColumns: ExportColumn[] = [
  { header: 'Nombre', key: 'name', width: 25, format: 'text' },
  { header: 'Órdenes', key: 'orders', width: 10, format: 'number' },
  { header: 'Ventas', key: 'salesCents', width: 15, format: 'currency' },
  { header: 'Margen', key: 'margin', width: 10, format: 'percent' },
];

const sampleRows = [
  { name: 'Juan Pérez', orders: 45, salesCents: 125000, margin: 32.5 },
  { name: 'María García', orders: 38, salesCents: 98000, margin: 28.1 },
  { name: 'Carlos López', orders: 52, salesCents: 156000, margin: 35.7 },
];

const footerRow = { name: 'TOTAL', orders: 135, salesCents: 379000, margin: 32.1 };

// ============================================================================
// Excel Generation
// ============================================================================

describe('ExportService - Excel', () => {
  it('debe generar un Buffer válido', async () => {
    const config: ExcelConfig = {
      sheetName: 'Ranking',
      columns: sampleColumns,
      rows: sampleRows,
    };

    const buffer = await service.generateExcel(config);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('debe generar Excel con título', async () => {
    const config: ExcelConfig = {
      sheetName: 'Ranking',
      title: 'Ranking Meseros - Febrero 2026',
      columns: sampleColumns,
      rows: sampleRows,
    };

    const buffer = await service.generateExcel(config);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('debe generar Excel con footer summary', async () => {
    const config: ExcelConfig = {
      sheetName: 'Ranking',
      columns: sampleColumns,
      rows: sampleRows,
      footerRow,
    };

    const buffer = await service.generateExcel(config);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('debe manejar datos vacíos', async () => {
    const config: ExcelConfig = {
      sheetName: 'Vacío',
      columns: sampleColumns,
      rows: [],
    };

    const buffer = await service.generateExcel(config);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('debe manejar valores null/undefined en celdas', async () => {
    const config: ExcelConfig = {
      sheetName: 'Nulls',
      columns: sampleColumns,
      rows: [{ name: null, orders: undefined, salesCents: 0, margin: null }],
    };

    const buffer = await service.generateExcel(config);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('debe generar Excel con una sola fila', async () => {
    const config: ExcelConfig = {
      sheetName: 'Single',
      columns: sampleColumns,
      rows: [sampleRows[0]],
    };

    const buffer = await service.generateExcel(config);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('debe generar Excel con dataset grande (100 filas)', async () => {
    const largeRows = Array.from({ length: 100 }, (_, i) => ({
      name: `Mesero ${i + 1}`,
      orders: Math.floor(Math.random() * 100),
      salesCents: Math.floor(Math.random() * 500000),
      margin: Math.random() * 50,
    }));

    const config: ExcelConfig = {
      sheetName: 'Grande',
      columns: sampleColumns,
      rows: largeRows,
    };

    const buffer = await service.generateExcel(config);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('debe generar Excel con una sola columna', async () => {
    const config: ExcelConfig = {
      sheetName: 'One Col',
      columns: [{ header: 'Nombre', key: 'name', format: 'text' }],
      rows: [{ name: 'Test' }],
    };

    const buffer = await service.generateExcel(config);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

// ============================================================================
// CSV Generation
// ============================================================================

describe('ExportService - CSV', () => {
  it('debe generar CSV con headers y datos', () => {
    const csv = service.generateCSV({ columns: sampleColumns, rows: sampleRows });

    const lines = csv.split('\n');
    expect(lines[0]).toBe('Nombre,Órdenes,Ventas,Margen');
    expect(lines.length).toBe(4); // header + 3 rows
  });

  it('debe formatear moneda como S/ en CSV', () => {
    const csv = service.generateCSV({ columns: sampleColumns, rows: sampleRows });

    const lines = csv.split('\n');
    // First data row: 125000 cents → "S/ 1250.00"
    expect(lines[1]).toContain('S/ 1250.00');
  });

  it('debe formatear porcentaje en CSV', () => {
    const csv = service.generateCSV({ columns: sampleColumns, rows: sampleRows });

    const lines = csv.split('\n');
    expect(lines[1]).toContain('32.50%');
  });

  it('debe escapar comas en valores', () => {
    const csv = service.generateCSV({
      columns: [{ header: 'Nombre', key: 'name', format: 'text' }],
      rows: [{ name: 'García, Juan' }],
    });

    const lines = csv.split('\n');
    expect(lines[1]).toBe('"García, Juan"');
  });

  it('debe escapar comillas dobles en valores', () => {
    const csv = service.generateCSV({
      columns: [{ header: 'Desc', key: 'desc', format: 'text' }],
      rows: [{ desc: 'Pollo "especial"' }],
    });

    const lines = csv.split('\n');
    expect(lines[1]).toBe('"Pollo ""especial"""');
  });

  it('debe manejar datos vacíos', () => {
    const csv = service.generateCSV({ columns: sampleColumns, rows: [] });

    const lines = csv.split('\n');
    expect(lines.length).toBe(1); // header only
    expect(lines[0]).toBe('Nombre,Órdenes,Ventas,Margen');
  });

  it('debe manejar valores null/undefined', () => {
    const csv = service.generateCSV({
      columns: sampleColumns,
      rows: [{ name: null, orders: undefined, salesCents: 0, margin: null }],
    });

    const lines = csv.split('\n');
    expect(lines.length).toBe(2);
    // Null/undefined → empty string for text, S/ 0.00 for currency, 0.00% for percent
    expect(lines[1]).toContain('S/ 0.00');
  });

  it('debe generar CSV con 0 centavos correctamente', () => {
    const csv = service.generateCSV({
      columns: [{ header: 'Monto', key: 'amount', format: 'currency' }],
      rows: [{ amount: 0 }, { amount: 1 }, { amount: 100 }],
    });

    const lines = csv.split('\n');
    expect(lines[1]).toBe('S/ 0.00');
    expect(lines[2]).toBe('S/ 0.01');
    expect(lines[3]).toBe('S/ 1.00');
  });
});

// ============================================================================
// PDF/HTML Generation
// ============================================================================

describe('ExportService - PDF HTML', () => {
  it('debe generar HTML válido con título', () => {
    const config: PDFConfig = {
      title: 'Ranking Meseros',
      columns: sampleColumns,
      rows: sampleRows,
    };

    const html = service.generatePDFHtml(config);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Ranking Meseros');
    expect(html).toContain('<table');
    expect(html).toContain('</table>');
  });

  it('debe incluir subtítulo cuando se proporciona', () => {
    const config: PDFConfig = {
      title: 'Ranking',
      subtitle: 'Periodo: Febrero 2026',
      columns: sampleColumns,
      rows: sampleRows,
    };

    const html = service.generatePDFHtml(config);
    expect(html).toContain('Periodo: Febrero 2026');
  });

  it('debe formatear moneda en HTML', () => {
    const config: PDFConfig = {
      title: 'Test',
      columns: sampleColumns,
      rows: sampleRows,
    };

    const html = service.generatePDFHtml(config);
    expect(html).toContain('S/ 1250.00'); // 125000 cents
  });

  it('debe formatear porcentaje en HTML', () => {
    const config: PDFConfig = {
      title: 'Test',
      columns: sampleColumns,
      rows: sampleRows,
    };

    const html = service.generatePDFHtml(config);
    expect(html).toContain('32.50%');
  });

  it('debe incluir footer con totales', () => {
    const config: PDFConfig = {
      title: 'Test',
      columns: sampleColumns,
      rows: sampleRows,
      footerRow,
    };

    const html = service.generatePDFHtml(config);
    expect(html).toContain('<tfoot>');
    expect(html).toContain('TOTAL');
    expect(html).toContain('S/ 3790.00'); // 379000 cents
  });

  it('debe soportar orientación landscape', () => {
    const config: PDFConfig = {
      title: 'Test',
      columns: sampleColumns,
      rows: sampleRows,
      orientation: 'landscape',
    };

    const html = service.generatePDFHtml(config);
    expect(html).toContain('landscape');
  });

  it('debe escapar caracteres HTML en datos', () => {
    const config: PDFConfig = {
      title: 'Test <script>',
      columns: [{ header: 'Nombre', key: 'name', format: 'text' }],
      rows: [{ name: '<script>alert("xss")</script>' }],
    };

    const html = service.generatePDFHtml(config);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('debe manejar datos vacíos en HTML', () => {
    const config: PDFConfig = {
      title: 'Vacío',
      columns: sampleColumns,
      rows: [],
    };

    const html = service.generatePDFHtml(config);
    expect(html).toContain('<tbody></tbody>');
    expect(html).toContain('Vacío');
  });

  it('debe incluir headers de columna', () => {
    const config: PDFConfig = {
      title: 'Test',
      columns: sampleColumns,
      rows: sampleRows,
    };

    const html = service.generatePDFHtml(config);
    expect(html).toContain('Nombre');
    expect(html).toContain('Órdenes');
    expect(html).toContain('Ventas');
    expect(html).toContain('Margen');
  });

  it('debe incluir footer de PARK POS', () => {
    const config: PDFConfig = {
      title: 'Test',
      columns: sampleColumns,
      rows: sampleRows,
    };

    const html = service.generatePDFHtml(config);
    expect(html).toContain('PARK POS');
  });

  it('debe alinear columnas numéricas a la derecha', () => {
    const config: PDFConfig = {
      title: 'Test',
      columns: sampleColumns,
      rows: sampleRows,
    };

    const html = service.generatePDFHtml(config);
    // Currency and number columns should be right-aligned
    expect(html).toContain('text-align:right');
  });
});
