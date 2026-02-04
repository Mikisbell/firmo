import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';

// Custom error classes
class UnauthorizedError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface CrossTenantPermissions {
  can_view_configuration: boolean;
  can_view_events: boolean;
  can_view_orders: boolean;
  can_view_analytics: boolean;
  can_modify_configuration: boolean;
  can_modify_quotas: boolean;
  can_deactivate_tenant: boolean;
}

export interface CrossTenantAdminContext {
  admin_id: string;
  admin_employee_id: string;
  target_tenant_id: string;
  permissions: CrossTenantPermissions;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Verify if an employee is a cross-tenant admin
 */
export async function isCrossTenantAdmin(employee_id: string): Promise<boolean> {
  const admin = await prisma.cross_tenant_admins.findUnique({
    where: { employee_id },
  });

  if (!admin) return false;

  // Check if admin is active
  if (!admin.is_active) return false;

  // Check if admin has expired
  if (admin.expires_at && new Date() > admin.expires_at) {
    return false;
  }

  return true;
}

/**
 * Get cross-tenant admin permissions
 */
export async function getCrossTenantPermissions(
  employee_id: string
): Promise<CrossTenantPermissions | null> {
  const admin = await prisma.cross_tenant_admins.findUnique({
    where: { employee_id },
  });

  if (!admin) return null;

  // Check if admin is active
  if (!admin.is_active) return null;

  // Check if admin has expired
  if (admin.expires_at && new Date() > admin.expires_at) {
    return null;
  }

  return admin.permissions as unknown as CrossTenantPermissions;
}

/**
 * Verify specific permission
 */
export async function verifyCrossTenantPermission(
  employee_id: string,
  permission: keyof CrossTenantPermissions
): Promise<boolean> {
  const permissions = await getCrossTenantPermissions(employee_id);
  if (!permissions) return false;

  return permissions[permission] === true;
}

/**
 * Middleware to enforce cross-tenant admin access
 */
export async function withCrossTenantAdmin(
  admin_employee_id: string,
  target_tenant_id: string,
  requiredPermission: keyof CrossTenantPermissions,
  context?: {
    ip_address?: string;
    user_agent?: string;
  }
): Promise<CrossTenantAdminContext> {
  // Verify admin exists and is active
  const isAdmin = await isCrossTenantAdmin(admin_employee_id);
  if (!isAdmin) {
    throw new UnauthorizedError('Not a cross-tenant admin');
  }

  // Get admin permissions
  const permissions = await getCrossTenantPermissions(admin_employee_id);
  if (!permissions) {
    throw new UnauthorizedError('Admin permissions not found');
  }

  // Verify required permission
  if (!permissions[requiredPermission]) {
    throw new ForbiddenError(
      `Permission denied: ${requiredPermission} not granted`
    );
  }

  // Get admin record for audit
  const admin = await prisma.cross_tenant_admins.findUnique({
    where: { employee_id: admin_employee_id },
  });

  if (!admin) {
    throw new UnauthorizedError('Admin record not found');
  }

  const adminContext: CrossTenantAdminContext = {
    admin_id: admin.id,
    admin_employee_id,
    target_tenant_id,
    permissions,
    ip_address: context?.ip_address,
    user_agent: context?.user_agent,
  };

  return adminContext;
}

/**
 * Log cross-tenant admin action
 */
export async function logCrossTenantAdminAction(
  context: CrossTenantAdminContext,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: any
): Promise<void> {
  await prisma.cross_tenant_audit_log.create({
    data: {
      id: randomUUID(),
      admin_id: context.admin_id,
      tenant_id: context.target_tenant_id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details ? (JSON.stringify(details) as any) : undefined,
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    },
  });
}

/**
 * Grant cross-tenant admin access to an employee
 */
export async function grantCrossTenantAdmin(
  employee_id: string,
  granted_by: string,
  permissions: CrossTenantPermissions,
  expiresInDays?: number
): Promise<void> {
  // Check if already a cross-tenant admin
  const existing = await prisma.cross_tenant_admins.findUnique({
    where: { employee_id },
  });

  if (existing) {
    // Update existing
    await prisma.cross_tenant_admins.update({
      where: { employee_id },
      data: {
        permissions: JSON.stringify(permissions),
        is_active: true,
        expires_at: expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
        updated_at: new Date(),
      },
    });
  } else {
    // Create new
    await prisma.cross_tenant_admins.create({
      data: {
        id: randomUUID(),
        employee_id,
        granted_by,
        permissions: JSON.stringify(permissions),
        expires_at: expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
      },
    });
  }
}

/**
 * Revoke cross-tenant admin access
 */
export async function revokeCrossTenantAdmin(employee_id: string): Promise<void> {
  await prisma.cross_tenant_admins.update({
    where: { employee_id },
    data: {
      is_active: false,
      updated_at: new Date(),
    },
  });
}

/**
 * Get all cross-tenant admins
 */
export async function getAllCrossTenantAdmins(): Promise<any[]> {
  return prisma.cross_tenant_admins.findMany({
    where: { is_active: true },
    orderBy: { granted_at: 'desc' },
  });
}

/**
 * Get cross-tenant audit logs for a tenant
 */
export async function getCrossTenantAuditLogs(
  tenant_id: string,
  limit: number = 100
): Promise<any[]> {
  return prisma.cross_tenant_audit_log.findMany({
    where: { tenant_id },
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}

/**
 * Get cross-tenant audit logs for an admin
 */
export async function getAdminAuditLogs(
  admin_id: string,
  limit: number = 100
): Promise<any[]> {
  return prisma.cross_tenant_audit_log.findMany({
    where: { admin_id },
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}
