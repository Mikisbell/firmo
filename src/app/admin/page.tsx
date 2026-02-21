'use client';

/**
 * Admin Dashboard Page
 * Página principal del panel de administración
 * Muestra tarjetas de navegación y métricas en tiempo real
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 * 
 * Mejoras v3.0 (SWR Migration):
 * - Migrado de useEffect + fetch a useSWR
 * - Deduplicación automática de requests
 * - Revalidación inteligente (60s + focus + reconnect)
 * - Stale-while-revalidate para UX instantánea
 * - Reducción de código (-84%)
 * 
 * Mejoras v2.0:
 * - Comparación con ayer
 * - Panel de alertas
 * - Actividad reciente
 * - Accesos rápidos
 * - Estado de sincronización
 * - Link a analytics premium
 * - Mejoras visuales
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  TrendingDown,
  ShoppingCart,
  Wifi,
  RefreshCw,
  AlertTriangle,
  Clock,
  Zap,
  Briefcase,
} from 'lucide-react';
import { useAdminStats, type DashboardStats } from '@/src/hooks/useSWRHooks';

const NAV_CARDS = [
  {
    href: '/admin/productos',
    label: 'Productos',
    description: 'Gestionar catálogo de productos',
    icon: Package,
    color: 'from-blue-500/20 to-blue-600/10',
    borderColor: 'border-blue-500/30 hover:border-blue-500/50',
  },
  {
    href: '/admin/empleados',
    label: 'Empleados',
    description: 'Gestionar personal y accesos',
    icon: Users,
    color: 'from-green-500/20 to-green-600/10',
    borderColor: 'border-green-500/30 hover:border-green-500/50',
  },
  {
    href: '/admin/hr',
    label: 'Recursos Humanos',
    description: 'Gestión integral de RRHH',
    icon: Briefcase,
    color: 'from-teal-500/20 to-teal-600/10',
    borderColor: 'border-teal-500/30 hover:border-teal-500/50',
  },
  {
    href: '/admin/terminales',
    label: 'Terminales',
    description: 'Controlar dispositivos',
    icon: Monitor,
    color: 'from-purple-500/20 to-purple-600/10',
    borderColor: 'border-purple-500/30 hover:border-purple-500/50',
  },
  {
    href: '/admin/promociones',
    label: 'Promociones',
    description: 'Crear y gestionar ofertas',
    icon: Gift,
    color: 'from-pink-500/20 to-pink-600/10',
    borderColor: 'border-pink-500/30 hover:border-pink-500/50',
  },
  {
    href: '/admin/estaciones',
    label: 'Estaciones KDS',
    description: 'Configurar cocina y bar',
    icon: ChefHat,
    color: 'from-orange-500/20 to-orange-600/10',
    borderColor: 'border-orange-500/30 hover:border-orange-500/50',
  },
  {
    href: '/inventario',
    label: 'Inventario',
    description: 'Control de stock y merma',
    icon: Warehouse,
    color: 'from-cyan-500/20 to-cyan-600/10',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/50',
  },
  {
    href: '/admin/configuracion',
    label: 'Configuración',
    description: 'Ajustes del negocio',
    icon: Settings,
    color: 'from-zinc-500/20 to-zinc-600/10',
    borderColor: 'border-zinc-500/30 hover:border-zinc-500/50',
  },
  {
    href: '/admin/reportes',
    label: 'Reportes',
    description: 'Ver ventas y estadísticas',
    icon: BarChart3,
    color: 'from-amber-500/20 to-amber-600/10',
    borderColor: 'border-amber-500/30 hover:border-amber-500/50',
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  
  // Migrado a SWR - deduplicación automática + revalidación inteligente
  const { data: stats, error, isLoading, mutate } = useAdminStats();

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const formatDelta = (delta: number) => {
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Bienvenido al panel de administración</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sync Status */}
          {stats?.syncStatus && (
            <div className="flex items-center gap-2 text-sm px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-800">
              <div className={`w-2 h-2 rounded-full ${stats.syncStatus.synced ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-zinc-400">
                {stats.syncStatus.synced ? 'Sincronizado' : `${stats.syncStatus.pendingEvents} pendientes`}
              </span>
            </div>
          )}
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Actualizar métricas"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Link to Premium Analytics */}
      <Link 
        href="/admin/dashboard"
        className="block p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30 hover:border-blue-500/50 transition-all group"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              Analytics Premium
            </h3>
            <p className="text-sm text-zinc-400 mt-1">Ver métricas detalladas en tiempo real con gráficos y comparaciones</p>
          </div>
          <BarChart3 className="w-8 h-8 text-blue-400 group-hover:scale-110 transition-transform" />
        </div>
      </Link>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStatCard
          label="Ventas Hoy"
          value={stats ? formatCurrency(stats.salesToday) : 'S/ 0.00'}
          delta={stats?.deltaPercent}
          icon={TrendingUp}
          color="text-green-400"
          loading={isLoading}
        />
        <QuickStatCard
          label="Órdenes Activas"
          value={stats?.activeOrders?.toString() || '0'}
          icon={ShoppingCart}
          color="text-blue-400"
          loading={isLoading}
        />
        <QuickStatCard
          label="Terminales Online"
          value={stats?.terminalsOnline?.toString() || '0'}
          icon={Wifi}
          color="text-purple-400"
          loading={isLoading}
        />
        <QuickStatCard
          label="Productos"
          value={stats?.totalProducts?.toString() || '0'}
          icon={Package}
          color="text-amber-400"
          loading={isLoading}
        />
      </div>

      {/* Enhanced KPIs - E4 */}
      {stats?.ordersCountToday !== undefined && (
        <div className="grid grid-cols-2 gap-4">
          <QuickStatCard
            label="Órdenes Hoy"
            value={stats.ordersCountToday.toString()}
            icon={ShoppingCart}
            color="text-cyan-400"
          />
          <QuickStatCard
            label="Ticket Promedio"
            value={stats.avgTicketCents ? formatCurrency(stats.avgTicketCents) : 'S/ 0.00'}
            icon={TrendingUp}
            color="text-emerald-400"
          />
        </div>
      )}

      {/* Payment Breakdown - E4 */}
      {stats?.paymentBreakdown && Object.keys(stats.paymentBreakdown).length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase mb-3">Métodos de Pago</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.paymentBreakdown).map(([method, data]) => (
              <div key={method} className="px-3 py-2 bg-zinc-800 rounded-lg flex items-center gap-2">
                <span className="text-sm font-medium">{method}</span>
                <span className="text-xs text-zinc-500">({data.count})</span>
                <span className="text-sm font-mono text-emerald-400">{formatCurrency(data.totalCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly Sales Chart - E4 */}
      {stats?.hourlySales && stats.hourlySales.some(v => v > 0) && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase mb-3">Ventas por Hora</h2>
          <div className="flex items-end gap-1 h-24">
            {stats.hourlySales.map((val, hour) => {
              const maxVal = Math.max(...(stats.hourlySales || [0]));
              const height = maxVal > 0 ? (val / maxVal) * 100 : 0;
              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t transition-all ${val > 0 ? 'bg-emerald-500/60' : 'bg-zinc-800'}`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${hour}:00 — ${formatCurrency(val)}`}
                  />
                  {hour % 4 === 0 && <span className="text-[9px] text-zinc-600">{hour}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity - E4 */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase mb-3">Actividad Reciente</h2>
          <div className="space-y-2">
            {stats.recentActivity.map((activity: any) => (
              <div key={activity.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm">{activity.message}</span>
                <span className="text-xs text-zinc-500 ml-2 shrink-0">
                  {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Error al cargar métricas
        </div>
      )}

      {/* Alerts Panel */}
      {stats?.alerts && stats.alerts.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Alertas
            <span className="ml-auto text-sm font-normal text-zinc-500">{stats.alerts.length}</span>
          </h2>
          <div className="space-y-2">
            {stats.alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg border ${
                  alert.type === 'error' 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : alert.type === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                    alert.type === 'error' ? 'text-red-400' : 'text-amber-400'
                  }`} />
                  <p className="text-sm flex-1">{alert.message}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionButton
            label="Nuevo Producto"
            icon={Package}
            color="from-blue-500/20 to-blue-600/10"
            borderColor="border-blue-500/30 hover:border-blue-500/50"
            onClick={() => router.push('/admin/productos/nuevo')}
          />
          <QuickActionButton
            label="Nuevo Empleado"
            icon={Users}
            color="from-green-500/20 to-green-600/10"
            borderColor="border-green-500/30 hover:border-green-500/50"
            onClick={() => router.push('/admin/empleados/nuevo')}
          />
          <QuickActionButton
            label="Registrar Terminal"
            icon={Monitor}
            color="from-purple-500/20 to-purple-600/10"
            borderColor="border-purple-500/30 hover:border-purple-500/50"
            onClick={() => router.push('/admin/terminales/registrar')}
          />
          <QuickActionButton
            label="Ver Reportes"
            icon={BarChart3}
            color="from-amber-500/20 to-amber-600/10"
            borderColor="border-amber-500/30 hover:border-amber-500/50"
            onClick={() => router.push('/admin/reportes')}
          />
        </div>
      </div>

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
                className={`block p-4 bg-gradient-to-br ${card.color} rounded-xl border ${card.borderColor} transition-all group min-h-[120px]`}
              >
                <div className={`w-10 h-10 rounded-lg bg-zinc-800/50 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-3 transition-all`}>
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
        <p className="text-xs text-zinc-500 text-right flex items-center justify-end gap-2">
          <Clock className="w-3 h-3" />
          Última actualización: {new Date(stats.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function QuickStatCard({
  label,
  value,
  delta,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  const isPositive = delta !== undefined && delta >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className={`text-xl font-bold ${loading ? 'animate-pulse' : ''}`}>
            {loading ? '...' : value}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-zinc-500">{label}</p>
            {delta !== undefined && !loading && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                <TrendIcon className="w-3 h-3" />
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function QuickActionButton({
  label,
  icon: Icon,
  color,
  borderColor,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-4 bg-gradient-to-br ${color} rounded-xl border ${borderColor} transition-all group min-h-[100px] flex flex-col items-center justify-center gap-2`}
    >
      <div className="w-10 h-10 rounded-lg bg-zinc-800/50 flex items-center justify-center group-hover:scale-110 transition-transform">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-center">{label}</p>
    </motion.button>
  );
}
