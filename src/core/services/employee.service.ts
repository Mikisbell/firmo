/**
 * Employee Service - Business Logic Layer for RRHH Module
 *
 * Implements the Service Layer Pattern for employee management.
 * Centralizes business logic, validation, and orchestration.
 *
 * Key rules:
 * - All money values in centavos (integer, never float)
 * - Multi-tenant: all operations filter by tenant_id
 * - Event-sourced: all mutations emit events through the events table
 * - Peruvian minimum wage: S/1,025 = 102500 centavos
 *
 * @module core/services/employee.service
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/src/core/result';
import { withTransaction } from '@/src/core/db/transaction';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import type {
  TenantId,
  EmployeeId,
  Centavos,
  EmployeeRole,
  ContractType,
  WorkScheduleType,
  PensionSystem,
  DocumentType,
  EmergencyContactRelationship,
} from '@/src/core/types/shared';

// ============================================================================
// Constants
// ============================================================================

/** Peruvian minimum wage in centavos: S/1,025.00 */
export const PERU_MINIMUM_WAGE_CENTS = 102500;

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CreateEmployeeInput {
  name: string;
  role: EmployeeRole;
  pin_hash?: string | null;
  dni?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  birth_date?: Date | null;
  profile_photo_url?: string | null;
  hire_date: Date;
  position: string;
  base_salary_cents: number;
  contract_type: ContractType;
  work_schedule_type: WorkScheduleType;
  location_id?: string | null;
  commission_rate?: number | null;
  pension_system?: PensionSystem | null;
  has_health_insurance?: boolean;
  created_by: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  role?: EmployeeRole;
  dni?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  birth_date?: Date | null;
  profile_photo_url?: string | null;
  position?: string;
  base_salary_cents?: number;
  contract_type?: ContractType;
  work_schedule_type?: WorkScheduleType;
  location_id?: string | null;
  commission_rate?: number | null;
  pension_system?: PensionSystem | null;
  has_health_insurance?: boolean;
}

export interface EmployeeResult {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  is_active: boolean;
  dni: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  birth_date: Date | null;
  profile_photo_url: string | null;
  hire_date: Date | null;
  position: string | null;
  base_salary_cents: number | null;
  contract_type: string | null;
  work_schedule_type: string | null;
  location_id: string | null;
  commission_rate: number | null;
  pension_system: string | null;
  has_health_insurance: boolean;
  created_at: Date;
}

export interface ListEmployeesOptions {
  page?: number;
  pageSize?: number;
  role?: string;
  is_active?: boolean;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AddEmergencyContactInput {
  name: string;
  relationship: EmergencyContactRelationship;
  phone: string;
  address?: string | null;
  is_primary?: boolean;
}

export interface EmergencyContactResult {
  id: string;
  tenant_id: string;
  employee_id: string;
  name: string;
  relationship: string;
  phone: string;
  address: string | null;
  is_primary: boolean;
  created_at: Date;
}

export interface UploadDocumentInput {
  document_type: DocumentType;
  document_url: string;
  expiry_date?: Date | null;
  notes?: string | null;
  uploaded_by: string;
}

export interface DocumentResult {
  id: string;
  tenant_id: string;
  employee_id: string;
  document_type: string;
  document_url: string;
  expiry_date: Date | null;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_at: Date;
}

// ============================================================================
// EmployeeService
// ============================================================================

export class EmployeeService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // Create Employee
  // ==========================================================================

  /**
   * Create a new employee with full validation and event publishing.
   * Validates salary >= Peruvian minimum wage (102500 centavos).
   */
  async create(
    tenantId: string,
    data: CreateEmployeeInput,
  ): Promise<Result<EmployeeResult, DomainError>> {
    // Validate salary
    if (data.base_salary_cents < PERU_MINIMUM_WAGE_CENTS) {
      return err(
        new ValidationError(
          `Salary must be at least ${PERU_MINIMUM_WAGE_CENTS} centavos (Peruvian minimum wage). Got: ${data.base_salary_cents}`,
          'base_salary_cents',
          { minimum: PERU_MINIMUM_WAGE_CENTS, actual: data.base_salary_cents },
        ),
      );
    }

    // Validate salary is integer
    if (!Number.isInteger(data.base_salary_cents)) {
      return err(
        new ValidationError(
          'Salary must be an integer (centavos)',
          'base_salary_cents',
        ),
      );
    }

    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      return err(new ValidationError('Employee name is required', 'name'));
    }

    if (!data.position || data.position.trim().length === 0) {
      return err(new ValidationError('Position is required', 'position'));
    }

    const employeeId = uuidv4();

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const employee = await tx.employees.create({
          data: {
            id: employeeId,
            tenant_id: tenantId,
            name: data.name.trim(),
            role: data.role,
            pin_hash: data.pin_hash ?? null,
            is_active: true,
            dni: data.dni ?? null,
            email: data.email ?? null,
            phone: data.phone ?? null,
            address: data.address ?? null,
            birth_date: data.birth_date ?? null,
            profile_photo_url: data.profile_photo_url ?? null,
            hire_date: data.hire_date,
            position: data.position,
            base_salary_cents: data.base_salary_cents,
            contract_type: data.contract_type,
            work_schedule_type: data.work_schedule_type,
            location_id: data.location_id ?? null,
            commission_rate: data.commission_rate ?? null,
            pension_system: data.pension_system ?? null,
            has_health_insurance: data.has_health_insurance ?? false,
          },
        });

        // Emit EMPLOYEE_CREATED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'EMPLOYEE_CREATED',
            entity_type: 'EMPLOYEE',
            entity_id: employeeId,
            actor_id: data.created_by,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              employee_id: employeeId,
              name: data.name,
              role: data.role,
              hire_date: data.hire_date.toISOString(),
              base_salary_cents: data.base_salary_cents,
              contract_type: data.contract_type,
            },
          },
        });

        return employee;
      },
      { maxRetries: 3 },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId },
        'Failed to create employee',
      );
      return err(
        new DomainError('Failed to create employee', 'EMPLOYEE_CREATION_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    const employee = txResult.data;

    pinoLogger.info(
      { employeeId: employee.id, tenantId },
      'Employee created successfully',
    );

    return ok(this.mapEmployeeToResult(employee));
  }

  // ==========================================================================
  // Update Employee
  // ==========================================================================

  /**
   * Update employee profile fields. Emits EMPLOYEE_PROFILE_UPDATED event.
   */
  async update(
    tenantId: string,
    employeeId: string,
    changes: UpdateEmployeeInput,
    updatedBy: string,
  ): Promise<Result<EmployeeResult, DomainError>> {
    // Validate salary if provided
    if (changes.base_salary_cents !== undefined) {
      if (changes.base_salary_cents < PERU_MINIMUM_WAGE_CENTS) {
        return err(
          new ValidationError(
            `Salary must be at least ${PERU_MINIMUM_WAGE_CENTS} centavos (Peruvian minimum wage). Got: ${changes.base_salary_cents}`,
            'base_salary_cents',
            { minimum: PERU_MINIMUM_WAGE_CENTS, actual: changes.base_salary_cents },
          ),
        );
      }
      if (!Number.isInteger(changes.base_salary_cents)) {
        return err(
          new ValidationError(
            'Salary must be an integer (centavos)',
            'base_salary_cents',
          ),
        );
      }
    }

    // Verify employee exists and belongs to tenant
    const existing = await this.prisma.employees.findFirst({
      where: { id: employeeId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Employee', employeeId));
    }

    // Build update data - only include defined fields
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return ok(this.mapEmployeeToResult(existing));
    }

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.employees.update({
          where: { id: employeeId },
          data: updateData,
        });

        // Emit EMPLOYEE_PROFILE_UPDATED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'EMPLOYEE_PROFILE_UPDATED',
            entity_type: 'EMPLOYEE',
            entity_id: employeeId,
            actor_id: updatedBy,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              employee_id: employeeId,
              changes: updateData as Record<string, string | number | boolean>,
              updated_by: updatedBy,
            },
          },
        });

        return updated;
      },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId, employeeId },
        'Failed to update employee',
      );
      return err(
        new DomainError('Failed to update employee', 'EMPLOYEE_UPDATE_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { employeeId, tenantId, changedFields: Object.keys(updateData) },
      'Employee profile updated',
    );

    return ok(this.mapEmployeeToResult(txResult.data));
  }

  // ==========================================================================
  // Deactivate Employee (Soft Delete)
  // ==========================================================================

  /**
   * Soft delete: sets is_active=false. Emits EMPLOYEE_DEACTIVATED event.
   * The record is preserved for audit trail.
   */
  async deactivate(
    tenantId: string,
    employeeId: string,
    reason: string,
    deactivatedBy: string,
  ): Promise<Result<EmployeeResult, DomainError>> {
    // Verify employee exists and belongs to tenant
    const existing = await this.prisma.employees.findFirst({
      where: { id: employeeId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Employee', employeeId));
    }

    if (!existing.is_active) {
      return err(
        new ValidationError('Employee is already deactivated', 'is_active'),
      );
    }

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.employees.update({
          where: { id: employeeId },
          data: { is_active: false },
        });

        // Emit EMPLOYEE_DEACTIVATED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'EMPLOYEE_DEACTIVATED',
            entity_type: 'EMPLOYEE',
            entity_id: employeeId,
            actor_id: deactivatedBy,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              employee_id: employeeId,
              reason,
              deactivated_by: deactivatedBy,
            },
          },
        });

        return updated;
      },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId, employeeId },
        'Failed to deactivate employee',
      );
      return err(
        new DomainError(
          'Failed to deactivate employee',
          'EMPLOYEE_DEACTIVATION_FAILED',
          { originalError: txResult.error.message },
        ),
      );
    }

    pinoLogger.info(
      { employeeId, tenantId, reason },
      'Employee deactivated (soft delete)',
    );

    return ok(this.mapEmployeeToResult(txResult.data));
  }

  // ==========================================================================
  // Get Employee by ID
  // ==========================================================================

  /**
   * Get a single employee by ID, scoped to tenant.
   */
  async getById(
    tenantId: string,
    employeeId: string,
  ): Promise<Result<EmployeeResult, NotFoundError>> {
    const employee = await this.prisma.employees.findFirst({
      where: {
        id: employeeId,
        tenant_id: tenantId,
      },
    });

    if (!employee) {
      return err(new NotFoundError('Employee', employeeId));
    }

    return ok(this.mapEmployeeToResult(employee));
  }

  // ==========================================================================
  // List Employees (Paginated)
  // ==========================================================================

  /**
   * List employees with pagination and optional filters.
   */
  async list(
    tenantId: string,
    options?: ListEmployeesOptions,
  ): Promise<Result<PaginatedResult<EmployeeResult>, DomainError>> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      tenant_id: tenantId,
    };

    if (options?.role) {
      where.role = options.role;
    }

    if (options?.is_active !== undefined) {
      where.is_active = options.is_active;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { dni: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [employees, total] = await Promise.all([
        this.prisma.employees.findMany({
          where: where as any,
          skip,
          take: pageSize,
          orderBy: { created_at: 'desc' },
        }),
        this.prisma.employees.count({ where: where as any }),
      ]);

      return ok({
        data: employees.map((e) => this.mapEmployeeToResult(e)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      pinoLogger.error({ error, tenantId }, 'Failed to list employees');
      return err(
        new DomainError('Failed to list employees', 'EMPLOYEE_LIST_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // Search Employees
  // ==========================================================================

  /**
   * Search employees by name or DNI (case insensitive).
   */
  async search(
    tenantId: string,
    query: string,
  ): Promise<Result<EmployeeResult[], DomainError>> {
    try {
      const employees = await this.prisma.employees.findMany({
        where: {
          tenant_id: tenantId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { dni: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
      });

      return ok(employees.map((e) => this.mapEmployeeToResult(e)));
    } catch (error) {
      pinoLogger.error({ error, tenantId, query }, 'Failed to search employees');
      return err(
        new DomainError('Failed to search employees', 'EMPLOYEE_SEARCH_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // Emergency Contacts
  // ==========================================================================

  /**
   * Add an emergency contact for an employee.
   */
  async addEmergencyContact(
    tenantId: string,
    employeeId: string,
    contact: AddEmergencyContactInput,
  ): Promise<Result<EmergencyContactResult, DomainError>> {
    // Verify employee exists and belongs to tenant
    const employee = await this.prisma.employees.findFirst({
      where: { id: employeeId, tenant_id: tenantId },
    });

    if (!employee) {
      return err(new NotFoundError('Employee', employeeId));
    }

    if (!contact.name || contact.name.trim().length === 0) {
      return err(new ValidationError('Contact name is required', 'name'));
    }

    if (!contact.phone || contact.phone.trim().length === 0) {
      return err(new ValidationError('Contact phone is required', 'phone'));
    }

    try {
      const created = await this.prisma.emergency_contacts.create({
        data: {
          tenant_id: tenantId,
          employee_id: employeeId,
          name: contact.name.trim(),
          relationship: contact.relationship,
          phone: contact.phone.trim(),
          address: contact.address ?? null,
          is_primary: contact.is_primary ?? false,
        },
      });

      pinoLogger.info(
        { contactId: created.id, employeeId, tenantId },
        'Emergency contact added',
      );

      return ok({
        id: created.id,
        tenant_id: created.tenant_id,
        employee_id: created.employee_id,
        name: created.name,
        relationship: created.relationship,
        phone: created.phone,
        address: created.address,
        is_primary: created.is_primary,
        created_at: created.created_at,
      });
    } catch (error) {
      pinoLogger.error(
        { error, employeeId, tenantId },
        'Failed to add emergency contact',
      );
      return err(
        new DomainError(
          'Failed to add emergency contact',
          'EMERGENCY_CONTACT_FAILED',
          { originalError: (error as Error).message },
        ),
      );
    }
  }

  // ==========================================================================
  // Upload Document
  // ==========================================================================

  /**
   * Add a document record for an employee.
   */
  async uploadDocument(
    tenantId: string,
    employeeId: string,
    doc: UploadDocumentInput,
  ): Promise<Result<DocumentResult, DomainError>> {
    // Verify employee exists and belongs to tenant
    const employee = await this.prisma.employees.findFirst({
      where: { id: employeeId, tenant_id: tenantId },
    });

    if (!employee) {
      return err(new NotFoundError('Employee', employeeId));
    }

    if (!doc.document_url || doc.document_url.trim().length === 0) {
      return err(
        new ValidationError('Document URL is required', 'document_url'),
      );
    }

    try {
      const created = await this.prisma.employee_documents.create({
        data: {
          tenant_id: tenantId,
          employee_id: employeeId,
          document_type: doc.document_type,
          document_url: doc.document_url,
          expiry_date: doc.expiry_date ?? null,
          notes: doc.notes ?? null,
          uploaded_by: doc.uploaded_by,
        },
      });

      pinoLogger.info(
        { documentId: created.id, employeeId, tenantId },
        'Employee document uploaded',
      );

      return ok({
        id: created.id,
        tenant_id: created.tenant_id,
        employee_id: created.employee_id,
        document_type: created.document_type,
        document_url: created.document_url,
        expiry_date: created.expiry_date,
        notes: created.notes,
        uploaded_by: created.uploaded_by,
        uploaded_at: created.uploaded_at,
      });
    } catch (error) {
      pinoLogger.error(
        { error, employeeId, tenantId },
        'Failed to upload employee document',
      );
      return err(
        new DomainError(
          'Failed to upload employee document',
          'DOCUMENT_UPLOAD_FAILED',
          { originalError: (error as Error).message },
        ),
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private mapEmployeeToResult(employee: any): EmployeeResult {
    return {
      id: employee.id,
      tenant_id: employee.tenant_id,
      name: employee.name,
      role: employee.role,
      is_active: employee.is_active,
      dni: employee.dni,
      email: employee.email,
      phone: employee.phone,
      address: employee.address,
      birth_date: employee.birth_date,
      profile_photo_url: employee.profile_photo_url,
      hire_date: employee.hire_date,
      position: employee.position,
      base_salary_cents: employee.base_salary_cents,
      contract_type: employee.contract_type,
      work_schedule_type: employee.work_schedule_type,
      location_id: employee.location_id,
      commission_rate: employee.commission_rate ? Number(employee.commission_rate) : null,
      pension_system: employee.pension_system,
      has_health_insurance: employee.has_health_insurance,
      created_at: employee.created_at,
    };
  }
}
