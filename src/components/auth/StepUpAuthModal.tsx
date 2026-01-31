'use client';

/**
 * Step-Up Authentication Modal
 * 
 * Shown when additional authentication is required due to:
 * - Fingerprint drift > 30%
 * - High risk score
 * - Device changes
 * 
 * Requirements: 4.2 (PIN + manager confirmation)
 */

import { useState } from 'react';
import type { SecureSession } from '@/src/core/auth/session-v2';

interface StepUpAuthModalProps {
  session: SecureSession;
  reason: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function StepUpAuthModal({ session, reason, onComplete, onCancel }: StepUpAuthModalProps) {
  const [managerPin, setManagerPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (managerPin.length !== 4) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }

    setIsVerifying(true);

    try {
      // Verify manager PIN
      const response = await fetch('/api/auth/verify-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: managerPin,
          terminal_id: session.terminal_id,
          employee_id: session.employee_id,
          reason: 'step_up_auth',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al verificar PIN de manager');
        setIsVerifying(false);
        return;
      }

      if (data.verified) {
        // Manager verification successful
        onComplete();
      } else {
        setError('PIN de manager incorrecto');
        setIsVerifying(false);
      }
    } catch (err) {
      console.error('Error verifying manager PIN:', err);
      setError('Error de conexión. Intenta nuevamente.');
      setIsVerifying(false);
    }
  };

  const handlePinInput = (value: string) => {
    // Only allow digits
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setManagerPin(digits);
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg shadow-2xl max-w-md w-full border border-zinc-800">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Verificación Adicional Requerida</h2>
              <p className="text-sm text-zinc-400 mt-1">Autenticación de seguridad</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Reason */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-amber-200 text-sm leading-relaxed">
              {reason}
            </p>
          </div>

          {/* Session Info */}
          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Usuario:</span>
              <span className="text-white font-medium">{session.employee_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Terminal:</span>
              <span className="text-white font-medium">{session.terminal_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Nivel de riesgo:</span>
              <span className="text-amber-400 font-medium">
                {session.risk_score_at_login < 30 ? 'Bajo' : 
                 session.risk_score_at_login < 70 ? 'Medio' : 'Alto'}
              </span>
            </div>
          </div>

          {/* Manager PIN Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              PIN de Manager
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={managerPin}
              onChange={(e) => handlePinInput(e.target.value)}
              placeholder="••••"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              maxLength={4}
              autoFocus
              disabled={isVerifying}
            />
            <p className="text-xs text-zinc-500 mt-2">
              Solicita a un manager que ingrese su PIN de 4 dígitos
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isVerifying}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={managerPin.length !== 4 || isVerifying}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </>
              ) : (
                'Verificar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
