'use client';

/**
 * Landing Page — FIRMO POS
 * 
 * Public marketing page for Peruvian restaurants & pollerías.
 * FIRMO Flame & Charcoal OLED Dark Theme, responsive, high-converting.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  WifiOff, Monitor, Receipt, Package,
  Users, ChefHat, TrendingUp, Shield, Zap,
  CheckCircle2, ArrowRight, Send, Phone, Mail,
  Star, Flame, Lock, Fingerprint, ChevronRight
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { FirmoLogo, WhatsAppIcon } from '@/src/components/icons';

const FEATURES = [
  {
    icon: WifiOff,
    title: 'Vende Sin Internet (100% Offline)',
    desc: 'Arquitectura Offline-First: si se corta la fibra óptica, tu pollería sigue cobrando e imprimiendo comandas sin detenerse.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
  },
  {
    icon: Monitor,
    title: 'Multi-Terminal Táctil',
    desc: 'Vistas especializadas para Caja, Mozos en Salón, Cocina KDS, Barra y Delivery. Cada estación optimizada.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: Receipt,
    title: 'Facturación SUNAT Automática',
    desc: 'Boletas y facturas electrónicas integradas al instante. Cumple con el 100% de normativas tributarias.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: Package,
    title: 'Control de Stock FEFO & Auto-86',
    desc: 'Gestión de insumos clave (pollos, papas, aceite, salsas). Alerta automática cuando un plato se agota.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
  },
  {
    icon: ChefHat,
    title: 'Pantalla KDS Cocina & Tiempos',
    desc: 'Control de comandas por cursos en tiempo real, alarmas de demora por plato y sincronización con parrilla.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    icon: Fingerprint,
    title: 'Seguridad Biométrica & Override',
    desc: 'Login ultra-rápido, bloqueo automático por inactividad y autorización biométrica de supervisor para anulaciones.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
  },
  {
    icon: Users,
    title: 'Gestión de Personal & Nómina',
    desc: 'Asistencia, turnos de mozos y cocineros, propinas, adelantos de sueldo y reportes de desempeño.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  {
    icon: TrendingUp,
    title: 'Reportes & Dashboard en Vivo',
    desc: 'Analítica de ventas del día en tiempo real, ticket promedio, platos más vendidos e ingresos por mozo.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
  },
] as const;

const PRICING = [
  {
    name: 'Básico',
    price: '149',
    period: '/mes',
    desc: 'Para pollerías locales con 1-2 cajas',
    features: ['1 Terminal POS Táctil', 'Facturación SUNAT Integrada', 'Inventario de Insumos Básico', 'Modo Offline Resiliente', 'Soporte prioritario'],
    cta: 'Solicitar Demo Gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '299',
    period: '/mes',
    desc: 'Para restaurantes y pollerías en crecimiento',
    features: ['Hasta 5 Terminales (Caja, Mozo, Cocina)', 'Facturación + Delivery', 'Pantalla KDS Cocina & Barra', 'Gestión de Personal & Propinas', 'Reportes y Analítica en Vivo', 'Autenticación Biométrica'],
    cta: 'Empezar Prueba Pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Personalizado',
    period: '',
    desc: 'Para cadenas de pollerías y franquicias',
    features: ['Terminales Ilimitados', 'Gestión Multi-Local Centralizada', 'API & Webhooks Personalizados', 'Auditoría Criptográfica de Eventos', 'SLA Garantizado 99.99%', 'Gerente de Cuenta Dedicado'],
    cta: 'Contactar Ventas Enterprise',
    highlight: false,
  },
] as const;

function Navbar() {
  return (
    <nav className="w-full border-b border-white/5 bg-[#07080A]/80 backdrop-blur-xl fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FirmoLogo size={34} />
          <span className="font-black text-2xl tracking-tight text-white">
            FIRMO <span className="text-orange-500">POS</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-300">
          <a href="#features" className="hover:text-orange-400 transition-colors">Funcionalidades</a>
          <a href="#pricing" className="hover:text-orange-400 transition-colors">Planes & Precios</a>
          <a href="#demo" className="hover:text-orange-400 transition-colors">Contacto</a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/login?force=true"
            className="text-xs md:text-sm font-bold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-4 py-2.5 rounded-xl transition-all"
          >
            Ingresar al Sistema
          </a>
          <a
            href="#demo"
            className="hidden sm:inline-flex items-center gap-2 text-xs md:text-sm font-black text-white bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 px-4 py-2.5 rounded-xl shadow-lg shadow-orange-600/20 transition-all"
          >
            Demo Gratis
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-24 px-6 overflow-hidden">
      {/* Destellos de Brasa en Fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-orange-600/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full px-4 py-2 text-xs md:text-sm font-bold mb-8 shadow-inner">
            <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
            El Sistema POS N°1 para Pollerías y Parrilleras en el Perú
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.1]">
            La velocidad del fuego en la caja de tu <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 bg-clip-text text-transparent">Pollería</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-3xl mx-auto font-medium leading-relaxed">
            FIRMO POS es el sistema operativo integral diseñado para restaurantes y pollerías peruanas.
            Vende sin internet, emite boletas SUNAT al instante, controla tu cocina en tiempo real y protege tu caja contra fraudes.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://wa.me/51900000000?text=Hola,%20deseo%20una%20demostraci%C3%B3n%20gratuita%20de%20FIRMO%20POS"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-400 text-white font-black py-4 px-8 rounded-2xl text-base shadow-xl shadow-orange-600/30 active:scale-98 transition-all"
            >
              <WhatsAppIcon size={22} />
              Solicitar Demo Gratis por WhatsApp
            </a>

            <a
              href="/login?force=true"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-zinc-900/80 hover:bg-zinc-800 text-white font-bold py-4 px-8 rounded-2xl border border-white/10 text-base transition-all"
            >
              Ingresar al POS
              <ArrowRight className="w-5 h-5 text-orange-400" />
            </a>
          </div>
        </motion.div>

        {/* Badges de Confianza */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 flex flex-wrap justify-center gap-6 text-xs sm:text-sm font-semibold text-zinc-400"
        >
          {['100% Offline-First (Cero Caídas)', 'Facturación SUNAT Integrada', 'Resistencia Biométrica', 'Hecho en Perú'].map((item) => (
            <div key={item} className="flex items-center gap-2 bg-zinc-900/50 px-4 py-2 rounded-xl border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-orange-400" />
              {item}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6 relative z-10 border-t border-white/5 bg-zinc-950/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Todo lo que tu restaurante necesita para volar
          </h2>
          <p className="mt-4 text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto font-medium">
            Herramientas construidas especialmente para la operación de alto flujo en pollerías y parrilleras
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="bg-zinc-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-orange-500/30 transition-all group"
              >
                <div className={`w-12 h-12 rounded-2xl ${f.bg} border flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-medium">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-6 relative z-10 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Planes transparentes en Soles Peruanos
          </h2>
          <p className="mt-4 text-zinc-400 text-base sm:text-lg font-medium">
            Sin permanencias forzadas ni comisiones ocultas por venta
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={[
                'rounded-3xl p-8 flex flex-col justify-between transition-all relative',
                plan.highlight
                  ? 'bg-zinc-900/90 border-2 border-orange-500 shadow-2xl shadow-orange-600/20'
                  : 'bg-zinc-900/40 border border-white/10',
              ].join(' ')}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-600 to-amber-500 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-md">
                  Más Popular
                </div>
              )}

              <div>
                <h3 className="text-white font-black text-2xl mb-1">{plan.name}</h3>
                <p className="text-zinc-400 text-xs font-medium mb-6">{plan.desc}</p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-zinc-400 text-xl font-bold">S/.</span>
                  <span className="text-white font-black text-5xl tracking-tight">{plan.price}</span>
                  <span className="text-zinc-400 text-sm font-semibold">{plan.period}</span>
                </div>

                <div className="space-y-3.5 mb-8">
                  {plan.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
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
                  'w-full py-4 rounded-2xl font-black text-center text-sm transition-all',
                  plan.highlight
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white hover:from-orange-500 hover:to-amber-400 shadow-lg shadow-orange-600/25'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10',
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
    toast.success('¡Solicitud recibida! Un asesor de FIRMO POS se comunicará en breve.');
  };

  return (
    <section id="demo" className="py-24 px-6 relative z-10 border-t border-white/5 bg-zinc-950/60">
      <div className="max-w-4xl mx-auto bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mx-auto mb-6">
          <Flame className="w-7 h-7" />
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
          ¿Listo para transformar la caja de tu pollería?
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base font-medium max-w-xl mx-auto mb-8">
          Déjanos tus datos y te mostraremos una demostración en vivo ajustada a tu restaurante.
        </p>

        {submitted ? (
          <div className="bg-emerald-950/60 border border-emerald-500/30 p-6 rounded-2xl text-emerald-400 font-bold text-sm">
            ¡Muchas gracias! Nos pondremos en contacto contigo en los próximos 15 minutos.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              type="text"
              required
              placeholder="Nombre del restaurante"
              className="h-14 bg-zinc-950 border border-white/10 rounded-2xl px-4 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
            <input
              type="tel"
              required
              placeholder="Teléfono / WhatsApp"
              className="h-14 bg-zinc-950 border border-white/10 rounded-2xl px-4 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
            <button
              type="submit"
              className="h-14 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-orange-600/30 transition-all flex items-center justify-center gap-2"
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
    <div className="min-h-screen bg-[#07080A] text-white selection:bg-orange-500 selection:text-white relative overflow-hidden">
      <Toaster position="top-right" theme="dark" />
      <Navbar />
      <main>
        <Hero />
        <FeaturesSection />
        <PricingSection />
        <ContactSection />
      </main>
      <footer className="w-full py-8 px-6 text-center text-zinc-500 text-xs border-t border-white/5 bg-[#07080A]">
        <span>FIRMO POS &copy; {new Date().getFullYear()} — Hecho con dedicación en Perú para Pollerías y Parrilleras</span>
      </footer>
    </div>
  );
}
