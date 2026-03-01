'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { PaymentMethodSummary } from '@/src/core/types/executive-dashboard';

const COLORS: Record<string, string> = {
  CASH: '#10b981',
  YAPE: '#8b5cf6',
  PLIN: '#06b6d4',
  CARD: '#f59e0b',
  TRANSFER: '#3b82f6',
};

const LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  CARD: 'Tarjeta',
  TRANSFER: 'Transfer.',
};

interface Props {
  data: PaymentMethodSummary[];
}

export default function PaymentDonut({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-zinc-500 text-sm py-8 text-center">Sin pagos registrados</p>
    );
  }

  const chartData = data.map((d) => ({
    name: LABELS[d.method] ?? d.method,
    value: d.totalCents / 100,
    count: d.count,
    color: COLORS[d.method] ?? '#71717a',
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value) => [`S/. ${Number(value).toFixed(2)}`, 'Total']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-zinc-400">
              {entry.name}{' '}
              <span className="text-zinc-500">
                ({total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
