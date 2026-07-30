'use client';

/**
 * Landing Page — FIRMO POS
 * 
 * Theme: "SISTEMA OPERATIVO GASTRONÓMICO"
 * Hero: "El Ecosistema de Control Unificado" (B2B Executive Enterprise Architecture)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff, Monitor, Receipt, Package,
  ChefHat, Fingerprint, Users, TrendingUp,
  CheckCircle2, ArrowRight, Send, Menu, X, ShieldCheck, Zap,
  Smartphone, Clock, CreditCard, Shield, Lock, Activity
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { FirmoLogo, FirmoBrandHeader, WhatsAppIcon } from '@/src/components/icons';

// ============================================================================
// Interactive Ecosystem Node Graph (The Operating System in Action)
// ============================================================================

function EcosystemVisual() {
  const [activeNode, setActiveNode] = useState<string | null>('pos');

  const NODES = [
    {
      id: 'pos',
      title: 'Caja Principal (POS)',
      sub: 'Motor Central de Venta',
      status: '100% Offline-First',
      icon: Monitor,
      pos: 'col-span-2 md:col-span-1 border-orange-500/50 bg-slate-900/90 shadow-xl shadow-orange-500/10',
    },
    {
      id: 'waiter',
      title: 'Comanderas de Mozo',
      sub: 'Toma de Pedido en Mesa',
      status: 'Sincronizado < 0.2s',
      icon: Smartphone,
      pos: 'bg-slate-900/70 border-slate-800',
    },
    {
      id: 'kds',
      title: 'Pantalla KDS Cocina',
      sub: 'Despacho por Tiempos',
      status: 'Cero Papel',
      icon: ChefHat,
      pos: 'bg-slate-900/70 border-slate-800',
    },
    {
      id: 'sunat',
      title: 'Facturación SUNAT',
      sub: 'Conexión Directa OSE/PSE',
      status: 'Certificado 100%',
      icon: ShieldCheck,
      pos: 'bg-slate-900/70 border-slate-800',
    },
    {
      id: 'pay',
      title: 'Terminal de Pago',
      sub: 'Yape / Plin / Tarjeta',
      status: 'Conciliación Automática',
      icon: CreditCard,
      pos: 'bg-slate-900/70 border-slate-800',
    },
  ];

  return (
    <div className="w-full bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden my-12">
      {/* Background Ember Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 text-center mb-8">
        <span className="text-[10px] font-mono font-bold tracking-widest text-orange-400 uppercase bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
          ECOSISTEMA DE CONTROL UNIFICADO
        </span>
        <h3 className="text-xl sm:text-2xl font-black text-white mt-3">
          El Motor Central del Restaurante Conectado
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto mt-1 font-medium">
          Haz clic en cualquier nodo para verificar la sincronización de datos en tiempo real
        </p>
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto relative z-10">
        {NODES.map((node) => {
          const Icon = node.icon;
          const isSelected = activeNode === node.id;

          return (
            <motion.div
              key={node.id}
              onClick={() => setActiveNode(node.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={[
                'p-5 rounded-2xl border text-left cursor-pointer transition-all relative overflow-hidden',
                node.pos,
                isSelected ? 'border-orange-500 ring-2 ring-orange-500/30 bg-slate-900' : 'hover:border-slate-700',
              ].join(' ')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {node.status}
                </span>
              </div>

              <h4 className="text-white font-bold text-base">{node.title}</h4>
              <p className="text-slate-400 text-xs font-medium mt-0.5">{node.sub}</p>

              {/* Pulsing Ember Line Indicator */}
              {isSelected && (
                <motion.div
                  layoutId="pulse-line"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-amber-400 to-orange-500"
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Live Node Flow Details */}
      <div className="mt-8 pt-6 border-t border-slate-800 text-center font-mono text-xs text-slate-400 flex flex-wrap justify-center items-center gap-6">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Sincronización Idempotente: <strong className="text-white">ACTIVA</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-orange-400" />
          <span>Auditoría Criptográfica: <strong className="text-white">HABILITADA</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <span>Conexión SUNAT: <strong className="text-white">ONLINE / OFFLINE READY</strong></span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Interactive Module Previews
// ============================================================================

const MODULE_PREVIEWS = [
  {
    id: 'pos',
    name: 'Caja Principal (POS)',
    icon: Monitor,
    tagline: 'Cobro ultrarrápido y facturación SUNAT en 1 segundo',
    stats: [
      { label: 'Tiempo de Boleta', val: '0.8s' },
      { label: 'Operación sin Red', val: '100% Offline' },
      { label: 'Métodos de Pago', val: 'Efectivo / Yape / Plin / Tarjeta' },
    ],
    items: [
      { qty: 1, name: '1/2 Pollo a la Brasa + Papas + Ensalada', price: 'S/. 38.00' },
      { qty: 2, name: 'Inca Kola 1.5L Retornable', price: 'S/. 18.00' },
      { qty: 1, name: 'Porción Anticuchos (3 palitos)', price: 'S/. 24.00' },
    ],
    total: 'S/. 80.00',
  },
  {
    id: 'waiter',
    name: 'Comandera de Mozo',
    icon: Smartphone,
    tagline: 'Toma de pedidos en mesa conectada instantáneamente a cocina',
    stats: [
      { label: 'Envío a Cocina', val: '< 0.2s' },
      { label: 'Ergonomía Táctil', val: 'Modo 1 Mano' },
      { label: 'Gestión de Mesas', val: 'Mapa en Vivo' },
    ],
    items: [
      { qty: 1, name: 'Mesa 08 — 4 Personas', price: 'En Atención' },
      { qty: 1, name: '1/4 Pollo Parte Pecho (Papas crujientes)', price: 'Marchando' },
      { qty: 2, name: 'Chicha Morada Jarra 1L', price: 'Servido' },
    ],
    total: 'Mesa Activa',
  },
  {
    id: 'kds',
    name: 'Pantalla KDS Cocina',
    icon: ChefHat,
    tagline: 'Despacho sin papeles, tiempos por plato y alerta por demoras',
    stats: [
      { label: 'Ahorro de Papel', val: '100% Digital' },
      { label: 'Alerta por Demora', val: ' > 12 mins' },
      { label: 'Filtro por Estación', val: 'Horno / Parrilla / Fríos' },
    ],
    items: [
      { qty: 2, name: 'ORDEN #104 — Horno Principal', price: 'Tiempo: 04:12 min' },
      { qty: 1, name: '1 Pollo Entero (Bien Dorado)', price: 'EN PREPARACIÓN' },
      { qty: 1, name: 'Mollejitas a la Parrilla', price: 'LISTO PARA SERVIR' },
    ],
    total: '3 Platos en Marcha',
  },
  {
    id: 'inventory',
    name: 'Control de Stock FEFO',
    tagline: 'Auditoría exacta de insumos clave y mermas en tiempo real',
    icon: Package,
    stats: [
      { label: 'Auto-86 Agotado', val: 'Automático' },
      { label: 'Mermas Registradas', val: '0% Pérdidas' },
      { label: 'Rotación Insumos', val: 'Sistema FEFO' },
    ],
    items: [
      { qty: 45, name: 'Pollos Frescos (Enteros)', price: 'Stock Normal' },
      { qty: 120, name: 'Sacos de Papa Canchán (Kg)', price: 'Stock Ok' },
      { qty: 3, name: 'Aceite Vegetal Balde 18L', price: '⚠️ Reordenar' },
    ],
    total: 'Auditoría Ok',
  },
];

const PRICING = [
  {
    tag: 'ESENCIAL',
    name: 'Básico',
    price: '149',
    period: '/ mes',
    desc: 'Para pollerías y locales de 1 a 2 cajas',
    features: [
      '1 Terminal POS Táctil',
      'Facturación SUNAT Ilimitada',
      'Modo 100% Offline Resiliente',
      'Inventario Básico de Insumos',
      'Soporte directo por WhatsApp',
    ],
    highlight: false,
    cta: 'Solicitar Demo',
  },
  {
    tag: 'RECOMENDADO ENTERPRISE',
    name: 'Pro',
    price: '299',
    period: '/ mes',
    desc: 'Para restaurantes y pollerías en crecimiento con salón',
    features: [
      'Hasta 5 Terminales (Caja, Mozos, Cocina KDS)',
      'Facturación SUNAT + Módulo Delivery',
      'Pantalla KDS Cocina & Parrilla',
      'Autenticación Biométrica & Anti-Fraude',
      'Gestión de Personal & Propinas',
      'Reportes & Analítica en Tiempo Real',
    ],
    highlight: true,
    cta: 'Agendar Demo Enterprise',
  },
  {
    tag: 'CADENAS & FRANQUICIAS',
    name: 'Enterprise',
    price: 'Personalizado',
    period: '',
    desc: 'Para cadenas de pollerías y franquicias multi-local',
    features: [
      'Terminales & Locales Ilimitados',
      'Administración Multi-Local Centralizada',
      'API REST & Webhooks para Integraciones',
      'Auditoría Criptográfica de Eventos',
      'Garantía SLA de Disponibilidad 99.99%',
      'Gerente de Cuenta Dedicado',
    ],
    highlight: false,
    cta: 'Contactar Ventas Enterprise',
  },
];

function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <header className="w-full border-b border-slate-800 bg-[#07080A]/95 backdrop-blur-md sticky top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
        <FirmoBrandHeader logoSize={52} theme="dark" />

        <nav className="hidden md:flex items-center gap-8 text-xs font-bold tracking-wider text-slate-300 uppercase">
          <a href="#ecosistema" className="hover:text-orange-400 transition-colors">Ecosistema</a>
          <a href="#demo-interactive" className="hover:text-orange-400 transition-colors">Módulos</a>
          <a href="#pricing" className="hover:text-orange-400 transition-colors">Planes</a>
          <a href="#contact" className="hover:text-orange-400 transition-colors">Contacto</a>
        </nav>

        <div className="hidden sm:flex items-center gap-3">
          <a
            href="/login?force=true"
            className="text-xs font-bold tracking-wider uppercase text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-lg transition-all"
          >
            Ingresar al POS
          </a>
          <a
            href="https://wa.me/51900000000?text=Hola,%20deseo%20agendar%20una%20demostraci%C3%B3n%20Enterprise%20de%20FIRMO%20POS"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-black tracking-wider uppercase text-white bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-400 px-4 py-2.5 rounded-lg shadow-lg shadow-orange-600/20 transition-all"
          >
            <WhatsAppIcon size={16} />
            Demo Enterprise
          </a>
        </div>

        <button
          onClick={() => setMobileMenu(!mobileMenu)}
          className="sm:hidden p-2 text-white"
          aria-label="Abrir menú"
        >
          {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileMenu && (
        <div className="sm:hidden border-b border-slate-800 bg-[#07080A] px-6 py-5 space-y-4 font-bold text-xs uppercase tracking-wider text-slate-300">
          <a href="#ecosistema" onClick={() => setMobileMenu(false)} className="block py-1">Ecosistema</a>
          <a href="#demo-interactive" onClick={() => setMobileMenu(false)} className="block py-1">Módulos</a>
          <a href="#pricing" onClick={() => setMobileMenu(false)} className="block py-1">Planes</a>
          <a href="#contact" onClick={() => setMobileMenu(false)} className="block py-1">Contacto</a>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="/login?force=true"
              className="w-full text-center py-3 rounded-lg bg-slate-900 text-white font-bold border border-slate-800"
            >
              Ingresar al POS
            </a>
            <a
              href="https://wa.me/51900000000?text=Hola,%20deseo%20una%20demostraci%C3%B3n"
              className="w-full text-center py-3 rounded-lg bg-orange-600 text-white font-black"
            >
              Demo Enterprise
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="ecosistema" className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-8 bg-[#07080A] text-white border-b border-slate-800/80 overflow-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[450px] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Exact Verbatim Selected Slogan */}
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide uppercase mb-6 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            SISTEMA OPERATIVO GASTRONÓMICO
          </div>

          {/* Headline B2B Executive */}
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.08] max-w-5xl mx-auto text-white">
            EL MOTOR CENTRAL DE TU RESTAURANTE <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 bg-clip-text text-transparent">ENTERPRISE</span>.
          </h1>

          {/* Sub-headline */}
          <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
            El ecosistema de control unificado: resiliencia 100% offline-first, facturación SUNAT instantánea, KDS de cocina y auditoría criptográfica en tiempo real.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://wa.me/51900000000?text=Hola,%20deseo%20agendar%20una%20demostraci%C3%B3n%20Enterprise%20de%20FIRMO%20POS"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-400 text-white font-black py-4 px-8 rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-orange-600/30 transition-all"
            >
              <WhatsAppIcon size={18} />
              AGENDAR DEMOSTRACIÓN ENTERPRISE
            </a>

            <a
              href="/login?force=true"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900/90 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl border border-slate-700 text-xs sm:text-sm uppercase tracking-wider transition-all"
            >
              PROBAR TERMINAL POS
              <ArrowRight className="w-4 h-4 text-orange-400" />
            </a>
          </div>
        </motion.div>

        {/* Central Visual Architecture Diagram */}
        <EcosystemVisual />

        {/* Value Proposition Badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold text-slate-400">
          <div className="flex items-center gap-2 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-800">
            <ShieldCheck className="w-4 h-4 text-orange-400" />
            Seguridad Criptográfica
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-800">
            <WifiOff className="w-4 h-4 text-emerald-400" />
            Resiliencia 100% Offline-First
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            Certificado SUNAT Ready
          </div>
        </div>
      </div>
    </section>
  );
}

function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState(MODULE_PREVIEWS[0].id);
  const currentModule = MODULE_PREVIEWS.find(m => m.id === activeTab) || MODULE_PREVIEWS[0];

  return (
    <section id="demo-interactive" className="py-16 sm:py-24 px-4 sm:px-8 bg-slate-950 border-b border-slate-800 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest block mb-2">ARQUITECTURA DE MÓDULOS</span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
            Inspección de Módulos del Sistema
          </h2>
          <p className="mt-3 text-slate-400 text-xs sm:text-sm font-medium">
            Selecciona un módulo para inspeccionar la interfaz operativa en tiempo real
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 border-b border-slate-800 pb-4">
          {MODULE_PREVIEWS.map((m) => {
            const Icon = m.icon;
            const isActive = m.id === activeTab;
            return (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id)}
                className={[
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {m.name}
              </button>
            );
          })}
        </div>

        {/* Module Screen Preview Sandbox */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentModule.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6 mb-6">
              <div>
                <span className="text-[10px] font-mono text-orange-400 font-bold uppercase tracking-widest block mb-1">MÓDULO SELECCIONADO</span>
                <h3 className="text-xl sm:text-2xl font-black text-white">{currentModule.name}</h3>
                <p className="text-slate-400 text-xs mt-1">{currentModule.tagline}</p>
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                {currentModule.stats.map(s => (
                  <div key={s.label} className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">{s.label}</span>
                    <span className="text-orange-400 font-bold font-mono">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulated Live Orders Table */}
            <div className="bg-black/80 border border-slate-800 rounded-2xl p-4 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-500 border-b border-slate-800 pb-2 mb-3 font-bold uppercase">
                <span>Cant / Insumo</span>
                <span>Estado</span>
              </div>
              <div className="space-y-2.5">
                {currentModule.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-slate-900 pb-2 text-slate-200">
                    <span className="flex items-center gap-2">
                      <strong className="text-orange-400">[{item.qty}x]</strong> {item.name}
                    </span>
                    <span className="text-emerald-400 font-bold">{item.price}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-white">
                <span>ESTADO DE OPERACIÓN</span>
                <span className="text-orange-400">{currentModule.total}</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-8 bg-[#07080A] border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 text-left border-b border-slate-800 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest block mb-1">INVERSIÓN TRANSPARENTE ENTERPRISE</span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              Planes en Soles Peruanos
            </h2>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm font-medium">
            Sin contratos de permanencia ni comisiones ocultas por venta.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={[
                'rounded-2xl p-7 flex flex-col justify-between transition-all bg-slate-900/60 relative',
                plan.highlight
                  ? 'border-2 border-orange-500 shadow-2xl shadow-orange-600/20'
                  : 'border border-slate-800 shadow-xs',
              ].join(' ')}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-bold tracking-widest uppercase px-2.5 py-1 bg-slate-800 text-orange-400 rounded">
                    {plan.tag}
                  </span>
                </div>

                <h3 className="text-white font-black text-2xl mb-1">{plan.name}</h3>
                <p className="text-slate-400 text-xs font-medium mb-6">{plan.desc}</p>

                <div className="flex items-baseline gap-1 mb-6 border-b border-slate-800 pb-6">
                  <span className="text-slate-400 text-base font-bold">S/.</span>
                  <span className="text-white font-black text-4xl sm:text-5xl font-mono tracking-tight">{plan.price}</span>
                  <span className="text-slate-400 text-xs font-semibold">{plan.period}</span>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href="https://wa.me/51900000000?text=Hola,%20deseo%20agendar%20informacion%20del%20plan%20"
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  'w-full py-3.5 rounded-xl font-bold uppercase tracking-wider text-center text-xs transition-all',
                  plan.highlight
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-600/30 hover:from-orange-500 hover:to-amber-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700',
                ].join(' ')}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast.success('¡Solicitud enviada! Nos comunicaremos en breve.');
  };

  return (
    <section id="contact" className="py-16 sm:py-24 px-4 sm:px-8 bg-black text-white">
      <div className="max-w-4xl mx-auto bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
        <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest block mb-2">DEMOSTRACIÓN GUIADA ENTERPRISE</span>
        <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
          Equipa tu Restaurante con FIRMO POS
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm font-medium max-w-xl mx-auto mb-8">
          Déjanos los datos de tu local y agendamos una prueba guiada en vivo con el equipo Enterprise.
        </p>

        {submitted ? (
          <div className="bg-emerald-950/80 border border-emerald-500/30 p-4 rounded-xl text-emerald-300 font-bold text-xs">
            ¡Muchas gracias! Un especialista Enterprise de FIRMO POS se contactará en breve.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              required
              placeholder="Nombre del Restaurante"
              className="h-12 bg-slate-950 border border-slate-800 rounded-xl px-4 text-white text-xs focus:outline-none focus:border-orange-500 transition-colors"
            />
            <input
              type="tel"
              required
              placeholder="Teléfono / WhatsApp"
              className="h-12 bg-slate-950 border border-slate-800 rounded-xl px-4 text-white text-xs focus:outline-none focus:border-orange-500 transition-colors"
            />
            <button
              type="submit"
              className="h-12 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30"
            >
              AGENDAR DEMO
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07080A] font-sans text-white antialiased selection:bg-orange-600 selection:text-white">
      <Toaster position="top-right" theme="dark" />
      <Navbar />
      <main>
        <Hero />
        <InteractiveDemo />
        <PricingSection />
        <ContactSection />
      </main>
      <footer className="w-full py-6 px-8 text-center text-slate-500 text-xs font-mono border-t border-slate-800 bg-[#07080A]">
        <span>FIRMO POS &copy; {new Date().getFullYear()} — Gastronomic Operating System for Enterprise Restaurants</span>
      </footer>
    </div>
  );
}
