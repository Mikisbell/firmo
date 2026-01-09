'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDeviceFingerprint, setStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import type { TerminalConfig, TerminalRole } from '@/src/core/auth/types';
import { Monitor, ChefHat, Wine, Loader2, Flame, Package, ArrowRight, ArrowLeft, Settings, Users } from 'lucide-react';

interface TerminalSetupProps { onComplete: (config: TerminalConfig) => void; }
interface TerminalOption { terminal_id: string; role: TerminalRole; label: string; accentColor: string; }
type ViewMode = 'roles' | 'meseros';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MESERO_COLORS = ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#14b8a6','#22c55e','#84cc16','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#78716c','#64748b','#0ea5e9'];

function generateActorId(terminalId: string): string {
  const hash = terminalId.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
  const hex = hash.toString(16).padStart(8, '0');
  const th = terminalId.split('').map(c => c.charCodeAt(0).toString(16)).join('').padStart(24, '0');
  return hex.slice(0, 8) + '-' + th.slice(0, 4) + '-4' + th.slice(4, 7) + '-a' + th.slice(7, 10) + '-' + th.slice(10, 22);
}

function generateMeseros(): TerminalOption[] {
  const result: TerminalOption[] = [];
  for (let i = 0; i < 15; i++) {
    result.push({ terminal_id: 'MOZO_' + String(i + 1).padStart(2, '0'), role: 'WAITER' as TerminalRole, label: 'Mesero ' + (i + 1), accentColor: MESERO_COLORS[i] });
  }
  return result;
}
const MESEROS = generateMeseros();
const ROLE_CARDS = [
  { id: 'CAJA_01', role: 'CASHIER' as TerminalRole, title: 'Caja', subtitle: 'Cobros y cierre', icon: Monitor, color: '#10b981', gradient: 'from-emerald-500 to-teal-600', isGroup: false },
  { id: 'meseros', role: 'WAITER' as TerminalRole, title: 'Meseros', subtitle: '15 terminales', icon: Users, color: '#8b5cf6', gradient: 'from-violet-500 to-purple-600', isGroup: true },
  { id: 'SPC_HORNO', role: 'KDS' as TerminalRole, title: 'Horno', subtitle: 'Parrilla', icon: Flame, color: '#f97316', gradient: 'from-orange-500 to-red-600', isGroup: false },
  { id: 'SPC_COCINA', role: 'KDS' as TerminalRole, title: 'Cocina', subtitle: 'Guarniciones', icon: ChefHat, color: '#eab308', gradient: 'from-yellow-500 to-amber-600', isGroup: false },
  { id: 'SPC_BAR', role: 'BAR' as TerminalRole, title: 'Bar', subtitle: 'Bebidas', icon: Wine, color: '#0ea5e9', gradient: 'from-sky-500 to-blue-600', isGroup: false },
];

export function TerminalSetup({ onComplete }: TerminalSetupProps) {
  const [view, setView] = useState<ViewMode>('roles');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { const t = setTimeout(() => setLoading(false), 300); return () => clearTimeout(t); }, []);
  const handleSelect = async (id: string, role: TerminalRole, label: string) => {
    setSelecting(id); setError('');
    try {
      const fp = await generateDeviceFingerprint();
      const cfg: TerminalConfig = { terminal_id: id, tenant_id: TENANT_ID, actor_id: generateActorId(id), device_fingerprint: fp, device_name: label, role, location_id: 'LOC01', is_allowed: true, registered_at: new Date().toISOString() };
      await new Promise(r => setTimeout(r, 300));
      setStoredTerminalConfig(cfg); onComplete(cfg);
    } catch { setError('Error'); setSelecting(null); }
  };
  const handleRole = (c: typeof ROLE_CARDS[0]) => { if (c.isGroup) setView('meseros'); else handleSelect(c.id, c.role, c.title); };
  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" /></div>;
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <header className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view === 'meseros' && <button onClick={() => setView('roles')} className="p-2 -ml-2 rounded-lg hover:bg-zinc-800"><ArrowLeft className="w-5 h-5 text-zinc-400" /></button>}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg"><span className="text-xl"></span></div>
            <div><h1 className="text-lg font-semibold text-white">PARK POS</h1><p className="text-xs text-zinc-500">{view === 'roles' ? 'Selecciona estacion' : 'Selecciona numero'}</p></div>
          </div>
          <a href="/admin" className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800"><Settings className="w-5 h-5" /></a>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">{view === 'roles' ? <RolesView key="r" selecting={selecting} onSelect={handleRole} /> : <MeserosView key="m" selecting={selecting} onSelect={m => handleSelect(m.terminal_id, m.role, m.label)} />}</AnimatePresence>
          {error && <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{error}</div>}
          {view === 'roles' && <div className="mt-8 flex justify-center"><a href="/inventario" className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-sm"><Package className="w-4 h-4" />Inventario<ArrowRight className="w-3 h-3" /></a></div>}
        </div>
      </main>
      <footer className="py-4 text-center"><p className="text-xs text-zinc-600">PARK POS v2.1.1 - UI 2026</p></footer>
    </div>
  );
}

function RolesView({ selecting, onSelect }: { selecting: string | null; onSelect: (c: typeof ROLE_CARDS[0]) => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      {ROLE_CARDS.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.button key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => onSelect(c)} disabled={selecting !== null} className="group w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all">
            <div className={'w-14 h-14 rounded-xl bg-gradient-to-br ' + c.gradient + ' flex items-center justify-center shadow-lg'}>
              {selecting === c.id ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Icon className="w-6 h-6 text-white" />}
            </div>
            <div className="flex-1 text-left"><h3 className="text-lg font-semibold text-white">{c.title}</h3><p className="text-sm text-zinc-500">{c.subtitle}</p></div>
            <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400" />
          </motion.button>
        );
      })}
    </motion.div>
  );
}

function MeserosView({ selecting, onSelect }: { selecting: string | null; onSelect: (m: TerminalOption) => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {MESEROS.map((m, i) => {
          const n = parseInt(m.terminal_id.replace('MOZO_', ''));
          return (
            <motion.button key={m.terminal_id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }} onClick={() => onSelect(m)} disabled={selecting !== null} className="group aspect-square rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 flex flex-col items-center justify-center gap-1">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: m.accentColor + '20', color: m.accentColor }}>
                {selecting === m.terminal_id ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-2xl font-bold">{n}</span>}
              </div>
              <span className="text-xs text-zinc-500">Mesero</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
