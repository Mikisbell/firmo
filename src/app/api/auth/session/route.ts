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

        return NextResponse.json({
            success: true,
            token: result.token,
            employee: result.employee,
            expiresAt: result.expiresAt?.toISOString(),
        });
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
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Token no proporcionado' },
                { status: 401 }
            );
        }

        const token = authHeader.slice(7);
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
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Token no proporcionado' },
                { status: 401 }
            );
        }

        const token = authHeader.slice(7);
        const tokenResult = await validateToken(token);

        if (!tokenResult.valid || !tokenResult.payload) {
            return NextResponse.json({ success: true }); // Already invalid
        }

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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
