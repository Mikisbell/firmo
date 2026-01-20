/**
 * API Route: Session Management
 * 
 * POST - Login with PIN, get JWT token
 * GET - Validate current session
 * DELETE - Logout (revoke session)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { 
    authenticate, 
    validateToken, 
    validateSession,
    revokeSession,
    logAdminAccess,
} from '@/src/core/auth/auth.service';

// Default tenant for MVP (will be dynamic in multi-tenant)
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const LoginSchema = z.object({
    pin: z.string().min(4).max(6),
    allowedRoles: z.array(z.string()).min(1),
    tenantId: z.string().uuid().optional(),
});

/**
 * POST /api/auth/session - Login
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pin, allowedRoles, tenantId } = LoginSchema.parse(body);

        const effectiveTenantId = tenantId || DEFAULT_TENANT_ID;

        // Extract metadata
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
        const userAgent = request.headers.get('user-agent') || undefined;
        const terminalId = request.headers.get('x-terminal-id') || undefined;

        const result = await authenticate(
            prisma,
            effectiveTenantId,
            pin,
            allowedRoles,
            { ip, userAgent, terminalId }
        );

        if (!result.success) {
            const status = result.errorCode === 'ACCOUNT_LOCKED' ? 429 : 401;
            return NextResponse.json(
                { 
                    error: result.error, 
                    errorCode: result.errorCode,
                    lockoutUntil: result.lockoutUntil?.toISOString(),
                },
                { status }
            );
        }

        // Create response with httpOnly cookie
        const response = NextResponse.json({
            success: true,
            employee: result.employee,
            expiresAt: result.expiresAt?.toISOString(),
        });

        // Set httpOnly cookie with JWT token
        response.cookies.set('auth_token', result.token!, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 60, // 30 minutes
            path: '/',
        });

        return response;
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: error.errors },
                { status: 400 }
            );
        }

        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/auth/session - Validate session
 */
export async function GET(request: NextRequest) {
    try {
        // Try to get token from cookie first, fallback to Authorization header for backwards compatibility
        const cookieToken = request.cookies.get('auth_token')?.value;
        const authHeader = request.headers.get('authorization');
        const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        
        const token = cookieToken || headerToken;
        
        if (!token) {
            return NextResponse.json(
                { error: 'Token no proporcionado' },
                { status: 401 }
            );
        }

        const tokenResult = await validateToken(token);

        if (!tokenResult.valid || !tokenResult.payload) {
            return NextResponse.json(
                { error: tokenResult.error || 'Token inválido' },
                { status: 401 }
            );
        }

        // Validate session is still active
        const sessionResult = await validateSession(prisma, tokenResult.payload.sid);
        if (!sessionResult.valid) {
            return NextResponse.json(
                { error: sessionResult.error || 'Sesión inválida' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            valid: true,
            employee: {
                id: tokenResult.payload.sub,
                name: tokenResult.payload.name,
                role: tokenResult.payload.role,
            },
            tenantId: tokenResult.payload.tid,
            sessionId: tokenResult.payload.sid,
        });
    } catch (error) {
        console.error('Session validation error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/auth/session - Logout
 */
export async function DELETE(request: NextRequest) {
    try {
        // Try to get token from cookie first, fallback to Authorization header
        const cookieToken = request.cookies.get('auth_token')?.value;
        const authHeader = request.headers.get('authorization');
        const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        
        const token = cookieToken || headerToken;
        
        if (!token) {
            // No token, just clear cookie and return success
            const response = NextResponse.json({ success: true });
            response.cookies.delete('auth_token');
            return response;
        }

        const tokenResult = await validateToken(token);

        if (tokenResult.valid && tokenResult.payload) {
            // Revoke session
            await revokeSession(prisma, tokenResult.payload.sid);

            // Log logout
            await logAdminAccess(
                prisma,
                tokenResult.payload.tid,
                tokenResult.payload.sub,
                'LOGOUT',
                {
                    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
                    userAgent: request.headers.get('user-agent') || undefined,
                }
            );
        }

        // Clear cookie
        const response = NextResponse.json({ success: true });
        response.cookies.delete('auth_token');
        return response;
    } catch (error) {
        console.error('Logout error:', error);
        const response = NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
        response.cookies.delete('auth_token');
        return response;
    }
}
