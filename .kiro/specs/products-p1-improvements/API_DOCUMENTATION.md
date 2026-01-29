# API Documentation: Products P1 Improvements

## Overview

This document describes the REST API endpoints for Products P1 Improvements feature.

## Authentication

All endpoints require authentication via JWT token.

### Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Cookie Authentication

Alternatively, authentication can be done via httpOnly cookie:

```
Cookie: auth_token=<jwt_token>
```

## Base URL

```
https://your-domain.com/api/admin/products
```

## Endpoints

### 1. List Products

Get paginated list of products.

**Endpoint**: `GET /api/admin/products`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 100) |
| is_active | boolean | No | Filter by active status |
| category | string | No | Filter by category |
| station | string | No | Filter by station |

**Response**: `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "sku": "POLLO-001",
      "name": "Pollo a la Brasa",
      "short_name": "Pollo",
      "price_cents": 3500,
      "category": "POLLOS",
      "station": "PARRILLA",
      "type": "SIMPLE",
      "is_active": true,
      "images": [
        {
          "id": "uuid",
          "url": "https://...",
          "thumbnail_url": "https://...",
          "medium_url": "https://...",
          "size_bytes": 123456,
          "format": "webp",
          "order": 0,
          "uploaded_at": "2026-01-29T10:00:00Z",
          "uploaded_by": "uuid"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

**Example**:

```bash
curl -X GET "https://your-domain.com/api/admin/products?page=1&limit=20&category=POLLOS" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Single Product

Get details of a specific product.

**Endpoint**: `GET /api/admin/products/{id}`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Product UUID |

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "sku": "POLLO-001",
  "name": "Pollo a la Brasa",
  "short_name": "Pollo",
  "price_cents": 3500,
  "category": "POLLOS",
  "station": "PARRILLA",
  "type": "SIMPLE",
  "is_active": true,
  "images": [],
  "version": 1,
  "created_at": "2026-01-29T10:00:00Z",
  "updated_at": "2026-01-29T10:00:00Z"
}
```

**Errors**:
- `404 Not Found`: Product not found

---

### 3. Create Product

Create a new product.

**Endpoint**: `POST /api/admin/products`

**Request Body**:

```json
{
  "sku": "POLLO-001",
  "name": "Pollo a la Brasa",
  "short_name": "Pollo",
  "price_cents": 3500,
  "category": "POLLOS",
  "station": "PARRILLA",
  "type": "SIMPLE",
  "is_active": true
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "sku": "POLLO-001",
  "name": "Pollo a la Brasa",
  "short_name": "Pollo",
  "price_cents": 3500,
  "category": "POLLOS",
  "station": "PARRILLA",
  "type": "SIMPLE",
  "is_active": true,
  "images": [],
  "version": 1,
  "created_at": "2026-01-29T10:00:00Z",
  "updated_at": "2026-01-29T10:00:00Z"
}
```

**Errors**:
- `400 Bad Request`: Invalid data
- `409 Conflict`: SKU already exists

---

### 4. Update Product

Update an existing product.

**Endpoint**: `PUT /api/admin/products/{id}`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Product UUID |

**Request Body** (all fields optional):

```json
{
  "sku": "POLLO-001",
  "name": "Pollo a la Brasa",
  "short_name": "Pollo",
  "price_cents": 3500,
  "category": "POLLOS",
  "station": "PARRILLA",
  "type": "SIMPLE",
  "is_active": true,
  "images": [
    {
      "id": "uuid",
      "url": "https://...",
      "thumbnail_url": "https://...",
      "medium_url": "https://...",
      "size_bytes": 123456,
      "format": "webp",
      "order": 0,
      "uploaded_at": "2026-01-29T10:00:00Z",
      "uploaded_by": "uuid"
    }
  ]
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "sku": "POLLO-001",
  "name": "Pollo a la Brasa",
  "short_name": "Pollo",
  "price_cents": 3500,
  "category": "POLLOS",
  "station": "PARRILLA",
  "type": "SIMPLE",
  "is_active": true,
  "images": [],
  "version": 2,
  "created_at": "2026-01-29T10:00:00Z",
  "updated_at": "2026-01-29T11:00:00Z"
}
```

**Errors**:
- `400 Bad Request`: Invalid data
- `404 Not Found`: Product not found
- `409 Conflict`: SKU already exists (if changing SKU)

---

### 5. Delete Product

Soft delete a product (mark as inactive).

**Endpoint**: `DELETE /api/admin/products/{id}`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Product UUID |

**Response**: `204 No Content`

**Errors**:
- `404 Not Found`: Product not found

---

### 6. Upload Product Image

Upload an image for a product.

**Endpoint**: `POST /api/admin/products/images`

**Content-Type**: `multipart/form-data`

**Form Data**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | Image file (JPEG, PNG, WEBP) |
| product_id | string | Yes | Product UUID |

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "url": "https://storage.supabase.co/.../original.webp",
  "thumbnail_url": "https://storage.supabase.co/.../thumbnail.webp",
  "medium_url": "https://storage.supabase.co/.../medium.webp",
  "size_bytes": 123456,
  "format": "webp",
  "order": 0,
  "uploaded_at": "2026-01-29T10:00:00Z",
  "uploaded_by": "uuid"
}
```

**Errors**:
- `400 Bad Request`: Invalid file or missing product_id
- `404 Not Found`: Product not found
- `413 Payload Too Large`: File size exceeds 5 MB

**Example**:

```bash
curl -X POST "https://your-domain.com/api/admin/products/images" \
  -H "Authorization: Bearer <token>" \
  -F "file=@image.jpg" \
  -F "product_id=uuid"
```

---

### 7. Delete Product Image

Delete an image from a product.

**Endpoint**: `DELETE /api/admin/products/images/{id}`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Image UUID |

**Response**: `204 No Content`

**Errors**:
- `404 Not Found`: Image not found

---

### 8. Bulk Operations

Perform bulk operations on multiple products.

**Endpoint**: `POST /api/admin/products/bulk`

**Request Body**:

```json
{
  "product_ids": ["uuid1", "uuid2", "uuid3"],
  "operation": "activate",
  "updates": {
    "category": "BEBIDAS",
    "station": "BAR"
  }
}
```

**Operations**:
- `activate`: Set is_active to true
- `deactivate`: Set is_active to false
- `update`: Apply updates from `updates` field
- `delete`: Soft delete (set is_active to false)

**Response**: `200 OK`

```json
{
  "success_count": 3,
  "failure_count": 0,
  "failures": [],
  "duration_ms": 1234
}
```

**Errors**:
- `400 Bad Request`: Invalid operation or data
- `404 Not Found`: Some products not found

**Example**:

```bash
curl -X POST "https://your-domain.com/api/admin/products/bulk" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_ids": ["uuid1", "uuid2"],
    "operation": "update",
    "updates": {
      "category": "BEBIDAS"
    }
  }'
```

---

### 9. Export CSV

Export products to CSV format.

**Endpoint**: `GET /api/admin/products/export`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| is_active | boolean | No | Filter by active status |
| category | string | No | Filter by category |
| station | string | No | Filter by station |

**Response**: `200 OK`

**Content-Type**: `text/csv`

**Headers**:
```
Content-Disposition: attachment; filename="products_export_20260129.csv"
```

**Example**:

```bash
curl -X GET "https://your-domain.com/api/admin/products/export?category=POLLOS" \
  -H "Authorization: Bearer <token>" \
  -o products.csv
```

---

### 10. Import CSV

Import products from CSV format.

**Endpoint**: `POST /api/admin/products/import`

**Content-Type**: `multipart/form-data`

**Form Data**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | CSV file |

**Response**: `200 OK`

```json
{
  "total_rows": 100,
  "created_count": 50,
  "updated_count": 45,
  "skipped_count": 5,
  "errors": [
    {
      "row": 10,
      "sku": "INVALID-001",
      "error": "Invalid category"
    }
  ],
  "duration_ms": 5000
}
```

**Errors**:
- `400 Bad Request`: Invalid CSV format

**Example**:

```bash
curl -X POST "https://your-domain.com/api/admin/products/import" \
  -H "Authorization: Bearer <token>" \
  -F "file=@products.csv"
```

---

### 11. Download CSV Template

Download CSV template for import.

**Endpoint**: `GET /api/admin/products/template`

**Response**: `200 OK`

**Content-Type**: `text/csv`

**Headers**:
```
Content-Disposition: attachment; filename="products_template.csv"
```

**Example**:

```bash
curl -X GET "https://your-domain.com/api/admin/products/template" \
  -H "Authorization: Bearer <token>" \
  -o template.csv
```

---

## Data Types

### Product

```typescript
interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  short_name: string | null;
  price_cents: number;
  category: ProductCategory;
  station: ProductStation;
  type: ProductType;
  is_active: boolean;
  images: ProductImage[];
  version: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}
```

### ProductImage

```typescript
interface ProductImage {
  id: string;
  url: string;
  thumbnail_url: string;
  medium_url: string;
  size_bytes: number;
  format: string;
  order: number;
  uploaded_at: string;
  uploaded_by: string;
}
```

### ProductCategory

```typescript
type ProductCategory =
  | 'POLLOS'
  | 'PARRILLAS'
  | 'BEBIDAS'
  | 'EXTRAS'
  | 'POSTRES'
  | 'COMBOS'
  | 'GUARNICIONES';
```

### ProductStation

```typescript
type ProductStation =
  | 'PARRILLA'
  | 'COCINA'
  | 'BAR'
  | 'HORNO'
  | 'POSTRES'
  | 'EMPAQUE'
  | 'FRIOS';
```

### ProductType

```typescript
type ProductType = 'SIMPLE' | 'COMBO' | 'VARIABLE';
```

## Error Responses

### 400 Bad Request

```json
{
  "error": "Datos inválidos",
  "details": [
    {
      "field": "price_cents",
      "message": "Price must be a positive integer"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "No autorizado"
}
```

### 404 Not Found

```json
{
  "error": "Producto no encontrado"
}
```

### 409 Conflict

```json
{
  "error": "Este SKU ya está en uso"
}
```

### 413 Payload Too Large

```json
{
  "error": "Archivo demasiado grande (máximo 5 MB)"
}
```

### 500 Internal Server Error

```json
{
  "error": "Error interno del servidor"
}
```

## Rate Limiting

- **Rate Limit**: 100 requests per minute per user
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Time when rate limit resets (Unix timestamp)

**Response when rate limit exceeded**: `429 Too Many Requests`

```json
{
  "error": "Demasiadas solicitudes. Intenta de nuevo más tarde."
}
```

## Caching

- **Cache Duration**: 60 seconds for GET requests
- **Cache Invalidation**: Automatic on POST, PUT, DELETE operations
- **Cache Key**: Based on endpoint, query parameters, and tenant ID

## Pagination

All list endpoints support pagination:

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

## Versioning

API version is included in the URL path:

```
/api/v1/admin/products
```

Current version: `v1`

## Changelog

### v1.0.0 (2026-01-29)

**Initial Release**:
- Product CRUD operations
- Image management
- Bulk operations
- CSV import/export
- Pagination and filtering
- Rate limiting
- Caching
