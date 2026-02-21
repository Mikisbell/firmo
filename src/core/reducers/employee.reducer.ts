import type { ParkEvent } from "@/src/core/domain/events";
import type { ApplyResult } from "@/src/core/projections/types";
import type { EmployeeProjection } from "@/src/core/projections/hr-types";
import { type EmployeeId } from "@/src/core/types/shared";
import { unsafeCentavos } from "@/src/core/types/shared";

/**
 * Employee reducer - builds employee state from HR events
 */
export function applyEmployeeEvent(
    employee: EmployeeProjection | null,
    e: ParkEvent
): ApplyResult<EmployeeProjection | null> {
    const warnings: string[] = [];

    switch (e.event_type) {
        case "EMPLOYEE_CREATED": {
            if (employee) {
                warnings.push(`Employee already exists: ${e.payload.employee_id}; ignoring duplicate EMPLOYEE_CREATED.`);
                employee.last_event_sequence = e.terminal_sequence;
                return { state: employee, warnings };
            }
            const newEmployee: EmployeeProjection = {
                employee_id: e.payload.employee_id as EmployeeId,
                name: e.payload.name,
                dni: e.payload.dni,
                role: e.payload.role,
                hire_date: e.payload.hire_date,
                base_salary_cents: unsafeCentavos(e.payload.base_salary_cents),
                contract_type: e.payload.contract_type,
                location_id: e.payload.location_id,
                is_active: true,
                profile_changes: [],
                last_event_sequence: e.terminal_sequence,
            };
            return { state: newEmployee, warnings };
        }

        case "EMPLOYEE_PROFILE_UPDATED": {
            if (!employee) {
                warnings.push(`EMPLOYEE_PROFILE_UPDATED sin empleado activo; ignorado.`);
                return { state: employee, warnings };
            }

            // Apply known field changes to the projection
            const changes = e.payload.changes;
            if (changes.name && typeof changes.name === 'string') employee.name = changes.name;
            if (changes.role && typeof changes.role === 'string') {
                employee.role = changes.role as EmployeeProjection['role'];
            }
            if (changes.base_salary_cents && typeof changes.base_salary_cents === 'number') {
                employee.base_salary_cents = unsafeCentavos(changes.base_salary_cents);
            }
            if (changes.dni !== undefined) employee.dni = changes.dni as string | undefined;
            if (changes.location_id !== undefined) employee.location_id = changes.location_id as string | undefined;
            if (changes.contract_type && typeof changes.contract_type === 'string') {
                employee.contract_type = changes.contract_type;
            }

            employee.profile_changes.push({
                changes: e.payload.changes,
                updated_by: e.payload.updated_by,
                occurred_at: e.occurred_at,
            });

            employee.last_event_sequence = e.terminal_sequence;
            return { state: employee, warnings };
        }

        case "EMPLOYEE_DEACTIVATED": {
            if (!employee) {
                warnings.push(`EMPLOYEE_DEACTIVATED sin empleado activo; ignorado.`);
                return { state: employee, warnings };
            }
            employee.is_active = false;
            employee.last_event_sequence = e.terminal_sequence;
            return { state: employee, warnings };
        }

        default:
            return { state: employee, warnings };
    }
}
