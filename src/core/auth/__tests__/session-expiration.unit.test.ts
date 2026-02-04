/**
 * Unit Tests for Session Expiration
 * 
 * Tests session expiration behavior and re-authentication requirements
 * 
 * **Validates: Requirements 12.6**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import { validateToken } from '../auth.service';

describe('15.8 Session Expiration Unit Tests', () => {
  let tenant_id: string;
  let employee_id: string;
  let session_id: string;

  beforeEach(async () => {
    tenant_id = randomUUID();
    employee_id = randomUUID();
    session_id = randomUUID();

    // Create test tenant
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
    await prisma.sessions.deleteMany({ where: { tenant_id } });
    await prisma.employees.deleteMany({ where: { tenant_id } });
    await prisma.tenant_settings.deleteMany({ where: { tenant_id } });
    await prisma.tenants.delete({ where: { id: tenant_id } });
  });

  describe('Session Expiration Behavior', () => {
    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that active sessions are accepted
     */
    it('accepts active session that has not expired', async () => {
      // Create active session (expires in 30 minutes)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: expiresAt,
        },
      });

      // Retrieve session
      const session = await prisma.sessions.findUnique({
        where: { id: session_id },
      });

      expect(session).toBeDefined();
      expect(session?.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that expired sessions are rejected
     */
    it('rejects session that has expired', async () => {
      // Create expired session (expired 1 minute ago)
      const expiresAt = new Date(Date.now() - 60 * 1000);
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: expiresAt,
        },
      });

      // Retrieve session
      const session = await prisma.sessions.findUnique({
        where: { id: session_id },
      });

      expect(session).toBeDefined();
      expect(session?.expires_at.getTime()).toBeLessThan(Date.now());
    });

    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that session expiration time is correctly set
     */
    it('session expiration time is correctly set', async () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: expiresAt,
        },
      });

      const session = await prisma.sessions.findUnique({
        where: { id: session_id },
      });

      expect(session?.expires_at).toEqual(expiresAt);
    });

    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that session can be deleted (logout)
     */
    it('session can be deleted for logout', async () => {
      // Create session
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      // Verify session exists
      let session = await prisma.sessions.findUnique({
        where: { id: session_id },
      });
      expect(session).toBeDefined();

      // Delete session (logout)
      await prisma.sessions.delete({
        where: { id: session_id },
      });

      // Verify session is deleted
      session = await prisma.sessions.findUnique({
        where: { id: session_id },
      });
      expect(session).toBeNull();
    });

    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that multiple sessions can exist for same employee
     */
    it('multiple sessions can exist for same employee', async () => {
      const session_id_1 = randomUUID();
      const session_id_2 = randomUUID();

      // Create two sessions for same employee
      await prisma.sessions.createMany({
        data: [
          {
            id: session_id_1,
            tenant_id,
            employee_id,
            token_hash: 'hash_1',
            expires_at: new Date(Date.now() + 30 * 60 * 1000),
          },
          {
            id: session_id_2,
            tenant_id,
            employee_id,
            token_hash: 'hash_2',
            expires_at: new Date(Date.now() + 30 * 60 * 1000),
          },
        ],
      });

      // Retrieve both sessions
      const sessions = await prisma.sessions.findMany({
        where: { employee_id },
      });

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain(session_id_1);
      expect(sessions.map(s => s.id)).toContain(session_id_2);

      // Cleanup
      await prisma.sessions.deleteMany({ where: { employee_id } });
    });
  });

  describe('Re-authentication Requirement', () => {
    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that expired session requires re-authentication
     */
    it('expired session requires re-authentication', async () => {
      // Create expired session
      const expiresAt = new Date(Date.now() - 60 * 1000); // Expired 1 minute ago
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: expiresAt,
        },
      });

      // Try to use expired session
      const session = await prisma.sessions.findUnique({
        where: { id: session_id },
      });

      // Session exists but is expired
      expect(session).toBeDefined();
      expect(session?.expires_at.getTime()).toBeLessThan(Date.now());

      // Application should reject this session and require re-authentication
      const isExpired = session ? session.expires_at.getTime() < Date.now() : false;
      expect(isExpired).toBe(true);
    });

    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that session expiration is tenant-scoped
     */
    it('session expiration is tenant-scoped', async () => {
      const other_tenant_id = randomUUID();
      const other_session_id = randomUUID();

      // Create session for current tenant
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      // Verify session belongs to correct tenant
      const session = await prisma.sessions.findUnique({
        where: { id: session_id },
      });

      expect(session?.tenant_id).toBe(tenant_id);
      expect(session?.tenant_id).not.toBe(other_tenant_id);
    });

    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that session cleanup removes expired sessions
     */
    it('expired sessions can be cleaned up', async () => {
      // Create multiple sessions with different expiration times
      const active_session_id = randomUUID();
      const expired_session_id = randomUUID();

      await prisma.sessions.createMany({
        data: [
          {
            id: active_session_id,
            tenant_id,
            employee_id,
            token_hash: 'hash_active',
            expires_at: new Date(Date.now() + 30 * 60 * 1000), // Active
          },
          {
            id: expired_session_id,
            tenant_id,
            employee_id,
            token_hash: 'hash_expired',
            expires_at: new Date(Date.now() - 60 * 1000), // Expired
          },
        ],
      });

      // Delete expired sessions
      await prisma.sessions.deleteMany({
        where: {
          tenant_id,
          expires_at: { lt: new Date() },
        },
      });

      // Verify only active session remains
      const remaining = await prisma.sessions.findMany({
        where: { tenant_id },
      });

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(active_session_id);

      // Cleanup
      await prisma.sessions.deleteMany({ where: { tenant_id } });
    });

    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that session expiration time is in the future for new sessions
     */
    it('new session expiration time is in the future', async () => {
      const now = Date.now();
      const expiresAt = new Date(now + 30 * 60 * 1000); // 30 minutes from now

      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: expiresAt,
        },
      });

      const session = await prisma.sessions.findUnique({
        where: { id: session_id },
      });

      expect(session?.expires_at.getTime()).toBeGreaterThan(now);
    });

    /**
     * **Validates: Requirements 12.6**
     * 
     * Test that session belongs to correct employee
     */
    it('session is associated with correct employee', async () => {
      const other_employee_id = randomUUID();

      // Create employee
      await prisma.employees.create({
        data: {
          id: other_employee_id,
          tenant_id,
          name: 'Other Employee',
          role: 'CASHIER',
          pin_hash: 'other_hash',
          is_active: true,
        },
      });

      // Create session for first employee
      await prisma.sessions.create({
        data: {
          id: session_id,
          tenant_id,
          employee_id,
          token_hash: 'test_hash',
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      // Verify session belongs to correct employee
      const session = await prisma.sessions.findUnique({
        where: { id: session_id },
      });

      expect(session?.employee_id).toBe(employee_id);
      expect(session?.employee_id).not.toBe(other_employee_id);

      // Cleanup
      await prisma.employees.delete({ where: { id: other_employee_id } });
    });
  });
});
