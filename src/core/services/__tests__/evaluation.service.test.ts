/**
 * Evaluation Service Unit Tests
 *
 * Tests the EvaluationService with mocked Prisma client.
 * Verifies business rules, tenant isolation, status transitions,
 * score validation, and event emission.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EvaluationService,
  calculateAverageScores,
  validateScores,
} from '../evaluation.service';
import type { CreateEvaluationInput } from '../evaluation.service';

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
  evaluations: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
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
const EVALUATOR_ID = '22222222-3333-4444-5555-666666666666';
const EVALUATION_ID = '33333333-4444-5555-6666-777777777777';
const ACTOR_ID = '99999999-8888-7777-6666-555555555555';

function makeValidInput(overrides?: Partial<CreateEvaluationInput>): CreateEvaluationInput {
  return {
    employee_id: EMPLOYEE_ID,
    evaluator_id: EVALUATOR_ID,
    period_start: new Date('2025-01-01'),
    period_end: new Date('2025-06-30'),
    scores: { punctuality: 4, quality: 5, attitude: 4, sales: 5 },
    automatic_metrics: { total_sales: 50000, avg_tips: 1500 },
    comments: 'Excelente desempeno',
    goals: [{ goal: 'Aumentar ventas 10%', progress: 0.8 }],
    created_by: ACTOR_ID,
    ...overrides,
  };
}

function makeEvaluationRow(overrides?: Record<string, unknown>) {
  return {
    id: EVALUATION_ID,
    tenant_id: TENANT_ID,
    employee_id: EMPLOYEE_ID,
    evaluator_id: EVALUATOR_ID,
    period_start: new Date('2025-01-01'),
    period_end: new Date('2025-06-30'),
    scores: { punctuality: 4, quality: 5, attitude: 4, sales: 5 },
    automatic_metrics: { total_sales: 50000, avg_tips: 1500 },
    comments: 'Excelente desempeno',
    employee_comments: null,
    goals: [{ goal: 'Aumentar ventas 10%', progress: 0.8 }],
    status: 'DRAFT',
    completed_at: null,
    created_at: new Date('2025-07-01'),
    ...overrides,
  };
}

function makeEmployeeRow(id: string = EMPLOYEE_ID) {
  return {
    id,
    tenant_id: TENANT_ID,
    name: 'Juan Perez',
    role: 'CASHIER',
    is_active: true,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('EvaluationService', () => {
  let service: EvaluationService;

  const mockPrisma: any = {
    _mockTx: mockTx,
    employees: {
      findFirst: vi.fn(),
    },
    evaluations: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    events: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    service = new EvaluationService(mockPrisma);
    vi.clearAllMocks();
  });

  // ========================================================================
  // Create Evaluation
  // ========================================================================

  describe('create', () => {
    it('should create an evaluation with valid data', async () => {
      const input = makeValidInput();
      const row = makeEvaluationRow();

      mockPrisma.employees.findFirst
        .mockResolvedValueOnce(makeEmployeeRow(EMPLOYEE_ID)) // employee
        .mockResolvedValueOnce(makeEmployeeRow(EVALUATOR_ID)); // evaluator
      mockTx.evaluations.create.mockResolvedValue(row);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
        expect(result.data.evaluator_id).toBe(EVALUATOR_ID);
        expect(result.data.status).toBe('DRAFT');
        expect(result.data.scores).toEqual({ punctuality: 4, quality: 5, attitude: 4, sales: 5 });
        expect(result.data.tenant_id).toBe(TENANT_ID);
      }

      // Verify event was emitted
      expect(mockTx.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            type: 'EVALUATION_CREATED',
            entity_type: 'EVALUATION',
          }),
        }),
      );
    });

    it('should fail when employee not found', async () => {
      const input = makeValidInput();
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('Employee');
      }
    });

    it('should fail when evaluator not found', async () => {
      const input = makeValidInput();
      mockPrisma.employees.findFirst
        .mockResolvedValueOnce(makeEmployeeRow(EMPLOYEE_ID)) // employee found
        .mockResolvedValueOnce(null); // evaluator not found

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('Evaluator');
      }
    });

    it('should fail when period_start > period_end', async () => {
      const input = makeValidInput({
        period_start: new Date('2025-07-01'),
        period_end: new Date('2025-01-01'),
      });

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('period_start');
      }
    });

    it('should fail when scores are invalid (not 1-5)', async () => {
      const input = makeValidInput({
        scores: { punctuality: 4, quality: 6 }, // 6 is out of range
      });

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Scores');
      }
    });

    it('should fail when scores is empty', async () => {
      const input = makeValidInput({
        scores: {},
      });

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Scores');
      }
    });
  });

  // ========================================================================
  // Complete Evaluation
  // ========================================================================

  describe('complete', () => {
    it('should complete a DRAFT evaluation', async () => {
      const row = makeEvaluationRow({ status: 'DRAFT' });
      const completedRow = makeEvaluationRow({
        status: 'COMPLETED',
        completed_at: new Date(),
      });

      mockPrisma.evaluations.findFirst.mockResolvedValue(row);
      mockTx.evaluations.update.mockResolvedValue(completedRow);

      const result = await service.complete(TENANT_ID, EVALUATION_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('COMPLETED');
        expect(result.data.completed_at).not.toBeNull();
      }
    });

    it('should fail when status is not DRAFT', async () => {
      const row = makeEvaluationRow({ status: 'COMPLETED' });
      mockPrisma.evaluations.findFirst.mockResolvedValue(row);

      const result = await service.complete(TENANT_ID, EVALUATION_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('DRAFT');
      }
    });

    it('should fail when evaluation not found', async () => {
      mockPrisma.evaluations.findFirst.mockResolvedValue(null);

      const result = await service.complete(TENANT_ID, 'non-existent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ========================================================================
  // Add Employee Comments
  // ========================================================================

  describe('addEmployeeComments', () => {
    it('should add employee comments successfully', async () => {
      const row = makeEvaluationRow();
      const updatedRow = makeEvaluationRow({
        employee_comments: 'Me esforzare mas',
      });

      mockPrisma.evaluations.findFirst.mockResolvedValue(row);
      mockTx.evaluations.update.mockResolvedValue(updatedRow);

      const result = await service.addEmployeeComments(
        TENANT_ID,
        EVALUATION_ID,
        'Me esforzare mas',
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.employee_comments).toBe('Me esforzare mas');
      }
    });

    it('should fail when evaluation not found', async () => {
      mockPrisma.evaluations.findFirst.mockResolvedValue(null);

      const result = await service.addEmployeeComments(
        TENANT_ID,
        'non-existent',
        'Some comment',
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ========================================================================
  // Review Evaluation
  // ========================================================================

  describe('review', () => {
    it('should review a COMPLETED evaluation', async () => {
      const row = makeEvaluationRow({ status: 'COMPLETED' });
      const reviewedRow = makeEvaluationRow({ status: 'REVIEWED' });

      mockPrisma.evaluations.findFirst.mockResolvedValue(row);
      mockTx.evaluations.update.mockResolvedValue(reviewedRow);

      const result = await service.review(TENANT_ID, EVALUATION_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('REVIEWED');
      }
    });

    it('should fail when status is not COMPLETED', async () => {
      const row = makeEvaluationRow({ status: 'DRAFT' });
      mockPrisma.evaluations.findFirst.mockResolvedValue(row);

      const result = await service.review(TENANT_ID, EVALUATION_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('COMPLETED');
      }
    });
  });

  // ========================================================================
  // Get by ID
  // ========================================================================

  describe('getById', () => {
    it('should return evaluation by ID', async () => {
      const row = makeEvaluationRow();
      mockPrisma.evaluations.findFirst.mockResolvedValue(row);

      const result = await service.getById(TENANT_ID, EVALUATION_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(EVALUATION_ID);
        expect(result.data.tenant_id).toBe(TENANT_ID);
      }

      expect(mockPrisma.evaluations.findFirst).toHaveBeenCalledWith({
        where: { id: EVALUATION_ID, tenant_id: TENANT_ID },
      });
    });

    it('should return not found', async () => {
      mockPrisma.evaluations.findFirst.mockResolvedValue(null);

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
    it('should return evaluations for an employee', async () => {
      const rows = [
        makeEvaluationRow({ id: 'eval-1' }),
        makeEvaluationRow({ id: 'eval-2' }),
      ];
      mockPrisma.evaluations.findMany.mockResolvedValue(rows);

      const result = await service.listByEmployee(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }

      expect(mockPrisma.evaluations.findMany).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, employee_id: EMPLOYEE_ID },
        orderBy: { period_end: 'desc' },
      });
    });
  });

  // ========================================================================
  // Get Average Score
  // ========================================================================

  describe('getAverageScore', () => {
    it('should calculate correct average score', async () => {
      const rows = [
        makeEvaluationRow({
          scores: { punctuality: 4, quality: 5 },
        }),
        makeEvaluationRow({
          scores: { punctuality: 2, quality: 3 },
        }),
      ];
      mockPrisma.evaluations.findMany.mockResolvedValue(rows);

      const result = await service.getAverageScore(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.evaluation_count).toBe(2);
        // punctuality avg: (4+2)/2 = 3, quality avg: (5+3)/2 = 4
        expect(result.data.category_averages.punctuality).toBe(3);
        expect(result.data.category_averages.quality).toBe(4);
        // overall avg: (3+4)/2 = 3.5
        expect(result.data.average_score).toBe(3.5);
      }
    });

    it('should handle no evaluations', async () => {
      mockPrisma.evaluations.findMany.mockResolvedValue([]);

      const result = await service.getAverageScore(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.evaluation_count).toBe(0);
        expect(result.data.average_score).toBe(0);
        expect(result.data.category_averages).toEqual({});
      }
    });
  });

  // ========================================================================
  // Pure Functions
  // ========================================================================

  describe('calculateAverageScores', () => {
    it('should calculate average of score values', () => {
      expect(calculateAverageScores({ a: 3, b: 5 })).toBe(4);
      expect(calculateAverageScores({ a: 1 })).toBe(1);
      expect(calculateAverageScores({ a: 4, b: 4, c: 4 })).toBe(4);
    });

    it('should return 0 for empty scores', () => {
      expect(calculateAverageScores({})).toBe(0);
    });
  });

  describe('validateScores', () => {
    it('should accept valid scores (1-5)', () => {
      expect(validateScores({ a: 1, b: 5, c: 3 })).toBe(true);
      expect(validateScores({ x: 1 })).toBe(true);
    });

    it('should reject invalid scores (out of range)', () => {
      expect(validateScores({ a: 0 })).toBe(false);
      expect(validateScores({ a: 6 })).toBe(false);
      expect(validateScores({ a: -1 })).toBe(false);
      expect(validateScores({ a: 'text' })).toBe(false);
    });

    it('should reject empty scores', () => {
      expect(validateScores({})).toBe(false);
    });
  });
});
