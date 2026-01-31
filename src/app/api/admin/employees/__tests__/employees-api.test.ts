/**
 * Employee API Unit Tests
 * Tests for Employee CRUD operations
 * Task 2.5 - Write unit tests for Employee API
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { GET as GET_BY_ID, PUT, DELETE } from '../[id]/route';
import prisma from '@/src/core/db/prisma';
import { createHash } from 'crypto';

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    employees: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    admin_access_logs: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const SALT = 'PARK_POS_2026_';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

function createMockRequest(body: any): NextRequest {
  return {
    json: async () => body,
  } as NextRequest;
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
      });

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

      expect(response.status).toBe(400);
      expect(data.error).toContain('Rol inválido');
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
      expect(data.error).toContain('PIN debe ser de 4-6 dígitos');
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
      expect(data.error).toContain('PIN debe ser de 4-6 dígitos');
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
      expect(data.error).toContain('PIN debe ser de 4-6 dígitos');
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
      expect(data.error).toContain('Faltan campos requeridos');
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
      const employeeId = 'emp-123';
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

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee);
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

      const request = createMockRequest(updateData);
      const response = await PUT(request, { params: { id: employeeId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe(updateData.name);
      expect(data.role).toBe(updateData.role);
    });

    it('should update is_active status', async () => {
      const employeeId = 'emp-123';
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

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee);
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

      const request = createMockRequest(updateData);
      const response = await PUT(request, { params: { id: employeeId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.is_active).toBe(false);
    });

    it('should reject update with invalid role', async () => {
      const employeeId = 'emp-123';
      const updateData = {
        name: 'Test User',
        role: 'INVALID_ROLE',
        is_active: true,
      };

      const request = createMockRequest(updateData);
      const response = await PUT(request, { params: { id: employeeId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Rol inválido');
    });

    it('should return 404 for non-existent employee', async () => {
      const employeeId = 'non-existent';
      const updateData = {
        name: 'Test User',
        role: 'WAITER',
        is_active: true,
      };

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(null);

      const request = createMockRequest(updateData);
      const response = await PUT(request, { params: { id: employeeId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('no encontrado');
    });

    it('should log audit trail on successful update', async () => {
      const employeeId = 'emp-123';
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
      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee);
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

      const request = createMockRequest(updateData);
      await PUT(request, { params: { id: employeeId } });

      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UPDATE',
            resource: 'employees',
            metadata: expect.objectContaining({
              record_id: employeeId,
              changes: updateData,
            }),
          }),
        })
      );
    });
  });

  describe('DELETE /api/admin/employees/[id] - Soft Delete Employee', () => {
    it('should soft delete employee (set is_active to false)', async () => {
      const employeeId = 'emp-123';

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

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee);
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

      const request = {} as NextRequest;
      const response = await DELETE(request, { params: { id: employeeId } });

      expect(response.status).toBe(204);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: employeeId },
          data: { is_active: false },
        })
      );
    });

    it('should return 404 for non-existent employee', async () => {
      const employeeId = 'non-existent';

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(null);

      const request = {} as NextRequest;
      const response = await DELETE(request, { params: { id: employeeId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('no encontrado');
    });

    it('should log audit trail on successful soft delete', async () => {
      const employeeId = 'emp-123';

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
      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee);
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

      const request = {} as NextRequest;
      await DELETE(request, { params: { id: employeeId } });

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
      const employeeId = 'emp-123';

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

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(existingEmployee);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          employees: {
            update: vi.fn().mockImplementation(({ data }) => {
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

      const request = {} as NextRequest;
      await DELETE(request, { params: { id: employeeId } });

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

      vi.mocked(prisma.employees.findMany).mockResolvedValue(mockEmployees as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('Employee 1');
      expect(data[1].name).toBe('Employee 2');
    });

    it('should return empty array when no employees exist', async () => {
      vi.mocked(prisma.employees.findMany).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(0);
    });
  });

  describe('GET /api/admin/employees/[id] - Get Single Employee', () => {
    it('should return employee by id', async () => {
      const employeeId = 'emp-123';
      const mockEmployee = {
        id: employeeId,
        name: 'Test Employee',
        role: 'WAITER',
        is_active: true,
        created_at: new Date(),
      };

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(mockEmployee as any);

      const request = {} as NextRequest;
      const response = await GET_BY_ID(request, { params: { id: employeeId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(employeeId);
      expect(data.name).toBe('Test Employee');
    });

    it('should return 404 for non-existent employee', async () => {
      const employeeId = 'non-existent';

      vi.mocked(prisma.employees.findFirst).mockResolvedValue(null);

      const request = {} as NextRequest;
      const response = await GET_BY_ID(request, { params: { id: employeeId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('no encontrado');
    });
  });
});
