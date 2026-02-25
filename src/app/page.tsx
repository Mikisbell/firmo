'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getStoredTerminalConfig, clearTerminalConfig } from '@/src/core/auth/fingerprint';
import { TerminalSetup } from '@/src/components/auth/TerminalSetup';
import { UnifiedLogin } from '@/src/components/auth/UnifiedLogin';
import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { ParkLogo } from '@/src/components/icons';

type PageView = 'checking' | 'has_config' | 'login' | 'caja_setup';

const SESSION_STORAGE_KEY = 'park_session_v2';

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

function getRouteForTerminal(terminalId: string): string {
  if (terminalId.startsWith('CAJA')) return '/pos';
  if (terminalId.startsWith('MOZO')) return '/mozo';
  if (terminalId === 'SPC_HORNO' || terminalId === 'KDS_PARRILLA') return '/cocina/horno';
  if (terminalId === 'SPC_COCINA' || terminalId === 'KDS_COCINA') return '/cocina';
  if (terminalId === 'SPC_BAR' || terminalId === 'KDS_BAR') return '/bar';
  return '/pos';
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
        setView('login');
        return;
      }

      // Collaborator session: check sessionStorage
      if (stored.terminal_id.startsWith('COLAB_')) {
        const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionData) {
          try {
            const session = JSON.parse(sessionData);
            if (new Date(session.expires_at) > new Date()) {
              setConfigName(stored.device_name || 'Colaborador');
              setConfigRoute(getRouteForRole(session.employee_role));
              setView('has_config');
              return;
            }
          } catch { /* invalid JSON */ }
        }
        clearTerminalConfig();
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setView('login');
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
          setView('login');
        }
      } catch {
        setConfigName(stored.device_name || stored.terminal_id);
        setConfigRoute(getRouteForTerminal(stored.terminal_id));
        setView('has_config');
      }
    };

    checkSession();
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (view === 'checking') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-[3px] border-zinc-800 border-t-emerald-500 rounded-full"
        />
      </div>
    );
  }

  // ── Terminal setup ─────────────────────────────────────────────────────────
  if (view === 'caja_setup') {
    return <TerminalSetup />;
  }

  // ── Unified login ──────────────────────────────────────────────────────────
  if (view === 'login') {
    return <UnifiedLogin onCajaSetup={() => setView('caja_setup')} />;
  }

  // ── Existing session ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-zinc-950 to-zinc-950" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-emerald-500/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative z-10 text-center"
      >
        {/* Logo */}
        <motion.div
          className="inline-block relative mb-6"
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

        <h1 className="text-3xl font-black tracking-tight mb-1">
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            PARK
          </span>
          <span className="text-white ml-2">POS</span>
        </h1>

        <div className="flex items-center justify-center gap-2 mb-8">
          <Sparkles className="w-3 h-3 text-emerald-500" />
          <p className="text-zinc-500 text-sm">Sesión activa</p>
          <Sparkles className="w-3 h-3 text-emerald-500" />
        </div>

        {/* Session card */}
        <div className="relative mb-4">
          <div className="absolute -inset-[1px] bg-gradient-to-br from-emerald-600/40 to-teal-600/40 rounded-2xl" />
          <div className="relative bg-zinc-900 rounded-2xl p-6">
            <p className="text-zinc-500 text-xs mb-1">Conectado como</p>
            <p className="text-white font-bold text-lg">{configName}</p>
          </div>
        </div>

        <button
          onClick={() => { setNavigating(true); window.location.href = configRoute; }}
          disabled={navigating}
          className="w-full py-4 px-6 rounded-xl font-bold text-white relative overflow-hidden disabled:opacity-50 mb-3"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600" />
          <span className="relative flex items-center justify-center gap-2">
            {navigating
              ? <RefreshCw className="w-5 h-5 animate-spin" />
              : <><span>Continuar</span><ArrowRight className="w-5 h-5" /></>
            }
          </span>
        </button>

        <button
          onClick={() => {
            clearTerminalConfig();
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            setView('login');
            setNavigating(false);
          }}
          disabled={navigating}
          className="w-full py-3 px-6 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-medium rounded-xl transition-all border border-zinc-800 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Cambiar usuario
        </button>

        <p className="text-xs text-zinc-700 mt-8">PARK POS v2.1.1</p>
      </motion.div>
    </div>
  );
}
