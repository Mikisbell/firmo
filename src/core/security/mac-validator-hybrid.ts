/**
 * Hybrid MAC Address Validation Service
 * Validates MAC addresses at TWO levels:
 * 1. Device Level: MAC per employee (detects stolen devices)
 * 2. Terminal Level: MAC per terminal (detects unauthorized terminal access)
 * 
 * Supports employee rotation between terminals without daily confirmation
 */

import prisma from '@/src/core/db/prisma';
import { normalizeMACAddress } from './mac-detector';

// Special UUID for "any terminal" - when MAC is valid for all terminals
const ANY_TERMINAL_ID = '00000000-0000-0000-0000-000000000000';

export interface MACValidationResult {
  isValid: boolean;
  reason?: string;
  warning?: string;
  requiresConfirmation?: boolean;
  trustLevel?: 'TRUSTED' | 'UNKNOWN' | 'BLOCKED';
}

export interface TerminalAuthResult {
  isAuthorized: boolean;
  reason?: string;
  shouldAlert?: boolean;
}

/**
 * HYBRID VALIDATION: Check MAC at both device and terminal levels
 * 
 * Returns:
 * - VALID: MAC known, belongs to employee, not blocked, terminal OK
 * - REQUIRES_CONFIRMATION: MAC unknown
 * - INVALID: MAC belongs to different employee or is blocked
 */
export async function validateMAC(
  tenantId: string,
  employeeId: string,
  macAddress: string,
  terminalId?: string
): Promise<MACValidationResult> {
  if (!macAddress) {
    return {
      isValid: false,
      reason: 'MAC_NOT_PROVIDED',
      trustLevel: 'UNKNOWN',
    };
  }

  const normalizedMAC = normalizeMACAddress(macAddress);

  // 1. Check if MAC is authorized for this terminal
  if (terminalId) {
    const terminalAccess = await prisma.terminal_mac_registry.findFirst({
      where: {
        tenant_id: tenantId,
        terminal_id: terminalId,
        mac_address: normalizedMAC,
        is_authorized: true,
      },
    });

    if (terminalAccess) {
      // If the terminal has authorized this MAC, allow access for any employee on this terminal
      return {
        isValid: true,
        trustLevel: 'TRUSTED',
      };
    }
  }

  // 2. Is MAC known for this specific employee?
  const knownMAC = await prisma.device_mac_addresses.findFirst({
    where: {
      mac_address: normalizedMAC,
      employee_id: employeeId,
      tenant_id: tenantId,
    },
  });

  if (!knownMAC) {
    // MAC completely unknown - requires confirmation
    return {
      isValid: false,
      reason: 'UNKNOWN_MAC',
      requiresConfirmation: true,
      trustLevel: 'UNKNOWN',
    };
  }

  // (Removed employee check since we now search by employee_id above)

  // 3. Is it blocked?
  if (knownMAC.trust_level === 'BLOCKED') {
    return {
      isValid: false,
      reason: 'BLOCKED_DEVICE',
      trustLevel: 'BLOCKED',
    };
  }

  // 4. Is terminal correct? (if MAC is terminal-specific)
  if (knownMAC.terminal_id !== ANY_TERMINAL_ID && terminalId) {
    if (knownMAC.terminal_id !== terminalId) {
      // MAC known but for different terminal
      // Allow with warning (employee rotation)
      return {
        isValid: true,
        warning: 'DIFFERENT_TERMINAL',
        trustLevel: 'TRUSTED',
      };
    }
  }

  // All checks passed
  return {
    isValid: true,
    trustLevel: 'TRUSTED',
  };
}

/**
 * Check if MAC is authorized to access this terminal
 * Creates audit trail in terminal_mac_registry
 */
export async function checkTerminalAuthorization(
  tenantId: string,
  terminalId: string,
  macAddress: string,
  employeeId: string
): Promise<TerminalAuthResult> {
  const normalizedMAC = normalizeMACAddress(macAddress);

  // Has this MAC accessed this terminal before?
  const terminalAccess = await prisma.terminal_mac_registry.findFirst({
    where: {
      tenant_id: tenantId,
      terminal_id: terminalId,
      mac_address: normalizedMAC,
    },
  });

  if (!terminalAccess) {
    // First time this MAC accesses this terminal
    // Create audit record
    await prisma.terminal_mac_registry.create({
      data: {
        tenant_id: tenantId,
        terminal_id: terminalId,
        mac_address: normalizedMAC,
        employee_id: employeeId,
        is_authorized: true,
        first_seen: new Date(),
        last_seen: new Date(),
        access_count: 1,
      },
    });

    return {
      isAuthorized: true,
      reason: 'FIRST_ACCESS_TO_TERMINAL',
      shouldAlert: false,
    };
  }

  // Is it authorized?
  if (!terminalAccess.is_authorized) {
    return {
      isAuthorized: false,
      reason: 'UNAUTHORIZED_TERMINAL_ACCESS',
      shouldAlert: true,
    };
  }

  // Update last_seen and access_count
  await prisma.terminal_mac_registry.update({
    where: { id: terminalAccess.id },
    data: {
      last_seen: new Date(),
      access_count: { increment: 1 },
    },
  });

  return {
    isAuthorized: true,
  };
}

/**
 * Register a new MAC address for an employee
 * Can be terminal-specific or for any terminal
 */
export async function registerMAC(
  tenantId: string,
  employeeId: string,
  macAddress: string,
  terminalId?: string
): Promise<void> {
  const normalizedMAC = normalizeMACAddress(macAddress);
  const finalTerminalId = terminalId || ANY_TERMINAL_ID;

  // Check if MAC is already registered for this specific employee
  const existingMAC = await prisma.device_mac_addresses.findFirst({
    where: {
      mac_address: normalizedMAC,
      employee_id: employeeId,
      tenant_id: tenantId,
    },
  });

  // We no longer throw an error if another employee uses this MAC
  // because POS terminals are shared.

  // Register or update MAC
  await prisma.device_mac_addresses.upsert({
    where: {
      mac_address_employee_id_terminal_id: {
        mac_address: normalizedMAC,
        employee_id: employeeId,
        terminal_id: finalTerminalId,
      },
    },
    create: {
      mac_address: normalizedMAC,
      tenant_id: tenantId,
      employee_id: employeeId,
      terminal_id: finalTerminalId,
      trust_level: 'TRUSTED',
      first_seen: new Date(),
      last_seen: new Date(),
      is_active: true,
    },
    update: {
      last_seen: new Date(),
      is_active: true,
      trust_level: 'TRUSTED',
    },
  });
}

/**
 * Block a MAC address (admin action)
 */
export async function blockMAC(
  tenantId: string,
  macAddress: string,
  reason?: string
): Promise<void> {
  const normalizedMAC = normalizeMACAddress(macAddress);

  // Block all instances of this MAC (all employees, all terminals)
  await prisma.device_mac_addresses.updateMany({
    where: {
      mac_address: normalizedMAC,
      tenant_id: tenantId,
    },
    data: {
      trust_level: 'BLOCKED',
      is_active: false,
    },
  });

  // Also mark terminal access as unauthorized
  await prisma.terminal_mac_registry.updateMany({
    where: {
      mac_address: normalizedMAC,
      tenant_id: tenantId,
    },
    data: {
      is_authorized: false,
    },
  });
}

/**
 * Unblock a MAC address (admin action)
 */
export async function unblockMAC(
  tenantId: string,
  macAddress: string
): Promise<void> {
  const normalizedMAC = normalizeMACAddress(macAddress);

  await prisma.device_mac_addresses.updateMany({
    where: {
      mac_address: normalizedMAC,
      tenant_id: tenantId,
    },
    data: {
      trust_level: 'TRUSTED',
      is_active: true,
    },
  });
}

/**
 * Get all MAC addresses for an employee
 */
export async function getDevicesByEmployee(
  tenantId: string,
  employeeId: string
): Promise<any[]> {
  return prisma.device_mac_addresses.findMany({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      is_active: true,
    },
    orderBy: {
      last_seen: 'desc',
    },
  });
}

/**
 * Get terminal access audit log
 */
export async function getTerminalAccessLog(
  tenantId: string,
  terminalId: string,
  limit: number = 100
): Promise<any[]> {
  return prisma.terminal_mac_registry.findMany({
    where: {
      tenant_id: tenantId,
      terminal_id: terminalId,
    },
    orderBy: {
      last_seen: 'desc',
    },
    take: limit,
  });
}

/**
 * Get all unauthorized terminal access attempts
 */
export async function getUnauthorizedAccess(
  tenantId: string
): Promise<any[]> {
  return prisma.terminal_mac_registry.findMany({
    where: {
      tenant_id: tenantId,
      is_authorized: false,
    },
    orderBy: {
      last_seen: 'desc',
    },
  });
}

/**
 * Update MAC trust level
 */
export async function updateMACTrustLevel(
  tenantId: string,
  macAddress: string,
  trustLevel: 'TRUSTED' | 'UNKNOWN' | 'BLOCKED'
): Promise<void> {
  const normalizedMAC = normalizeMACAddress(macAddress);

  await prisma.device_mac_addresses.updateMany({
    where: {
      mac_address: normalizedMAC,
      tenant_id: tenantId,
    },
    data: {
      trust_level: trustLevel,
    },
  });
}

/**
 * Get device info by MAC address
 */
export async function getDeviceInfo(
  tenantId: string,
  macAddress: string
): Promise<any> {
  const normalizedMAC = normalizeMACAddress(macAddress);

  return prisma.device_mac_addresses.findFirst({
    where: {
      mac_address: normalizedMAC,
      tenant_id: tenantId,
    },
  });
}

/**
 * Deactivate all MACs for an employee (e.g., when employee is terminated)
 */
export async function deactivateEmployeeMACs(
  tenantId: string,
  employeeId: string
): Promise<void> {
  await prisma.device_mac_addresses.updateMany({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
    },
    data: {
      is_active: false,
    },
  });
}
