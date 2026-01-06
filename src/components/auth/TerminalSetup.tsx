'use client';

// src/components/auth/TerminalSetup.tsx
// Terminal selection screen - picks from existing terminals in DB

import { useState, useEffect } from 'react';
import { generateDeviceFingerprint, setStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import type { TerminalConfig, TerminalRole } from '@/src/core/auth/types';

interface TerminalSetupProps {
  onComplete: (config: TerminalConfig) => void;
}

interface TerminalOption {
  terminal_id: string;
  role: string;
  station?: string;
}

const ROLE_INFO: Record<string, { label: string; icon: string }> = {
  'term_1': { label: 'Caja Principal', icon: '💰' },
  'waiter_1': { label: 'Mesero 1', icon: '📱' },
  'kds_parrilla': { label: 'KDS Parrilla', icon: '🔥' },
  'kds_bar': { label: 'KDS Bar', icon: '🍺' },
};

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

export function TerminalSetup({ onComplete }: TerminalSetupProps) {
  const [terminals, setTerminals] = useState<TerminalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load available terminals
    fetch('/api/auth/terminals')
      .then(res => res.json())
      .then(data => {
        if (data.terminals) {
          setTerminals(data.terminals);
        }
      })
      .catch(() => {
        // Fallback to hardcoded terminals if API fails
        setTerminals([
          { terminal_id: 'term_1', role: 'CASHIER' },
          { terminal_id: 'waiter_1', role: 'WAITER' },
          { terminal_id: 'kds_parrilla', role: 'KDS' },
          { terminal_id: 'kds_bar', role: 'KDS' },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (terminal: TerminalOption) => {
    setSelecting(true);
    setError('');

    try {
      const fingerprint = await generateDeviceFingerprint();
      
      // Determine role from terminal_id
      let role: TerminalRole = 'CASHIER';
      if (terminal.terminal_id.startsWith('waiter')) role = 'WAITER';
      else if (terminal.terminal_id.startsWith('kds')) role = 'KDS';
      else if (terminal.terminal_id.startsWith('bar')) role = 'BAR';

      const config: TerminalConfig = {
        terminal_id: terminal.terminal_id,
        tenant_id: TENANT_ID,
        device_fingerprint: fingerprint,
        device_name: ROLE_INFO[terminal.terminal_id]?.label || terminal.terminal_id,
        role,
        location_id: 'LOC01',
        is_allowed: true,
        registered_at: new Date().toISOString(),
      };

      setStoredTerminalConfig(config);
      onComplete(config);
    } catch (_err) {
      setError('Error al configurar terminal');
      setSelecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Cargando terminales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🍗 PARK POS</h1>
          <p className="text-zinc-400">Selecciona este Terminal</p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="space-y-3">
            {terminals.map((terminal) => {
              const info = ROLE_INFO[terminal.terminal_id] || { 
                label: terminal.terminal_id, 
                icon: '📟' 
              };
              
              return (
                <button
                  key={terminal.terminal_id}
                  onClick={() => handleSelect(terminal)}
                  disabled={selecting}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:border-emerald-500/50 transition-all disabled:opacity-50"
                >
                  <span className="text-3xl">{info.icon}</span>
                  <div className="text-left flex-1">
                    <p className="text-white font-semibold">{info.label}</p>
                    <p className="text-zinc-500 text-sm">{terminal.terminal_id}</p>
                  </div>
                  <span className="text-zinc-600">→</span>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center mt-4">{error}</p>
          )}
        </div>

        <p className="text-center text-zinc-600 text-xs mt-4">
          Pollería Park Demo • v1.0
        </p>
      </div>
    </div>
  );
}
