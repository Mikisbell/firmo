import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';

export interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
  confirmationCode?: string;
}

export interface SessionContext {
  employeeId: string;
  terminalId: string;
  deviceId: string;
  ipAddress: string;
  userAgent?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

/**
 * Detecta si hay una sesión activa en otro dispositivo
 */
export async function detectSimultaneousLogin(
  tenantId: string,
  employeeId: string,
  terminalId: string,
  deviceId: string
): Promise<{ hasActiveSession: boolean; session?: any }> {
  const activeSessions = await prisma.active_sessions.findMany({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      terminal_id: terminalId,
      is_active: true,
      device_id: { not: deviceId }, // Dispositivo diferente
    },
  });

  if (activeSessions.length > 0) {
    return {
      hasActiveSession: true,
      session: activeSessions[0],
    };
  }

  return { hasActiveSession: false };
}

/**
 * Crea una nueva sesión activa
 */
export async function createActiveSession(
  tenantId: string,
  context: SessionContext
): Promise<{ sessionToken: string; sessionId: string }> {
  const sessionToken = uuidv4();
  const sessionId = uuidv4();

  await prisma.active_sessions.create({
    data: {
      id: sessionId,
      tenant_id: tenantId,
      employee_id: context.employeeId,
      terminal_id: context.terminalId,
      device_id: context.deviceId,
      session_token: sessionToken,
      ip_address: context.ipAddress,
      user_agent: context.userAgent,
      location_lat: context.location?.lat,
      location_lng: context.location?.lng,
      is_active: true,
      is_suspicious: false,
    },
  });

  return { sessionToken, sessionId };
}

/**
 * Obtiene la última sesión de un empleado
 */
export async function getLastSession(
  tenantId: string,
  employeeId: string
): Promise<any | null> {
  return prisma.active_sessions.findFirst({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      is_active: true,
    },
    orderBy: {
      last_activity_at: 'desc',
    },
  });
}

/**
 * Cierra una sesión
 */
export async function closeSession(
  sessionToken: string,
  reason?: string
): Promise<void> {
  await prisma.active_sessions.updateMany({
    where: {
      session_token: sessionToken,
    },
    data: {
      is_active: false,
      ended_at: new Date(),
      blocked_reason: reason,
    },
  });
}

/**
 * Valida si una sesión es válida
 */
export async function validateSession(
  sessionToken: string
): Promise<{ valid: boolean; session?: any }> {
  const session = await prisma.active_sessions.findUnique({
    where: {
      session_token: sessionToken,
    },
  });

  if (!session) {
    return { valid: false };
  }

  if (!session.is_active) {
    return { valid: false };
  }

  // Actualizar last_activity_at
  await prisma.active_sessions.update({
    where: {
      session_token: sessionToken,
    },
    data: {
      last_activity_at: new Date(),
    },
  });

  return { valid: true, session };
}

/**
 * Marca una sesión como sospechosa
 */
export async function markSessionAsSuspicious(
  sessionId: string,
  reason: string
): Promise<void> {
  await prisma.active_sessions.update({
    where: {
      id: sessionId,
    },
    data: {
      is_suspicious: true,
      blocked_reason: reason,
    },
  });
}

/**
 * Obtiene todas las sesiones activas de un empleado
 */
export async function getEmployeeActiveSessions(
  tenantId: string,
  employeeId: string
): Promise<any[]> {
  return prisma.active_sessions.findMany({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      is_active: true,
    },
    orderBy: {
      started_at: 'desc',
    },
  });
}

/**
 * Cierra todas las sesiones de un empleado excepto una
 */
export async function closeAllSessionsExcept(
  tenantId: string,
  employeeId: string,
  exceptSessionToken: string
): Promise<void> {
  await prisma.active_sessions.updateMany({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      is_active: true,
      session_token: { not: exceptSessionToken },
    },
    data: {
      is_active: false,
      ended_at: new Date(),
      blocked_reason: 'Closed due to new login',
    },
  });
}
