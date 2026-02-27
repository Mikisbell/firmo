'use client';

// PIN Modal for inventory operations
// Validates employee PIN and role before allowing access
// Uses JWT-based authentication with lockout protection
// Token is stored in httpOnly cookie for security

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import PinPad from '@/src/components/auth/PinPad';
import { X, Lock, AlertTriangle } from 'lucide-react';
import { safeStorage } from '@/src/lib/storage';

export type InventoryRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'KITCHEN';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (employee: { id: string; name: string; role: string }) => void;
  allowedRoles: InventoryRole[];
  title?: string;
}

export function PinModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  allowedRoles,
  title = 'Ingrese PIN'
}: PinModalProps) {
  const router = useRouter();
  const [error, setError] = useState('');
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

  const handlePinSubmit = useCallback(async (pin: string) => {
    if (lockoutUntil && lockoutUntil > new Date()) {
      return; // Still locked out
    }

    // Log submission (never log PIN value)
    console.log('[PinModal] Submitting PIN (length:', pin.length, ')');

    setError('');
    setLoading(true);

    try {
      // Get tenant_id from localStorage (for multi-tenant E2E tests)
      const tenantId = typeof window !== 'undefined' ? safeStorage.getItem('tenant_id') : null;
      const requestBody = {
        pin,
        allowedRoles,
        ...(tenantId && { tenant_id: tenantId })
      };

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        credentials: 'include', // Important: include cookies
      });

      console.log('[PinModal] Response received:');
      console.log('  Status:', response.status);
      console.log('  OK:', response.ok);
      console.log('  Headers:', {
        contentType: response.headers.get('content-type'),
        setCookie: response.headers.get('set-cookie'),
      });

      const data = await response.json();
      console.log('[PinModal] Response data:', data);

      if (!response.ok) {
        // Handle lockout
        if (data.errorCode === 'ACCOUNT_LOCKED' && data.lockoutUntil) {
          setLockoutUntil(new Date(data.lockoutUntil));
        }
        console.log('[PinModal] Authentication failed:', data.error);
        setError(data.error || 'PIN inválido');
        return;
      }

      // Token is now in httpOnly cookie, just notify success with employee data
      console.log('[PinModal] Authentication successful!');
      console.log('  Employee:', data.employee);
      console.log('[PinModal] Calling onSuccess()...');
      onSuccess(data.employee);
      console.log('[PinModal] onSuccess() completed');
      
      // Redirigir a dashboard después de login exitoso
      console.log('[PinModal] Redirecting to /admin/dashboard...');
      router.push('/admin/dashboard');
    } catch (err) {
      console.error('[PinModal] Error:', err);
      setError('Error de conexión');
      console.error('PIN verification error:', err);
    } finally {
      setLoading(false);
    }
  }, [allowedRoles, lockoutUntil, onSuccess]);

  if (!isOpen) return null;

  const isLockedOut = lockoutUntil && lockoutUntil > new Date();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 max-w-sm w-full"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isLockedOut ? 'bg-red-500/20' : 'bg-amber-500/20'
              }`}>
                {isLockedOut ? (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                ) : (
                  <Lock className="w-5 h-5 text-amber-400" />
                )}
              </div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Lockout warning */}
          {isLockedOut && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400 text-center">
                Cuenta bloqueada. Intenta en {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </p>
            </div>
          )}

          {/* Roles permitidos */}
          <div className="mb-4 text-center">
            <p className="text-sm text-zinc-500">
              Roles permitidos: {allowedRoles.join(', ')}
            </p>
          </div>

          {/* PIN Pad */}
          <PinPad
            onSubmit={handlePinSubmit}
            disabled={loading || !!isLockedOut}
            error={error}
          />

          {/* Loading indicator */}
          {loading && (
            <div className="mt-4 text-center">
              <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
