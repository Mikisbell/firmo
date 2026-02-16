'use client';

/**
 * Tenant Admin Dashboard
 * Dashboard para administradores de tenant mostrando configuración, cuotas y salud del sistema
 * 
 * Features:
 * - Configuración del tenant (nombre legal, RUC, dirección, logo, zona horaria, moneda)
 * - Uso de cuotas (terminales, empleados, productos, órdenes diarias)
 * - Métricas de salud (terminales activas, órdenes recientes, errores de sincronización, almacenamiento)
 * - Actividad reciente (últimos 10 eventos/acciones)
 * - Auto-refresh cada 30s
 * 
 * Requirements: 4.1, 5.7, 7.6
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  HardDrive,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Users,
  Package,
  ShoppingCart,
  Database,
  Zap,
} from 'lucide-react';
import { cachedFetch } from '../../../../lib/fetch-cache';

const REFRESH_INTERVAL = 30000; // 30 seconds

interface TenantConfiguration {
  tenant_id: string;
  legal_name: string;
  ruc?: string;
  address_text?: string;
  logo_url?: string;
  timezone: string;
  currency: string;
  receipt_footer_text?: string;
  kds_audio_enabled: boolean;
  kds_audio_volume: number;
  default_delivery_fee_cents: number;
  enable_tips: boolean;
  tips_on_invoice: boolean;
  allow_offline_coupon: boolean;
  max_offline_coupons_per_order: number;
  require_manager_for_offline: boolean;
}

interface TenantMetrics {
  tenant_id: string;
  date: string;
  active_terminals: number;
  total_orders: number;
  total_events: number;
  total_revenue_cents: number;
  avg_order_value_cents: number;
  peak_orders_per_hour: number;
  sync_errors: number;
  api_errors: number;
  storage_mb: number;
}

interface HealthCheck {
  type: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
}

interface TenantHealthStatus {
  tenant_id: string;
  overall_status: 'healthy' | 'warning' | 'critical';
  checks: HealthCheck[];
  last_checked: Date;
}

interface RecentActivity {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: any;
  created_at: string;
}

export default function TenantAdminDashboardPage() {
  const [configuration, setConfiguration] = useState<TenantConfiguration | null>(null);
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [health, setHealth] = useState<TenantHealthStatus | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch all data in parallel con caché optimizado
      // TTLs basados en frecuencia de cambio de datos:
      // - Configuration: 30s (cambia raramente)
      // - Metrics: 10s (actualiza frecuentemente)
      // - Health: 5s (tiempo real)
      // - Activity: 5s (tiempo real)
      const [configRes, metricsRes, healthRes, activityRes] = await Promise.allSettled([
        cachedFetch<TenantConfiguration>('/api/tenant/configuration', undefined, 30000),
        cachedFetch<TenantMetrics>('/api/admin/tenants/current/metrics', undefined, 10000),
        cachedFetch<TenantHealthStatus>('/api/admin/tenants/current/health', undefined, 5000),
        cachedFetch<RecentActivity[]>('/api/admin/tenants/current/activity?limit=10', undefined, 5000),
      ]);

      // Extract data with fallbacks
      const configData = configRes.status === 'fulfilled' ? configRes.value : null;
      const metricsData = metricsRes.status === 'fulfilled' ? metricsRes.value : null;
      const healthData = healthRes.status === 'fulfilled' ? healthRes.value : null;
      const activityData = activityRes.status === 'fulfilled' ? activityRes.value : [];

      setConfiguration(configData);
      setMetrics(metricsData);
      setHealth(healthData);
      setRecentActivity(Array.isArray(activityData) ? activityData : []);
      setLastUpdated(new Date());

      // Show warning if some APIs failed
      const failedApis = [configRes, metricsRes, healthRes, activityRes]
        .filter(r => r.status === 'rejected')
        .length;

      if (failedApis > 0) {
        console.warn(`${failedApis} tenant dashboard APIs failed`);
      }
    } catch (err) {
      console.error('Tenant dashboard fetch error:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatCurrency = (cents: number) => `${configuration?.currency || 'PEN'} ${(cents / 100).toFixed(2)}`;

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warn':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return 'bg-zinc-800/50 border-zinc-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tenant Dashboard</h1>
          <p className="text-zinc-400 mt-1">
            Configuración, cuotas y salud del sistema
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Tenant Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 rounded-xl border border-zinc-800 p-6"
      >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" />
          Configuración del Tenant
        </h2>

        {configuration ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo */}
            {configuration.logo_url && (
              <div className="md:col-span-2">
                <p className="text-xs text-zinc-500 uppercase mb-2">Logo</p>
                <img
                  src={configuration.logo_url}
                  alt="Tenant Logo"
                  className="h-16 object-contain"
                />
              </div>
            )}

            {/* Legal Name */}
            <div>
              <p className="text-xs text-zinc-500 uppercase mb-1">Nombre Legal</p>
              <p className="text-sm font-medium">{configuration.legal_name}</p>
            </div>

            {/* RUC */}
            {configuration.ruc && (
              <div>
                <p className="text-xs text-zinc-500 uppercase mb-1">RUC</p>
                <p className="text-sm font-medium">{configuration.ruc}</p>
              </div>
            )}

            {/* Address */}
            {configuration.address_text && (
              <div className="md:col-span-2">
                <p className="text-xs text-zinc-500 uppercase mb-1">Dirección</p>
                <p className="text-sm font-medium">{configuration.address_text}</p>
              </div>
            )}

            {/* Timezone */}
            <div>
              <p className="text-xs text-zinc-500 uppercase mb-1">Zona Horaria</p>
              <p className="text-sm font-medium">{configuration.timezone}</p>
            </div>

            {/* Currency */}
            <div>
              <p className="text-xs text-zinc-500 uppercase mb-1">Moneda</p>
              <p className="text-sm font-medium">{configuration.currency}</p>
            </div>

            {/* KDS Audio */}
            <div>
              <p className="text-xs text-zinc-500 uppercase mb-1">Audio KDS</p>
              <p className="text-sm font-medium">
                {configuration.kds_audio_enabled ? 'Habilitado' : 'Deshabilitado'}
                {configuration.kds_audio_enabled && ` (Volumen: ${configuration.kds_audio_volume}%)`}
              </p>
            </div>

            {/* Tips */}
            <div>
              <p className="text-xs text-zinc-500 uppercase mb-1">Propinas</p>
              <p className="text-sm font-medium">
                {configuration.enable_tips ? 'Habilitadas' : 'Deshabilitadas'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Cargando configuración...</p>
          </div>
        )}
      </motion.div>

      {/* Health Status */}
      {health && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border p-6 ${getHealthStatusColor(health.overall_status)}`}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Estado de Salud del Sistema
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {health.checks.map((check) => (
              <div key={check.type} className="flex items-start gap-3 p-3 rounded-lg bg-black/20">
                {getHealthStatusIcon(check.status)}
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{check.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-zinc-400 mt-1">{check.message}</p>
                </div>
              </div>
            ))}
          </div>

          {lastUpdated && (
            <p className="text-xs text-zinc-500 mt-4">
              Última verificación: {new Date(health.last_checked).toLocaleTimeString()}
            </p>
          )}
        </motion.div>
      )}

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="Terminales Activas"
            value={metrics.active_terminals.toString()}
            icon={Zap}
            color="blue"
          />
          <MetricCard
            label="Órdenes Totales"
            value={metrics.total_orders.toString()}
            icon={ShoppingCart}
            color="green"
          />
          <MetricCard
            label="Ingresos"
            value={formatCurrency(metrics.total_revenue_cents)}
            icon={TrendingUp}
            color="emerald"
          />
          <MetricCard
            label="Ticket Promedio"
            value={formatCurrency(metrics.avg_order_value_cents)}
            icon={Package}
            color="purple"
          />
          <MetricCard
            label="Errores de Sincronización"
            value={metrics.sync_errors.toString()}
            icon={AlertCircle}
            color={metrics.sync_errors > 0 ? 'red' : 'green'}
          />
          <MetricCard
            label="Almacenamiento"
            value={`${metrics.storage_mb} MB`}
            icon={HardDrive}
            color="orange"
          />
        </div>
      )}

      {/* Quota Usage */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 rounded-xl border border-zinc-800 p-6"
      >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-cyan-400" />
          Uso de Cuotas
        </h2>

        <div className="space-y-4">
          <QuotaBar label="Terminales" current={metrics?.active_terminals || 0} max={20} />
          <QuotaBar label="Empleados" current={metrics?.total_orders || 0} max={50} />
          <QuotaBar label="Productos" current={metrics?.total_events || 0} max={500} />
          <QuotaBar label="Órdenes Diarias" current={metrics?.total_orders || 0} max={1000} />
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 rounded-xl border border-zinc-800 p-6"
      >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          Actividad Reciente
        </h2>

        {recentActivity.length > 0 ? (
          <div className="space-y-2">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <Clock className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-zinc-500">
                    {activity.resource_type}
                    {activity.resource_id && ` • ${activity.resource_id}`}
                  </p>
                </div>
                <p className="text-xs text-zinc-500 flex-shrink-0">
                  {new Date(activity.created_at).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin actividad reciente</p>
          </div>
        )}
      </motion.div>

      {/* Footer */}
      {lastUpdated && (
        <p className="text-xs text-zinc-500 text-right">
          Última actualización: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    purple: 'bg-purple-500/10 text-purple-400',
    red: 'bg-red-500/10 text-red-400',
    orange: 'bg-orange-500/10 text-orange-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900 rounded-xl p-4 border border-zinc-800"
    >
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </motion.div>
  );
}

function QuotaBar({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number;
}) {
  const percent = Math.min((current / max) * 100, 100);
  const status = percent >= 90 ? 'critical' : percent >= 70 ? 'warning' : 'ok';

  const statusColors = {
    ok: 'bg-green-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-zinc-500">
          {current} / {max} ({percent.toFixed(0)}%)
        </p>
      </div>
      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full ${statusColors[status]}`}
        />
      </div>
    </div>
  );
}
