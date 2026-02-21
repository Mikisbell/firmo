/**
 * HR Events Property Tests - Fase 2 (Tasks 3.1 + 4.1)
 *
 * Property 58: All HR operations emit valid events
 * Property 60: Event replay reconstructs state deterministically
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EventSchema } from '@/src/core/domain/events';
import type { ParkEvent } from '@/src/core/domain/events';
import { applyEmployeeEvent } from '@/src/core/reducers/employee.reducer';
import { applyAttendanceEvent } from '@/src/core/reducers/attendance.reducer';
import { applyLeaveRequestEvent } from '@/src/core/reducers/leave-request.reducer';
import { applyPayrollEvent } from '@/src/core/reducers/payroll.reducer';
import { isoDateArb } from '@/src/test-utils';

// ============================================================================
// Arbitraries for HR events
// ============================================================================

const uuidArb = fc.uuid({ version: 4 });
const dateArb = fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2027-12-31T23:59:59.999Z') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString().split('T')[0]);
const periodMonthArb = fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2027-12-31T23:59:59.999Z') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
const roleArb = fc.constantFrom("CASHIER", "WAITER", "COOK", "SUPERVISOR", "ADMIN");
const contractTypeArb = fc.constantFrom("INDEFINIDO", "PLAZO_FIJO", "PART_TIME");
const leaveTypeArb = fc.constantFrom("VACATION", "SICK_LEAVE", "PERSONAL_LEAVE", "MATERNITY", "PATERNITY");
const positiveCentsArb = fc.integer({ min: 1, max: 100_000_00 }); // 1 cent to 100k soles

function baseEnvelopeArb(eventType: string) {
    return fc.record({
        event_id: uuidArb,
        tenant_id: uuidArb,
        terminal_id: fc.stringMatching(/^[a-z0-9-]{3,20}$/),
        terminal_sequence: fc.integer({ min: 0, max: 999999 }),
        occurred_at: isoDateArb,
        aggregate_type: fc.constant("HR" as const),
        aggregate_id: uuidArb,
        correlation_id: fc.stringMatching(/^[a-z0-9-]{3,20}$/),
        schema_version: fc.constant(1),
        payload_version: fc.constant(1),
        event_type: fc.constant(eventType),
    });
}

// ============================================================================
// Property 58: All HR events validate against EventSchema
// ============================================================================
describe('Property 58: All HR operations emit valid events', () => {

    it('EMPLOYEE_CREATED events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("EMPLOYEE_CREATED"),
            uuidArb,
            fc.string({ minLength: 1, maxLength: 100 }),
            roleArb,
            dateArb,
            positiveCentsArb,
            contractTypeArb,
            (envelope, employeeId, name, role, hireDate, salary, contractType) => {
                const event = {
                    ...envelope,
                    payload: {
                        employee_id: employeeId,
                        name,
                        role,
                        hire_date: hireDate,
                        base_salary_cents: salary,
                        contract_type: contractType,
                    },
                };
                const result = EventSchema.safeParse(event);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });

    it('EMPLOYEE_PROFILE_UPDATED events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("EMPLOYEE_PROFILE_UPDATED"),
            uuidArb,
            uuidArb,
            (envelope, employeeId, updatedBy) => {
                const event = {
                    ...envelope,
                    payload: {
                        employee_id: employeeId,
                        changes: { name: "New Name", role: "COOK" },
                        updated_by: updatedBy,
                    },
                };
                const result = EventSchema.safeParse(event);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });

    it('EMPLOYEE_DEACTIVATED events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("EMPLOYEE_DEACTIVATED"),
            uuidArb,
            uuidArb,
            fc.string({ minLength: 1, maxLength: 200 }),
            (envelope, employeeId, deactivatedBy, reason) => {
                const event = {
                    ...envelope,
                    payload: {
                        employee_id: employeeId,
                        reason,
                        deactivated_by: deactivatedBy,
                    },
                };
                const result = EventSchema.safeParse(event);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });

    it('ATTENDANCE_CLOCKED_IN events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("ATTENDANCE_CLOCKED_IN"),
            uuidArb,
            uuidArb,
            isoDateArb,
            fc.integer({ min: 0, max: 480 }),
            (envelope, attendanceId, employeeId, clockIn, lateMinutes) => {
                const event = {
                    ...envelope,
                    payload: {
                        attendance_id: attendanceId,
                        employee_id: employeeId,
                        clock_in: clockIn,
                        late_minutes: lateMinutes,
                    },
                };
                const result = EventSchema.safeParse(event);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });

    it('ATTENDANCE_CLOCKED_OUT events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("ATTENDANCE_CLOCKED_OUT"),
            uuidArb,
            uuidArb,
            isoDateArb,
            fc.integer({ min: 0, max: 1440 }),
            fc.integer({ min: 0, max: 480 }),
            (envelope, attendanceId, employeeId, clockOut, workedMin, overtimeMin) => {
                const event = {
                    ...envelope,
                    payload: {
                        attendance_id: attendanceId,
                        employee_id: employeeId,
                        clock_out: clockOut,
                        worked_minutes: workedMin,
                        overtime_minutes: overtimeMin,
                    },
                };
                const result = EventSchema.safeParse(event);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });

    it('LEAVE_REQUEST_CREATED events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("LEAVE_REQUEST_CREATED"),
            uuidArb,
            uuidArb,
            leaveTypeArb,
            dateArb,
            dateArb,
            fc.integer({ min: 1, max: 30 }),
            (envelope, requestId, employeeId, leaveType, startDate, endDate, days) => {
                const event = {
                    ...envelope,
                    payload: {
                        request_id: requestId,
                        employee_id: employeeId,
                        leave_type: leaveType,
                        start_date: startDate,
                        end_date: endDate,
                        days_requested: days,
                    },
                };
                const result = EventSchema.safeParse(event);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });

    it('ADVANCE_REQUESTED events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("ADVANCE_REQUESTED"),
            uuidArb,
            uuidArb,
            positiveCentsArb,
            fc.string({ minLength: 1, maxLength: 200 }),
            (envelope, advanceId, employeeId, amount, reason) => {
                const event = {
                    ...envelope,
                    payload: {
                        advance_id: advanceId,
                        employee_id: employeeId,
                        amount_cents: amount,
                        reason,
                    },
                };
                const result = EventSchema.safeParse(event);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });

    it('PAYROLL_CALCULATED events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("PAYROLL_CALCULATED"),
            uuidArb,
            uuidArb,
            periodMonthArb,
            positiveCentsArb,
            positiveCentsArb,
            (envelope, payrollId, employeeId, period, gross, net) => {
                const event = {
                    ...envelope,
                    payload: {
                        payroll_id: payrollId,
                        employee_id: employeeId,
                        period_month: period,
                        gross_salary_cents: gross,
                        net_salary_cents: net,
                        components: {
                            base_salary_cents: 102500,
                            commission_cents: 0,
                            tips_cents: 0,
                            overtime_cents: 0,
                            advances_cents: 0,
                            essalud_cents: 9225,
                            pension_cents: 13325,
                        },
                    },
                };
                const result = EventSchema.safeParse(event);
                if (!result.success) {
                    // Log error for debugging
                    expect(result.error.issues).toEqual([]);
                }
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });

    it('EVALUATION_CREATED events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("EVALUATION_CREATED"),
            uuidArb,
            uuidArb,
            uuidArb,
            dateArb,
            dateArb,
            (envelope, evalId, employeeId, evaluatorId, start, end) => {
                const event = {
                    ...envelope,
                    payload: {
                        evaluation_id: evalId,
                        employee_id: employeeId,
                        evaluator_id: evaluatorId,
                        period_start: start,
                        period_end: end,
                    },
                };
                const result = EventSchema.safeParse(event);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });

    it('TRAINING_COMPLETED events are valid', () => {
        fc.assert(fc.property(
            baseEnvelopeArb("TRAINING_COMPLETED"),
            uuidArb,
            uuidArb,
            fc.string({ minLength: 1, maxLength: 100 }),
            dateArb,
            (envelope, trainingId, employeeId, name, date) => {
                const event = {
                    ...envelope,
                    payload: {
                        training_id: trainingId,
                        employee_id: employeeId,
                        training_name: name,
                        completion_date: date,
                    },
                };
                const result = EventSchema.safeParse(event);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 50 });
    });
});

// ============================================================================
// Property 60: Event replay reconstructs state deterministically
// ============================================================================

function makeHREvent(overrides: Partial<ParkEvent> & { event_type: string; payload: any }): ParkEvent {
    return {
        event_id: crypto.randomUUID(),
        tenant_id: crypto.randomUUID(),
        terminal_id: 'test-terminal',
        terminal_sequence: 0,
        occurred_at: new Date().toISOString(),
        aggregate_type: 'HR',
        aggregate_id: crypto.randomUUID(),
        correlation_id: 'test-correlation',
        schema_version: 1,
        payload_version: 1,
        ...overrides,
    } as ParkEvent;
}

describe('Property 60: Event replay reconstructs state deterministically', () => {

    it('employee reducer: CREATE + UPDATE + DEACTIVATE produces same state on replay', () => {
        fc.assert(fc.property(
            uuidArb,
            fc.string({ minLength: 1, maxLength: 50 }),
            roleArb,
            positiveCentsArb,
            fc.string({ minLength: 1, maxLength: 50 }),
            (employeeId, name, role, salary, newName) => {
                const events: ParkEvent[] = [
                    makeHREvent({
                        event_type: "EMPLOYEE_CREATED",
                        terminal_sequence: 1,
                        payload: {
                            employee_id: employeeId,
                            name,
                            role,
                            hire_date: "2025-01-15",
                            base_salary_cents: salary,
                            contract_type: "INDEFINIDO",
                        },
                    }),
                    makeHREvent({
                        event_type: "EMPLOYEE_PROFILE_UPDATED",
                        terminal_sequence: 2,
                        payload: {
                            employee_id: employeeId,
                            changes: { name: newName },
                            updated_by: crypto.randomUUID(),
                        },
                    }),
                    makeHREvent({
                        event_type: "EMPLOYEE_DEACTIVATED",
                        terminal_sequence: 3,
                        payload: {
                            employee_id: employeeId,
                            reason: "Resigned",
                            deactivated_by: crypto.randomUUID(),
                        },
                    }),
                ];

                // Apply events twice - must produce same result
                const replay1 = events.reduce(
                    (state, event) => applyEmployeeEvent(state, event).state,
                    null as ReturnType<typeof applyEmployeeEvent>['state']
                );
                const replay2 = events.reduce(
                    (state, event) => applyEmployeeEvent(state, event).state,
                    null as ReturnType<typeof applyEmployeeEvent>['state']
                );

                expect(replay1).not.toBeNull();
                expect(replay2).not.toBeNull();
                expect(replay1!.name).toBe(newName);
                expect(replay1!.is_active).toBe(false);
                expect(replay1!.profile_changes.length).toBe(1);
                // Deterministic - same events produce same state
                expect(replay1!.name).toBe(replay2!.name);
                expect(replay1!.is_active).toBe(replay2!.is_active);
                expect(replay1!.base_salary_cents).toBe(replay2!.base_salary_cents);
                expect(replay1!.last_event_sequence).toBe(replay2!.last_event_sequence);
            }
        ), { numRuns: 50 });
    });

    it('attendance reducer: CLOCK_IN + CLOCK_OUT produces same state on replay', () => {
        fc.assert(fc.property(
            uuidArb,
            uuidArb,
            fc.integer({ min: 0, max: 120 }),
            fc.integer({ min: 300, max: 600 }),
            fc.integer({ min: 0, max: 120 }),
            (attendanceId, employeeId, lateMin, workedMin, overtimeMin) => {
                const clockIn = "2026-02-19T08:00:00.000Z";
                const clockOut = "2026-02-19T17:00:00.000Z";

                const events: ParkEvent[] = [
                    makeHREvent({
                        event_type: "ATTENDANCE_CLOCKED_IN",
                        terminal_sequence: 1,
                        payload: {
                            attendance_id: attendanceId,
                            employee_id: employeeId,
                            clock_in: clockIn,
                            late_minutes: lateMin,
                        },
                    }),
                    makeHREvent({
                        event_type: "ATTENDANCE_CLOCKED_OUT",
                        terminal_sequence: 2,
                        payload: {
                            attendance_id: attendanceId,
                            employee_id: employeeId,
                            clock_out: clockOut,
                            worked_minutes: workedMin,
                            overtime_minutes: overtimeMin,
                        },
                    }),
                ];

                const replay1 = events.reduce(
                    (state, event) => applyAttendanceEvent(state, event).state,
                    null as ReturnType<typeof applyAttendanceEvent>['state']
                );
                const replay2 = events.reduce(
                    (state, event) => applyAttendanceEvent(state, event).state,
                    null as ReturnType<typeof applyAttendanceEvent>['state']
                );

                expect(replay1).not.toBeNull();
                expect(replay1!.clock_in).toBe(clockIn);
                expect(replay1!.clock_out).toBe(clockOut);
                expect(replay1!.worked_minutes).toBe(workedMin);
                expect(replay1!.overtime_minutes).toBe(overtimeMin);
                // Deterministic
                expect(JSON.stringify(replay1)).toBe(JSON.stringify(replay2));
            }
        ), { numRuns: 50 });
    });

    it('leave request reducer: CREATE + APPROVE produces same state on replay', () => {
        fc.assert(fc.property(
            uuidArb,
            uuidArb,
            uuidArb,
            leaveTypeArb,
            fc.integer({ min: 1, max: 30 }),
            (requestId, employeeId, approvedBy, leaveType, days) => {
                const events: ParkEvent[] = [
                    makeHREvent({
                        event_type: "LEAVE_REQUEST_CREATED",
                        terminal_sequence: 1,
                        payload: {
                            request_id: requestId,
                            employee_id: employeeId,
                            leave_type: leaveType,
                            start_date: "2026-03-01",
                            end_date: "2026-03-15",
                            days_requested: days,
                        },
                    }),
                    makeHREvent({
                        event_type: "LEAVE_REQUEST_APPROVED",
                        terminal_sequence: 2,
                        payload: {
                            request_id: requestId,
                            employee_id: employeeId,
                            approved_by: approvedBy,
                            days_deducted: days,
                        },
                    }),
                ];

                const replay1 = events.reduce(
                    (state, event) => applyLeaveRequestEvent(state, event).state,
                    null as ReturnType<typeof applyLeaveRequestEvent>['state']
                );
                const replay2 = events.reduce(
                    (state, event) => applyLeaveRequestEvent(state, event).state,
                    null as ReturnType<typeof applyLeaveRequestEvent>['state']
                );

                expect(replay1).not.toBeNull();
                expect(replay1!.status).toBe("APPROVED");
                expect(replay1!.days_deducted).toBe(days);
                expect(JSON.stringify(replay1)).toBe(JSON.stringify(replay2));
            }
        ), { numRuns: 50 });
    });

    it('payroll reducer: PAYROLL_CALCULATED produces same state on replay', () => {
        fc.assert(fc.property(
            uuidArb,
            uuidArb,
            periodMonthArb,
            positiveCentsArb,
            positiveCentsArb,
            (payrollId, employeeId, period, gross, net) => {
                const events: ParkEvent[] = [
                    makeHREvent({
                        event_type: "PAYROLL_CALCULATED",
                        terminal_sequence: 1,
                        payload: {
                            payroll_id: payrollId,
                            employee_id: employeeId,
                            period_month: period,
                            gross_salary_cents: gross,
                            net_salary_cents: net,
                            components: {
                                base_salary_cents: 102500,
                                commission_cents: 0,
                                tips_cents: 0,
                                overtime_cents: 0,
                                advances_cents: 0,
                                essalud_cents: 9225,
                                pension_cents: 13325,
                            },
                        },
                    }),
                ];

                const replay1 = events.reduce(
                    (state, event) => applyPayrollEvent(state, event).state,
                    null as ReturnType<typeof applyPayrollEvent>['state']
                );
                const replay2 = events.reduce(
                    (state, event) => applyPayrollEvent(state, event).state,
                    null as ReturnType<typeof applyPayrollEvent>['state']
                );

                expect(replay1).not.toBeNull();
                expect(replay1!.gross_salary_cents).toBe(gross);
                expect(replay1!.net_salary_cents).toBe(net);
                expect(JSON.stringify(replay1)).toBe(JSON.stringify(replay2));
            }
        ), { numRuns: 50 });
    });

    it('reducers ignore irrelevant events gracefully', () => {
        const orderEvent = makeHREvent({
            event_type: "ORDER_CREATED",
            aggregate_type: "ORDER",
            payload: {
                order_id: crypto.randomUUID(),
                order_number: 1,
                order_type: "DINE_IN",
                items: [],
                checks: [],
            },
        });

        // All HR reducers should return state unchanged for non-HR events
        const empResult = applyEmployeeEvent(null, orderEvent);
        expect(empResult.state).toBeNull();
        expect(empResult.warnings).toHaveLength(0);

        const attResult = applyAttendanceEvent(null, orderEvent);
        expect(attResult.state).toBeNull();

        const leaveResult = applyLeaveRequestEvent(null, orderEvent);
        expect(leaveResult.state).toBeNull();

        const payrollResult = applyPayrollEvent(null, orderEvent);
        expect(payrollResult.state).toBeNull();
    });
});
