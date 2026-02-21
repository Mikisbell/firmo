import type { ParkEvent } from "@/src/core/domain/events";
import type { ApplyResult } from "@/src/core/projections/types";
import type { PayrollProjection } from "@/src/core/projections/hr-types";
import { type EmployeeId, unsafeCentavos } from "@/src/core/types/shared";

/**
 * Payroll reducer - builds payroll state from HR events
 */
export function applyPayrollEvent(
    payroll: PayrollProjection | null,
    e: ParkEvent
): ApplyResult<PayrollProjection | null> {
    const warnings: string[] = [];

    switch (e.event_type) {
        case "PAYROLL_CALCULATED": {
            if (payroll && payroll.payroll_id === e.payload.payroll_id) {
                warnings.push(`Payroll already calculated: ${e.payload.payroll_id}; replacing with latest.`);
            }
            const record: PayrollProjection = {
                payroll_id: e.payload.payroll_id,
                employee_id: e.payload.employee_id as EmployeeId,
                period_month: e.payload.period_month,
                gross_salary_cents: unsafeCentavos(e.payload.gross_salary_cents),
                net_salary_cents: unsafeCentavos(e.payload.net_salary_cents),
                components: {
                    base_salary_cents: unsafeCentavos(e.payload.components.base_salary_cents),
                    commission_cents: unsafeCentavos(e.payload.components.commission_cents),
                    tips_cents: unsafeCentavos(e.payload.components.tips_cents),
                    overtime_cents: unsafeCentavos(e.payload.components.overtime_cents),
                    advances_cents: unsafeCentavos(e.payload.components.advances_cents),
                    essalud_cents: unsafeCentavos(e.payload.components.essalud_cents),
                    pension_cents: unsafeCentavos(e.payload.components.pension_cents),
                },
                last_event_sequence: e.terminal_sequence,
            };
            return { state: record, warnings };
        }

        default:
            return { state: payroll, warnings };
    }
}
