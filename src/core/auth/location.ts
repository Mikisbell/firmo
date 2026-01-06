// src/core/auth/location.ts
// Location verification (geofence and network)

import type { LocationConfig } from './types';

// Haversine formula to calculate distance between two points
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Check if device is within geofence
export async function checkGeofence(location: LocationConfig): Promise<{
  inRange: boolean;
  distance?: number;
  error?: string;
}> {
  if (!location.lat || !location.lng || !location.radius_m) {
    return { inRange: true }; // No geofence configured, allow
  }

  if (!navigator.geolocation) {
    return { inRange: false, error: 'Geolocation not supported' };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = haversineDistance(
          position.coords.latitude,
          position.coords.longitude,
          location.lat!,
          location.lng!
        );
        resolve({
          inRange: distance <= location.radius_m!,
          distance: Math.round(distance),
        });
      },
      (error) => {
        // If user denies location, we can't verify
        resolve({ 
          inRange: false, 
          error: error.code === 1 ? 'Permiso de ubicación denegado' : 'Error de ubicación' 
        });
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

// Check if device is on allowed network (by IP prefix)
export async function checkNetwork(location: LocationConfig): Promise<{
  inNetwork: boolean;
  ip?: string;
  error?: string;
}> {
  if (!location.allowed_ip_prefix) {
    return { inNetwork: true }; // No network restriction configured
  }

  try {
    // Try to detect local IP via WebRTC (works in most browsers)
    const ip = await getLocalIP();
    if (!ip) {
      return { inNetwork: false, error: 'No se pudo detectar IP local' };
    }
    
    return {
      inNetwork: ip.startsWith(location.allowed_ip_prefix),
      ip,
    };
  } catch {
    return { inNetwork: false, error: 'Error verificando red' };
  }
}

// Get local IP using WebRTC (privacy-respecting method)
async function getLocalIP(): Promise<string | null> {
  return new Promise((resolve) => {
    // Fallback: assume we're in network if we can't detect
    // In production, you'd ping a local server endpoint
    const timeout = setTimeout(() => resolve(null), 3000);
    
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (match) {
          clearTimeout(timeout);
          pc.close();
          resolve(match[1]);
        }
      };
      
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

// Combined location check
export async function verifyLocation(location: LocationConfig): Promise<{
  allowed: boolean;
  method: 'geofence' | 'network' | 'both' | 'none';
  details: {
    geofence?: { inRange: boolean; distance?: number; error?: string };
    network?: { inNetwork: boolean; ip?: string; error?: string };
  };
}> {
  const hasGeofence = !!(location.lat && location.lng && location.radius_m);
  const hasNetwork = !!location.allowed_ip_prefix;
  
  if (!hasGeofence && !hasNetwork) {
    return { allowed: true, method: 'none', details: {} };
  }
  
  const results: {
    geofence?: Awaited<ReturnType<typeof checkGeofence>>;
    network?: Awaited<ReturnType<typeof checkNetwork>>;
  } = {};
  
  // Check both in parallel
  const [geofenceResult, networkResult] = await Promise.all([
    hasGeofence ? checkGeofence(location) : Promise.resolve(undefined),
    hasNetwork ? checkNetwork(location) : Promise.resolve(undefined),
  ]);
  
  if (geofenceResult) results.geofence = geofenceResult;
  if (networkResult) results.network = networkResult;
  
  // Logic: Allow if EITHER check passes (OR logic for flexibility)
  // You could change to AND logic for stricter security
  let allowed = false;
  let method: 'geofence' | 'network' | 'both' | 'none' = 'none';
  
  if (hasGeofence && hasNetwork) {
    allowed = (geofenceResult?.inRange || false) || (networkResult?.inNetwork || false);
    method = 'both';
  } else if (hasGeofence) {
    allowed = geofenceResult?.inRange || false;
    method = 'geofence';
  } else if (hasNetwork) {
    allowed = networkResult?.inNetwork || false;
    method = 'network';
  }
  
  return { allowed, method, details: results };
}
