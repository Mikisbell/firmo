/**
 * Employee Property Tests - fast-check based
 *
 * Property-based tests for the EmployeeService.
 * Tests invariants that must hold for any valid input.
 *
 * Uses in-memory mock "database" to verify service behavior
 * without depending on a real Prisma connection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { isoDateArb, tenantIdArb, uuidArb } from '@/src/test-utils';
import { EmployeeService, PERU_MINIMUM_WAGE_CENTS } from '@/src/core/services/employee.service';
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from '@/src/core/services/employee.service';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// withTransaction reads _mockTx from the prisma instance passed to it,
// ensuring each property test iteration uses its own isolated mock tx.
vi.mock('@/src/core/db/transaction', () => ({
  withTransaction: vi.fn(async (prisma: any, operation: any, _opts?: any) => {
    try {
      const result = await operation(prisma._mockTx);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error };
    }
  }),
}));

// ============================================================================
// Arbitraries
// ============================================================================

const roleArb = fc.constantFrom('CASHIER', 'WAITER', 'COOK', 'SUPERVISOR', 'ADMIN');
const contractTypeArb = fc.constantFrom('INDEFINIDO', 'PLAZO_FIJO', 'PART_TIME');
const workScheduleArb = fc.constantFrom('FULL_TIME', 'PART_TIME', 'ROTATING');
const relationshipArb = fc.constantFrom('SPOUSE', 'PARENT', 'SIBLING', 'CHILD', 'FRIEND', 'OTHER');

const validSalaryArb = fc.integer({ min: PERU_MINIMUM_WAGE_CENTS, max: 10_000_000 });
const belowMinSalaryArb = fc.integer({ min: 0, max: PERU_MINIMUM_WAGE_CENTS - 1 });

const nameArb = fc.stringMatching(/^[A-Za-z ]{2,50}$/).filter(s => s.trim().length >= 2);
const positionArb = fc.stringMatching(/^[A-Za-z ]{2,30}$/).filter(s => s.trim().length >= 2);
const phoneArb = fc.stringMatching(/^[0-9]{6,15}$/);

const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2027-12-31') })
  .filter(d => !isNaN(d.getTime()));

const createEmployeeInputArb = fc.record({
  name: nameArb,
  role: roleArb,
  hire_date: dateArb,
  position: positionArb,
  base_salary_cents: validSalaryArb,
  contract_type: contractTypeArb,
  work_schedule_type: workScheduleArb,
  created_by: fc.uuid(),
}) as fc.Arbitrary<CreateEmployeeInput>;

// ============================================================================
// In-memory mock database factory
// ============================================================================

function createMockDB() {
  const employees = new Map<string, any>();
  const events: any[] = [];
  const emergencyContacts = new Map<string, any>();
  const documents = new Map<string, any>();

  // Transaction mock - operates on the same in-memory store
  const localMockTx = {
    employees: {
      create: vi.fn(async ({ data }: any) => {
        const record = { ...data, created_at: new Date() };
        employees.set(data.id, record);
        return record;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const emp = employees.get(where.id);
        if (!emp) throw new Error('Not found');
        const updated = { ...emp, ...data };
        employees.set(where.id, updated);
        return updated;
      }),
    },
    events: {
      create: vi.fn(async ({ data }: any) => {
        events.push(data);
        return data;
      }),
    },
  };

  const mockPrisma: any = {
    // Attach the tx mock to the prisma instance so withTransaction can find it
    _mockTx: localMockTx,
    employees: {
      findFirst: vi.fn(async ({ where }: any) => {
        for (const emp of employees.values()) {
          if (
            emp.id === where.id &&
            emp.tenant_id === where.tenant_id
          ) {
            return emp;
          }
        }
        return null;
      }),
      findMany: vi.fn(async ({ where, skip, take, orderBy }: any) => {
        let results = Array.from(employees.values()).filter(
          (e) => e.tenant_id === where.tenant_id,
        );
        if (where.role) results = results.filter((e) => e.role === where.role);
        if (where.is_active !== undefined) results = results.filter((e) => e.is_active === where.is_active);
        if (where.OR) {
          const search = where.OR;
          results = results.filter((e) => {
            return search.some((cond: any) => {
              if (cond.name) {
                const q = cond.name.contains;
                return e.name.toLowerCase().includes(q.toLowerCase());
              }
              if (cond.dni) {
                const q = cond.dni.contains;
                return e.dni && e.dni.toLowerCase().includes(q.toLowerCase());
              }
              return false;
            });
          });
        }
        if (skip) results = results.slice(skip);
        if (take) results = results.slice(0, take);
        return results;
      }),
      count: vi.fn(async ({ where }: any) => {
        let results = Array.from(employees.values()).filter(
          (e) => e.tenant_id === where.tenant_id,
        );
        if (where.role) results = results.filter((e) => e.role === where.role);
        if (where.is_active !== undefined) results = results.filter((e) => e.is_active === where.is_active);
        return results.length;
      }),
    },
    emergency_contacts: {
      create: vi.fn(async ({ data }: any) => {
        const id = data.id || crypto.randomUUID();
        const record = { ...data, id, created_at: new Date() };
        emergencyContacts.set(id, record);
        return record;
      }),
    },
    employee_documents: {
      create: vi.fn(async ({ data }: any) => {
        const id = data.id || crypto.randomUUID();
        const record = { ...data, id, uploaded_at: new Date() };
        documents.set(id, record);
        return record;
      }),
    },
  };

  return { mockPrisma, employees, events, emergencyContacts, documents };
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Employee Property Tests', () => {
  // ==========================================================================
  // Property 1: Employee profile stores and retrieves all fields correctly
  // ==========================================================================

  describe('Property 1: Employee profile round-trip', () => {
    it('stores and retrieves all fields correctly for any valid employee', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          createEmployeeInputArb,
          async (tenantId, input) => {
            const { mockPrisma, employees } = createMockDB();
            const service = new EmployeeService(mockPrisma);

            const result = await service.create(tenantId, input);

            expect(result.success).toBe(true);
            if (!result.success) return;

            const stored = result.data;

            // All fields should match input
            expect(stored.name).toBe(input.name.trim());
            expect(stored.role).toBe(input.role);
            expect(stored.base_salary_cents).toBe(input.base_salary_cents);
            expect(stored.contract_type).toBe(input.contract_type);
            expect(stored.work_schedule_type).toBe(input.work_schedule_type);
            expect(stored.position).toBe(input.position);
            expect(stored.is_active).toBe(true);
            expect(stored.tenant_id).toBe(tenantId);

            // Retrieving by ID should return the same data
            const getResult = await service.getById(tenantId, stored.id);
            expect(getResult.success).toBe(true);
            if (getResult.success) {
              expect(getResult.data.id).toBe(stored.id);
              expect(getResult.data.name).toBe(stored.name);
              expect(getResult.data.role).toBe(stored.role);
              expect(getResult.data.base_salary_cents).toBe(stored.base_salary_cents);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ==========================================================================
  // Property 2: Salary validation rejects values below minimum
  // ==========================================================================

  describe('Property 2: Salary validation', () => {
    it('rejects any salary below Peruvian minimum wage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          belowMinSalaryArb,
          async (tenantId, badSalary) => {
            const { mockPrisma } = createMockDB();
            const service = new EmployeeService(mockPrisma);

            const input: CreateEmployeeInput = {
              name: 'Test Employee',
              role: 'CASHIER' as any,
              hire_date: new Date('2025-01-01'),
              position: 'Cajero',
              base_salary_cents: badSalary,
              contract_type: 'INDEFINIDO' as any,
              work_schedule_type: 'FULL_TIME' as any,
              created_by: crypto.randomUUID(),
            };

            const result = await service.create(tenantId, input);

            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error.code).toBe('VALIDATION_ERROR');
              expect(result.error.message).toContain(String(PERU_MINIMUM_WAGE_CENTS));
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('accepts any salary at or above minimum wage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          validSalaryArb,
          async (tenantId, goodSalary) => {
            const { mockPrisma } = createMockDB();
            const service = new EmployeeService(mockPrisma);

            const input: CreateEmployeeInput = {
              name: 'Test Employee',
              role: 'CASHIER' as any,
              hire_date: new Date('2025-01-01'),
              position: 'Cajero',
              base_salary_cents: goodSalary,
              contract_type: 'INDEFINIDO' as any,
              work_schedule_type: 'FULL_TIME' as any,
              created_by: crypto.randomUUID(),
            };

            const result = await service.create(tenantId, input);

            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('rejects non-integer salary values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.double({ min: PERU_MINIMUM_WAGE_CENTS, max: 10_000_000, noInteger: true }),
          async (tenantId, floatSalary) => {
            const { mockPrisma } = createMockDB();
            const service = new EmployeeService(mockPrisma);

            const input: CreateEmployeeInput = {
              name: 'Test Employee',
              role: 'CASHIER' as any,
              hire_date: new Date('2025-01-01'),
              position: 'Cajero',
              base_salary_cents: floatSalary,
              contract_type: 'INDEFINIDO' as any,
              work_schedule_type: 'FULL_TIME' as any,
              created_by: crypto.randomUUID(),
            };

            const result = await service.create(tenantId, input);

            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error.message).toContain('integer');
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ==========================================================================
  // Property 3: Emergency contact validation
  // ==========================================================================

  describe('Property 3: Emergency contact validation', () => {
    it('stores emergency contacts with all fields correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          createEmployeeInputArb,
          nameArb,
          relationshipArb,
          phoneArb,
          fc.boolean(),
          async (tenantId, empInput, contactName, relationship, phone, isPrimary) => {
            const { mockPrisma } = createMockDB();
            const service = new EmployeeService(mockPrisma);

            // Create employee first
            const empResult = await service.create(tenantId, empInput);
            expect(empResult.success).toBe(true);
            if (!empResult.success) return;

            // Add emergency contact
            const contactResult = await service.addEmergencyContact(
              tenantId,
              empResult.data.id,
              {
                name: contactName,
                relationship: relationship as any,
                phone,
                is_primary: isPrimary,
              },
            );

            expect(contactResult.success).toBe(true);
            if (contactResult.success) {
              expect(contactResult.data.name).toBe(contactName.trim());
              expect(contactResult.data.relationship).toBe(relationship);
              expect(contactResult.data.phone).toBe(phone.trim());
              expect(contactResult.data.is_primary).toBe(isPrimary);
              expect(contactResult.data.tenant_id).toBe(tenantId);
              expect(contactResult.data.employee_id).toBe(empResult.data.id);
            }
          },
        ),
        { numRuns: 30 },
      );
    });

    it('rejects emergency contact for non-existent employee', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          nameArb,
          relationshipArb,
          phoneArb,
          async (tenantId, fakeEmployeeId, contactName, relationship, phone) => {
            const { mockPrisma } = createMockDB();
            const service = new EmployeeService(mockPrisma);

            const result = await service.addEmergencyContact(
              tenantId,
              fakeEmployeeId,
              {
                name: contactName,
                relationship: relationship as any,
                phone,
              },
            );

            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error.code).toBe('NOT_FOUND');
            }
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  // ==========================================================================
  // Property 4: Soft delete preserves data
  // ==========================================================================

  describe('Property 4: Soft delete preserves data', () => {
    it('deactivation sets is_active=false but record still exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          createEmployeeInputArb,
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.uuid(),
          async (tenantId, input, reason, deactivatedBy) => {
            const { mockPrisma, employees } = createMockDB();
            const service = new EmployeeService(mockPrisma);

            // Create employee
            const createResult = await service.create(tenantId, input);
            expect(createResult.success).toBe(true);
            if (!createResult.success) return;

            const employeeId = createResult.data.id;

            // Verify is_active is true
            expect(createResult.data.is_active).toBe(true);

            // Deactivate
            const deactivateResult = await service.deactivate(
              tenantId,
              employeeId,
              reason,
              deactivatedBy,
            );

            expect(deactivateResult.success).toBe(true);
            if (!deactivateResult.success) return;

            // is_active should be false
            expect(deactivateResult.data.is_active).toBe(false);

            // Record should still exist in the database
            expect(employees.has(employeeId)).toBe(true);
            const dbRecord = employees.get(employeeId);
            expect(dbRecord.is_active).toBe(false);

            // All other fields should be preserved
            expect(dbRecord.name).toBe(input.name.trim());
            expect(dbRecord.role).toBe(input.role);
            expect(dbRecord.base_salary_cents).toBe(input.base_salary_cents);
            expect(dbRecord.position).toBe(input.position);
            expect(dbRecord.tenant_id).toBe(tenantId);

            // Should still be retrievable by ID
            const getResult = await service.getById(tenantId, employeeId);
            expect(getResult.success).toBe(true);
            if (getResult.success) {
              expect(getResult.data.is_active).toBe(false);
              expect(getResult.data.name).toBe(input.name.trim());
            }
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  // ==========================================================================
  // Property 5: Audit trail - profile changes are tracked
  // ==========================================================================

  describe('Property 5: Audit trail for profile changes', () => {
    it('every mutation emits an event to the events table', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          createEmployeeInputArb,
          nameArb,
          positionArb,
          fc.uuid(),
          async (tenantId, input, newName, newPosition, actorId) => {
            const { mockPrisma, events } = createMockDB();
            const service = new EmployeeService(mockPrisma);

            // 1. Create employee - should emit EMPLOYEE_CREATED
            const createResult = await service.create(tenantId, input);
            expect(createResult.success).toBe(true);
            if (!createResult.success) return;

            const employeeId = createResult.data.id;

            // Verify creation event
            const createdEvents = events.filter(
              (e) => e.type === 'EMPLOYEE_CREATED' && e.entity_id === employeeId,
            );
            expect(createdEvents.length).toBe(1);
            expect(createdEvents[0].tenant_id).toBe(tenantId);
            expect(createdEvents[0].payload.employee_id).toBe(employeeId);

            // 2. Update profile - should emit EMPLOYEE_PROFILE_UPDATED
            const updateResult = await service.update(
              tenantId,
              employeeId,
              { name: newName, position: newPosition },
              actorId,
            );
            expect(updateResult.success).toBe(true);

            const updatedEvents = events.filter(
              (e) => e.type === 'EMPLOYEE_PROFILE_UPDATED' && e.entity_id === employeeId,
            );
            expect(updatedEvents.length).toBe(1);
            expect(updatedEvents[0].tenant_id).toBe(tenantId);
            expect(updatedEvents[0].payload.changes).toEqual(
              expect.objectContaining({ name: newName, position: newPosition }),
            );
            expect(updatedEvents[0].payload.updated_by).toBe(actorId);

            // 3. Deactivate - should emit EMPLOYEE_DEACTIVATED
            const deactivateResult = await service.deactivate(
              tenantId,
              employeeId,
              'Resigned',
              actorId,
            );
            expect(deactivateResult.success).toBe(true);

            const deactivatedEvents = events.filter(
              (e) => e.type === 'EMPLOYEE_DEACTIVATED' && e.entity_id === employeeId,
            );
            expect(deactivatedEvents.length).toBe(1);
            expect(deactivatedEvents[0].tenant_id).toBe(tenantId);
            expect(deactivatedEvents[0].payload.reason).toBe('Resigned');
            expect(deactivatedEvents[0].payload.deactivated_by).toBe(actorId);

            // Total: 3 events for the 3 mutations
            const employeeEvents = events.filter((e) => e.entity_id === employeeId);
            expect(employeeEvents.length).toBe(3);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('events always include tenant_id and entity_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          createEmployeeInputArb,
          async (tenantId, input) => {
            const { mockPrisma, events } = createMockDB();
            const service = new EmployeeService(mockPrisma);

            const result = await service.create(tenantId, input);
            expect(result.success).toBe(true);
            if (!result.success) return;

            // All events must have tenant_id and entity_id
            for (const event of events) {
              expect(event.tenant_id).toBe(tenantId);
              expect(event.entity_id).toBeDefined();
              expect(typeof event.entity_id).toBe('string');
              expect(event.entity_type).toBe('EMPLOYEE');
              expect(event.type).toBeDefined();
              expect(event.occurred_at).toBeDefined();
            }
          },
        ),
        { numRuns: 30 },
      );
    });
  });
});
