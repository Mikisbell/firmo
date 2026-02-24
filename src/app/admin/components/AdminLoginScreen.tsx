'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import PinPad from '@/src/components/auth/PinPad';
import { ParkLogo } from '@/src/components/icons';
import { Shield, ArrowLeft, AlertTriangle, Sparkles, WifiOff } from 'lucide-react';
import { safeStorage } from '@/src/lib/storage';

interface AdminLoginScreenProps {
  onSuccess: (employee: { id: string; name: string; role: string }) => void;
  onBack?: () => void;
}

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${
            i % 3 === 0
              ? 'w-2 h-2 bg-emerald-500/20'
              : i % 3 === 1
                ? 'w-1.5 h-1.5 bg-teal-500/25'
                : 'w-1 h-1 bg-cyan-500/30'
          }`}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -80 - Math.random() * 80],
            x: [0, (Math.random() - 0.5) * 40],
            opacity: [0, 0.7, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 5 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 4,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(16, 185, 129, 0.5) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(16, 185, 129, 0.5) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
}

export default function AdminLoginScreen({ onSuccess, onBack }: AdminLoginScreenProps) {
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'pin' | 'server' | 'network'>('pin');
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for lockout
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

  const handlePinSubmit = useCallback(
    async (pin: string) => {
      if (lockoutUntil && lockoutUntil > new Date()) return;

      setError('');
      setErrorType('pin');
      setLoading(true);

      try {
        const tenantId = typeof window !== 'undefined' ? safeStorage.getItem('tenant_id') : null;

        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin,
            allowedRoles: ALLOWED_ROLES,
            ...(tenantId && { tenant_id: tenantId }),
          }),
          credentials: 'include',
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.errorCode === 'ACCOUNT_LOCKED' && data.lockoutUntil) {
            setLockoutUntil(new Date(data.lockoutUntil));
            setErrorType('pin');
          } else if (data.errorCode === 'SERVER_ERROR' || response.status === 500) {
            setErrorType('server');
          } else {
            setErrorType('pin');
          }
          setError(data.error || 'PIN inv\u00e1lido');
          return;
        }

        onSuccess(data.employee);
      } catch {
        setErrorType('network');
        setError('Sin conexi\u00f3n al servidor. Verifica tu internet e intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    },
    [lockoutUntil, onSuccess],
  );

  const isLockedOut = lockoutUntil && lockoutUntil > new Date();

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-zinc-950 to-zinc-950" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      <GridBackground />
      <FloatingParticles />

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-2xl sticky top-0 z-40 relative"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5" />
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            {onBack && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={onBack}
                className="p-2 -ml-2 rounded-xl hover:bg-zinc-800/50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-400" />
              </motion.button>
            )}

            <motion.div
              className="relative"
              animate={{
                filter: [
                  'drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))',
                  'drop-shadow(0 0 20px rgba(16, 185, 129, 0.5))',
                  'drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
              <ParkLogo size={48} className="relative z-10" />
            </motion.div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  PARK
                </span>
                <span className="text-white ml-1">POS</span>
              </h1>
              <p className="text-xs text-zinc-500">Panel de Administraci&oacute;n</p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
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
                <div className="absolute -inset-3 bg-emerald-500/20 blur-2xl rounded-full" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Shield className="w-8 h-8 text-white" />
                </div>
              </div>
            </motion.div>

            <h2 className="text-2xl font-bold text-white mb-1">Acceso Administrativo</h2>
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              <p className="text-sm text-zinc-500">Ingresa tu PIN de 4 d&iacute;gitos</p>
              <Sparkles className="w-3 h-3 text-emerald-500" />
            </div>
          </div>

          {/* Glass card with PinPad */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl blur-lg opacity-20" />
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
                      Intenta en {Math.floor(countdown / 60)}:
                      {String(countdown % 60).padStart(2, '0')}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Server/network error banner (separate from PIN error) */}
              {error && (errorType === 'server' || errorType === 'network') && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3"
                >
                  <WifiOff className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-400">
                      {errorType === 'network' ? 'Sin conexión' : 'Error del servidor'}
                    </p>
                    <p className="text-xs text-amber-400/70">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Roles info */}
              <div className="mb-6 text-center">
                <p className="text-xs text-zinc-600">
                  Owner &bull; Admin &bull; Manager
                </p>
              </div>

              {/* PinPad */}
              <PinPad
                onSubmit={handlePinSubmit}
                disabled={loading || !!isLockedOut}
                error={errorType === 'pin' ? error : ''}
              />

              {/* Loading indicator */}
              {loading && (
                <div className="mt-6 flex justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="py-4 text-center relative z-10"
      >
        <p className="text-xs text-zinc-600">
          <span className="bg-gradient-to-r from-zinc-600 to-zinc-500 bg-clip-text text-transparent">
            PARK POS
          </span>
          <span className="mx-2 text-zinc-700">&bull;</span>
          <span className="text-zinc-600">v2.1.1</span>
          <span className="mx-2 text-zinc-700">&bull;</span>
          <span className="text-zinc-600">Sistema de Punto de Venta</span>
        </p>
      </motion.footer>
    </div>
  );
}
