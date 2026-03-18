/**
 * Authentication Service
 * 
 * Handles:
 * - PIN verification with lockout
 * - JWT token generation/validation
 * - Session management
 * - Audit logging
 * 
 * @module auth.service
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

type PrismaClientType = any;

// Configuration
// CRITICAL: PIN_SALT must be configured in production
const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';
if (!process.env.PIN_SALT && process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY ERROR: PIN_SALT must be configured in production environment');
}

// CRITICAL: JWT_SECRET must be configured
const JWT_SECRET_STRING = process.env.JWT_SECRET;
if (!JWT_SECRET_STRING) {
    throw new Error('SECURITY ERROR: JWT_SECRET must be configured');
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);
const JWT_ISSUER = 'park-pos';
const JWT_AUDIENCE = 'park-pos-client';

// Lockout settings
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours — full shift duration
const SESSION_INACTIVITY_MS = 8 * 60 * 60 * 1000; // 8 hours inactivity before auto-logout

export interface AuthPayload extends JWTPayload {
    sub: string;        // employee_id
    tid: string;        // tenant_id
    role: string;       // employee role
    name: string;       // employee name
    sid: string;        // session_id
}

export interface AuthResult {
    success: boolean;
    error?: string;
    errorCode?: 'INVALID_PIN' | 'ACCOUNT_LOCKED' | 'ROLE_NOT_ALLOWED' | 'INACTIVE_EMPLOYEE' | 'MFA_REQUIRED' | 'INVALID_MFA';
    token?: string;
    employee?: {
        id: string;
        name: string;
        role: string;
    };
    expiresAt?: Date;
    lockoutUntil?: Date;
}

export interface TokenValidationResult {
    valid: boolean;
    error?: string;
    payload?: AuthPayload;
}

/**
 * Check if an employee is locked out due to failed attempts (by PIN hash)
 */
export async function isLockedOut(
    prisma: PrismaClientType,
    tenantId: string,
    pinHash: string
): Promise<{ locked: boolean; until?: Date; attempts: number }> {
    const since = new Date(Date.now() - LOCKOUT_DURATION_MS);

    const recentAttempts = await prisma.login_attempts.findMany({
        where: {
            tenant_id: tenantId,
            pin_hash: pinHash,
            attempted_at: { gte: since },
        },
        orderBy: { attempted_at: 'desc' },
        take: MAX_FAILED_ATTEMPTS + 1,
    });

    const failedAttempts = recentAttempts.filter((a: { success: boolean }) => !a.success);

    if (failedAttempts.length >= MAX_FAILED_ATTEMPTS) {
        const oldestFailed = failedAttempts[failedAttempts.length - 1];
        const lockoutUntil = new Date(oldestFailed.attempted_at.getTime() + LOCKOUT_DURATION_MS);

        if (lockoutUntil > new Date()) {
            return { locked: true, until: lockoutUntil, attempts: failedAttempts.length };
        }
    }

    return { locked: false, attempts: failedAttempts.length };
}

/**
 * Check lockout by employee_id (used for DNI+PIN flow to avoid cross-employee lockout)
 */
export async function isLockedOutByEmployeeId(
    prisma: PrismaClientType,
    tenantId: string,
    employeeId: string
): Promise<{ locked: boolean; until?: Date; attempts: number }> {
    const since = new Date(Date.now() - LOCKOUT_DURATION_MS);

    const recentAttempts = await prisma.login_attempts.findMany({
        where: {
            tenant_id: tenantId,
            employee_id: employeeId,
            attempted_at: { gte: since },
        },
        orderBy: { attempted_at: 'desc' },
        take: MAX_FAILED_ATTEMPTS + 1,
    });

    const failedAttempts = recentAttempts.filter((a: { success: boolean }) => !a.success);

    if (failedAttempts.length >= MAX_FAILED_ATTEMPTS) {
        const oldestFailed = failedAttempts[failedAttempts.length - 1];
        const lockoutUntil = new Date(oldestFailed.attempted_at.getTime() + LOCKOUT_DURATION_MS);

        if (lockoutUntil > new Date()) {
            return { locked: true, until: lockoutUntil, attempts: failedAttempts.length };
        }
    }

    return { locked: false, attempts: failedAttempts.length };
}

/**
 * Record a login attempt
 */
export async function recordLoginAttempt(
    prisma: PrismaClientType,
    tenantId: string,
    pinHash: string,
    success: boolean,
    employeeId?: string,
    metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<void> {
    const { generateToken: generateRandomToken } = await import('./crypto-utils');
    
    await prisma.login_attempts.create({
        data: {
            id: await generateRandomToken(16),
            tenant_id: tenantId,
            employee_id: employeeId,
            pin_hash: pinHash,
            success,
            ip_address: metadata?.ip,
            user_agent: metadata?.userAgent,
            terminal_id: metadata?.terminalId,
        },
    });
}

/**
 * Log admin access
 */
export async function logAdminAccess(
    prisma: PrismaClientType,
    tenantId: string,
    employeeId: string,
    action: 'LOGIN' | 'LOGOUT' | 'ACCESS_DENIED' | 'SESSION_EXPIRED',
    metadata?: { 
        resource?: string; 
        ip?: string; 
        userAgent?: string; 
        terminalId?: string;
        details?: Record<string, string | number | boolean | null>;
    }
): Promise<void> {
    const { generateToken: generateRandomToken } = await import('./crypto-utils');
    
    await prisma.admin_access_logs.create({
        data: {
            id: await generateRandomToken(16),
            tenant_id: tenantId,
            employee_id: employeeId,
            action,
            resource: metadata?.resource,
            ip_address: metadata?.ip,
            user_agent: metadata?.userAgent,
            terminal_id: metadata?.terminalId,
            metadata: metadata?.details ?? undefined,
        },
    });
}

/**
 * Generate JWT token
 */
export async function generateToken(
    employee: { id: string; name: string; role: string },
    tenantId: string,
    sessionId: string
): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    
    const token = await new SignJWT({
        sub: employee.id,
        tid: tenantId,
        role: employee.role,
        name: employee.name,
        sid: sessionId,
    } as AuthPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setExpirationTime(expiresAt)
        .sign(JWT_SECRET);

    return { token, expiresAt };
}

/**
 * Validate JWT token
 */
export async function validateToken(token: string): Promise<TokenValidationResult> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });

        return {
            valid: true,
            payload: payload as AuthPayload,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid token';
        return { valid: false, error: message };
    }
}

/**
 * Create a new session
 */
export async function createSession(
    prisma: PrismaClientType,
    tenantId: string,
    employeeId: string,
    tokenHash: string,
    metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<string> {
    const { generateToken: generateRandomToken } = await import('./crypto-utils');
    
    const sessionId = await generateRandomToken(16);
    
    await prisma.sessions.create({
        data: {
            id: sessionId,
            tenant_id: tenantId,
            employee_id: employeeId,
            token_hash: tokenHash,
            ip_address: metadata?.ip,
            user_agent: metadata?.userAgent,
            terminal_id: metadata?.terminalId,
            expires_at: new Date(Date.now() + SESSION_DURATION_MS),
        },
    });

    return sessionId;
}

/**
 * Validate session is active and not expired
 */
export async function validateSession(
    prisma: PrismaClientType,
    sessionId: string
): Promise<{ valid: boolean; error?: string }> {
    const session = await prisma.sessions.findUnique({
        where: { id: sessionId },
    });

    if (!session) {
        return { valid: false, error: 'Session not found' };
    }

    if (session.revoked_at) {
        return { valid: false, error: 'Session revoked' };
    }

    if (session.expires_at < new Date()) {
        return { valid: false, error: 'Session expired' };
    }

    // Check inactivity
    const inactiveThreshold = new Date(Date.now() - SESSION_INACTIVITY_MS);
    if (session.last_active < inactiveThreshold) {
        return { valid: false, error: 'Session inactive' };
    }

    // Update last_active
    await prisma.sessions.update({
        where: { id: sessionId },
        data: { last_active: new Date() },
    });

    return { valid: true };
}

/**
 * Revoke a session
 */
export async function revokeSession(
    prisma: PrismaClientType,
    sessionId: string
): Promise<void> {
    await prisma.sessions.update({
        where: { id: sessionId },
        data: { revoked_at: new Date() },
    });
}

/**
 * Revoke all sessions for an employee
 */
export async function revokeAllSessions(
    prisma: PrismaClientType,
    tenantId: string,
    employeeId: string
): Promise<number> {
    const result = await prisma.sessions.updateMany({
        where: {
            tenant_id: tenantId,
            employee_id: employeeId,
            revoked_at: null,
        },
        data: { revoked_at: new Date() },
    });

    return result.count;
}

/**
 * Full authentication flow with lockout and JWT.
 *
 * Supports two modes:
 * - DNI + PIN (recommended): pass `dni` to identify employee by national ID, then verify PIN.
 *   Fixes the PIN collision bug (two employees with the same PIN) and locks out per employee
 *   rather than per PIN hash.
 * - PIN only (backward compat): used by admin panel PinModal which doesn't collect DNI.
 */
export async function authenticate(
    prisma: PrismaClientType,
    tenantId: string,
    pin: string,
    allowedRoles: string[],
    metadata?: { ip?: string; userAgent?: string; terminalId?: string },
    dni?: string
): Promise<AuthResult> {
    const { hashPin, generateTokenHash } = await import('./crypto-utils');
    const pinHash = await hashPin(pin);

    let employee: { id: string; name: string; role: string; is_active: boolean } | null = null;
    let lockoutAttempts = 0;

    if (dni) {
        // ── DNI + PIN flow ────────────────────────────────────────────────────────
        // Step 1: Find employee by DNI
        const empByDni = await prisma.employees.findFirst({
            where: { tenant_id: tenantId, dni },
            select: { id: true, name: true, role: true, is_active: true, pin_hash: true },
        });

        // Use generic message to avoid revealing whether the DNI exists
        if (!empByDni) {
            await recordLoginAttempt(prisma, tenantId, pinHash, false, undefined, metadata);
            return {
                success: false,
                error: 'DNI o PIN inválido. Verifica tus datos.',
                errorCode: 'INVALID_PIN',
            };
        }

        // Step 2: Lockout by employee_id — prevents cross-employee lockout when PINs collide
        const lockout = await isLockedOutByEmployeeId(prisma, tenantId, empByDni.id);
        if (lockout.locked) {
            await recordLoginAttempt(prisma, tenantId, pinHash, false, empByDni.id, metadata);
            return {
                success: false,
                error: `Cuenta bloqueada. Intenta de nuevo en ${Math.ceil((lockout.until!.getTime() - Date.now()) / 60000)} minutos.`,
                errorCode: 'ACCOUNT_LOCKED',
                lockoutUntil: lockout.until,
            };
        }
        lockoutAttempts = lockout.attempts;

        // Step 3: Verify PIN hash
        if (empByDni.pin_hash !== pinHash) {
            await recordLoginAttempt(prisma, tenantId, pinHash, false, empByDni.id, metadata);
            const remaining = MAX_FAILED_ATTEMPTS - lockoutAttempts - 1;
            return {
                success: false,
                error: remaining > 0
                    ? `DNI o PIN inválido. ${remaining} intento(s) restante(s).`
                    : 'DNI o PIN inválido. Cuenta bloqueada por 5 minutos.',
                errorCode: 'INVALID_PIN',
            };
        }

        employee = { id: empByDni.id, name: empByDni.name, role: empByDni.role, is_active: empByDni.is_active };
    } else {
        // ── PIN-only flow (backward compat for admin PIN modal) ───────────────────
        const lockout = await isLockedOut(prisma, tenantId, pinHash);
        if (lockout.locked) {
            await recordLoginAttempt(prisma, tenantId, pinHash, false, undefined, metadata);
            return {
                success: false,
                error: `Cuenta bloqueada. Intenta de nuevo en ${Math.ceil((lockout.until!.getTime() - Date.now()) / 60000)} minutos.`,
                errorCode: 'ACCOUNT_LOCKED',
                lockoutUntil: lockout.until,
            };
        }
        lockoutAttempts = lockout.attempts;

        employee = await prisma.employees.findFirst({
            where: { tenant_id: tenantId, pin_hash: pinHash },
            select: { id: true, name: true, role: true, is_active: true },
        });

        if (!employee) {
            await recordLoginAttempt(prisma, tenantId, pinHash, false, undefined, metadata);
            const remaining = MAX_FAILED_ATTEMPTS - lockoutAttempts - 1;
            return {
                success: false,
                error: remaining > 0
                    ? `PIN inválido. ${remaining} intento(s) restante(s).`
                    : 'PIN inválido. Cuenta bloqueada por 5 minutos.',
                errorCode: 'INVALID_PIN',
            };
        }
    }

    // ── Common path: active check, role authorization, session creation ───────────

    if (!employee.is_active) {
        await recordLoginAttempt(prisma, tenantId, pinHash, false, employee.id, metadata);
        return {
            success: false,
            error: 'Empleado inactivo. Contacta al administrador.',
            errorCode: 'INACTIVE_EMPLOYEE',
        };
    }

    if (!allowedRoles.includes(employee.role)) {
        await recordLoginAttempt(prisma, tenantId, pinHash, false, employee.id, metadata);
        await logAdminAccess(prisma, tenantId, employee.id, 'ACCESS_DENIED', {
            ...metadata,
            details: { reason: 'Role not allowed', allowedRoles: allowedRoles.join(',') },
        });
        return {
            success: false,
            error: `Rol ${employee.role} no autorizado para esta operación.`,
            errorCode: 'ROLE_NOT_ALLOWED',
        };
    }

    // Success
    await recordLoginAttempt(prisma, tenantId, pinHash, true, employee.id, metadata);
    const tokenHash = await generateTokenHash();
    const sessionId = await createSession(prisma, tenantId, employee.id, tokenHash, metadata);
    const { token, expiresAt } = await generateToken(employee, tenantId, sessionId);
    await logAdminAccess(prisma, tenantId, employee.id, 'LOGIN', metadata);

    return {
        success: true,
        token,
        employee: { id: employee.id, name: employee.name, role: employee.role },
        expiresAt,
    };
}

// Export constants for testing
export const AUTH_CONFIG = {
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_DURATION_MS,
    SESSION_DURATION_MS,
    SESSION_INACTIVITY_MS,
} as const;


// ============ REQUEST SESSION HELPER ============

export interface SessionInfo {
    employeeId: string;
    tenantId: string;
    role: string;
    name: string;
    sessionId: string;
}

/**
 * Extract and validate session from NextRequest
 * Returns null if not authenticated
 * 
 * Checks for token in this order:
 * 1. httpOnly cookie 'auth_token' (used by admin panel)
 * 2. Authorization header 'Bearer <token>' (used by API clients)
 */
export async function getSessionFromRequest(
    request: { 
        headers: { get(name: string): string | null };
        cookies?: { get(name: string): { value: string } | undefined };
    },
    prismaClient: PrismaClientType
): Promise<SessionInfo | null> {
    // Try to get token from cookie first (admin panel)
    let token: string | null = null;
    
    if (request.cookies) {
        const cookieToken = request.cookies.get('auth_token');
        if (cookieToken) {
            token = cookieToken.value;
        }
    }
    
    // Fallback to Authorization header (API clients)
    if (!token) {
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        }
    }

    // No token found
    if (!token) {
        return null;
    }

    // Validate token
    const tokenResult = await validateToken(token);
    if (!tokenResult.valid || !tokenResult.payload) {
        return null;
    }

    // Validate session is still active
    const sessionResult = await validateSession(prismaClient, tokenResult.payload.sid);
    if (!sessionResult.valid) {
        return null;
    }

    return {
        employeeId: tokenResult.payload.sub,
        tenantId: tokenResult.payload.tid,
        role: tokenResult.payload.role,
        name: tokenResult.payload.name,
        sessionId: tokenResult.payload.sid,
    };
}
