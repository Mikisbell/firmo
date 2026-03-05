/**
 * Leave Requests API Unit Tests
 * Tests for Leave Request operations
 * Requirements: HR leave management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock service methods at module level using vi.hoisted() ───
const { mockCreate, mockGetById } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetById: vi.fn(),
}));

// ─── Mock ALL dependencies BEFORE importing route handlers ───

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: vi.fn(async () => ({
    authorized: true,
    user: {
      id: 'test-admin-id',
      role: 'ADMIN',
      name: 'Test Admin',
      tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      sessionId: 'test-session-id',
    },
  })),
}));

vi.mock('@/src/core/services/leave-request.service', () => ({
  LeaveRequestService: class MockLeaveRequestService {
    create = mockCreate;
    getById = mockGetById;
  },
}));

// ─── NOW import route handlers (after all mocks are registered) ───
import { POST } from '../route';
import { GET } from '../[id]/route';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567891';

function createMockRequest(body: any, method: string = 'POST'): NextRequest {
  const url = 'http://localhost:3000/api/hr/leave-requests';
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer test-token',
    },
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init as any);
}

describe('Leave Requests API Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/hr/leave-requests - Create Leave Request', () => {
    it('should create leave request successfully', async () => {
      const leaveData = {
        employee_id: EMPLOYEE_ID,
        leave_type: 'VACATION',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
        days_requested: 5,
        reason: 'Family vacation',
        with_pay: true,
      };

      const mockLeave = {
        id: 'leave-123',
        tenant_id: TENANT_ID,
        ...leaveData,
        start_date: new Date(leaveData.start_date),
        end_date: new Date(leaveData.end_date),
        status: 'PENDING',
        created_at: new Date(),
      };

      mockCreate.mockResolvedValue({
        success: true,
        data: mockLeave,
      });

      const request = createMockRequest(leaveData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.employee_id).toBe(EMPLOYEE_ID);
      expect(data.leave_type).toBe('VACATION');
      expect(data.days_requested).toBe(5);
    });

    it('should reject invalid data', async () => {
      const leaveData = {
        employee_id: EMPLOYEE_ID,
        // Missing required fields
      };

      const request = createMockRequest(leaveData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should reject negative days_requested', async () => {
      const leaveData = {
        employee_id: EMPLOYEE_ID,
        leave_type: 'VACATION',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
        days_requested: -5,
        with_pay: true,
      };

      const request = createMockRequest(leaveData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });
  });

  describe('GET /api/hr/leave-requests/[id] - Get Leave Request', () => {
    it('should return leave request by id', async () => {
      const leaveId = 'leave-123';
      const mockLeave = {
        id: leaveId,
        tenant_id: TENANT_ID,
        employee_id: EMPLOYEE_ID,
        leave_type: 'VACATION',
        start_date: new Date('2026-04-01'),
        end_date: new Date('2026-04-05'),
        days_requested: 5,
        status: 'PENDING',
      };

      mockGetById.mockResolvedValue({
        success: true,
        data: mockLeave,
      });

      const url = `http://localhost:3000/api/hr/leave-requests/${leaveId}`;
      const request = new NextRequest(url, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await GET(request, {
        params: Promise.resolve({ id: leaveId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(leaveId);
      expect(data.employee_id).toBe(EMPLOYEE_ID);
    });

    it('should return 404 when leave request not found', async () => {
      const leaveId = 'leave-999';

      mockGetById.mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Leave request not found',
        },
      });

      const url = `http://localhost:3000/api/hr/leave-requests/${leaveId}`;
      const request = new NextRequest(url, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await GET(request, {
        params: Promise.resolve({ id: leaveId }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });
});
