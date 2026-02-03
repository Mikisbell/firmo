/**
 * Unit Tests for Tenant-Scoped Login
 * 
 * Tests JWT token structure and tenant_id inclusion
 * 
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import {
  validateEmployeeBelongsToTenant,
  validateTokenTenant,
  validateTokenNotReused,
} from '../tenant-login';
import { generateToken, validateToken } from '../auth.service';

describe('Tenant-Scoped Login Unit Tests', () => {
  let tenant_id: string;
  let employee_id: string;

  beforeEach(async () => {
    tenant_id = randomUUID();
    employee_id = randomUUID();

    // Create test tenant in tenants table first
    await prisma.tenants.create({
      data: {
        id: tenant_id,
        name: 'Test Tenant',
      },
    });

    // Create test tenant settings
    await prisma.tenant_settings.create({
      data: {
        tenant_id,
        legal_name: 'Test Tenant',
        timezone: 'America/Lima',
        currency: 'PEN',
      },
    });

    // Create test employee
    await prisma.employees.create({
      data: {
        id: employee_id,
        tenant_id,
        name: 'Test Employee',
        role: 'CASHIER',
        pin_hash: 'test_hash',
        is_active: true,
      },
    });
  });

  afterEach(async () => {
    // Cleanup
    await prisma.employees.deleteMany({ where: { tenant_id } });
    await prisma.tenant_settings.deleteMany({ where: { tenant_id } });
    await prisma.tenants.delete({ where: { id: tenant_id } });
  });

  describe('15.3 JWT Token Structure and tenant_id Inclusion', () => {
    /**
     * **Validates: Requirements 12.2**
     * 
     * Test that JWT token includes tenant_id claim
     */
    it('JWT token includes tenant_id claim', async () => {
      const sessionId = randomUUID();
      const { token } = await generateToken(
        {
          id: employee_id,
          name: 'Test Employee',
          role: 'CASHIER',
        },
        tenant_id,
        sessionId
      );

      // Validate token
      const result = await validateToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.tid).toBe(tenant_id);
    });

    /**
     * **Validates: Requirements 12.2**
     * 
     * Test that JWT token has correct structure
     */
    it('JWT token has correct structure with all required claims', async () => {
      const sessionId = randomUUID();
      const { token } = await generateToken(
        {
          id: employee_id,
          name: 'Test Employee',
          role: 'CASHIER',
        },
        tenant_id,
        sessionId
      );

      const result = await validateToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload).toMatchObject({
        sub: employee_id,
        tid: tenant_id,
        role: 'CASHIER',
        name: 'Test Employee',
        sid: sessionId,
      });
    });

    /**
     * **Validates: Requirements 12.2**
     * 
     * Test that JWT token includes issuer and audience
     */
    it('JWT token includes issuer and audience', async () => {
      const sessionId = randomUUID();
      const { token } = await generateToken(
        {
          id: employee_id,
          name: 'Test Employee',
          role: 'CASHIER',
        },
        tenant_id,
        sessionId
      );

      const result = await validateToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload?.iss).toBe('park-pos');
      expect(result.payload?.aud).toBe('park-pos-client');
    });

    /**
     * **Validates: Requirements 12.2**
     * 
     * Test that JWT token has expiration time
     */
    it('JWT token includes expiration time', async () => {
      const sessionId = randomUUID();
      const { token, expiresAt } = await generateToken(
        {
          id: employee_id,
          name: 'Test Employee',
          role: 'CASHIER',
        },
        tenant_id,
        sessionId
      );

      const result = await validateToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload?.exp).toBeDefined();
      expect(expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Employee Tenant Validation', () => {
    /**
     * **Validates: Requirements 12.1**
     * 
     * Test that employee validation succeeds for correct tenant
     */
    it('validates employee belongs to correct tenant', async () => {
      const result = await validateEmployeeBelongsToTenant(employee_id, tenant_id);
      expect(result.valid).toBe(true);
    });

    /**
     * **Validates: Requirements 12.1**
     * 
     * Test that employee validation fails for wrong tenant
     */
    it('rejects employee from different tenant', async () => {
      const different_tenant_id = randomUUID();
      const result = await validateEmployeeBelongsToTenant(employee_id, different_tenant_id);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not belong to tenant');
    });

    /**
     * **Validates: Requirements 12.1**
     * 
     * Test that inactive employees are rejected
     */
    it('rejects inactive employees', async () => {
      // Deactivate employee
      await prisma.employees.update({
        where: { id: employee_id },
        data: { is_active: false },
      });

      const result = await validateEmployeeBelongsToTenant(employee_id, tenant_id);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('inactive');
    });

    /**
     * **Validates: Requirements 12.1**
     * 
     * Test that non-existent employees are rejected
     */
    it('rejects non-existent employees', async () => {
      const non_existent_id = randomUUID();
      const result = await validateEmployeeBelongsToTenant(non_existent_id, tenant_id);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Token Tenant Validation', () => {
    /**
     * **Validates: Requirements 12.3, 12.4**
     * 
     * Test that token tenant matches requested tenant
     */
    it('validates token tenant matches requested tenant', async () => {
      const result = await validateTokenTenant(tenant_id, tenant_id);
      expect(result.valid).toBe(true);
    });

    /**
     * **Validates: Requirements 12.3, 12.4**
     * 
     * Test that token from different tenant is rejected
     */
    it('rejects token from different tenant', async () => {
      const different_tenant_id = randomUUID();
      const result = await validateTokenTenant(tenant_id, different_tenant_id);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match');
    });

    /**
     * **Validates: Requirements 12.4**
     * 
     * Test that token reuse across tenants is prevented
     */
    it('prevents token reuse across tenants', async () => {
      const session_id = randomUUID();
      const different_tenant_id = randomUUID();

      // Create session for tenant_id
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      // Try to use session with different tenant
      const result = await validateTokenNotReused(session_id, different_tenant_id);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('different tenant');

      // Cleanup
      await prisma.sessions.delete({ where: { id: session_id } });
    });

    /**
     * **Validates: Requirements 12.4**
     * 
     * Test that expired sessions are rejected
     */
    it('rejects expired sessions', async () => {
      const session_id = randomUUID();

      // Create expired session
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const result = await validateTokenNotReused(session_id, tenant_id);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');

      // Cleanup
      await prisma.sessions.delete({ where: { id: session_id } });
    });
  });

  describe('Session Management', () => {
    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that valid sessions are accepted
     */
    it('accepts valid active sessions', async () => {
      const session_id = randomUUID();

      // Create active session
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      const result = await validateTokenNotReused(session_id, tenant_id);
      expect(result.valid).toBe(true);

      // Cleanup
      await prisma.sessions.delete({ where: { id: session_id } });
    });

    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that non-existent sessions are rejected
     */
    it('rejects non-existent sessions', async () => {
      const non_existent_session_id = randomUUID();
      const result = await validateTokenNotReused(non_existent_session_id, tenant_id);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
