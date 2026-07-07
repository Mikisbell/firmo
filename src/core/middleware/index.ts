/**
 * FIRMO POS Middleware Module
 *
 * Barrel export for authentication and authorization middleware.
 * Import from '@/src/core/middleware' instead of individual files.
 */

export { requireAdminAuth } from './admin-auth';
export { requireAdminPermission } from './admin-permission';
export { requirePosAuth } from './pos-auth';
export { validateInventoryAuth, withInventoryAuth, createAuthErrorResponse } from './inventory-auth';
export type { AuthenticatedRequest, AuthMiddlewareResult } from './inventory-auth';
export { requireOpenShift } from './shift-guard';
export type { ShiftAuthResult } from './shift-guard';
export { withRequestLogging, getRequestContext } from './request-logger';
