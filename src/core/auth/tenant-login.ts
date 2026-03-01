/**
 * Tenant-Scoped Login Validation
 * 
 * Validates that employees belong to the specified tenant during login.
 * Ensures tenant isolation at the authentication layer.
 * 
 * **Validates: Requirements 12.1, 12.2**
 * 
 * @module tenant-login
 */

import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import { generateToken, recordLoginAttempt, createSession, logAdminAccess } from './auth.service';
import type { AuthResult } from './auth.service';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('tenant-login');

export interface TenantLoginRequest {
  tenant_id: string;
  pin: string;
  terminal_id?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface TenantLoginResult extends AuthResult {
  tenant_id?: string;
  session_id?: string;
}

/**
 * Validate that an employee belongs to a specific tenant
 * 
 * **Requirement 12.1:** When a user logs in, the system SHALL validate 
 * employee belongs to the specified tenant
 */
export async function validateEmployeeBelongsToTenant(
  employee_id: string,
  tenant_id: string
): Promise<{ valid: boolean; error?: string }> {
  const employee = await prisma.employees.findUnique({
    where: { id: employee_id },
  });

  if (!employee) {
    return { valid: false, error: 'Employee not found' };
  }

  if (employee.tenant_id !== tenant_id) {
    return {
      valid: false,
      error: `Employee does not belong to tenant ${tenant_id}`,
    };
  }

  if (!employee.is_active) {
    return { valid: false, error: 'Employee is inactive' };
  }

  return { valid: true };
}

/**
 * Perform tenant-scoped login
 * 
 * **Requirement 12.1:** Validate employee belongs to the specified tenant
 * **Requirement 12.2:** Include tenant_id in JWT authentication tokens
 */
export async function tenantScopedLogin(
  request: TenantLoginRequest
): Promise<TenantLoginResult> {
  try {
    // Step 1: Validate tenant exists
    const tenant = await prisma.tenant_settings.findUnique({
      where: { tenant_id: request.tenant_id },
    });

    if (!tenant) {
      return {
        success: false,
        error: 'Tenant not found',
        errorCode: 'INVALID_PIN',
      };
    }

    // Step 2: Find employee by PIN hash in this tenant
    const { hashPin } = await import('./crypto-utils');
    const pinHash = await hashPin(request.pin);

    const employee = await prisma.employees.findFirst({
      where: {
        tenant_id: request.tenant_id,
        pin_hash: pinHash,
        is_active: true,
      },
    });

    if (!employee) {
      // Record failed attempt
      await recordLoginAttempt(
        prisma,
        request.tenant_id,
        pinHash,
        false,
        undefined,
        {
          ip: request.ip_address,
          userAgent: request.user_agent,
          terminalId: request.terminal_id,
        }
      );

      return {
        success: false,
        error: 'Invalid PIN',
        errorCode: 'INVALID_PIN',
      };
    }

    // Step 3: Validate employee belongs to tenant (defense in depth)
    const tenantValidation = await validateEmployeeBelongsToTenant(
      employee.id,
      request.tenant_id
    );

    if (!tenantValidation.valid) {
      await recordLoginAttempt(
        prisma,
        request.tenant_id,
        pinHash,
        false,
        employee.id,
        {
          ip: request.ip_address,
          userAgent: request.user_agent,
          terminalId: request.terminal_id,
        }
      );

      return {
        success: false,
        error: tenantValidation.error || 'Tenant validation failed',
        errorCode: 'INVALID_PIN',
      };
    }

    // Step 4: Generate JWT token with tenant_id
    const sessionId = randomUUID();
    const { token, expiresAt } = await generateToken(
      {
        id: employee.id,
        name: employee.name,
        role: employee.role,
      },
      request.tenant_id,
      sessionId
    );

    // Step 5: Create session
    const { generateTokenHash } = await import('./crypto-utils');
    const tokenHash = await generateTokenHash();

    await createSession(
      prisma,
      request.tenant_id,
      employee.id,
      tokenHash,
      {
        ip: request.ip_address,
        userAgent: request.user_agent,
        terminalId: request.terminal_id,
      }
    );

    // Step 6: Record successful login
    await recordLoginAttempt(
      prisma,
      request.tenant_id,
      pinHash,
      true,
      employee.id,
      {
        ip: request.ip_address,
        userAgent: request.user_agent,
        terminalId: request.terminal_id,
      }
    );

    // Step 7: Log admin access if applicable
    if (employee.role === 'ADMIN') {
      await logAdminAccess(
        prisma,
        request.tenant_id,
        employee.id,
        'LOGIN',
        {
          ip: request.ip_address,
          userAgent: request.user_agent,
          terminalId: request.terminal_id,
        }
      );
    }

    return {
      success: true,
      token,
      tenant_id: request.tenant_id,
      session_id: sessionId,
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
      },
      expiresAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    log.error('Error en login con alcance de tenant', error instanceof Error ? error : new Error(message));

    return {
      success: false,
      error: message,
      errorCode: 'INVALID_PIN',
    };
  }
}

/**
 * Validate token tenant_id matches requested resource
 * 
 * **Requirement 12.3:** When a token is validated, the system SHALL verify 
 * tenant_id matches the requested resource
 * 
 * **Requirement 12.4:** The system SHALL prevent token reuse across different tenants
 */
export async function validateTokenTenant(
  token_tenant_id: string,
  requested_tenant_id: string
): Promise<{ valid: boolean; error?: string }> {
  if (token_tenant_id !== requested_tenant_id) {
    return {
      valid: false,
      error: `Token tenant_id (${token_tenant_id}) does not match requested tenant (${requested_tenant_id})`,
    };
  }

  return { valid: true };
}

/**
 * Validate token is not being reused across tenants
 * 
 * **Requirement 12.4:** Prevent token reuse across different tenants
 */
export async function validateTokenNotReused(
  session_id: string,
  tenant_id: string
): Promise<{ valid: boolean; error?: string }> {
  const session = await prisma.sessions.findUnique({
    where: { id: session_id },
  });

  if (!session) {
    return { valid: false, error: 'Session not found' };
  }

  if (session.tenant_id !== tenant_id) {
    return {
      valid: false,
      error: `Session belongs to different tenant (${session.tenant_id})`,
    };
  }

  if (session.expires_at < new Date()) {
    return { valid: false, error: 'Session expired' };
  }

  return { valid: true };
}

/**
 * Logout from tenant-scoped session
 * 
 * **Requirement 12.6:** When a session expires, the system SHALL require 
 * re-authentication with tenant context
 */
export async function tenantScopedLogout(
  session_id: string,
  tenant_id: string,
  employee_id: string,
  metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate session belongs to tenant
    const session = await prisma.sessions.findUnique({
      where: { id: session_id },
    });

    if (!session || session.tenant_id !== tenant_id) {
      return { success: false, error: 'Session not found or belongs to different tenant' };
    }

    // Delete session
    await prisma.sessions.delete({
      where: { id: session_id },
    });

    // Log logout
    await logAdminAccess(
      prisma,
      tenant_id,
      employee_id,
      'LOGOUT',
      {
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
        terminalId: metadata?.terminalId,
      }
    );

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return { success: false, error: message };
  }
}
