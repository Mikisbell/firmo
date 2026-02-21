import type { ParkEvent } from "@/src/core/domain/events";
import type { ApplyResult } from "@/src/core/projections/types";
import type { AttendanceProjection } from "@/src/core/projections/hr-types";
import { type AttendanceId, type EmployeeId } from "@/src/core/types/shared";

/**
 * Attendance reducer - builds attendance state from HR events
 */
export function applyAttendanceEvent(
    attendance: AttendanceProjection | null,
    e: ParkEvent
): ApplyResult<AttendanceProjection | null> {
    const warnings: string[] = [];

    switch (e.event_type) {
        case "ATTENDANCE_CLOCKED_IN": {
            if (attendance && attendance.clock_in) {
                warnings.push(`Duplicate clock-in for attendance ${e.payload.attendance_id}; ignoring.`);
                attendance.last_event_sequence = e.terminal_sequence;
                return { state: attendance, warnings };
            }
            const record: AttendanceProjection = {
                attendance_id: e.payload.attendance_id as AttendanceId,
                employee_id: e.payload.employee_id as EmployeeId,
                date: e.payload.clock_in.split('T')[0],
                clock_in: e.payload.clock_in,
                clock_out: null,
                scheduled_start: e.payload.scheduled_start ?? null,
                late_minutes: e.payload.late_minutes,
                worked_minutes: 0,
                overtime_minutes: 0,
                status: e.payload.late_minutes > 0 ? "LATE" : "PRESENT",
                justification: null,
                certificate_url: null,
                last_event_sequence: e.terminal_sequence,
            };
            return { state: record, warnings };
        }

        case "ATTENDANCE_CLOCKED_OUT": {
            if (!attendance) {
                warnings.push(`ATTENDANCE_CLOCKED_OUT sin registro de entrada; ignorado.`);
                return { state: attendance, warnings };
            }
            attendance.clock_out = e.payload.clock_out;
            attendance.worked_minutes = e.payload.worked_minutes;
            attendance.overtime_minutes = e.payload.overtime_minutes;
            attendance.last_event_sequence = e.terminal_sequence;
            return { state: attendance, warnings };
        }

        case "ATTENDANCE_ABSENCE_DETECTED": {
            const absent: AttendanceProjection = {
                attendance_id: e.payload.attendance_id as AttendanceId,
                employee_id: e.payload.employee_id as EmployeeId,
                date: e.payload.date,
                clock_in: null,
                clock_out: null,
                scheduled_start: e.payload.scheduled_start,
                late_minutes: 0,
                worked_minutes: 0,
                overtime_minutes: 0,
                status: "ABSENT",
                justification: null,
                certificate_url: null,
                last_event_sequence: e.terminal_sequence,
            };
            return { state: absent, warnings };
        }

        case "ATTENDANCE_JUSTIFIED": {
            if (!attendance) {
                warnings.push(`ATTENDANCE_JUSTIFIED sin registro de asistencia; ignorado.`);
                return { state: attendance, warnings };
            }
            attendance.status = "JUSTIFIED";
            attendance.justification = e.payload.justification;
            attendance.certificate_url = e.payload.certificate_url ?? null;
            attendance.last_event_sequence = e.terminal_sequence;
            return { state: attendance, warnings };
        }

        default:
            return { state: attendance, warnings };
    }
}
