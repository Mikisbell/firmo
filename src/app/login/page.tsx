'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import { TerminalSetup } from '@/src/components/auth/TerminalSetup';
import { UnifiedLogin } from '@/src/components/auth/UnifiedLogin';

type View = 'checking' | 'login' | 'caja_setup';

const SESSION_STORAGE_KEY = 'park_session_v2';

export default function LoginPage() {
  const [view, setView] = useState<View>('checking');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('force') === 'true' || searchParams.has('redirect')) {
      setView('login');
      return;
    }

    const stored = getStoredTerminalConfig();
    if (!stored?.terminal_id) {
      setView('login');
      return;
    }

    // Collaborator session active → redirect to home
    if (stored.terminal_id.startsWith('COLAB_')) {
      const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            window.location.replace('/');
            return;
          }
        } catch { /* invalid */ }
      }
      setView('login');
      return;
    }

    // Fixed terminal → validate device then redirect
    (async () => {
      try {
        const { getOrCreateDeviceId } = await import('@/src/core/auth/device-id');
        const deviceId = getOrCreateDeviceId();
        const res = await fetch('/api/terminals/validate-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: deviceId, terminal_id: stored.terminal_id }),
        });
        if (res.ok) {
          window.location.replace('/');
          return;
        }
      } catch { /* network error — show login */ }
      setView('login');
    })();
  }, []);

  if (view === 'checking') {
    return (
      <div className="min-h-screen bg-park-gray-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-[3px] border-park-gray-800 border-t-emerald-500 rounded-full"
        />
      </div>
    );
  }

  if (view === 'caja_setup') {
    return <TerminalSetup />;
  }

  return <UnifiedLogin onCajaSetup={() => setView('caja_setup')} />;
}
