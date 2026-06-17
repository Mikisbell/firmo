/**
 * auth.ts
 * Edge-compatible JWT authentication middleware.
 * Uses the `jose` library which uses WebCrypto and is fully compatible with Cloudflare Workers.
 */
import { jwtVerify, SignJWT } from 'jose';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  role: string;
  [key: string]: any;
}

/**
 * Gets the JWT secret from the environment.
 */
function getJwtSecret(): Uint8Array {
  const secretStr = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
  return new TextEncoder().encode(secretStr);
}

/**
 * Verifies a JWT token using `jose` (Edge-friendly).
 * @param token The raw JWT token string
 * @returns The decoded payload if valid, null otherwise
 */
export async function verifyEdgeJwt(token: string): Promise<AuthPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as AuthPayload;
  } catch (error) {
    console.error('Edge JWT verification failed:', error);
    return null;
  }
}

/**
 * Creates a new JWT token using `jose` (Edge-friendly).
 * @param payload The payload to sign
 * @param expiresIn Expiration string (e.g. '2h')
 */
export async function signEdgeJwt(payload: AuthPayload, expiresIn: string = '24h'): Promise<string> {
  const secret = getJwtSecret();
  const jwt = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
  return jwt;
}

/**
 * Helper to extract Bearer token from headers.
 */
export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
}
