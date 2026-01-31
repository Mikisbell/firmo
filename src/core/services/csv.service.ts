/**
 * CSV Service
 * Handles CSV import/export for products with validation and upsert logic
 * 
 * Features:
 * - CSV export with all product fields
 * - CSV parsing and validation
 * - CSV import with upsert logic (update existing, create new)
 * - Batch processing (50 rows per batch)
 * - Duplicate SKU detection
 * - Price conversion (decimal → centavos)
 * - Template generation
 * 
 * Requirements: 3.1-3.13, 6.1-6.9
 * Properties: 23-33
 */

import Papa from 'papaparse';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { cache } from '@/src/core/cache/redis.service';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';

const BATCH_SIZE = 50; // For bulk updates
const CSV_IMPORT_BATCH_SIZE = 100; // Larger batches for CSV imports (better performance)

/**
 * CSV Row Interface
 */
export interface CSVProductRow {
  sku: string;
  name: string;
  short_name?: string;
  price: string | number; // Can be decimal string or number
  category: string;
  station: string;
  type: string;
  is_active: string | boolean; // Can be "true"/"false" or boolean
}

/**
 * CSV Export Options
 */
export interface CSVExportOptions {
  includeInactive?: boolean;
  category?: string;
  station?: string;
}

/**
 * CSV Import Result
 */
export interface CSVImportResult {
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  errors: Array<{
    row: number;
    sku?: string;
    error: string;
  }>;
  duration_ms: number;
}

/**
 * CSV Validation Error
 */
export interface CSVValidationError {
  row: number;
  field?: string;
  error: string;
}

/**
 * Valid Categories
 */
const VALID_CATEGORIES = ['POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS', 'POSTRES', 'COMBOS', 'GUARNICIONES'];

/**
 * Valid Stations
 */
const VALID_STATIONS = ['PARRILLA', 'COCINA', 'BAR', 'HORNO', 'POSTRES', 'EMPAQUE', 'FRIOS'];

/**
 * Valid Product Types
 */
const VALID_TYPES = ['SIMPLE', 'COMBO', 'VARIABLE'];

/**
 * CSV Service
 */
export class CSVService {
  /**
   * Export products to CSV
   * 
   * @param tenantId - Tenant ID for isolation
   * @param options - Export options (filters)
   * @returns CSV string
   */
  async exportToCSV(
    tenantId: string,
    options: CSVExportOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    const log = createRequestLogger(randomUUID(), 'csv-export');

    log.info({
      operation: 'csv_export',
      options,
    }, 'Starting CSV export');

    // Build query filters
    const where: any = { tenant_id: tenantId };
    
    if (options.includeInactive === false) {
      where.is_active = true;
    }
    
    if (options.category) {
      where.category = options.category;
    }
    
    if (options.station) {
      where.station = options.station;
    }

    // Fetch products
    const products = await prisma.products.findMany({
      where,
      select: {
        sku: true,
        name: true,
        short_name: true,
        price_cents: true,
        category: true,
        station: true,
        type: true,
        is_active: true,
      },
      orderBy: {
        sku: 'asc',
      },
    });

    // Convert to CSV rows
    const rows = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      short_name: p.short_name || '',
      price: p.price_cents, // Keep as centavos integer
      category: p.category,
      station: p.station,
      type: p.type,
      is_active: p.is_active ? 'true' : 'false',
    }));

    // Generate CSV
    const csv = Papa.unparse(rows, {
      header: true,
      columns: ['sku', 'name', 'short_name', 'price', 'category', 'station', 'type', 'is_active'],
    });

    const duration = Date.now() - startTime;
    logPerformance('csv_export', duration, {
      productCount: products.length,
    });

    log.info({
      operation: 'csv_export_complete',
      productCount: products.length,
      duration_ms: duration,
    }, 'CSV export completed');

    return csv;
  }

  /**
   * Parse CSV string
   * 
   * @param csvContent - CSV string content
   * @returns Parsed rows and validation errors
   */
  parseCSV(csvContent: string): {
    rows: CSVProductRow[];
    errors: CSVValidationError[];
  } {
    const errors: CSVValidationError[] = [];
    const rows: CSVProductRow[] = [];

    // Parse CSV
    const result = Papa.parse<CSVProductRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    // Validate headers
    const requiredHeaders = ['sku', 'name', 'price', 'category', 'station', 'type'];
    const headers = result.meta.fields || [];
    
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      errors.push({
        row: 0,
        error: `Missing required headers: ${missingHeaders.join(', ')}`,
      });
      return { rows: [], errors };
    }

    // Validate each row
    const skuSet = new Set<string>();
    
    result.data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because: 1-indexed + header row
      const rowErrors: string[] = [];

      // Validate SKU
      if (!row.sku || row.sku.trim() === '') {
        rowErrors.push('SKU is required');
      } else if (skuSet.has(row.sku)) {
        rowErrors.push(`Duplicate SKU: ${row.sku}`);
      } else {
        skuSet.add(row.sku);
      }

      // Validate name
      if (!row.name || row.name.trim() === '') {
        rowErrors.push('Name is required');
      }

      // Validate price
      const price = typeof row.price === 'string' ? parseFloat(row.price) : row.price;
      if (isNaN(price) || price < 0) {
        rowErrors.push('Price must be a positive number');
      }

      // Validate category
      if (!VALID_CATEGORIES.includes(row.category)) {
        rowErrors.push(`Invalid category: ${row.category}. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
      }

      // Validate station
      if (!VALID_STATIONS.includes(row.station)) {
        rowErrors.push(`Invalid station: ${row.station}. Must be one of: ${VALID_STATIONS.join(', ')}`);
      }

      // Validate type
      if (!VALID_TYPES.includes(row.type)) {
        rowErrors.push(`Invalid type: ${row.type}. Must be one of: ${VALID_TYPES.join(', ')}`);
      }

      // If errors, add to errors array
      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          error: rowErrors.join('; '),
        });
      } else {
        // Valid row, add to rows array
        rows.push(row);
      }
    });

    return { rows, errors };
  }

  /**
   * Bulk import batch using createMany for performance
   * Reduces queries from 4N to ~4 (where N = batch size)
   * 
   * @param batch - Array of CSV rows to import
   * @param tenantId - Tenant ID for isolation
   * @param userId - User ID for audit trail
   * @returns Import counts
   * @private
   */
  private async bulkImportBatch(
    batch: CSVProductRow[],
    tenantId: string,
    userId: string
  ): Promise<{ created: number; updated: number; skipped: number; errors: Array<{ sku: string; error: string }> }> {
    const errors: Array<{ sku: string; error: string }> = [];
    
    try {
      // Get existing products by SKU
      const skus = batch.map(r => r.sku);
      const existingProducts = await prisma.products.findMany({
        where: {
          tenant_id: tenantId,
          sku: { in: skus },
        },
        select: {
          id: true,
          sku: true,
        },
      });

      const existingSkuMap = new Map(existingProducts.map(p => [p.sku, p.id]));

      // Separate into creates and updates
      const toCreate: any[] = [];
      const toUpdate: any[] = [];

      for (const row of batch) {
        try {
          // Convert price to centavos
          const priceDecimal = typeof row.price === 'string' ? parseFloat(row.price) : row.price;
          const priceCents = Math.round(priceDecimal);

          // Convert is_active to boolean
          const isActive = row.is_active === 'true' || row.is_active === true;

          const productData = {
            sku: row.sku.trim(),
            name: row.name.trim(),
            short_name: row.short_name?.trim() || null,
            price_cents: priceCents,
            category: row.category,
            station: row.station,
            type: row.type,
            is_active: isActive,
            tenant_id: tenantId,
            updated_at: new Date(),
          };

          const existingId = existingSkuMap.get(row.sku);

          if (existingId) {
            toUpdate.push({ id: existingId, ...productData });
          } else {
            toCreate.push({
              id: randomUUID(),
              ...productData,
              version: 1,
              created_at: new Date(),
            });
          }
        } catch (error) {
          errors.push({
            sku: row.sku,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Execute bulk operations in transaction
      await prisma.$transaction(async (tx) => {
        // Bulk create new products
        if (toCreate.length > 0) {
          await tx.products.createMany({
            data: toCreate,
            skipDuplicates: false,
          });
        }

        // Bulk update existing products (Prisma doesn't have updateMany with different data per row,
        // so we need to do individual updates, but within a transaction)
        for (const update of toUpdate) {
          const { id, ...data } = update;
          await tx.products.update({
            where: { id },
            data: {
              ...data,
              version: { increment: 1 },
            },
          });
        }
      });

      return {
        created: toCreate.length,
        updated: toUpdate.length,
        skipped: errors.length,
        errors,
      };
    } catch (error) {
      // Batch-level error - mark all as skipped
      return {
        created: 0,
        updated: 0,
        skipped: batch.length,
        errors: batch.map(row => ({
          sku: row.sku,
          error: error instanceof Error ? error.message : 'Batch processing failed',
        })),
      };
    }
  }

  /**
   * Import products from CSV
   * 
   * @param csvContent - CSV string content
   * @param tenantId - Tenant ID for isolation
   * @param userId - User ID for audit trail
   * @returns Import result with counts and errors
   */
  async importFromCSV(
    csvContent: string,
    tenantId: string,
    userId: string
  ): Promise<CSVImportResult> {
    const startTime = Date.now();
    const requestId = randomUUID();
    const log = createRequestLogger(requestId, userId);

    log.info({
      operation: 'csv_import',
    }, 'Starting CSV import');

    // Parse and validate CSV
    const { rows, errors } = this.parseCSV(csvContent);

    if (errors.length > 0 && rows.length === 0) {
      // All rows invalid, return early
      return {
        total_rows: 0,
        created_count: 0,
        updated_count: 0,
        skipped_count: 0,
        errors: errors.map(e => ({
          row: e.row,
          error: e.error,
        })),
        duration_ms: Date.now() - startTime,
      };
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const importErrors: Array<{ row: number; sku?: string; error: string }> = [];

    // Process in batches (larger batches for CSV imports)
    const batches = this.createBatches(rows, CSV_IMPORT_BATCH_SIZE);

    for (const batch of batches) {
      const batchStart = Date.now();

      // Use bulk import for better performance
      const result = await this.bulkImportBatch(batch, tenantId, userId);
      
      createdCount += result.created;
      updatedCount += result.updated;
      skippedCount += result.skipped;
      
      // Add errors with row numbers
      result.errors.forEach(err => {
        const rowIndex = rows.findIndex(r => r.sku === err.sku);
        importErrors.push({
          row: rowIndex >= 0 ? rowIndex + 2 : 0,
          sku: err.sku,
          error: err.error,
        });
      });

      logPerformance('csv_import_batch', Date.now() - batchStart, {
        batchSize: batch.length,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
      });
    }

    // Increment catalog version
    await prisma.catalog_meta.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        catalog_version: 1,
        updated_at: new Date(),
      },
      update: {
        catalog_version: { increment: 1 },
        updated_at: new Date(),
      },
    });

    // Invalidate cache
    await cache.invalidatePattern('products:*');

    // Create audit log (only if userId is valid UUID)
    if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      try {
        await prisma.admin_access_logs.create({
          data: {
            id: randomUUID(),
            tenant_id: tenantId,
            employee_id: userId,
            action: 'CSV_IMPORT',
            resource: 'products',
            metadata: {
              total_rows: rows.length,
              created_count: createdCount,
              updated_count: updatedCount,
              skipped_count: skippedCount,
              error_count: importErrors.length,
            },
            created_at: new Date(),
          },
        });
      } catch (error) {
        log.warn({
          operation: 'csv_import_audit_error',
          error: error instanceof Error ? error.message : String(error),
        }, 'Failed to create audit log');
      }
    }

    const duration = Date.now() - startTime;
    const result: CSVImportResult = {
      total_rows: rows.length,
      created_count: createdCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      errors: [...errors.map(e => ({ row: e.row, error: e.error })), ...importErrors],
      duration_ms: duration,
    };

    log.info({
      operation: 'csv_import_complete',
      result,
    }, 'CSV import completed');

    logPerformance('csv_import_total', duration, {
      totalRows: rows.length,
      createdCount,
      updatedCount,
      skippedCount,
    });

    return result;
  }

  /**
   * Generate CSV template
   * 
   * @returns CSV template string with headers and example rows
   */
  generateTemplate(): string {
    const exampleRows = [
      {
        sku: 'POLLO-1/4',
        name: '1/4 de Pollo a la Brasa',
        short_name: '1/4 Pollo',
        price: 1500, // centavos
        category: 'POLLOS',
        station: 'PARRILLA',
        type: 'SIMPLE',
        is_active: 'true',
      },
      {
        sku: 'COMBO-FAM',
        name: 'Combo Familiar',
        short_name: 'Combo Fam',
        price: 5500,
        category: 'COMBOS',
        station: 'PARRILLA',
        type: 'COMBO',
        is_active: 'true',
      },
      {
        sku: 'INCA-KOLA-1.5L',
        name: 'Inca Kola 1.5L',
        short_name: 'Inca 1.5L',
        price: 500,
        category: 'BEBIDAS',
        station: 'BAR',
        type: 'SIMPLE',
        is_active: 'true',
      },
    ];

    return Papa.unparse(exampleRows, {
      header: true,
      columns: ['sku', 'name', 'short_name', 'price', 'category', 'station', 'type', 'is_active'],
    });
  }

  /**
   * Create batches from array
   * @private
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

/**
 * Singleton instance
 */
export const csvService = new CSVService();
