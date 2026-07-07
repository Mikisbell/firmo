/**
 * Middleware-safe JWT utilities
 * 
 * Uses Web Crypto API (via jose) - compatible with Edge Runtime
 * NO usa Node.js crypto - puede ejecutarse en middleware
 * 
 * @module middleware-auth
 */

import { jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET_STRING = process.env.JWT_SECRET;
const JWT_SECRET = JWT_SECRET_STRING 
  ? new TextEncoder().encode(JWT_SECRET_STRING) 
  : null;

export interface TokenPayload extends JWTPayload {
  sub: string;        // employee_id
  tid: string;        // tenant_id
  role: string;       // employee role
  name: string;       // employee name
  sid: string;        // session_id
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}

/**
 * Validate JWT token - Edge Runtime compatible
 * Uses Web Crypto API via jose library
 */
export async function validateTokenMiddleware(token: string): Promise<TokenValidationResult> {
  if (!JWT_SECRET) {
    return { valid: false, error: 'JWT_SECRET not configured' };
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: 'firmo-pos',
      audience: 'firmo-pos-client',
    });

    // Validate required fields
    if (!payload.sub || !payload.tid || !payload.role) {
      return { valid: false, error: 'Invalid token payload' };
    }

    return {
      valid: true,
      payload: payload as TokenPayload,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'JWTExpired') {
        return { valid: false, error: 'Token expired' };
      }
      if (error.name === 'JWTInvalid') {
        return { valid: false, error: 'Invalid token' };
      }
    }
    return { valid: false, error: 'Token validation failed' };
  }
}

/**
 * Extract token from request (cookie or header)
 * Edge Runtime compatible
 */
export function extractToken(request: Request): string | null {
  // Try cookie first
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/auth_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  
  // Try Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  return null;
}
