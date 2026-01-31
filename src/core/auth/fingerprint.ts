// src/core/auth/fingerprint.ts
// Generate unique device fingerprint for terminal identification

import { logger } from '@/src/core/observability/logger';

export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];

  // Screen info
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  
  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Language
  components.push(navigator.language);
  
  // Platform
  components.push(navigator.platform);
  
  // Hardware concurrency (CPU cores)
  components.push(String(navigator.hardwareConcurrency || 0));
  
  // Device memory (if available)
  const nav = navigator as Navigator & { deviceMemory?: number };
  components.push(String(nav.deviceMemory || 0));
  
  // Touch support
  components.push(String(navigator.maxTouchPoints || 0));
  
  // Canvas fingerprint (simplified)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('PARK-POS-FP', 2, 2);
      components.push(canvas.toDataURL().slice(-50));
    }
  } catch {
    components.push('no-canvas');
  }

  // Create hash
  const data = components.join('|');
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.slice(0, 32); // First 32 chars
}

// Get or create persistent terminal ID stored in localStorage
export function getStoredTerminalId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('park_terminal_id');
}

export function setStoredTerminalId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('park_terminal_id', id);
}

// Generate deterministic UUID from terminal_id for actor_id
function generateActorId(terminalId: string): string {
  const hash = terminalId.split('').reduce((acc, char, i) => {
    return acc + char.charCodeAt(0) * (i + 1);
  }, 0);
  
  const hex = hash.toString(16).padStart(8, '0');
  const terminalHash = terminalId.split('').map(c => c.charCodeAt(0).toString(16)).join('').padStart(24, '0');
  
  return `${hex.slice(0, 8)}-${terminalHash.slice(0, 4)}-4${terminalHash.slice(4, 7)}-a${terminalHash.slice(7, 10)}-${terminalHash.slice(10, 22)}`;
}

export function getStoredTerminalConfig(): import('./types').TerminalConfig | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('park_terminal_config');
  if (!data) return null;
  try {
    const config = JSON.parse(data) as import('./types').TerminalConfig;
    
    // Migrate old configs that don't have actor_id
    if (!config.actor_id && config.terminal_id) {
      config.actor_id = generateActorId(config.terminal_id);
      // Save migrated config
      localStorage.setItem('park_terminal_config', JSON.stringify(config));
      logger.info('AUTH_CONFIG_MIGRATED', 'Migrated terminal config with new actor_id', { actorId: config.actor_id });
    }
    
    return config;
  } catch {
    return null;
  }
}

export function setStoredTerminalConfig(config: import('./types').TerminalConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('park_terminal_config', JSON.stringify(config));
}

export function clearTerminalConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('park_terminal_id');
  localStorage.removeItem('park_terminal_config');
}
