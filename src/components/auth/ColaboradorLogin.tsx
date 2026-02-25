'use client';

/**
 * ColaboradorLogin - PIN login for all non-cashier employees
 * On success: creates synthetic TerminalConfig + SecureSession, then routes by role
 * WAITER → /mozo | KITCHEN → /cocina | BAR → /bar | CASHIER → /pos | DRIVER → /delivery
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import PinPad from './PinPad';
import { ParkLogo } from '@/src/components/icons';
import { Users, ArrowLeft, AlertTriangle, WifiOff } from 'lucide-react';
import { safeStorage } from '@/src/lib/storage';
import { setStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import { v4 as uuidv4 } from 'uuid';
import type { TerminalRole } from '@/src/core/auth/types';

const FALLBACK_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SESSION_STORAGE_KEY = 'park_session_v2';
const COLLAB_ROLES = ['WAITER', 'KITCHEN', 'BAR', 'CASHIER', 'DRIVER'];

function getRouteForRole(role: string): string {
  switch (role) {
    case 'WAITER':  return '/mozo';
    case 'KITCHEN': return '/cocina';
    case 'BAR':     return '/bar';
    case 'CASHIER': return '/pos';
    case 'DRIVER':  return '/delivery';
    default:        return '/';
  }
}

function mapToTerminalRole(employeeRole: string): string {
  switch (employeeRole) {
    case 'WAITER':  return 'MOZO';
    case 'KITCHEN': return 'KDS_COCINA';
    case 'BAR':     return 'KDS_BAR';
    case 'CASHIER': return 'CAJA';
    default:        return 'MOZO';
  }
}

function mapToTerminalConfigRole(employeeRole: string): TerminalRole {
  switch (employeeRole) {
    case 'WAITER':  return 'WAITER';
    case 'KITCHEN': return 'KDS';
    case 'BAR':     return 'BAR';
    case 'CASHIER': return 'CASHIER';
    default:        return 'WAITER';
  }
}

interface ColaboradorLoginProps {
  onBack: () => void;
}

export function ColaboradorLogin({ onBack }: ColaboradorLoginProps) {
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'pin' | 'network'>('pin');
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!lockoutUntil) return;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        setLockoutUntil(null);
        setError('');
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handlePinSubmit = useCallback(async (pin: string) => {
    if (lockoutUntil && lockoutUntil > new Date()) return;
    setError('');
    setErrorType('pin');
    setLoading(true);

    try {
      const tenantId =
        typeof window !== 'undefined'
          ? safeStorage.getItem('tenant_id') || FALLBACK_TENANT_ID
          : FALLBACK_TENANT_ID;

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, allowedRoles: COLLAB_ROLES, tenant_id: tenantId }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errorCode === 'ACCOUNT_LOCKED' && data.lockoutUntil) {
          setLockoutUntil(new Date(data.lockoutUntil));
          setErrorType('pin');
        } else if (response.status === 500) {
          setErrorType('network');
        } else {
          setErrorType('pin');
        }
        setError(data.error || 'PIN inválido');
        return;
      }

      const employee = data.employee as { id: string; name: string; role: string };
      const terminalId = `COLAB_${employee.id.slice(0, 8)}`;

      // Store synthetic TerminalConfig in localStorage
      setStoredTerminalConfig({
        terminal_id: terminalId,
        tenant_id: tenantId,
        actor_id: employee.id,
        device_fingerprint: '',
        device_name: employee.name,
        role: mapToTerminalConfigRole(employee.role),
        location_id: 'LOC01',
        is_allowed: true,
        registered_at: new Date().toISOString(),
      });

      // Store synthetic SecureSession in sessionStorage (8h expiry = full shift)
      const now = new Date();
      const session = {
        id: uuidv4(),
        terminal_id: terminalId,
        employee_id: employee.id,
        employee_name: employee.name,
        employee_role: employee.role,
        terminal_role: mapToTerminalRole(employee.role),
        fingerprint_at_login: '',
        fingerprint_signals_at_login: '{}',
        risk_score_at_login: 0,
        created_at: now.toISOString(),
        last_activity_at: now.toISOString(),
        last_fingerprint_check: now.toISOString(),
        expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

      // Navigate to role-specific route
      window.location.href = getRouteForRole(employee.role);
    } catch {
      setErrorType('network');
      setError('Sin conexión al servidor. Verifica tu internet.');
    } finally {
      setLoading(false);
    }
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil && lockoutUntil > new Date();

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/40 via-zinc-950 to-zinc-950" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-2xl sticky top-0 z-40 relative"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-purple-500/5" />
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3 relative">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-zinc-800/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </motion.button>

          <motion.div
            className="relative"
            animate={{
              filter: [
                'drop-shadow(0 0 10px rgba(139, 92, 246, 0.3))',
                'drop-shadow(0 0 20px rgba(139, 92, 246, 0.5))',
                'drop-shadow(0 0 10px rgba(139, 92, 246, 0.3))',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="absolute inset-0 bg-violet-500/30 blur-2xl rounded-full scale-150" />
            <ParkLogo size={48} className="relative z-10" />
          </motion.div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                PARK
              </span>
              <span className="text-white ml-1">POS</span>
            </h1>
            <p className="text-xs text-zinc-500">Acceso Colaborador</p>
          </div>
        </div>
      </motion.header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          {/* Icon + Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.8 }}
              className="inline-block mb-4"
            >
              <div className="relative">
                <div className="absolute -inset-3 bg-violet-500/20 blur-2xl rounded-full" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Users className="w-8 h-8 text-white" />
                </div>
              </div>
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-1">Acceso Colaborador</h2>
            <p className="text-sm text-zinc-500">Ingresa tu PIN para continuar</p>
          </div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 rounded-3xl blur-lg opacity-20" />
            <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8">

              {/* Lockout warning */}
              {isLockedOut && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Cuenta bloqueada</p>
                    <p className="text-xs text-red-400/70">
                      Intenta en {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Network error banner */}
              {error && errorType === 'network' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3"
                >
                  <WifiOff className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-400">{error}</p>
                </motion.div>
              )}

              <PinPad
                onSubmit={handlePinSubmit}
                disabled={loading || !!isLockedOut}
                error={errorType === 'pin' ? error : ''}
              />

              {loading && (
                <div className="mt-6 flex justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 border-[3px] border-violet-500/30 border-t-violet-500 rounded-full"
                  />
                </div>
              )}
            </div>
          </motion.div>

          <p className="text-center text-xs text-zinc-600 mt-6">
            Mesero · Cocina · Bar · Caja · Delivery
          </p>
        </motion.div>
      </main>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="py-4 text-center relative z-10"
      >
        <p className="text-xs text-zinc-600">PARK POS v2.1.1</p>
      </motion.footer>
    </div>
  );
}
