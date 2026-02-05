# Task 10.3: Pagination Implementation

## Overview

Implementing standardized pagination for all list endpoints in the PARK POS API.

## Requirements

From Design Document (Requirement 9.6):
- Add pagination parameters (page, pageSize) to all list endpoints
- Enforce maximum page size of 100
- Return pagination metadata (total, totalPages, hasNext, hasPrev)

## Current State Analysis

### Existing Pagination Utilities ✅

**File: `src/lib/pagination.ts`**
- `parsePaginationParams()` - Parses page/limit from query params
- `createPaginatedResponse()` - Creates standardized response
- MAX_LIMIT = 100 (already enforced)
- Returns proper metadata (total, totalPages, hasNext, hasPrev)

### Endpoints Status

| Endpoint | Current State | Action Needed |
|----------|--------------|---------------|
| `/api/orders` | Uses skip/take | ✅ Migrate to page/pageSize |
| `/api/products` | Uses skip/take | ✅ Migrate to page/pageSize |
| `/api/inventory` | Uses skip/take | ✅ Migrate to page/pageSize |
| `/api/admin/employees` | ✅ Uses page/limit | ✅ Already correct |
| `/api/drivers` | ❌ No pagination | ✅ Add pagination |
| `/api/promotions` | ❌ No pagination | ✅ Add pagination |
| `/api/refunds` | Uses limit/offset | ✅ Migrate to page/pageSize |
| `/api/delivery` | ❌ No pagination | ✅ Add pagination |

## Implementation Plan

### Phase 1: Update Existing Endpoints with skip/take

1. **Orders API** (`src/app/api/orders/route.ts`)
   - Replace skip/take with page/pageSize
   - Use `parsePaginationParams()` and `createPaginatedResponse()`
   - Update response format

2. **Products API** (`src/app/api/products/route.ts`)
   - Replace skip/take with page/pageSize
   - Update cache key to use page instead of skip
   - Use standardized pagination helpers

3. **Inventory API** (`src/app/api/inventory/route.ts`)
   - Replace skip/take with page/pageSize
   - Use standardized pagination helpers

4. **Refunds API** (`src/app/api/refunds/route.ts`)
   - Replace limit/offset with page/pageSize
   - Use standardized pagination helpers

### Phase 2: Add Pagination to Endpoints Without It

5. **Drivers API** (`src/app/api/drivers/route.ts`)
   - Add pagination support
   - Default pageSize: 20, max: 100

6. **Promotions API** (`src/app/api/promotions/route.ts`)
   - Add pagination support
   - Default pageSize: 20, max: 100

7. **Delivery API** (`src/app/api/delivery/route.ts`)
   - Add pagination support
   - Default pageSize: 20, max: 100

### Phase 3: Update Pagination Utility

8. **Enhance pagination.ts**
   - Add `pageSize` as alias for `limit` in params
   - Ensure backward compatibility
   - Add JSDoc examples

## Standardized Response Format

```typescript
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Query Parameters

- `page` (optional, default: 1, min: 1)
- `pageSize` or `limit` (optional, default: 10-20 depending on endpoint, max: 100)

## Testing Strategy

1. **Unit Tests**: Test pagination helpers with various inputs
2. **Integration Tests**: Test each endpoint with pagination
3. **Property Tests**: Verify pagination invariants (Property 17)

## Success Criteria

- ✅ All list endpoints support page/pageSize parameters
- ✅ Maximum page size of 100 enforced
- ✅ Consistent response format across all endpoints
- ✅ Pagination metadata includes total, totalPages, hasNext, hasPrev
- ✅ Backward compatibility maintained where possible
- ✅ Property test 17 passes

## Implementation Notes

- Use existing `parsePaginationParams()` and `createPaginatedResponse()` from `src/lib/pagination.ts`
- Maintain cache integration where it exists (products endpoint)
- Preserve existing filters and query parameters
- Update observability metrics where applicable
- Follow existing error handling patterns

## Files to Modify

1. `src/lib/pagination.ts` - Enhance with pageSize alias
2. `src/app/api/orders/route.ts` - Migrate to page/pageSize
3. `src/app/api/products/route.ts` - Migrate to page/pageSize
4. `src/app/api/inventory/route.ts` - Migrate to page/pageSize
5. `src/app/api/refunds/route.ts` - Migrate to page/pageSize
6. `src/app/api/drivers/route.ts` - Add pagination
7. `src/app/api/promotions/route.ts` - Add pagination
8. `src/app/api/delivery/route.ts` - Add pagination

## Property Test

**Property 17: Pagination Support**

*For any* list endpoint that can return more than 100 records, the API SHALL support pagination parameters (page, pageSize) and return paginated results with metadata (total, totalPages).

Test file: `src/lib/__tests__/pagination.property.test.ts`
