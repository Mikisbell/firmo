'use client';

/**
 * UnifiedLogin — Professional Responsive POS Login Screen
 * Architecture: Split 2-Column for POS/Tablet (10"+), Full-Screen for Mobile
 * DNI (8 digits) → PIN (4-6 digits) → Auto-route by Role
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FirmoLogo } from '@/src/components/icons';
import { TenantLogo } from '@/src/components/branding/TenantLogo';
import { Delete, ChevronLeft, ShieldCheck, Clock, Monitor } from 'lucide-react';
import { safeStorage } from '@/src/lib/storage';
import { cacheEmployeeForOffline, verifyOfflineEmployee } from '@/src/core/auth/offline-auth';
import type { TerminalRole } from '@/src/core/auth/types';
import { EMPLOYEE_ROLES, ADMIN_ROLES } from '@/src/core/constants/roles';
import { APP_VERSION } from '@/src/core/constants/version';

interface TenantBranding {
  legal_name: string;
  logo_url: string | null;
  address_text: string | null;
}

const FALLBACK_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ALL_ROLES = [...EMPLOYEE_ROLES];

type Phase = 'dni' | 'checking_dni' | 'pin';

function getRouteForRole(role: string): string {
  switch (role) {
    case 'OWNER': case 'ADMIN': case 'MANAGER': case 'SUPERVISOR': return '/admin';
    case 'CASHIER':  return '/pos';
    case 'WAITER':   return '/mozo';
    case 'KITCHEN': case 'COOK': case 'PACKER': return '/cocina';
    case 'BAR':      return '/bar';
    case 'DRIVER':   return '/delivery';
    default:         return '/';
  }
}

function maskDni(dni: string): string {
  if (dni.length <= 4) return '•'.repeat(dni.length);
  return `${dni.slice(0, 2)}${'•'.repeat(dni.length - 4)}${dni.slice(-2)}`;
}

// ── Numpad Ergonométrico ──────────────────────────────────────────────────────
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
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      {/* Dynamic Header */}
      <div className="text-center mb-6">
        <h3 className="text-white text-xl md:text-2xl font-black tracking-tight mb-1">{label}</h3>
        {sublabel && <p className="text-zinc-400 text-xs md:text-sm font-medium">{sublabel}</p>}
      </div>

      {/* Puntos Indicadores Neon */}
      <div className="flex items-center justify-center gap-3.5 mb-6 h-10">
        {dots.map((_, i) => {
          const filled = i < value.length;
          const required = i < minLength;
          return (
            <motion.div
              key={i}
              animate={filled ? { scale: [1, 1.4, 1] } : { scale: 1 }}
              transition={{ duration: 0.15 }}
              className={[
                'transition-all duration-200',
                filled
                  ? 'w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_18px_rgba(249,115,22,0.9)] scale-110'
                  : required
                    ? 'w-3.5 h-3.5 rounded-full bg-zinc-800 border border-zinc-700'
                    : 'w-3 h-3 rounded-full bg-zinc-900 border border-zinc-800',
              ].join(' ')}
            />
          );
        })}
      </div>

      {/* Mensaje de Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full text-red-400 text-xs md:text-sm font-semibold mb-5 text-center bg-red-950/60 border border-red-500/30 px-4 py-2.5 rounded-2xl backdrop-blur-md"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teclado Táctil POS (80px de alto en tablets/pos, 64px en mobile) */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 w-full">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button
            key={d}
            onPointerDown={e => { e.preventDefault(); handleDigit(d); }}
            disabled={disabled}
            className="h-16 md:h-20 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 active:bg-zinc-700/80 border border-white/10 text-white text-2xl md:text-3xl font-black transition-all duration-150 select-none touch-manipulation active:scale-95 shadow-lg shadow-black/50 disabled:opacity-40"
          >
            {d}
          </button>
        ))}

        <button
          onPointerDown={e => { e.preventDefault(); handleClear(); }}
          disabled={disabled || value.length === 0}
          className="h-16 md:h-20 rounded-2xl bg-zinc-950/90 hover:bg-zinc-900 active:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white text-xs md:text-sm font-bold tracking-wider transition-all select-none touch-manipulation active:scale-95 disabled:opacity-30"
        >
          LIMPIAR
        </button>

        <button
          onPointerDown={e => { e.preventDefault(); handleDigit('0'); }}
          disabled={disabled}
          className="h-16 md:h-20 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 active:bg-zinc-700/80 border border-white/10 text-white text-2xl md:text-3xl font-black transition-all duration-150 select-none touch-manipulation active:scale-95 shadow-lg shadow-black/50 disabled:opacity-40"
        >
          0
        </button>

        <button
          onPointerDown={e => { e.preventDefault(); handleBack(); }}
          disabled={disabled || value.length === 0}
          className="h-16 md:h-20 rounded-2xl bg-zinc-950/90 hover:bg-zinc-900 active:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white transition-all flex items-center justify-center select-none touch-manipulation active:scale-95 disabled:opacity-30"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Botón de Confirmación */}
      <AnimatePresence>
        {canSubmit && value.length < maxLength && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onPointerDown={e => { e.preventDefault(); onSubmit(value); }}
            disabled={disabled}
            className="mt-5 w-full h-14 md:h-16 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-400 active:scale-[0.98] text-white font-black tracking-wide text-base md:text-lg transition-all select-none touch-manipulation shadow-xl shadow-orange-600/30 disabled:opacity-40"
          >
            CONFIRMAR
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export function UnifiedLogin({ onCajaSetup }: { onCajaSetup: () => void }) {
  const [phase, setPhase] = useState<Phase>('dni');
  const [dniValue, setDniValue] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockout, setLockout] = useState<Date | null>(null);
  const [tenant, setTenant] = useState<TenantBranding | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    fetch('/api/tenant/public')
      .then(r => r.json())
      .then(setTenant)
      .catch(() => {});

    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
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
        setError(data.error || 'DNI o contraseña incorrecta');
        setLoading(false);
        return;
      }

      const emp = data.employee as { id: string; name: string; role: string };
      cacheEmployeeForOffline({ ...emp, dni: dniValue, tenant_id: tenantId }, currentValue);

      const defaultRoute = getRouteForRole(emp.role);
      let targetRoute = defaultRoute;

      if (typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search);
          const redirect = params.get('redirect');
          if (redirect) {
            if (redirect.startsWith('/admin') && !(ADMIN_ROLES as readonly string[]).includes(emp.role)) {
              targetRoute = defaultRoute;
            } else {
              targetRoute = redirect;
            }
          }
        } catch { /* ignore */ }
      }

      window.location.href = targetRoute;
    } catch {
      // Fallback a validación Offline local
      const offlineResult = verifyOfflineEmployee(dniValue, currentValue);
      if (offlineResult.success && offlineResult.employee) {
        const emp = offlineResult.employee;
        const targetRoute = getRouteForRole(emp.role);
        window.location.href = targetRoute;
        return;
      }

      setError(offlineResult.error || 'Error de conexión con el servidor');
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
    <div className="min-h-screen bg-[#07080A] text-white flex flex-col justify-between relative overflow-hidden select-none">
      {/* Destellos de Brasa (Glow Background) */}
      <div className="absolute -top-48 -left-48 w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute -bottom-48 -right-48 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Bar Responsivo */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-950/60 backdrop-blur-xl relative z-20">
        <div className="flex items-center gap-3">
          <FirmoLogo size={32} />
          <span className="font-black text-xl tracking-tight">
            FIRMO <span className="text-orange-500">POS</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {currentTime && (
            <div className="hidden md:flex items-center gap-1.5 text-zinc-400 text-xs font-mono bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-white/5">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>{currentTime}</span>
            </div>
          )}

          {(phase === 'pin' || phase === 'checking_dni') && (
            <button
              onClick={backToDni}
              className="flex items-center gap-2 text-zinc-300 hover:text-white text-xs font-bold bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-xl border border-white/10 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-orange-400" />
              <span>CAMBIAR DNI ({maskDni(dniValue)})</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Split Layout: 2 Columnas en POS (1024px+), 1 Columna en Mobile */}
      <main className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center px-4 md:px-8 py-6 relative z-10">
        
        {/* Columna Izquierda: Hero & Branding de la Tienda (Visible en lg+) */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-center gap-8 pr-6 border-r border-white/5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Terminal Certificada FIRMO POS</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-black text-white tracking-tight leading-tight">
              {tenant?.legal_name || 'FIRMO POS'}
            </h1>
            {tenant?.address_text && (
              <p className="text-zinc-400 text-sm mt-2 font-medium leading-relaxed">
                {tenant.address_text}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900/40 border border-white/5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 font-bold">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <p className="text-white text-sm font-bold">Modo Terminal Táctil</p>
                <p className="text-zinc-500 text-xs">Acceso seguro por DNI y clave secreta de empleado</p>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-zinc-950/60 border border-white/5 text-xs text-zinc-500 font-mono">
              <span>ESTADO DE RED: <strong className="text-emerald-400 font-sans">ONLINE</strong></span>
              <span>VERSIÓN: {APP_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Panel del Numpad Táctil */}
        <div className="lg:col-span-7 flex flex-col justify-center items-center w-full">
          <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-orange-950/20">
            <AnimatePresence mode="wait">
              {phase === 'checking_dni' ? (
                <motion.div
                  key="checking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-20 gap-4"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 border-3 border-zinc-700 border-t-orange-500 rounded-full"
                  />
                  <p className="text-zinc-300 font-semibold text-sm">Verificando DNI...</p>
                </motion.div>
              ) : phase === 'dni' ? (
                <motion.div
                  key="dni"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.15 }}
                >
                  <Numpad
                    value={dniValue}
                    onChange={setDniValue}
                    onSubmit={submitDni}
                    maxLength={8}
                    minLength={8}
                    error={error}
                    label="Ingresá tu DNI"
                    sublabel="8 dígitos para identificar tu perfil de usuario"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="pin"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.15 }}
                >
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="w-12 h-12 border-3 border-zinc-700 border-t-orange-500 rounded-full"
                      />
                      <p className="text-zinc-300 font-semibold text-sm">Iniciando sesión segura...</p>
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
                      label={employeeName ? `¡Hola, ${employeeName}!` : 'Ingresá tu contraseña'}
                      sublabel={
                        lockout && lockout > new Date()
                          ? '🔒 Cuenta bloqueada temporalmente'
                          : 'Ingresá tu clave secreta de 4 a 6 dígitos'
                      }
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer Minimalista */}
      <footer className="w-full py-3 px-6 text-center text-zinc-600 text-xs border-t border-white/5 bg-zinc-950/40 relative z-20">
        <span>FIRMO POS &copy; {new Date().getFullYear()} — Sistema Gastronómico de Alta Velocidad</span>
      </footer>
    </div>
  );
}
