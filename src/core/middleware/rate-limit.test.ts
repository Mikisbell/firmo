/**
 * Rate Limiting Middleware Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { rateLimit, clearRateLimitCounters, getRetryAfterSeconds } from './rate-limit';

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    // Limpiar contadores antes de cada test
    clearRateLimitCounters();
  });

  it('permite requests dentro del límite', async () => {
    const request = new NextRequest('http://localhost:3000/api/test');
    const config = { maxRequests: 5, windowMs: 60000 };

    // Hacer 5 requests (dentro del límite)
    for (let i = 0; i < 5; i++) {
      const result = await rateLimit(request, config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - i - 1);
    }
  });

  it('bloquea requests que exceden el límite', async () => {
    const request = new NextRequest('http://localhost:3000/api/test');
    const config = { maxRequests: 3, windowMs: 60000 };

    // Hacer 3 requests (dentro del límite)
    for (let i = 0; i < 3; i++) {
      const result = await rateLimit(request, config);
      expect(result.allowed).toBe(true);
    }

    // El 4to request debe ser bloqueado
    const result = await rateLimit(request, config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resetea contador después de la ventana de tiempo', async () => {
    const request = new NextRequest('http://localhost:3000/api/test');
    const config = { maxRequests: 2, windowMs: 100 }; // 100ms window

    // Hacer 2 requests
    await rateLimit(request, config);
    await rateLimit(request, config);

    // El 3ro debe ser bloqueado
    let result = await rateLimit(request, config);
    expect(result.allowed).toBe(false);

    // Esperar que expire la ventana
    await new Promise(resolve => setTimeout(resolve, 150));

    // Ahora debe permitir nuevamente
    result = await rateLimit(request, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('maneja múltiples IPs simultáneamente', async () => {
    const config = { maxRequests: 2, windowMs: 60000 };

    // Request desde IP 1
    const request1 = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });

    // Request desde IP 2
    const request2 = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '192.168.1.2' },
    });

    // Cada IP debe tener su propio contador
    await rateLimit(request1, config);
    await rateLimit(request1, config);
    
    // IP 1 debe estar bloqueada
    let result = await rateLimit(request1, config);
    expect(result.allowed).toBe(false);

    // IP 2 debe estar permitida
    result = await rateLimit(request2, config);
    expect(result.allowed).toBe(true);
  });

  it('diferencia entre endpoints diferentes', async () => {
    const config = { maxRequests: 2, windowMs: 60000 };

    const request1 = new NextRequest('http://localhost:3000/api/endpoint1');
    const request2 = new NextRequest('http://localhost:3000/api/endpoint2');

    // Hacer 2 requests a endpoint1
    await rateLimit(request1, config);
    await rateLimit(request1, config);

    // endpoint1 debe estar bloqueado
    let result = await rateLimit(request1, config);
    expect(result.allowed).toBe(false);

    // endpoint2 debe estar permitido (contador separado)
    result = await rateLimit(request2, config);
    expect(result.allowed).toBe(true);
  });

  it('calcula correctamente el tiempo de retry', () => {
    const resetAt = Date.now() + 5000; // 5 segundos en el futuro
    const retryAfter = getRetryAfterSeconds(resetAt);
    
    expect(retryAfter).toBeGreaterThanOrEqual(4);
    expect(retryAfter).toBeLessThanOrEqual(6);
  });

  it('maneja IP undefined correctamente', async () => {
    const request = new NextRequest('http://localhost:3000/api/test');
    const config = { maxRequests: 2, windowMs: 60000 };

    // Debe usar 'unknown' como fallback
    const result = await rateLimit(request, config);
    expect(result.allowed).toBe(true);
  });
});
