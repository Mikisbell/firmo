/**
 * Employee Service Unit Tests
 *
 * Tests the EmployeeService with mocked Prisma client.
 * Verifies business rules, tenant isolation, event emission, and validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmployeeService, PERU_MINIMUM_WAGE_CENTS } from '../employee.service';
import type { CreateEmployeeInput, UpdateEmployeeInput } from '../employee.service';

// ============================================================================
// Mocks
// ============================================================================

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

// Mock logger
vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock withTransaction to directly execute the callback with mockTx from the prisma instance
vi.mock('@/src/core/db/transaction', () => ({
  withTransaction: vi.fn(async (prisma: any, operation: any, _opts?: any) => {
    try {
      const result = await operation(prisma._mockTx || mockTx);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error };
    }
  }),
}));

// Shared mock transaction client
const mockTx: any = {
  employees: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  events: {
    create: vi.fn(),
  },
  emergency_contacts: {
    create: vi.fn(),
  },
  employee_documents: {
    create: vi.fn(),
  },
};

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = '11111111-2222-3333-4444-555555555555';
const ACTOR_ID = '99999999-8888-7777-6666-555555555555';

function makeValidInput(overrides?: Partial<CreateEmployeeInput>): CreateEmployeeInput {
  return {
    name: 'Juan Perez',
    role: 'CASHIER' as any,
    hire_date: new Date('2025-06-01'),
    position: 'Cajero Principal',
    base_salary_cents: 150000, // S/1,500.00
    contract_type: 'INDEFINIDO' as any,
    work_schedule_type: 'FULL_TIME' as any,
    created_by: ACTOR_ID,
    ...overrides,
  };
}

function makeEmployeeRow(overrides?: Record<string, unknown>) {
  return {
    id: EMPLOYEE_ID,
    tenant_id: TENANT_ID,
    name: 'Juan Perez',
    role: 'CASHIER',
    pin_hash: null,
    is_active: true,
    created_at: new Date('2025-06-01'),
    dni: '12345678',
    email: 'juan@example.com',
    phone: '999888777',
    address: 'Av. Lima 123',
    birth_date: new Date('1990-01-15'),
    profile_photo_url: null,
    hire_date: new Date('2025-06-01'),
    position: 'Cajero Principal',
    base_salary_cents: 150000,
    contract_type: 'INDEFINIDO',
    work_schedule_type: 'FULL_TIME',
    location_id: null,
    commission_rate: null,
    pension_system: 'ONP',
    has_health_insurance: false,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('EmployeeService', () => {
  let service: EmployeeService;

  // Mock prisma at the service level (for non-transactional operations)
  const mockPrisma: any = {
    _mockTx: mockTx,
    employees: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    events: {
      create: vi.fn(),
    },
    emergency_contacts: {
      create: vi.fn(),
    },
    employee_documents: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    service = new EmployeeService(mockPrisma);
    vi.clearAllMocks();
  });

  // ========================================================================
  // Create Employee
  // ========================================================================

  describe('create', () => {
    it('should create an employee with valid data', async () => {
      const input = makeValidInput();
      const row = makeEmployeeRow();

      mockTx.employees.create.mockResolvedValue(row);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Juan Perez');
        expect(result.data.role).toBe('CASHIER');
        expect(result.data.base_salary_cents).toBe(150000);
        expect(result.data.is_active).toBe(true);
        expect(result.data.tenant_id).toBe(TENANT_ID);
      }

      // Verify employee was created with correct tenant_id
      expect(mockTx.employees.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            name: 'Juan Perez',
            base_salary_cents: 150000,
          }),
        }),
      );

      // Verify event was emitted
      expect(mockTx.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            type: 'EMPLOYEE_CREATED',
            entity_type: 'EMPLOYEE',
          }),
        }),
      );
    });

    it('should reject salary below Peruvian minimum wage (102500 cents)', async () => {
      const input = makeValidInput({ base_salary_cents: 100000 }); // S/1,000 < S/1,025

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('102500');
      }

      // Should not have called Prisma
      expect(mockTx.employees.create).not.toHaveBeenCalled();
    });

    it('should reject salary of exactly 102499 cents (just below minimum)', async () => {
      const input = makeValidInput({ base_salary_cents: PERU_MINIMUM_WAGE_CENTS - 1 });

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(false);
    });

    it('should accept salary of exactly 102500 cents (minimum wage)', async () => {
      const input = makeValidInput({ base_salary_cents: PERU_MINIMUM_WAGE_CENTS });
      const row = makeEmployeeRow({ base_salary_cents: PERU_MINIMUM_WAGE_CENTS });

      mockTx.employees.create.mockResolvedValue(row);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(true);
    });

    it('should reject non-integer salary', async () => {
      const input = makeValidInput({ base_salary_cents: 150000.5 });

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('integer');
      }
    });

    it('should reject empty name', async () => {
      const input = makeValidInput({ name: '' });

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('name');
      }
    });

    it('should trim employee name', async () => {
      const input = makeValidInput({ name: '  Maria Garcia  ' });
      const row = makeEmployeeRow({ name: 'Maria Garcia' });

      mockTx.employees.create.mockResolvedValue(row);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(true);
      expect(mockTx.employees.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Maria Garcia' }),
        }),
      );
    });
  });

  // ========================================================================
  // Update Employee
  // ========================================================================

  describe('update', () => {
    it('should update employee profile', async () => {
      const existing = makeEmployeeRow();
      const updated = makeEmployeeRow({ name: 'Juan Carlos Perez', position: 'Supervisor' });

      mockPrisma.employees.findFirst.mockResolvedValue(existing);
      mockTx.employees.update.mockResolvedValue(updated);
      mockTx.events.create.mockResolvedValue({});

      const changes: UpdateEmployeeInput = { name: 'Juan Carlos Perez', position: 'Supervisor' };
      const result = await service.update(TENANT_ID, EMPLOYEE_ID, changes, ACTOR_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Juan Carlos Perez');
        expect(result.data.position).toBe('Supervisor');
      }

      // Verify event was emitted
      expect(mockTx.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'EMPLOYEE_PROFILE_UPDATED',
            payload: expect.objectContaining({
              employee_id: EMPLOYEE_ID,
              changes: expect.objectContaining({ name: 'Juan Carlos Perez' }),
              updated_by: ACTOR_ID,
            }),
          }),
        }),
      );
    });

    it('should reject update with salary below minimum', async () => {
      const existing = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(existing);

      const changes: UpdateEmployeeInput = { base_salary_cents: 50000 };
      const result = await service.update(TENANT_ID, EMPLOYEE_ID, changes, ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return not found for non-existent employee', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const changes: UpdateEmployeeInput = { name: 'New Name' };
      const result = await service.update(TENANT_ID, 'non-existent', changes, ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should return current data if no changes provided', async () => {
      const existing = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(existing);

      const result = await service.update(TENANT_ID, EMPLOYEE_ID, {}, ACTOR_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Juan Perez');
      }
      expect(mockTx.employees.update).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Deactivate Employee
  // ========================================================================

  describe('deactivate', () => {
    it('should soft delete by setting is_active=false', async () => {
      const existing = makeEmployeeRow({ is_active: true });
      const deactivated = makeEmployeeRow({ is_active: false });

      mockPrisma.employees.findFirst.mockResolvedValue(existing);
      mockTx.employees.update.mockResolvedValue(deactivated);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.deactivate(TENANT_ID, EMPLOYEE_ID, 'Resigned', ACTOR_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_active).toBe(false);
        expect(result.data.id).toBe(EMPLOYEE_ID); // Record still exists
      }

      // Verify is_active was set to false
      expect(mockTx.employees.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EMPLOYEE_ID },
          data: { is_active: false },
        }),
      );

      // Verify deactivation event was emitted
      expect(mockTx.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'EMPLOYEE_DEACTIVATED',
            payload: expect.objectContaining({
              employee_id: EMPLOYEE_ID,
              reason: 'Resigned',
              deactivated_by: ACTOR_ID,
            }),
          }),
        }),
      );
    });

    it('should reject deactivation of already inactive employee', async () => {
      const existing = makeEmployeeRow({ is_active: false });
      mockPrisma.employees.findFirst.mockResolvedValue(existing);

      const result = await service.deactivate(TENANT_ID, EMPLOYEE_ID, 'Duplicate', ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('already deactivated');
      }
    });

    it('should return not found for non-existent employee', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const result = await service.deactivate(TENANT_ID, 'non-existent', 'Test', ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ========================================================================
  // Get by ID
  // ========================================================================

  describe('getById', () => {
    it('should return employee scoped to tenant', async () => {
      const row = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(row);

      const result = await service.getById(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(EMPLOYEE_ID);
        expect(result.data.tenant_id).toBe(TENANT_ID);
      }

      // Verify query includes tenant_id
      expect(mockPrisma.employees.findFirst).toHaveBeenCalledWith({
        where: {
          id: EMPLOYEE_ID,
          tenant_id: TENANT_ID,
        },
      });
    });

    it('should return not found when employee does not exist', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const result = await service.getById(TENANT_ID, 'non-existent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ========================================================================
  // List Employees
  // ========================================================================

  describe('list', () => {
    it('should return paginated results', async () => {
      const employees = [makeEmployeeRow(), makeEmployeeRow({ id: 'emp-2', name: 'Maria Lopez' })];
      mockPrisma.employees.findMany.mockResolvedValue(employees);
      mockPrisma.employees.count.mockResolvedValue(2);

      const result = await service.list(TENANT_ID, { page: 1, pageSize: 10 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toHaveLength(2);
        expect(result.data.total).toBe(2);
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(10);
        expect(result.data.totalPages).toBe(1);
      }
    });

    it('should filter by role', async () => {
      mockPrisma.employees.findMany.mockResolvedValue([]);
      mockPrisma.employees.count.mockResolvedValue(0);

      await service.list(TENANT_ID, { role: 'CASHIER' });

      expect(mockPrisma.employees.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            role: 'CASHIER',
          }),
        }),
      );
    });

    it('should filter by is_active', async () => {
      mockPrisma.employees.findMany.mockResolvedValue([]);
      mockPrisma.employees.count.mockResolvedValue(0);

      await service.list(TENANT_ID, { is_active: true });

      expect(mockPrisma.employees.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            is_active: true,
          }),
        }),
      );
    });

    it('should support search filter with case insensitive matching', async () => {
      mockPrisma.employees.findMany.mockResolvedValue([]);
      mockPrisma.employees.count.mockResolvedValue(0);

      await service.list(TENANT_ID, { search: 'juan' });

      expect(mockPrisma.employees.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            OR: [
              { name: { contains: 'juan', mode: 'insensitive' } },
              { dni: { contains: 'juan', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should always include tenant_id in query (tenant isolation)', async () => {
      mockPrisma.employees.findMany.mockResolvedValue([]);
      mockPrisma.employees.count.mockResolvedValue(0);

      await service.list(TENANT_ID);

      expect(mockPrisma.employees.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
          }),
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      mockPrisma.employees.findMany.mockResolvedValue([]);
      mockPrisma.employees.count.mockResolvedValue(55);

      const result = await service.list(TENANT_ID, { page: 1, pageSize: 20 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalPages).toBe(3); // ceil(55/20) = 3
      }
    });
  });

  // ========================================================================
  // Search Employees
  // ========================================================================

  describe('search', () => {
    it('should search case insensitive by name', async () => {
      const employees = [makeEmployeeRow()];
      mockPrisma.employees.findMany.mockResolvedValue(employees);

      const result = await service.search(TENANT_ID, 'JUAN');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
      }

      expect(mockPrisma.employees.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            OR: [
              { name: { contains: 'JUAN', mode: 'insensitive' } },
              { dni: { contains: 'JUAN', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should search by DNI', async () => {
      mockPrisma.employees.findMany.mockResolvedValue([]);

      await service.search(TENANT_ID, '12345678');

      expect(mockPrisma.employees.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            OR: expect.arrayContaining([
              { dni: { contains: '12345678', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should include tenant_id in search query (tenant isolation)', async () => {
      mockPrisma.employees.findMany.mockResolvedValue([]);

      await service.search(TENANT_ID, 'test');

      expect(mockPrisma.employees.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
          }),
        }),
      );
    });
  });

  // ========================================================================
  // Emergency Contacts
  // ========================================================================

  describe('addEmergencyContact', () => {
    it('should add emergency contact for existing employee', async () => {
      const employee = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(employee);

      const contactRow = {
        id: 'contact-1',
        tenant_id: TENANT_ID,
        employee_id: EMPLOYEE_ID,
        name: 'Maria Perez',
        relationship: 'SPOUSE',
        phone: '999111222',
        address: null,
        is_primary: true,
        created_at: new Date(),
      };
      mockPrisma.emergency_contacts.create.mockResolvedValue(contactRow);

      const result = await service.addEmergencyContact(TENANT_ID, EMPLOYEE_ID, {
        name: 'Maria Perez',
        relationship: 'SPOUSE' as any,
        phone: '999111222',
        is_primary: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Maria Perez');
        expect(result.data.relationship).toBe('SPOUSE');
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
        expect(result.data.tenant_id).toBe(TENANT_ID);
      }
    });

    it('should return not found if employee does not exist', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const result = await service.addEmergencyContact(TENANT_ID, 'non-existent', {
        name: 'Contact',
        relationship: 'FRIEND' as any,
        phone: '999000000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should reject empty contact name', async () => {
      const employee = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(employee);

      const result = await service.addEmergencyContact(TENANT_ID, EMPLOYEE_ID, {
        name: '',
        relationship: 'FRIEND' as any,
        phone: '999000000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('name');
      }
    });

    it('should reject empty contact phone', async () => {
      const employee = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(employee);

      const result = await service.addEmergencyContact(TENANT_ID, EMPLOYEE_ID, {
        name: 'Contact Name',
        relationship: 'FRIEND' as any,
        phone: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('phone');
      }
    });
  });

  // ========================================================================
  // Upload Document
  // ========================================================================

  describe('uploadDocument', () => {
    it('should upload document for existing employee', async () => {
      const employee = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(employee);

      const docRow = {
        id: 'doc-1',
        tenant_id: TENANT_ID,
        employee_id: EMPLOYEE_ID,
        document_type: 'CONTRACT',
        document_url: 'https://storage.example.com/contract.pdf',
        expiry_date: null,
        notes: 'Initial contract',
        uploaded_by: ACTOR_ID,
        uploaded_at: new Date(),
      };
      mockPrisma.employee_documents.create.mockResolvedValue(docRow);

      const result = await service.uploadDocument(TENANT_ID, EMPLOYEE_ID, {
        document_type: 'CONTRACT' as any,
        document_url: 'https://storage.example.com/contract.pdf',
        notes: 'Initial contract',
        uploaded_by: ACTOR_ID,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.document_type).toBe('CONTRACT');
        expect(result.data.document_url).toBe('https://storage.example.com/contract.pdf');
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
        expect(result.data.tenant_id).toBe(TENANT_ID);
      }
    });

    it('should return not found if employee does not exist', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const result = await service.uploadDocument(TENANT_ID, 'non-existent', {
        document_type: 'CONTRACT' as any,
        document_url: 'https://example.com/file.pdf',
        uploaded_by: ACTOR_ID,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should reject empty document URL', async () => {
      const employee = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(employee);

      const result = await service.uploadDocument(TENANT_ID, EMPLOYEE_ID, {
        document_type: 'CONTRACT' as any,
        document_url: '',
        uploaded_by: ACTOR_ID,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Document URL');
      }
    });
  });

  // ========================================================================
  // Tenant Isolation
  // ========================================================================

  describe('tenant isolation', () => {
    it('create: includes tenant_id in employee data', async () => {
      const input = makeValidInput();
      const row = makeEmployeeRow();

      mockTx.employees.create.mockResolvedValue(row);
      mockTx.events.create.mockResolvedValue({});

      await service.create(TENANT_ID, input);

      expect(mockTx.employees.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('create: includes tenant_id in event data', async () => {
      const input = makeValidInput();
      const row = makeEmployeeRow();

      mockTx.employees.create.mockResolvedValue(row);
      mockTx.events.create.mockResolvedValue({});

      await service.create(TENANT_ID, input);

      expect(mockTx.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('getById: queries with tenant_id', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      await service.getById(TENANT_ID, EMPLOYEE_ID);

      expect(mockPrisma.employees.findFirst).toHaveBeenCalledWith({
        where: { id: EMPLOYEE_ID, tenant_id: TENANT_ID },
      });
    });

    it('list: queries with tenant_id', async () => {
      mockPrisma.employees.findMany.mockResolvedValue([]);
      mockPrisma.employees.count.mockResolvedValue(0);

      await service.list(TENANT_ID);

      const call = mockPrisma.employees.findMany.mock.calls[0][0];
      expect(call.where.tenant_id).toBe(TENANT_ID);
    });

    it('search: queries with tenant_id', async () => {
      mockPrisma.employees.findMany.mockResolvedValue([]);

      await service.search(TENANT_ID, 'test');

      const call = mockPrisma.employees.findMany.mock.calls[0][0];
      expect(call.where.tenant_id).toBe(TENANT_ID);
    });

    it('addEmergencyContact: verifies employee belongs to tenant', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const result = await service.addEmergencyContact(TENANT_ID, EMPLOYEE_ID, {
        name: 'Contact',
        relationship: 'FRIEND' as any,
        phone: '999000000',
      });

      expect(mockPrisma.employees.findFirst).toHaveBeenCalledWith({
        where: { id: EMPLOYEE_ID, tenant_id: TENANT_ID },
      });
      expect(result.success).toBe(false);
    });

    it('uploadDocument: verifies employee belongs to tenant', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const result = await service.uploadDocument(TENANT_ID, EMPLOYEE_ID, {
        document_type: 'CONTRACT' as any,
        document_url: 'https://example.com/file.pdf',
        uploaded_by: ACTOR_ID,
      });

      expect(mockPrisma.employees.findFirst).toHaveBeenCalledWith({
        where: { id: EMPLOYEE_ID, tenant_id: TENANT_ID },
      });
      expect(result.success).toBe(false);
    });
  });
});
