'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStoredTerminalConfig, clearTerminalConfig } from '@/src/core/auth/fingerprint';
import { TerminalSetup } from '@/src/components/auth/TerminalSetup';
import { ColaboradorLogin } from '@/src/components/auth/ColaboradorLogin';
import { Monitor, Users, Shield, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { ParkLogo } from '@/src/components/icons';

type PageView = 'checking' | 'has_config' | 'home' | 'caja_setup' | 'colaborador';

const SESSION_STORAGE_KEY = 'park_session_v2';

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

function getRouteForTerminal(terminalId: string): string {
  if (terminalId.startsWith('CAJA')) return '/pos';
  if (terminalId.startsWith('MOZO')) return '/mozo';
  if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return '/cocina/horno';
  if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return '/cocina';
  if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return '/bar';
  return '/pos';
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-emerald-500/20 rounded-full"
          initial={{ x: Math.random() * 400, y: Math.random() * 800 }}
          animate={{ y: [null, -100], opacity: [0, 1, 0] }}
          transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  const [view, setView] = useState<PageView>('checking');
  const [configName, setConfigName] = useState('');
  const [configRoute, setConfigRoute] = useState('');
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const stored = getStoredTerminalConfig();

      if (!stored?.terminal_id) {
        setView('home');
        return;
      }

      // Collaborator session: check sessionStorage for valid unexpired session
      if (stored.terminal_id.startsWith('COLAB_')) {
        const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionData) {
          try {
            const session = JSON.parse(sessionData);
            const expiresAt = new Date(session.expires_at);
            if (expiresAt > new Date()) {
              setConfigName(stored.device_name || 'Colaborador');
              setConfigRoute(getRouteForRole(session.employee_role));
              setView('has_config');
              return;
            }
          } catch {
            // Invalid session JSON
          }
        }
        // Expired or missing session — clear and show home
        clearTerminalConfig();
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setView('home');
        return;
      }

      // Caja/Terminal session: validate device binding
      try {
        const { getOrCreateDeviceId } = await import('@/src/core/auth/device-id');
        const deviceId = getOrCreateDeviceId();
        const response = await fetch('/api/terminals/validate-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: deviceId, terminal_id: stored.terminal_id }),
        });
        if (response.ok) {
          setConfigName(stored.device_name || stored.terminal_id);
          setConfigRoute(getRouteForTerminal(stored.terminal_id));
          setView('has_config');
        } else {
          clearTerminalConfig();
          setView('home');
        }
      } catch {
        // On error, still show stored config
        setConfigName(stored.device_name || stored.terminal_id);
        setConfigRoute(getRouteForTerminal(stored.terminal_id));
        setView('has_config');
      }
    };

    checkSession();
  }, []);

  const handleContinue = () => {
    if (!navigating && configRoute) {
      setNavigating(true);
      window.location.href = configRoute;
    }
  };

  const handleChange = () => {
    clearTerminalConfig();
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setView('home');
    setNavigating(false);
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (view === 'checking') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-zinc-800 border-t-emerald-500 rounded-full"
        />
      </div>
    );
  }

  // ─── Sub-screens ───────────────────────────────────────────────────────────
  if (view === 'caja_setup') {
    return <TerminalSetup />;
  }

  if (view === 'colaborador') {
    return <ColaboradorLogin onBack={() => setView('home')} />;
  }

  // ─── Existing session ──────────────────────────────────────────────────────
  if (view === 'has_config') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-zinc-950 to-zinc-950" />
        <FloatingParticles />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.8 }}
              className="relative inline-block"
            >
              <div className="absolute inset-0 bg-emerald-500/30 blur-3xl rounded-full" />
              <ParkLogo size={96} className="relative z-10 drop-shadow-2xl" />
            </motion.div>
            <h1 className="text-4xl font-black mt-6 tracking-tight">
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">PARK</span>
              <span className="text-white ml-2">POS</span>
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <p className="text-zinc-500 text-sm">Sesión activa detectada</p>
              <Sparkles className="w-4 h-4 text-emerald-500" />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 text-center">
              <p className="text-zinc-500 text-sm mb-1">Sesión activa</p>
              <h2 className="text-2xl font-bold text-white">{configName}</h2>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3 mt-6"
          >
            <button
              onClick={handleContinue}
              disabled={navigating}
              className="group w-full relative overflow-hidden py-4 px-6 rounded-xl font-bold text-white transition-all disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600" />
              <span className="relative flex items-center justify-center gap-2">
                {navigating ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>Continuar <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                )}
              </span>
            </button>

            <button
              onClick={handleChange}
              disabled={navigating}
              className="w-full py-4 px-6 bg-zinc-900/50 hover:bg-zinc-800/50 text-zinc-300 hover:text-white font-medium rounded-xl transition-all border border-zinc-800 hover:border-zinc-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Cambiar acceso
            </button>
          </motion.div>

          <p className="text-center text-xs text-zinc-600 mt-8">PARK POS v2.1.1</p>
        </motion.div>
      </div>
    );
  }

  // ─── Home: 3 options ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-zinc-950 to-zinc-950" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      <FloatingParticles />

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-2xl sticky top-0 z-40 relative"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5" />
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3 relative">
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
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">PARK</span>
              <span className="text-white ml-1">POS</span>
            </h1>
            <p className="text-xs text-zinc-500">¿Cómo deseas ingresar?</p>
          </div>
        </div>
      </motion.header>

      {/* Cards */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-lg space-y-3">
          <AnimatePresence>
            {/* Caja */}
            <motion.button
              key="caja"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              onClick={() => setView('caja_setup')}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group w-full relative overflow-hidden"
            >
              <motion.div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              <div className="relative flex items-center gap-4 p-5 rounded-2xl bg-zinc-900/95 backdrop-blur-sm border border-transparent group-hover:bg-zinc-900/80 transition-all">
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Monitor className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-white group-hover:text-emerald-50 transition-colors">Caja</h3>
                  <p className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">Terminal fija · Requiere código de activación</p>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
              </div>
            </motion.button>

            {/* Colaborador */}
            <motion.button
              key="colaborador"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              onClick={() => setView('colaborador')}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group w-full relative overflow-hidden"
            >
              <motion.div className="absolute -inset-[1px] bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-500 to-purple-600 rounded-3xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              <div className="relative flex items-center gap-4 p-5 rounded-2xl bg-zinc-900/95 backdrop-blur-sm border border-transparent group-hover:bg-zinc-900/80 transition-all">
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-white group-hover:text-violet-50 transition-colors">Colaborador</h3>
                  <p className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">Mesero · Cocina · Bar · Delivery · y más</p>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-violet-400 transition-colors" />
              </div>
            </motion.button>

            {/* Admin */}
            <motion.a
              key="admin"
              href="/admin"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group w-full relative overflow-hidden block"
            >
              <motion.div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-3xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              <div className="relative flex items-center gap-4 p-5 rounded-2xl bg-zinc-900/95 backdrop-blur-sm border border-transparent group-hover:bg-zinc-900/80 transition-all">
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-white group-hover:text-emerald-50 transition-colors">Admin</h3>
                  <p className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">Panel de administración</p>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
              </div>
            </motion.a>
          </AnimatePresence>
        </div>
      </main>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="py-4 text-center relative z-10"
      >
        <p className="text-xs text-zinc-600">
          <span className="bg-gradient-to-r from-zinc-600 to-zinc-500 bg-clip-text text-transparent">PARK POS</span>
          <span className="mx-2 text-zinc-700">•</span>
          <span className="text-zinc-600">v2.1.1</span>
          <span className="mx-2 text-zinc-700">•</span>
          <span className="text-zinc-600">Sistema de Punto de Venta</span>
        </p>
      </motion.footer>
    </div>
  );
}
