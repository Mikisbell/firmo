/**
 * Rate Limiting Middleware
 * 
 * Implements basic rate limiting for API routes
 * Uses in-memory storage for development, Redis for production
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiting configuration (per IP per minute)
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // Max 100 requests per minute (general API)
  maxAuthRequests: 10, // Max 10 auth requests per minute (login, check-dni — brute force protection)
  maxSearchRequests: 30, // Max 30 search requests per minute (Cmd+K — scraping protection)
};

// In-memory storage for development (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from headers (set by auth middleware)
  const userId = request.headers.get('x-user-id');
  if (userId) return userId;
  
  // Fallback to IP address from headers
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

type RouteCategory = 'auth' | 'search' | 'api';

function getRouteCategory(pathname: string): RouteCategory {
  if (pathname.startsWith('/api/auth')) return 'auth';
  if (pathname.startsWith('/api/admin/search')) return 'search';
  return 'api';
}

function getMaxRequests(category: RouteCategory): number {
  switch (category) {
    case 'auth': return RATE_LIMIT.maxAuthRequests;
    case 'search': return RATE_LIMIT.maxSearchRequests;
    case 'api': return RATE_LIMIT.maxRequests;
  }
}

function isRateLimited(identifier: string, category: RouteCategory): boolean {
  const now = Date.now();
  const key = `${identifier}:${category}`;

  const record = rateLimitStore.get(key);
  const maxRequests = getMaxRequests(category);
  
  if (!record || now > record.resetTime) {
    // New window or expired window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return false;
  }
  
  if (record.count >= maxRequests) {
    return true;
  }
  
  record.count++;
  return false;
}

function getRateLimitHeaders(identifier: string, category: RouteCategory): Record<string, string> {
  const key = `${identifier}:${category}`;
  const record = rateLimitStore.get(key);
  const maxRequests = getMaxRequests(category);
  
  if (!record) {
    return {
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': maxRequests.toString(),
      'X-RateLimit-Reset': new Date(Date.now() + RATE_LIMIT.windowMs).toISOString(),
    };
  }
  
  const remaining = Math.max(0, maxRequests - record.count);
  const resetTime = new Date(record.resetTime).toISOString();
  
  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime,
  };
}

export async function rateLimitMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const identifier = getClientIdentifier(request);
  
  // Skip rate limiting for non-API routes
  if (!pathname.startsWith('/api/')) {
    return null;
  }

  // Categorize route for appropriate rate limit tier
  const category = getRouteCategory(pathname);

  // Check rate limit
  const limited = isRateLimited(identifier, category);
  const headers = getRateLimitHeaders(identifier, category);
  
  if (limited) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(RATE_LIMIT.windowMs / 1000),
      },
      {
        status: 429,
        headers,
      }
    );
  }
  
  // Add rate limit headers to successful requests
  const response = NextResponse.next();
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}