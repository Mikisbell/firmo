'use client';

/**
 * Dashboard de Monitoreo - PARK POS
 * 
 * Muestra métricas en tiempo real del sistema:
 * - Error rate y tendencias
 * - Tiempos de respuesta de API por endpoint
 * - Cache hit rate y uso de memoria
 * - Estadísticas de performance de queries de base de datos
 * - Web Vitals scores para todas las páginas
 * 
 * Filtros disponibles:
 * - Rango de tiempo (1h, 24h, 7d, 30d)
 * - Filtros por tenant y terminal
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
 * 
 * @module admin/monitoring
 */

import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Activity,
  Clock,
  Database,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Zap,
  HardDrive,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useMetrics } from '@/src/hooks/useSWRHooks';

// Tipos de datos
interface MetricsSummary {
  totalMetrics: number;
  period: string;
  startTime: string;
  endTime: string;
  filters: {
    tenantId: string | null;
    terminalId: string | null;
    metricType: string | null;
  };
}

interface AggregatedMetric {
  name: string;
  type: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  latest: number;
  tags: Record<string, string[]>;
}

interface HistogramStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

interface MetricsData {
  metrics: AggregatedMetric[];
  summary: MetricsSummary;
  counters: Record<string, number>;
  histograms: Record<string, HistogramStats>;
}

// Colores para gráficos
const COLORS = {
  primary: '#f59e0b', // amber-500
  success: '#10b981', // green-500
  error: '#ef4444', // red-500
  warning: '#f97316', // orange-500
  info: '#3b82f6', // blue-500
  purple: '#a855f7', // purple-500
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.info,
  COLORS.success,
  COLORS.warning,
  COLORS.error,
  COLORS.purple,
];

export default function MonitoringDashboard() {
  // Filtros
  const [period, setPeriod] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [tenantId, setTenantId] = useState<string>('');
  const [terminalId, setTerminalId] = useState<string>('');
  
  // Construir parámetros para el hook
  const params: Record<string, string> = { period };
  if (tenantId) params.tenantId = tenantId;
  if (terminalId) params.terminalId = terminalId;
  
  // Migrado a SWR - deduplicación automática, revalidación cada 30s
  const { data: result, error, isLoading: loading, mutate } = useMetrics(params, {
    refreshInterval: 30000, // Auto-refresh cada 30 segundos
  });
  
  const metricsData = result?.success ? result.data : null;

  // Calcular error rate
  const calculateErrorRate = (): number => {
    if (!metricsData) return 0;
    
    const totalRequests = metricsData.counters['http_requests_total'] || 0;
    const totalErrors = metricsData.counters['api_errors_total'] || 0;
    
    if (totalRequests === 0) return 0;
    return (totalErrors / totalRequests) * 100;
  };

  // Calcular cache hit rate
  const calculateCacheHitRate = (): number => {
    if (!metricsData) return 0;
    
    const hits = metricsData.counters['cache_hits_total'] || 0;
    const misses = metricsData.counters['cache_misses_total'] || 0;
    const total = hits + misses;
    
    if (total === 0) return 0;
    return (hits / total) * 100;
  };

  // Obtener datos de tiempos de respuesta por endpoint
  const getResponseTimeData = (): Array<{ endpoint: string; avg: number; p95: number; p99: number }> => {
    if (!metricsData) return [];
    
    const data: Array<{ endpoint: string; avg: number; p95: number; p99: number }> = [];
    
    // Buscar métricas de duración HTTP
    for (const [key, stats] of Object.entries(metricsData.histograms)) {
      if (key.includes('http_request_duration_ms')) {
        // Extraer endpoint del key
        const match = key.match(/pathname:([^,}]+)/);
        const endpoint = match ? match[1] : 'unknown';
        
        const histStats = stats as HistogramStats;
        data.push({
          endpoint,
          avg: Math.round(histStats.avg),
          p95: Math.round(histStats.p95),
          p99: Math.round(histStats.p99),
        });
      }
    }
    
    return data.slice(0, 10); // Top 10 endpoints
  };

  // Obtener datos de Web Vitals
  const getWebVitalsData = (): Array<{ metric: string; value: number; threshold: number }> => {
    if (!metricsData) return [];
    
    const vitals = [
      { metric: 'TTFB', key: 'web_vitals_ttfb', threshold: 200 },
      { metric: 'FCP', key: 'web_vitals_fcp', threshold: 1000 },
      { metric: 'LCP', key: 'web_vitals_lcp', threshold: 2500 },
      { metric: 'TTI', key: 'web_vitals_tti', threshold: 3000 },
      { metric: 'CLS', key: 'web_vitals_cls', threshold: 0.1 },
    ];
    
    return vitals.map(({ metric, key, threshold }) => {
      const stats = metricsData.histograms[key];
      return {
        metric,
        value: stats ? Math.round(stats.avg * 100) / 100 : 0,
        threshold,
      };
    });
  };

  // Obtener datos de queries de base de datos
  const getDatabaseQueryData = (): Array<{ query: string; count: number; avgTime: number }> => {
    if (!metricsData) return [];
    
    const data: Array<{ query: string; count: number; avgTime: number }> = [];
    
    // Buscar métricas de queries lentas
    for (const metric of metricsData.metrics) {
      if (metric.name.includes('slow_query')) {
        data.push({
          query: metric.name.replace('slow_query_', ''),
          count: metric.count,
          avgTime: Math.round(metric.avg),
        });
      }
    }
    
    return data.slice(0, 10); // Top 10 queries
  };

  // Obtener datos de distribución de requests por status
  const getRequestStatusData = (): Array<{ name: string; value: number }> => {
    if (!metricsData) return [];
    
    const statusCounts: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(metricsData.counters)) {
      if (key.includes('http_requests_total')) {
        const match = key.match(/status:(\d+)/);
        if (match) {
          const status = match[1];
          const category = status.startsWith('2') ? '2xx Success' :
                          status.startsWith('3') ? '3xx Redirect' :
                          status.startsWith('4') ? '4xx Client Error' :
                          status.startsWith('5') ? '5xx Server Error' : 'Other';
          
          const count = typeof value === 'number' ? value : 0;
          statusCounts[category] = (statusCounts[category] || 0) + count;
        }
      }
    }
    
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  };

  /**
   * Exportar métricas a CSV
   * 
   * Genera un archivo CSV con todas las métricas visibles en el dashboard:
   * - Métricas principales (error rate, cache hit rate, total requests, avg response time)
   * - Tiempos de respuesta por endpoint
   * - Distribución de requests por status
   * - Web Vitals scores
   * - Queries lentas de base de datos
   * 
   * El archivo incluye:
   * - Timestamp de exportación
   * - Filtros aplicados (período, tenant, terminal)
   * - Headers descriptivos
   * - Encoding UTF-8 con BOM para compatibilidad con Excel
   * 
   * Requirement: 11.10
   */
  const exportToCSV = () => {
    if (!metricsData) return;

    const timestamp = new Date().toISOString();
    const filename = `park-pos-metrics-${timestamp.replace(/[:.]/g, '-')}.csv`;

    // Construir CSV con BOM para UTF-8 (compatibilidad con Excel)
    const BOM = '\uFEFF';
    let csv = BOM;

    // Header del CSV con información de exportación
    csv += '# PARK POS - Reporte de Métricas\n';
    csv += `# Fecha de exportación: ${new Date().toLocaleString('es-PE')}\n`;
    csv += `# Período: ${period}\n`;
    csv += `# Rango: ${new Date(metricsData.summary.startTime).toLocaleString('es-PE')} - ${new Date(metricsData.summary.endTime).toLocaleString('es-PE')}\n`;
    if (tenantId) csv += `# Tenant ID: ${tenantId}\n`;
    if (terminalId) csv += `# Terminal ID: ${terminalId}\n`;
    csv += '\n';

    // Sección 1: Métricas Principales
    csv += '## MÉTRICAS PRINCIPALES\n';
    csv += 'Métrica,Valor,Unidad,Detalles\n';
    csv += `Error Rate,${errorRate.toFixed(2)},"%","${metricsData.counters['api_errors_total'] || 0} errores de ${metricsData.counters['http_requests_total'] || 0} requests"\n`;
    csv += `Cache Hit Rate,${cacheHitRate.toFixed(1)},"%","${metricsData.counters['cache_hits_total'] || 0} hits / ${metricsData.counters['cache_misses_total'] || 0} misses"\n`;
    csv += `Total Requests,${metricsData.counters['http_requests_total'] || 0},requests,"En el período seleccionado"\n`;
    
    const avgResponseTime = metricsData.histograms['http_request_duration_ms']?.avg || 0;
    const p95ResponseTime = metricsData.histograms['http_request_duration_ms']?.p95 || 0;
    csv += `Avg Response Time,${Math.round(avgResponseTime)},ms,"P95: ${Math.round(p95ResponseTime)}ms"\n`;
    csv += '\n';

    // Sección 2: Tiempos de Respuesta por Endpoint
    csv += '## TIEMPOS DE RESPUESTA POR ENDPOINT\n';
    csv += 'Endpoint,Promedio (ms),P95 (ms),P99 (ms)\n';
    responseTimeData.forEach(item => {
      csv += `"${item.endpoint}",${item.avg},${item.p95},${item.p99}\n`;
    });
    csv += '\n';

    // Sección 3: Distribución de Requests por Status
    csv += '## DISTRIBUCIÓN DE REQUESTS POR STATUS\n';
    csv += 'Categoría,Cantidad,Porcentaje\n';
    const totalRequests = requestStatusData.reduce((sum, item) => sum + item.value, 0);
    requestStatusData.forEach(item => {
      const percentage = totalRequests > 0 ? ((item.value / totalRequests) * 100).toFixed(1) : '0.0';
      csv += `"${item.name}",${item.value},${percentage}%\n`;
    });
    csv += '\n';

    // Sección 4: Web Vitals
    csv += '## WEB VITALS PERFORMANCE\n';
    csv += 'Métrica,Valor Actual,Threshold,Estado\n';
    webVitalsData.forEach(item => {
      const status = item.value <= item.threshold ? 'PASS' : 'FAIL';
      csv += `${item.metric},${item.value},${item.threshold},${status}\n`;
    });
    csv += '\n';

    // Sección 5: Queries Lentas de Base de Datos
    csv += '## QUERIES LENTAS DE BASE DE DATOS\n';
    csv += 'Query,Cantidad,Tiempo Promedio (ms),Estado\n';
    databaseQueryData.forEach(item => {
      const status = item.avgTime > 1000 ? 'SLOW' : 'OK';
      csv += `"${item.query}",${item.count},${item.avgTime},${status}\n`;
    });
    csv += '\n';

    // Sección 6: Todas las Métricas (raw data)
    csv += '## TODAS LAS MÉTRICAS (RAW DATA)\n';
    csv += 'Nombre,Tipo,Count,Sum,Min,Max,Avg,Latest\n';
    metricsData.metrics.forEach(metric => {
      csv += `"${metric.name}",${metric.type},${metric.count},${metric.sum},${metric.min},${metric.max},${metric.avg.toFixed(2)},${metric.latest}\n`;
    });

    // Crear blob y descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  if (loading && !metricsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-zinc-400">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error al cargar métricas</h2>
          <p className="text-zinc-400 mb-4">{error.message || 'Error desconocido'}</p>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const errorRate = calculateErrorRate();
  const cacheHitRate = calculateCacheHitRate();
  const responseTimeData = getResponseTimeData();
  const webVitalsData = getWebVitalsData();
  const databaseQueryData = getDatabaseQueryData();
  const requestStatusData = getRequestStatusData();

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard de Monitoreo</h1>
        <p className="text-zinc-400">
          Métricas en tiempo real del sistema PARK POS
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-zinc-900 rounded-lg p-6 mb-6 border border-zinc-800">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Período */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Período de tiempo
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="1h">Última hora</option>
              <option value="24h">Últimas 24 horas</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
            </select>
          </div>

          {/* Tenant ID */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Tenant ID (opcional)
            </label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Filtrar por tenant"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Terminal ID */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Terminal ID (opcional)
            </label>
            <input
              type="text"
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)}
              placeholder="Filtrar por terminal"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Auto-refresh - Ahora controlado por SWR */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">
              Auto-refresh: 30s
            </span>
          </div>

          {/* Botón de refresh manual */}
          <button
            onClick={() => mutate()}
            disabled={loading}
            className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          {/* Botón de exportación CSV */}
          <button
            onClick={exportToCSV}
            disabled={!metricsData || loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Exportar métricas a CSV"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Error Rate */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-medium text-zinc-400">Error Rate</h3>
            </div>
            {errorRate < 1 ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {errorRate.toFixed(2)}%
          </div>
          <div className="text-xs text-zinc-500">
            {metricsData?.counters['api_errors_total'] || 0} errores de{' '}
            {metricsData?.counters['http_requests_total'] || 0} requests
          </div>
        </div>

        {/* Cache Hit Rate */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-medium text-zinc-400">Cache Hit Rate</h3>
            </div>
            {cacheHitRate > 80 ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-orange-500" />
            )}
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {cacheHitRate.toFixed(1)}%
          </div>
          <div className="text-xs text-zinc-500">
            {metricsData?.counters['cache_hits_total'] || 0} hits /{' '}
            {metricsData?.counters['cache_misses_total'] || 0} misses
          </div>
        </div>

        {/* Total Requests */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-medium text-zinc-400">Total Requests</h3>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {(metricsData?.counters['http_requests_total'] || 0).toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500">
            En el período seleccionado
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-purple-500" />
            <h3 className="text-sm font-medium text-zinc-400">Avg Response Time</h3>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {metricsData?.histograms['http_request_duration_ms']?.avg
              ? Math.round(metricsData.histograms['http_request_duration_ms'].avg)
              : 0}
            <span className="text-lg text-zinc-500">ms</span>
          </div>
          <div className="text-xs text-zinc-500">
            P95: {metricsData?.histograms['http_request_duration_ms']?.p95
              ? Math.round(metricsData.histograms['http_request_duration_ms'].p95)
              : 0}ms
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Tiempos de respuesta por endpoint */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            Tiempos de Respuesta por Endpoint
          </h3>
          {responseTimeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="endpoint"
                  stroke="#71717a"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="avg" fill={COLORS.primary} name="Promedio (ms)" />
                <Bar dataKey="p95" fill={COLORS.warning} name="P95 (ms)" />
                <Bar dataKey="p99" fill={COLORS.error} name="P99 (ms)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-zinc-500">
              No hay datos disponibles
            </div>
          )}
        </div>

        {/* Distribución de requests por status */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Distribución de Requests por Status
          </h3>
          {requestStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={requestStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {requestStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-zinc-500">
              No hay datos disponibles
            </div>
          )}
        </div>
      </div>

      {/* Web Vitals */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Web Vitals Performance
        </h3>
        {webVitalsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={webVitalsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="metric" stroke="#71717a" tick={{ fill: '#71717a' }} />
              <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="value" fill={COLORS.primary} name="Valor actual" />
              <Bar dataKey="threshold" fill={COLORS.success} name="Threshold" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-zinc-500">
            No hay datos de Web Vitals disponibles
          </div>
        )}
      </div>

      {/* Queries de base de datos */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-green-500" />
          Queries Lentas de Base de Datos
        </h3>
        {databaseQueryData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Query</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">Count</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">Avg Time (ms)</th>
                </tr>
              </thead>
              <tbody>
                {databaseQueryData.map((query, index) => (
                  <tr key={index} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="py-3 px-4 text-sm text-white font-mono">{query.query}</td>
                    <td className="py-3 px-4 text-sm text-zinc-400 text-right">{query.count}</td>
                    <td className="py-3 px-4 text-sm text-zinc-400 text-right">
                      <span className={query.avgTime > 1000 ? 'text-red-500' : 'text-green-500'}>
                        {query.avgTime}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-500">
            No hay queries lentas registradas
          </div>
        )}
      </div>

      {/* Footer con información del período */}
      <div className="mt-6 text-center text-sm text-zinc-500">
        Última actualización: {new Date().toLocaleString('es-PE')}
        {metricsData?.summary && (
          <span className="ml-4">
            Período: {new Date(metricsData.summary.startTime).toLocaleString('es-PE')} -{' '}
            {new Date(metricsData.summary.endTime).toLocaleString('es-PE')}
          </span>
        )}
      </div>
    </div>
  );
}
