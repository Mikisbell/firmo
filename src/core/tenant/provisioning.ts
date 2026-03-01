/**
 * Tenant Provisioning Service
 * 
 * Automates creation of new tenants with all required configuration.
 * Implements atomic provisioning with automatic rollback on failure.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '@/src/core/db/prisma';
import { hashPin } from '@/src/core/auth/crypto-utils';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('provisioning');

export interface TenantProvisioningRequest {
  legal_name: string;
  ruc?: string;
  address_text?: string;
  admin_name: string;
  admin_pin: string;
  timezone?: string;
  currency?: string;
  receipt_footer_text?: string;
  kds_audio_enabled?: boolean;
  kds_audio_volume?: number;
  default_delivery_fee_cents?: number;
  enable_tips?: boolean;
  tips_on_invoice?: boolean;
  allow_offline_coupon?: boolean;
  max_offline_coupons_per_order?: number;
  require_manager_for_offline?: boolean;
}

export interface OnboardingStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  is_completed: boolean;
}

export interface TenantProvisioningResult {
  tenant_id: string;
  admin_employee_id: string;
  activation_code: string;
  onboarding_checklist: OnboardingStep[];
  credentials: {
    tenant_id: string;
    admin_employee_id: string;
    admin_pin: string;
  };
}

export interface TenantProvisioningStatus {
  is_provisioned: boolean;
  status: {
    tenant_settings: boolean;
    catalog_meta: boolean;
    stations: boolean;
    employees: boolean;
    terminals: boolean;
    number_ranges: boolean;
  };
  counts: {
    stations: number;
    employees: number;
    terminals: number;
    number_ranges: number;
  };
}

/**
 * Provision a new tenant with all required resources
 * 
 * This function creates:
 * 1. Tenant record
 * 2. Tenant settings with configuration
 * 3. Catalog metadata with version 1
 * 4. 4 default stations (PARRILLA, COCINA, BAR, EMPAQUE)
 * 5. Admin employee with hashed PIN
 * 6. 10 terminal number ranges
 * 7. Default terminal
 * 8. Activation code
 * 9. Onboarding checklist
 * 
 * All operations are atomic - if any step fails, all changes are rolled back.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 */
export async function provisionTenant(
  request: TenantProvisioningRequest
): Promise<TenantProvisioningResult> {
  const tenantId = uuidv4();
  const adminEmployeeId = uuidv4();
  const activationCode = generateActivationCode();

  try {
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create tenant record
      const tenant = await tx.tenants.create({
        data: {
          id: tenantId,
          name: request.legal_name,
          is_active: true,
        },
      });

      // 2. Create tenant settings
      const settings = await tx.tenant_settings.create({
        data: {
          tenant_id: tenantId,
          legal_name: request.legal_name,
          ruc: request.ruc,
          address_text: request.address_text,
          logo_url: null,
          timezone: request.timezone || 'America/Lima',
          currency: request.currency || 'PEN',
          receipt_footer_text: request.receipt_footer_text,
          kds_audio_enabled: request.kds_audio_enabled ?? true,
          kds_audio_volume: request.kds_audio_volume ?? 50,
          default_delivery_fee_cents: request.default_delivery_fee_cents ?? 0,
          enable_tips: request.enable_tips ?? true,
          tips_on_invoice: request.tips_on_invoice ?? false,
          allow_offline_coupon: request.allow_offline_coupon ?? true,
          max_offline_coupons_per_order: request.max_offline_coupons_per_order ?? 5,
          require_manager_for_offline: request.require_manager_for_offline ?? false,
          onboarding_status: 'IN_PROGRESS',
        },
      });

      // 3. Create catalog metadata
      const catalogMeta = await tx.catalog_meta.create({
        data: {
          tenant_id: tenantId,
          catalog_version: 1,
        },
      });

      // 4. Create default stations
      const stationCodes = ['PARRILLA', 'COCINA', 'BAR', 'EMPAQUE'];
      const stations = await Promise.all(
        stationCodes.map((code, index) =>
          tx.stations.create({
            data: {
              id: uuidv4(),
              tenant_id: tenantId,
              code,
              name: code.charAt(0) + code.slice(1).toLowerCase(),
              is_active: true,
              estimated_time: 10,
            },
          })
        )
      );

      // 5. Create admin employee with hashed PIN
      const hashedPin = await hashPin(request.admin_pin);
      const adminEmployee = await tx.employees.create({
        data: {
          id: adminEmployeeId,
          tenant_id: tenantId,
          name: request.admin_name,
          role: 'ADMIN',
          pin_hash: hashedPin,
          is_active: true,
        },
      });

      // 6. Allocate 10 terminal number ranges
      const ranges = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          tx.terminal_number_ranges.create({
            data: {
              terminal_id: `${tenantId}-range-${i}`,
              tenant_id: tenantId,
              range_start: (i * 100) + 1,
              range_end: ((i + 1) * 100),
              current_number: (i * 100) + 1,
              allocated_at: new Date(),
            },
          })
        )
      );

      // 7. Create default terminal
      const terminal = await tx.terminals.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          terminal_id: '1',
          is_allowed: true,
        },
      });

      // 8. Create onboarding checklist
      const onboardingSteps: OnboardingStep[] = [
        {
          id: uuidv4(),
          step_number: 1,
          title: 'Configurar Información del Negocio',
          description: 'Completa los datos de tu restaurante (nombre, RUC, dirección)',
          is_completed: false,
        },
        {
          id: uuidv4(),
          step_number: 2,
          title: 'Crear Empleados',
          description: 'Agrega al menos un empleado además del administrador',
          is_completed: false,
        },
        {
          id: uuidv4(),
          step_number: 3,
          title: 'Crear Productos',
          description: 'Agrega los productos que venderás (pollos, bebidas, etc.)',
          is_completed: false,
        },
        {
          id: uuidv4(),
          step_number: 4,
          title: 'Configurar Estaciones',
          description: 'Configura las estaciones de cocina (parrilla, cocina, bar)',
          is_completed: false,
        },
        {
          id: uuidv4(),
          step_number: 5,
          title: 'Activar Terminal',
          description: 'Activa tu terminal POS con el código de activación',
          is_completed: false,
        },
        {
          id: uuidv4(),
          step_number: 6,
          title: 'Realizar Primera Venta',
          description: 'Realiza tu primera venta de prueba en el sistema',
          is_completed: false,
        },
      ];

      return {
        tenant_id: tenantId,
        admin_employee_id: adminEmployeeId,
        activation_code: activationCode,
        onboarding_checklist: onboardingSteps,
        credentials: {
          tenant_id: tenantId,
          admin_employee_id: adminEmployeeId,
          admin_pin: request.admin_pin,
        },
      };
    });

    return result;
  } catch (error) {
    log.error('Falló el aprovisionamiento del tenant', error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Failed to provision tenant: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get tenant provisioning status
 * 
 * Checks if a tenant has been fully provisioned with all required resources.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */
export async function getTenantProvisioningStatus(
  tenantId: string
): Promise<TenantProvisioningStatus> {
  try {
    // Check all required resources
    const [
      tenantSettings,
      catalogMeta,
      stations,
      employees,
      terminals,
      numberRanges,
    ] = await Promise.all([
      prisma.tenant_settings.findUnique({
        where: { tenant_id: tenantId },
      }),
      prisma.catalog_meta.findUnique({
        where: { tenant_id: tenantId },
      }),
      prisma.stations.findMany({
        where: { tenant_id: tenantId },
      }),
      prisma.employees.findMany({
        where: { tenant_id: tenantId },
      }),
      prisma.terminals.findMany({
        where: { tenant_id: tenantId },
      }),
      prisma.terminal_number_ranges.findMany({
        where: { tenant_id: tenantId },
      }),
    ]);

    const status: TenantProvisioningStatus = {
      is_provisioned:
        !!tenantSettings &&
        !!catalogMeta &&
        stations.length >= 4 &&
        employees.length >= 1 &&
        terminals.length >= 1 &&
        numberRanges.length >= 10,
      status: {
        tenant_settings: !!tenantSettings,
        catalog_meta: !!catalogMeta,
        stations: stations.length >= 4,
        employees: employees.length >= 1,
        terminals: terminals.length >= 1,
        number_ranges: numberRanges.length >= 10,
      },
      counts: {
        stations: stations.length,
        employees: employees.length,
        terminals: terminals.length,
        number_ranges: numberRanges.length,
      },
    };

    return status;
  } catch (error) {
    log.error('Error al obtener estado de aprovisionamiento', error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Failed to get provisioning status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a 6-digit activation code
 */
function generateActivationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
