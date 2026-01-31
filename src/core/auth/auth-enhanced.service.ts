/**
 * Enhanced Authentication Service with bcrypt and MFA support
 * 
 * Security improvements:
 * - bcrypt for PIN hashing (instead of SHA256)
 * - MFA support for admin roles
 * - Refresh tokens for better session management
 * - Enhanced audit logging
 */

import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

type PrismaClientType = any;

// Enhanced Security Configuration
const SALT_ROUNDS = 12; // bcrypt salt rounds
const JWT_SECRET_STRING = process.env.JWT_SECRET;
if (!JWT_SECRET_STRING && process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY ERROR: JWT_SECRET must be configured in production environment');
}
const JWT_SECRET = new TextEncoder().encode(
    JWT_SECRET_STRING || 'park-pos-jwt-secret-dev-only-DO-NOT-USE-IN-PRODUCTION'
);

// Separate secrets for different token types
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET_STRING;

const JWT_ISSUER = 'park-pos';
const JWT_AUDIENCE = 'park-pos-client';

// Enhanced lockout settings
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthPayload extends JWTPayload {
    sub: string;        // employee_id
    tid: string;        // tenant_id
    role: string;       // employee role
    name: string;       // employee name
    sid: string;        // session_id
    mfa?: boolean;      // MFA verified flag
}

export interface RefreshTokenPayload extends JWTPayload {
    sub: string;        // employee_id
    tid: string;        // tenant_id
    type: 'refresh';    // token type
    jti: string;        // refresh token ID
}

export interface AuthResult {
    success: boolean;
    error?: string;
    errorCode?: 'INVALID_PIN' | 'ACCOUNT_LOCKED' | 'ROLE_NOT_ALLOWED' | 'INACTIVE_EMPLOYEE' | 'MFA_REQUIRED';
    token?: string;
    refreshToken?: string;
    employee?: {
        id: string;
        name: string;
        role: string;
    };
    expiresAt?: Date;
    lockoutUntil?: Date;
    mfaRequired?: boolean;
    mfaChallenge?: string;
}

export interface TokenValidationResult {
    valid: boolean;
    error?: string;
    payload?: AuthPayload;
}

export interface MFAResult {
    success: boolean;
    error?: string;
    verified?: boolean;
}

/**
 * Hash PIN using bcrypt (much more secure than SHA256)
 */
export async function hashPin(pin: string): Promise<string> {
    return await bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Verify PIN using bcrypt
 */
export async function verifyPin(pin: string, hashedPin: string): Promise<boolean> {
    return await bcrypt.compare(pin, hashedPin);
}

/**
 * Generate MFA challenge (TOTP or backup code)
 */
export function generateMFAChallenge(): { challenge: string; backupCode: string } {
    const challenge = Math.floor(100000 + Math.random() * 900000).toString();
    const backupCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    return { challenge, backupCode };
}

/**
 * Store MFA challenge in Redis/database
 */
export async function storeMFAChallenge(
    prisma: PrismaClientType,
    tenantId: string,
    employeeId: string,
    challenge: string,
    backupCode: string,
    expiresMs: number = 5 * 60 * 1000 // 5 minutes
): Promise<void> {
    await prisma.mfa_challenges.create({
        data: {
            id: randomBytes(16).toString('hex'),
            tenant_id: tenantId,
            employee_id: employeeId,
            challenge,
            backup_code: backupCode,
            expires_at: new Date(Date.now() + expiresMs),
            created_at: new Date(),
        },
    });
}

/**
 * Verify MFA challenge
 */
export async function verifyMFAChallenge(
    prisma: PrismaClientType,
    tenantId: string,
    employeeId: string,
    providedCode: string
): Promise<MFAResult> {
    const validChallenge = await prisma.mfa_challenges.findFirst({
        where: {
            tenant_id: tenantId,
            employee_id: employeeId,
            expires_at: { gte: new Date() },
            used_at: null,
        },
        orderBy: { created_at: 'desc' },
    });

    if (!validChallenge) {
        return { success: false, error: 'MFA challenge expired or not found' };
    }

    const isValid = providedCode === validChallenge.challenge || providedCode === validChallenge.backup_code;
    
    if (isValid) {
        // Mark challenge as used
        await prisma.mfa_challenges.update({
            where: { id: validChallenge.id },
            data: { used_at: new Date() },
        });
        
        return { success: true, verified: true };
    }

    return { success: false, error: 'Invalid MFA code' };
}

/**
 * Check if employee is locked out due to failed attempts
 */
export async function isLockedOut(
    prisma: PrismaClientType,
    tenantId: string,
    employeeId: string
): Promise<{ locked: boolean; until?: Date; attempts: number }> {
    const since = new Date(Date.now() - LOCKOUT_DURATION_MS);
    
    const recentAttempts = await prisma.login_attempts.findMany({
        where: {
            tenant_id: tenantId,
            employee_id: employeeId,
            success: false,
            created_at: { gte: since },
        },
        orderBy: { created_at: 'desc' },
        take: MAX_FAILED_ATTEMPTS + 1,
    });

    if (recentAttempts.length >= MAX_FAILED_ATTEMPTS) {
        const oldestFailed = recentAttempts[recentAttempts.length - 1];
        const lockoutUntil = new Date(oldestFailed.created_at.getTime() + LOCKOUT_DURATION_MS);
        
        if (lockoutUntil > new Date()) {
            return { locked: true, until: lockoutUntil, attempts: recentAttempts.length };
        }
    }

    return { locked: false, attempts: recentAttempts.length };
}

/**
 * Record a login attempt with enhanced metadata
 */
export async function recordLoginAttempt(
    prisma: PrismaClientType,
    tenantId: string,
    employeeId?: string,
    success: boolean,
    metadata?: { 
        ip?: string; 
        userAgent?: string; 
        terminalId?: string;
        mfaVerified?: boolean;
        attemptType?: 'password' | 'mfa';
    }
): Promise<void> {
    await prisma.login_attempts.create({
        data: {
            id: randomBytes(16).toString('hex'),
            tenant_id: tenantId,
            employee_id: employeeId,
            success,
            ip_address: metadata?.ip,
            user_agent: metadata?.userAgent,
            terminal_id: metadata?.terminalId,
            // Additional metadata could be stored in a JSON field if needed
        },
    });
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(
    employeeId: string,
    tenantId: string
): Promise<{ token: string; tokenId: string }> {
    const tokenId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DURATION_MS);
    
    const refreshTokenSecret = new TextEncoder().encode(REFRESH_TOKEN_SECRET);
    
    const token = await new SignJWT({
        sub: employeeId,
        tid: tenantId,
        type: 'refresh',
        jti: tokenId,
    } as RefreshTokenPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setExpirationTime(expiresAt)
        .sign(refreshTokenSecret);

    return { token, tokenId };
}

/**
 * Generate enhanced JWT token with MFA flag
 */
export async function generateToken(
    employee: { id: string; name: string; role: string },
    tenantId: string,
    sessionId: string,
    mfaVerified: boolean = false
): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    
    const token = await new SignJWT({
        sub: employee.id,
        tid: tenantId,
        role: employee.role,
        name: employee.name,
        sid: sessionId,
        mfa: mfaVerified,
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
 * Enhanced authentication with MFA support
 */
export async function authenticate(
    prisma: PrismaClientType,
    tenantId: string,
    pin: string,
    allowedRoles: string[],
    metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<AuthResult> {
    // Find employee first (needed for lockout check)
    const employee = await prisma.employees.findFirst({
        where: { tenant_id: tenantId, is_active: true },
        select: { id: true, name: true, role: true, pin_hash: true },
    });

    if (!employee) {
        return {
            success: false,
            error: 'Credenciales inválidas',
            errorCode: 'INVALID_PIN',
        };
    }

    // Check lockout
    const lockout = await isLockedOut(prisma, tenantId, employee.id);
    
    if (lockout.locked) {
        await recordLoginAttempt(prisma, tenantId, employee.id, false, metadata);
        return {
            success: false,
            error: `Cuenta bloqueada. Intenta de nuevo en ${Math.ceil((lockout.until!.getTime() - Date.now()) / 60000)} minutos.`,
            errorCode: 'ACCOUNT_LOCKED',
            lockoutUntil: lockout.until,
        };
    }

    // Verify PIN with bcrypt
    const pinValid = await verifyPin(pin, employee.pin_hash);
    
    if (!pinValid) {
        await recordLoginAttempt(prisma, tenantId, employee.id, false, { ...metadata, attemptType: 'password' });
        const remaining = MAX_FAILED_ATTEMPTS - lockout.attempts - 1;
        return {
            success: false,
            error: remaining > 0 
                ? `PIN inválido. ${remaining} intento(s) restante(s).`
                : 'PIN inválido. Cuenta bloqueada por 5 minutos.',
            errorCode: 'INVALID_PIN',
        };
    }

    // Check role
    if (!allowedRoles.includes(employee.role)) {
        await recordLoginAttempt(prisma, tenantId, employee.id, false, metadata);
        return {
            success: false,
            error: `Rol ${employee.role} no autorizado para esta operación.`,
            errorCode: 'ROLE_NOT_ALLOWED',
        };
    }

    // MFA required for admin roles
    const requiresMFA = ['ADMIN', 'MANAGER'].includes(employee.role);
    
    if (requiresMFA) {
        const { challenge, backupCode } = generateMFAChallenge();
        await storeMFAChallenge(prisma, tenantId, employee.id, challenge, backupCode);
        
        return {
            success: false,
            error: 'Se requiere código de verificación de dos factores',
            errorCode: 'MFA_REQUIRED',
            mfaRequired: true,
            mfaChallenge: challenge,
        };
    }

    // Complete authentication
    await recordLoginAttempt(prisma, tenantId, employee.id, true, { ...metadata, mfaVerified: false });

    // Create session and tokens
    const tokenHash = randomBytes(32).toString('hex');
    const sessionId = await createSession(prisma, tenantId, employee.id, tokenHash, metadata);
    const { token } = await generateToken(employee, tenantId, sessionId);
    const { token: refreshToken, tokenId } = await generateRefreshToken(employee.id, tenantId);

    // Store refresh token
    await prisma.refresh_tokens.create({
        data: {
            id: tokenId,
            tenant_id: tenantId,
            employee_id: employee.id,
            token_hash: tokenHash,
            expires_at: new Date(Date.now() + REFRESH_TOKEN_DURATION_MS),
            created_at: new Date(),
        },
    });

    return {
        success: true,
        token,
        refreshToken,
        employee: {
            id: employee.id,
            name: employee.name,
            role: employee.role,
        },
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    };
}

/**
 * Verify MFA and complete authentication
 */
export async function authenticateWithMFA(
    prisma: PrismaClientType,
    tenantId: string,
    employeeId: string,
    mfaCode: string,
    metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<AuthResult> {
    const mfaResult = await verifyMFAChallenge(prisma, tenantId, employeeId, mfaCode);
    
    if (!mfaResult.verified) {
        return {
            success: false,
            error: 'Código MFA inválido o expirado',
            errorCode: 'INVALID_MFA',
        };
    }

    const employee = await prisma.employees.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, role: true },
    });

    if (!employee) {
        return {
            success: false,
            error: 'Empleado no encontrado',
            errorCode: 'EMPLOYEE_NOT_FOUND',
        };
    }

    // Complete authentication with MFA
    await recordLoginAttempt(prisma, tenantId, employeeId, true, { ...metadata, mfaVerified: true, attemptType: 'mfa' });

    // Create session and tokens
    const tokenHash = randomBytes(32).toString('hex');
    const sessionId = await createSession(prisma, tenantId, employeeId, tokenHash, metadata);
    const { token } = await generateToken(employee, tenantId, sessionId, true);
    const { token: refreshToken, tokenId } = await generateRefreshToken(employeeId, tenantId);

    // Store refresh token
    await prisma.refresh_tokens.create({
        data: {
            id: tokenId,
            tenant_id: tenantId,
            employee_id: employeeId,
            token_hash: tokenHash,
            expires_at: new Date(Date.now() + REFRESH_TOKEN_DURATION_MS),
            created_at: new Date(),
        },
    });

    return {
        success: true,
        token,
        refreshToken,
        employee: {
            id: employee.id,
            name: employee.name,
            role: employee.role,
        },
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    };
}

// Keep existing functions for backward compatibility
export { validateToken, createSession, validateSession, revokeSession, revokeAllSessions, logAdminAccess };
export const AUTH_CONFIG = {
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_DURATION_MS,
    SESSION_DURATION_MS,
    SESSION_INACTIVITY_MS,
    REFRESH_TOKEN_DURATION_MS,
} as const;