'use client';

/**
 * Resumen de métricas de delivery del día
 */

import { useState, useEffect } from 'react';

interface Metrics {
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  avgDeliveryTimeMins: number;
  successRate: number;
}

export function MetricsSummary() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/admin/delivery/metrics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error('Error fetching metrics:', err);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) {
    return <div className="text-sm text-gray-500">Cargando métricas...</div>;
  }

  return (
    <div className="flex gap-4 text-sm">
      <div className="bg-white px-3 py-2 rounded-lg shadow-sm">
        <span className="text-gray-500">Hoy:</span>{' '}
        <span className="font-semibold">{metrics.totalDeliveries}</span>
      </div>
      <div className="bg-white px-3 py-2 rounded-lg shadow-sm">
        <span className="text-gray-500">Tiempo prom:</span>{' '}
        <span className="font-semibold">{metrics.avgDeliveryTimeMins} min</span>
      </div>
      <div className="bg-white px-3 py-2 rounded-lg shadow-sm">
        <span className="text-gray-500">Éxito:</span>{' '}
        <span className={`font-semibold ${
          metrics.successRate >= 95 ? 'text-green-600' : 
          metrics.successRate >= 90 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {metrics.successRate.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
