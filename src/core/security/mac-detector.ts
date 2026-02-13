/**
 * MAC Address Detection Service
 * Detects device MAC address using WebRTC or falls back to Device ID
 */

import { safeStorage } from '@/src/lib/storage';

/**
 * Detects MAC address using WebRTC
 * Returns MAC address in format: AA:BB:CC:DD:EE:FF
 * Falls back to null if WebRTC is not available or user denies permissions
 */
export async function detectMACAddress(): Promise<string | null> {
  try {
    // Try WebRTC-based MAC detection
    const mac = await getMACFromWebRTC();
    if (mac) {
      return mac;
    }
  } catch (error) {
    console.warn('WebRTC MAC detection failed:', error);
  }

  // Fallback: return null (will use Device ID instead)
  return null;
}

/**
 * Get MAC address from WebRTC
 * Uses RTCPeerConnection to extract MAC address from ICE candidates
 */
async function getMACFromWebRTC(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new (window as any).RTCPeerConnection({
        iceServers: [],
      });

      const dc = pc.createDataChannel('');

      pc.onicecandidate = (ice: any) => {
        if (!ice || !ice.candidate) {
          resolve(null);
          return;
        }

        // Extract MAC address from ICE candidate
        // Format: candidate:... address XXXX:XXXX:XXXX:XXXX:XXXX:XXXX:XXXX:XXXX ...
        const ipRegex = /([0-9a-f]{2}(:[0-9a-f]{2}){5})/gi;
        const match = ipRegex.exec(ice.candidate.candidate);

        if (match) {
          const mac = match[1].toUpperCase();
          resolve(mac);
          pc.close();
        }
      };

      pc.createOffer()
        .then((offer: any) => pc.setLocalDescription(offer))
        .catch(() => resolve(null));

      // Timeout after 1 second
      setTimeout(() => {
        resolve(null);
        pc.close();
      }, 1000);
    } catch (error) {
      console.warn('WebRTC error:', error);
      resolve(null);
    }
  });
}

/**
 * Get or create Device ID (fallback if MAC is not available)
 * Stores in localStorage for persistence
 */
export function getOrCreateDeviceId(): string {
  const stored = safeStorage.getItem('park_pos_device_id');

  if (stored) {
    return stored;
  }

  // Generate UUID v4
  const deviceId = crypto.randomUUID();
  safeStorage.setItem('park_pos_device_id', deviceId);

  return deviceId;
}

/**
 * Get device identifier (MAC or Device ID)
 * Tries MAC first, falls back to Device ID
 */
export async function getDeviceIdentifier(): Promise<{
  identifier: string;
  type: 'mac' | 'device_id';
}> {
  const mac = await detectMACAddress();

  if (mac) {
    return {
      identifier: mac,
      type: 'mac',
    };
  }

  const deviceId = getOrCreateDeviceId();
  return {
    identifier: deviceId,
    type: 'device_id',
  };
}

/**
 * Validate MAC address format
 * Valid formats: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
 */
export function isValidMACAddress(mac: string): boolean {
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

/**
 * Normalize MAC address to uppercase with colons
 * Input: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
 * Output: AA:BB:CC:DD:EE:FF
 */
export function normalizeMACAddress(mac: string): string {
  return mac.toUpperCase().replace(/-/g, ':');
}
