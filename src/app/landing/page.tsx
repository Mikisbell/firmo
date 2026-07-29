'use client';

/**
 * Landing Page — FIRMO POS
 * 
 * Executive B2B Light Design System (Stripe / Toast POS Benchmark)
 * Clean, high-contrast, perfectly aligned, 100% responsive for all devices.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  WifiOff, Monitor, Receipt, Package,
  Users, ChefHat, TrendingUp, Shield, Zap,
  CheckCircle2, ArrowRight, Send, Phone, Mail,
  Star, Flame, Lock, Fingerprint, ChevronRight, Menu, X
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { FirmoLogo, WhatsAppIcon } from '@/src/components/icons';

const FEATURES = [
  {
    icon: WifiOff,
    title: '100% Offline-First',
    desc: 'Sigue vendiendo aunque se corte el internet. Todo se sincroniza automáticamente al reconectarse.',
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-100',
  },
  {
    icon: Monitor,
    title: 'Multi-Terminal Táctil',
    desc: 'Estaciones optimizadas para Caja, Mozos en Salón, Cocina KDS, Barra y Delivery.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-100',
  },
  {
    icon: Receipt,
    title: 'Facturación SUNAT',
    desc: 'Boletas y facturas electrónicas emitidas en 1 segundo. Cumplimiento tributario al 100%.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-100',
  },
  {
    icon: Package,
    title: 'Control de Stock & Auto-86',
    desc: 'Gestión de insumos clave (pollos, papas, aceites). Descuento automático por cada plato vendido.',
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-100',
  },
  {
    icon: ChefHat,
    title: 'KDS Cocina & Tiempos',
    desc: 'Pantalla de cocina en tiempo real. Control de tiempos por plato y marcha de pedidos.',
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-100',
  },
  {
    icon: Fingerprint,
    title: 'Seguridad Biométrica',
    desc: 'Login ultra-rápido por huella/PIN y autorización de supervisor para anulaciones y descuentos.',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50 border-cyan-100',
  },
  {
    icon: Users,
    title: 'Gestión de Personal',
    desc: 'Control de asistencia, horarios de mozos, propinas, sueldos y métricas de desempeño.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-100',
  },
  {
    icon: TrendingUp,
    title: 'Reportes en Tiempo Real',
    desc: 'Dashboard ejecutivo con ventas del día, ticket promedio, platos top y rotación por hora.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-100',
  },
] as const;

const PRICING = [
  {
    name: 'Básico',
    price: '149',
    period: '/mes',
    desc: 'Ideal para pollerías y locales de 1-2 cajas',
    features: ['1 Terminal POS Táctil', 'Facturación SUNAT Integrada', 'Inventario de Insumos Básico', 'Modo Offline Resiliente', 'Soporte prioritario por WhatsApp'],
    cta: 'Solicitar Demo Gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '299',
    period: '/mes',
    desc: 'Para restaurantes en crecimiento con salón',
    features: ['Hasta 5 Terminales (Caja, Mozo, Cocina)', 'Facturación + Módulo Delivery', 'Pantalla KDS Cocina & Barra', 'Gestión de Personal & Propinas', 'Reportes & Analítica en Vivo', 'Autenticación Biométrica'],
    cta: 'Probar Plan Pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Personalizado',
    period: '',
    desc: 'Para cadenas de pollerías y franquicias',
    features: ['Terminales Ilimitados', 'Gestión Multi-Local Centralizada', 'API & Webhooks Personalizados', 'Auditoría Criptográfica de Eventos', 'SLA Garantizado 99.99%', 'Gerente de Cuenta Dedicado'],
    cta: 'Contactar Ventas',
    highlight: false,
  },
] as const;

function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <nav className="w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 sm:h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FirmoLogo size={32} />
          <span className="font-black text-xl sm:text-2xl tracking-tight text-slate-900">
            FIRMO <span className="text-orange-600">POS</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
          <a href="#features" className="hover:text-orange-600 transition-colors">Funcionalidades</a>
          <a href="#pricing" className="hover:text-orange-600 transition-colors">Planes & Precios</a>
          <a href="#demo" className="hover:text-orange-600 transition-colors">Contacto</a>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <a
            href="/login?force=true"
            className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-all"
          >
            Ingresar al Sistema
          </a>
          <a
            href="https://wa.me/51900000000?text=Hola,%20deseo%20una%20demostraci%C3%B3n%20gratuita%20de%20FIRMO%20POS"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-white bg-orange-600 hover:bg-orange-700 px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            Demo Gratis
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenu(!mobileMenu)}
          className="sm:hidden p-2 text-slate-700 hover:text-slate-900"
        >
          {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenu && (
        <div className="sm:hidden border-b border-slate-200 bg-white px-4 py-4 space-y-3 font-semibold text-slate-700 text-sm">
          <a href="#features" onClick={() => setMobileMenu(false)} className="block py-2">Funcionalidades</a>
          <a href="#pricing" onClick={() => setMobileMenu(false)} className="block py-2">Planes & Precios</a>
          <a href="#demo" onClick={() => setMobileMenu(false)} className="block py-2">Contacto</a>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="/login?force=true"
              className="w-full text-center py-2.5 rounded-xl bg-slate-100 font-bold text-slate-800"
            >
              Ingresar al POS
            </a>
            <a
              href="https://wa.me/51900000000?text=Hola,%20deseo%20informacion"
              className="w-full text-center py-2.5 rounded-xl bg-orange-600 font-black text-white"
            >
              Demo por WhatsApp
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 bg-slate-50 border-b border-slate-200/60">
      <div className="max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-orange-100/80 border border-orange-200 text-orange-800 rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold mb-6">
            <Flame className="w-4 h-4 text-orange-600" />
            Sistema POS para Pollerías y Parrilleras en Perú
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">
            El sistema punto de venta diseñado para la velocidad de tu <span className="text-orange-600">Pollería</span>
          </h1>

          <p className="mt-5 text-base sm:text-xl text-slate-600 max-w-3xl mx-auto font-normal leading-relaxed">
            FIRMO POS combina la estabilidad offline-first con la emisión rápida de boletas SUNAT, control de cocina KDS y protección anti-fraude en caja.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a
              href="https://wa.me/51900000000?text=Hola,%20deseo%20una%20demostraci%C3%B3n%20gratuita%20de%20FIRMO%20POS"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black py-4 px-7 rounded-xl text-base shadow-lg shadow-orange-600/20 active:scale-98 transition-all"
            >
              <WhatsAppIcon size={20} />
              Solicitar Demo Gratis por WhatsApp
            </a>

            <a
              href="/login?force=true"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-800 font-bold py-4 px-7 rounded-xl border border-slate-300 text-base shadow-sm transition-all"
            >
              Ingresar al Sistema POS
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </a>
          </div>
        </motion.div>

        {/* Feature Badges */}
        <div className="mt-12 sm:mt-16 flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold text-slate-600">
          {['100% Offline-First', 'Facturación Electrónica SUNAT', 'Biometría Anti-Fraude', 'Desarrollado en Perú'].map((item) => (
            <div key={item} className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 bg-white border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Todo lo que tu restaurante necesita para operar sin pausas
          </h2>
          <p className="mt-3 text-slate-500 text-sm sm:text-base max-w-2xl mx-auto font-medium">
            Módulos integrados y probados para el alto tráfico en cajas, salón y cocina
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-6 hover:border-orange-300 hover:shadow-md transition-all group"
              >
                <div className={`w-12 h-12 rounded-xl ${f.bg} border flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                  <Icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-normal">{f.desc}</p>
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
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-50 border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Planes Transparentes en Soles Peruanos
          </h2>
          <p className="mt-3 text-slate-500 text-sm sm:text-base font-medium">
            Sin contratos forzados ni cobro de comisiones por tus ventas
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={[
                'rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all bg-white relative',
                plan.highlight
                  ? 'border-2 border-orange-600 shadow-xl shadow-orange-600/10'
                  : 'border border-slate-200 shadow-sm',
              ].join(' ')}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  Recomendado
                </div>
              )}

              <div>
                <h3 className="text-slate-900 font-black text-2xl mb-1">{plan.name}</h3>
                <p className="text-slate-500 text-xs font-medium mb-6">{plan.desc}</p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-slate-500 text-lg font-bold">S/.</span>
                  <span className="text-slate-900 font-black text-4xl sm:text-5xl tracking-tight">{plan.price}</span>
                  <span className="text-slate-500 text-sm font-semibold">{plan.period}</span>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
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
                  'w-full py-3.5 rounded-xl font-bold text-center text-sm transition-all',
                  plan.highlight
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md'
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
    toast.success('¡Solicitud enviada! Nos comunicaremos contigo en breve.');
  };

  return (
    <section id="demo" className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
      <div className="max-w-4xl mx-auto bg-slate-900 rounded-3xl p-8 sm:p-12 text-center text-white shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 mx-auto mb-5">
          <Flame className="w-6 h-6" />
        </div>

        <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
          ¿Listo para equipar tu pollería con FIRMO POS?
        </h2>
        <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-xl mx-auto mb-8">
          Déjanos tus datos y te enviaremos una demostración guiada adaptada a tu restaurante.
        </p>

        {submitted ? (
          <div className="bg-emerald-900/60 border border-emerald-500/30 p-4 rounded-xl text-emerald-300 font-bold text-sm">
            ¡Muchas gracias! Un asesor se contactará contigo en breve.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              required
              placeholder="Nombre de tu pollería"
              className="h-13 bg-slate-800 border border-slate-700 rounded-xl px-4 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
            <input
              type="tel"
              required
              placeholder="Teléfono / WhatsApp"
              className="h-13 bg-slate-800 border border-slate-700 rounded-xl px-4 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
            <button
              type="submit"
              className="h-13 bg-orange-600 hover:bg-orange-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              Solicitar Demo
              <Send className="w-4 h-4" />
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
        <FeaturesSection />
        <PricingSection />
        <ContactSection />
      </main>
      <footer className="w-full py-6 px-4 text-center text-slate-500 text-xs border-t border-slate-200 bg-slate-50">
        <span>FIRMO POS &copy; {new Date().getFullYear()} — Sistema de Punto de Venta para Pollerías y Parrilleras en Perú</span>
      </footer>
    </div>
  );
}
