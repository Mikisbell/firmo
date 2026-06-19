'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import type { TerminalConfig } from '@/src/core/auth/types';
import { safeStorage } from '@/src/lib/storage';
import { getTenantId } from '@/src/core/config/tenant';
import { DEFAULT_LOCATION_ID } from '@/src/core/config/location';
import { DEFAULT_EMPLOYEE_IDS } from '@/src/core/config/employees';

/**
 * Hook que verifica si hay un terminal configurado.
 * Si no hay terminal, redirige al inicio (/).
 * 
 * En modo desarrollo/testing, usa configuración por defecto si no existe.
 * 
 * @returns { isLoading, isAuthenticated, terminalId }
 */
export function useRequireTerminal() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [terminalId, setTerminalId] = useState<string | null>(null);

  useEffect(() => {
    const config = getStoredTerminalConfig();
    
    if (!config?.terminal_id) {
      // Check if we're in development or E2E test mode
      // In browser, process.env.NODE_ENV is replaced at build time
      const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const isE2E = typeof window !== 'undefined' && safeStorage.getItem('e2e_mode') === 'true';
      
      console.log('[useRequireTerminal] No config found', { isDev, isE2E, hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown' });
      
      if (isDev || isE2E) {
        // Config por defecto para dev/testing. CRITICO: el tenant/location/actor deben venir
        // de la MISMA fuente que usa el resto del sistema (getTenantId = NEXT_PUBLIC_TENANT_ID
        // || tenant demo), si no el mozo opera en un tenant fantasma: sus eventos no los ve
        // nadie y el canal Realtime (topic) no coincide con el claim del token -> CHANNEL_ERROR.
        const defaultConfig: TerminalConfig = {
          tenant_id: getTenantId(),
          terminal_id: "WAITER_DEV_01",
          actor_id: DEFAULT_EMPLOYEE_IDS.WAITER_CARLOS,
          role: "WAITER",
          device_fingerprint: "dev-device-fingerprint",
          device_name: "Development Waiter Terminal",
          location_id: DEFAULT_LOCATION_ID,
          is_allowed: true,
          registered_at: new Date().toISOString()
        };
        
        console.log('[useRequireTerminal] Using default config for dev/test');
        
        // Store it for consistency (use correct key: park_terminal_config)
        if (typeof window !== 'undefined') {
          safeStorage.setItem('park_terminal_config', JSON.stringify(defaultConfig));
        }
        
        setTerminalId(defaultConfig.terminal_id);
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }
      
      console.log('[useRequireTerminal] Redirecting to home - no config and not dev mode');
      // No hay terminal configurado, redirigir al inicio
      router.replace('/');
      return;
    }

    console.log('[useRequireTerminal] Config found', { terminal_id: config.terminal_id });
    // Terminal configurado
    setTerminalId(config.terminal_id);
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [router]);

  return { isLoading, isAuthenticated, terminalId };
}

