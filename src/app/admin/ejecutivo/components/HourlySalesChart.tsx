'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface Props {
  data: number[]; // 24 buckets, cents per hour
}

export default function HourlySalesChart({ data }: Props) {
  const chartData = data.map((cents, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    ventas: cents / 100,
  }));

  const maxValue = Math.max(...chartData.map((d) => d.ventas), 1);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="hour"
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: '#27272a' }}
          interval={2}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `S/.${v}`}
          domain={[0, Math.ceil(maxValue * 1.1)]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: '#a1a1aa' }}
          formatter={(value) => [`S/. ${Number(value).toFixed(2)}`, 'Ventas']}
        />
        <Bar dataKey="ventas" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
