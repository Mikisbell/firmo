'use client';

/**
 * SupervisorOverrideModal Component
 * 
 * Reusable modal for requesting Admin/Supervisor authorization for sensitive
 * operations (item voids, discounts, price changes, shift closures).
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Lock, X, CheckCircle2 } from 'lucide-react';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

interface SupervisorOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorized: (supervisorInfo: { id: string; name: string; role: string }) => void;
  title?: string;
  reason?: string;
}

export function SupervisorOverrideModal({
  isOpen,
  onClose,
  onAuthorized,
  title = 'Autorización de Supervisor Requerida',
  reason = 'Esta acción requiere confirmación de un Administrador o Gerente.',
}: SupervisorOverrideModalProps) {
  const [dni, setDni] = useState('');
  const [pin, setPin] = useState('');
  const [phase, setPhase] = useState<'dni' | 'pin'>('dni');
  const [supervisorName, setSupervisorName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetModal = useCallback(() => {
    setDni('');
    setPin('');
    setPhase('dni');
    setSupervisorName('');
    setError('');
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetModal();
    onClose();
  }, [onClose, resetModal]);

  const handleVerifyDni = useCallback(async () => {
    if (dni.length !== 8) {
      setError('El DNI debe tener 8 dígitos');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/check-dni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni }),
      });
      const data = await res.json();
      setLoading(false);

      if (!data.exists) {
        setError('DNI no encontrado');
        return;
      }

      setSupervisorName(data.name || 'Supervisor');
      setPhase('pin');
    } catch {
      setLoading(false);
      setPhase('pin');
    }
  }, [dni]);

  const handleVerifyPin = useCallback(async () => {
    if (pin.length < 4) {
      setError('La contraseña debe tener al menos 4 dígitos');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, pin, allowedRoles: ADMIN_ROLES }),
        credentials: 'include',
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || 'Credenciales o permisos insuficientes');
        return;
      }

      const emp = data.employee;
      if (!(ADMIN_ROLES as readonly string[]).includes(emp.role)) {
        setError('El usuario no posee rol de Supervisor o Administrador');
        return;
      }

      onAuthorized(emp);
      resetModal();
    } catch {
      setLoading(false);
      setError('Error de comunicación con el servidor');
    }
  }, [dni, pin, onAuthorized, resetModal]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl p-6 relative overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 text-zinc-500 hover:text-white p-2 rounded-xl bg-zinc-800/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white font-black text-lg">{title}</h3>
            <p className="text-zinc-400 text-xs">{reason}</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/30 text-red-400 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {/* Phase 1: DNI Input */}
        {phase === 'dni' ? (
          <div className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs font-semibold block mb-1">DNI del Supervisor</label>
              <input
                type="text"
                maxLength={8}
                value={dni}
                onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
                placeholder="Ingrese 8 dígitos de DNI"
                className="w-full h-14 bg-zinc-950 border border-white/10 rounded-2xl px-4 text-white text-lg font-mono focus:outline-none focus:border-amber-500 transition-colors"
                autoFocus
              />
            </div>

            <button
              onClick={handleVerifyDni}
              disabled={loading || dni.length !== 8}
              className="w-full h-14 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-black text-sm rounded-2xl transition-all disabled:opacity-40"
            >
              {loading ? 'Verificando...' : 'Siguiente'}
            </button>
          </div>
        ) : (
          /* Phase 2: PIN Input */
          <div className="space-y-4">
            <div className="bg-zinc-950 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
              <span className="text-zinc-400 text-xs">Supervisor: <strong className="text-white">{supervisorName}</strong></span>
              <button
                onClick={() => setPhase('dni')}
                className="text-amber-400 text-xs font-mono underline"
              >
                Cambiar DNI
              </button>
            </div>

            <div>
              <label className="text-zinc-400 text-xs font-semibold block mb-1">Clave Secreta de Supervisor</label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN de 4 a 6 dígitos"
                className="w-full h-14 bg-zinc-950 border border-white/10 rounded-2xl px-4 text-white text-xl font-mono text-center tracking-widest focus:outline-none focus:border-amber-500 transition-colors"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 h-14 bg-zinc-800 text-zinc-400 font-bold text-sm rounded-2xl hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleVerifyPin}
                disabled={loading || pin.length < 4}
                className="flex-1 h-14 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-black text-sm rounded-2xl transition-all disabled:opacity-40"
              >
                {loading ? 'Autorizando...' : 'Autorizar'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
