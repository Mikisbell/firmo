/**
 * Terminal Detail API Tests
 *
 * Requirements: 2.1, 3.1, 3.3 (Terminal Architecture v2)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock admin-auth middleware
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: vi.fn().mockResolvedValue({
    authorized: true,
    user: { tenantId: 'test-tenant', role: 'ADMIN', employeeId: 'admin-1' },
  }),
}));

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  __esModule: true,
  default: {
    terminal_devices: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    activation_codes: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock terminal-registry (used by status and regenerate-code routes)
vi.mock('@/src/core/auth/terminal-registry', () => ({
  updateTerminalStatus: vi.fn(),
  generateActivationCode: vi.fn(),
  formatActivationCode: vi.fn(),
  generateActivationCodeValue: vi.fn(),
}));

// Mock config/employees
vi.mock('@/src/core/config/employees', () => ({
  getAdminEmployeeId: vi.fn().mockReturnValue('admin-1'),
}));

// Mock logger
vi.mock('@/src/core/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { GET } from '../route';
import { POST as RegenerateCode } from '../regenerate-code/route';
import { PATCH as UpdateStatus } from '../status/route';
import prisma from '@/src/core/db/prisma';
import { updateTerminalStatus, generateActivationCode, formatActivationCode } from '@/src/core/auth/terminal-registry';

describe('Terminal Detail API', () => {
  const mockTerminal = {
    id: '1',
    terminal_id: 'CAJA_01',
    tenant_id: 'test-tenant',
    role: 'CAJA',
    status: 'active',
    device_name: 'iPad Caja Principal',
    location_id: 'MAIN',
    fingerprint_hash: 'abc123',
    fingerprint_salt: 'salt123',
    bound_at: new Date('2024-01-15T10:00:00Z'),
    last_seen_at: new Date(),
    last_fingerprint_check: new Date(),
    drift_score: 5,
    created_at: new Date('2024-01-15T09:00:00Z'),
    updated_at: new Date('2024-01-15T10:00:00Z'),
  };

  const mockActivationCodes = [
    {
      id: '1',
      terminal_id: 'CAJA_01',
      code: '123456',
      expires_at: new Date('2024-01-15T09:15:00Z'),
      attempts: 1,
      used: true,
      created_by: 'admin',
      created_at: new Date('2024-01-15T09:00:00Z'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TENANT_ID = 'test-tenant';

    // Reset admin auth mock to authorized
    vi.mocked(requireAdminAuth).mockResolvedValue({
      authorized: true,
      user: { tenantId: 'test-tenant', role: 'ADMIN', employeeId: 'admin-1' } as any,
    });
  });

  describe('GET /api/admin/terminals-v2/[terminalId]', () => {
    it('should return terminal details with activation codes', async () => {
      (prisma.terminal_devices.findFirst as any).mockResolvedValue(mockTerminal);
      (prisma.activation_codes.findMany as any).mockResolvedValue(mockActivationCodes);

      const request = {} as NextRequest;
      const response = await GET(request, { params: Promise.resolve({ terminalId: 'CAJA_01' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.terminal.terminal_id).toBe('CAJA_01');
      expect(data.terminal.device_name).toBe('iPad Caja Principal');
      expect(data.activation_codes).toHaveLength(1);
      expect(data.current_code).toBeNull(); // All codes are used or expired
    });

    it('should return current active code if available', async () => {
      const activeCode = {
        ...mockActivationCodes[0],
        id: '2',
        code: '789012',
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        used: false,
      };

      (prisma.terminal_devices.findFirst as any).mockResolvedValue(mockTerminal);
      (prisma.activation_codes.findMany as any).mockResolvedValue([
        ...mockActivationCodes,
        activeCode,
      ]);

      const request = {} as NextRequest;
      const response = await GET(request, { params: Promise.resolve({ terminalId: 'CAJA_01' }) });
      const data = await response.json();

      expect(data.current_code).toBeDefined();
      expect(data.current_code.code).toBe('789012');
      expect(data.current_code.used).toBe(false);
    });

    it('should return 404 if terminal not found', async () => {
      (prisma.terminal_devices.findFirst as any).mockResolvedValue(null);

      const request = {} as NextRequest;
      const response = await GET(request, { params: Promise.resolve({ terminalId: 'INVALID' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Terminal no encontrado');
    });

    it('should handle database errors', async () => {
      (prisma.terminal_devices.findFirst as any).mockRejectedValue(
        new Error('Database error')
      );

      const request = {} as NextRequest;
      const response = await GET(request, { params: Promise.resolve({ terminalId: 'CAJA_01' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch terminal details');
    });
  });

  describe('POST /api/admin/terminals-v2/[terminalId]/regenerate-code', () => {
    it('should generate new activation code', async () => {
      const newCode = {
        id: '2',
        terminal_id: 'CAJA_01',
        code: '999888',
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0,
        used: false,
        created_by: 'admin',
        created_at: new Date(),
      };

      (generateActivationCode as any).mockResolvedValue(newCode);
      (formatActivationCode as any).mockReturnValue('999-888');

      const request = {} as NextRequest;
      const response = await RegenerateCode(request, { params: Promise.resolve({ terminalId: 'CAJA_01' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.code.code).toBe('999888');
      expect(data.code.formatted).toBe('999-888');
      expect(data.code.expires_at).toBeDefined();

      // Should call generateActivationCode
      expect(generateActivationCode).toHaveBeenCalledWith('CAJA_01', 'admin-1');
    });

    it('should handle errors during code generation', async () => {
      (generateActivationCode as any).mockRejectedValue(
        new Error('Database error')
      );

      const request = {} as NextRequest;
      const response = await RegenerateCode(request, { params: Promise.resolve({ terminalId: 'CAJA_01' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to regenerate activation code');
    });
  });

  describe('PATCH /api/admin/terminals-v2/[terminalId]/status', () => {
    it('should update terminal status to disabled', async () => {
      (updateTerminalStatus as any).mockResolvedValue({
        ...mockTerminal,
        status: 'disabled',
      });

      const request = {
        json: async () => ({ status: 'disabled' })
      } as NextRequest;
      const response = await UpdateStatus(request, { params: Promise.resolve({ terminalId: 'CAJA_01' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.terminal.status).toBe('disabled');

      expect(updateTerminalStatus).toHaveBeenCalledWith('CAJA_01', 'test-tenant', 'disabled');
    });

    it('should update terminal status to active', async () => {
      (updateTerminalStatus as any).mockResolvedValue({
        ...mockTerminal,
        status: 'active',
      });

      const request = {
        json: async () => ({ status: 'active' })
      } as NextRequest;
      const response = await UpdateStatus(request, { params: Promise.resolve({ terminalId: 'CAJA_01' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.terminal.status).toBe('active');
    });

    it('should reject invalid status values', async () => {
      const request = {
        json: async () => ({ status: 'invalid' })
      } as NextRequest;
      const response = await UpdateStatus(request, { params: Promise.resolve({ terminalId: 'CAJA_01' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid status');
    });

    it('should return 404 if terminal not found', async () => {
      (updateTerminalStatus as any).mockResolvedValue(null);

      const request = {
        json: async () => ({ status: 'disabled' })
      } as NextRequest;
      const response = await UpdateStatus(request, { params: Promise.resolve({ terminalId: 'INVALID' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Terminal no encontrado');
    });

    it('should handle database errors', async () => {
      (updateTerminalStatus as any).mockRejectedValue(
        new Error('Database error')
      );

      const request = {
        json: async () => ({ status: 'disabled' })
      } as NextRequest;
      const response = await UpdateStatus(request, { params: Promise.resolve({ terminalId: 'CAJA_01' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update terminal status');
    });
  });
});
