/**
 * Shared helpers for HR API routes.
 *
 * Provides a single `resultToResponse` converter that maps the Result pattern
 * (used by all domain services) to appropriate HTTP status codes.
 */

import { NextResponse } from 'next/server';
import type { Result, DomainError } from '@/src/core/result';

/**
 * Convert a service Result<T, DomainError> into a NextResponse.
 *
 * Error code mapping:
 *   NOT_FOUND        -> 404
 *   VALIDATION_ERROR -> 400
 *   CONFLICT         -> 409
 *   UNAUTHORIZED     -> 401
 *   FORBIDDEN        -> 403
 *   (anything else)  -> 500
 */
export function resultToResponse<T>(
  result: Result<T, DomainError>,
  successStatus = 200,
): NextResponse {
  if (!result.success) {
    const status =
      result.error.code === 'NOT_FOUND'
        ? 404
        : result.error.code === 'VALIDATION_ERROR'
          ? 400
          : result.error.code === 'CONFLICT'
            ? 409
            : result.error.code === 'UNAUTHORIZED'
              ? 401
              : result.error.code === 'FORBIDDEN'
                ? 403
                : 500;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.data, { status: successStatus });
}
