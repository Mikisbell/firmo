/**
 * MAC Address Validation Service
 * Validates MAC addresses and manages device registration
 */

import prisma from '@/src/core/db/prisma';
import { normalizeMACAddress } from './mac-detector';

export interface MACValidationResult {
  isValid: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

/**
 * Validates if a MAC address is known and belongs to the employee
 */
export async function validateMAC(
  tenantId: string,
  employeeId: string,
  currentMAC: string
): Promise<MACValidationResult> {
  if (!currentMAC) {
    return {
      isValid: false,
      reason: 'MAC address not provided',
    };
  }

  const normalizedMAC = normalizeMACAddress(currentMAC);

  // Check if MAC is registered
  const knownMAC = await prisma.device_mac_addresses.findUnique({
    where: { mac_address: normalizedMAC },
  });

  if (!knownMAC) {
    // MAC is unknown - requires confirmation
    return {
      isValid: false,
      reason: `MAC desconocido: ${normalizedMAC}`,
      requiresConfirmation: true,
    };
  }

  // Check if MAC belongs to this employee
  if (knownMAC.employee_id !== employeeId) {
    // MAC belongs to another employee - alert
    return {
      isValid: false,
      reason: `MAC pertenece a otro empleado`,
    };
  }

  // Check if MAC is still active
  if (!knownMAC.is_active) {
    return {
      isValid: false,
      reason: `MAC está desactivado`,
    };
  }

  // MAC is valid - update last_seen
  await prisma.device_mac_addresses.update({
    where: { mac_address: normalizedMAC },
    data: {
      last_seen: new Date(),
    },
  });

  return { isValid: true };
}

/**
 * Register a new MAC address for an employee
 */
export async function registerMAC(
  tenantId: string,
  employeeId: string,
  macAddress: string
): Promise<void> {
  const normalizedMAC = normalizeMACAddress(macAddress);

  // Check if MAC is already registered to another employee
  const existingMAC = await prisma.device_mac_addresses.findUnique({
    where: { mac_address: normalizedMAC },
  });

  if (existingMAC && existingMAC.employee_id !== employeeId) {
    throw new Error(
      `MAC address ${normalizedMAC} is already registered to another employee`
    );
  }

  // Register or update MAC
  await prisma.device_mac_addresses.upsert({
    where: { mac_address: normalizedMAC },
    create: {
      mac_address: normalizedMAC,
      tenant_id: tenantId,
      employee_id: employeeId,
      first_seen: new Date(),
      last_seen: new Date(),
      is_active: true,
    },
    update: {
      last_seen: new Date(),
      is_active: true,
    },
  });
}

/**
 * Deactivate a MAC address
 */
export async function deactivateMAC(macAddress: string): Promise<void> {
  const normalizedMAC = normalizeMACAddress(macAddress);

  await prisma.device_mac_addresses.update({
    where: { mac_address: normalizedMAC },
    data: {
      is_active: false,
    },
  });
}

/**
 * Get all MAC addresses for an employee
 */
export async function getEmployeeMACs(
  tenantId: string,
  employeeId: string
): Promise<any[]> {
  return prisma.device_mac_addresses.findMany({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
    },
    orderBy: {
      last_seen: 'desc',
    },
  });
}

/**
 * Log MAC address access
 */
export async function logMACAccess(
  tenantId: string,
  employeeId: string,
  macAddress: string,
  userAgent?: string
): Promise<void> {
  const normalizedMAC = normalizeMACAddress(macAddress);

  await prisma.session_audit_log.create({
    data: {
      tenant_id: tenantId,
      employee_id: employeeId,
      action: 'LOGIN',
      mac_address: normalizedMAC,
      details: {
        userAgent,
        timestamp: new Date().toISOString(),
      },
    },
  });
}
