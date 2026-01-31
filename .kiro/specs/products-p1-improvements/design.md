# Design Document: Products P1 Improvements

## Overview

This design document specifies the technical implementation for three high-impact improvements to the PARK POS Admin Panel Products page: image management, bulk operations, and CSV import/export. These features will elevate the product management experience from 4/5 to 5/5 by dramatically improving productivity, reducing errors, and matching industry standards.

### Goals

1. **Image Management**: Enable visual product identification through drag-and-drop image uploads with automatic optimization
2. **Bulk Operations**: Allow administrators to update multiple products simultaneously, reducing manual work by 95%
3. **CSV Import/Export**: Facilitate data migration, backups, and bulk editing through spreadsheet software

### Non-Goals

- Product variants (different sizes/options) - deferred to P2
- Barcode scanning - deferred to P2
- Advanced image editing (cropping, filters) - out of scope
- Real-time collaborative editing - out of scope

### Success Metrics

- Time to create product: 2 min → 1 min (-50%)
- Time to update 50 products: 100 min → 5 min (-95%)
- Data entry errors: 5% → 1% (-80%)
- User satisfaction: 7/10 → 9/10 (+28%)

---

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Panel (Browser)                    │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ Image Upload   │  │ Bulk Actions   │  │ CSV Import/   │ │
│  │ Component      │  │ Toolbar        │  │ Export        │ │
│  └────────┬───────┘  └────────┬───────┘  └───────┬───────┘ │
└───────────┼──────────────────┼──────────────────┼──────────┘
            │                  │                  │
            ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                        │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ /api/admin/    │  │ /api/admin/    │  │ /api/admin/   │ │
│  │ products/      │  │ products/bulk  │  │ products/     │ │
│  │ images         │  │                │  │ import-export │ │
│  └────────┬───────┘  └────────┬───────┘  └───────┬───────┘ │
└───────────┼──────────────────┼──────────────────┼──────────┘
            │                  │                  │
            ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ Image Service  │  │ Bulk Service   │  │ CSV Service   │ │
│  │ - Upload       │  │ - Validate     │  │ - Parse       │ │
│  │ - Optimize     │  │ - Transaction  │  │ - Validate    │ │
│  │ - Delete       │  │ - Audit        │  │ - Transform   │ │
│  └────────┬───────┘  └────────┬───────┘  └───────┬───────┘ │
└───────────┼──────────────────┼──────────────────┼──────────┘
            │                  │                  │
            ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data & Storage Layer                      │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ Supabase       │  │ PostgreSQL     │  │ Redis Cache   │ │
│  │ Storage        │  │ (Prisma)       │  │               │ │
│  │ - Images       │  │ - products     │  │ - Invalidate  │ │
│  │ - Thumbnails   │  │ - audit_logs   │  │               │ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Next.js 15 API Routes, Prisma ORM
- **Storage**: Supabase Storage (images), PostgreSQL (metadata)
- **Image Processing**: Sharp library (resize, optimize, convert to WEBP)
- **CSV Processing**: PapaParse library (parse/generate CSV)
- **Validation**: Zod schemas
- **Caching**: Redis (product list cache invalidation)
- **Observability**: Pino logger, custom metrics

---

## Components and Interfaces

### 1. Image Upload Component

**Location**: `src/app/admin/productos/components/ImageUpload.tsx`

**Props Interface**:
```typescript
interface ImageUploadProps {
  productId?: string;           // Undefined for new products
  existingImages?: ProductImage[];
  maxImages?: number;           // Default: 5
  maxSizeBytes?: number;        // Default: 5MB
  onImagesChange: (images: ProductImage[]) => void;
  disabled?: boolean;
}

interface ProductImage {
  id: string;                   // UUID
  url: string;                  // Full URL to image
  thumbnail_url: string;        // URL to thumbnail
  size_bytes: number;
  order: number;                // Display order (0-4)
  uploaded_at: string;          // ISO timestamp
}
```

**Features**:
- Drag-and-drop zone with visual feedback
- File input fallback for accessibility
- Image preview grid with reorder capability
- Delete button per image
- Progress indicator during upload
- Error messages for validation failures
- Responsive design (mobile-friendly)

**State Management**:
```typescript
const [images, setImages] = useState<ProductImage[]>(existingImages || []);
const [uploading, setUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
const [errors, setErrors] = useState<string[]>([]);
```

---

### 2. Bulk Actions Toolbar

**Location**: `src/app/admin/productos/components/BulkActionsToolbar.tsx`

**Props Interface**:
```typescript
interface BulkActionsToolbarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

type BulkAction = 
  | 'activate'
  | 'deactivate'
  | 'change_category'
  | 'change_station'
  | 'delete';

interface BulkActionConfig {
  action: BulkAction;
  label: string;
  icon: LucideIcon;
  requiresInput: boolean;
  confirmationMessage: string;
  variant: 'default' | 'destructive';
}
```

**Features**:
- Fixed position toolbar (appears when items selected)
- Action buttons with icons
- Modal dialogs for actions requiring input (category, station)
- Confirmation dialog for destructive actions (delete)
- Progress indicator during execution
- Success/error toast notifications
- Keyboard shortcuts (Ctrl+A for select all, Escape to clear)

---

### 3. CSV Import/Export Component

**Location**: `src/app/admin/productos/components/CSVImportExport.tsx`

**Props Interface**:
```typescript
interface CSVImportExportProps {
  onImportComplete: () => void;
}

interface CSVRow {
  sku: string;
  name: string;
  short_name?: string;
  price_cents: number;
  category: string;
  station: string;
  type: string;
  is_active: boolean;
}

interface CSVValidationError {
  row: number;
  field: string;
  message: string;
  value: any;
}

interface ImportPreview {
  valid_rows: CSVRow[];
  errors: CSVValidationError[];
  total_rows: number;
}
```

**Features**:
- Export button (downloads CSV immediately)
- Import button (opens file picker)
- Template download button (CSV with headers + examples)
- Preview modal showing parsed data
- Error highlighting in preview table
- Confirmation before executing import
- Progress bar during import
- Summary modal after completion

---

### 4. Image Service

**Location**: `src/core/services/image.service.ts`

**Interface**:
```typescript
interface ImageService {
  uploadImage(
    file: File,
    tenantId: string,
    productId: string
  ): Promise<UploadedImage>;
  
  deleteImage(
    imageId: string,
    tenantId: string
  ): Promise<void>;
  
  deleteProductImages(
    productId: string,
    tenantId: string
  ): Promise<void>;
  
  optimizeImage(
    buffer: Buffer,
    options: OptimizeOptions
  ): Promise<Buffer>;
}

interface UploadedImage {
  id: string;
  url: string;
  thumbnail_url: string;
  medium_url: string;
  size_bytes: number;
  format: 'webp';
}

interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  format: 'webp' | 'jpeg' | 'png';
}
```

**Implementation Details**:
- Uses Sharp library for image processing
- Generates 3 versions: original (max 1920x1920), medium (800x800), thumbnail (200x200)
- Converts all images to WEBP format for optimal compression
- Uploads to Supabase Storage with tenant-scoped paths: `{tenant_id}/products/{product_id}/{image_id}.webp`
- Validates file signature (magic bytes) to prevent fake extensions
- Implements retry logic for upload failures

---

### 5. Bulk Operations Service

**Location**: `src/core/services/bulk-operations.service.ts`

**Interface**:
```typescript
interface BulkOperationsService {
  bulkUpdate(
    productIds: string[],
    updates: Partial<ProductUpdate>,
    tenantId: string,
    userId: string
  ): Promise<BulkOperationResult>;
  
  bulkDelete(
    productIds: string[],
    tenantId: string,
    userId: string
  ): Promise<BulkOperationResult>;
}

interface ProductUpdate {
  is_active?: boolean;
  category?: ProductCategory;
  station?: ProductStation;
}

interface BulkOperationResult {
  success_count: number;
  failure_count: number;
  failures: BulkOperationFailure[];
  duration_ms: number;
}

interface BulkOperationFailure {
  product_id: string;
  sku: string;
  error: string;
}
```

**Implementation Details**:
- Uses Prisma transactions for atomicity
- Batch size: 50 products per transaction
- Updates `version`, `updated_at`, `updated_by` for each product
- Creates audit log entry for each operation
- Invalidates Redis cache after successful operation
- Implements optimistic locking (checks version before update)
- Returns detailed failure information for partial failures

---

### 6. CSV Service

**Location**: `src/core/services/csv.service.ts`

**Interface**:
```typescript
interface CSVService {
  exportProducts(
    tenantId: string,
    filters?: ProductFilters
  ): Promise<string>;
  
  parseCSV(
    fileContent: string
  ): Promise<CSVParseResult>;
  
  validateCSVRow(
    row: CSVRow,
    rowNumber: number,
    existingSKUs: Set<string>
  ): CSVValidationError[];
  
  importProducts(
    rows: CSVRow[],
    tenantId: string,
    userId: string
  ): Promise<ImportResult>;
  
  generateTemplate(): string;
}

interface CSVParseResult {
  rows: CSVRow[];
  errors: CSVValidationError[];
}

interface ImportResult {
  created_count: number;
  updated_count: number;
  skipped_count: number;
  errors: CSVValidationError[];
  duration_ms: number;
}
```

**Implementation Details**:
- Uses PapaParse for CSV parsing/generation
- Validates all rows before importing (fail-fast on critical errors)
- Supports upsert logic: updates if SKU exists, creates if new
- Processes in batches of 50 rows
- Creates audit log for import operation
- Handles price conversion: accepts both decimal (10.50) and centavos (1050)
- Template includes headers + 3 example rows

---

## Data Models

### Database Schema Changes

**Add image fields to products table**:
```sql
-- Migration: 20260127_add_product_images.sql

ALTER TABLE products 
ADD COLUMN images JSONB DEFAULT '[]'::jsonb;

-- Index for querying products with images
CREATE INDEX idx_products_images ON products USING GIN (images);

-- Comment
COMMENT ON COLUMN products.images IS 'Array of product images with URLs and metadata';
```

**Images JSON Structure**:
```typescript
type ProductImagesJSON = ProductImage[];

interface ProductImage {
  id: string;              // UUID
  url: string;             // Full size URL
  thumbnail_url: string;   // 200x200 thumbnail
  medium_url: string;      // 800x800 medium
  size_bytes: number;
  format: 'webp';
  order: number;           // Display order (0-4)
  uploaded_at: string;     // ISO timestamp
  uploaded_by: string;     // Employee UUID
}
```

**Example**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://xxx.supabase.co/storage/v1/object/public/products/tenant-123/product-456/image-1.webp",
    "thumbnail_url": "https://xxx.supabase.co/.../image-1-thumb.webp",
    "medium_url": "https://xxx.supabase.co/.../image-1-medium.webp",
    "size_bytes": 245678,
    "format": "webp",
    "order": 0,
    "uploaded_at": "2026-01-27T10:30:00Z",
    "uploaded_by": "employee-uuid"
  }
]
```

### Supabase Storage Structure

```
products/
├── {tenant_id}/
│   ├── {product_id}/
│   │   ├── {image_id}.webp           # Original (max 1920x1920)
│   │   ├── {image_id}-medium.webp    # Medium (800x800)
│   │   └── {image_id}-thumb.webp     # Thumbnail (200x200)
```

**Storage Policies** (Supabase RLS):
```sql
-- Allow authenticated users to upload images
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products' AND auth.uid() IS NOT NULL);

-- Allow public read access to product images
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'products');

-- Allow authenticated users to delete their tenant's images
CREATE POLICY "Allow tenant delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'products' AND
  (storage.foldername(name))[1] = current_setting('app.tenant_id')
);
```

### Validation Schemas

**Image Upload Schema**:
```typescript
export const ImageUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, 'File size must be less than 5MB')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      'File must be JPG, PNG, or WEBP'
    ),
  product_id: z.string().uuid(),
});
```

**Bulk Update Schema**:
```typescript
export const BulkUpdateSchema = z.object({
  product_ids: z.array(z.string().uuid())
    .min(1, 'At least one product must be selected')
    .max(100, 'Cannot update more than 100 products at once'),
  updates: z.object({
    is_active: z.boolean().optional(),
    category: ProductCategorySchema.optional(),
    station: ProductStationSchema.optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be updated'
  ),
});
```

**CSV Row Schema**:
```typescript
export const CSVRowSchema = z.object({
  sku: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(200).trim(),
  short_name: z.string().max(50).trim().optional(),
  price_cents: z.union([
    z.number().int().min(0),
    z.string().transform((val) => {
      // Handle decimal format: "10.50" -> 1050
      if (val.includes('.')) {
        return Math.round(parseFloat(val) * 100);
      }
      // Handle centavos format: "1050" -> 1050
      return parseInt(val, 10);
    }),
  ]),
  category: ProductCategorySchema,
  station: ProductStationSchema,
  type: ProductTypeSchema.default('SIMPLE'),
  is_active: z.union([
    z.boolean(),
    z.string().transform((val) => val.toLowerCase() === 'true'),
  ]).default(true),
});
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Image Upload and Management Properties

**Property 1: Valid image acceptance**
*For any* image file that meets validation criteria (JPG/PNG/WEBP format, ≤5MB size), uploading it should result in successful acceptance and storage.
**Validates: Requirements 1.2, 1.4**

**Property 2: Image optimization completeness**
*For any* uploaded image, the Image_Upload_Service should generate all three required versions (original max 1920x1920, medium 800x800, thumbnail 200x200) in WEBP format.
**Validates: Requirements 4.3, 4.4, 4.5**

**Property 3: Image storage tenant isolation**
*For any* uploaded image, it should be stored in Supabase_Storage under the correct tenant-scoped path: `{tenant_id}/products/{product_id}/{image_id}.webp`.
**Validates: Requirements 4.2, 9.5**

**Property 4: Image metadata completeness**
*For any* stored image, the database record should contain all required URLs (original, medium, thumbnail) and metadata (size, format, order, timestamps).
**Validates: Requirements 4.6**

**Property 5: Image deletion cleanup**
*For any* deleted image, both the database record should be updated AND all three image versions should be removed from Supabase_Storage.
**Validates: Requirements 1.9, 4.9**

**Property 6: Multiple image display**
*For any* product with N images (where 1 ≤ N ≤ 5), the Admin_Panel should display all N images with reordering capability.
**Validates: Requirements 1.7**

**Property 7: Image display version selection**
*For any* product with images, the list view should use thumbnail URLs and the detail view should use medium URLs.
**Validates: Requirements 4.7, 4.8**

**Property 8: Upload preview feedback**
*For any* successful image upload, the Admin_Panel should display a preview of the uploaded image.
**Validates: Requirements 1.6**

**Property 9: Primary image thumbnail display**
*For any* product with at least one image in list view, the primary image (order=0) thumbnail should be displayed.
**Validates: Requirements 1.10**

### Bulk Operations Properties

**Property 10: Checkbox selection**
*For any* product checkbox clicked, that product should be marked as selected in the UI state.
**Validates: Requirements 2.2**

**Property 11: Toolbar visibility**
*For any* UI state where one or more products are selected, the bulk actions toolbar should be displayed.
**Validates: Requirements 2.3**

**Property 12: Bulk activate operation**
*For any* set of selected products, executing the "Activate" bulk action should set `is_active=true` for all selected products.
**Validates: Requirements 2.5**

**Property 13: Bulk deactivate operation**
*For any* set of selected products, executing the "Deactivate" bulk action should set `is_active=false` for all selected products.
**Validates: Requirements 2.6**

**Property 14: Bulk category change**
*For any* set of selected products and any valid category, executing the "Change Category" bulk action should update the category for all selected products.
**Validates: Requirements 2.7**

**Property 15: Bulk station change**
*For any* set of selected products and any valid station, executing the "Change Station" bulk action should update the station for all selected products.
**Validates: Requirements 2.8**

**Property 16: Bulk operation success feedback**
*For any* completed bulk operation, the Admin_Panel should display a success message containing the count of affected products.
**Validates: Requirements 2.11**

**Property 17: Bulk operation partial failure reporting**
*For any* bulk operation that fails for some products, the Admin_Panel should display which specific products failed and the reason for each failure.
**Validates: Requirements 2.12**

**Property 18: Bulk operation cache invalidation and audit**
*For any* completed bulk operation, the Cache_Service should invalidate the products cache AND the Audit_Trail should record the action with all affected product IDs.
**Validates: Requirements 2.13, 2.14, 3.14, 3.15**

**Property 19: Bulk operation atomicity**
*For any* bulk update operation, if any single product update fails, the entire transaction should roll back leaving no partial updates.
**Validates: Requirements 5.4, 5.5**

**Property 20: Bulk operation metadata updates**
*For any* bulk operation that updates products, each affected product should have its `version` incremented, `updated_at` set to current timestamp, and `updated_by` set to the acting user.
**Validates: Requirements 5.7, 5.8**

**Property 21: Bulk operation result completeness**
*For any* completed bulk operation, the API response should contain success_count, failure_count, and detailed failure information.
**Validates: Requirements 5.6**

**Property 22: Bulk request validation**
*For any* bulk operation request, the request body should be validated using Zod schemas before processing.
**Validates: Requirements 5.2**

### CSV Import/Export Properties

**Property 23: CSV export completeness**
*For any* CSV export operation, the generated file should include all product fields (SKU, name, price, category, station, type, is_active) for all products.
**Validates: Requirements 3.2**

**Property 24: CSV file validation**
*For any* uploaded CSV file, the CSV_Parser should validate the file format and headers before processing rows.
**Validates: Requirements 3.5**

**Property 25: CSV invalid header rejection**
*For any* CSV file with headers that don't match the expected schema, the CSV_Parser should reject the file with a descriptive error message.
**Validates: Requirements 3.6**

**Property 26: CSV preview display**
*For any* valid CSV file, the Admin_Panel should display a preview of all rows with validation errors highlighted.
**Validates: Requirements 3.7, 3.8**

**Property 27: CSV row processing**
*For any* confirmed CSV import, all valid rows should be processed (created or updated) and invalid rows should be skipped without stopping the import.
**Validates: Requirements 3.9, 3.12**

**Property 28: CSV upsert behavior**
*For any* CSV row with an existing SKU, the product should be updated; for any row with a new SKU, a new product should be created.
**Validates: Requirements 3.10, 3.11**

**Property 29: CSV import summary**
*For any* completed CSV import, the Admin_Panel should display a summary containing counts of created, updated, and skipped rows plus any errors.
**Validates: Requirements 3.13**

**Property 30: CSV row field validation**
*For any* CSV row, the CSV_Parser should validate that SKU is not empty, name is not empty, price_cents is a positive integer, and category/station/type are valid enum values.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

**Property 31: CSV price format conversion**
*For any* CSV row with a decimal price format (e.g., "10.50"), the CSV_Parser should convert it to centavos (1050).
**Validates: Requirements 6.7**

**Property 32: CSV duplicate SKU detection**
*For any* CSV file containing duplicate SKUs, the CSV_Parser should flag all duplicates as errors.
**Validates: Requirements 6.8**

**Property 33: CSV validation result structure**
*For any* CSV validation operation, the CSV_Parser should return both a list of valid rows and a list of validation errors.
**Validates: Requirements 6.9**

### Performance Properties

**Property 34: Bulk operation performance**
*For any* bulk operation on 100 products, the operation should complete within 5 seconds.
**Validates: Requirements 7.1**

**Property 35: CSV import performance**
*For any* CSV import with 500 rows, the import should complete within 30 seconds.
**Validates: Requirements 7.2**

**Property 36: Image upload performance**
*For any* image upload operation, the upload and optimization should complete within 3 seconds.
**Validates: Requirements 7.3**

**Property 37: CSV export performance**
*For any* CSV export of 1000 products, the export should complete within 10 seconds.
**Validates: Requirements 7.4**

**Property 38: Bulk operation batching**
*For any* bulk operation, the implementation should use batch database queries instead of individual queries.
**Validates: Requirements 7.5**

**Property 39: CSV import batching**
*For any* CSV import, rows should be processed in batches of 50.
**Validates: Requirements 7.6**

### Security and Authorization Properties

**Property 40: Image file signature validation**
*For any* uploaded image file, the Image_Upload_Service should validate the file signature (magic bytes) to prevent fake extensions.
**Validates: Requirements 9.1**

**Property 41: Admin role requirement**
*For any* bulk operation or CSV import request, the Admin_Panel should verify the user has admin role before processing.
**Validates: Requirements 9.3, 9.4**

**Property 42: Tenant-scoped operations**
*For any* bulk operation, only products within the user's tenant should be affected, preventing cross-tenant modifications.
**Validates: Requirements 9.6**

### User Feedback Properties

**Property 43: Operation success notification**
*For any* successfully completed operation (bulk, import, upload), the Admin_Panel should display a success toast notification.
**Validates: Requirements 8.5**

**Property 44: Operation failure notification**
*For any* failed operation, the Admin_Panel should display an error toast notification with actionable information.
**Validates: Requirements 8.6**

**Property 45: Operation in-progress button state**
*For any* operation in progress, the submit button should be disabled to prevent duplicate submissions.
**Validates: Requirements 8.7**

### Backward Compatibility Properties

**Property 46: Missing image graceful handling**
*For any* product without images (null or empty images array), the Admin_Panel should display a placeholder image and allow all operations to function normally.
**Validates: Requirements 10.1, 10.2, 10.5**

**Property 47: Image service degradation**
*For any* product creation or update operation, if the image upload service is unavailable, the operation should complete successfully without images.
**Validates: Requirements 10.3**

**Property 48: Storage service fault tolerance**
*For any* operation when Supabase_Storage is unavailable, the Admin_Panel should display an error for image operations but not block other product operations.
**Validates: Requirements 10.4**

---

## Error Handling

### Image Upload Errors

**File Validation Errors**:
```typescript
enum ImageUploadError {
  FILE_TOO_LARGE = 'File size exceeds 5MB limit',
  INVALID_FORMAT = 'File must be JPG, PNG, or WEBP',
  INVALID_SIGNATURE = 'File signature does not match extension',
  MAX_IMAGES_REACHED = 'Product already has maximum of 5 images',
  UPLOAD_FAILED = 'Failed to upload image to storage',
  OPTIMIZATION_FAILED = 'Failed to optimize image',
}
```

**Error Response Format**:
```typescript
{
  error: {
    code: 'IMAGE_UPLOAD_ERROR',
    message: 'File size exceeds 5MB limit',
    details: {
      file_name: 'product-photo.jpg',
      file_size: 6291456,
      max_size: 5242880
    }
  }
}
```

**Recovery Actions**:
- File too large: Suggest compressing image before upload
- Invalid format: Show accepted formats (JPG, PNG, WEBP)
- Max images reached: Suggest deleting an existing image first
- Upload failed: Retry with exponential backoff (3 attempts)
- Optimization failed: Fall back to original image without optimization

### Bulk Operation Errors

**Validation Errors**:
```typescript
enum BulkOperationError {
  NO_PRODUCTS_SELECTED = 'At least one product must be selected',
  TOO_MANY_PRODUCTS = 'Cannot update more than 100 products at once',
  INVALID_UPDATE_FIELDS = 'At least one field must be updated',
  UNAUTHORIZED = 'User does not have permission for bulk operations',
  TRANSACTION_FAILED = 'Database transaction failed, no changes made',
}
```

**Partial Failure Handling**:
```typescript
interface BulkOperationResult {
  success_count: number;
  failure_count: number;
  failures: Array<{
    product_id: string;
    sku: string;
    error: string;
  }>;
}
```

**Recovery Actions**:
- Transaction failed: Retry entire operation
- Partial failures: Display failed products, allow retry of just those
- Too many products: Suggest splitting into smaller batches
- Unauthorized: Redirect to login or show permission error

### CSV Import Errors

**File-Level Errors**:
```typescript
enum CSVFileError {
  INVALID_FORMAT = 'File must be CSV format',
  INVALID_HEADERS = 'CSV headers do not match expected schema',
  FILE_TOO_LARGE = 'CSV file exceeds 10MB limit',
  PARSE_ERROR = 'Failed to parse CSV file',
}
```

**Row-Level Errors**:
```typescript
interface CSVRowError {
  row: number;
  field: string;
  message: string;
  value: any;
}

// Examples:
{
  row: 5,
  field: 'price_cents',
  message: 'Price must be a positive integer',
  value: '-100'
}

{
  row: 12,
  field: 'category',
  message: 'Invalid category. Must be one of: POLLOS, PARRILLAS, BEBIDAS, EXTRAS, POSTRES, COMBOS',
  value: 'INVALID_CATEGORY'
}
```

**Recovery Actions**:
- Invalid headers: Provide template download link
- Parse error: Check file encoding (must be UTF-8)
- Row errors: Display errors in preview, allow fixing and re-uploading
- Duplicate SKUs: Highlight duplicates, allow user to decide (update or skip)

### Storage Service Errors

**Supabase Storage Errors**:
```typescript
enum StorageError {
  CONNECTION_FAILED = 'Cannot connect to storage service',
  UPLOAD_TIMEOUT = 'Upload timed out after 30 seconds',
  QUOTA_EXCEEDED = 'Storage quota exceeded for tenant',
  PERMISSION_DENIED = 'Insufficient permissions to access storage',
}
```

**Fallback Strategy**:
1. Retry with exponential backoff (3 attempts)
2. If all retries fail, save product without images
3. Queue image upload for background retry
4. Notify user that images will be added later
5. Log error for monitoring

---

## Testing Strategy

### Dual Testing Approach

This feature requires both **unit tests** and **property-based tests** for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Both are complementary and necessary

### Unit Testing Focus

Unit tests should cover:
- Specific examples (e.g., uploading a 3MB JPG file)
- Edge cases (e.g., exactly 5MB file, exactly 5 images)
- Error conditions (e.g., invalid file format, network failure)
- Integration points (e.g., Supabase Storage API, Prisma transactions)
- UI interactions (e.g., clicking bulk action buttons)

**Example Unit Tests**:
```typescript
describe('ImageUpload', () => {
  it('should accept a valid 3MB JPG file', async () => {
    const file = createMockFile('test.jpg', 3 * 1024 * 1024, 'image/jpeg');
    const result = await uploadImage(file, tenantId, productId);
    expect(result.success).toBe(true);
  });

  it('should reject a 6MB file', async () => {
    const file = createMockFile('large.jpg', 6 * 1024 * 1024, 'image/jpeg');
    await expect(uploadImage(file, tenantId, productId))
      .rejects.toThrow('File size exceeds 5MB limit');
  });

  it('should prevent uploading more than 5 images', async () => {
    const product = await createProductWithImages(5);
    const file = createMockFile('sixth.jpg', 1024 * 1024, 'image/jpeg');
    await expect(uploadImage(file, tenantId, product.id))
      .rejects.toThrow('Product already has maximum of 5 images');
  });
});
```

### Property-Based Testing Focus

Property tests should verify universal properties using randomized inputs:
- All valid images are accepted (Property 1)
- All uploads generate 3 versions (Property 2)
- All bulk operations are atomic (Property 19)
- All CSV rows are validated (Property 30)

**Property Test Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: products-p1-improvements, Property {number}: {property_text}`

**Example Property Tests**:
```typescript
import fc from 'fast-check';

describe('Property: Valid image acceptance', () => {
  it('Feature: products-p1-improvements, Property 1: For any valid image file, uploading should succeed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          format: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
          size: fc.integer({ min: 1024, max: 5 * 1024 * 1024 }),
          width: fc.integer({ min: 100, max: 4000 }),
          height: fc.integer({ min: 100, max: 4000 }),
        }),
        async (imageSpec) => {
          const file = await generateImageFile(imageSpec);
          const result = await uploadImage(file, tenantId, productId);
          
          expect(result.success).toBe(true);
          expect(result.url).toBeDefined();
          expect(result.thumbnail_url).toBeDefined();
          expect(result.medium_url).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property: Bulk operation atomicity', () => {
  it('Feature: products-p1-improvements, Property 19: For any bulk update, failures should roll back entire transaction', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 20 }),
        fc.record({
          is_active: fc.boolean(),
          category: fc.constantFrom('POLLOS', 'PARRILLAS', 'BEBIDAS'),
        }),
        async (productIds, updates) => {
          // Inject a failure in the middle
          const failingId = productIds[Math.floor(productIds.length / 2)];
          await mockProductUpdateFailure(failingId);
          
          const initialStates = await getProductStates(productIds);
          
          try {
            await bulkUpdateProducts(productIds, updates, tenantId, userId);
            fail('Should have thrown error');
          } catch (error) {
            // Verify no products were updated
            const finalStates = await getProductStates(productIds);
            expect(finalStates).toEqual(initialStates);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property: CSV row validation', () => {
  it('Feature: products-p1-improvements, Property 30: For any CSV row, all required fields should be validated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sku: fc.oneof(fc.string(), fc.constant('')),
          name: fc.oneof(fc.string(), fc.constant('')),
          price_cents: fc.oneof(fc.integer(), fc.constant(-1), fc.string()),
          category: fc.oneof(
            fc.constantFrom('POLLOS', 'PARRILLAS', 'BEBIDAS'),
            fc.string()
          ),
          station: fc.oneof(
            fc.constantFrom('PARRILLA', 'COCINA', 'BAR'),
            fc.string()
          ),
        }),
        async (row) => {
          const errors = validateCSVRow(row, 1, new Set());
          
          // Verify validation catches all issues
          if (row.sku === '') {
            expect(errors.some(e => e.field === 'sku')).toBe(true);
          }
          if (row.name === '') {
            expect(errors.some(e => e.field === 'name')).toBe(true);
          }
          if (typeof row.price_cents !== 'number' || row.price_cents < 0) {
            expect(errors.some(e => e.field === 'price_cents')).toBe(true);
          }
          if (!['POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS', 'POSTRES', 'COMBOS'].includes(row.category)) {
            expect(errors.some(e => e.field === 'category')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**API Integration Tests**:
- Test complete flows: upload image → create product → bulk update → export CSV
- Test error scenarios: storage unavailable, database timeout
- Test concurrent operations: multiple users uploading images simultaneously
- Test transaction rollbacks: verify no partial updates on failure

**E2E Testing with Playwright**:
- Test user workflows: create product with images, bulk activate 10 products, import CSV
- Test UI feedback: progress indicators, success/error toasts
- Test responsive design: mobile and desktop views
- Test accessibility: keyboard navigation, screen reader support

### Performance Testing

**Load Tests**:
- Bulk update 100 products: measure time, verify < 5 seconds
- Import CSV with 500 rows: measure time, verify < 30 seconds
- Upload 5 images concurrently: measure time, verify < 15 seconds total
- Export 1000 products: measure time, verify < 10 seconds

**Stress Tests**:
- Concurrent bulk operations: 10 users updating different products simultaneously
- Large CSV import: 5000 rows (should handle gracefully, may take longer)
- Image upload burst: 20 images uploaded in quick succession
- Database connection pool exhaustion: verify graceful degradation

### Test Coverage Goals

- Unit test coverage: > 80% for all service layer code
- Property test coverage: All 48 correctness properties implemented
- Integration test coverage: All API endpoints and critical paths
- E2E test coverage: All major user workflows
- Performance test coverage: All performance requirements (7.1-7.6)

---

## Implementation Notes

### Phase 1: Image Management (5 days)

1. **Database Migration** (0.5 days)
   - Add `images` JSONB column to products table
   - Create GIN index for image queries
   - Test migration on staging database

2. **Image Service** (2 days)
   - Implement Sharp-based image optimization
   - Implement Supabase Storage upload/delete
   - Add file signature validation
   - Write unit tests

3. **Image Upload Component** (1.5 days)
   - Build drag-and-drop UI
   - Implement preview grid with reordering
   - Add progress indicators
   - Write component tests

4. **Integration** (1 day)
   - Update product create/edit forms
   - Update product list to show thumbnails
   - Test end-to-end flow
   - Write E2E tests

### Phase 2: Bulk Operations (4 days)

1. **Bulk Service** (1.5 days)
   - Implement transaction-based bulk updates
   - Add batch processing logic
   - Implement audit logging
   - Write unit tests

2. **Bulk API Endpoint** (1 day)
   - Create `/api/admin/products/bulk` route
   - Add Zod validation
   - Implement error handling
   - Write API tests

3. **Bulk UI Components** (1 day)
   - Build checkbox selection system
   - Create bulk actions toolbar
   - Add confirmation dialogs
   - Write component tests

4. **Integration** (0.5 days)
   - Wire up UI to API
   - Test all bulk actions
   - Write E2E tests

### Phase 3: CSV Import/Export (3 days)

1. **CSV Service** (1.5 days)
   - Implement PapaParse integration
   - Add row validation logic
   - Implement upsert logic
   - Write unit tests

2. **CSV API Endpoints** (0.5 days)
   - Create export endpoint
   - Create import endpoint
   - Add validation
   - Write API tests

3. **CSV UI Components** (0.5 days)
   - Build import/export buttons
   - Create preview modal
   - Add progress indicators
   - Write component tests

4. **Integration** (0.5 days)
   - Test complete import/export flow
   - Write E2E tests
   - Create CSV template

### Phase 4: Testing & Polish (2 days)

1. **Property-Based Tests** (1 day)
   - Implement all 48 properties
   - Run with 100+ iterations each
   - Fix any discovered issues

2. **Performance Testing** (0.5 days)
   - Run load tests
   - Optimize slow operations
   - Verify all performance requirements met

3. **Documentation** (0.5 days)
   - Update API documentation
   - Create user guide
   - Document error codes

**Total Estimated Time: 14 days**

### Dependencies

- **External Services**:
  - Supabase Storage (already configured)
  - Redis (already configured)
  - PostgreSQL (already configured)

- **NPM Packages**:
  - `sharp` (image processing)
  - `papaparse` (CSV parsing)
  - `fast-check` (property-based testing)
  - `@supabase/storage-js` (Supabase client)

- **Environment Variables**:
  - `NEXT_PUBLIC_SUPABASE_URL` (already set)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already set)
  - `SUPABASE_SERVICE_ROLE_KEY` (needs to be added for server-side uploads)

### Risks and Mitigations

**Risk 1: Supabase Storage quota exceeded**
- Mitigation: Implement storage quota monitoring
- Mitigation: Add cleanup job for old/unused images
- Mitigation: Compress images aggressively (WEBP format)

**Risk 2: Large CSV imports timeout**
- Mitigation: Process in batches of 50 rows
- Mitigation: Implement background job for very large imports (>1000 rows)
- Mitigation: Add progress tracking and resume capability

**Risk 3: Concurrent bulk operations cause conflicts**
- Mitigation: Use optimistic locking (version field)
- Mitigation: Implement retry logic with exponential backoff
- Mitigation: Show clear error messages when conflicts occur

**Risk 4: Image optimization performance**
- Mitigation: Optimize Sharp settings for speed vs quality
- Mitigation: Consider background processing for large images
- Mitigation: Cache optimized images aggressively

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing (>80% coverage)
- [ ] All property tests passing (48 properties, 100+ iterations each)
- [ ] All E2E tests passing
- [ ] Performance tests meet requirements
- [ ] Database migration tested on staging
- [ ] Supabase Storage bucket created and configured
- [ ] Environment variables set in Vercel
- [ ] API documentation updated
- [ ] User guide created

### Deployment Steps

1. Run database migration
2. Deploy backend changes (API routes, services)
3. Deploy frontend changes (components, pages)
4. Verify Supabase Storage connectivity
5. Test image upload in production
6. Test bulk operations in production
7. Test CSV import/export in production
8. Monitor error logs for 24 hours

### Post-Deployment

- [ ] Monitor Supabase Storage usage
- [ ] Monitor API performance metrics
- [ ] Monitor error rates
- [ ] Collect user feedback
- [ ] Plan P2 improvements based on usage data

### Rollback Plan

If critical issues are discovered:
1. Revert frontend deployment (images/bulk/CSV features hidden)
2. Keep database migration (backward compatible)
3. Investigate and fix issues
4. Re-deploy when ready

---

## Future Enhancements (P2)

### Product Variants
- Support for size/option variants (1/4, 1/2, whole chicken)
- Variant-specific pricing
- Variant inventory tracking

### Advanced Image Features
- Image cropping and editing
- Multiple image angles (front, side, top)
- Image zoom and lightbox
- AI-powered image tagging

### Barcode Support
- Barcode generation for products
- Barcode scanning for quick lookup
- Barcode printing integration

### Advanced CSV Features
- Excel (.xlsx) import/export
- Custom field mapping
- Scheduled imports
- Import templates per category

### Bulk Operations Enhancements
- Bulk price adjustments (increase by %, set margin)
- Bulk tag management
- Bulk availability scheduling
- Undo last bulk operation

---

## Appendix

### API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/products/images` | Upload product image |
| DELETE | `/api/admin/products/images/:id` | Delete product image |
| POST | `/api/admin/products/bulk` | Bulk update products |
| GET | `/api/admin/products/export` | Export products to CSV |
| POST | `/api/admin/products/import` | Import products from CSV |
| GET | `/api/admin/products/template` | Download CSV template |

### Database Schema Summary

```sql
-- products table (modified)
ALTER TABLE products ADD COLUMN images JSONB DEFAULT '[]'::jsonb;
CREATE INDEX idx_products_images ON products USING GIN (images);

-- No new tables required (using existing audit_logs, catalog_meta)
```

### Supabase Storage Buckets

```
products/
├── {tenant_id}/
│   ├── {product_id}/
│   │   ├── {image_id}.webp
│   │   ├── {image_id}-medium.webp
│   │   └── {image_id}-thumb.webp
```

### CSV Template Format

```csv
sku,name,short_name,price_cents,category,station,type,is_active
P001,1/4 Pollo a la Brasa,1/4 Pollo,1500,POLLOS,PARRILLA,SIMPLE,true
B001,Inca Kola 500ml,Inca Kola,350,BEBIDAS,BAR,SIMPLE,true
C001,Combo Familiar,Combo Fam,4500,COMBOS,PARRILLA,COMBO,true
```

### Error Code Reference

| Code | Message | HTTP Status | Recovery Action |
|------|---------|-------------|-----------------|
| IMAGE_TOO_LARGE | File size exceeds 5MB | 400 | Compress image |
| INVALID_FORMAT | Invalid file format | 400 | Use JPG/PNG/WEBP |
| MAX_IMAGES | Maximum 5 images | 400 | Delete existing image |
| BULK_TOO_MANY | Max 100 products | 400 | Split into batches |
| CSV_INVALID_HEADERS | Invalid CSV headers | 400 | Download template |
| UNAUTHORIZED | Insufficient permissions | 403 | Check admin role |
| STORAGE_UNAVAILABLE | Storage service down | 503 | Retry later |
