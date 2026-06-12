/**
 * CORS Helpers
 * Utilidades para manejar CORS en API routes
 */

import { NextResponse } from 'next/server';

/**
 * Maneja preflight requests (OPTIONS)
 * Retorna respuesta 204 con headers CORS apropiados
 * Valida que el origen esté permitido
 */
export function handleCorsPreflightRequest(origin?: string | null): NextResponse {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  // Validar origen
  const isVercel = origin && origin.endsWith('.vercel.app');
  const isAllowed = origin && (allowedOrigins.includes(origin) || isVercel);
  
  if (!isAllowed) {
    // Si el origen no está permitido, retornar 403
    console.warn(`[CORS] Request from origin '${origin}' was rejected.`);
    return new NextResponse(null, {
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': origin, // Solo el origen específico
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Api-Secret',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

/**
 * Valida si el origen está permitido
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  const isVercel = origin.endsWith('.vercel.app');
  return allowedOrigins.includes(origin) || isVercel;
}

/**
 * Agrega headers CORS a una respuesta existente
 */
export function addCorsHeaders(response: NextResponse, origin?: string): NextResponse {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  // Si se proporciona un origen específico y está permitido, usarlo
  const allowOrigin = origin && isOriginAllowed(origin) 
    ? origin 
    : allowedOrigins[0]; // Usar el primero como fallback

  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Origin', allowOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Api-Secret');

  return response;
}
