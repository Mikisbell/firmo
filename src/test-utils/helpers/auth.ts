/**
 * Test auth helpers — sign JWTs for authenticated route tests.
 *
 * Replicates the EXACT contract that production routes verify
 * (src/core/auth/auth.service.ts and src/app/api/data-sync/ingest/route.ts):
 *   - secret:   process.env.JWT_SECRET (TextEncoder().encode), HS256
 *   - issuer:   'park-pos'
 *   - audience: 'park-pos-client'
 *   - claims:   tid (tenant_id), sub (actor_id), role
 *
 * JWT_SECRET is provided by vitest.config.ts (test.env) at import-time,
 * so signing here uses the same key the routes verify against.
 *
 * @module test-utils/helpers/auth
 */

import { SignJWT } from 'jose';

const JWT_ISSUER = 'park-pos';
const JWT_AUDIENCE = 'park-pos-client';

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            'JWT_SECRET is not defined in the test environment. ' +
            'Check vitest.config.ts (test.env.JWT_SECRET).'
        );
    }
    return new TextEncoder().encode(secret);
}

export interface TestTokenOptions {
    /** tenant_id → claim `tid` (forced by the ingest onto every event). */
    tenantId: string;
    /** actor_id → claim `sub`. */
    actorId?: string;
    /** actor role → claim `role`. */
    role?: string;
    /** session_id → claim `sid` (required by requirePosAuth/validateSession). */
    sessionId?: string;
    /** actor name → claim `name`. */
    name?: string;
}

/**
 * Signs a test JWT with the same contract the routes verify.
 * Use in headers as `Authorization: Bearer <token>` or cookie `auth_token=<token>`.
 */
export async function signTestToken(opts: TestTokenOptions): Promise<string> {
    const {
        tenantId,
        actorId = '33333333-3333-3333-3333-333333333333',
        role = 'CASHIER',
        sessionId = '44444444-4444-4444-4444-444444444444',
        name = 'Test Actor',
    } = opts;

    return new SignJWT({
        tid: tenantId,
        sub: actorId,
        role,
        sid: sessionId,
        name,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setExpirationTime('1h')
        .sign(getSecret());
}

/**
 * Convenience helper: returns a ready-to-use Authorization header.
 */
export async function bearerHeader(opts: TestTokenOptions): Promise<{ authorization: string }> {
    const token = await signTestToken(opts);
    return { authorization: `Bearer ${token}` };
}
