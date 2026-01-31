/**
 * Tests for Authentication Service
 * 
 * Property-based tests + unit tests for:
 * - PIN hashing
 * - JWT generation/validation
 * - Lockout logic
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    hashPin,
    generateToken,
    validateToken,
    AUTH_CONFIG,
} from '../auth.service';

describe('Authentication Service', () => {
    describe('hashPin', () => {
        // Property 1: Same PIN always produces same hash
        it('Property 1: hashPin is deterministic', () => {
            fc.assert(
                fc.property(fc.string({ minLength: 4, maxLength: 6 }), (pin) => {
                    const hash1 = hashPin(pin);
                    const hash2 = hashPin(pin);
                    expect(hash1).toBe(hash2);
                }),
                { numRuns: 100 }
            );
        });

        // Property 2: Different PINs produce different hashes
        it('Property 2: Different PINs produce different hashes', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 4, maxLength: 6 }),
                    fc.string({ minLength: 4, maxLength: 6 }),
                    (pin1, pin2) => {
                        fc.pre(pin1 !== pin2);
                        const hash1 = hashPin(pin1);
                        const hash2 = hashPin(pin2);
                        expect(hash1).not.toBe(hash2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        // Property 3: Hash is always 64 characters (SHA256 hex)
        it('Property 3: Hash is always 64 characters', () => {
            fc.assert(
                fc.property(fc.string({ minLength: 1, maxLength: 10 }), (pin) => {
                    const hash = hashPin(pin);
                    expect(hash).toHaveLength(64);
                    expect(hash).toMatch(/^[a-f0-9]+$/);
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('JWT Token', () => {
        const mockEmployee = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test User',
            role: 'ADMIN',
        };
        const tenantId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const sessionId = '987fcdeb-51a2-3456-7890-abcdef123456';

        // Property 4: Generated token can be validated
        it('Property 4: Token round-trip', async () => {
            const { token } = await generateToken(mockEmployee, tenantId, sessionId);
            const result = await validateToken(token);

            expect(result.valid).toBe(true);
            expect(result.payload?.sub).toBe(mockEmployee.id);
            expect(result.payload?.tid).toBe(tenantId);
            expect(result.payload?.role).toBe(mockEmployee.role);
            expect(result.payload?.name).toBe(mockEmployee.name);
            expect(result.payload?.sid).toBe(sessionId);
        });

        // Property 5: Invalid token is rejected
        it('Property 5: Invalid token is rejected', async () => {
            const result = await validateToken('invalid.token.here');
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        // Property 6: Tampered token is rejected
        it('Property 6: Tampered token is rejected', async () => {
            const { token } = await generateToken(mockEmployee, tenantId, sessionId);
            
            // Tamper with the payload
            const parts = token.split('.');
            const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64url');
            const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

            const result = await validateToken(tamperedToken);
            expect(result.valid).toBe(false);
        });

        // Property 7: Token contains expiration
        it('Property 7: Token has expiration', async () => {
            const { token, expiresAt } = await generateToken(mockEmployee, tenantId, sessionId);
            
            expect(expiresAt).toBeInstanceOf(Date);
            expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
            
            const result = await validateToken(token);
            expect(result.payload?.exp).toBeDefined();
        });
    });

    describe('Configuration', () => {
        it('has sensible lockout settings', () => {
            expect(AUTH_CONFIG.MAX_FAILED_ATTEMPTS).toBeGreaterThanOrEqual(3);
            expect(AUTH_CONFIG.LOCKOUT_DURATION_MS).toBeGreaterThanOrEqual(60000); // At least 1 min
            expect(AUTH_CONFIG.SESSION_DURATION_MS).toBeGreaterThanOrEqual(300000); // At least 5 min
            expect(AUTH_CONFIG.SESSION_INACTIVITY_MS).toBeLessThanOrEqual(AUTH_CONFIG.SESSION_DURATION_MS);
        });
    });
});
