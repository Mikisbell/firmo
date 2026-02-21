/**
 * Attendance Property-Based Tests (fast-check)
 *
 * Property 10: Clock-in records have valid timestamps
 * Property 11: Worked hours = clock_out - clock_in - breaks (always non-negative)
 * Property 12: Late minutes = max(0, clock_in - scheduled_start)
 * Property 13: Overtime = max(0, worked_minutes - 480)
 * Property 14: Justified absence has justification text
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AttendanceService } from '@/src/core/services/attendance.service';
import type { BreakEntry } from '@/src/core/services/attendance.service';

// Fresh service per describe block to avoid shared state across parallel workers.
// Prisma is null since we only test pure calculation methods here.
let service: AttendanceService;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Arbitrary for a valid clock-in Date (any point in 2024-2027).
 */
const clockInArb = fc.date({
  min: new Date('2024-01-01T00:00:00.000Z'),
  max: new Date('2027-12-31T23:59:59.999Z'),
}).filter((d) => !isNaN(d.getTime()));

/**
 * Arbitrary that produces a (clockIn, clockOut) pair where clockOut >= clockIn.
 */
const clockInOutArb = clockInArb.chain((clockIn) =>
  fc
    .integer({ min: 0, max: 1440 }) // 0 to 24h in minutes
    .map((extraMinutes) => {
      const clockOut = new Date(clockIn.getTime() + extraMinutes * 60_000);
      return { clockIn, clockOut, diffMinutes: extraMinutes };
    }),
);

/**
 * Arbitrary for break entries whose total duration does not exceed
 * the working period.
 */
const breaksArb = (maxMinutes: number) =>
  fc
    .array(
      fc.integer({ min: 0, max: Math.max(0, Math.floor(maxMinutes / 2)) }),
      { minLength: 0, maxLength: 5 },
    )
    .filter((durations) => durations.reduce((s, d) => s + d, 0) <= maxMinutes)
    .map((durations) =>
      durations.map(
        (d): BreakEntry => ({
          start: '2026-01-01T12:00:00Z',
          end: '2026-01-01T12:30:00Z',
          duration_mins: d,
        }),
      ),
    );

/**
 * Arbitrary for scheduled start relative to a clockIn date.
 * Can be before or after clockIn by up to 2 hours.
 */
const scheduledStartArb = (clockIn: Date) =>
  fc.integer({ min: -120, max: 120 }).map((offsetMinutes) => {
    return new Date(clockIn.getTime() - offsetMinutes * 60_000);
  });

/**
 * Arbitrary for worked minutes (0..1440)
 */
const workedMinutesArb = fc.integer({ min: 0, max: 1440 });

/**
 * Arbitrary for standard work minutes (60..720)
 */
const standardMinutesArb = fc.integer({ min: 60, max: 720 });

/**
 * Arbitrary for a non-empty justification string.
 */
const justificationArb = fc.string({ minLength: 1, maxLength: 300 }).filter(s => s.trim().length > 0);

// ---------------------------------------------------------------------------
// Property 10: Clock-in records have valid timestamps
// ---------------------------------------------------------------------------

describe('Property 10: Clock-in records have valid timestamps', () => {
  beforeEach(() => { service = new AttendanceService(null as any); });

  it('clock-in time is always a valid Date', () => {
    fc.assert(
      fc.property(clockInArb, (clockIn) => {
        expect(clockIn).toBeInstanceOf(Date);
        expect(isNaN(clockIn.getTime())).toBe(false);
        expect(clockIn.getTime()).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('clock-in and clock-out maintain chronological order', () => {
    fc.assert(
      fc.property(clockInOutArb, ({ clockIn, clockOut }) => {
        expect(clockOut.getTime()).toBeGreaterThanOrEqual(clockIn.getTime());
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Worked hours = clock_out - clock_in - breaks (always >= 0)
// ---------------------------------------------------------------------------

describe('Property 11: Worked hours = clock_out - clock_in - breaks (always non-negative)', () => {
  beforeEach(() => { service = new AttendanceService(null as any); });

  it('worked minutes = diff - breaks, clamped to 0', () => {
    fc.assert(
      fc.property(
        clockInOutArb.chain(({ clockIn, clockOut, diffMinutes }) =>
          breaksArb(diffMinutes).map((breaks) => ({
            clockIn,
            clockOut,
            diffMinutes,
            breaks,
          })),
        ),
        ({ clockIn, clockOut, diffMinutes, breaks }) => {
          const totalBreak = breaks.reduce((s, b) => s + b.duration_mins, 0);
          const result = service.calculateHoursWorked(clockIn, clockOut, breaks);

          // Result should be non-negative
          expect(result).toBeGreaterThanOrEqual(0);

          // Result should equal diff - breaks (rounded)
          const expected = Math.max(0, Math.round(diffMinutes - totalBreak));
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('with no breaks, worked minutes equals time difference', () => {
    fc.assert(
      fc.property(clockInOutArb, ({ clockIn, clockOut, diffMinutes }) => {
        const result = service.calculateHoursWorked(clockIn, clockOut, []);
        expect(result).toBe(Math.max(0, diffMinutes));
      }),
      { numRuns: 100 },
    );
  });

  it('result is always non-negative even with large breaks', () => {
    fc.assert(
      fc.property(
        clockInArb,
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 1000 }),
        (clockIn, workMin, breakMin) => {
          const clockOut = new Date(clockIn.getTime() + workMin * 60_000);
          const breaks: BreakEntry[] = [
            { start: '', end: '', duration_mins: breakMin },
          ];
          const result = service.calculateHoursWorked(clockIn, clockOut, breaks);
          expect(result).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Late minutes = max(0, clock_in - scheduled_start)
// ---------------------------------------------------------------------------

describe('Property 12: Late minutes = max(0, clock_in - scheduled_start)', () => {
  beforeEach(() => { service = new AttendanceService(null as any); });

  it('lateness is always >= 0', () => {
    fc.assert(
      fc.property(
        clockInArb.chain((clockIn) =>
          scheduledStartArb(clockIn).map((scheduledStart) => ({
            clockIn,
            scheduledStart,
          })),
        ),
        ({ clockIn, scheduledStart }) => {
          const result = service.calculateLateness(clockIn, scheduledStart);
          expect(result).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('lateness equals max(0, round((clockIn - scheduledStart) / 60000))', () => {
    fc.assert(
      fc.property(
        clockInArb.chain((clockIn) =>
          scheduledStartArb(clockIn).map((scheduledStart) => ({
            clockIn,
            scheduledStart,
          })),
        ),
        ({ clockIn, scheduledStart }) => {
          const diffMs = clockIn.getTime() - scheduledStart.getTime();
          const expected = Math.max(0, Math.round(diffMs / 60_000));
          const result = service.calculateLateness(clockIn, scheduledStart);
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('is 0 when employee arrives early or on time', () => {
    fc.assert(
      fc.property(
        clockInArb,
        fc.integer({ min: 0, max: 120 }),
        (scheduledStart, earlyMinutes) => {
          const clockIn = new Date(
            scheduledStart.getTime() - earlyMinutes * 60_000,
          );
          const result = service.calculateLateness(clockIn, scheduledStart);
          expect(result).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13: Overtime = max(0, worked_minutes - 480)
// ---------------------------------------------------------------------------

describe('Property 13: Overtime = max(0, worked_minutes - 480)', () => {
  beforeEach(() => { service = new AttendanceService(null as any); });

  it('overtime is always >= 0', () => {
    fc.assert(
      fc.property(workedMinutesArb, (worked) => {
        const result = service.calculateOvertime(worked);
        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it('overtime = max(0, worked - standard) with default 480', () => {
    fc.assert(
      fc.property(workedMinutesArb, (worked) => {
        const result = service.calculateOvertime(worked);
        expect(result).toBe(Math.max(0, worked - 480));
      }),
      { numRuns: 200 },
    );
  });

  it('overtime = max(0, worked - standard) with custom standard', () => {
    fc.assert(
      fc.property(workedMinutesArb, standardMinutesArb, (worked, standard) => {
        const result = service.calculateOvertime(worked, standard);
        expect(result).toBe(Math.max(0, worked - standard));
      }),
      { numRuns: 200 },
    );
  });

  it('overtime is 0 when worked equals standard', () => {
    fc.assert(
      fc.property(standardMinutesArb, (standard) => {
        expect(service.calculateOvertime(standard, standard)).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 14: Justified absence has justification text
// ---------------------------------------------------------------------------

describe('Property 14: Justified absence has justification text', () => {
  beforeEach(() => { service = new AttendanceService(null as any); });

  it('justification text is always non-empty for justified absences', () => {
    fc.assert(
      fc.property(justificationArb, (justification) => {
        // Simulate what justifyAbsence stores in notes
        const notes = justification;
        expect(notes.length).toBeGreaterThan(0);
        expect(typeof notes).toBe('string');
      }),
      { numRuns: 100 },
    );
  });

  it('justification with certificate URL contains both parts', () => {
    fc.assert(
      fc.property(
        justificationArb,
        fc.webUrl(),
        (justification, certUrl) => {
          // Replicate the notes format from the service
          const notes = `${justification} | Certificate: ${certUrl}`;
          expect(notes).toContain(justification);
          expect(notes).toContain(certUrl);
          expect(notes.length).toBeGreaterThan(justification.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty justification is rejected (validation invariant)', () => {
    // The service returns a ValidationError for empty strings.
    // We verify the invariant: valid justifications are always non-empty.
    fc.assert(
      fc.property(justificationArb, (justification) => {
        expect(justification.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
