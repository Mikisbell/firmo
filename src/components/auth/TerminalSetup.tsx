'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDeviceFingerprint, setStoredTerminalConfig } from '@/src/core/auth/fingerprint';
import { generateFingerprintV2, type FingerprintResult } from '@/src/core/auth/fingerprint-v2';
import { getOrCreateDeviceId } from '@/src/core/auth/device-id';
import type { TerminalConfig, TerminalRole } from '@/src/core/auth/types';
import { Monitor, ChefHat, Wine, Loader2, Flame, Package, ArrowRight, ArrowLeft, Settings, Users, Sparkles, Key } from 'lucide-react';

interface TerminalSetupProps { 
  /** @deprecated Navigation now happens internally using window.location.href */
  onComplete?: (config: TerminalConfig) => void; 
}
interface TerminalOption { terminal_id: string; role: TerminalRole; label: string; accentColor: string; }
type ViewMode = 'roles' | 'meseros' | 'activation';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MESERO_COLORS = ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#14b8a6','#22c55e','#84cc16','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#78716c','#64748b','#0ea5e9'];

/**
 * Get the correct route for a terminal based on its ID and role
 * Requirement 7.2: Navigate directly to role-specific route
 */
function getRoleRoute(terminalId: string, role: TerminalRole): string {
  // CAJA_* → /pos
  if (terminalId.startsWith('CAJA_')) {
    return '/pos';
  }
  
  // MOZO_* → /mozo
  if (terminalId.startsWith('MOZO_')) {
    return '/mozo';
  }
  
  // SPC_HORNO → /cocina/horno
  if (terminalId === 'SPC_HORNO') {
    return '/cocina/horno';
  }
  
  // SPC_COCINA → /cocina
  if (terminalId === 'SPC_COCINA') {
    return '/cocina';
  }
  
  // SPC_BAR → /bar
  if (terminalId === 'SPC_BAR') {
    return '/bar';
  }
  
  // SPC_EMPAQUE → /cocina/empaque
  if (terminalId === 'SPC_EMPAQUE') {
    return '/cocina/empaque';
  }
  
  // Fallback based on role
  switch (role) {
    case 'CASHIER':
      return '/pos';
    case 'WAITER':
      return '/mozo';
    case 'KDS':
      return '/cocina';
    case 'BAR':
      return '/bar';
    default:
      return '/';
  }
}

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
  { id: 'CAJA_01', role: 'CASHIER' as TerminalRole, title: 'Caja', subtitle: 'Cobros y cierre', icon: Monitor, color: '#10b981', gradient: 'from-emerald-500 to-teal-600', shadowColor: 'shadow-emerald-500/20', isGroup: false },
  { id: 'meseros', role: 'WAITER' as TerminalRole, title: 'Meseros', subtitle: '15 terminales', icon: Users, color: '#8b5cf6', gradient: 'from-violet-500 to-purple-600', shadowColor: 'shadow-violet-500/20', isGroup: true },
  { id: 'SPC_HORNO', role: 'KDS' as TerminalRole, title: 'Horno', subtitle: 'Parrilla', icon: Flame, color: '#f97316', gradient: 'from-orange-500 to-red-600', shadowColor: 'shadow-orange-500/20', isGroup: false },
  { id: 'SPC_COCINA', role: 'KDS' as TerminalRole, title: 'Cocina', subtitle: 'Guarniciones', icon: ChefHat, color: '#eab308', gradient: 'from-yellow-500 to-amber-600', shadowColor: 'shadow-yellow-500/20', isGroup: false },
  { id: 'SPC_BAR', role: 'BAR' as TerminalRole, title: 'Bar', subtitle: 'Bebidas', icon: Wine, color: '#0ea5e9', gradient: 'from-sky-500 to-blue-600', shadowColor: 'shadow-sky-500/20', isGroup: false },
  { id: 'SPC_EMPAQUE', role: 'KDS' as TerminalRole, title: 'Empaque', subtitle: 'Delivery', icon: Package, color: '#10b981', gradient: 'from-emerald-500 to-green-600', shadowColor: 'shadow-emerald-500/20', isGroup: false },
];

// Floating particles for background effect
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(25)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${i % 3 === 0 ? 'w-2 h-2 bg-emerald-500/20' : i % 3 === 1 ? 'w-1.5 h-1.5 bg-teal-500/25' : 'w-1 h-1 bg-cyan-500/30'}`}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -100 - Math.random() * 100],
            x: [0, (Math.random() - 0.5) * 50],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 5 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 4,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Animated grid background
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(rgba(16, 185, 129, 0.5) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(16, 185, 129, 0.5) 1px, transparent 1px)`,
        backgroundSize: '50px 50px',
      }} />
    </div>
  );
}

export function TerminalSetup({ onComplete }: TerminalSetupProps) {
  const [view, setView] = useState<ViewMode>('roles');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [fingerprint, setFingerprint] = useState<FingerprintResult | null>(null);
  const [pendingTerminal, setPendingTerminal] = useState<{ id: string; role: TerminalRole; label: string } | null>(null);

  useEffect(() => { 
    // Generate fingerprint on mount
    const init = async () => {
      try {
        const fp = await generateFingerprintV2();
        setFingerprint(fp);
        setLoading(false);
      } catch (err) {
        console.error('Failed to generate fingerprint:', err);
        setError('Error al generar fingerprint del dispositivo');
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSelect = async (id: string, role: TerminalRole, label: string) => {
    if (selecting) return;
    setSelecting(id); 
    setError('');
    
    try {
      // Get or create device ID
      const deviceId = getOrCreateDeviceId();
      
      // Check if device is already bound to a terminal
      const validateResponse = await fetch('/api/terminals/validate-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          terminal_id: id,
        }),
      });

      if (validateResponse.ok) {
        // Device is already bound to this terminal - proceed directly
        const { terminal } = await validateResponse.json();
        const oldFp = await generateDeviceFingerprint();
        const cfg: TerminalConfig = { 
          terminal_id: id, 
          tenant_id: TENANT_ID, 
          actor_id: generateActorId(id), 
          device_fingerprint: oldFp, 
          device_name: label, 
          role, 
          location_id: 'LOC01', 
          is_allowed: true, 
          registered_at: new Date().toISOString() 
        };
        setStoredTerminalConfig(cfg);
        
        // Use hard navigation to role-specific route
        const targetRoute = getRoleRoute(id, role);
        window.location.href = targetRoute;
        return;
      }

      // If not bound, show activation code screen
      setPendingTerminal({ id, role, label });
      setView('activation');
      setSelecting(null);
    } catch (err) {
      console.error('Terminal validation error:', err);
      setError('Error de conexión. Verifica tu red.');
      setSelecting(null);
    }
  };

  const handleActivation = async (code: string) => {
    if (!pendingTerminal) return;
    
    setSelecting('activating');
    setError('');

    try {
      // Get or create device ID
      const deviceId = getOrCreateDeviceId();
      
      // Use the new activate-simple endpoint with device_id
      const response = await fetch('/api/terminals/activate-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminal_id: pendingTerminal.id,
          code: code.replace(/-/g, ''), // Remove formatting
          device_id: deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Error al activar terminal');
        setSelecting(null);
        return;
      }

      // Activation successful - create config and navigate
      const oldFp = await generateDeviceFingerprint(); // For backward compatibility
      const cfg: TerminalConfig = {
        terminal_id: pendingTerminal.id,
        tenant_id: TENANT_ID,
        actor_id: generateActorId(pendingTerminal.id),
        device_fingerprint: oldFp,
        device_name: pendingTerminal.label,
        role: pendingTerminal.role,
        location_id: 'LOC01',
        is_allowed: true,
        registered_at: new Date().toISOString(),
      };
      setStoredTerminalConfig(cfg);
      
      // Use hard navigation to role-specific route (Requirement 7.2, 7.4)
      const targetRoute = getRoleRoute(pendingTerminal.id, pendingTerminal.role);
      window.location.href = targetRoute;
    } catch (err) {
      console.error('Activation error:', err);
      setError('Error de conexión. Verifica tu red.');
      setSelecting(null);
    }
  };

  const handleRole = (c: typeof ROLE_CARDS[0]) => { 
    if (c.isGroup) setView('meseros'); 
    else handleSelect(c.id, c.role, c.title); 
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/30 via-zinc-950 to-zinc-950" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-zinc-800 border-t-emerald-500 rounded-full"
          />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-zinc-950 to-zinc-950" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      <GridBackground />
      <FloatingParticles />

      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-2xl sticky top-0 z-40 relative"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5" />
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              {(view === 'meseros' || view === 'activation') && (
                <motion.button 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => {
                    if (view === 'activation') {
                      setPendingTerminal(null);
                      setError('');
                    }
                    setView('roles');
                  }} 
                  className="p-2 -ml-2 rounded-xl hover:bg-zinc-800/50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-zinc-400" />
                </motion.button>
              )}
            </AnimatePresence>
            
            {/* Logo with glow effect */}
            <motion.div 
              className="relative"
              animate={{ 
                filter: ['drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))', 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.5))', 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))']
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
              <img 
                src="/logo.svg" 
                alt="PARK POS" 
                className="w-12 h-12 relative z-10"
              />
            </motion.div>
            
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">PARK</span>
                <span className="text-white ml-1">POS</span>
              </h1>
              <p className="text-xs text-zinc-500">
                {view === 'roles' ? 'Selecciona tu estación' : view === 'meseros' ? 'Selecciona tu número' : 'Código de activación'}
              </p>
            </div>
          </div>
          
          <motion.a 
            href="/admin" 
            whileHover={{ scale: 1.05, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/50 transition-all"
          >
            <Settings className="w-5 h-5" />
          </motion.a>
        </div>
      </motion.header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {view === 'roles' ? (
              <RolesView key="roles" selecting={selecting} onSelect={handleRole} />
            ) : view === 'meseros' ? (
              <MeserosView key="meseros" selecting={selecting} onSelect={m => handleSelect(m.terminal_id, m.role, m.label)} />
            ) : (
              <ActivationView 
                key="activation" 
                selecting={selecting === 'activating'} 
                onSubmit={handleActivation}
                terminalName={pendingTerminal?.label || ''}
              />
            )}
          </AnimatePresence>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
            >
              {error}
            </motion.div>
          )}
          
          {view === 'roles' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-8 flex justify-center"
            >
              <motion.a 
                href="/inventario" 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/30 text-zinc-400 hover:text-emerald-400 text-sm transition-all relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Package className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Inventario</span>
                <motion.div
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <ArrowRight className="w-3 h-3 relative z-10" />
                </motion.div>
              </motion.a>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
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

function RolesView({ selecting, onSelect }: { selecting: string | null; onSelect: (c: typeof ROLE_CARDS[0]) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0, x: -20 }} 
      className="space-y-3"
    >
      {/* Title */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </motion.div>
          <span className="text-sm text-zinc-400">¿Qué rol desempeñas hoy?</span>
          <motion.div animate={{ rotate: [0, -15, 15, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </motion.div>
        </div>
      </motion.div>

      {ROLE_CARDS.map((c, i) => {
        const Icon = c.icon;
        const isSelecting = selecting === c.id;
        
        return (
          <motion.button 
            key={c.id} 
            initial={{ opacity: 0, y: 20, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }} 
            onClick={() => onSelect(c)} 
            disabled={selecting !== null}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group w-full relative overflow-hidden"
          >
            {/* Animated border gradient */}
            <motion.div 
              className={`absolute -inset-[1px] bg-gradient-to-r ${c.gradient} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              animate={isSelecting ? { opacity: [0.5, 1, 0.5] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
            
            {/* Glow effect on hover */}
            <div className={`absolute -inset-4 bg-gradient-to-r ${c.gradient} rounded-3xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />
            
            <div className="relative flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/95 backdrop-blur-sm border border-transparent group-hover:bg-zinc-900/80 transition-all">
              {/* Icon container with gradient and pulse */}
              <motion.div 
                className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg ${c.shadowColor}`}
                whileHover={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.5 }}
              >
                <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                {isSelecting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-6 h-6 text-white" />
                  </motion.div>
                ) : (
                  <Icon className="w-6 h-6 text-white relative z-10" />
                )}
              </motion.div>
              
              <div className="flex-1 text-left">
                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-50 transition-colors">
                  {c.title}
                </h3>
                <p className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">{c.subtitle}</p>
              </div>
              
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
              </motion.div>
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

function MeserosView({ selecting, onSelect }: { selecting: string | null; onSelect: (m: TerminalOption) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 20 }}
    >
      {/* Title */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Users className="w-4 h-4 text-violet-500" />
          </motion.div>
          <span className="text-sm text-zinc-400">Selecciona tu número de mesero</span>
          <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}>
            <Users className="w-4 h-4 text-violet-500" />
          </motion.div>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {MESEROS.map((m, i) => {
          const n = parseInt(m.terminal_id.replace('MOZO_', ''));
          const isSelecting = selecting === m.terminal_id;
          
          return (
            <motion.button 
              key={m.terminal_id} 
              initial={{ opacity: 0, scale: 0.5, rotate: -10 }} 
              animate={{ opacity: 1, scale: 1, rotate: 0 }} 
              transition={{ delay: i * 0.04, type: "spring", stiffness: 300 }} 
              onClick={() => onSelect(m)} 
              disabled={selecting !== null}
              whileHover={{ scale: 1.08, y: -4, rotate: 2 }}
              whileTap={{ scale: 0.92 }}
              className="group aspect-square relative"
            >
              {/* Animated glow effect */}
              <motion.div 
                className="absolute -inset-1 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity"
                style={{ backgroundColor: m.accentColor }}
                animate={isSelecting ? { opacity: [0.3, 0.6, 0.3] } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              
              {/* Border gradient on hover */}
              <div 
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity p-[1px]"
                style={{ background: `linear-gradient(135deg, ${m.accentColor}, transparent)` }}
              >
                <div className="w-full h-full rounded-2xl bg-zinc-900" />
              </div>
              
              <div className="relative h-full rounded-2xl bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 group-hover:border-transparent flex flex-col items-center justify-center gap-1 transition-all overflow-hidden">
                {/* Shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                </div>
                
                <motion.div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all relative z-10" 
                  style={{ backgroundColor: m.accentColor + '20', color: m.accentColor }}
                  whileHover={{ scale: 1.1 }}
                >
                  {isSelecting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <span className="text-2xl font-bold">{n}</span>
                  )}
                </motion.div>
                <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors relative z-10">Mesero</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function ActivationView({ selecting, onSubmit, terminalName }: { selecting: boolean; onSubmit: (code: string) => void; terminalName: string }) {
  const [code, setCode] = useState('');
  const [formattedCode, setFormattedCode] = useState('');

  const handleCodeChange = (value: string) => {
    // Remove non-digits and dashes
    const digits = value.replace(/[^0-9]/g, '');
    
    // Limit to 6 digits
    const limited = digits.slice(0, 6);
    setCode(limited);
    
    // Format as XXX-XXX
    if (limited.length > 3) {
      setFormattedCode(`${limited.slice(0, 3)}-${limited.slice(3)}`);
    } else {
      setFormattedCode(limited);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6 && !selecting) {
      onSubmit(code);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md mx-auto"
    >
      {/* Title */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="inline-block mb-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Key className="w-8 h-8 text-white" />
          </div>
        </motion.div>
        
        <h2 className="text-2xl font-bold text-white mb-2">
          Activar Terminal
        </h2>
        <p className="text-sm text-zinc-400 mb-1">
          {terminalName}
        </p>
        <p className="text-xs text-zinc-500">
          Ingresa el código de activación de 6 dígitos
        </p>
      </motion.div>

      {/* Activation form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="activation-code" className="block text-sm font-medium text-zinc-400 mb-2">
            Código de Activación
          </label>
          <input
            id="activation-code"
            type="text"
            value={formattedCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="XXX-XXX"
            disabled={selecting}
            autoFocus
            className="w-full px-4 py-4 text-center text-2xl font-mono tracking-widest rounded-xl bg-zinc-900/90 border-2 border-zinc-800 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-2 text-xs text-zinc-500 text-center">
            Solicita el código al administrador
          </p>
        </div>

        <motion.button
          type="submit"
          disabled={code.length !== 6 || selecting}
          whileHover={code.length === 6 && !selecting ? { scale: 1.02 } : {}}
          whileTap={code.length === 6 && !selecting ? { scale: 0.98 } : {}}
          className="w-full relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Animated border gradient */}
          <motion.div 
            className="absolute -inset-[1px] bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            animate={selecting ? { opacity: [0.5, 1, 0.5] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
          
          {/* Glow effect */}
          <div className="absolute -inset-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
          
          <div className="relative flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold">
            {selecting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-5 h-5" />
                </motion.div>
                <span>Activando...</span>
              </>
            ) : (
              <>
                <Key className="w-5 h-5" />
                <span>Activar Terminal</span>
              </>
            )}
          </div>
        </motion.button>
      </form>

      {/* Info box */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800"
      >
        <p className="text-xs text-zinc-500 leading-relaxed">
          <span className="text-amber-500 font-semibold">💡 Nota:</span> El código de activación vincula este dispositivo al terminal seleccionado. 
          Solo necesitas hacerlo una vez por dispositivo.
        </p>
      </motion.div>
    </motion.div>
  );
}
