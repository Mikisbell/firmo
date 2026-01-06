'use client';

// src/components/auth/LoginScreen.tsx
// PIN login screen for registered terminals

import { useState, useEffect } from 'react';
import { PinPad } from './PinPad';
import { 
  isLocked, 
  recordPinAttempt,
} from '@/src/core/auth/pin';
import { 
  generateDeviceFingerprint,
} from '@/src/core/auth/fingerprint';
import { createSession } from '@/src/core/auth/session';
import type { TerminalConfig, AuthSession } from '@/src/core/auth/types';

interface LoginScreenProps {
  terminal: TerminalConfig;
  onLogin: (session: AuthSession) => void;
  onTerminalError: () => void;
}

export function LoginScreen({ terminal, onLogin, onTerminalError }: LoginScreenProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockStatus, setLockStatus] = useState<{ locked: boolean; remainingMinutes?: number }>({ locked: false });
  const [shiftInfo, setShiftInfo] = useState<{ id: string; opened_at: string } | null>(null);

  useEffect(() => {
    // Check lock status on mount
    setLockStatus(isLocked());
    
    // Update lock status every minute
    const interval = setInterval(() => {
      setLockStatus(isLocked());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const handlePinSubmit = async (pin: string) => {
    if (lockStatus.locked) return;
    
    setLoading(true);
    setError('');

    try {
      const fingerprint = await generateDeviceFingerprint();
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: terminal.tenant_id,
          terminal_id: terminal.terminal_id,
          pin,
          device_fingerprint: fingerprint,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific errors
        if (response.status === 403 && data.error?.includes('desactivado')) {
          onTerminalError();
          return;
        }
        
        if (response.status === 403 && data.error?.includes('Dispositivo')) {
          onTerminalError();
          return;
        }

        // Record failed attempt
        const attemptResult = recordPinAttempt(false);
        if (attemptResult.locked) {
          setLockStatus({ locked: true, remainingMinutes: attemptResult.lockoutMinutes });
          setError(`Demasiados intentos. Espera ${attemptResult.lockoutMinutes} minutos.`);
        } else {
          setError(`PIN incorrecto. ${attemptResult.remainingAttempts} intentos restantes.`);
        }
        return;
      }

      // Success - record and create session
      recordPinAttempt(true);
      
      if (data.shift) {
        setShiftInfo(data.shift);
      }

      const session = createSession(
        terminal,
        data.employee,
        data.shift?.id
      );

      onLogin(session);
    } catch (err) {
      setError('Error de conexión. Verifica tu internet.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = () => {
    switch (terminal.role) {
      case 'CASHIER': return '💰';
      case 'WAITER': return '📱';
      case 'KDS': return '🍳';
      case 'BAR': return '🍺';
      case 'ADMIN': return '👔';
      default: return '📟';
    }
  };

  const getRoleName = () => {
    switch (terminal.role) {
      case 'CASHIER': return 'Caja';
      case 'WAITER': return 'Mesero';
      case 'KDS': return 'Cocina';
      case 'BAR': return 'Bar';
      case 'ADMIN': return 'Admin';
      default: return terminal.role;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">🍗 PARK POS</h1>
        <div className="flex items-center justify-center gap-2 text-zinc-400">
          <span className="text-xl">{getRoleIcon()}</span>
          <span>{terminal.device_name || terminal.terminal_id}</span>
          <span className="text-zinc-600">•</span>
          <span className="text-emerald-400">{getRoleName()}</span>
        </div>
      </div>

      {/* Login Card */}
      <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
        <h2 className="text-xl font-semibold text-white text-center mb-6">
          Ingresa tu PIN
        </h2>

        {lockStatus.locked ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔒</div>
            <p className="text-red-400 font-medium">
              Terminal bloqueado
            </p>
            <p className="text-zinc-500 text-sm mt-2">
              Espera {lockStatus.remainingMinutes} minutos para intentar de nuevo
            </p>
          </div>
        ) : (
          <PinPad
            onSubmit={handlePinSubmit}
            disabled={loading}
            error={error}
          />
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 mt-4 text-zinc-400">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
            <span>Verificando...</span>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="mt-6 flex items-center gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Online
        </span>
        {shiftInfo && (
          <span>
            Turno abierto desde {new Date(shiftInfo.opened_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
