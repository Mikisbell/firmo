'use client';

/**
 * Admin Dashboard Page
 * Página principal del panel de administración
 * Muestra tarjetas de navegación y métricas en tiempo real
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Package,
  Users,
  Monitor,
  Gift,
  ChefHat,
  Settings,
  BarChart3,
  Warehouse,
  TrendingUp,
  ShoppingCart,
  Wifi,
  RefreshCw,
} from 'lucide-react';
import type { DashboardStats } from '@/src/app/api/admin/dashboard/stats/route';

const NAV_CARDS = [
  {
    href: '/admin/productos',
    label: 'Productos',
    description: 'Gestionar catálogo de productos',
    icon: Package,
    color: 'bg-blue-500/20 text-blue-400',
  },
  {
    href: '/admin/empleados',
    label: 'Empleados',
    description: 'Gestionar personal y accesos',
    icon: Users,
    color: 'bg-green-500/20 text-green-400',
  },
  {
    href: '/admin/terminales',
    label: 'Terminales',
    description: 'Controlar dispositivos',
    icon: Monitor,
    color: 'bg-purple-500/20 text-purple-400',
  },
  {
    href: '/admin/promociones',
    label: 'Promociones',
    description: 'Crear y gestionar ofertas',
    icon: Gift,
    color: 'bg-pink-500/20 text-pink-400',
  },
  {
    href: '/admin/estaciones',
    label: 'Estaciones KDS',
    description: 'Configurar cocina y bar',
    icon: ChefHat,
    color: 'bg-orange-500/20 text-orange-400',
  },
  {
    href: '/inventario',
    label: 'Inventario',
    description: 'Control de stock y merma',
    icon: Warehouse,
    color: 'bg-cyan-500/20 text-cyan-400',
  },
  {
    href: '/admin/configuracion',
    label: 'Configuración',
    description: 'Ajustes del negocio',
    icon: Settings,
    color: 'bg-zinc-500/20 text-zinc-400',
  },
  {
    href: '/admin/reportes',
    label: 'Reportes',
    description: 'Ver ventas y estadísticas',
    icon: BarChart3,
    color: 'bg-amber-500/20 text-amber-400',
  },
];

const POLL_INTERVAL = 60000; // 60 seconds

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar métricas');
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Bienvenido al panel de administración</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          title="Actualizar métricas"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStatCard
          label="Ventas Hoy"
          value={stats ? formatCurrency(stats.salesToday) : 'S/ 0.00'}
          icon={TrendingUp}
          color="text-green-400"
          loading={loading}
        />
        <QuickStatCard
          label="Órdenes Activas"
          value={stats?.activeOrders?.toString() || '0'}
          icon={ShoppingCart}
          color="text-blue-400"
          loading={loading}
        />
        <QuickStatCard
          label="Terminales Online"
          value={stats?.terminalsOnline?.toString() || '0'}
          icon={Wifi}
          color="text-purple-400"
          loading={loading}
        />
        <QuickStatCard
          label="Productos"
          value={stats?.totalProducts?.toString() || '0'}
          icon={Package}
          color="text-amber-400"
          loading={loading}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Navigation cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Módulos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {NAV_CARDS.map((card, index) => (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={card.href}
                className="block p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors group min-h-[120px]"
              >
                <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <h3 className="font-medium">{card.label}</h3>
                <p className="text-sm text-zinc-500 mt-1">{card.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Last updated */}
      {stats?.lastUpdated && (
        <p className="text-xs text-zinc-500 text-right">
          Última actualización: {new Date(stats.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function QuickStatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className={`text-xl font-bold ${loading ? 'animate-pulse' : ''}`}>
            {loading ? '...' : value}
          </p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
