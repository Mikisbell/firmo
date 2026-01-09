'use client';

/**
 * Promotions Management Page
 * Requirements: 6.1, 6.2, 6.3
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, X, Calendar, Percent } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../components/DataTable';

interface Promotion {
  id: string;
  name: string;
  type: string;
  value: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

const TYPE_OPTIONS = [
  { value: 'PERCENT', label: 'Porcentaje' },
  { value: 'FIXED', label: 'Monto Fijo' },
  { value: 'HAPPY_HOUR', label: 'Happy Hour' },
  { value: '2X1', label: '2x1' },
];

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activa' },
  { value: 'false', label: 'Inactiva' },
];

const filters: FilterConfig[] = [
  { key: 'type', label: 'Tipo', options: TYPE_OPTIONS },
  { key: 'is_active', label: 'Estado', options: STATUS_OPTIONS },
];

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPromotions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/promotions');
      if (!res.ok) throw new Error('Failed to fetch');
      setPromotions(await res.json());
      setError(null);
    } catch {
      setError('Error al cargar promociones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPromotions(); }, [fetchPromotions]);

  const isExpired = (endsAt: string) => new Date(endsAt) < new Date();

  const columns: Column<Promotion>[] = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'type',
      label: 'Tipo',
      width: '120px',
      render: (p) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400">
          <Percent className="w-3 h-3" />
          {TYPE_OPTIONS.find((t) => t.value === p.type)?.label || p.type}
        </span>
      ),
    },
    { key: 'value', label: 'Valor', width: '80px' },
    {
      key: 'dates',
      label: 'Vigencia',
      render: (p) => (
        <span className={`text-xs ${isExpired(p.ends_at) ? 'text-red-400' : 'text-zinc-400'}`}>
          <Calendar className="w-3 h-3 inline mr-1" />
          {new Date(p.starts_at).toLocaleDateString()} - {new Date(p.ends_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Estado',
      width: '100px',
      render: (p) => (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
          p.is_active && !isExpired(p.ends_at)
            ? 'bg-green-500/20 text-green-400'
            : 'bg-zinc-500/20 text-zinc-400'
        }`}>
          {p.is_active && !isExpired(p.ends_at) ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {isExpired(p.ends_at) ? 'Expirada' : p.is_active ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promociones</h1>
          <p className="text-zinc-400 mt-1">Gestionar ofertas y descuentos</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px]">
          <Plus className="w-4 h-4" />
          Nueva Promoción
        </button>
      </div>
      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <DataTable data={promotions} columns={columns} filters={filters} searchPlaceholder="Buscar..." searchKeys={['name']} loading={loading} emptyMessage="No hay promociones" />
    </div>
  );
}
