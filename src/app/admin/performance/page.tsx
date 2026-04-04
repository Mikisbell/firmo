'use client';

/**
 * Performance Dashboard
 * 
 * Dashboard para visualizar métricas de performance del sistema de caché.
 * Muestra cache hit rate, response times, cache size y memory usage.
 * 
 * Spec: react-cache-optimization
 * Requirements: 3.1, 3.2
 */

import { useState, useEffect } from 'react';
import { Activity, Database, Clock, HardDrive, TrendingUp, RefreshCw } from 'lucide-react';
import { Button, Card, PageHeader, MetricCard as DSMetricCard } from '@/src/components/ui';

interface PerformanceMetrics {
  cacheHitRate: number;
  avgResponseTime: number;
  cacheSize: number;
  memoryUsage: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

export default function PerformancePage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/performance/metrics', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar métricas');
      }
      
      const data = await response.json();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const resetMetrics = async () => {
    try {
      const response = await fetch('/api/admin/performance/metrics', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error al resetear métricas');
      }
      
      await fetchMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(fetchMetrics, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
        {error}
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <p className="text-park-gray-400">No hay métricas disponibles</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Métricas de caché y performance del sistema"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchMetrics}>
              Actualizar
            </Button>
            <Button variant="destructive" onClick={resetMetrics}>
              Reiniciar
            </Button>
          </div>
        }
      />

      {/* Last Updated */}
      <div className="text-sm text-park-gray-500">
        Última actualización: {lastUpdated.toLocaleTimeString('es-PE')}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DSMetricCard
          label="Tasa de aciertos de caché"
          value={`${metrics.cacheHitRate.toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <DSMetricCard
          label="Tiempo promedio de respuesta"
          value={`${metrics.avgResponseTime.toFixed(0)}ms`}
          icon={<Clock className="w-5 h-5" />}
        />
        <DSMetricCard
          label="Tamaño de caché"
          value={metrics.cacheSize.toString()}
          icon={<Database className="w-5 h-5" />}
        />
        <DSMetricCard
          label="Uso de memoria"
          value={`${(metrics.memoryUsage / 1024 / 1024).toFixed(1)} MB`}
          icon={<HardDrive className="w-5 h-5" />}
        />
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cache Performance */}
        <div className="p-4 bg-park-gray-900 rounded-xl border border-park-gray-800">
          <h2 className="font-medium mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            Rendimiento de caché
          </h2>
          <div className="space-y-3">
            <StatRow label="Total de solicitudes" value={metrics.totalRequests.toString()} />
            <StatRow label="Aciertos de caché" value={metrics.cacheHits.toString()} color="text-green-400" />
            <StatRow label="Fallos de caché" value={metrics.cacheMisses.toString()} color="text-red-400" />
            <StatRow label="Tasa de aciertos" value={`${metrics.cacheHitRate.toFixed(2)}%`} />
          </div>
        </div>

        {/* Response Times */}
        <div className="p-4 bg-park-gray-900 rounded-xl border border-park-gray-800">
          <h2 className="font-medium mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Tiempos de respuesta
          </h2>
          <div className="space-y-3">
            <StatRow label="Promedio" value={`${metrics.avgResponseTime.toFixed(2)}ms`} />
            <StatRow label="P95 (percentil 95)" value={`${metrics.p95ResponseTime.toFixed(2)}ms`} />
            <StatRow label="P99 (percentil 99)" value={`${metrics.p99ResponseTime.toFixed(2)}ms`} />
          </div>
        </div>
      </div>

      {/* Health Indicators */}
      <div className="p-4 bg-park-gray-900 rounded-xl border border-park-gray-800">
        <h2 className="font-medium mb-4">Indicadores de salud</h2>
        <div className="space-y-3">
          <HealthIndicator
            label="Tasa de aciertos de caché"
            value={metrics.cacheHitRate}
            threshold={70}
            unit="%"
            description="Debe ser >= 70%"
          />
          <HealthIndicator
            label="Tiempo promedio de respuesta"
            value={metrics.avgResponseTime}
            threshold={200}
            unit="ms"
            description="Debe ser <= 200ms"
            inverse
          />
          <HealthIndicator
            label="Tamaño de caché"
            value={metrics.cacheSize}
            threshold={1000}
            unit="entradas"
            description="Debe ser <= 1000 entradas"
            inverse
          />
          <HealthIndicator
            label="Uso de memoria"
            value={metrics.memoryUsage / 1024 / 1024}
            threshold={100}
            unit="MB"
            description="Debe ser <= 100MB"
            inverse
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-park-gray-900 rounded-xl p-4 border border-park-gray-800">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg bg-park-gray-800 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-park-gray-500">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
      {subtitle && (
        <p className="text-xs text-park-gray-500 mt-2">{subtitle}</p>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  color = 'text-zinc-100',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-park-gray-800 last:border-0">
      <span className="text-park-gray-400">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}

function HealthIndicator({
  label,
  value,
  threshold,
  unit,
  description,
  inverse = false,
}: {
  label: string;
  value: number;
  threshold: number;
  unit: string;
  description: string;
  inverse?: boolean;
}) {
  const isHealthy = inverse ? value <= threshold : value >= threshold;
  const percentage = inverse
    ? Math.min(100, (threshold / value) * 100)
    : Math.min(100, (value / threshold) * 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-park-gray-400">{label}</span>
        <span className={`text-sm font-medium ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
          {value.toFixed(1)} {unit}
        </span>
      </div>
      <div className="w-full bg-park-gray-800 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            isHealthy ? 'bg-green-400' : 'bg-red-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-park-gray-500">{description}</p>
    </div>
  );
}
