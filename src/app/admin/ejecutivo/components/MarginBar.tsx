'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TopProfitableProduct } from '@/src/core/types/executive-dashboard';

interface Props {
  products: TopProfitableProduct[];
}

function getBarColor(margin: number): string {
  if (margin >= 40) return '#10b981';
  if (margin >= 20) return '#f59e0b';
  return '#ef4444';
}

export default function MarginBar({ products }: Props) {
  if (products.length === 0) {
    return (
      <p className="text-zinc-500 text-sm py-8 text-center">Sin datos de margen</p>
    );
  }

  // Group by category, average margin
  const byCategory = products.reduce<
    Record<string, { totalMargin: number; count: number }>
  >((acc, p) => {
    const cat = p.category;
    if (!acc[cat]) acc[cat] = { totalMargin: 0, count: 0 };
    acc[cat].totalMargin += Number(p.marginPercent);
    acc[cat].count += 1;
    return acc;
  }, {});

  const chartData = Object.entries(byCategory)
    .map(([category, { totalMargin, count }]) => ({
      category,
      margin: Math.round((totalMargin / count) * 10) / 10,
    }))
    .sort((a, b) => b.margin - a.margin);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, bottom: 5, left: 5 }}
      >
        <XAxis
          type="number"
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
          domain={[0, 100]}
        />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Margen']}
        />
        <Bar dataKey="margin" radius={[0, 4, 4, 0]} barSize={20}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={getBarColor(entry.margin)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
