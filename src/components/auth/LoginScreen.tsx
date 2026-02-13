'use client';

// src/components/auth/LoginScreen.tsx
// PIN login screen for registered terminals with risk-based authentication

import { useState, useEffect } from 'react';
import PinPad from './PinPad';
import { 
  isLocked, 
  recordPinAttempt,
} from '@/src/core/auth/pin';
import { generateFingerprintV2 } from '@/src/core/auth/fingerprint-v2';
import { createSession, type SecureSession } from '@/src/core/auth/session-v2';
import { assessRisk, getTimeOfDay, type RiskAssessment } from '@/src/core/auth/risk-validator';
import type { TerminalConfig } from '@/src/core/auth/types';

interface LoginScreenProps {
  terminal: TerminalConfig;
  onLogin: (session: SecureSession, risk: RiskAssessment) => void;
  onTerminalError: () => void;
}

export function LoginScreen({ terminal, onLogin, onTerminalError }: LoginScreenProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockStatus, setLockStatus] = useState<{ locked: boolean; remainingMinutes?: number }>({ locked: false });
  const [shiftInfo, setShiftInfo] = useState<{ id: string; opened_at: string } | null>(null);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high' | null>(null);

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
    setRiskLevel(null);

    try {
      // Generate enhanced fingerprint
      const fingerprint = await generateFingerprintV2();
      
      // Assess risk with basic factors (server will enhance)
      const riskFactors = {
        fingerprintMatch: 100, // Will be determined by server
        ipKnown: true, // Will be determined by server
        timeOfDay: getTimeOfDay(),
        failedAttempts: 0, // Will be updated if login fails
        daysSinceLastAuth: 0, // Will be determined by server
        deviceAge: 0, // Will be determined by server
      };

      const riskAssessment = assessRisk(riskFactors);
      
      // Set risk level for UI
      if (riskAssessment.score < 30) setRiskLevel('low');
      else if (riskAssessment.score < 70) setRiskLevel('medium');
      else setRiskLevel('high');

      // Authenticate with server
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: terminal.tenant_id,
          terminal_id: terminal.terminal_id,
          pin,
          fingerprint: {
            hash: fingerprint.hash,
            signals: fingerprint.signals,
            signalCount: fingerprint.signalCount,
            timestamp: fingerprint.timestamp,
          },
          risk_score: riskAssessment.score,
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
        setLoading(false);
        return;
      }

      // Success - record and create session
      recordPinAttempt(true);
      
      if (data.shift) {
        setShiftInfo(data.shift);
      }

      // Update risk assessment with server data
      if (data.risk_assessment) {
        riskAssessment.score = data.risk_assessment.score;
        riskAssessment.factors = data.risk_assessment.factors;
        riskAssessment.requiredAuth = data.risk_assessment.requiredAuth;
      }

      // Create session with v2 system using terminal config
      const terminalDevice = {
        id: terminal.terminal_id,
        terminal_id: terminal.terminal_id,
        tenant_id: terminal.tenant_id,
        role: terminal.role as any,
        fingerprint_hash: null,
        fingerprint_salt: '',
        status: 'active' as const,
        bound_at: null,
        last_seen_at: new Date(),
        last_fingerprint_check: new Date(),
        drift_score: 0,
        location_id: terminal.location_id || 'LOC01',
        device_name: terminal.device_name || terminal.terminal_id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const session = createSession(
        terminalDevice,
        data.employee,
        fingerprint,
        riskAssessment.score
      );

      onLogin(session, riskAssessment);
    } catch (err) {
      setError('Error de conexión. Verifica tu internet.');
      console.error('Login error:', err);
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

        {/* Risk Level Indicator */}
        {riskLevel && (
          <div className={`mb-4 p-3 rounded-lg border ${
            riskLevel === 'low' ? 'bg-emerald-500/10 border-emerald-500/30' :
            riskLevel === 'medium' ? 'bg-amber-500/10 border-amber-500/30' :
            'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {riskLevel === 'low' ? '🟢' : riskLevel === 'medium' ? '🟡' : '🔴'}
              </span>
              <span className={`text-sm font-medium ${
                riskLevel === 'low' ? 'text-emerald-400' :
                riskLevel === 'medium' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                Nivel de seguridad: {riskLevel === 'low' ? 'Normal' : riskLevel === 'medium' ? 'Medio' : 'Alto'}
              </span>
            </div>
            {riskLevel !== 'low' && (
              <p className="text-xs text-zinc-400 mt-1">
                {riskLevel === 'medium' 
                  ? 'Puede requerir confirmación adicional'
                  : 'Se requiere verificación de manager'}
              </p>
            )}
          </div>
        )}

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
