/**
 * Employee API Unit Tests
 * Tests for Employee CRUD operations
 * Task 2.5 - Write unit tests for Employee API
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

// ─── Mock ALL dependencies BEFORE importing route handlers ───

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    employees: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    admin_access_logs: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock admin auth middleware - requireAdminAuth returns { authorized, user }
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: vi.fn(async () => ({
    authorized: true,
    user: {
      id: 'test-user-id',
      role: 'ADMIN',
      name: 'Test Admin',
      tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      sessionId: 'test-session-id',
    },
  })),
  validateAdminAuth: vi.fn(async () => ({
    valid: true,
    user: {
      id: 'test-user-id',
      role: 'ADMIN',
      name: 'Test Admin',
      tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      sessionId: 'test-session-id',
    },
  })),
}));

// Mock rate limit
vi.mock('@/src/lib/rate-limit-response', () => ({
  checkRateLimit: vi.fn(async () => null),
  RATE_LIMIT_CONFIGS: {
    AUTH: { maxRequests: 5, windowMs: 60000 },
    MUTATION: { maxRequests: 10, windowMs: 60000 },
    DELETE: { maxRequests: 5, windowMs: 60000 },
    READ: { maxRequests: 30, windowMs: 60000 },
    PUBLIC: { maxRequests: 20, windowMs: 60000 },
  },
}));

// Mock CORS helpers
vi.mock('@/src/lib/cors-helpers', () => ({
  handleCorsPreflightRequest: vi.fn(() => new NextResponse(null, { status: 204 })),
}));

// Mock pagination
vi.mock('@/src/lib/pagination', () => ({
  parsePaginationParams: vi.fn(() => ({ page: 1, limit: 10, skip: 0 })),
  createPaginatedResponse: vi.fn((items: any[], total: number, params: any) => ({
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
      hasNext: false,
      hasPrev: false,
    },
  })),
}));

// Mock request logger - withRequestLogging should pass through to handler
vi.mock('@/src/core/middleware/request-logger', () => ({
  withRequestLogging: vi.fn((handler: any) => handler),
  getRequestContext: vi.fn(() => ({})),
}));

// Mock logger-pino
vi.mock('@/src/core/observability/logger-pino', () => {
  const noopLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => noopLog),
  };
  return {
    createRequestLogger: vi.fn(() => noopLog),
    logAudit: vi.fn(),
    logPerformance: vi.fn(),
    pinoLogger: noopLog,
    enhancedLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    },
  };
});

// Mock redis cache service
vi.mock('@/src/core/cache/redis.service', () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    del: vi.fn(async () => {}),
    invalidatePattern: vi.fn(async () => {}),
    deleteByTag: vi.fn(async () => {}),
    isAvailable: vi.fn(() => true),
    getType: vi.fn(() => 'memory'),
  },
  generateCacheKey: vi.fn((...args: any[]) => args.join(':')),
  CacheService: vi.fn(),
}));

// Mock metrics
vi.mock('@/src/core/observability/metrics', () => ({
  metrics: {
    increment: vi.fn(),
    decrement: vi.fn(),
    gauge: vi.fn(),
    histogram: vi.fn(),
    timing: vi.fn(),
    set: vi.fn(),
    flush: vi.fn(),
    clear: vi.fn(),
  },
  MetricNames: {
    EMPLOYEES_CREATED_TOTAL: 'employees_created_total',
    EMPLOYEES_ACTIVE: 'employees_active',
    HTTP_REQUESTS_TOTAL: 'http_requests_total',
    HTTP_REQUEST_DURATION_MS: 'http_request_duration_ms',
    API_ERRORS_TOTAL: 'api_errors_total',
    CACHE_HITS_TOTAL: 'cache_hits_total',
    CACHE_MISSES_TOTAL: 'cache_misses_total',
  },
  metricsHelpers: {
    recordHttpRequest: vi.fn(),
    recordApiError: vi.fn(),
    recordCacheHit: vi.fn(),
    recordCacheMiss: vi.fn(),
  },
  VercelMetricsCollector: vi.fn(),
}));

// Mock tenant config
vi.mock('@/src/core/config/tenant', () => ({
  getTenantId: vi.fn(() => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
}));

// ─── NOW import route handlers (after all mocks are registered) ───
import { GET, POST } from '../route';
import { GET as GET_BY_ID, PUT, DELETE } from '../[id]/route';
import prisma from '@/src/core/db/prisma';

const SALT = 'PARK_POS_2026_';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

/**
 * Create a mock NextRequest with a body and proper nextUrl.
 * Uses the real NextRequest constructor for maximum compatibility.
 */
function createMockRequest(body: any, method: string = 'POST'): NextRequest {
  const url = 'http://localhost:3000/api/admin/employees';
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      'x-user-id': 'test-user-id',
      'x-user-role': 'ADMIN',
      'authorization': 'Bearer test-token',
    },
  };

  // GET/HEAD requests cannot have a body per the Fetch spec
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body);
  }

  const req = new NextRequest(url, init as any);

  // For GET requests without body, override json() to return the body
  if (method === 'GET' || method === 'HEAD') {
    (req as any).json = async () => body;
  }

  return req;
}

function createEmptyMockRequest(method: string = 'GET'): NextRequest {
  return createMockRequest({}, method);
}

describe('Employee API Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/employees - Create Employee', () => {
    it('should create employee with valid data', async () => {
      const employeeData = {
        name: 'John Doe',
        role: 'WAITER',
        pin: '1234',
        is_active: true,
      };

      const mockEmployee = {
        id: 'emp-123',
        tenant_id: TENANT_ID,
        name: employeeData.name,
        role: employeeData.role,
        pin_hash: hashPin(employeeData.pin),
        is_active: true,
        created_at: new Date(),
      };

      // Mock PIN uniqueness check (no existing PIN)
      vi.mocked(prisma.employees.findFirst).mockResolvedValue(null);

      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            create: vi.fn().mockResolvedValue(mockEmployee),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      // Mock count for active employees gauge
      vi.mocked(prisma.employees.count).mockResolvedValue(1);

      const request = createMockRequest(employeeData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe(employeeData.name);
      expect(data.role).toBe(employeeData.role);
      expect(data.pin_hash).toBe(hashPin(employeeData.pin));
      expect(data.pin_hash).not.toBe(employeeData.pin); // PIN should be hashed
    });

    it('should reject duplicate PIN', async () => {
      const employeeData = {
        name: 'Jane Doe',
        role: 'CASHIER',
        pin: '1234',
        is_active: true,
      };

      // Mock existing employee with same PIN
      vi.mocked(prisma.employees.findFirst).mockResolvedValue({
        id: 'existing-emp',
        tenant_id: TENANT_ID,
        name: 'Existing Employee',
        role: 'WAITER',
        pin_hash: hashPin('1234'),
        is_active: true,
        created_at: new Date(),
      } as any);

      const request = createMockRequest(employeeData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('PIN ya está en uso');
    });

    it('should reject invalid role', async () => {
      const employeeData = {
        name: 'Invalid Role User',
        role: 'INVALID_ROLE',
        pin: '1234',
        is_active: true,
      };

      const request = createMockRequest(employeeData);
      const response = await POST(request);
      const data = await response.json();

      // Zod validation returns 400 with "Datos inválidos"
      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should reject invalid PIN format (too short)', async () => {
      const employeeData = {
        name: 'Short PIN User',
        role: 'WAITER',
        pin: '123', // Only 3 digits
        is_active: true,
      };

      const request = createMockRequest(employeeData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
      // The Zod details contain the actual validation message
      expect(data.details).toBeDefined();
      expect(data.details.some((d: any) => d.field === 'pin')).toBe(true);
    });

    it('should reject invalid PIN format (too long)', async () => {
      const employeeData = {
        name: 'Long PIN User',
        role: 'WAITER',
        pin: '1234567', // 7 digits
        is_active: true,
      };

      const request = createMockRequest(employeeData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
      expect(data.details).toBeDefined();
      expect(data.details.some((d: any) => d.field === 'pin')).toBe(true);
    });

    it('should reject invalid PIN format (non-numeric)', async () => {
      const employeeData = {
        name: 'Alpha PIN User',
        role: 'WAITER',
        pin: 'abcd',
        is_active: true,
      };

      const request = createMockRequest(employeeData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
      expect(data.details).toBeDefined();
      expect(data.details.some((d: any) => d.field === 'pin')).toBe(true);
    });

    it('should reject missing required fields', async () => {
      const employeeData = {
        name: 'Missing Fields User',
        // Missing role and pin
      };

      const request = createMockRequest(employeeData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
      expect(data.details).toBeDefined();
      expect(data.details.length).toBeGreaterThan(0);
    });

    it('should log audit trail on successful creation', async () => {
      const employeeData = {
        name: 'Audit Test User',
        role: 'KITCHEN',
        pin: '5678',
        is_active: true,
      };

      const mockEmployee = {
        id: 'emp-audit-123',
        tenant_id: TENANT_ID,
        name: employeeData.name,
        role: employeeData.role,
        pin_hash: hashPin(employeeData.pin),
        is_active: true,
        created_at: new Date(),
      };

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.employees.count).mockResolvedValue(1);

      const mockAuditCreate = vi.fn().mockResolvedValue({});
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            create: vi.fn().mockResolvedValue(mockEmployee),
          },
          admin_access_logs: {
            create: mockAuditCreate,
          },
        };
        return callback(tx);
      });

      const request = createMockRequest(employeeData);
      await POST(request);

      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATE',
            resource: 'employees',
            metadata: expect.objectContaining({
              record_id: mockEmployee.id,
            }),
          }),
        })
      );
    });

    it('should accept all valid roles', async () => {
      const validRoles = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DRIVER', 'BAR'];

      for (const role of validRoles) {
        vi.clearAllMocks();

        const employeeData = {
          name: `${role} User`,
          role,
          pin: '1234',
          is_active: true,
        };

        const mockEmployee = {
          id: `emp-${role}`,
          tenant_id: TENANT_ID,
          name: employeeData.name,
          role: employeeData.role,
          pin_hash: hashPin(employeeData.pin),
          is_active: true,
          created_at: new Date(),
        };

        vi.mocked(prisma.employees.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.employees.count).mockResolvedValue(1);
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
          const tx = {
            employees: {
              create: vi.fn().mockResolvedValue(mockEmployee),
            },
            admin_access_logs: {
              create: vi.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        });

        const request = createMockRequest(employeeData);
        const response = await POST(request);

        expect(response.status).toBe(201);
      }
    });
  });

  describe('PUT /api/admin/employees/[id] - Update Employee', () => {
    it('should update employee name and role', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const updateData = {
        name: 'Updated Name',
        role: 'MANAGER',
        is_active: true,
      };

      const existingEmployee = {
        id: employeeId,
        tenant_id: TENANT_ID,
        name: 'Old Name',
        role: 'WAITER',
        pin_hash: hashPin('1234'),
        is_active: true,
        created_at: new Date(),
      };

      const updatedEmployee = {
        ...existingEmployee,
        name: updateData.name,
        role: updateData.role,
      };

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            update: vi.fn().mockResolvedValue(updatedEmployee),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const request = createMockRequest(updateData, 'PUT');
      const response = await PUT(request, { params: Promise.resolve({ id: employeeId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe(updateData.name);
      expect(data.role).toBe(updateData.role);
    });

    it('should update is_active status', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const updateData = {
        name: 'Test User',
        role: 'WAITER',
        is_active: false,
      };

      const existingEmployee = {
        id: employeeId,
        tenant_id: TENANT_ID,
        name: 'Test User',
        role: 'WAITER',
        pin_hash: hashPin('1234'),
        is_active: true,
        created_at: new Date(),
      };

      const updatedEmployee = {
        ...existingEmployee,
        is_active: false,
      };

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            update: vi.fn().mockResolvedValue(updatedEmployee),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const request = createMockRequest(updateData, 'PUT');
      const response = await PUT(request, { params: Promise.resolve({ id: employeeId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.is_active).toBe(false);
    });

    it('should reject update with invalid role', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const updateData = {
        name: 'Test User',
        role: 'INVALID_ROLE',
        is_active: true,
      };

      // findFirst must return an existing employee so we get past the 403 check
      const existingEmployee = {
        id: employeeId,
        tenant_id: TENANT_ID,
        name: 'Test User',
        role: 'WAITER',
        pin_hash: hashPin('1234'),
        is_active: true,
        created_at: new Date(),
      };
      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee as any);

      const request = createMockRequest(updateData, 'PUT');
      const response = await PUT(request, { params: Promise.resolve({ id: employeeId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
      expect(data.details.role).toBeDefined();
    });

    it('should return 403 for non-existent employee', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-000000000000';
      const updateData = {
        name: 'Test User',
        role: 'WAITER',
        is_active: true,
      };

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(null);

      const request = createMockRequest(updateData, 'PUT');
      const response = await PUT(request, { params: Promise.resolve({ id: employeeId }) });
      const data = await response.json();

      // The actual route returns 403 with "no encontrado o no autorizado"
      expect(response.status).toBe(403);
      expect(data.error).toContain('no encontrado');
    });

    it('should log audit trail on successful update', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const updateData = {
        name: 'Updated Name',
        role: 'MANAGER',
        is_active: true,
      };

      const existingEmployee = {
        id: employeeId,
        tenant_id: TENANT_ID,
        name: 'Old Name',
        role: 'WAITER',
        pin_hash: hashPin('1234'),
        is_active: true,
        created_at: new Date(),
      };

      const mockAuditCreate = vi.fn().mockResolvedValue({});
      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            update: vi.fn().mockResolvedValue({ ...existingEmployee, ...updateData }),
          },
          admin_access_logs: {
            create: mockAuditCreate,
          },
        };
        return callback(tx);
      });

      const request = createMockRequest(updateData, 'PUT');
      await PUT(request, { params: Promise.resolve({ id: employeeId }) });

      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UPDATE',
            resource: 'employees',
            metadata: expect.objectContaining({
              record_id: employeeId,
              changes: expect.objectContaining(updateData),
            }),
          }),
        })
      );
    });

    it('update where clause includes tenant_id (TOCTOU prevention)', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const existingEmployee = {
        id: employeeId,
        tenant_id: TENANT_ID,
        name: 'Old Name',
        role: 'WAITER',
        pin_hash: hashPin('1234'),
        is_active: true,
        created_at: new Date(),
      };

      let capturedWhere: any;
      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            update: vi.fn(async (args: any) => {
              capturedWhere = args.where;
              return { ...existingEmployee, name: 'New Name' };
            }),
          },
          admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const request = createMockRequest({ name: 'New Name' }, 'PUT');
      await PUT(request, { params: Promise.resolve({ id: employeeId }) });
      expect(capturedWhere).toMatchObject({ id: employeeId, tenant_id: TENANT_ID });
    });
  });

  describe('DELETE /api/admin/employees/[id] - Soft Delete Employee', () => {
    it('should soft delete employee (set is_active to false)', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const existingEmployee = {
        id: employeeId,
        tenant_id: TENANT_ID,
        name: 'Test User',
        role: 'WAITER',
        pin_hash: hashPin('1234'),
        is_active: true,
        created_at: new Date(),
      };

      const mockUpdate = vi.fn().mockResolvedValue({
        ...existingEmployee,
        is_active: false,
      });

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            update: mockUpdate,
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const request = createEmptyMockRequest('DELETE');
      const response = await DELETE(request, { params: Promise.resolve({ id: employeeId }) });

      expect(response.status).toBe(204);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: employeeId },
          data: { is_active: false },
        })
      );
    });

    it('should return 403 for non-existent employee', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-000000000000';

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(null);

      const request = createEmptyMockRequest('DELETE');
      const response = await DELETE(request, { params: Promise.resolve({ id: employeeId }) });
      const data = await response.json();

      // The actual route returns 403 with "no encontrado o no autorizado"
      expect(response.status).toBe(403);
      expect(data.error).toContain('no encontrado');
    });

    it('should log audit trail on successful soft delete', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const existingEmployee = {
        id: employeeId,
        tenant_id: TENANT_ID,
        name: 'Test User',
        role: 'WAITER',
        pin_hash: hashPin('1234'),
        is_active: true,
        created_at: new Date(),
      };

      const mockAuditCreate = vi.fn().mockResolvedValue({});
      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            update: vi.fn().mockResolvedValue({ ...existingEmployee, is_active: false }),
          },
          admin_access_logs: {
            create: mockAuditCreate,
          },
        };
        return callback(tx);
      });

      const request = createEmptyMockRequest('DELETE');
      await DELETE(request, { params: Promise.resolve({ id: employeeId }) });

      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DELETE',
            resource: 'employees',
            metadata: expect.objectContaining({
              record_id: employeeId,
            }),
          }),
        })
      );
    });

    it('should preserve employee record after soft delete', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const existingEmployee = {
        id: employeeId,
        tenant_id: TENANT_ID,
        name: 'Test User',
        role: 'WAITER',
        pin_hash: hashPin('1234'),
        is_active: true,
        created_at: new Date(),
      };

      let employeeAfterDelete = { ...existingEmployee };

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            update: vi.fn().mockImplementation(({ data }: any) => {
              employeeAfterDelete = { ...employeeAfterDelete, ...data };
              return Promise.resolve(employeeAfterDelete);
            }),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const request = createEmptyMockRequest('DELETE');
      await DELETE(request, { params: Promise.resolve({ id: employeeId }) });

      // Verify record still exists with is_active = false
      expect(employeeAfterDelete.id).toBe(employeeId);
      expect(employeeAfterDelete.name).toBe(existingEmployee.name);
      expect(employeeAfterDelete.is_active).toBe(false);
    });
  });

  describe('GET /api/admin/employees - List Employees', () => {
    it('should return list of employees', async () => {
      const mockEmployees = [
        {
          id: 'emp-1',
          name: 'Employee 1',
          role: 'WAITER',
          is_active: true,
        },
        {
          id: 'emp-2',
          name: 'Employee 2',
          role: 'CASHIER',
          is_active: true,
        },
      ];

      vi.mocked(prisma.employees.count).mockResolvedValue(2);
      vi.mocked(prisma.employees.findMany).mockResolvedValue(mockEmployees as any);

      const request = createEmptyMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // The GET handler returns a paginated response via createPaginatedResponse
      expect(data.items).toHaveLength(2);
      expect(data.items[0].name).toBe('Employee 1');
      expect(data.items[1].name).toBe('Employee 2');
    });

    it('should return empty array when no employees exist', async () => {
      vi.mocked(prisma.employees.count).mockResolvedValue(0);
      vi.mocked(prisma.employees.findMany).mockResolvedValue([]);

      const request = createEmptyMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(0);
    });
  });

  describe('GET /api/admin/employees/[id] - Get Single Employee', () => {
    it('should return employee by id', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const mockEmployee = {
        id: employeeId,
        name: 'Test Employee',
        role: 'WAITER',
        is_active: true,
        created_at: new Date(),
      };

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(mockEmployee as any);

      const request = createEmptyMockRequest('GET');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: employeeId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(employeeId);
      expect(data.name).toBe('Test Employee');
    });

    it('should return 404 for non-existent employee', async () => {
      const employeeId = 'a1b2c3d4-e5f6-7890-abcd-000000000000';

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(null);

      const request = createEmptyMockRequest('GET');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: employeeId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('no encontrado');
    });
  });
});
