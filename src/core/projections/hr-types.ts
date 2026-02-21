import type { Centavos, EmployeeId, AttendanceId } from "@/src/core/types/shared";

// ============================================================================
// Employee Projection
// ============================================================================

export type EmployeeProjection = {
    employee_id: EmployeeId;
    name: string;
    dni?: string;
    role: "CASHIER" | "WAITER" | "COOK" | "SUPERVISOR" | "ADMIN";
    hire_date: string; // YYYY-MM-DD
    base_salary_cents: Centavos;
    contract_type: string;
    location_id?: string;
    is_active: boolean;
    profile_changes: ProfileChange[];
    last_event_sequence: number;
};

export type ProfileChange = {
    changes: Record<string, unknown>;
    updated_by: string;
    occurred_at: string;
};

export function emptyEmployee(): EmployeeProjection | null {
    return null;
}

// ============================================================================
// Attendance Projection (per employee per day)
// ============================================================================

export type AttendanceProjection = {
    attendance_id: AttendanceId;
    employee_id: EmployeeId;
    date: string; // YYYY-MM-DD
    clock_in: string | null;
    clock_out: string | null;
    scheduled_start: string | null;
    late_minutes: number;
    worked_minutes: number;
    overtime_minutes: number;
    status: "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED";
    justification: string | null;
    certificate_url: string | null;
    last_event_sequence: number;
};

export function emptyAttendance(): AttendanceProjection | null {
    return null;
}

// ============================================================================
// Leave Request Projection
// ============================================================================

export type LeaveRequestProjection = {
    request_id: string;
    employee_id: EmployeeId;
    leave_type: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    days_deducted: number;
    status: "PENDING" | "APPROVED" | "REJECTED";
    approved_by: string | null;
    rejected_by: string | null;
    rejection_reason: string | null;
    last_event_sequence: number;
};

export function emptyLeaveRequest(): LeaveRequestProjection | null {
    return null;
}

// ============================================================================
// Payroll Projection
// ============================================================================

export type PayrollProjection = {
    payroll_id: string;
    employee_id: EmployeeId;
    period_month: string;
    gross_salary_cents: Centavos;
    net_salary_cents: Centavos;
    components: {
        base_salary_cents: Centavos;
        commission_cents: Centavos;
        tips_cents: Centavos;
        overtime_cents: Centavos;
        advances_cents: Centavos;
        essalud_cents: Centavos;
        pension_cents: Centavos;
    };
    last_event_sequence: number;
};

export function emptyPayroll(): PayrollProjection | null {
    return null;
}
