import prisma from '@/src/core/db/prisma';

export interface IPValidationResult {
  isSuspicious: boolean;
  reason?: string;
}

/**
 * Valida si una IP es sospechosa comparándola con la última sesión
 */
export async function validateIP(
  tenantId: string,
  employeeId: string,
  currentIP: string
): Promise<IPValidationResult> {
  // Obtener la última sesión
  const lastSession = await prisma.active_sessions.findFirst({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      is_active: true,
    },
    orderBy: {
      last_activity_at: 'desc',
    },
  });

  if (!lastSession) {
    // Primera sesión, no es sospechosa
    return { isSuspicious: false };
  }

  // Si la IP es diferente, es sospechosa
  if (lastSession.ip_address !== currentIP) {
    return {
      isSuspicious: true,
      reason: `IP diferente: ${lastSession.ip_address} → ${currentIP}`,
    };
  }

  return { isSuspicious: false };
}

/**
 * Obtiene la IP pública del cliente (desde headers)
 */
export function getClientIP(headers: Headers): string {
  // Intentar obtener IP de headers comunes
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const clientIP = headers.get('cf-connecting-ip');
  if (clientIP) {
    return clientIP;
  }

  // Fallback a localhost
  return '127.0.0.1';
}

/**
 * Valida si una IP es de un rango privado
 */
export function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];

  return privateRanges.some((range) => range.test(ip));
}

/**
 * Obtiene información de geolocalización de una IP (mock)
 * En producción, usar un servicio como MaxMind o IP2Location
 */
export async function getIPGeolocation(
  ip: string
): Promise<{ lat: number; lng: number } | null> {
  // Mock: retornar null para IPs privadas
  if (isPrivateIP(ip)) {
    return null;
  }

  // En producción, llamar a un servicio de geolocalización
  // Por ahora, retornar null
  return null;
}

/**
 * Registra un evento de acceso desde una IP
 */
export async function logIPAccess(
  tenantId: string,
  employeeId: string,
  ipAddress: string,
  userAgent?: string
): Promise<void> {
  await prisma.session_audit_log.create({
    data: {
      tenant_id: tenantId,
      employee_id: employeeId,
      action: 'LOGIN',
      ip_address: ipAddress,
      details: {
        userAgent,
        timestamp: new Date().toISOString(),
      },
    },
  });
}
