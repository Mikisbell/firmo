import prisma from '@/src/core/db/prisma';

export interface LocationValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface Location {
  lat: number;
  lng: number;
}

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine
 * Retorna la distancia en kilómetros
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Valida si un viaje entre dos ubicaciones es posible
 * Velocidad máxima: 900 km/h (velocidad de un avión comercial)
 */
export async function validateLocation(
  tenantId: string,
  employeeId: string,
  currentLocation: Location
): Promise<LocationValidationResult> {
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

  if (!lastSession || !lastSession.location_lat || !lastSession.location_lng) {
    // Primera sesión o sin ubicación anterior, es válida
    return { isValid: true };
  }

  // Calcular distancia
  const distance = calculateDistance(
    Number(lastSession.location_lat),
    Number(lastSession.location_lng),
    currentLocation.lat,
    currentLocation.lng
  );

  // Calcular tiempo transcurrido en minutos
  const timeDiff =
    (Date.now() - lastSession.last_activity_at.getTime()) / 1000 / 60;

  // Velocidad máxima: 900 km/h = 15 km/min
  const maxDistance = (timeDiff / 60) * 900;

  if (distance > maxDistance) {
    return {
      isValid: false,
      reason: `Viaje imposible: ${distance.toFixed(2)}km en ${timeDiff.toFixed(1)}min (máximo: ${maxDistance.toFixed(2)}km)`,
    };
  }

  return { isValid: true };
}

/**
 * Obtiene la ubicación actual del cliente (desde geolocation API)
 * Esta función se ejecuta en el cliente, no en el servidor
 */
export async function getClientLocation(): Promise<Location | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Error al obtener ubicación
        resolve(null);
      },
      {
        timeout: 5000,
        enableHighAccuracy: false,
      }
    );
  });
}

/**
 * Registra un evento de ubicación
 */
export async function logLocationAccess(
  tenantId: string,
  employeeId: string,
  location: Location | null,
  ipAddress: string
): Promise<void> {
  await prisma.session_audit_log.create({
    data: {
      tenant_id: tenantId,
      employee_id: employeeId,
      action: 'LOCATION_ACCESS',
      ip_address: ipAddress,
      details: {
        location: location ? { lat: location.lat, lng: location.lng } : null,
        timestamp: new Date().toISOString(),
      } as any,
    },
  });
}
