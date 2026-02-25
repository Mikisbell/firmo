'use client';

/**
 * Landing Page - PARK POS
 *
 * Public marketing page to attract restaurant customers.
 * Light theme, responsive, Spanish.
 *
 * @module app/landing/page
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wifi, WifiOff, Monitor, Receipt, Package,
  Users, ChefHat, TrendingUp, Shield, Zap,
  CheckCircle2, ArrowRight, Send, Phone, Mail,
  Store, Star,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { ParkLogo, WhatsAppIcon, InstagramIcon, FacebookIcon } from '@/src/components/icons';

// ============================================================================
// Feature data
// ============================================================================

const FEATURES = [
  {
    icon: WifiOff,
    title: 'Funciona Sin Internet',
    desc: 'Offline-first: sigue vendiendo cuando la conexión falla. Se sincroniza automáticamente al reconectarse.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Monitor,
    title: 'Multi-Terminal',
    desc: 'Caja, meseros, cocina, barra — cada estación en su dispositivo con su vista especializada.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Receipt,
    title: 'Facturación SUNAT',
    desc: 'Boletas y facturas electrónicas integradas. Cumple con la normativa de SUNAT al 100%.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: Package,
    title: 'Inventario FEFO',
    desc: 'Control de stock con expiración. Auto-86 cuando un insumo se agota. Alertas automáticas.',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    icon: Users,
    title: 'Gestión de Personal',
    desc: 'Horarios, asistencia, nómina, permisos, adelantos, evaluaciones — todo en un solo lugar.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  {
    icon: ChefHat,
    title: 'KDS Cocina',
    desc: 'Pantalla de cocina en tiempo real. Control de cursos, tiempos por plato y fire control.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    icon: TrendingUp,
    title: 'Reportes en Vivo',
    desc: 'Dashboard con KPIs del día: ventas, ticket promedio, top productos, distribución por hora.',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  {
    icon: Shield,
    title: 'Seguridad Avanzada',
    desc: 'Fingerprint de dispositivo, validación MAC, rate limiting. Tu negocio protegido.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
] as const;

const PRICING = [
  {
    name: 'Básico',
    price: '149',
    period: '/mes',
    desc: 'Para pollerías con 1-2 cajas',
    features: ['1 terminal POS', 'Facturación SUNAT', 'Inventario básico', 'Soporte por email'],
    cta: 'Empezar Gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '299',
    period: '/mes',
    desc: 'Para restaurantes en crecimiento',
    features: ['5 terminales', 'Facturación + Delivery', 'RRHH completo', 'KDS Cocina', 'Reportes avanzados', 'Soporte prioritario'],
    cta: 'Solicitar Demo',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Contactar',
    period: '',
    desc: 'Para cadenas y franquicias',
    features: ['Terminales ilimitados', 'Multi-local', 'API personalizada', 'Integraciones a medida', 'SLA garantizado', 'Gerente de cuenta'],
    cta: 'Contactar Ventas',
    highlight: false,
  },
] as const;

// ============================================================================
// Components
// ============================================================================

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-gray-50 pt-20 pb-24 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-100/40 via-transparent to-transparent" />

      <div className="relative max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Sistema POS para Pollerías y Parrilleras
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight">
            Tu pollería merece un
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent"> POS de verdad</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            PARK POS es el sistema todo-en-uno diseñado para pollerías peruanas.
            Vende offline, emite boletas SUNAT, controla tu cocina y gestiona tu personal.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-8 rounded-xl transition-colors text-base"
            >
              Solicitar Demo Gratis
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-bold py-3.5 px-8 rounded-xl border border-gray-200 transition-colors text-base"
            >
              Ver Funcionalidades
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 flex flex-wrap justify-center gap-6 text-sm text-gray-500"
        >
          {['Offline-first', 'Facturación SUNAT', 'Multi-terminal', 'Hecho en Perú'].map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {item}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            Todo lo que tu negocio necesita
          </h2>
          <p className="mt-3 text-gray-500 text-lg">
            Diseñado específicamente para pollerías y parrilleras peruanas
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-50 hover:bg-white border border-gray-100 hover:border-gray-200 rounded-2xl p-6 transition-all hover:shadow-lg group"
            >
              <div className={`w-11 h-11 ${f.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            Planes simples, sin sorpresas
          </h2>
          <p className="mt-3 text-gray-500 text-lg">
            Todos los precios en soles peruanos. Sin contratos de permanencia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-7 transition-all ${
                plan.highlight
                  ? 'bg-gray-900 text-white ring-2 ring-emerald-500 shadow-2xl scale-[1.02]'
                  : 'bg-white border border-gray-200 hover:shadow-lg'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Más Popular
                </div>
              )}

              <h3 className={`text-lg font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <p className={`text-sm mt-1 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                {plan.desc}
              </p>

              <div className="mt-5 mb-6">
                <span className={`text-4xl font-black ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                  {plan.price === 'Contactar' ? '' : 'S/ '}{plan.price}
                </span>
                <span className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                  {plan.period}
                </span>
              </div>

              <ul className="space-y-2.5 mb-7">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      plan.highlight ? 'text-emerald-400' : 'text-emerald-500'
                    }`} />
                    <span className={plan.highlight ? 'text-gray-300' : 'text-gray-600'}>
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="#demo"
                className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-colors ${
                  plan.highlight
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                    : 'bg-gray-900 hover:bg-black text-white'
                }`}
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

function DemoForm() {
  const [form, setForm] = useState({ name: '', email: '', restaurant: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = form.name.trim().length > 0
    && form.email.includes('@')
    && form.restaurant.trim().length > 0
    && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSubmitted(true);
        toast.success('Solicitud enviada. Te contactaremos pronto.');
      } else {
        const data = await res.json().catch(() => ({ error: 'Error' }));
        toast.error(data.error || 'Error al enviar solicitud');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section id="demo" className="py-20 px-4 bg-white">
        <div className="max-w-md mx-auto text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring' }}
          >
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-900">Solicitud Recibida</h2>
            <p className="mt-2 text-gray-500">
              Nuestro equipo te contactará en las próximas 24 horas para coordinar tu demo personalizada.
            </p>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section id="demo" className="py-20 px-4 bg-white">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            Solicitar Demo Gratis
          </h2>
          <p className="mt-3 text-gray-500">
            Te mostramos PARK POS funcionando con los datos de tu negocio
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Nombre completo *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Juan Pérez"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Email *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="juan@mirestaurante.com"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Nombre del restaurante *
            </label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.restaurant}
                onChange={(e) => setForm({ ...form, restaurant: e.target.value })}
                placeholder="Pollería El Sabrosón"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Teléfono (opcional)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="987 654 321"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
              canSubmit
                ? 'bg-gray-900 hover:bg-black text-white shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Enviando...' : 'Solicitar Demo'}
          </button>
        </form>
      </div>
    </section>
  );
}

const SOCIAL_LINKS = [
  { href: 'https://wa.me/51999999999', label: 'WhatsApp', Icon: WhatsAppIcon },
  { href: 'https://instagram.com/parkpos', label: 'Instagram', Icon: InstagramIcon },
  { href: 'https://facebook.com/parkpos', label: 'Facebook', Icon: FacebookIcon },
] as const;

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <ParkLogo size={28} />
            <span className="text-emerald-400 font-black text-lg">PARK</span>
            <span className="text-white font-bold text-lg">POS</span>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>

          <p className="text-xs">&copy; {new Date().getFullYear()} PARK POS</p>
        </div>
        <p className="text-sm text-center mt-4 text-gray-500">
          Hecho con dedicación en Perú. Sistema POS para pollerías y parrilleras.
        </p>
      </div>
    </footer>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Toaster position="top-center" richColors />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ParkLogo size={32} />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent font-black text-xl">PARK</span>
            <span className="text-gray-900 font-bold text-xl">POS</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Precios</a>
            <a
              href="#demo"
              className="hover:text-gray-900 transition-colors"
            >
              Demo Gratis
            </a>
            <a
              href="/login"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              Ingresar al Sistema
            </a>
          </div>
          {/* Mobile login button */}
          <a
            href="/login"
            className="sm:hidden bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Ingresar
          </a>
        </div>
      </nav>

      <Hero />
      <Features />
      <Pricing />
      <DemoForm />
      <Footer />
    </div>
  );
}
