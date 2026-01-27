# Requirements Document

## Introduction

This document specifies the requirements for improving the PARK POS Admin Panel Products page from a 4/5 rating to 5/5. The improvements focus on three high-impact features: image management, bulk operations, and CSV import/export. These enhancements will dramatically improve user productivity, reduce manual errors, and bring the product management experience to industry standards set by platforms like Shopify and Square POS.

## Glossary

- **Product**: A sellable item in the catalog (e.g., "1/4 Pollo a la Brasa")
- **SKU**: Stock Keeping Unit, unique identifier for a product within a tenant
- **Bulk_Operation**: An action performed on multiple products simultaneously
- **Image_Upload_Service**: Component responsible for uploading and storing product images
- **CSV_Parser**: Component that validates and processes CSV files for import
- **Admin_Panel**: Web interface for restaurant administrators at `/admin/productos`
- **Supabase_Storage**: Cloud storage service for product images
- **Audit_Trail**: System that records all changes to products for compliance
- **Cache_Service**: Redis-based caching layer for product data
- **Tenant**: A restaurant location in the multi-tenant system

## Requirements

### Requirement 1: Image Upload and Management

**User Story:** As a restaurant administrator, I want to upload and manage product images, so that staff can visually identify products and reduce order errors.

#### Acceptance Criteria

1. WHEN an administrator creates or edits a product, THE Admin_Panel SHALL display an image upload interface
2. WHEN an administrator drags and drops an image file, THE Image_Upload_Service SHALL accept the file if it meets validation criteria
3. WHEN an image file exceeds 5MB, THE Image_Upload_Service SHALL reject the upload and display an error message
4. WHEN an image file is not JPG, PNG, or WEBP format, THE Image_Upload_Service SHALL reject the upload and display an error message
5. WHEN a valid image is uploaded, THE Image_Upload_Service SHALL optimize the image and store it in Supabase_Storage
6. WHEN an image upload completes, THE Admin_Panel SHALL display a preview of the uploaded image
7. WHEN a product has multiple images, THE Admin_Panel SHALL display all images with the ability to reorder them
8. WHEN a product has more than 5 images, THE Admin_Panel SHALL prevent additional uploads
9. WHEN an administrator deletes an image, THE Image_Upload_Service SHALL remove it from Supabase_Storage and update the product record
10. WHEN displaying products in the list view, THE Admin_Panel SHALL show the primary image thumbnail

### Requirement 2: Bulk Operations

**User Story:** As a restaurant administrator, I want to perform actions on multiple products at once, so that I can manage my catalog efficiently without repetitive manual work.

#### Acceptance Criteria

1. WHEN viewing the products list, THE Admin_Panel SHALL display a checkbox for each product row
2. WHEN an administrator clicks a product checkbox, THE Admin_Panel SHALL mark that product as selected
3. WHEN one or more products are selected, THE Admin_Panel SHALL display a bulk actions toolbar
4. WHEN an administrator clicks "Select All", THE Admin_Panel SHALL select all products on the current page
5. WHEN an administrator chooses "Activate" from bulk actions, THE Admin_Panel SHALL activate all selected products
6. WHEN an administrator chooses "Deactivate" from bulk actions, THE Admin_Panel SHALL deactivate all selected products
7. WHEN an administrator chooses "Change Category" from bulk actions, THE Admin_Panel SHALL display a category selector and update all selected products
8. WHEN an administrator chooses "Change Station" from bulk actions, THE Admin_Panel SHALL display a station selector and update all selected products
9. WHEN an administrator chooses "Delete" from bulk actions, THE Admin_Panel SHALL display a confirmation dialog before proceeding
10. WHEN a bulk operation is confirmed, THE Admin_Panel SHALL display a progress indicator
11. WHEN a bulk operation completes, THE Admin_Panel SHALL display a success message with the count of affected products
12. WHEN a bulk operation fails for some products, THE Admin_Panel SHALL display which products failed and why
13. WHEN a bulk operation completes, THE Cache_Service SHALL invalidate the products cache
14. WHEN a bulk operation completes, THE Audit_Trail SHALL record the action with all affected product IDs

### Requirement 3: CSV Import and Export

**User Story:** As a restaurant administrator, I want to import and export products via CSV, so that I can migrate data, create backups, and bulk-edit products in spreadsheet software.

#### Acceptance Criteria

1. WHEN an administrator clicks "Export CSV", THE Admin_Panel SHALL generate a CSV file containing all products
2. WHEN generating a CSV export, THE Admin_Panel SHALL include all product fields (SKU, name, price, category, station, etc.)
3. WHEN a CSV export is generated, THE Admin_Panel SHALL trigger a file download in the browser
4. WHEN an administrator clicks "Import CSV", THE Admin_Panel SHALL display a file upload dialog
5. WHEN an administrator uploads a CSV file, THE CSV_Parser SHALL validate the file format
6. WHEN a CSV file has invalid headers, THE CSV_Parser SHALL reject the file and display an error message
7. WHEN a CSV file is valid, THE Admin_Panel SHALL display a preview of the data to be imported
8. WHEN previewing import data, THE Admin_Panel SHALL highlight any validation errors per row
9. WHEN an administrator confirms the import, THE Admin_Panel SHALL process each row and create or update products
10. WHEN importing a product with an existing SKU, THE Admin_Panel SHALL update the existing product
11. WHEN importing a product with a new SKU, THE Admin_Panel SHALL create a new product
12. WHEN a CSV row has validation errors, THE Admin_Panel SHALL skip that row and continue processing
13. WHEN an import completes, THE Admin_Panel SHALL display a summary showing successful, failed, and skipped rows
14. WHEN an import completes, THE Cache_Service SHALL invalidate the products cache
15. WHEN an import completes, THE Audit_Trail SHALL record the import action with the count of affected products
16. WHEN an administrator clicks "Download Template", THE Admin_Panel SHALL provide a CSV template with correct headers and example data

### Requirement 4: Image Storage and Optimization

**User Story:** As a system architect, I want images to be stored efficiently and optimized automatically, so that the system performs well and storage costs remain manageable.

#### Acceptance Criteria

1. WHEN an image is uploaded, THE Image_Upload_Service SHALL generate a unique filename using UUID
2. WHEN an image is uploaded, THE Image_Upload_Service SHALL store it in Supabase_Storage under the tenant's folder
3. WHEN an image is uploaded, THE Image_Upload_Service SHALL create a thumbnail version (200x200px)
4. WHEN an image is uploaded, THE Image_Upload_Service SHALL create a medium version (800x800px)
5. WHEN an image is uploaded, THE Image_Upload_Service SHALL convert all images to WEBP format for optimal compression
6. WHEN storing image URLs, THE Admin_Panel SHALL save both the original and optimized versions in the database
7. WHEN displaying images in list view, THE Admin_Panel SHALL use the thumbnail version
8. WHEN displaying images in detail view, THE Admin_Panel SHALL use the medium version
9. WHEN a product is deleted, THE Image_Upload_Service SHALL delete all associated images from Supabase_Storage

### Requirement 5: Bulk Operations API

**User Story:** As a backend developer, I want a robust bulk operations API, so that multiple products can be updated atomically with proper error handling.

#### Acceptance Criteria

1. THE Admin_Panel SHALL expose a POST endpoint at `/api/admin/products/bulk`
2. WHEN receiving a bulk request, THE Admin_Panel SHALL validate the request body using Zod
3. WHEN a bulk request contains more than 100 product IDs, THE Admin_Panel SHALL reject the request
4. WHEN processing a bulk update, THE Admin_Panel SHALL use a database transaction
5. IF any product update fails, THEN THE Admin_Panel SHALL roll back the entire transaction
6. WHEN a bulk operation completes, THE Admin_Panel SHALL return a detailed response with success and failure counts
7. WHEN a bulk operation is performed, THE Admin_Panel SHALL increment the version number for each affected product
8. WHEN a bulk operation is performed, THE Admin_Panel SHALL update the `updated_by` and `updated_at` fields for each product

### Requirement 6: CSV Import Validation

**User Story:** As a restaurant administrator, I want CSV imports to be validated thoroughly, so that I don't accidentally corrupt my product catalog with bad data.

#### Acceptance Criteria

1. WHEN validating a CSV row, THE CSV_Parser SHALL check that SKU is not empty
2. WHEN validating a CSV row, THE CSV_Parser SHALL check that name is not empty
3. WHEN validating a CSV row, THE CSV_Parser SHALL check that price_cents is a positive integer
4. WHEN validating a CSV row, THE CSV_Parser SHALL check that category is a valid enum value
5. WHEN validating a CSV row, THE CSV_Parser SHALL check that station is a valid enum value
6. WHEN validating a CSV row, THE CSV_Parser SHALL check that type is a valid enum value
7. WHEN a CSV row has an invalid price format, THE CSV_Parser SHALL convert it to centavos if possible
8. WHEN a CSV row has a duplicate SKU within the file, THE CSV_Parser SHALL flag it as an error
9. WHEN validating completes, THE CSV_Parser SHALL return a list of valid rows and a list of errors

### Requirement 7: Performance and Scalability

**User Story:** As a system architect, I want bulk operations and imports to handle large datasets efficiently, so that the system remains responsive even with thousands of products.

#### Acceptance Criteria

1. WHEN processing a bulk operation on 100 products, THE Admin_Panel SHALL complete within 5 seconds
2. WHEN importing a CSV with 500 rows, THE Admin_Panel SHALL complete within 30 seconds
3. WHEN uploading an image, THE Image_Upload_Service SHALL complete within 3 seconds
4. WHEN generating a CSV export of 1000 products, THE Admin_Panel SHALL complete within 10 seconds
5. WHEN processing bulk operations, THE Admin_Panel SHALL use batch database queries instead of individual queries
6. WHEN importing CSV data, THE Admin_Panel SHALL process rows in batches of 50

### Requirement 8: User Feedback and Progress

**User Story:** As a restaurant administrator, I want clear feedback during long-running operations, so that I know the system is working and can see progress.

#### Acceptance Criteria

1. WHEN a bulk operation starts, THE Admin_Panel SHALL display a loading spinner
2. WHEN a bulk operation is processing, THE Admin_Panel SHALL display the count of products being processed
3. WHEN an image is uploading, THE Admin_Panel SHALL display a progress bar
4. WHEN a CSV import is processing, THE Admin_Panel SHALL display a progress indicator with percentage complete
5. WHEN an operation completes successfully, THE Admin_Panel SHALL display a success toast notification
6. WHEN an operation fails, THE Admin_Panel SHALL display an error toast notification with actionable information
7. WHEN an operation is in progress, THE Admin_Panel SHALL disable the submit button to prevent duplicate submissions

### Requirement 9: Security and Permissions

**User Story:** As a system administrator, I want image uploads and bulk operations to be secure, so that malicious users cannot exploit these features.

#### Acceptance Criteria

1. WHEN receiving an image upload, THE Image_Upload_Service SHALL validate the file signature to prevent fake extensions
2. WHEN receiving an image upload, THE Image_Upload_Service SHALL scan for malicious content
3. WHEN receiving a bulk operation request, THE Admin_Panel SHALL verify the user has admin role
4. WHEN receiving a CSV import request, THE Admin_Panel SHALL verify the user has admin role
5. WHEN storing images, THE Image_Upload_Service SHALL use tenant-scoped folders to prevent cross-tenant access
6. WHEN processing bulk operations, THE Admin_Panel SHALL only allow operations on products within the user's tenant

### Requirement 10: Backward Compatibility

**User Story:** As a system architect, I want new features to be backward compatible, so that existing functionality continues to work without disruption.

#### Acceptance Criteria

1. WHEN a product has no images, THE Admin_Panel SHALL display a placeholder image
2. WHEN displaying products created before image support, THE Admin_Panel SHALL handle missing image fields gracefully
3. WHEN the image upload service is unavailable, THE Admin_Panel SHALL allow product creation without images
4. WHEN Supabase_Storage is unavailable, THE Admin_Panel SHALL display an error but not block other operations
5. WHEN processing a CSV without image URLs, THE CSV_Parser SHALL create products without images
