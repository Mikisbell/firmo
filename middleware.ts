/**
 * Next.js Middleware
 * 
 * Validates JWT tokens from httpOnly cookies for admin routes
 * Adds user information to request headers for downstream use
 * 
 * Uses Edge Runtime compatible JWT validation (Web Crypto API)
 * Node.js crypto operations are kept out of middleware
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateTokenMiddleware, extractToken } from '@/src/core/auth/middleware-auth';
import { rateLimitMiddleware } from '@/src/middleware/rate-limit';

// Routes that require server-side authentication (defense-in-depth)
// Client-side AuthContext is the primary auth layer for UI pages,
// but middleware adds server-side JWT validation as a second layer.
const PROTECTED_ROUTES: string[] = ['/admin'];

// Routes that should skip authentication (public or have their own auth)
const PUBLIC_ROUTES = ['/api/auth', '/pos', '/mozo', '/cocina', '/caja', '/bar', '/inventario', '/menu', '/api/menu'];

// API routes that handle their own authentication (should not be redirected)
const API_ROUTES_WITH_OWN_AUTH = ['/api/admin', '/api/inventory'];

export async function middleware(request: NextRequest) {
  // Apply rate limiting first
  const rateLimitResult = await rateLimitMiddleware(request);
  if (rateLimitResult) {
    return rateLimitResult;
  }
  
  const { pathname } = request.nextUrl;

  // Skip public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip API routes that handle their own authentication
  // These routes should return 401 JSON, not redirect
  if (API_ROUTES_WITH_OWN_AUTH.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route requires authentication
  const requiresAuth = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (!requiresAuth) {
    return NextResponse.next();
  }

  // Get token using Edge-compatible extraction
  const token = extractToken(request);

  if (!token) {
    // No token, redirect to login (only for UI pages, not APIs)
    const loginUrl = new URL('/admin', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Validate token using Edge Runtime compatible function
    // This uses Web Crypto API via jose - NO Node.js crypto
    const tokenResult = await validateTokenMiddleware(token);

    if (!tokenResult.valid || !tokenResult.payload) {
      // Invalid token, clear cookie and redirect to login
      const response = NextResponse.redirect(new URL('/admin', request.url));
      response.cookies.delete('auth_token');
      return response;
    }

    // Token is valid, add user info to headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', tokenResult.payload.sub);
    requestHeaders.set('x-user-role', tokenResult.payload.role);
    requestHeaders.set('x-user-name', tokenResult.payload.name || '');
    requestHeaders.set('x-tenant-id', tokenResult.payload.tid);
    requestHeaders.set('x-session-id', tokenResult.payload.sid);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Middleware auth error:', error);
    // On error, clear cookie and redirect to login
    const response = NextResponse.redirect(new URL('/admin', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
