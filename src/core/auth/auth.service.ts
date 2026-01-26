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

import { createHash, randomBytes } from 'crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

type PrismaClientType = any;

// Configuration
// CRITICAL: PIN_SALT must be configured in production
const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';
if (!process.env.PIN_SALT && process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY ERROR: PIN_SALT must be configured in production environment');
}

// CRITICAL: JWT_SECRET must be configured in production
const JWT_SECRET_STRING = process.env.JWT_SECRET;
if (!JWT_SECRET_STRING && process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY ERROR: JWT_SECRET must be configured in production environment');
}
const JWT_SECRET = new TextEncoder().encode(
    JWT_SECRET_STRING || 'park-pos-jwt-secret-dev-only-DO-NOT-USE-IN-PRODUCTION'
);
const JWT_ISSUER = 'park-pos';
const JWT_AUDIENCE = 'park-pos-client';

// Lockout settings
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes

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
    errorCode?: 'INVALID_PIN' | 'ACCOUNT_LOCKED' | 'ROLE_NOT_ALLOWED' | 'INACTIVE_EMPLOYEE';
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
 * Hash a PIN using SHA256 + salt
 */
export function hashPin(pin: string): string {
    return createHash('sha256').update(SALT + pin).digest('hex');
}

/**
 * Check if an employee is locked out due to failed attempts
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
            created_at: { gte: since },
        },
        orderBy: { created_at: 'desc' },
        take: MAX_FAILED_ATTEMPTS + 1,
    });

    const failedAttempts = recentAttempts.filter((a: { success: boolean }) => !a.success);
    
    if (failedAttempts.length >= MAX_FAILED_ATTEMPTS) {
        const oldestFailed = failedAttempts[failedAttempts.length - 1];
        const lockoutUntil = new Date(oldestFailed.created_at.getTime() + LOCKOUT_DURATION_MS);
        
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
    await prisma.login_attempts.create({
        data: {
            id: randomBytes(16).toString('hex'),
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
    await prisma.admin_access_logs.create({
        data: {
            id: randomBytes(16).toString('hex'),
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
    const sessionId = randomBytes(16).toString('hex');
    
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
 * Full authentication flow with lockout and JWT
 */
export async function authenticate(
    prisma: PrismaClientType,
    tenantId: string,
    pin: string,
    allowedRoles: string[],
    metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<AuthResult> {
    const pinHash = hashPin(pin);

    // 1. Check lockout
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

    // 2. Find employee
    const employee = await prisma.employees.findFirst({
        where: {
            tenant_id: tenantId,
            pin_hash: pinHash,
        },
        select: {
            id: true,
            name: true,
            role: true,
            is_active: true,
        },
    });

    if (!employee) {
        await recordLoginAttempt(prisma, tenantId, pinHash, false, undefined, metadata);
        const remaining = MAX_FAILED_ATTEMPTS - lockout.attempts - 1;
        return {
            success: false,
            error: remaining > 0 
                ? `PIN inválido. ${remaining} intento(s) restante(s).`
                : 'PIN inválido. Cuenta bloqueada por 5 minutos.',
            errorCode: 'INVALID_PIN',
        };
    }

    // 3. Check if active
    if (!employee.is_active) {
        await recordLoginAttempt(prisma, tenantId, pinHash, false, employee.id, metadata);
        return {
            success: false,
            error: 'Empleado inactivo. Contacta al administrador.',
            errorCode: 'INACTIVE_EMPLOYEE',
        };
    }

    // 4. Check role
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

    // 5. Success - create session and token
    await recordLoginAttempt(prisma, tenantId, pinHash, true, employee.id, metadata);

    const tokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    const sessionId = await createSession(prisma, tenantId, employee.id, tokenHash, metadata);
    const { token, expiresAt } = await generateToken(employee, tenantId, sessionId);

    await logAdminAccess(prisma, tenantId, employee.id, 'LOGIN', metadata);

    return {
        success: true,
        token,
        employee: {
            id: employee.id,
            name: employee.name,
            role: employee.role,
        },
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
 */
export async function getSessionFromRequest(
    request: { headers: { get(name: string): string | null } },
    prismaClient: PrismaClientType
): Promise<SessionInfo | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7);
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
