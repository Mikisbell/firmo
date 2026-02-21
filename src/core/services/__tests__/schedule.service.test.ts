/**
 * Schedule Service Unit Tests
 *
 * Tests ScheduleService with fully mocked Prisma:
 * - Template creation and validation
 * - Employee template assignment
 * - Schedule generation from template
 * - Weekly calendar retrieval
 * - Shift change request workflow (request / approve / reject)
 * - Conflict detection for overlapping schedules
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScheduleService } from '../schedule.service';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrisma = {
  schedule_templates: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  employee_schedules: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  schedules: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  shift_change_requests: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
} as any;

// ---------------------------------------------------------------------------
// Shared Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-aaa-bbb-ccc';
const LOCATION_ID = 'loc-111-222-333';
const EMPLOYEE_A = 'emp-aaa';
const EMPLOYEE_B = 'emp-bbb';
const TEMPLATE_ID = 'tpl-001';
const APPROVER_ID = 'mgr-001';

const baseTemplate = {
  id: TEMPLATE_ID,
  tenant_id: TENANT_ID,
  location_id: LOCATION_ID,
  name: 'Turno Manana',
  schedule_type: 'FIXED',
  days_of_week: [1, 2, 3, 4, 5],
  start_time: '08:00',
  end_time: '17:00',
  break_minutes: 60,
  is_active: true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScheduleService', () => {
  let service: ScheduleService;

  beforeEach(() => {
    service = new ScheduleService(mockPrisma);
    vi.clearAllMocks();
  });

  // =========================================================================
  // createTemplate
  // =========================================================================

  describe('createTemplate', () => {
    it('should create a template with valid data', async () => {
      mockPrisma.schedule_templates.create.mockResolvedValue(baseTemplate);

      const result = await service.createTemplate(TENANT_ID, {
        location_id: LOCATION_ID,
        name: 'Turno Manana',
        schedule_type: 'FIXED',
        days_of_week: [1, 2, 3, 4, 5],
        start_time: '08:00',
        end_time: '17:00',
        break_minutes: 60,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Turno Manana');
        expect(result.data.days_of_week).toEqual([1, 2, 3, 4, 5]);
        expect(result.data.is_active).toBe(true);
      }
      expect(mockPrisma.schedule_templates.create).toHaveBeenCalledTimes(1);
    });

    it('should reject empty days_of_week', async () => {
      const result = await service.createTemplate(TENANT_ID, {
        location_id: LOCATION_ID,
        name: 'Invalid',
        schedule_type: 'FIXED',
        days_of_week: [],
        start_time: '08:00',
        end_time: '17:00',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('days_of_week');
      }
    });

    it('should reject invalid day numbers', async () => {
      const result = await service.createTemplate(TENANT_ID, {
        location_id: LOCATION_ID,
        name: 'Bad Days',
        schedule_type: 'FIXED',
        days_of_week: [0, 8],
        start_time: '08:00',
        end_time: '17:00',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('between 1 and 7');
      }
    });

    it('should reject invalid time format', async () => {
      const result = await service.createTemplate(TENANT_ID, {
        location_id: LOCATION_ID,
        name: 'Bad Time',
        schedule_type: 'FIXED',
        days_of_week: [1],
        start_time: '8am',
        end_time: '17:00',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('HH:mm');
      }
    });

    it('should reject empty template name', async () => {
      const result = await service.createTemplate(TENANT_ID, {
        location_id: LOCATION_ID,
        name: '  ',
        schedule_type: 'FIXED',
        days_of_week: [1],
        start_time: '08:00',
        end_time: '17:00',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('name');
      }
    });
  });

  // =========================================================================
  // assignToEmployee
  // =========================================================================

  describe('assignToEmployee', () => {
    it('should assign a template to an employee', async () => {
      mockPrisma.schedule_templates.findFirst.mockResolvedValue(baseTemplate);
      mockPrisma.employee_schedules.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.employee_schedules.create.mockResolvedValue({
        id: 'assign-001',
        tenant_id: TENANT_ID,
        employee_id: EMPLOYEE_A,
        template_id: TEMPLATE_ID,
        start_date: new Date('2026-02-01'),
        end_date: null,
        is_active: true,
        created_at: new Date(),
      });

      const result = await service.assignToEmployee(
        TENANT_ID,
        EMPLOYEE_A,
        TEMPLATE_ID,
        new Date('2026-02-01')
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.employee_id).toBe(EMPLOYEE_A);
        expect(result.data.template_id).toBe(TEMPLATE_ID);
        expect(result.data.is_active).toBe(true);
      }
      // Should deactivate previous assignments
      expect(mockPrisma.employee_schedules.updateMany).toHaveBeenCalledTimes(1);
    });

    it('should return NotFound when template does not exist', async () => {
      mockPrisma.schedule_templates.findFirst.mockResolvedValue(null);

      const result = await service.assignToEmployee(
        TENANT_ID,
        EMPLOYEE_A,
        'nonexistent',
        new Date('2026-02-01')
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // =========================================================================
  // generateSchedules
  // =========================================================================

  describe('generateSchedules', () => {
    it('should generate schedules only for template days_of_week', async () => {
      // Template is Mon-Fri (1-5)
      mockPrisma.schedule_templates.findFirst.mockResolvedValue(baseTemplate);
      mockPrisma.employee_schedules.findMany.mockResolvedValue([
        { employee_id: EMPLOYEE_A },
      ]);

      let createCount = 0;
      mockPrisma.schedules.create.mockImplementation(async (args: any) => {
        createCount++;
        return {
          id: `sched-${createCount}`,
          tenant_id: args.data.tenant_id,
          location_id: args.data.location_id,
          employee_id: args.data.employee_id,
          date: args.data.date,
          shift_start: args.data.shift_start,
          shift_end: args.data.shift_end,
          break_minutes: args.data.break_minutes,
          status: args.data.status,
          created_by: args.data.created_by,
        };
      });

      // 2026-02-16 is Monday, 2026-02-22 is Sunday -> 5 weekdays
      const start = new Date('2026-02-16');
      const end = new Date('2026-02-22');

      const result = await service.generateSchedules(
        TENANT_ID,
        TEMPLATE_ID,
        start,
        end
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(5); // Mon-Fri only
        for (const s of result.data) {
          expect(s.shift_start).toBe('08:00');
          expect(s.shift_end).toBe('17:00');
          expect(s.status).toBe('SCHEDULED');
        }
      }
    });

    it('should return empty array when no employees are assigned', async () => {
      mockPrisma.schedule_templates.findFirst.mockResolvedValue(baseTemplate);
      mockPrisma.employee_schedules.findMany.mockResolvedValue([]);

      const result = await service.generateSchedules(
        TENANT_ID,
        TEMPLATE_ID,
        new Date('2026-02-16'),
        new Date('2026-02-22')
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should reject when startDate is after endDate', async () => {
      const result = await service.generateSchedules(
        TENANT_ID,
        TEMPLATE_ID,
        new Date('2026-02-22'),
        new Date('2026-02-16')
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('startDate');
      }
    });

    it('should return NotFound when template does not exist', async () => {
      mockPrisma.schedule_templates.findFirst.mockResolvedValue(null);

      const result = await service.generateSchedules(
        TENANT_ID,
        'nonexistent',
        new Date('2026-02-16'),
        new Date('2026-02-22')
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // =========================================================================
  // getWeeklyCalendar
  // =========================================================================

  describe('getWeeklyCalendar', () => {
    it('should return schedules for the given week', async () => {
      const weekSchedules = [
        {
          id: 's1',
          employee_id: EMPLOYEE_A,
          date: new Date('2026-02-16'),
          shift_start: '08:00',
          shift_end: '17:00',
          break_minutes: 60,
          status: 'SCHEDULED',
          notes: null,
        },
        {
          id: 's2',
          employee_id: EMPLOYEE_B,
          date: new Date('2026-02-17'),
          shift_start: '14:00',
          shift_end: '22:00',
          break_minutes: 30,
          status: 'SCHEDULED',
          notes: 'Cover for Ana',
        },
      ];

      mockPrisma.schedules.findMany.mockResolvedValue(weekSchedules);

      const result = await service.getWeeklyCalendar(
        TENANT_ID,
        LOCATION_ID,
        new Date('2026-02-16')
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data[0].employee_id).toBe(EMPLOYEE_A);
        expect(result.data[1].notes).toBe('Cover for Ana');
      }
      // Verify date range filter
      const callArgs = mockPrisma.schedules.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe(TENANT_ID);
      expect(callArgs.where.location_id).toBe(LOCATION_ID);
      expect(callArgs.where.date.gte).toEqual(new Date('2026-02-16'));
      expect(callArgs.where.date.lte).toEqual(new Date('2026-02-22'));
    });
  });

  // =========================================================================
  // Shift Change Request Workflow
  // =========================================================================

  describe('requestShiftChange', () => {
    it('should create a shift change request in PENDING status', async () => {
      const mockRequest = {
        id: 'req-001',
        tenant_id: TENANT_ID,
        requester_id: EMPLOYEE_A,
        target_employee_id: EMPLOYEE_B,
        original_date: new Date('2026-02-20'),
        new_date: null,
        reason: 'Medical appointment',
        status: 'PENDING',
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        created_at: new Date(),
      };

      mockPrisma.shift_change_requests.create.mockResolvedValue(mockRequest);

      const result = await service.requestShiftChange(TENANT_ID, EMPLOYEE_A, {
        target_employee_id: EMPLOYEE_B,
        original_date: new Date('2026-02-20'),
        reason: 'Medical appointment',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('PENDING');
        expect(result.data.requester_id).toBe(EMPLOYEE_A);
        expect(result.data.target_employee_id).toBe(EMPLOYEE_B);
      }
    });

    it('should reject empty reason', async () => {
      const result = await service.requestShiftChange(TENANT_ID, EMPLOYEE_A, {
        original_date: new Date('2026-02-20'),
        reason: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Reason');
      }
    });
  });

  describe('approveShiftChange', () => {
    it('should approve a PENDING request and swap schedules', async () => {
      const pendingRequest = {
        id: 'req-001',
        tenant_id: TENANT_ID,
        requester_id: EMPLOYEE_A,
        target_employee_id: EMPLOYEE_B,
        original_date: new Date('2026-02-20'),
        new_date: null,
        reason: 'Medical appointment',
        status: 'PENDING',
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        created_at: new Date(),
      };

      mockPrisma.shift_change_requests.findFirst.mockResolvedValue(pendingRequest);

      // Requester's schedule
      mockPrisma.schedules.findFirst
        .mockResolvedValueOnce({
          id: 'sched-A',
          employee_id: EMPLOYEE_A,
          date: new Date('2026-02-20'),
        })
        // Target's schedule
        .mockResolvedValueOnce({
          id: 'sched-B',
          employee_id: EMPLOYEE_B,
          date: new Date('2026-02-20'),
        });

      mockPrisma.schedules.update.mockResolvedValue({});

      mockPrisma.shift_change_requests.update.mockResolvedValue({
        ...pendingRequest,
        status: 'APPROVED',
        approved_by: APPROVER_ID,
        approved_at: new Date(),
      });

      const result = await service.approveShiftChange(TENANT_ID, 'req-001', APPROVER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('APPROVED');
        expect(result.data.approved_by).toBe(APPROVER_ID);
      }
      // Both schedules should have been swapped
      expect(mockPrisma.schedules.update).toHaveBeenCalledTimes(2);
    });

    it('should return NotFound for non-existent request', async () => {
      mockPrisma.shift_change_requests.findFirst.mockResolvedValue(null);

      const result = await service.approveShiftChange(TENANT_ID, 'nonexistent', APPROVER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should reject approval of non-PENDING request', async () => {
      mockPrisma.shift_change_requests.findFirst.mockResolvedValue({
        id: 'req-002',
        tenant_id: TENANT_ID,
        status: 'APPROVED',
      });

      const result = await service.approveShiftChange(TENANT_ID, 'req-002', APPROVER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_STATUS');
      }
    });
  });

  describe('rejectShiftChange', () => {
    it('should reject a PENDING request with reason', async () => {
      const pendingRequest = {
        id: 'req-003',
        tenant_id: TENANT_ID,
        requester_id: EMPLOYEE_A,
        target_employee_id: null,
        original_date: new Date('2026-02-20'),
        new_date: null,
        reason: 'Personal',
        status: 'PENDING',
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        created_at: new Date(),
      };

      mockPrisma.shift_change_requests.findFirst.mockResolvedValue(pendingRequest);
      mockPrisma.shift_change_requests.update.mockResolvedValue({
        ...pendingRequest,
        status: 'REJECTED',
        approved_by: APPROVER_ID,
        rejection_reason: 'No coverage available',
      });

      const result = await service.rejectShiftChange(
        TENANT_ID,
        'req-003',
        APPROVER_ID,
        'No coverage available'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('REJECTED');
        expect(result.data.rejection_reason).toBe('No coverage available');
      }
    });

    it('should reject rejection of non-PENDING request', async () => {
      mockPrisma.shift_change_requests.findFirst.mockResolvedValue({
        id: 'req-004',
        tenant_id: TENANT_ID,
        status: 'REJECTED',
      });

      const result = await service.rejectShiftChange(
        TENANT_ID,
        'req-004',
        APPROVER_ID,
        'Too late'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_STATUS');
      }
    });
  });

  // =========================================================================
  // detectConflicts
  // =========================================================================

  describe('detectConflicts', () => {
    it('should detect overlapping schedules', async () => {
      mockPrisma.schedules.findMany.mockResolvedValue([
        {
          id: 'existing-1',
          date: new Date('2026-02-20'),
          shift_start: '08:00',
          shift_end: '17:00',
        },
      ]);

      // Candidate: 10:00-14:00 overlaps with 08:00-17:00
      const result = await service.detectConflicts(
        TENANT_ID,
        EMPLOYEE_A,
        new Date('2026-02-20'),
        '10:00',
        '14:00'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0].existing_schedule_id).toBe('existing-1');
      }
    });

    it('should not flag adjacent (non-overlapping) schedules', async () => {
      mockPrisma.schedules.findMany.mockResolvedValue([
        {
          id: 'existing-2',
          date: new Date('2026-02-20'),
          shift_start: '08:00',
          shift_end: '12:00',
        },
      ]);

      // Candidate starts exactly when existing ends -> no overlap
      const result = await service.detectConflicts(
        TENANT_ID,
        EMPLOYEE_A,
        new Date('2026-02-20'),
        '12:00',
        '18:00'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(0);
      }
    });

    it('should detect multiple overlapping schedules', async () => {
      mockPrisma.schedules.findMany.mockResolvedValue([
        {
          id: 'morning',
          date: new Date('2026-02-20'),
          shift_start: '06:00',
          shift_end: '10:00',
        },
        {
          id: 'afternoon',
          date: new Date('2026-02-20'),
          shift_start: '14:00',
          shift_end: '20:00',
        },
      ]);

      // Candidate: 09:00-15:00 overlaps with both
      const result = await service.detectConflicts(
        TENANT_ID,
        EMPLOYEE_A,
        new Date('2026-02-20'),
        '09:00',
        '15:00'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
      }
    });

    it('should return empty array when no schedules exist', async () => {
      mockPrisma.schedules.findMany.mockResolvedValue([]);

      const result = await service.detectConflicts(
        TENANT_ID,
        EMPLOYEE_A,
        new Date('2026-02-20'),
        '08:00',
        '17:00'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });
});
