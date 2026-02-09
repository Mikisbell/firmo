import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

// Custom error classes
class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ExportError extends Error {
  status = 500;
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

export interface ExportRequest {
  tenant_id: string;
  format: 'json' | 'sql';
  include_events?: boolean;
  include_orders?: boolean;
  include_products?: boolean;
  include_employees?: boolean;
  include_customers?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface ExportResult {
  export_id: string;
  tenant_id: string;
  file_url: string;
  file_size_mb: number;
  expires_at: Date;
  encryption_key: string;
  checksum: string;
}

export interface ExportMetadata {
  export_id: string;
  tenant_id: string;
  exported_at: string;
  format: 'json' | 'sql';
  version: string;
  record_counts: {
    events?: number;
    orders?: number;
    products?: number;
    employees?: number;
    customers?: number;
    stations?: number;
    promotions?: number;
  };
}

/**
 * Validate export request
 */
async function validateExportRequest(request: ExportRequest): Promise<void> {
  if (!request.tenant_id) {
    throw new ValidationError('tenant_id is required');
  }

  if (!['json', 'sql'].includes(request.format)) {
    throw new ValidationError('format must be "json" or "sql"');
  }

  // Verify tenant exists
  const tenant = await prisma.tenant_settings.findUnique({
    where: { tenant_id: request.tenant_id },
  });

  if (!tenant) {
    throw new ValidationError('Tenant not found');
  }

  // Validate date range if provided
  if (request.date_from && request.date_to) {
    const from = new Date(request.date_from);
    const to = new Date(request.date_to);

    if (from > to) {
      throw new ValidationError('date_from must be before date_to');
    }
  }
}

/**
 * Collect all tenant data for export
 */
async function collectExportData(request: ExportRequest): Promise<any> {
  const data: any = {
    export_metadata: {
      export_id: randomUUID(),
      tenant_id: request.tenant_id,
      exported_at: new Date().toISOString(),
      format: request.format,
      version: '1.0',
      record_counts: {},
    },
  };

  // Export tenant settings
  data.tenant_settings = await prisma.tenant_settings.findUnique({
    where: { tenant_id: request.tenant_id },
  });

  // Export catalog
  data.catalog_meta = await prisma.catalog_meta.findUnique({
    where: { tenant_id: request.tenant_id },
  });

  // Export events (if requested)
  if (request.include_events !== false) {
    const where: any = { tenant_id: request.tenant_id };
    if (request.date_from) {
      where.occurred_at = { gte: new Date(request.date_from) };
    }
    if (request.date_to) {
      where.occurred_at = {
        ...where.occurred_at,
        lte: new Date(request.date_to),
      };
    }

    data.events = await prisma.events.findMany({
      where,
      orderBy: { occurred_at: 'asc' },
    });
    data.export_metadata.record_counts.events = data.events.length;
  }

  // Export orders (if requested)
  if (request.include_orders !== false) {
    const where: any = { tenant_id: request.tenant_id };
    if (request.date_from) {
      where.created_at = { gte: new Date(request.date_from) };
    }
    if (request.date_to) {
      where.created_at = {
        ...where.created_at,
        lte: new Date(request.date_to),
      };
    }

    data.orders = await prisma.orders.findMany({
      where,
      include: {
        invoices: true,
      },
      orderBy: { created_at: 'asc' },
    });
    data.export_metadata.record_counts.orders = data.orders.length;
  }

  // Export products (if requested)
  if (request.include_products !== false) {
    data.products = await prisma.products.findMany({
      where: { tenant_id: request.tenant_id, is_active: true },
    });
    data.export_metadata.record_counts.products = data.products.length;
  }

  // Export employees (if requested)
  if (request.include_employees !== false) {
    data.employees = await prisma.employees.findMany({
      where: { tenant_id: request.tenant_id },
      select: {
        id: true,
        tenant_id: true,
        name: true,
        role: true,
        is_active: true,
        created_at: true,
        // Exclude pin_hash for security
      },
    });
    data.export_metadata.record_counts.employees = data.employees.length;
  }

  // Export customers (if requested)
  if (request.include_customers !== false) {
    data.customers = await prisma.customers.findMany({
      where: { tenant_id: request.tenant_id },
    });
    data.export_metadata.record_counts.customers = data.customers.length;
  }

  // Export stations
  data.stations = await prisma.stations.findMany({
    where: { tenant_id: request.tenant_id },
  });
  data.export_metadata.record_counts.stations = data.stations.length;

  // Export promotions
  data.promotions = await prisma.promotions.findMany({
    where: { tenant_id: request.tenant_id },
  });
  data.export_metadata.record_counts.promotions = data.promotions.length;

  return data;
}

/**
 * Validate export data completeness
 */
async function validateExportCompleteness(
  data: any,
  request: ExportRequest
): Promise<void> {
  // Verify all requested data is present
  if (request.include_events && !data.events) {
    throw new ExportError('Events export failed - data missing');
  }

  if (request.include_orders && !data.orders) {
    throw new ExportError('Orders export failed - data missing');
  }

  if (request.include_products && !data.products) {
    throw new ExportError('Products export failed - data missing');
  }

  // Verify data integrity
  if (data.events && data.orders) {
    // Check that all order events reference existing orders
    const orderIds = new Set(data.orders.map((o: any) => o.id));
    const orphanEvents = data.events.filter(
      (e: any) => e.entity_type === 'order' && !orderIds.has(e.entity_id)
    );

    if (orphanEvents.length > 0) {
      console.warn(`Found ${orphanEvents.length} orphan events in export`);
    }
  }

  // Verify required metadata
  if (!data.tenant_settings) {
    throw new ExportError('Tenant settings missing from export');
  }

  // ✅ catalog_meta es opcional - puede no existir para algunos tenants
  // No lanzar error si no existe
}

/**
 * Format data as JSON string
 */
function formatAsJSON(data: any): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Format data as SQL INSERT statements
 */
async function formatAsSQL(data: any): Promise<string> {
  let sql = '-- PARK POS Tenant Export\n';
  sql += `-- Tenant ID: ${data.export_metadata.tenant_id}\n`;
  sql += `-- Exported: ${data.export_metadata.exported_at}\n`;
  sql += `-- Format Version: ${data.export_metadata.version}\n\n`;

  // Generate INSERT statements for each table
  for (const [table, records] of Object.entries(data)) {
    if (table === 'export_metadata' || !Array.isArray(records)) continue;

    sql += `-- Table: ${table}\n`;
    for (const record of records as any[]) {
      const columns = Object.keys(record).join(', ');
      const values = Object.values(record)
        .map((v) => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return v;
        })
        .join(', ');
      sql += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
    }
    sql += '\n';
  }

  return sql;
}

/**
 * Calculate checksum of data
 */
function calculateChecksum(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate encryption key for export
 */
function generateEncryptionKey(): string {
  return randomUUID();
}

/**
 * Encrypt data using simple XOR with key (for Node.js server-side)
 * In production, use proper encryption like AES-256-GCM
 */
function encryptData(data: string, key: string): Buffer {
  // For now, use a simple approach: base64 encode
  // In production, implement proper AES-256-GCM encryption
  const buffer = Buffer.from(data, 'utf-8');
  const keyBuffer = Buffer.from(key, 'utf-8');

  // Simple XOR encryption (NOT for production - just for demo)
  const encrypted = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    encrypted[i] = buffer[i] ^ keyBuffer[i % keyBuffer.length];
  }

  return encrypted;
}

/**
 * Upload export file to storage
 * In production, upload to S3 or similar
 */
async function uploadExport(export_id: string, encrypted: Buffer): Promise<string> {
  // For now, return a mock URL
  // In production, upload to S3 and return the URL
  return `https://exports.parkpos.local/${export_id}.enc`;
}

/**
 * Log export operation
 */
async function logExportOperation(
  export_id: string,
  request: ExportRequest
): Promise<void> {
  // Log to audit trail
  console.log(`Export created: ${export_id} for tenant ${request.tenant_id}`);
}

/**
 * Export tenant data
 */
export async function exportTenantData(request: ExportRequest): Promise<ExportResult> {
  const export_id = randomUUID();

  try {
    // ✅ Validar tenant PRIMERO antes de procesar
    const tenant = await prisma.tenant_settings.findUnique({
      where: { tenant_id: request.tenant_id },
    });
    
    if (!tenant) {
      throw new ValidationError('Tenant not found');
    }

    // Validate request
    await validateExportRequest(request);

    // Collect data
    const data = await collectExportData(request);

    // Validate completeness
    await validateExportCompleteness(data, request);

    // Format data
    const formatted =
      request.format === 'json' ? formatAsJSON(data) : await formatAsSQL(data);

    // Calculate checksum
    const checksum = calculateChecksum(formatted);

    // Encrypt data
    const encryption_key = generateEncryptionKey();
    const encrypted = encryptData(formatted, encryption_key);

    // Upload to storage
    const file_url = await uploadExport(export_id, encrypted);
    const file_size_mb = encrypted.length / (1024 * 1024);

    // Log export operation
    await logExportOperation(export_id, request);

    return {
      export_id,
      tenant_id: request.tenant_id,
      file_url,
      file_size_mb: Math.ceil(file_size_mb),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      encryption_key,
      checksum,
    };
  } catch (error) {
    console.error(`Export failed: ${export_id}`, error);
    throw error;
  }
}

/**
 * Get export metadata
 */
export async function getExportMetadata(export_id: string): Promise<ExportMetadata | null> {
  // In production, fetch from database or storage
  // For now, return null
  return null;
}

/**
 * List exports for a tenant
 */
export async function listTenantExports(
  tenant_id: string,
  limit: number = 50
): Promise<any[]> {
  // In production, query from database
  // For now, return empty array
  return [];
}

/**
 * Delete export
 */
export async function deleteExport(export_id: string): Promise<void> {
  // In production, delete from storage
  console.log(`Export deleted: ${export_id}`);
}
