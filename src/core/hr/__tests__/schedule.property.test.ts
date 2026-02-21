/**
 * Schedule Property-Based Tests
 *
 * Property 6:  Conflict detection catches overlapping schedules
 * Property 7:  Shift change request workflow (PENDING -> APPROVED or REJECTED)
 * Property 8:  Generated schedules match template days_of_week
 * Property 9:  Schedules are within template start/end times
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { ScheduleService } from '@/src/core/services/schedule.service';

// ============================================================================
// Arbitraries
// ============================================================================

/** Two ordered times so start < end (HH:mm format) */
const orderedTimePairArb = fc
  .tuple(
    fc.integer({ min: 0, max: 22 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 1, max: 8 }) // offset hours so end > start
  )
  .map(([h, m, offset]) => {
    const endH = Math.min(h + offset, 23);
    const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const end = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { start, end };
  })
  .filter(({ start, end }) => start < end);

/** ISO day-of-week subset 1..7 (non-empty) */
const daysOfWeekArb = fc
  .subarray([1, 2, 3, 4, 5, 6, 7], { minLength: 1, maxLength: 7 })
  .map((arr) => [...arr].sort((a, b) => a - b));

const uuidArb = fc.uuid({ version: 4 });

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert JS Date.getDay() (0=Sun) to ISO day-of-week (1=Mon ... 7=Sun).
 */
function toIsoDay(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

/**
 * Build a minimal mock Prisma that records calls and returns predictable data.
 */
function makeMockPrisma() {
  return {
    schedule_templates: {
      create: vi.fn().mockImplementation(async (args: any) => args.data),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    employee_schedules: {
      create: vi.fn().mockImplementation(async (args: any) => args.data),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    schedules: {
      create: vi.fn().mockImplementation(async (args: any) => args.data),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation(async (args: any) => args.data),
    },
    shift_change_requests: {
      create: vi.fn().mockImplementation(async (args: any) => args.data),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation(async (args: any) => ({
        id: 'req-id',
        tenant_id: 'tenant-1',
        requester_id: 'emp-1',
        target_employee_id: null,
        original_date: new Date(),
        new_date: null,
        reason: 'test',
        created_at: new Date(),
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        ...args.data,
      })),
    },
  } as any;
}

// ============================================================================
// Property 6: Conflict detection catches overlapping schedules
// ============================================================================

describe('Property 6: Conflict detection catches overlapping schedules', () => {
  it('overlapping time ranges always produce at least one conflict', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderedTimePairArb,
        fc.integer({ min: 1, max: 4 }),
        async (existing, overlapOffset) => {
          const existStart = existing.start;
          const existEnd = existing.end;

          // Candidate that starts inside the existing range
          const existStartH = parseInt(existStart.split(':')[0]);
          const candidateStartH = Math.min(existStartH + overlapOffset, 22);
          const candidateStart = `${String(candidateStartH).padStart(2, '0')}:00`;
          const candidateEndH = Math.min(candidateStartH + 2, 23);
          const candidateEnd = `${String(candidateEndH).padStart(2, '0')}:00`;

          // Skip if candidate doesn't actually overlap (edge case from clamping)
          if (candidateStart >= existEnd || candidateEnd <= existStart) return;

          const mockPrisma = makeMockPrisma();
          mockPrisma.schedules.findMany.mockResolvedValue([
            {
              id: 'existing-sched',
              date: new Date('2026-03-01'),
              shift_start: existStart,
              shift_end: existEnd,
            },
          ]);

          const service = new ScheduleService(mockPrisma);
          const result = await service.detectConflicts(
            'tenant-1',
            'emp-1',
            new Date('2026-03-01'),
            candidateStart,
            candidateEnd
          );

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.length).toBeGreaterThanOrEqual(1);
          }
        }
      ),
      { numRuns: 80 }
    );
  });

  it('non-overlapping time ranges produce zero conflicts', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderedTimePairArb,
        async (existing) => {
          // Candidate starts exactly when existing ends -> no overlap
          const existEnd = existing.end;
          const endH = parseInt(existEnd.split(':')[0]);
          if (endH >= 22) return; // can't fit another shift

          const candidateStart = existEnd;
          const candidateEndH = Math.min(endH + 2, 23);
          const candidateEnd = `${String(candidateEndH).padStart(2, '0')}:00`;

          if (candidateStart >= candidateEnd) return;

          const mockPrisma = makeMockPrisma();
          mockPrisma.schedules.findMany.mockResolvedValue([
            {
              id: 'existing-sched',
              date: new Date('2026-03-01'),
              shift_start: existing.start,
              shift_end: existing.end,
            },
          ]);

          const service = new ScheduleService(mockPrisma);
          const result = await service.detectConflicts(
            'tenant-1',
            'emp-1',
            new Date('2026-03-01'),
            candidateStart,
            candidateEnd
          );

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.length).toBe(0);
          }
        }
      ),
      { numRuns: 80 }
    );
  });
});

// ============================================================================
// Property 7: Shift change request workflow (PENDING -> APPROVED or REJECTED)
// ============================================================================

describe('Property 7: Shift change request workflow', () => {
  it('a PENDING request can transition to APPROVED', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, uuidArb, async (requestId, requesterId, approverId) => {
        const mockPrisma = makeMockPrisma();

        mockPrisma.shift_change_requests.findFirst.mockResolvedValue({
          id: requestId,
          tenant_id: 'tenant-1',
          requester_id: requesterId,
          target_employee_id: null,
          original_date: new Date('2026-03-15'),
          new_date: null,
          reason: 'Need day off',
          status: 'PENDING',
          approved_by: null,
          approved_at: null,
          rejection_reason: null,
          created_at: new Date(),
        });

        mockPrisma.shift_change_requests.update.mockImplementation(async (args: any) => ({
          id: requestId,
          tenant_id: 'tenant-1',
          requester_id: requesterId,
          target_employee_id: null,
          original_date: new Date('2026-03-15'),
          new_date: null,
          reason: 'Need day off',
          created_at: new Date(),
          rejection_reason: null,
          ...args.data,
        }));

        const service = new ScheduleService(mockPrisma);
        const result = await service.approveShiftChange('tenant-1', requestId, approverId);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('APPROVED');
          expect(result.data.approved_by).toBe(approverId);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('a PENDING request can transition to REJECTED', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        async (requestId, requesterId, rejecterId, rejectionReason) => {
          const mockPrisma = makeMockPrisma();

          mockPrisma.shift_change_requests.findFirst.mockResolvedValue({
            id: requestId,
            tenant_id: 'tenant-1',
            requester_id: requesterId,
            target_employee_id: null,
            original_date: new Date('2026-03-15'),
            new_date: null,
            reason: 'Request',
            status: 'PENDING',
            approved_by: null,
            approved_at: null,
            rejection_reason: null,
            created_at: new Date(),
          });

          mockPrisma.shift_change_requests.update.mockImplementation(async (args: any) => ({
            id: requestId,
            tenant_id: 'tenant-1',
            requester_id: requesterId,
            target_employee_id: null,
            original_date: new Date('2026-03-15'),
            new_date: null,
            reason: 'Request',
            created_at: new Date(),
            approved_at: null,
            ...args.data,
          }));

          const service = new ScheduleService(mockPrisma);
          const result = await service.rejectShiftChange(
            'tenant-1',
            requestId,
            rejecterId,
            rejectionReason
          );

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.status).toBe('REJECTED');
            expect(result.data.rejection_reason).toBe(rejectionReason);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('non-PENDING requests cannot be approved or rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('APPROVED', 'REJECTED'),
        uuidArb,
        async (currentStatus, requestId) => {
          const mockPrisma = makeMockPrisma();

          mockPrisma.shift_change_requests.findFirst.mockResolvedValue({
            id: requestId,
            tenant_id: 'tenant-1',
            status: currentStatus,
          });

          const service = new ScheduleService(mockPrisma);

          const approveResult = await service.approveShiftChange('tenant-1', requestId, 'mgr-1');
          expect(approveResult.success).toBe(false);
          if (!approveResult.success) {
            expect(approveResult.error.code).toBe('INVALID_STATUS');
          }

          const rejectResult = await service.rejectShiftChange(
            'tenant-1',
            requestId,
            'mgr-1',
            'reason'
          );
          expect(rejectResult.success).toBe(false);
          if (!rejectResult.success) {
            expect(rejectResult.error.code).toBe('INVALID_STATUS');
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ============================================================================
// Property 8: Generated schedules match template days_of_week
// ============================================================================

describe('Property 8: Generated schedules match template days_of_week', () => {
  it('every generated schedule falls on a day listed in template.days_of_week', async () => {
    await fc.assert(
      fc.asyncProperty(
        daysOfWeekArb,
        orderedTimePairArb,
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 7, max: 28 }),
        async (daysOfWeek, times, startOffset, rangeDays) => {
          const startDate = new Date('2026-01-01T00:00:00.000Z');
          startDate.setDate(startDate.getDate() + startOffset);

          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + rangeDays);

          const templateId = 'tpl-prop8';
          const tenantId = 'tenant-prop8';

          const template = {
            id: templateId,
            tenant_id: tenantId,
            location_id: 'loc-1',
            name: 'Test',
            schedule_type: 'FIXED',
            days_of_week: daysOfWeek,
            start_time: times.start,
            end_time: times.end,
            break_minutes: 30,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          };

          const mockPrisma = makeMockPrisma();
          mockPrisma.schedule_templates.findFirst.mockResolvedValue(template);
          mockPrisma.employee_schedules.findMany.mockResolvedValue([
            { employee_id: 'emp-1' },
          ]);

          const createdDates: Date[] = [];
          mockPrisma.schedules.create.mockImplementation(async (args: any) => {
            createdDates.push(new Date(args.data.date));
            return args.data;
          });

          const service = new ScheduleService(mockPrisma);
          const result = await service.generateSchedules(
            tenantId,
            templateId,
            startDate,
            endDate
          );

          expect(result.success).toBe(true);
          if (result.success) {
            // Every generated schedule must fall on a day in days_of_week
            for (const d of createdDates) {
              const isoDay = toIsoDay(d);
              expect(daysOfWeek).toContain(isoDay);
            }

            // Verify that the number of generated schedules matches the
            // expected number of matching days in the range
            let expectedCount = 0;
            const cursor = new Date(startDate);
            while (cursor <= endDate) {
              if (daysOfWeek.includes(toIsoDay(cursor))) {
                expectedCount++;
              }
              cursor.setDate(cursor.getDate() + 1);
            }
            expect(result.data.length).toBe(expectedCount);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Property 9: Schedules are within template start/end times
// ============================================================================

describe('Property 9: Schedules are within template start/end times', () => {
  it('every generated schedule has shift_start and shift_end matching the template', async () => {
    await fc.assert(
      fc.asyncProperty(
        daysOfWeekArb,
        orderedTimePairArb,
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 7, max: 14 }),
        fc.integer({ min: 0, max: 120 }),
        async (daysOfWeek, times, startOffset, rangeDays, breakMinutes) => {
          const startDate = new Date('2026-01-01T00:00:00.000Z');
          startDate.setDate(startDate.getDate() + startOffset);

          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + rangeDays);

          const templateId = 'tpl-prop9';
          const tenantId = 'tenant-prop9';

          const template = {
            id: templateId,
            tenant_id: tenantId,
            location_id: 'loc-1',
            name: 'Time Check',
            schedule_type: 'FIXED',
            days_of_week: daysOfWeek,
            start_time: times.start,
            end_time: times.end,
            break_minutes: breakMinutes,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          };

          const mockPrisma = makeMockPrisma();
          mockPrisma.schedule_templates.findFirst.mockResolvedValue(template);
          mockPrisma.employee_schedules.findMany.mockResolvedValue([
            { employee_id: 'emp-1' },
          ]);
          mockPrisma.schedules.create.mockImplementation(async (args: any) => args.data);

          const service = new ScheduleService(mockPrisma);
          const result = await service.generateSchedules(
            tenantId,
            templateId,
            startDate,
            endDate
          );

          expect(result.success).toBe(true);
          if (result.success) {
            for (const schedule of result.data) {
              expect(schedule.shift_start).toBe(times.start);
              expect(schedule.shift_end).toBe(times.end);
              expect(schedule.break_minutes).toBe(breakMinutes);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
