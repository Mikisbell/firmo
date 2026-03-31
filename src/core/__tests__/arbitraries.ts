/**
 * Fast-Check Arbitraries for Property-Based Testing
 * 
 * This file contains reusable arbitraries (generators) for property-based tests.
 * Each arbitrary generates random but valid test data for a specific domain.
 * 
 * Feature: products-p1-improvements
 */

import fc from 'fast-check';

// ============================================================================
// Product Data Arbitraries
// ============================================================================

export const productCategory = fc.constantFrom(
  'POLLOS',
  'PARRILLAS',
  'CRIOLLOS',
  'SALCHIPAPAS',
  'ALITAS',
  'PIQUEOS',
  'BEBIDAS',
  'EXTRAS',
  'POSTRES',
  'COMBOS',
  'GUARNICIONES'
);

export const productStation = fc.constantFrom(
  'PARRILLA',
  'COCINA',
  'BAR',
  'HORNO',
  'POSTRES',
  'EMPAQUE',
  'FRIOS'
);

export const productType = fc.constantFrom('SIMPLE', 'COMBO', 'VARIABLE');

export const productSKU = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

export const productName = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

export const productShortName = fc.option(
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  { nil: undefined }
);

export const productPriceCents = fc.integer({ min: 0, max: 1000000 }); // 0 to 10,000 soles

export const productIsActive = fc.boolean();

export const validProduct = fc.record({
  sku: productSKU,
  name: productName,
  short_name: productShortName,
  price_cents: productPriceCents,
  category: productCategory,
  station: productStation,
  type: productType,
  is_active: productIsActive,
});

// ============================================================================
// CSV Row Arbitraries
// ============================================================================

export const csvPriceDecimal = fc
  .double({ min: 0, max: 10000, noNaN: true })
  .map((n) => n.toFixed(2));

export const csvPriceCentavos = fc.integer({ min: 0, max: 1000000 }).map(String);

export const csvPrice = fc.oneof(csvPriceDecimal, csvPriceCentavos);

export const csvBoolean = fc.constantFrom('true', 'false', 'TRUE', 'FALSE', 'True', 'False');

export const validCSVRow = fc.record({
  sku: productSKU,
  name: productName,
  short_name: fc.option(productName, { nil: '' }),
  price: csvPrice,
  category: productCategory,
  station: productStation,
  type: productType,
  is_active: csvBoolean,
});

export const invalidCSVRow = fc.oneof(
  // Missing SKU
  fc.record({
    sku: fc.constant(''),
    name: productName,
    short_name: fc.constant(''),
    price: csvPrice,
    category: productCategory,
    station: productStation,
    type: productType,
    is_active: csvBoolean,
  }),
  // Missing name
  fc.record({
    sku: productSKU,
    name: fc.constant(''),
    short_name: fc.constant(''),
    price: csvPrice,
    category: productCategory,
    station: productStation,
    type: productType,
    is_active: csvBoolean,
  }),
  // Invalid price
  fc.record({
    sku: productSKU,
    name: productName,
    short_name: fc.constant(''),
    price: fc.constantFrom('invalid', '-100', 'abc'),
    category: productCategory,
    station: productStation,
    type: productType,
    is_active: csvBoolean,
  }),
  // Invalid category
  fc.record({
    sku: productSKU,
    name: productName,
    short_name: fc.constant(''),
    price: csvPrice,
    category: fc.constant('INVALID_CATEGORY'),
    station: productStation,
    type: productType,
    is_active: csvBoolean,
  }),
  // Invalid station
  fc.record({
    sku: productSKU,
    name: productName,
    short_name: fc.constant(''),
    price: csvPrice,
    category: productCategory,
    station: fc.constant('INVALID_STATION'),
    type: productType,
    is_active: csvBoolean,
  })
);

// ============================================================================
// Bulk Operation Arbitraries
// ============================================================================

export const productIds = fc.array(fc.uuid(), { minLength: 1, maxLength: 100 });

export const bulkUpdateFields = fc.record({
  is_active: fc.option(fc.boolean(), { nil: undefined }),
  category: fc.option(productCategory, { nil: undefined }),
  station: fc.option(productStation, { nil: undefined }),
}).filter((updates) => {
  // At least one field must be defined
  return updates.is_active !== undefined || updates.category !== undefined || updates.station !== undefined;
});

export const bulkUpdateRequest = fc.record({
  product_ids: productIds,
  updates: bulkUpdateFields,
});

// ============================================================================
// Image Arbitraries
// ============================================================================

export const imageFormat = fc.constantFrom('image/jpeg', 'image/png', 'image/webp');

export const imageSizeBytes = fc.integer({ min: 1024, max: 5 * 1024 * 1024 }); // 1KB to 5MB

export const imageDimensions = fc.record({
  width: fc.integer({ min: 100, max: 4000 }),
  height: fc.integer({ min: 100, max: 4000 }),
});

export const validImageSpec = fc.record({
  format: imageFormat,
  size: imageSizeBytes,
  width: fc.integer({ min: 100, max: 4000 }),
  height: fc.integer({ min: 100, max: 4000 }),
});

export const invalidImageSpec = fc.oneof(
  // Too large
  fc.record({
    format: imageFormat,
    size: fc.integer({ min: 5 * 1024 * 1024 + 1, max: 10 * 1024 * 1024 }),
    width: fc.integer({ min: 100, max: 4000 }),
    height: fc.integer({ min: 100, max: 4000 }),
  }),
  // Invalid format
  fc.record({
    format: fc.constant('image/gif'),
    size: imageSizeBytes,
    width: fc.integer({ min: 100, max: 4000 }),
    height: fc.integer({ min: 100, max: 4000 }),
  })
);

export const productImageCount = fc.integer({ min: 0, max: 5 });

export const productImage = fc.record({
  id: fc.uuid(),
  url: fc.webUrl().map(url => `${url}/image.webp`),
  thumbnail_url: fc.webUrl().map(url => `${url}/image-thumb.webp`),
  medium_url: fc.webUrl().map(url => `${url}/image-medium.webp`),
  size_bytes: imageSizeBytes,
  format: fc.constant('webp' as const),
  order: fc.integer({ min: 0, max: 4 }),
  uploaded_at: fc.constant(new Date('2025-01-01T00:00:00Z').toISOString()),
  uploaded_by: fc.uuid(),
});

export const productImages = fc.array(productImage, { minLength: 1, maxLength: 5 });

// ============================================================================
// Tenant and User Arbitraries
// ============================================================================

export const tenantId = fc.uuid();

export const userId = fc.uuid();

export const productId = fc.uuid();

// ============================================================================
// Complete Product Data with ID
// ============================================================================

export const productData = fc.record({
  id: fc.uuid(),
  sku: productSKU,
  name: productName,
  short_name: productShortName,
  price_cents: productPriceCents,
  category: productCategory,
  station: productStation,
  type: productType,
  is_active: productIsActive,
});

// ============================================================================
// CSV Row with all fields
// ============================================================================

export const csvRow = fc.record({
  sku: productSKU,
  name: productName,
  short_name: fc.option(productName, { nil: '' }),
  price_cents: productPriceCents,
  category: productCategory,
  station: productStation,
  type: productType,
  is_active: productIsActive,
});

// ============================================================================
// Image-related exports with proper names
// ============================================================================

export const validImageFormat = imageFormat;
export const imageSize = imageSizeBytes;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a CSV string from an array of rows (RFC 4180 compliant).
 *
 * Fields containing comma, double-quote, or newline are wrapped in
 * double-quotes with internal quotes escaped as "".
 */
export function generateCSV(rows: any[]): string {
  if (rows.length === 0) return '';

  const escapeField = (value: unknown): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = Object.keys(rows[0]).map(escapeField).join(',');
  const data = rows
    .map((row) => Object.values(row).map(escapeField).join(','))
    .join('\n');

  return `${headers}\n${data}`;
}

/**
 * Create a mock File object for testing
 */
export function createMockFile(
  name: string,
  size: number,
  type: string,
  content?: string
): File {
  const blob = new Blob([content || 'mock file content'], { type });
  return new File([blob], name, { type });
}
