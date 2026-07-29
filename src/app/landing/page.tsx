'use client';

/**
 * Landing Page — FIRMO POS
 * 
 * Swiss Design System & Compact Landing Architecture
 * (Grid discipline, quiet typography, mathematical whitespace, high-craft anti-generic B2B UI)
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  WifiOff, Monitor, Receipt, Package,
  ChefHat, Fingerprint, Users, TrendingUp,
  CheckCircle2, ArrowRight, Send, Menu, X, ShieldCheck, Zap
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { FirmoLogo, WhatsAppIcon } from '@/src/components/icons';

const FEATURES = [
  {
    code: '01',
    icon: WifiOff,
    title: 'Arquitectura Offline-First',
    desc: 'La terminal sigue cobrando e imprimiendo comprobantes aunque caiga el internet de la ciudad. Sincronización automática al volver en línea.',
  },
  {
    code: '02',
    icon: Receipt,
    title: 'Facturación SUNAT en 1s',
    desc: 'Emisión instantánea de boletas y facturas electrónicas conectada a la OSE/PSE oficial. Cumplimiento tributario al 100%.',
  },
  {
    code: '03',
    icon: ChefHat,
    title: 'Pantalla KDS Cocina & Parrilla',
    desc: 'Despacho de comandas por tiempos y estaciones en tiempo real. Alarmas automáticas de demora por plato.',
  },
  {
    code: '04',
    icon: Package,
    title: 'Control de Insumos & Auto-86',
    desc: 'Descuento automático de stock de pollo, papas y aceite por cada plato vendido. Alerta de agotado inmediata.',
  },
  {
    code: '05',
    icon: Fingerprint,
    title: 'Biometría & Anti-Fraude',
    desc: 'Inicio de sesión biométrico WebAuthn, auto-bloqueo por inactividad y autorización de supervisor para anulaciones.',
  },
  {
    code: '06',
    icon: Monitor,
    title: 'Vistas Multi-Estación',
    desc: 'Interfaces optimizadas ergonómicamente para Caja Principal, Comandera de Salón, Cocina KDS y Delivery.',
  },
  {
    code: '07',
    icon: Users,
    title: 'Gestión de Personal',
    desc: 'Asistencia, control de turnos por mozo, reparto de propinas y liquidación de nómina integrada.',
  },
  {
    code: '08',
    icon: TrendingUp,
    title: 'Analítica de Ventas en Vivo',
    desc: 'Dashboard con KPIs en tiempo real: ticket promedio, platos más vendidos y distribución de ingresos por hora.',
  },
] as const;

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
      'Modo Offline Resiliente',
      'Inventario Básico de Insumos',
      'Soporte directo por WhatsApp',
    ],
    highlight: false,
    cta: 'Solicitar Demo',
  },
  {
    tag: 'MÁS POPULAR',
    name: 'Pro',
    price: '299',
    period: '/ mes',
    desc: 'Para restaurantes en crecimiento con salón',
    features: [
      'Hasta 5 Terminales (Caja, Mozos, Cocina)',
      'Facturación SUNAT + Módulo Delivery',
      'Pantalla KDS Cocina & Barra',
      'Autenticación Biométrica & Anti-Fraude',
      'Gestión de Personal & Propinas',
      'Reportes & Analítica Ejecutiva',
    ],
    highlight: true,
    cta: 'Probar Plan Pro',
  },
  {
    tag: 'CADENAS',
    name: 'Enterprise',
    price: 'A Medida',
    period: '',
    desc: 'Para franquicias y grupos gastronómicos',
    features: [
      'Terminales & Locales Ilimitados',
      'Administración Multi-Local Centralizada',
      'API REST & Webhooks para Integraciones',
      'Registro Criptográfico Inalterable de Auditoría',
      'Garantía SLA de Disponibilidad 99.99%',
      'Gerente de Cuenta Dedicado',
    ],
    highlight: false,
    cta: 'Contactar Ventas',
  },
] as const;

const METRICS = [
  { label: 'DISPONIBILIDAD OPERATIVA', value: '99.99%' },
  { label: 'TIEMPO EMISIÓN SUNAT', value: '< 1.0s' },
  { label: 'LATENCIA DE COBRO OFFLINE', value: '0.0ms' },
  { label: 'CUMPLIMIENTO TRIBUTARIO', value: '100%' },
] as const;

function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <header className="w-full border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 sm:h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FirmoLogo size={30} />
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tight text-slate-900 leading-none">
              FIRMO <span className="text-orange-600">POS</span>
            </span>
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase mt-0.5">
              Gastronomic Operating System
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-bold tracking-wider text-slate-600 uppercase">
          <a href="#features" className="hover:text-orange-600 transition-colors">Funcionalidades</a>
          <a href="#metrics" className="hover:text-orange-600 transition-colors">Métricas</a>
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
            href="https://wa.me/51900000000?text=Hola,%20deseo%20una%20demostraci%C3%B3n%20gratuita%20de%20FIRMO%20POS"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-black tracking-wider uppercase text-white bg-orange-600 hover:bg-orange-700 px-4 py-2.5 rounded-lg shadow-sm transition-all"
          >
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
          <a href="#features" onClick={() => setMobileMenu(false)} className="block py-1">Funcionalidades</a>
          <a href="#metrics" onClick={() => setMobileMenu(false)} className="block py-1">Métricas</a>
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
    <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-8 bg-slate-50/50 border-b border-slate-200">
      <div className="max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Badge Suizo Ponderado */}
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-800 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide uppercase mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
            Sistema POS para Pollerías y Parrilleras en Perú
          </div>

          {/* Titular Retenido & Tipografía Suiza */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.08] max-w-4xl mx-auto">
            El sistema punto de venta diseñado para la velocidad de tu <span className="text-orange-600">Pollería</span>.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            FIRMO POS combina estabilidad offline-first con la emisión rápida de boletas SUNAT, control de cocina KDS y protección anti-fraude en caja.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3.5 justify-center items-center">
            <a
              href="https://wa.me/51900000000?text=Hola,%20deseo%20una%20demostraci%C3%B3n%20gratuita%20de%20FIRMO%20POS"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black py-4 px-8 rounded-lg text-xs sm:text-sm uppercase tracking-wider shadow-sm transition-all"
            >
              <WhatsAppIcon size={18} />
              Solicitar Demo Gratis
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

function MetricsSection() {
  return (
    <section id="metrics" className="py-12 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {METRICS.map((m) => (
            <div key={m.label} className="p-4 border-r last:border-r-0 border-slate-100">
              <div className="text-2xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">{m.value}</div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-8 bg-slate-50/30 border-b border-slate-200">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 text-left border-b border-slate-200 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-xs font-bold text-orange-600 uppercase tracking-widest block mb-1">Módulos Especializados</span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Ingeniería Operativa para Restaurantes
            </h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm max-w-md font-medium">
            Componentes desacoplados diseñados para resistir el alto tráfico en cajas, salón y cocina.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.code}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-400 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-mono text-xs font-bold text-slate-300">{f.code}</span>
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <Icon className="w-4 h-4 text-slate-800" />
                    </div>
                  </div>
                  <h3 className="text-slate-900 font-bold text-base mb-2">{f.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed font-normal">{f.desc}</p>
                </div>
              </div>
            );
          })}
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
            <span className="text-xs font-bold text-orange-600 uppercase tracking-widest block mb-1">Inversión Transparente</span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Planes en Soles Peruanos
            </h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            Sin contratos forzados ni cobro de comisiones por ventas.
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
        <span className="text-xs font-mono font-bold text-orange-600 uppercase tracking-widest block mb-2">DEMOSTRACIÓN GUIADA</span>
        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
          Equipa tu Pollería con FIRMO POS
        </h2>
        <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-xl mx-auto mb-8">
          Déjanos los datos de tu local y te agendamos una prueba guiada en vivo.
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
        <MetricsSection />
        <FeaturesSection />
        <PricingSection />
        <ContactSection />
      </main>
      <footer className="w-full py-6 px-8 text-center text-slate-400 text-xs font-mono border-t border-slate-200 bg-white">
        <span>FIRMO POS &copy; {new Date().getFullYear()} — Gastronomic Operating System for Peruvian Restaurants</span>
      </footer>
    </div>
  );
}
