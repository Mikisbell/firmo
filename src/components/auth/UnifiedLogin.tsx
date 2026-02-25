'use client';

/**
 * UnifiedLogin - Single login for ALL roles
 * DNI (8 digits) → PIN (4-6 digits) → auto-route by role
 *
 * ADMIN / OWNER / MANAGER → /admin
 * CASHIER → /pos
 * WAITER  → /mozo
 * KITCHEN → /cocina
 * BAR     → /bar
 * DRIVER  → /delivery
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PinPad from './PinPad';
import { ParkLogo } from '@/src/components/icons';
import { ChevronLeft, AlertTriangle, WifiOff, Settings } from 'lucide-react';
import { safeStorage } from '@/src/lib/storage';
import { setStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import { v4 as uuidv4 } from 'uuid';
import type { TerminalRole } from '@/src/core/auth/types';

const FALLBACK_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SESSION_STORAGE_KEY = 'park_session_v2';
const ALL_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'BAR', 'DRIVER'];

type Phase = 'dni' | 'pin';

function getRouteForRole(role: string): string {
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
    case 'MANAGER': return '/admin';
    case 'CASHIER': return '/pos';
    case 'WAITER':  return '/mozo';
    case 'KITCHEN': return '/cocina';
    case 'BAR':     return '/bar';
    case 'DRIVER':  return '/delivery';
    default:        return '/';
  }
}

function mapToTerminalRole(role: string): TerminalRole {
  switch (role) {
    case 'CASHIER': return 'CASHIER';
    case 'KITCHEN': return 'KDS';
    case 'BAR':     return 'BAR';
    default:        return 'WAITER';
  }
}

function mapToTerminalRoleStr(role: string): string {
  switch (role) {
    case 'WAITER':  return 'MOZO';
    case 'KITCHEN': return 'KDS_COCINA';
    case 'BAR':     return 'KDS_BAR';
    case 'CASHIER': return 'CAJA';
    default:        return 'MOZO';
  }
}

function maskDni(dni: string): string {
  if (dni.length <= 3) return '•'.repeat(dni.length);
  return `${dni.slice(0, 2)}${'•'.repeat(dni.length - 3)}${dni.slice(-1)}`;
}

interface UnifiedLoginProps {
  onCajaSetup: () => void;
}

export function UnifiedLogin({ onCajaSetup }: UnifiedLoginProps) {
  const [phase, setPhase] = useState<Phase>('dni');
  const [dni, setDni] = useState('');
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'auth' | 'network'>('auth');
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);

  const handleDniSubmit = useCallback((enteredDni: string) => {
    setDni(enteredDni);
    setError('');
    setPhase('pin');
  }, []);

  const handlePinSubmit = useCallback(async (pin: string) => {
    if (lockoutUntil && lockoutUntil > new Date()) return;
    setError('');
    setLoading(true);

    try {
      const tenantId =
        typeof window !== 'undefined'
          ? safeStorage.getItem('tenant_id') || FALLBACK_TENANT_ID
          : FALLBACK_TENANT_ID;

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, pin, allowedRoles: ALL_ROLES, tenant_id: tenantId }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errorCode === 'ACCOUNT_LOCKED' && data.lockoutUntil) {
          setLockoutUntil(new Date(data.lockoutUntil));
        }
        setErrorType(response.status >= 500 ? 'network' : 'auth');
        setError(data.error || 'DNI o PIN incorrecto');
        return;
      }

      const employee = data.employee as { id: string; name: string; role: string };
      const route = getRouteForRole(employee.role);

      // For admin roles the cookie is enough — just navigate
      if (['ADMIN', 'OWNER', 'MANAGER'].includes(employee.role)) {
        window.location.href = route;
        return;
      }

      // For operational roles: store TerminalConfig + SecureSession
      const terminalId = `COLAB_${employee.id.slice(0, 8)}`;
      setStoredTerminalConfig({
        terminal_id: terminalId,
        tenant_id: tenantId,
        actor_id: employee.id,
        device_fingerprint: '',
        device_name: employee.name,
        role: mapToTerminalRole(employee.role),
        location_id: 'LOC01',
        is_allowed: true,
        registered_at: new Date().toISOString(),
      });

      const now = new Date();
      const session = {
        id: uuidv4(),
        terminal_id: terminalId,
        employee_id: employee.id,
        employee_name: employee.name,
        employee_role: employee.role,
        terminal_role: mapToTerminalRoleStr(employee.role),
        fingerprint_at_login: '',
        fingerprint_signals_at_login: '{}',
        risk_score_at_login: 0,
        created_at: now.toISOString(),
        last_activity_at: now.toISOString(),
        last_fingerprint_check: now.toISOString(),
        expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

      window.location.href = route;
    } catch {
      setErrorType('network');
      setError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  }, [dni, lockoutUntil]);

  const handleBackToDni = useCallback(() => {
    setPhase('dni');
    setDni('');
    setError('');
    setLockoutUntil(null);
  }, []);

  const isLockedOut = lockoutUntil && lockoutUntil > new Date();

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-zinc-950 to-zinc-950" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center relative z-10"
      >
        <motion.div
          className="inline-block relative mb-4"
          animate={{
            filter: [
              'drop-shadow(0 0 12px rgba(16,185,129,0.25))',
              'drop-shadow(0 0 24px rgba(16,185,129,0.45))',
              'drop-shadow(0 0 12px rgba(16,185,129,0.25))',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full scale-150" />
          <ParkLogo size={64} className="relative z-10" />
        </motion.div>
        <h1 className="text-3xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            PARK
          </span>
          <span className="text-white ml-2">POS</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Sistema de Punto de Venta</p>
      </motion.div>

      {/* Card */}
      <div className="w-full max-w-sm relative z-10">
        <AnimatePresence mode="wait">
          {phase === 'dni' ? (
            <motion.div
              key="dni"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">Bienvenido</h2>
                <p className="text-zinc-500 text-sm mt-1">Ingresa tu DNI para continuar</p>
              </div>

              <div className="relative">
                <div className="absolute -inset-[1px] bg-gradient-to-br from-emerald-600/40 to-teal-600/40 rounded-2xl" />
                <div className="relative bg-zinc-900 rounded-2xl p-6">
                  <PinPad
                    onSubmit={handleDniSubmit}
                    disabled={false}
                    maxLength={8}
                    minLength={8}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              {/* DNI chip + back */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <button
                  onClick={handleBackToDni}
                  className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Cambiar
                </button>
                <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs text-emerald-400 font-mono tracking-widest">
                    DNI {maskDni(dni)}
                  </span>
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">Ingresa tu PIN</h2>
                <p className="text-zinc-500 text-sm mt-1">4 a 6 dígitos</p>
              </div>

              <div className="relative">
                <div className="absolute -inset-[1px] bg-gradient-to-br from-emerald-600/40 to-teal-600/40 rounded-2xl" />
                <div className="relative bg-zinc-900 rounded-2xl p-6">
                  {/* Lockout */}
                  {isLockedOut && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-xs text-red-400">Cuenta bloqueada temporalmente</p>
                    </motion.div>
                  )}

                  {/* Network error */}
                  {error && errorType === 'network' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3"
                    >
                      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-400">{error}</p>
                    </motion.div>
                  )}

                  <PinPad
                    onSubmit={handlePinSubmit}
                    disabled={loading || !!isLockedOut}
                    error={errorType === 'auth' ? error : ''}
                  />

                  {loading && (
                    <div className="mt-5 flex justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Terminal fijo link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        onClick={onCajaSetup}
        className="mt-10 flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors relative z-10"
      >
        <Settings className="w-3.5 h-3.5" />
        Configurar terminal fijo
      </motion.button>

      <p className="mt-4 text-xs text-zinc-700 relative z-10">PARK POS v2.1.1</p>
    </div>
  );
}
