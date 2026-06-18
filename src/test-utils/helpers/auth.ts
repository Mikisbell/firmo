/**
 * Helpers de auth para tests — firma JWTs para tests de rutas autenticadas.
 *
 * Replica el contrato EXACTO que verifican las rutas de produccion
 * (src/core/auth/auth.service.ts y src/app/api/data-sync/ingest/route.ts):
 *   - secret:   process.env.JWT_SECRET (TextEncoder().encode), HS256
 *   - issuer:   'park-pos'
 *   - audience: 'park-pos-client'
 *   - claims:   tid (tenant_id), sub (actor_id), role
 *
 * vitest.config.ts (test.env) provee JWT_SECRET en import-time, asi que
 * firmar aca usa la misma llave contra la que verifican las rutas.
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
            'JWT_SECRET no esta definido en el entorno de test. ' +
            'Revisa vitest.config.ts (test.env.JWT_SECRET).'
        );
    }
    return new TextEncoder().encode(secret);
}

export interface TestTokenOptions {
    /** tenant_id → claim `tid` (el que el ingest fuerza sobre cada evento). */
    tenantId: string;
    /** actor_id → claim `sub`. */
    actorId?: string;
    /** rol del actor → claim `role`. */
    role?: string;
    /** session_id → claim `sid` (requerido por requirePosAuth/validateSession). */
    sessionId?: string;
    /** nombre del actor → claim `name`. */
    name?: string;
}

/**
 * Firma un JWT de prueba con el mismo contrato que verifican las rutas.
 * Usar en headers como `Authorization: Bearer <token>` o cookie `auth_token=<token>`.
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
 * Helper de conveniencia: devuelve el header Authorization listo para usar.
 */
export async function bearerHeader(opts: TestTokenOptions): Promise<{ authorization: string }> {
    const token = await signTestToken(opts);
    return { authorization: `Bearer ${token}` };
}
