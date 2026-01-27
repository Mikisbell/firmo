/**
 * Bulk Operations Types
 * Type definitions for bulk product operations
 */

import type { ProductCategory, ProductStation } from '../admin/schemas/product.schema';

/**
 * Bulk operation types
 */
export type BulkOperationType = 
  | 'activate'
  | 'deactivate'
  | 'change_category'
  | 'change_station'
  | 'delete';

/**
 * Product update fields for bulk operations
 */
export interface ProductUpdate {
  is_active?: boolean;
  category?: ProductCategory;
  station?: ProductStation;
}

/**
 * Result of a bulk operation
 */
export interface BulkOperationResult {
  success_count: number;
  failure_count: number;
  failures: BulkOperationFailure[];
  duration_ms: number;
}

/**
 * Details of a failed product update in bulk operation
 */
export interface BulkOperationFailure {
  product_id: string;
  sku: string;
  error: string;
}

/**
 * Bulk operation request
 */
export interface BulkOperationRequest {
  product_ids: string[];
  updates: ProductUpdate;
  tenant_id: string;
  user_id: string;
}
