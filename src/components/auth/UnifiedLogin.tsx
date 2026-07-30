'use client';

/**
 * UnifiedLogin — Enterprise POS Touchscreen Login Screen
 * Theme: Premium Gastronomic Operating System (OLED Navy & Warm Flame Accents)
 * Ergonomic 2-Column POS Layout (10"+ Tablets) & Optimized Mobile Touch Screen
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FirmoLogo, FirmoBrandHeader } from '@/src/components/icons';
import {
  Delete, ChevronLeft, ShieldCheck, Clock, Monitor, Wifi, Lock,
  Cpu, Sparkles, AlertTriangle, Utensils, Store
} from 'lucide-react';
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

// ── Numpad Ergonométrico Tactil POS ───────────────────────────────────────────
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
      {/* Encabezado Dinámico de Usuario */}
      <div className="text-center mb-6">
        <h3 className="text-white text-2xl md:text-3xl font-black tracking-tight mb-1.5 drop-shadow-md">
          {label}
        </h3>
        {sublabel && (
          <p className="text-slate-400 text-xs md:text-sm font-medium leading-relaxed max-w-xs mx-auto">
            {sublabel}
          </p>
        )}
      </div>

      {/* Puntos Indicadores Brasa Neon */}
      <div className="flex items-center justify-center gap-3.5 mb-7 h-10">
        {dots.map((_, i) => {
          const filled = i < value.length;
          const required = i < minLength;
          return (
            <motion.div
              key={i}
              animate={filled ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ duration: 0.15 }}
              className={[
                'transition-all duration-200',
                filled
                  ? 'w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.9)] scale-110'
                  : required
                    ? 'w-3.5 h-3.5 rounded-full bg-slate-800 border border-slate-700'
                    : 'w-3 h-3 rounded-full bg-slate-900 border border-slate-800',
              ].join(' ')}
            />
          );
        })}
      </div>

      {/* Mensaje de Error / Alerta Estilizada */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="w-full text-red-300 text-xs md:text-sm font-bold mb-6 text-center bg-red-950/80 border border-red-500/40 px-4 py-3 rounded-2xl backdrop-blur-md flex items-center justify-center gap-2 shadow-lg shadow-red-950/50"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teclado Táctil Táctico (Botones Ergonométricos 80px+) */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 w-full">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button
            key={d}
            onPointerDown={e => { e.preventDefault(); handleDigit(d); }}
            disabled={disabled}
            className="h-16 md:h-20 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-700/80 border border-slate-700/60 hover:border-orange-500/40 text-white text-2xl md:text-3xl font-black transition-all duration-150 select-none touch-manipulation active:scale-95 shadow-lg shadow-black/60 disabled:opacity-40"
          >
            {d}
          </button>
        ))}

        <button
          onPointerDown={e => { e.preventDefault(); handleClear(); }}
          disabled={disabled || value.length === 0}
          className="h-16 md:h-20 rounded-2xl bg-slate-950/90 hover:bg-slate-900 active:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs md:text-sm font-bold tracking-wider transition-all select-none touch-manipulation active:scale-95 disabled:opacity-30"
        >
          LIMPIAR
        </button>

        <button
          onPointerDown={e => { e.preventDefault(); handleDigit('0'); }}
          disabled={disabled}
          className="h-16 md:h-20 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-700/80 border border-slate-700/60 hover:border-orange-500/40 text-white text-2xl md:text-3xl font-black transition-all duration-150 select-none touch-manipulation active:scale-95 shadow-lg shadow-black/60 disabled:opacity-40"
        >
          0
        </button>

        <button
          onPointerDown={e => { e.preventDefault(); handleBack(); }}
          disabled={disabled || value.length === 0}
          className="h-16 md:h-20 rounded-2xl bg-slate-950/90 hover:bg-slate-900 active:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all flex items-center justify-center select-none touch-manipulation active:scale-95 disabled:opacity-30"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Botón de Confirmación Manual */}
      <AnimatePresence>
        {canSubmit && value.length < maxLength && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onPointerDown={e => { e.preventDefault(); onSubmit(value); }}
            disabled={disabled}
            className="mt-6 w-full h-14 md:h-16 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-400 active:scale-[0.98] text-white font-black tracking-wider text-base md:text-lg transition-all select-none touch-manipulation shadow-xl shadow-orange-600/30 disabled:opacity-40"
          >
            INGRESAR A TERMINAL
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Componente Principal Login ────────────────────────────────────────────────
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
      setCurrentTime(now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
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
        setError(data.error || 'DNI o clave secreta incorrecta');
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
    <div className="min-h-screen bg-[#0A0E14] text-white flex flex-col justify-between relative overflow-hidden select-none">
      {/* Ambient Flame Glow Background */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[600px] h-[450px] bg-orange-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-amber-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#0A0E14]/90 backdrop-blur-xl relative z-20">
        <FirmoBrandHeader logoSize={40} theme="dark" />

        <div className="flex items-center gap-4">
          {currentTime && (
            <div className="hidden sm:flex items-center gap-2 text-slate-300 text-xs font-mono bg-slate-900/90 px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>{currentTime}</span>
            </div>
          )}

          {(phase === 'pin' || phase === 'checking_dni') && (
            <button
              onClick={backToDni}
              className="flex items-center gap-2 text-slate-200 hover:text-white text-xs font-bold bg-slate-900 hover:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700/80 transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 text-orange-400" />
              <span>CAMBIAR DNI ({maskDni(dniValue)})</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Layout: 2 Columns for POS Terminal (1024px+), 1 Column for Mobile */}
      <main className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center px-4 md:px-8 py-8 relative z-10">
        
        {/* Left Column: Branding Showcase & Restaurant Identity */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-center gap-8 pr-4">
          <div className="space-y-4">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              <span>Terminal POS Certificada</span>
            </div>

            {/* Brand Logo & Composition Header */}
            <div className="flex items-center gap-4 py-2">
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-orange-500/30 shadow-xl shadow-orange-500/10 shrink-0">
                <FirmoLogo size={56} />
              </div>
              <div>
                <h1 className="text-3xl xl:text-4xl font-black tracking-tight leading-none uppercase text-white flex items-center gap-2">
                  FIRMO <span className="text-orange-500">POS</span>
                </h1>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-mono font-bold text-slate-300 uppercase">
                  <Utensils className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>Sistema Operativo Gastronómico</span>
                </div>
              </div>
            </div>


          </div>

          <div className="space-y-3.5">
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
              <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold shrink-0">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <p className="text-white text-sm font-bold">Modo Terminal Táctil</p>
                <p className="text-slate-400 text-xs">Acceso por DNI y clave secreta de empleado</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400 text-[10px] uppercase block">Estado Red</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400 text-[10px] uppercase block">Versión</span>
                <span className="text-orange-400 font-bold">{APP_VERSION}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: High-Purity Numpad Kiosk Container */}
        <div className="lg:col-span-7 flex flex-col justify-center items-center w-full">
          <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-orange-950/20 relative overflow-hidden">
            {/* Subtle Top Ember Border Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-amber-400 to-orange-500" />

            <AnimatePresence mode="wait">
              {phase === 'checking_dni' ? (
                <motion.div
                  key="checking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-20 gap-4 text-center"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 border-3 border-slate-700 border-t-orange-500 rounded-full"
                  />
                  <p className="text-slate-200 font-bold text-sm">Verificando DNI en sistema...</p>
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
                    sublabel="Ingresá los 8 dígitos para identificar tu perfil de usuario"
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
                    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="w-12 h-12 border-3 border-slate-700 border-t-orange-500 rounded-full"
                      />
                      <p className="text-slate-200 font-bold text-sm">Iniciando sesión en terminal POS...</p>
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
                      label={employeeName ? `¡Hola, ${employeeName}!` : 'Ingresá tu clave secreta'}
                      sublabel={
                        lockout && lockout > new Date()
                          ? '🔒 Acceso bloqueado temporalmente por seguridad'
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

      {/* Minimal Footer */}
      <footer className="w-full py-3.5 px-6 text-center text-slate-500 text-xs font-mono border-t border-slate-800/80 bg-[#0A0E14] relative z-20">
        <span>FIRMO POS &copy; {new Date().getFullYear()} — Gastronomic Operating System</span>
      </footer>
    </div>
  );
}
