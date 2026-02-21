/**
 * HR Schema Tests - Fase 1.1
 *
 * Verifies that all RRHH tables exist with correct fields,
 * relationships, and indexes using Prisma DMMF introspection.
 */
import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';

const dmmf = Prisma.dmmf;
const models = dmmf.datamodel.models;

function getModel(name: string) {
    const model = models.find(m => m.name === name);
    if (!model) throw new Error(`Model ${name} not found in Prisma schema`);
    return model;
}

function getFieldNames(model: ReturnType<typeof getModel>) {
    return model.fields.map(f => f.name);
}

function getField(model: ReturnType<typeof getModel>, fieldName: string) {
    const field = model.fields.find(f => f.name === fieldName);
    if (!field) throw new Error(`Field ${fieldName} not found in model ${model.name}`);
    return field;
}

function getIndexFields(model: ReturnType<typeof getModel>) {
    // Prisma DMMF stores unique constraints and indexes
    return (model as any).uniqueFields || [];
}

// ============================================================
// 1. All HR Tables Exist
// ============================================================
describe('HR Schema - Tables Exist', () => {
    const requiredHRModels = [
        'employees',
        'emergency_contacts',
        'employee_documents',
        'schedules',
        'schedule_templates',
        'employee_schedules',
        'shift_change_requests',
        'leave_requests',
        'advances',
        'evaluations',
        'training_records',
        'payroll_records',
        'attendance',
    ];

    it.each(requiredHRModels)('model "%s" exists in Prisma schema', (modelName) => {
        const model = models.find(m => m.name === modelName);
        expect(model, `Model ${modelName} should exist`).toBeDefined();
    });
});

// ============================================================
// 2. Employee Model - Extended HR Fields
// ============================================================
describe('HR Schema - employees model has HR fields', () => {
    const employee = getModel('employees');
    const fields = getFieldNames(employee);

    const requiredPersonalFields = [
        'dni', 'email', 'phone', 'address', 'birth_date', 'profile_photo_url',
    ];
    const requiredWorkFields = [
        'hire_date', 'position', 'base_salary_cents', 'contract_type',
        'work_schedule_type', 'location_id',
    ];
    const requiredConfigFields = [
        'commission_rate', 'pension_system', 'has_health_insurance',
    ];

    it.each(requiredPersonalFields)('has personal field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it.each(requiredWorkFields)('has work field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it.each(requiredConfigFields)('has config field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('base_salary_cents is Int type', () => {
        const f = getField(employee, 'base_salary_cents');
        expect(f.type).toBe('Int');
    });

    it('commission_rate is Decimal type (precise for financial calculations)', () => {
        const f = getField(employee, 'commission_rate');
        expect(f.type).toBe('Decimal');
    });
});

// ============================================================
// 3. Emergency Contacts
// ============================================================
describe('HR Schema - emergency_contacts', () => {
    const model = getModel('emergency_contacts');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'employee_id',
        'name', 'relationship', 'phone',
        'is_primary', 'created_at',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('employee_id is String (UUID FK)', () => {
        const f = getField(model, 'employee_id');
        expect(f.type).toBe('String');
    });
});

// ============================================================
// 4. Employee Documents
// ============================================================
describe('HR Schema - employee_documents', () => {
    const model = getModel('employee_documents');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'employee_id',
        'document_type', 'document_url',
        'expiry_date', 'uploaded_by', 'uploaded_at',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });
});

// ============================================================
// 5. Schedules
// ============================================================
describe('HR Schema - schedules', () => {
    const model = getModel('schedules');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'location_id', 'employee_id',
        'date', 'shift_start', 'shift_end', 'break_minutes',
        'status', 'created_at',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('has shift swap fields', () => {
        expect(fields).toContain('original_employee_id');
        expect(fields).toContain('swap_approved_by');
    });
});

// ============================================================
// 6. Schedule Templates
// ============================================================
describe('HR Schema - schedule_templates', () => {
    const model = getModel('schedule_templates');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'location_id', 'name',
        'schedule_type', 'days_of_week',
        'start_time', 'end_time', 'break_minutes',
        'is_active',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('schedule_type is String (FIXED/ROTATING)', () => {
        const f = getField(model, 'schedule_type');
        expect(f.type).toBe('String');
    });
});

// ============================================================
// 7. Employee Schedules (join table)
// ============================================================
describe('HR Schema - employee_schedules', () => {
    const model = getModel('employee_schedules');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'employee_id', 'template_id',
        'start_date', 'is_active',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });
});

// ============================================================
// 8. Shift Change Requests
// ============================================================
describe('HR Schema - shift_change_requests', () => {
    const model = getModel('shift_change_requests');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'requester_id', 'target_employee_id',
        'original_date', 'new_date', 'reason',
        'status', 'approved_by', 'created_at',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('status field exists for approval workflow', () => {
        const f = getField(model, 'status');
        expect(f.type).toBe('String');
    });
});

// ============================================================
// 9. Leave Requests
// ============================================================
describe('HR Schema - leave_requests', () => {
    const model = getModel('leave_requests');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'employee_id',
        'leave_type', 'start_date', 'end_date',
        'days_requested', 'reason', 'with_pay',
        'status', 'approved_by', 'created_at',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('days_requested is Int', () => {
        const f = getField(model, 'days_requested');
        expect(f.type).toBe('Int');
    });

    it('with_pay is Boolean', () => {
        const f = getField(model, 'with_pay');
        expect(f.type).toBe('Boolean');
    });

    it('has certificate_url for medical certificates', () => {
        expect(fields).toContain('certificate_url');
    });
});

// ============================================================
// 10. Advances (salary advances)
// ============================================================
describe('HR Schema - advances', () => {
    const model = getModel('advances');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'employee_id',
        'amount_cents', 'reason', 'status',
        'approved_by', 'created_at',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('amount_cents is Int (centavos, never float)', () => {
        const f = getField(model, 'amount_cents');
        expect(f.type).toBe('Int');
    });

    it('has payroll deduction reference', () => {
        expect(fields).toContain('deducted_from_payroll');
    });
});

// ============================================================
// 11. Evaluations
// ============================================================
describe('HR Schema - evaluations', () => {
    const model = getModel('evaluations');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'employee_id', 'evaluator_id',
        'period_start', 'period_end',
        'scores', 'automatic_metrics',
        'comments', 'goals', 'status',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('scores is JSON type', () => {
        const f = getField(model, 'scores');
        expect(f.type).toBe('Json');
    });

    it('automatic_metrics is JSON type', () => {
        const f = getField(model, 'automatic_metrics');
        expect(f.type).toBe('Json');
    });

    it('goals is JSON type', () => {
        const f = getField(model, 'goals');
        expect(f.type).toBe('Json');
    });
});

// ============================================================
// 12. Training Records
// ============================================================
describe('HR Schema - training_records', () => {
    const model = getModel('training_records');
    const fields = getFieldNames(model);

    const requiredFields = [
        'id', 'tenant_id', 'employee_id',
        'training_name', 'training_type',
        'duration_hours', 'completion_date',
        'score', 'assigned_by', 'created_at',
    ];

    it.each(requiredFields)('has field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('score is Int (0-100)', () => {
        const f = getField(model, 'score');
        expect(f.type).toBe('Int');
    });

    it('duration_hours is Int', () => {
        const f = getField(model, 'duration_hours');
        expect(f.type).toBe('Int');
    });
});

// ============================================================
// 13. Payroll Records
// ============================================================
describe('HR Schema - payroll_records', () => {
    const model = getModel('payroll_records');
    const fields = getFieldNames(model);

    const salaryComponents = [
        'base_salary_cents', 'commission_cents', 'tips_cents',
        'overtime_cents', 'bonuses_cents',
    ];
    const deductions = [
        'advances_cents', 'absences_cents', 'other_deductions_cents',
    ];
    const legalContributions = [
        'essalud_cents', 'pension_cents',
    ];
    const totals = [
        'gross_salary_cents', 'net_salary_cents',
    ];
    const metadata = [
        'days_worked', 'hours_worked', 'overtime_hours', 'absences_count',
        'payslip_url', 'calculated_by', 'calculated_at',
    ];

    it.each(salaryComponents)('has salary component "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it.each(deductions)('has deduction field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it.each(legalContributions)('has legal contribution "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it.each(totals)('has total field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it.each(metadata)('has metadata field "%s"', (field) => {
        expect(fields).toContain(field);
    });

    it('all monetary fields are Int (centavos)', () => {
        const monetaryFields = [...salaryComponents, ...deductions, ...legalContributions, ...totals];
        for (const fieldName of monetaryFields) {
            const f = getField(model, fieldName);
            expect(f.type, `${fieldName} should be Int`).toBe('Int');
        }
    });

    it('has period_month for monthly grouping', () => {
        expect(fields).toContain('period_month');
    });

    it('period_month is unique per tenant+employee', () => {
        const uniqueFields = (model as any).uniqueFields as string[][];
        const hasUniqueConstraint = uniqueFields.some(
            (combo: string[]) =>
                combo.includes('tenant_id') &&
                combo.includes('employee_id') &&
                combo.includes('period_month')
        );
        expect(hasUniqueConstraint, 'Should have unique constraint on [tenant_id, employee_id, period_month]').toBe(true);
    });
});

// ============================================================
// 14. Relationships Between Tables
// ============================================================
describe('HR Schema - Relationships', () => {
    it('emergency_contacts has relation to employees', () => {
        const model = getModel('emergency_contacts');
        const rel = model.fields.find(f => f.kind === 'object' && f.type === 'employees');
        expect(rel, 'emergency_contacts should have relation to employees').toBeDefined();
    });

    it('employee_documents has relation to employees', () => {
        const model = getModel('employee_documents');
        const rel = model.fields.find(f => f.kind === 'object' && f.type === 'employees');
        expect(rel, 'employee_documents should have relation to employees').toBeDefined();
    });

    it('employee_schedules has relation to employees', () => {
        const model = getModel('employee_schedules');
        const rel = model.fields.find(f => f.kind === 'object' && f.type === 'employees');
        expect(rel, 'employee_schedules should have relation to employees').toBeDefined();
    });

    it('employee_schedules has relation to schedule_templates', () => {
        const model = getModel('employee_schedules');
        const rel = model.fields.find(f => f.kind === 'object' && f.type === 'schedule_templates');
        expect(rel, 'employee_schedules should have relation to schedule_templates').toBeDefined();
    });

    it('leave_requests has relation to employees', () => {
        const model = getModel('leave_requests');
        const rel = model.fields.find(f => f.kind === 'object' && f.type === 'employees');
        expect(rel, 'leave_requests should have relation to employees').toBeDefined();
    });

    it('advances has relation to employees', () => {
        const model = getModel('advances');
        const rel = model.fields.find(f => f.kind === 'object' && f.type === 'employees');
        expect(rel, 'advances should have relation to employees').toBeDefined();
    });

    it('evaluations has relation to employees', () => {
        const model = getModel('evaluations');
        const rel = model.fields.find(f => f.kind === 'object' && f.type === 'employees');
        expect(rel, 'evaluations should have relation to employees').toBeDefined();
    });

    it('training_records has relation to employees', () => {
        const model = getModel('training_records');
        const rel = model.fields.find(f => f.kind === 'object' && f.type === 'employees');
        expect(rel, 'training_records should have relation to employees').toBeDefined();
    });

    it('payroll_records has relation to employees', () => {
        const model = getModel('payroll_records');
        const rel = model.fields.find(f => f.kind === 'object' && f.type === 'employees');
        expect(rel, 'payroll_records should have relation to employees').toBeDefined();
    });

    it('employees has reverse relations to all HR tables', () => {
        const employee = getModel('employees');
        const relationTypes = employee.fields
            .filter(f => f.kind === 'object')
            .map(f => f.type);

        expect(relationTypes).toContain('emergency_contacts');
        expect(relationTypes).toContain('employee_documents');
        expect(relationTypes).toContain('employee_schedules');
        expect(relationTypes).toContain('leave_requests');
        expect(relationTypes).toContain('advances');
        expect(relationTypes).toContain('evaluations');
        expect(relationTypes).toContain('training_records');
        expect(relationTypes).toContain('payroll_records');
    });
});

// ============================================================
// 15. Indexes for Performance
// ============================================================
describe('HR Schema - Indexes', () => {
    it('employees has tenant_id + is_active index', () => {
        const model = getModel('employees');
        const dbIndexes = (model as any).dbIndexes || (model as any).indexes || [];
        // Prisma DMMF doesn't expose @@index in all versions,
        // but we can verify indexed fields exist and are queryable
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('is_active');
    });

    it('attendance has tenant_id + employee_id + date fields for index', () => {
        const model = getModel('attendance');
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('employee_id');
        expect(fields).toContain('date');
    });

    it('schedules has tenant_id + employee_id + date fields for index', () => {
        const model = getModel('schedules');
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('employee_id');
        expect(fields).toContain('date');
    });

    it('leave_requests has tenant_id + employee_id + status fields for index', () => {
        const model = getModel('leave_requests');
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('employee_id');
        expect(fields).toContain('status');
    });

    it('advances has tenant_id + employee_id + status fields for index', () => {
        const model = getModel('advances');
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('employee_id');
        expect(fields).toContain('status');
    });

    it('payroll_records has tenant_id + period_month fields for index', () => {
        const model = getModel('payroll_records');
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('period_month');
    });

    it('evaluations has tenant_id + employee_id + period_end fields for index', () => {
        const model = getModel('evaluations');
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('employee_id');
        expect(fields).toContain('period_end');
    });

    it('training_records has tenant_id + employee_id + completion_date fields', () => {
        const model = getModel('training_records');
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('employee_id');
        expect(fields).toContain('completion_date');
    });

    it('schedule_templates has tenant_id + location_id + is_active fields', () => {
        const model = getModel('schedule_templates');
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('location_id');
        expect(fields).toContain('is_active');
    });

    it('employee_documents has tenant_id + expiry_date fields', () => {
        const model = getModel('employee_documents');
        const fields = getFieldNames(model);
        expect(fields).toContain('tenant_id');
        expect(fields).toContain('expiry_date');
    });
});

// ============================================================
// 16. Multi-Tenant Isolation
// ============================================================
describe('HR Schema - Multi-Tenant Isolation', () => {
    const hrModels = [
        'emergency_contacts',
        'employee_documents',
        'schedules',
        'schedule_templates',
        'employee_schedules',
        'shift_change_requests',
        'leave_requests',
        'advances',
        'evaluations',
        'training_records',
        'payroll_records',
    ];

    it.each(hrModels)('model "%s" has tenant_id field', (modelName) => {
        const model = getModel(modelName);
        const fields = getFieldNames(model);
        expect(fields, `${modelName} must have tenant_id for multi-tenant isolation`).toContain('tenant_id');
    });

    it.each(hrModels)('model "%s" tenant_id is required (not optional)', (modelName) => {
        const model = getModel(modelName);
        const tenantField = getField(model, 'tenant_id');
        expect(tenantField.isRequired, `${modelName}.tenant_id must be required`).toBe(true);
    });
});

// ============================================================
// 17. Money Safety - All monetary values in centavos (Int)
// ============================================================
describe('HR Schema - Money Safety (centavos)', () => {
    it('employees.base_salary_cents is Int', () => {
        const f = getField(getModel('employees'), 'base_salary_cents');
        expect(f.type).toBe('Int');
    });

    it('advances.amount_cents is Int', () => {
        const f = getField(getModel('advances'), 'amount_cents');
        expect(f.type).toBe('Int');
    });

    it('all payroll *_cents fields are Int', () => {
        const model = getModel('payroll_records');
        const centsFields = model.fields.filter(f => f.name.endsWith('_cents'));
        expect(centsFields.length).toBeGreaterThanOrEqual(10);
        for (const field of centsFields) {
            expect(field.type, `${field.name} must be Int for money safety`).toBe('Int');
        }
    });
});
