/**
 * Training Service Unit Tests
 *
 * Tests the TrainingService with mocked Prisma client.
 * Verifies business rules, tenant isolation, compliance checks,
 * training hour calculations, and event emission.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TrainingService,
  MANDATORY_TRAINING_TYPES,
  isTrainingExpired,
  calculateCompletionRate,
} from '../training.service';
import type { RecordTrainingInput } from '../training.service';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

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
    findFirst: vi.fn(),
  },
  training_records: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  events: {
    create: vi.fn(),
  },
};

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = '11111111-2222-3333-4444-555555555555';
const TRAINING_ID = '44444444-5555-6666-7777-888888888888';
const ACTOR_ID = '99999999-8888-7777-6666-555555555555';

function makeValidInput(overrides?: Partial<RecordTrainingInput>): RecordTrainingInput {
  return {
    employee_id: EMPLOYEE_ID,
    training_name: 'Manipulacion de Alimentos',
    training_type: 'MANDATORY',
    provider: 'Instituto Culinario',
    duration_hours: 8,
    completion_date: new Date('2025-06-15'),
    certificate_url: 'https://certs.example.com/cert-001.pdf',
    score: 85,
    notes: 'Aprobado con excelencia',
    assigned_by: ACTOR_ID,
    recorded_by: ACTOR_ID,
    ...overrides,
  };
}

function makeTrainingRow(overrides?: Record<string, unknown>) {
  return {
    id: TRAINING_ID,
    tenant_id: TENANT_ID,
    employee_id: EMPLOYEE_ID,
    training_name: 'Manipulacion de Alimentos',
    training_type: 'MANDATORY',
    provider: 'Instituto Culinario',
    duration_hours: 8,
    completion_date: new Date('2025-06-15'),
    certificate_url: 'https://certs.example.com/cert-001.pdf',
    score: 85,
    notes: 'Aprobado con excelencia',
    assigned_by: ACTOR_ID,
    created_at: new Date('2025-06-16'),
    ...overrides,
  };
}

function makeEmployeeRow() {
  return {
    id: EMPLOYEE_ID,
    tenant_id: TENANT_ID,
    name: 'Juan Perez',
    role: 'CASHIER',
    is_active: true,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('TrainingService', () => {
  let service: TrainingService;

  const mockPrisma: any = {
    _mockTx: mockTx,
    employees: {
      findFirst: vi.fn(),
    },
    training_records: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    events: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    service = new TrainingService(mockPrisma);
    vi.clearAllMocks();
  });

  // ========================================================================
  // Record Training
  // ========================================================================

  describe('record', () => {
    it('should record a training with valid data', async () => {
      const input = makeValidInput();
      const row = makeTrainingRow();

      mockPrisma.employees.findFirst.mockResolvedValue(makeEmployeeRow());
      mockTx.training_records.create.mockResolvedValue(row);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.record(TENANT_ID, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.training_name).toBe('Manipulacion de Alimentos');
        expect(result.data.training_type).toBe('MANDATORY');
        expect(result.data.score).toBe(85);
        expect(result.data.tenant_id).toBe(TENANT_ID);
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
      }

      // Verify event was emitted
      expect(mockTx.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            type: 'TRAINING_COMPLETED',
            entity_type: 'TRAINING',
          }),
        }),
      );
    });

    it('should fail when employee not found', async () => {
      const input = makeValidInput();
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const result = await service.record(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('Employee');
      }
    });

    it('should fail when training_name is empty', async () => {
      const input = makeValidInput({ training_name: '' });

      const result = await service.record(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Training name');
      }
    });

    it('should fail when score is out of range (0-100)', async () => {
      const input = makeValidInput({ score: 101 });

      const result = await service.record(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Score');
      }
    });

    it('should succeed without optional fields', async () => {
      const input: RecordTrainingInput = {
        employee_id: EMPLOYEE_ID,
        training_name: 'Basic Training',
        training_type: 'OPTIONAL',
        completion_date: new Date('2025-06-15'),
        recorded_by: ACTOR_ID,
      };
      const row = makeTrainingRow({
        training_name: 'Basic Training',
        training_type: 'OPTIONAL',
        provider: null,
        duration_hours: null,
        certificate_url: null,
        score: null,
        notes: null,
        assigned_by: null,
      });

      mockPrisma.employees.findFirst.mockResolvedValue(makeEmployeeRow());
      mockTx.training_records.create.mockResolvedValue(row);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.record(TENANT_ID, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBeNull();
        expect(result.data.duration_hours).toBeNull();
        expect(result.data.score).toBeNull();
      }
    });
  });

  // ========================================================================
  // Get by ID
  // ========================================================================

  describe('getById', () => {
    it('should return training by ID', async () => {
      const row = makeTrainingRow();
      mockPrisma.training_records.findFirst.mockResolvedValue(row);

      const result = await service.getById(TENANT_ID, TRAINING_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(TRAINING_ID);
        expect(result.data.tenant_id).toBe(TENANT_ID);
      }

      expect(mockPrisma.training_records.findFirst).toHaveBeenCalledWith({
        where: { id: TRAINING_ID, tenant_id: TENANT_ID },
      });
    });

    it('should return not found', async () => {
      mockPrisma.training_records.findFirst.mockResolvedValue(null);

      const result = await service.getById(TENANT_ID, 'non-existent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ========================================================================
  // List by Employee
  // ========================================================================

  describe('listByEmployee', () => {
    it('should return all trainings for an employee', async () => {
      const rows = [
        makeTrainingRow({ id: 'tr-1' }),
        makeTrainingRow({ id: 'tr-2', training_name: 'Seguridad e Higiene' }),
      ];
      mockPrisma.training_records.findMany.mockResolvedValue(rows);

      const result = await service.listByEmployee(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }

      expect(mockPrisma.training_records.findMany).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, employee_id: EMPLOYEE_ID },
        orderBy: { completion_date: 'desc' },
      });
    });

    it('should filter by training type', async () => {
      mockPrisma.training_records.findMany.mockResolvedValue([]);

      await service.listByEmployee(TENANT_ID, EMPLOYEE_ID, {
        training_type: 'MANDATORY',
      });

      expect(mockPrisma.training_records.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          employee_id: EMPLOYEE_ID,
          training_type: 'MANDATORY',
        },
        orderBy: { completion_date: 'desc' },
      });
    });
  });

  // ========================================================================
  // List by Type
  // ========================================================================

  describe('listByType', () => {
    it('should return trainings of the correct type', async () => {
      const rows = [
        makeTrainingRow({ id: 'tr-1', training_type: 'CERTIFICATION' }),
      ];
      mockPrisma.training_records.findMany.mockResolvedValue(rows);

      const result = await service.listByType(TENANT_ID, 'CERTIFICATION');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].training_type).toBe('CERTIFICATION');
      }

      expect(mockPrisma.training_records.findMany).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, training_type: 'CERTIFICATION' },
        orderBy: { completion_date: 'desc' },
      });
    });
  });

  // ========================================================================
  // Compliance Status
  // ========================================================================

  describe('getComplianceStatus', () => {
    it('should report compliant when all mandatory trainings completed', async () => {
      const rows = MANDATORY_TRAINING_TYPES.map((name, i) =>
        makeTrainingRow({
          id: `tr-${i}`,
          training_name: name,
          training_type: 'MANDATORY',
        }),
      );
      mockPrisma.training_records.findMany.mockResolvedValue(rows);

      const result = await service.getComplianceStatus(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_compliant).toBe(true);
        expect(result.data.missing_trainings).toHaveLength(0);
        expect(result.data.completed_mandatory).toBe(MANDATORY_TRAINING_TYPES.length);
        expect(result.data.completion_rate).toBe(100);
      }
    });

    it('should report non-compliant when missing mandatory trainings', async () => {
      // Only completed the first one
      const rows = [
        makeTrainingRow({
          id: 'tr-0',
          training_name: MANDATORY_TRAINING_TYPES[0],
          training_type: 'MANDATORY',
        }),
      ];
      mockPrisma.training_records.findMany.mockResolvedValue(rows);

      const result = await service.getComplianceStatus(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_compliant).toBe(false);
        expect(result.data.missing_trainings.length).toBe(
          MANDATORY_TRAINING_TYPES.length - 1,
        );
        expect(result.data.completed_mandatory).toBe(1);
        expect(result.data.total_mandatory_types).toBe(MANDATORY_TRAINING_TYPES.length);
      }
    });
  });

  // ========================================================================
  // Employee Training Hours
  // ========================================================================

  describe('getEmployeeTrainingHours', () => {
    it('should sum training hours correctly', async () => {
      mockPrisma.training_records.findMany.mockResolvedValue([
        { duration_hours: 8 },
        { duration_hours: 4 },
        { duration_hours: 16 },
      ]);

      const result = await service.getEmployeeTrainingHours(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(28);
      }
    });

    it('should handle null duration_hours as 0', async () => {
      mockPrisma.training_records.findMany.mockResolvedValue([
        { duration_hours: 8 },
        { duration_hours: null },
        { duration_hours: 4 },
      ]);

      const result = await service.getEmployeeTrainingHours(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(12);
      }
    });
  });

  // ========================================================================
  // Pure Functions
  // ========================================================================

  describe('isTrainingExpired', () => {
    it('should return false for recently completed training', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 1); // yesterday
      expect(isTrainingExpired(recentDate, 12)).toBe(false);
    });

    it('should return true for expired training', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago
      expect(isTrainingExpired(oldDate, 12)).toBe(true); // 12 month validity
    });
  });

  describe('calculateCompletionRate', () => {
    it('should return 100 when all done', () => {
      expect(calculateCompletionRate(3, 3)).toBe(100);
    });

    it('should return 100 when 0 required', () => {
      expect(calculateCompletionRate(0, 0)).toBe(100);
    });
  });
});
