'use client';

/**
 * Landing Page — FIRMO POS
 * 
 * Kaizen (改善) Philosophy: Continuous Improvement, Zero Waste, Operational Precision.
 * Best of Toast POS (Operations), Square (Visual Clarity), Foodics (Interactive Previews), Lightspeed (Stock Control).
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff, Monitor, Receipt, Package,
  ChefHat, Fingerprint, Users, TrendingUp,
  CheckCircle2, ArrowRight, Send, Menu, X, ShieldCheck, Zap,
  Smartphone, Clock, SlidersHorizontal
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { FirmoLogo, WhatsAppIcon } from '@/src/components/icons';

// ============================================================================
// Interactive Module Demos (Kaizen Precision)
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
      { label: 'Metodos de Pago', val: 'Efectivo / Yape / Plin / Tarjeta' },
    ],
    items: [
      { qty: 1, name: '1/2 Pollo a la Brasa + Papas + Ensalada', price: 'S/. 38.00' },
      { qty: 2, name: 'Inca Kola 1.5L Retornable', price: 'S/. 18.00' },
      { qty: 1, name: 'Porción Porción Anticuchos (3 palitos)', price: 'S/. 24.00' },
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

const KAIZEN_PILLARS = [
  {
    num: '01',
    title: 'Cero Desperdicio Operativo (Muda)',
    desc: 'Elimina las comandas perdidas de papel, los errores de digitación en caja y el tiempo muerto de los mozos caminando a la cocina.',
  },
  {
    num: '02',
    title: 'Resiliencia Extrema Offline',
    desc: 'Si la fibra óptica se corta o la nube falla, la caja sigue cobrando e imprimiendo comprobantes al instante sin perder un solo centavo.',
  },
  {
    num: '03',
    title: 'Protección Anti-Fraude Criptográfica',
    desc: 'Bloqueo automático por inactividad, huella biométrica WebAuthn y validación de supervisor para anulaciones y cortesías.',
  },
  {
    num: '04',
    title: 'Facturación SUNAT en 1 Segundo',
    desc: 'Conexión directa a la OSE/PSE oficial para emisión instantánea de boletas y facturas sin cuellos de botella.',
  },
];

const PRICING = [
  {
    tag: 'ESENCIAL',
    name: 'Básico',
    price: '149',
    period: '/ mes',
    desc: 'Para pollerías locales con 1-2 cajas',
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
    tag: 'RECOMENDADO KAIZEN',
    name: 'Pro',
    price: '299',
    period: '/ mes',
    desc: 'Para pollerías y restaurantes en crecimiento con salón',
    features: [
      'Hasta 5 Terminales (Caja, Mozos, Cocina KDS)',
      'Facturación SUNAT + Módulo Delivery',
      'Pantalla KDS Cocina & Parrilla',
      'Autenticación Biométrica & Anti-Fraude',
      'Gestión de Personal & Propinas',
      'Reportes & Analítica en Tiempo Real',
    ],
    highlight: true,
    cta: 'Probar Plan Pro',
  },
  {
    tag: 'FRANQUICIAS',
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
    cta: 'Contactar Ventas',
  },
];

function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <header className="w-full border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FirmoLogo size={54} className="-mr-1" />
          <div className="flex flex-col justify-center">
            <span className="font-black text-xl tracking-tight text-slate-900 leading-none">
              FIRMO <span className="text-orange-600">POS</span>
            </span>
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase mt-1">
              Kaizen Operating System
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-bold tracking-wider text-slate-600 uppercase">
          <a href="#demo-interactive" className="hover:text-orange-600 transition-colors">Simulador</a>
          <a href="#kaizen" className="hover:text-orange-600 transition-colors">Filosofía</a>
          <a href="#pricing" className="hover:text-orange-600 transition-colors">Planes</a>
          <a href="#contact" className="hover:text-orange-600 transition-colors">Contacto</a>
        </nav>

        <div className="hidden sm:flex items-center gap-3">
          <a
            href="/login?force=true"
            className="text-xs font-bold tracking-wider uppercase text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg transition-all"
          >
            Ingresar al POS
          </a>
          <a
            href="https://wa.me/51900000000?text=Hola,%20deseo%20una%20demostraci%C3%B3n%20de%20FIRMO%20POS"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-black tracking-wider uppercase text-white bg-orange-600 hover:bg-orange-700 px-4 py-2.5 rounded-lg shadow-sm transition-all"
          >
            <WhatsAppIcon size={16} />
            Demo WhatsApp
          </a>
        </div>

        <button
          onClick={() => setMobileMenu(!mobileMenu)}
          className="sm:hidden p-2 text-slate-800"
          aria-label="Abrir menú"
        >
          {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileMenu && (
        <div className="sm:hidden border-b border-slate-200 bg-white px-6 py-5 space-y-4 font-bold text-xs uppercase tracking-wider text-slate-700">
          <a href="#demo-interactive" onClick={() => setMobileMenu(false)} className="block py-1">Simulador</a>
          <a href="#kaizen" onClick={() => setMobileMenu(false)} className="block py-1">Filosofía</a>
          <a href="#pricing" onClick={() => setMobileMenu(false)} className="block py-1">Planes</a>
          <a href="#contact" onClick={() => setMobileMenu(false)} className="block py-1">Contacto</a>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="/login?force=true"
              className="w-full text-center py-3 rounded-lg bg-slate-100 text-slate-900 font-bold"
            >
              Ingresar al POS
            </a>
            <a
              href="https://wa.me/51900000000?text=Hola,%20deseo%20una%20demostraci%C3%B3n"
              className="w-full text-center py-3 rounded-lg bg-orange-600 text-white font-black"
            >
              Demo WhatsApp
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-20 px-4 sm:px-8 bg-slate-50/60 border-b border-slate-200">
      <div className="max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-800 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide uppercase mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
            Mejora Continua (Kaizen) para Pollerías y Parrilleras
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.08] max-w-4xl mx-auto">
            La precisión del sistema operativo diseñado para tu <span className="text-orange-600">Pollería</span>.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Elimina el desperdicio operativo, acelera la emisión de boletas SUNAT y protege tu caja con resiliencia 100% offline.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3.5 justify-center items-center">
            <a
              href="https://wa.me/51900000000?text=Hola,%20deseo%20una%20demostraci%C3%B3n%20gratuita%20de%20FIRMO%20POS"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black py-4 px-8 rounded-lg text-xs sm:text-sm uppercase tracking-wider shadow-sm transition-all"
            >
              <WhatsAppIcon size={18} />
              Solicitar Demo por WhatsApp
            </a>

            <a
              href="/login?force=true"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-800 font-bold py-4 px-8 rounded-lg border border-slate-300 text-xs sm:text-sm uppercase tracking-wider transition-all"
            >
              Probar Terminal POS
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState(MODULE_PREVIEWS[0].id);
  const currentModule = MODULE_PREVIEWS.find(m => m.id === activeTab) || MODULE_PREVIEWS[0];

  return (
    <section id="demo-interactive" className="py-16 sm:py-24 px-4 sm:px-8 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-mono font-bold text-orange-600 uppercase tracking-widest block mb-2">EXPERIENCIA INTERACTIVA</span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Explora las Estaciones del Sistema
          </h2>
          <p className="mt-3 text-slate-500 text-xs sm:text-sm font-medium">
            Selecciona un módulo para inspeccionar su interfaz y métricas operativas
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 border-b border-slate-200 pb-4">
          {MODULE_PREVIEWS.map((m) => {
            const Icon = m.icon;
            const isActive = m.id === activeTab;
            return (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id)}
                className={[
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600',
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
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6 mb-6">
              <div>
                <span className="text-[10px] font-mono text-orange-400 font-bold uppercase tracking-widest block mb-1">MÓDULO SELECCIONADO</span>
                <h3 className="text-xl sm:text-2xl font-black">{currentModule.name}</h3>
                <p className="text-slate-400 text-xs mt-1">{currentModule.tagline}</p>
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                {currentModule.stats.map(s => (
                  <div key={s.label} className="bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">{s.label}</span>
                    <span className="text-orange-400 font-bold font-mono">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulated Live Orders Table */}
            <div className="bg-zinc-950 border border-slate-800 rounded-xl p-4 font-mono text-xs">
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

function KaizenPillarsSection() {
  return (
    <section id="kaizen" className="py-16 sm:py-24 px-4 sm:px-8 bg-slate-50/50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 text-left border-b border-slate-200 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-xs font-mono font-bold text-orange-600 uppercase tracking-widest block mb-1">FILOSOFÍA KAIZEN (改善)</span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Los 4 Pilares de la Excelencia Operativa
            </h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-md">
            Optimizaciones pequeñas e incesantes para garantizar velocidad y cero pérdidas en tu local.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {KAIZEN_PILLARS.map(p => (
            <div key={p.num} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 hover:border-slate-400 transition-all flex gap-5">
              <span className="font-mono text-2xl font-black text-orange-600 leading-none">{p.num}</span>
              <div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">{p.title}</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-normal">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-8 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 text-left border-b border-slate-200 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-xs font-mono font-bold text-orange-600 uppercase tracking-widest block mb-1">INVERSIÓN TRANSPARENTE</span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Planes en Soles Peruanos
            </h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            Sin comisiones por venta ni contratos de permanencia.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={[
                'rounded-xl p-7 flex flex-col justify-between transition-all bg-white relative',
                plan.highlight
                  ? 'border-2 border-orange-600 shadow-md'
                  : 'border border-slate-200 shadow-xs',
              ].join(' ')}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-bold tracking-widest uppercase px-2.5 py-1 bg-slate-100 text-slate-600 rounded">
                    {plan.tag}
                  </span>
                </div>

                <h3 className="text-slate-900 font-black text-2xl mb-1">{plan.name}</h3>
                <p className="text-slate-500 text-xs font-medium mb-6">{plan.desc}</p>

                <div className="flex items-baseline gap-1 mb-6 border-b border-slate-100 pb-6">
                  <span className="text-slate-400 text-base font-bold">S/.</span>
                  <span className="text-slate-900 font-black text-4xl sm:text-5xl font-mono tracking-tight">{plan.price}</span>
                  <span className="text-slate-400 text-xs font-semibold">{plan.period}</span>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href="https://wa.me/51900000000?text=Hola,%20deseo%20informacion%20del%20plan%20"
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  'w-full py-3.5 rounded-lg font-bold uppercase tracking-wider text-center text-xs transition-all',
                  plan.highlight
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800',
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
    <section id="contact" className="py-16 sm:py-24 px-4 sm:px-8 bg-slate-50/50">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs">
        <span className="text-xs font-mono font-bold text-orange-600 uppercase tracking-widest block mb-2">DEMOSTRACIÓN GUIADA KAIZEN</span>
        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
          Equipa tu Pollería con FIRMO POS
        </h2>
        <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-xl mx-auto mb-8">
          Déjanos los datos de tu local y agendamos una prueba guiada en vivo.
        </p>

        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg text-emerald-800 font-bold text-xs">
            ¡Muchas gracias! Un especialista de FIRMO POS se contactará en breve.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              required
              placeholder="Nombre del Restaurante"
              className="h-12 bg-white border border-slate-300 rounded-lg px-4 text-slate-900 text-xs focus:outline-none focus:border-orange-600 transition-colors"
            />
            <input
              type="tel"
              required
              placeholder="Teléfono / WhatsApp"
              className="h-12 bg-white border border-slate-300 rounded-lg px-4 text-slate-900 text-xs focus:outline-none focus:border-orange-600 transition-colors"
            />
            <button
              type="submit"
              className="h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2"
            >
              Solicitar Demo
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
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased selection:bg-orange-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />
      <main>
        <Hero />
        <InteractiveDemo />
        <KaizenPillarsSection />
        <PricingSection />
        <ContactSection />
      </main>
      <footer className="w-full py-6 px-8 text-center text-slate-400 text-xs font-mono border-t border-slate-200 bg-white">
        <span>FIRMO POS &copy; {new Date().getFullYear()} — Kaizen Operating System for Peruvian Restaurants</span>
      </footer>
    </div>
  );
}
