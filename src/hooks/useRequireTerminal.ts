'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredTerminalConfig } from '@/src/core/auth/fingerprint';

/**
 * Hook que verifica si hay un terminal configurado.
 * Si no hay terminal, redirige al inicio (/).
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
      // No hay terminal configurado, redirigir al inicio
      router.replace('/');
      return;
    }

    // Terminal configurado
    setTerminalId(config.terminal_id);
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [router]);

  return { isLoading, isAuthenticated, terminalId };
}
