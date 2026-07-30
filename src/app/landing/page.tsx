'use client';

/**
 * Landing Page — FIRMO POS
 * Developed by FreeCloud
 * 
 * Theme: "SISTEMA OPERATIVO GASTRONÓMICO"
 * Redesign: Split Hero, Bento Grid Features, Social Proof & Interactive Product Showcase
 */

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff, Monitor, Receipt, Package,
  ChefHat, ShieldCheck, ArrowRight, Send, Menu, X,
  Smartphone, Clock, CreditCard, Shield, Lock, Activity,
  CheckCircle2, Sparkles, AlertCircle, BarChart3, Store
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { FirmoBrandHeader, WhatsAppIcon } from '@/src/components/icons';

// ============================================================================
// Data Models & Constants
// ============================================================================

const WHATSAPP_URL = 'https://wa.me/51900000000?text=Hola,%20deseo%20solicitar%20una%20demostraci%C3%B3n%20gratuita%20de%20FIRMO%20POS';

const SOCIAL_METRICS = [
  { value: '+50', label: 'Restaurantes en Perú', sub: 'Pollerías y parrillas activas' },
  { value: '99.9%', label: 'Uptime Offline', sub: 'Cero caídas por falta de red' },
  { value: '< 0.8s', label: 'Emisión SUNAT', sub: 'Comprobante directo OSE/PSE' },
  { value: '0%', label: 'Pérdida de Comandas', sub: 'Sincronización idempotente' },
];

const BENTO_FEATURES = [
  {
    id: 'offline',
    title: '100% Offline-First: Tu caja nunca se apaga',
    badge: 'RESILIENCIA TOTAL',
    description: '¿Se fue el internet o la luz en hora punta? FIRMO sigue cobrando, imprimiendo comandas y registrando ventas sin interrupción. Al volver la red, todo se sincroniza automáticamente.',
    className: 'lg:col-span-2 bg-gradient-to-br from-orange-950/40 via-slate-900/90 to-slate-900 border-orange-500/30',
    accentColor: 'text-orange-400',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    icon: WifiOff,
  },
  {
    id: 'sunat',
    title: 'Facturación SUNAT al instante',
    badge: 'SUNAT READY',
    description: 'Emite boletas y facturas electrónicas en menos de 1 segundo. Compatible con boletas simples, agrupadas y envío automático a cliente.',
    className: 'bg-slate-900/80 border-slate-800 hover:border-slate-700',
    accentColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: ShieldCheck,
  },
  {
    id: 'kds',
    title: 'Pantalla KDS para Cocina',
    badge: 'CERO PAPEL',
    description: 'Despacho digital por estaciones (Horno, Parrilla, Bebidas). Cronómetro por pedido y alertas visuales si una mesa se retrasa.',
    className: 'bg-slate-900/80 border-slate-800 hover:border-slate-700',
    accentColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: ChefHat,
  },
  {
    id: 'waiter',
    title: 'Comandera Móvil para Mozos',
    badge: 'MÁXIMA VELOCIDAD',
    description: 'El mozo toma la orden en la mesa desde cualquier smartphone o tablet y los tickets llegan a la cocina antes de que el mozo camine.',
    className: 'bg-slate-900/80 border-slate-800 hover:border-slate-700',
    accentColor: 'text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: Smartphone,
  },
  {
    id: 'inventory',
    title: 'Control de Insumos y Stock FEFO',
    badge: 'CONTROL DE MERMAS',
    description: 'Descuento automático de pollos, papas y bebidas con cada venta. Alerta de reorden antes de quedarte sin insumo clave.',
    className: 'lg:col-span-2 bg-slate-900/80 border-slate-800 hover:border-slate-700',
    accentColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: Package,
  },
];

const SHOWCASE_MODULES = [
  {
    id: 'pos',
    name: 'Caja POS Táctil',
    icon: Monitor,
    tagline: 'Cobro ultrarrápido y cierre de caja sin descuadres',
    stats: [
      { label: 'Tiempo de Boleta', val: '0.8s' },
      { label: 'Modo de Red', val: '100% Offline' },
      { label: 'Medios de Pago', val: 'Efectivo / Yape / Plin / Tarjetas' },
    ],
    previewItems: [
      { qty: '1x', name: '1/2 Pollo a la Brasa + Papas + Ensalada', price: 'S/. 38.00' },
      { qty: '2x', name: 'Inca Kola 1.5L Retornable', price: 'S/. 18.00' },
      { qty: '1x', name: 'Porción Anticuchos (3 palitos)', price: 'S/. 24.00' },
    ],
    total: 'S/. 80.00',
    status: 'Boleta SUNAT emitida — 100% Ok',
  },
  {
    id: 'kds',
    name: 'Pantalla KDS Cocina',
    icon: ChefHat,
    tagline: 'Organización digital de comanda por tiempos y estaciones',
    stats: [
      { label: 'Ahorro de Papel', val: '100% Digital' },
      { label: 'Tiempo Promedio', val: '08:12 min' },
      { label: 'Estaciones', val: 'Horno / Parrilla / Barra' },
    ],
    previewItems: [
      { qty: 'ORDEN #104', name: 'Mesa 05 — 1 Pollo Entero (Bien Dorado)', price: '04:12 min' },
      { qty: 'ORDEN #105', name: 'Mesa 02 — Mollejitas a la Parrilla', price: '02:45 min' },
      { qty: 'ORDEN #106', name: 'Delivery — 1/4 Pollo Parte Pecho', price: 'Marchando' },
    ],
    total: '3 Pedidos Activos',
    status: 'Sincronizado con Mozos < 0.2s',
  },
  {
    id: 'waiter',
    name: 'Comandera de Mozo',
    icon: Smartphone,
    tagline: 'Toma de comanda en mesa rápida, sin papel y sin errores',
    stats: [
      { label: 'Envío a Cocina', val: 'Instantáneo' },
      { label: 'Mapa de Mesas', val: 'Vista en Vivo' },
      { label: 'Operación', val: 'Modo 1 Mano' },
    ],
    previewItems: [
      { qty: 'Mesa 08', name: '4 Comensales — 1/2 Pollo + Porción Papas Extra', price: 'En Mesa' },
      { qty: 'Mesa 12', name: '2 Comensales — Chicha Morada Jarra 1L', price: 'Servido' },
    ],
    total: 'Mesa 08 Activa',
    status: 'Comanda enviada a Horno y Barra',
  },
  {
    id: 'stock',
    name: 'Control Stock FEFO',
    icon: Package,
    tagline: 'Auditoría automática de insumos y mermas en tiempo real',
    stats: [
      { label: 'Auto-86 Agotados', val: 'Automático' },
      { label: 'Control Mermas', val: 'Auditable' },
      { label: 'Criterio Rotación', val: 'FEFO / FIFO' },
    ],
    previewItems: [
      { qty: '45 unid', name: 'Pollos Frescos (Enteros)', price: 'Stock Normal' },
      { qty: '120 kg', name: 'Papa Canchán Seleccionada', price: 'Stock Ok' },
      { qty: '3 baldes', name: 'Aceite Vegetal Balde 18L', price: '⚠️ Reordenar' },
    ],
    total: 'Stock General Auditable',
    status: 'Alerta de Insumos Activa',
  },
];

const PRICING_PLANS = [
  {
    tag: 'ESENCIAL',
    name: 'Plan Básico',
    price: '149',
    period: '/ mes',
    desc: 'Ideal para pollerías y locales de 1 a 2 cajas',
    features: [
      '1 Terminal POS Táctil Creado',
      'Facturación SUNAT Ilimitada',
      'Modo 100% Offline Resiliente',
      'Inventario Básico de Insumos',
      'Soporte Técnico Directo por WhatsApp',
    ],
    highlight: false,
    cta: 'Solicitar Demo',
  },
  {
    tag: 'MÁS POPULAR ENTERPRISE',
    name: 'Plan Pro',
    price: '299',
    period: '/ mes',
    desc: 'Para restaurantes en crecimiento con atención en salón y cocina',
    features: [
      'Hasta 5 Terminales (Caja, Mozos y Cocina KDS)',
      'Facturación SUNAT + Módulo Delivery',
      'Pantalla KDS Cocina & Horno',
      'Comandera Móvil para Mozos',
      'Gestión de Personal & Permisos',
      'Reportes de Ventas & Analítica en Tiempo Real',
    ],
    highlight: true,
    cta: 'Solicitar Demo Pro',
  },
  {
    tag: 'CADENAS & FRANQUICIAS',
    name: 'Plan Enterprise',
    price: 'Personalizado',
    period: '',
    desc: 'Para cadenas de pollerías y grupos gastronómicos multi-local',
    features: [
      'Terminales & Locales Ilimitados',
      'Administración Centralized Multi-Local',
      'API REST & Webhooks para Integraciones',
      'Auditoría Criptográfica de Eventos',
      'Garantía SLA de Disponibilidad 99.99%',
      'Asesor Dedicado e Instalación en Sitio',
    ],
    highlight: false,
    cta: 'Hablar con Asesor',
  },
];

// ============================================================================
// Subcomponents
// ============================================================================

function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <header className="w-full border-b border-slate-800/80 bg-[#0A0E14]/90 backdrop-blur-xl sticky top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FirmoBrandHeader logoSize={44} theme="dark" />
          <span className="hidden sm:inline-block text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
            BY FREECLOUD
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-bold tracking-wider text-slate-300 uppercase">
          <a href="#inicio" className="hover:text-orange-400 transition-colors">Inicio</a>
          <a href="#features" className="hover:text-orange-400 transition-colors">Beneficios</a>
          <a href="#showcase" className="hover:text-orange-400 transition-colors">Sistema</a>
          <a href="#pricing" className="hover:text-orange-400 transition-colors">Planes</a>
          <a href="#contacto" className="hover:text-orange-400 transition-colors">Contacto</a>
        </nav>

        <div className="hidden sm:flex items-center gap-3">
          <a
            href="/login?force=true"
            className="text-xs font-bold tracking-wider uppercase text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-lg transition-all"
          >
            Ingresar al POS
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-black tracking-wider uppercase text-white bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 px-4 py-2 rounded-lg shadow-lg shadow-orange-600/20 transition-all"
          >
            <WhatsAppIcon size={15} />
            Solicitar Demo
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
        <div className="sm:hidden border-b border-slate-800 bg-[#0A0E14] px-6 py-4 space-y-3 font-bold text-xs uppercase tracking-wider text-slate-300">
          <a href="#inicio" onClick={() => setMobileMenu(false)} className="block py-1">Inicio</a>
          <a href="#features" onClick={() => setMobileMenu(false)} className="block py-1">Beneficios</a>
          <a href="#showcase" onClick={() => setMobileMenu(false)} className="block py-1">Sistema</a>
          <a href="#pricing" onClick={() => setMobileMenu(false)} className="block py-1">Planes</a>
          <a href="#contacto" onClick={() => setMobileMenu(false)} className="block py-1">Contacto</a>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="/login?force=true"
              className="w-full text-center py-2.5 rounded-lg bg-slate-900 text-white font-bold border border-slate-800"
            >
              Ingresar al POS
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center py-2.5 rounded-lg bg-orange-600 text-white font-black flex items-center justify-center gap-2"
            >
              <WhatsAppIcon size={16} />
              Solicitar Demo Gratis
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function HeroSection() {
  return (
    <section id="inicio" className="relative pt-10 sm:pt-16 pb-16 sm:pb-24 px-4 sm:px-8 bg-[#0A0E14] text-white border-b border-slate-800/80 overflow-hidden">
      {/* Background Radial Ember Glow */}
      <div className="absolute top-1/3 left-1/4 -translate-x-1/2 w-[550px] h-[400px] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[400px] h-[300px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        {/* Left Column: Value Proposition & CTAs */}
        <div className="lg:col-span-7 text-left space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide uppercase mb-4">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              SISTEMA OPERATIVO GASTRONÓMICO — BY FREECLOUD
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
              Control Total de tu Restaurante.{' '}
              <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                Con o Sin Internet.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
              Caja POS ultra-rápida, comanderas de mozo, cocina KDS y facturación SUNAT en un solo sistema resiliente desarrollado por FreeCloud que nunca se detiene en hora punta.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3.5 items-stretch sm:items-center">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-400 text-white font-black py-3.5 px-7 rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-orange-600/25 transition-all"
              >
                <WhatsAppIcon size={18} />
                Solicitar Demo Gratis
              </a>

              <a
                href="#showcase"
                className="inline-flex items-center justify-center gap-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-bold py-3.5 px-6 rounded-xl border border-slate-700/80 text-xs sm:text-sm uppercase tracking-wider transition-all"
              >
                Ver cómo funciona
                <ArrowRight className="w-4 h-4 text-orange-400" />
              </a>
            </div>

            {/* Trust Proof */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Usado en pollerías y restaurantes de todo el Perú</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span>Facturación SUNAT OSE/PSE Certificada</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Hero Visual Product Mockup */}
        <div className="lg:col-span-5 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 shadow-2xl shadow-orange-600/10 group"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-600/10 via-transparent to-amber-500/10 opacity-60 pointer-events-none" />
            <Image
              src="/images/hero-mockup.png"
              alt="FIRMO POS Terminal Software Interface by FreeCloud"
              width={640}
              height={480}
              priority
              className="w-full h-auto object-cover rounded-2xl group-hover:scale-[1.01] transition-transform duration-500"
            />
            {/* Live Status Overlay Floating Chip */}
            <div className="absolute bottom-4 left-4 right-4 bg-slate-950/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-200 font-bold">Estado: 100% OPERATIVO OFFLINE</span>
              </div>
              <span className="text-orange-400 font-bold">Boleta &lt; 0.8s</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function SocialProofBar() {
  return (
    <section className="py-8 bg-slate-950 border-b border-slate-800/80 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {SOCIAL_METRICS.map((m, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <span className="text-2xl sm:text-4xl font-black text-orange-400 font-mono block">
                {m.value}
              </span>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block mt-1">
                {m.label}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5 font-medium">
                {m.sub}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BentoFeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-8 bg-[#0A0E14] border-b border-slate-800/80 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest block mb-2">
            ARQUITECTURA DE ALTO RENDIMIENTO
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Diseñado para la exigencia real de un restaurante en hora punta
          </h2>
          <p className="mt-3 text-slate-400 text-xs sm:text-sm font-medium">
            Olvídate de sistemas lentos que se caen en pleno almuerzo o cena. FIRMO garantiza velocidad y cero pérdidas.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {BENTO_FEATURES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={[
                  'rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 border relative overflow-hidden',
                  item.className,
                ].join(' ')}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center">
                      <Icon className={`w-6 h-6 ${item.accentColor}`} />
                    </div>
                    <span className={`text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-md border uppercase ${item.badgeBg}`}>
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-slate-300 text-xs sm:text-sm font-normal leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center gap-2 text-xs font-bold text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>Optimizado para alta demanda</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProductShowcaseSection() {
  const [activeTab, setActiveTab] = useState(SHOWCASE_MODULES[0].id);
  const currentModule = SHOWCASE_MODULES.find(m => m.id === activeTab) || SHOWCASE_MODULES[0];

  return (
    <section id="showcase" className="py-16 sm:py-24 px-4 sm:px-8 bg-slate-950 border-b border-slate-800/80 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest block mb-2">
            DEMOSTRACIÓN DE MÓDULOS
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Explora la Operación del Sistema en Vivo
          </h2>
          <p className="mt-2 text-slate-400 text-xs sm:text-sm font-medium">
            Selecciona un módulo para inspeccionar cómo funciona la interfaz en cada área del restaurante
          </p>
        </div>

        {/* Tab Selector Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 border-b border-slate-800 pb-4">
          {SHOWCASE_MODULES.map((m) => {
            const Icon = m.icon;
            const isActive = m.id === activeTab;
            return (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id)}
                className={[
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md shadow-orange-600/20'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {m.name}
              </button>
            );
          })}
        </div>

        {/* Module Screen Preview Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentModule.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6 mb-6">
              <div>
                <span className="text-[10px] font-mono text-orange-400 font-bold uppercase tracking-widest block mb-1">
                  MÓDULO ACTIVO
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">{currentModule.name}</h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5">{currentModule.tagline}</p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs">
                {currentModule.stats.map((s, idx) => (
                  <div key={idx} className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">{s.label}</span>
                    <span className="text-orange-400 font-bold font-mono">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulated Live Interface Component */}
            <div className="bg-black/80 border border-slate-800 rounded-2xl p-5 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-2.5 mb-3 font-bold uppercase text-[11px]">
                <span>Ítem / Comanda</span>
                <span>Estado / Detalle</span>
              </div>

              <div className="space-y-3">
                {currentModule.previewItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-slate-900 pb-2 text-slate-200">
                    <span className="flex items-center gap-2">
                      <strong className="text-orange-400">[{item.qty}]</strong> {item.name}
                    </span>
                    <span className="text-emerald-400 font-bold">{item.price}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-white">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  {currentModule.status}
                </span>
                <span className="text-orange-400 font-mono text-base">{currentModule.total}</span>
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
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-8 bg-[#0A0E14] border-b border-slate-800/80 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 text-center max-w-3xl mx-auto">
          <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest block mb-1">
            INVERSIÓN CLARA Y TRANSPARENTE
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Planes a la Medida de Tu Restaurante
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm font-medium mt-2">
            Sin comisiones por venta, sin cobros sorpresa por comprobantes SUNAT y sin contratos forzosos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {PRICING_PLANS.map((plan) => (
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
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  'w-full py-3.5 rounded-xl font-bold uppercase tracking-wider text-center text-xs transition-all flex items-center justify-center gap-2',
                  plan.highlight
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-600/30 hover:from-orange-500 hover:to-amber-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700',
                ].join(' ')}
              >
                <WhatsAppIcon size={16} />
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
    <section id="contacto" className="py-16 sm:py-24 px-4 sm:px-8 bg-black text-white">
      <div className="max-w-4xl mx-auto bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
        <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest block mb-2">
          DEMOSTRACIÓN PERSONALIZADA
        </span>
        <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
          ¿Listo para dar el siguiente paso en tu Restaurante?
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm font-medium max-w-xl mx-auto mb-8">
          Déjanos los datos de tu negocio y te agendamos una prueba guiada gratuita sin ningún compromiso.
        </p>

        {submitted ? (
          <div className="bg-emerald-950/80 border border-emerald-500/30 p-5 rounded-xl text-emerald-300 font-bold text-xs">
            ¡Muchas gracias! Un especialista de FIRMO POS te contactará a la brevedad.
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
              SOLICITAR DEMO
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
    <div className="min-h-screen bg-[#0A0E14] font-sans text-white antialiased selection:bg-orange-600 selection:text-white">
      <Toaster position="top-right" theme="dark" />
      <Navbar />
      <main>
        <HeroSection />
        <SocialProofBar />
        <BentoFeaturesSection />
        <ProductShowcaseSection />
        <PricingSection />
        <ContactSection />
      </main>
      <footer className="w-full py-6 px-8 text-center text-slate-500 text-xs font-mono border-t border-slate-800 bg-[#0A0E14]">
        <span>FIRMO POS &copy; {new Date().getFullYear()} — Desarrollado por <strong className="text-slate-300">FreeCloud</strong>. Todos los derechos reservados.</span>
      </footer>
    </div>
  );
}
