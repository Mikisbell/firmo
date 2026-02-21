import type { ParkEvent } from "@/src/core/domain/events";
import type { ApplyResult } from "@/src/core/projections/types";
import type { LeaveRequestProjection } from "@/src/core/projections/hr-types";
import { type EmployeeId } from "@/src/core/types/shared";

/**
 * Leave request reducer - builds leave request state from HR events
 */
export function applyLeaveRequestEvent(
    request: LeaveRequestProjection | null,
    e: ParkEvent
): ApplyResult<LeaveRequestProjection | null> {
    const warnings: string[] = [];

    switch (e.event_type) {
        case "LEAVE_REQUEST_CREATED": {
            if (request) {
                warnings.push(`Leave request already exists: ${e.payload.request_id}; ignoring duplicate.`);
                request.last_event_sequence = e.terminal_sequence;
                return { state: request, warnings };
            }
            const newRequest: LeaveRequestProjection = {
                request_id: e.payload.request_id,
                employee_id: e.payload.employee_id as EmployeeId,
                leave_type: e.payload.leave_type,
                start_date: e.payload.start_date,
                end_date: e.payload.end_date,
                days_requested: e.payload.days_requested,
                days_deducted: 0,
                status: "PENDING",
                approved_by: null,
                rejected_by: null,
                rejection_reason: null,
                last_event_sequence: e.terminal_sequence,
            };
            return { state: newRequest, warnings };
        }

        case "LEAVE_REQUEST_APPROVED": {
            if (!request) {
                warnings.push(`LEAVE_REQUEST_APPROVED sin solicitud activa; ignorado.`);
                return { state: request, warnings };
            }
            request.status = "APPROVED";
            request.approved_by = e.payload.approved_by;
            request.days_deducted = e.payload.days_deducted;
            request.last_event_sequence = e.terminal_sequence;
            return { state: request, warnings };
        }

        case "LEAVE_REQUEST_REJECTED": {
            if (!request) {
                warnings.push(`LEAVE_REQUEST_REJECTED sin solicitud activa; ignorado.`);
                return { state: request, warnings };
            }
            request.status = "REJECTED";
            request.rejected_by = e.payload.rejected_by;
            request.rejection_reason = e.payload.reason;
            request.last_event_sequence = e.terminal_sequence;
            return { state: request, warnings };
        }

        default:
            return { state: request, warnings };
    }
}
