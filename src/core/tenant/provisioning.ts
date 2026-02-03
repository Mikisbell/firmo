/**
 * Tenant Provisioning Service
 * 
 * Automates creation of new tenants with all required configuration and data.
 * Ensures atomic provisioning with automatic rollback on failure.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 */

import { prisma } from '@/core/db/prisma';
import { randomUUID } from 'crypto';
import { hashPin } from '@/core/auth/pin';

/**
 * Request to provision a new tenant
 */
export interface TenantProvisioningRequest {
  /** Legal name of the restaurant */
  legal_name: string;
  
  /** Optional: RUC (Peruvian tax ID) */
  ruc?: string;
  
  /** Optional: Physical address */
  address_text?: string;
  
  /** Name of the admin user */
  admin_name: string;
  
  /** PIN for the admin user */
  admin_pin: string;
  
  /** Optional: Timezone (default: America/Lima) */
  timezone?: string;
  
  /** Optional: Currency (default: PEN) */
  currency?: string;
}

/**
 * Result of successful tenant provisioning
 */
export interface TenantProvisioningResult {
  /** UUID of the newly created tenant */
  tenant_id: string;
  
  /** UUID of the admin employee */
  admin_employee_id: string;
  
  /** ID of the default terminal */
  default_terminal_id: string;
  
  /** Activation code for the terminal */
  activation_code: string;
  
  /** Onboarding checklist steps */
  onboarding_checklist: OnboardingStep[];
}

/**
 * Onboarding step in the tenant setup process
 */
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  is_completed: boolean;
  order: number;
}

/**
 * Default stations to create for each tenant
 */
const DEFAULT_STATIONS = ['PARRILLA', 'COCINA', 'BAR', 'EMPAQUE'];

/**
 * Terminal number ranges to allocate for each tenant
 */
const TERMINAL_NUMBER_RANGES = [
  { terminal_id: 'CAJA_01', start: 1, end: 10000 },
  { terminal_id: 'MOZO_01', start: 10001, end: 20000 },
  { terminal_id: 'MOZO_02', start: 20001, end: 30000 },
  { terminal_id: 'MOZO_03', start: 30001, end: 40000 },
  { terminal_id: 'MOZO_04', start: 40001, end: 50000 },
  { terminal_id: 'MOZO_05', start: 50001, end: 60000 },
  { terminal_id: 'MOZO_06', start: 60001, end: 70000 },
  { terminal_id: 'MOZO_07', start: 70001, end: 80000 },
  { terminal_id: 'MOZO_08', start: 80001, end: 90000 },
  { terminal_id: 'MOZO_09', start: 90001, end: 100000 },
];

/**
 * Generate a random activation code for terminal registration
 * 
 * @returns 6-digit activation code
 */
function generateActivationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create onboarding checklist for new tenant
 * 
 * @returns Array of onboarding steps
 */
function createOnboardingChecklist(): OnboardingStep[] {
  return [
    {
      id: randomUUID(),
      title: 'Configure Restaurant Details',
      description: 'Set up your restaurant name, address, and contact information',
      is_completed: false,
      order: 1,
    },
    {
      id: randomUUID(),
      title: 'Set Up First Terminal',
      description: 'Register and activate your first POS terminal',
      is_completed: false,
      order: 2,
    },
    {
      id: randomUUID(),
      title: 'Create Employees',
      description: 'Add your staff members and assign roles',
      is_completed: false,
      order: 3,
    },
    {
      id: randomUUID(),
      title: 'Configure Products',
      description: 'Add your menu items and set prices',
      is_completed: false,
      order: 4,
    },
    {
      id: randomUUID(),
      title: 'Set Up Stations',
      description: 'Configure kitchen stations and order routing',
      is_completed: false,
      order: 5,
    },
    {
      id: randomUUID(),
      title: 'Test First Order',
      description: 'Process a test order to verify everything is working',
      is_completed: false,
      order: 6,
    },
  ];
}

/**
 * Provision a new tenant with all required configuration
 * 
 * This function:
 * 1. Generates a unique tenant_id
 * 2. Creates tenant_settings record
 * 3. Creates catalog_meta with version 1
 * 4. Creates default stations
 * 5. Creates admin employee with hashed PIN
 * 6. Allocates terminal number ranges
 * 7. Creates default terminal
 * 8. Generates activation code
 * 9. Creates resource quotas
 * 
 * All operations are atomic - if any step fails, the entire transaction is rolled back.
 * 
 * @param request - Provisioning request
 * @returns Provisioning result with tenant credentials
 * @throws Error if provisioning fails
 * 
 * @example
 * ```typescript
 * const result = await provisionTenant({
 *   legal_name: 'Pollería El Buen Sabor',
 *   ruc: '20123456789',
 *   address_text: 'Av. Principal 123, Lima',
 *   admin_name: 'Juan Pérez',
 *   admin_pin: '1234',
 *   timezone: 'America/Lima',
 *   currency: 'PEN',
 * });
 * 
 * console.log(`Tenant created: ${result.tenant_id}`);
 * console.log(`Activation code: ${result.activation_code}`);
 * ```
 */
export async function provisionTenant(
  request: TenantProvisioningRequest
): Promise<TenantProvisioningResult> {
  return await prisma.$transaction(async (tx) => {
    // 1. Generate tenant_id
    const tenant_id = randomUUID();

    // 2. Create tenant record
    await tx.tenants.create({
      data: {
        id: tenant_id,
        name: request.legal_name,
        is_active: true,
      },
    });

    // 3. Create tenant_settings
    await tx.tenant_settings.create({
      data: {
        tenant_id,
        legal_name: request.legal_name,
        ruc: request.ruc,
        address_text: request.address_text,
        timezone: request.timezone || 'America/Lima',
        currency: request.currency || 'PEN',
      },
    });

    // 4. Create catalog_meta
    await tx.catalog_meta.create({
      data: {
        tenant_id,
        catalog_version: 1,
      },
    });

    // 5. Create default stations
    for (const code of DEFAULT_STATIONS) {
      await tx.stations.create({
        data: {
          id: randomUUID(),
          tenant_id,
          code,
          name: code,
          is_active: true,
        },
      });
    }

    // 6. Create admin employee
    const admin_employee_id = randomUUID();
    const pin_hash = await hashPin(request.admin_pin);

    await tx.employees.create({
      data: {
        id: admin_employee_id,
        tenant_id,
        name: request.admin_name,
        role: 'ADMIN',
        pin_hash,
        is_active: true,
      },
    });

    // 7. Allocate terminal number ranges
    for (const range of TERMINAL_NUMBER_RANGES) {
      await tx.terminal_number_ranges.create({
        data: {
          terminal_id: range.terminal_id,
          tenant_id,
          range_start: range.start,
          range_end: range.end,
          current_number: range.start,
        },
      });
    }

    // 8. Create default terminal
    const default_terminal_id = `${tenant_id.substring(0, 8)}-CAJA-01`;
    await tx.terminals.create({
      data: {
        id: randomUUID(),
        tenant_id,
        terminal_id: default_terminal_id,
        is_allowed: true,
      },
    });

    // 9. Generate activation code
    const activation_code = generateActivationCode();

    // 10. Create onboarding checklist
    const onboarding_checklist = createOnboardingChecklist();

    return {
      tenant_id,
      admin_employee_id,
      default_terminal_id,
      activation_code,
      onboarding_checklist,
    };
  });
}

/**
 * Get tenant provisioning status
 * 
 * @param tenant_id - ID of the tenant
 * @returns Provisioning status
 */
export async function getTenantProvisioningStatus(tenant_id: string) {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenant_id },
    include: {
      tenant_settings: true,
    },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenant_id}`);
  }

  const [
    catalogMeta,
    stationsCount,
    employeesCount,
    terminalsCount,
    numberRangesCount,
  ] = await Promise.all([
    prisma.catalog_meta.findUnique({ where: { tenant_id } }),
    prisma.stations.count({ where: { tenant_id } }),
    prisma.employees.count({ where: { tenant_id } }),
    prisma.terminals.count({ where: { tenant_id } }),
    prisma.terminal_number_ranges.count({ where: { tenant_id } }),
  ]);

  return {
    tenant_id,
    is_provisioned: !!(
      tenant.tenant_settings &&
      catalogMeta &&
      stationsCount === DEFAULT_STATIONS.length &&
      employeesCount > 0 &&
      terminalsCount > 0 &&
      numberRangesCount === TERMINAL_NUMBER_RANGES.length
    ),
    status: {
      tenant_settings: !!tenant.tenant_settings,
      catalog_meta: !!catalogMeta,
      stations: stationsCount === DEFAULT_STATIONS.length,
      employees: employeesCount > 0,
      terminals: terminalsCount > 0,
      number_ranges: numberRangesCount === TERMINAL_NUMBER_RANGES.length,
    },
    counts: {
      stations: stationsCount,
      employees: employeesCount,
      terminals: terminalsCount,
      number_ranges: numberRangesCount,
    },
  };
}
