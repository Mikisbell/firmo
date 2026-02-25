'use client';

/**
 * UnifiedLogin — Professional POS login screen
 * DNI (8 digits) → PIN (4-6 digits) → auto-route by role
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ParkLogo } from '@/src/components/icons';
import { TenantLogo } from '@/src/components/branding/TenantLogo';
import { Delete, Settings, ChevronLeft } from 'lucide-react';
import { safeStorage } from '@/src/lib/storage';
import { setStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import { v4 as uuidv4 } from 'uuid';
import type { TerminalRole } from '@/src/core/auth/types';

interface TenantBranding {
  legal_name: string;
  logo_url: string | null;
  address_text: string | null;
}

const FALLBACK_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SESSION_STORAGE_KEY = 'park_session_v2';
const ALL_ROLES = [
  'OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR',
  'CASHIER', 'WAITER', 'KITCHEN', 'COOK', 'PACKER', 'BAR',
  'DRIVER', 'DELIVERY',
];

type Phase = 'dni' | 'checking_dni' | 'pin';

function getRouteForRole(role: string): string {
  switch (role) {
    case 'OWNER': case 'ADMIN': case 'MANAGER': case 'SUPERVISOR': return '/admin';
    case 'CASHIER':  return '/pos';
    case 'WAITER':   return '/mozo';
    case 'KITCHEN': case 'COOK': case 'PACKER': return '/cocina';
    case 'BAR':      return '/bar';
    case 'DRIVER': case 'DELIVERY': return '/delivery';
    default:         return '/';
  }
}

function mapToTerminalRole(role: string): TerminalRole {
  switch (role) {
    case 'CASHIER':  return 'CASHIER';
    case 'KITCHEN': case 'COOK': case 'PACKER': return 'KDS';
    case 'BAR':      return 'BAR';
    default:         return 'WAITER';
  }
}

function mapToTerminalRoleStr(role: string): string {
  switch (role) {
    case 'WAITER':   return 'MOZO';
    case 'KITCHEN': case 'COOK': case 'PACKER': return 'KDS_COCINA';
    case 'BAR':      return 'KDS_BAR';
    case 'CASHIER':  return 'CAJA';
    case 'DRIVER': case 'DELIVERY': return 'MOZO'; // no hay terminal específico de delivery
    default:         return 'MOZO';
  }
}

function maskDni(dni: string): string {
  if (dni.length <= 4) return '•'.repeat(dni.length);
  return `${dni.slice(0, 2)}${'•'.repeat(dni.length - 4)}${dni.slice(-2)}`;
}

// ── Custom Numpad ────────────────────────────────────────────────────────────
interface NumpadProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (currentValue: string) => void;
  maxLength: number;
  minLength: number;
  disabled?: boolean;
  error?: string;
  label: string;
  sublabel?: string;
}

function Numpad({ value, onChange, onSubmit, maxLength, minLength, disabled, error, label, sublabel }: NumpadProps) {
  const handleDigit = useCallback((d: string) => {
    if (disabled || value.length >= maxLength) return;
    const next = value + d;
    onChange(next);
    // Auto-submit passing the fresh value directly — avoids stale closure
    if (next.length === maxLength) {
      onSubmit(next);
    }
  }, [value, maxLength, onChange, onSubmit, disabled]);

  const handleBack = useCallback(() => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }, [value, onChange, disabled]);

  const handleClear = useCallback(() => {
    if (disabled) return;
    onChange('');
  }, [onChange, disabled]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace') handleBack();
      else if (e.key === 'Enter' && value.length >= minLength) onSubmit(value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDigit, handleBack, value, minLength, onSubmit, disabled]);

  const dots = Array.from({ length: maxLength });
  const canSubmit = value.length >= minLength;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Label */}
      <p className="text-zinc-400 text-sm font-medium mb-1">{label}</p>
      {sublabel && <p className="text-zinc-600 text-xs mb-5">{sublabel}</p>}

      {/* Dots display */}
      <div className="flex items-center justify-center gap-3 mb-6 h-8">
        {dots.map((_, i) => {
          const filled = i < value.length;
          const required = i < minLength;
          return (
            <motion.div
              key={i}
              animate={filled ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.15 }}
              className={[
                'rounded-full transition-all duration-200',
                filled
                  ? 'w-4 h-4 bg-white'
                  : required
                    ? 'w-3 h-3 bg-zinc-700'
                    : 'w-2.5 h-2.5 bg-zinc-800',
              ].join(' ')}
            />
          );
        })}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-red-400 text-sm mb-4 text-center"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Numpad grid */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button
            key={d}
            onPointerDown={e => { e.preventDefault(); handleDigit(d); }}
            disabled={disabled}
            className="h-16 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 active:scale-95 text-white text-2xl font-semibold transition-all select-none touch-manipulation disabled:opacity-40"
          >
            {d}
          </button>
        ))}

        {/* Clear */}
        <button
          onPointerDown={e => { e.preventDefault(); handleClear(); }}
          disabled={disabled || value.length === 0}
          className="h-16 rounded-2xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 text-zinc-500 text-xs font-medium transition-all select-none touch-manipulation disabled:opacity-30"
        >
          Limpiar
        </button>

        {/* 0 */}
        <button
          onPointerDown={e => { e.preventDefault(); handleDigit('0'); }}
          disabled={disabled}
          className="h-16 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 active:scale-95 text-white text-2xl font-semibold transition-all select-none touch-manipulation disabled:opacity-40"
        >
          0
        </button>

        {/* Backspace */}
        <button
          onPointerDown={e => { e.preventDefault(); handleBack(); }}
          disabled={disabled || value.length === 0}
          className="h-16 rounded-2xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 text-zinc-400 transition-all flex items-center justify-center select-none touch-manipulation disabled:opacity-30"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {/* Confirm button — only when minLength ≤ value < maxLength */}
      <AnimatePresence>
        {canSubmit && value.length < maxLength && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onPointerDown={e => { e.preventDefault(); onSubmit(value); }}
            disabled={disabled}
            className="mt-4 w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-[0.98] text-white font-semibold text-base transition-all select-none touch-manipulation disabled:opacity-40"
          >
            Confirmar
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
interface UnifiedLoginProps {
  onCajaSetup: () => void;
}

export function UnifiedLogin({ onCajaSetup }: UnifiedLoginProps) {
  const [phase, setPhase] = useState<Phase>('dni');
  const [dniValue, setDniValue] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockout, setLockout] = useState<Date | null>(null);
  const [tenant, setTenant] = useState<TenantBranding | null>(null);

  useEffect(() => {
    fetch('/api/tenant/public')
      .then(r => r.json())
      .then(setTenant)
      .catch(() => {});
  }, []);

  const submitDni = useCallback(async (currentValue: string) => {
    if (currentValue.length !== 8) return;
    setError('');
    setPhase('checking_dni');

    try {
      const tenantId =
        typeof window !== 'undefined'
          ? safeStorage.getItem('tenant_id') || FALLBACK_TENANT_ID
          : FALLBACK_TENANT_ID;

      const res = await fetch('/api/auth/check-dni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: currentValue, tenant_id: tenantId }),
      });
      const data = await res.json();

      if (!data.exists) {
        setError('DNI no registrado en el sistema');
        setPhase('dni');
        return;
      }

      setEmployeeName(data.name || '');
      setPinValue('');
      setPhase('pin');
    } catch {
      // On network error, still proceed to PIN (auth will fail properly)
      setPinValue('');
      setPhase('pin');
    }
  }, []);

  const submitPin = useCallback(async (currentValue: string) => {
    if (lockout && lockout > new Date()) return;
    if (currentValue.length < 4) return;
    setError('');
    setLoading(true);

    try {
      const tenantId =
        typeof window !== 'undefined'
          ? safeStorage.getItem('tenant_id') || FALLBACK_TENANT_ID
          : FALLBACK_TENANT_ID;

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: dniValue, pin: currentValue, allowedRoles: ALL_ROLES, tenant_id: tenantId }),
        credentials: 'include',
      });

      const data = await res.json();
      setPinValue('');

      if (!res.ok) {
        if (data.errorCode === 'ACCOUNT_LOCKED' && data.lockoutUntil) {
          setLockout(new Date(data.lockoutUntil));
        }
        setError(data.error || 'DNI o PIN incorrecto');
        return;
      }

      const emp = data.employee as { id: string; name: string; role: string };
      const route = getRouteForRole(emp.role);

      if (['ADMIN', 'OWNER', 'MANAGER', 'SUPERVISOR'].includes(emp.role)) {
        window.location.href = route;
        return;
      }

      const terminalId = `COLAB_${emp.id.slice(0, 8)}`;
      setStoredTerminalConfig({
        terminal_id: terminalId,
        tenant_id: tenantId,
        actor_id: emp.id,
        device_fingerprint: '',
        device_name: emp.name,
        role: mapToTerminalRole(emp.role),
        location_id: 'LOC01',
        is_allowed: true,
        registered_at: new Date().toISOString(),
      });

      const now = new Date();
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        id: uuidv4(),
        terminal_id: terminalId,
        employee_id: emp.id,
        employee_name: emp.name,
        employee_role: emp.role,
        terminal_role: mapToTerminalRoleStr(emp.role),
        fingerprint_at_login: '',
        fingerprint_signals_at_login: '{}',
        risk_score_at_login: 0,
        created_at: now.toISOString(),
        last_activity_at: now.toISOString(),
        last_fingerprint_check: now.toISOString(),
        expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      }));

      window.location.href = route;
    } catch {
      setError('Sin conexión al servidor');
      setPinValue('');
    } finally {
      setLoading(false);
    }
  }, [dniValue, lockout]);

  const backToDni = useCallback(() => {
    setPhase('dni');
    setDniValue('');
    setPinValue('');
    setError('');
    setLockout(null);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          {tenant ? (
            <>
              <TenantLogo
                logoUrl={tenant.logo_url ?? undefined}
                legalName={tenant.legal_name}
                size="sm"
              />
              <span className="text-white font-bold tracking-tight text-base leading-tight">
                {tenant.legal_name}
              </span>
            </>
          ) : (
            <>
              <ParkLogo size={28} />
              <span className="text-white font-bold tracking-tight text-lg">
                PARK <span className="text-emerald-500">POS</span>
              </span>
            </>
          )}
        </div>

        {(phase === 'pin' || phase === 'checking_dni') && (
          <button
            onClick={backToDni}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-mono text-xs bg-zinc-900 px-2 py-1 rounded-lg">
              DNI {maskDni(dniValue)}
            </span>
          </button>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="w-full max-w-xs">
          <AnimatePresence mode="wait">
            {phase === 'checking_dni' ? (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-4"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="w-10 h-10 border-2 border-zinc-700 border-t-emerald-500 rounded-full"
                />
                <p className="text-zinc-500 text-sm">Verificando DNI...</p>
              </motion.div>
            ) : phase === 'dni' ? (
              <motion.div
                key="dni"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Restaurant branding block */}
                {tenant && (
                  <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                      <TenantLogo
                        logoUrl={tenant.logo_url ?? undefined}
                        legalName={tenant.legal_name}
                        size="lg"
                      />
                    </div>
                    <h1 className="text-white text-2xl font-black tracking-tight">
                      {tenant.legal_name}
                    </h1>
                    {tenant.address_text && (
                      <p className="text-zinc-600 text-xs mt-1">{tenant.address_text}</p>
                    )}
                    <div className="mt-4 h-px bg-zinc-900" />
                  </div>
                )}

                <div className="text-center mb-6">
                  <p className="text-zinc-400 text-sm">Ingresa tu DNI para acceder</p>
                </div>
                <Numpad
                  value={dniValue}
                  onChange={setDniValue}
                  onSubmit={submitDni}
                  maxLength={8}
                  minLength={8}
                  error={error}
                  label="DNI"
                  sublabel="8 dígitos"
                />
              </motion.div>
            ) : (
              <motion.div
                key="pin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-8">
                  {employeeName ? (
                    <>
                      <p className="text-zinc-500 text-sm mb-1">Hola,</p>
                      <h2 className="text-white text-2xl font-bold">{employeeName}</h2>
                      <p className="text-zinc-500 text-sm mt-2">
                        {lockout && lockout > new Date()
                          ? '🔒 Cuenta bloqueada temporalmente'
                          : 'Ingresa tu contraseña'}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-white text-2xl font-bold">Ingresa tu contraseña</h2>
                      <p className="text-zinc-500 text-sm mt-1">
                        {lockout && lockout > new Date()
                          ? '🔒 Cuenta bloqueada temporalmente'
                          : '4 a 6 dígitos'}
                      </p>
                    </>
                  )}
                </div>

                {loading ? (
                  <div className="flex justify-center py-20">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="w-10 h-10 border-2 border-zinc-700 border-t-emerald-500 rounded-full"
                    />
                  </div>
                ) : (
                  <Numpad
                    value={pinValue}
                    onChange={setPinValue}
                    onSubmit={submitPin}
                    maxLength={6}
                    minLength={4}
                    disabled={loading || (!!lockout && lockout > new Date())}
                    error={error}
                    label="PIN"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-zinc-900">
        <button
          onClick={onCajaSetup}
          className="flex items-center gap-2 text-zinc-700 hover:text-zinc-500 text-xs transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Terminal fija
        </button>
        <span className="text-zinc-800 text-xs">v2.1.1</span>
      </div>
    </div>
  );
}
