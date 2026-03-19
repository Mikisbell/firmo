'use client';

import { useState, useEffect } from 'react';
import { Package, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

interface Metrics {
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  avgDeliveryTimeMins: number;
  successRate: number;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}

function MetricCard({ icon: Icon, label, value, color }: MetricCardProps) {
  return (
    <div className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="text-lg font-bold text-white leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export function MetricsSummary() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/admin/delivery/metrics');
        if (res.ok) setMetrics(await res.json());
      } catch {
        // silent
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) {
    return (
      <div className="flex gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-14 w-32 bg-zinc-800/60 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const successColor =
    metrics.successRate >= 95 ? 'bg-emerald-500/20 text-emerald-400' :
    metrics.successRate >= 90 ? 'bg-amber-500/20 text-amber-400' :
    'bg-red-500/20 text-red-400';

  return (
    <div className="flex flex-wrap gap-3">
      <MetricCard
        icon={Package}
        label="Hoy"
        value={String(metrics.totalDeliveries)}
        color="bg-orange-500/20 text-orange-400"
      />
      <MetricCard
        icon={CheckCircle}
        label="Completados"
        value={String(metrics.completedDeliveries)}
        color="bg-emerald-500/20 text-emerald-400"
      />
      <MetricCard
        icon={XCircle}
        label="Fallidos"
        value={String(metrics.failedDeliveries)}
        color="bg-red-500/20 text-red-400"
      />
      <MetricCard
        icon={Clock}
        label="Tiempo prom."
        value={`${metrics.avgDeliveryTimeMins} min`}
        color="bg-blue-500/20 text-blue-400"
      />
      <MetricCard
        icon={TrendingUp}
        label="Éxito"
        value={`${metrics.successRate.toFixed(0)}%`}
        color={successColor}
      />
    </div>
  );
}
