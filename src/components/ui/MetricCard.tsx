'use client';

/**
 * Tarjeta de metrica para dashboards.
 * Muestra valor numerico, etiqueta, tendencia opcional e icono.
 */

import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card } from './Card';

export interface MetricCardProps {
  label: string;
  value: string | number;
  /** Tendencia porcentual con direccion positiva/negativa */
  trend?: { value: number; isPositive: boolean };
  icon?: React.ReactNode;
  /** Formato de visualizacion del valor */
  format?: 'number' | 'currency' | 'percent';
  className?: string;
}

function formatValue(
  value: string | number,
  format: MetricCardProps['format'],
): string {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency':
      return `S/ ${(value / 100).toFixed(2)}`;
    case 'percent':
      return `${value}%`;
    case 'number':
    default:
      return value.toLocaleString('es-PE');
  }
}

export function MetricCard({
  label,
  value,
  trend,
  icon,
  format = 'number',
  className,
}: MetricCardProps) {
  return (
    <Card padding="none" className={cn('p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-park-gray-400">{label}</p>
          <p className="text-3xl font-bold text-white tabular-nums">
            {formatValue(value, format)}
          </p>
        </div>
        {icon && (
          <div className="text-park-gray-600">{icon}</div>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          {trend.isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
          <span
            className={cn(
              'text-sm font-medium',
              trend.isPositive ? 'text-green-400' : 'text-red-400',
            )}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
        </div>
      )}
    </Card>
  );
}
