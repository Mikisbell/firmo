/**
 * Tenant Context Management
 * 
 * Provides tenant context extraction, validation, and injection for all API requests.
 * Ensures tenant isolation at the API layer by validating tenant_id from JWT tokens
 * and setting PostgreSQL session variables for RLS enforcement.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6**
 */

import { prisma } from '@/core/db/prisma';
import { UnauthorizedError } from '@/core/errors';

/**
 * Tenant context object injected into all API requests
 */
export interface TenantContext {
  /** UUID of the tenant */
  tenant_id: string;
  
  /** Whether this is a cross-tenant admin with elevated privileges */
  is_cross_tenant_admin: boolean;
  
  /** Optional: ID of the authenticated employee */
  employee_id?: string;
  
  /** Optional: Role of the authenticated employee */
  role?: string;
}

/**
 * JWT token payload with tenant information
 */
export interface TenantToken {
  tenant_id: string;
  employee_id?: string;
  role?: string;
  is_cross_tenant_admin?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Extract tenant context from JWT token
 * 
 * @param token - JWT token payload
 * @returns Tenant context
 * @throws UnauthorizedError if tenant_id is missing
 */
export function extractTenantContext(token: TenantToken): TenantContext {
  if (!token.tenant_id) {
    throw new UnauthorizedError('Missing tenant_id in authentication token');
  }

  return {
    tenant_id: token.tenant_id,
    is_cross_tenant_admin: token.is_cross_tenant_admin || false,
    employee_id: token.employee_id,
    role: token.role,
  };
}

/**
 * Validate tenant context
 * 
 * Ensures tenant exists and is active
 * 
 * @param context - Tenant context to validate
 * @throws UnauthorizedError if tenant is not found or inactive
 */
export async function validateTenantContext(context: TenantContext): Promise<void> {
  const tenant = await prisma.tenants.findUnique({
    where: { id: context.tenant_id },
  });

  if (!tenant) {
    throw new UnauthorizedError(`Tenant not found: ${context.tenant_id}`);
  }

  if (!tenant.is_active) {
    throw new UnauthorizedError(`Tenant is inactive: ${context.tenant_id}`);
  }
}

/**
 * Set PostgreSQL session variables for RLS enforcement
 * 
 * This must be called before any database queries to ensure RLS policies
 * are applied correctly.
 * 
 * @param context - Tenant context
 */
export async function setRLSSessionVariables(context: TenantContext): Promise<void> {
  // Set current tenant ID for RLS policies
  await prisma.$executeRaw`
    SELECT set_config('app.current_tenant_id', ${context.tenant_id}, true)
  `;

  // Set cross-tenant admin flag for RLS policies
  await prisma.$executeRaw`
    SELECT set_config('app.is_cross_tenant_admin', ${context.is_cross_tenant_admin.toString()}, true)
  `;
}

/**
 * Execute a handler with tenant context
 * 
 * This is the main entry point for tenant-scoped operations. It:
 * 1. Extracts tenant context from token
 * 2. Validates tenant exists and is active
 * 3. Sets RLS session variables
 * 4. Executes the handler with context
 * 
 * @param token - JWT token payload
 * @param handler - Async function to execute with tenant context
 * @returns Result of handler execution
 * 
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const token = await getToken(request);
 *   return withTenantContext(token, async (context) => {
 *     const orders = await prisma.orders.findMany();
 *     return NextResponse.json(orders);
 *   });
 * }
 * ```
 */
export async function withTenantContext<T>(
  token: TenantToken,
  handler: (context: TenantContext) => Promise<T>
): Promise<T> {
  // Extract tenant context from token
  const context = extractTenantContext(token);

  // Validate tenant exists and is active
  await validateTenantContext(context);

  // Set RLS session variables
  await setRLSSessionVariables(context);

  // Execute handler with context
  return handler(context);
}

/**
 * Get current tenant context from request
 * 
 * This is a helper function to retrieve the current tenant context
 * from the request context (typically set by middleware).
 * 
 * @returns Current tenant context
 * @throws UnauthorizedError if context is not available
 */
export function getCurrentTenantContext(): TenantContext {
  // This would typically be retrieved from request context
  // Implementation depends on your request context management
  throw new Error('getCurrentTenantContext must be implemented in your request context');
}

/**
 * Validate tenant_id matches expected tenant
 * 
 * Used to ensure a resource belongs to the current tenant
 * 
 * @param context - Current tenant context
 * @param resource_tenant_id - Tenant ID of the resource
 * @throws UnauthorizedError if tenant IDs don't match
 */
export function validateResourceTenant(
  context: TenantContext,
  resource_tenant_id: string
): void {
  if (context.tenant_id !== resource_tenant_id && !context.is_cross_tenant_admin) {
    throw new UnauthorizedError(
      `Resource does not belong to tenant: ${context.tenant_id}`
    );
  }
}
