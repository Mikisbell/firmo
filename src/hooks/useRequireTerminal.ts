'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import { safeStorage } from '@/src/lib/storage';
import { getDevTerminalConfig, resolveDevStation } from '@/src/core/config/dev-identity';

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
        // Identidad de dev desde la AUTORIDAD UNICA (dev-identity), coherente con el resto del
        // sistema y el seed. Respeta la estacion elegida en el launcher /dev; por defecto MOZO
        // (este hook es el guard del terminal de mozo). Evita el tenant fantasma / CHANNEL_ERROR.
        const rawStation = typeof window !== 'undefined'
          ? (safeStorage.getItem('dev_station') ?? safeStorage.getItem('dev_role'))
          : null;
        const defaultConfig = getDevTerminalConfig(rawStation ? resolveDevStation(rawStation) : 'MOZO');
        
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

