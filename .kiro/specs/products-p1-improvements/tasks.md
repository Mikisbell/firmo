# Implementation Plan: Products P1 Improvements

## Overview

This implementation plan breaks down the Products P1 Improvements feature into discrete, incremental coding tasks. The plan follows a phased approach: Image Management → Bulk Operations → CSV Import/Export → Testing & Polish. Each task builds on previous work and includes property-based tests to validate correctness.

## Tasks

### Phase 1: Image Management (5 days)

- [x] 1. Database Migration for Image Support
  - Create migration file `20260127_add_product_images.sql`
  - Add `images` JSONB column to products table with default empty array
  - Create GIN index on images column for efficient queries
  - Update Prisma schema with images field
  - Test migration on development database
  - **Validates:** Requirements 1.1, 4.1

- [x] 2. TypeScript Types for Images
  - Create `src/core/types/product-images.ts` with ProductImage interface
  - Create `src/core/admin/schemas/product-image.schema.ts` with Zod validation
  - Update `src/core/types/product.ts` with Product type extensions
  - Update `src/core/admin/schemas/product.schema.ts` to include images field
  - Add helper functions: getPrimaryImage, hasImages, canAddMoreImages
  - Write unit tests for all types and helpers
  - **Validates:** Requirements 1.2, 4.6

- [x] 3. Image Upload Component
  - Create `src/app/admin/productos/components/ImageUpload.tsx`
  - Implement drag-and-drop zone with visual feedback
  - Add file input fallback for accessibility
  - Implement file validation (format, size, file signature)
  - Create preview grid with responsive layout (2-5 columns)
  - Add reordering capability (up/down buttons)
  - Add delete button per image
  - Show primary image badge on first image
  - Display error messages for validation failures
  - Write component tests
  - **Validates:** Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, Properties 1, 6, 8

- [x] 4. Image Storage Service
  - Create `src/core/services/image.service.ts`
  - Implement Sharp-based image optimization
    - Generate 3 versions: original (max 1920x1920), medium (800x800), thumbnail (200x200)
    - Convert all images to WEBP format
    - Set quality to 85 for optimal compression
  - Implement Supabase Storage integration
    - Upload images to tenant-scoped paths: `{tenant_id}/products/{product_id}/{image_id}.webp`
    - Generate public URLs for all versions
    - Implement delete functionality
  - Add file signature validation (magic bytes)
  - Implement retry logic for upload failures (3 attempts with exponential backoff)
  - Write unit tests for all service methods
  - Write property tests for Properties 2, 3, 4, 5
  - **Validates:** Requirements 4.2, 4.3, 4.4, 4.5, 4.9, 9.1, Properties 2, 3, 4, 5

- [ ] 5. Update Product APIs for Images
  - Modify `POST /api/admin/products` to handle image uploads
  - Modify `PUT /api/admin/products/[id]` to handle image updates
  - Create `POST /api/admin/products/images` for standalone image upload
  - Create `DELETE /api/admin/products/images/[id]` for image deletion
  - Implement cache invalidation after image operations
  - Add error handling for storage failures
  - Write API integration tests
  - Write property tests for Properties 7, 9
  - **Validates:** Requirements 1.10, 4.7, 4.8, Properties 7, 9

- [x] 6. Update Product Form UI
  - Integrate ImageUpload component into product create/edit forms
  - Display existing images with reorder capability
  - Allow marking primary image (first in order)
  - Show image upload progress
  - Handle image upload errors gracefully
  - Update product list view to show primary image thumbnail
  - Add placeholder image for products without images
  - Write E2E tests for complete image workflow
  - **Validates:** Requirements 1.10, 10.1, 10.2, Properties 9, 46

### Phase 2: Bulk Operations (4 days)

- [x] 7. Bulk Operations Service
  - Create `src/core/services/bulk-operations.service.ts`
  - Implement transaction-based bulk updates
    - Use Prisma transactions for atomicity
    - Process in batches of 50 products
    - Update version, updated_at, updated_by for each product
  - Implement bulk activate/deactivate
  - Implement bulk category change
  - Implement bulk station change
  - Implement bulk delete (soft delete with is_active=false)
  - Create audit log entries for all operations
  - Implement cache invalidation after operations
  - Write unit tests for all service methods
  - Write property tests for Properties 10-22
  - **Validates:** Requirements 2.5, 2.6, 2.7, 2.8, 2.9, 2.13, 2.14, 5.1-5.8, Properties 10-22

- [x] 8. Bulk Operations API
  - Create `POST /api/admin/products/bulk` endpoint
  - Add Zod validation for bulk operation requests
  - Implement error handling for partial failures
  - Return detailed results (success_count, failure_count, failures array)
  - Add authorization check (admin role required)
  - Write API integration tests
  - **Validates:** Requirements 2.4, 5.2, 5.6, 9.3, 9.4, 9.6, Properties 16, 17, 18, 21, 22, 41, 42

- [x] 9. Bulk Operations UI
  - Create `src/app/admin/productos/components/BulkActionsToolbar.tsx`
  - Add checkbox selection to product list DataTable
  - Implement "Select All" / "Deselect All" functionality
  - Create bulk actions toolbar (appears when items selected)
  - Add action buttons: Activate, Deactivate, Change Category, Change Station, Delete
  - Create modal dialogs for actions requiring input
  - Add confirmation dialog for destructive actions
  - Show progress indicator during execution
  - Display success/error toast notifications
  - Add keyboard shortcuts (Ctrl+A, Escape)
  - Write component tests
  - Write E2E tests for all bulk actions
  - **Validates:** Requirements 2.1, 2.2, 2.3, 2.10, 2.11, 2.12, 8.5, 8.6, 8.7, Properties 10, 11, 12, 13, 14, 15, 43, 44, 45

### Phase 3: CSV Import/Export (3 days)

- [x] 10. CSV Service
  - Create `src/core/services/csv.service.ts`
  - Implement PapaParse integration for parsing/generation
  - Implement CSV export
    - Include all product fields (SKU, name, price, category, station, type, is_active)
    - Format prices as centavos integers
    - Handle large exports (streaming for >1000 products)
  - Implement CSV parsing and validation
    - Validate headers match expected schema
    - Validate each row (SKU, name, price, category, station, type)
    - Detect duplicate SKUs within file
    - Convert decimal prices to centavos
  - Implement CSV import with upsert logic
    - Update products with existing SKUs
    - Create products with new SKUs
    - Process in batches of 50 rows
    - Skip invalid rows, continue processing
  - Generate CSV template with headers and example rows
  - Write unit tests for all service methods
  - Write property tests for Properties 23-33
  - **Validates:** Requirements 3.1-3.13, 6.1-6.9, Properties 23-33

- [-] 11. CSV API Endpoints
  - Create `GET /api/admin/products/export` endpoint
  - Create `POST /api/admin/products/import` endpoint
  - Create `GET /api/admin/products/template` endpoint
  - Add Zod validation for import requests
  - Implement streaming response for large exports
  - Add authorization checks (admin role required)
  - Write API integration tests
  - **Validates:** Requirements 3.2, 3.4, 3.9, 9.3, 9.4

- [ ] 12. CSV UI Components
  - Create `src/app/admin/productos/components/CSVImportExport.tsx`
  - Add Export button (downloads CSV immediately)
  - Add Import button (opens file picker)
  - Add Template Download button
  - Create import preview modal
    - Display parsed rows in table
    - Highlight validation errors
    - Show summary (valid rows, errors)
  - Add confirmation dialog before executing import
  - Show progress bar during import
  - Display summary modal after completion (created, updated, skipped counts)
  - Write component tests
  - Write E2E tests for import/export workflows
  - **Validates:** Requirements 3.3, 3.5, 3.6, 3.7, 3.8, 3.13, 8.5, 8.6, Properties 24, 25, 26, 27, 28, 29, 43, 44

### Phase 4: Testing & Polish (2 days)

- [ ] 13. Property-Based Tests Implementation
  - Implement all 48 correctness properties from design document
  - Configure fast-check with minimum 100 iterations per property
  - Tag each test with format: `Feature: products-p1-improvements, Property {number}: {property_text}`
  - Create test arbitraries for:
    - Valid image files (format, size, dimensions)
    - Product data (SKU, name, price, category, station)
    - CSV rows (valid and invalid)
    - Bulk operation requests
  - Run all property tests and fix any discovered issues
  - **Validates:** All 48 properties (1-48)

- [ ] 14. Performance Testing
  - Create performance test suite
  - Test bulk update of 100 products (target: <5 seconds)
  - Test CSV import of 500 rows (target: <30 seconds)
  - Test image upload and optimization (target: <3 seconds)
  - Test CSV export of 1000 products (target: <10 seconds)
  - Optimize any operations that don't meet targets
  - **Validates:** Requirements 7.1-7.6, Properties 34-39

- [ ] 15. Integration Testing
  - Write integration tests for complete workflows:
    - Create product with images → bulk update → export CSV
    - Import CSV → update products → export CSV
    - Upload images → delete images → verify cleanup
  - Test error scenarios:
    - Storage service unavailable
    - Database timeout
    - Invalid file formats
    - Concurrent operations
  - Test transaction rollbacks
  - **Validates:** Properties 19, 47, 48

- [ ] 16. Documentation and Deployment Prep
  - Update API documentation with new endpoints
  - Create user guide for image management
  - Create user guide for bulk operations
  - Create user guide for CSV import/export
  - Document error codes and recovery actions
  - Create deployment checklist
  - Verify all environment variables are documented
  - Create rollback plan
  - **Validates:** All requirements

## Progress Tracking

**Completed:** 9/16 tasks (56.25%)  
**In Progress:** 0 tasks  
**Remaining:** 7 tasks

**Phase 1 (Image Management):** 6/6 tasks complete ✅  
**Phase 2 (Bulk Operations):** 3/3 tasks complete ✅  
**Phase 3 (CSV Import/Export):** 0/3 tasks  
**Phase 4 (Testing & Polish):** 0/4 tasks

**Estimated Time:**
- Phase 1: 5 days ✅ COMPLETE
- Phase 2: 4 days ✅ COMPLETE
- Phase 3: 3 days (3 tasks)
- Phase 4: 2 days (4 tasks)
- **Total:** 14 days (9 days complete, 5 days remaining)

## Dependencies

### External Services
- Supabase Storage (configured)
- Redis (configured)
- PostgreSQL (configured)

### NPM Packages
- `sharp` - Image processing (needs installation)
- `papaparse` - CSV parsing (needs installation)
- `fast-check` - Property-based testing (needs installation)
- `@supabase/storage-js` - Supabase client (already installed)

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` (set)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (set)
- `SUPABASE_SERVICE_ROLE_KEY` (needs to be added)

## Notes

- All tasks include unit tests
- Tasks 4, 7, 10, 13 include property-based tests
- Tasks 6, 9, 12 include E2E tests
- Follow money safety rules: always use centavos (Int), never float
- Follow branded types: use Centavos type and helpers
- All bulk operations must be atomic (use transactions)
- All operations must create audit log entries
- All operations must invalidate cache appropriately
