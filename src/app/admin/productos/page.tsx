'use client';

/**
 * Products Management Page
 * Lista de productos con búsqueda, filtros y CRUD
 * 
 * Requirements: 3.1, 3.2
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Check, X } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../components/DataTable';

interface Product {
  id: string;
  sku: string;
  name: string;
  short_name: string | null;
  price_cents: number;
  category: string;
  station: string;
  type: string;
  is_active: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'POLLOS', label: 'Pollos' },
  { value: 'PARRILLAS', label: 'Parrillas' },
  { value: 'BEBIDAS', label: 'Bebidas' },
  { value: 'EXTRAS', label: 'Extras' },
  { value: 'POSTRES', label: 'Postres' },
  { value: 'COMBOS', label: 'Combos' },
];

const STATION_OPTIONS = [
  { value: 'PARRILLA', label: 'Parrilla' },
  { value: 'COCINA', label: 'Cocina' },
  { value: 'BAR', label: 'Bar' },
  { value: 'HORNO', label: 'Horno' },
  { value: 'POSTRES', label: 'Postres' },
  { value: 'EMPAQUE', label: 'Empaque' },
];

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activo' },
  { value: 'false', label: 'Inactivo' },
];

const filters: FilterConfig[] = [
  { key: 'category', label: 'Categoría', options: CATEGORY_OPTIONS },
  { key: 'station', label: 'Estación', options: STATION_OPTIONS },
  { key: 'is_active', label: 'Estado', options: STATUS_OPTIONS },
];

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar productos');
      console.error('Products fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const formatPrice = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  const columns: Column<Product>[] = [
    { key: 'sku', label: 'SKU', width: '100px' },
    { key: 'name', label: 'Nombre' },
    {
      key: 'price_cents',
      label: 'Precio',
      width: '100px',
      render: (p) => formatPrice(p.price_cents),
    },
    { key: 'category', label: 'Categoría', width: '120px' },
    { key: 'station', label: 'Estación', width: '100px' },
    {
      key: 'is_active',
      label: 'Estado',
      width: '80px',
      render: (p) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            p.is_active
              ? 'bg-green-500/20 text-green-400'
              : 'bg-zinc-500/20 text-zinc-400'
          }`}
        >
          {p.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {p.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '80px',
      render: (p) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/admin/productos/${p.id}`);
            }}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Editar"
          >
            <Edit2 className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-zinc-400 mt-1">Gestionar catálogo de productos</p>
        </div>
        <button
          onClick={() => router.push('/admin/productos/nuevo')}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Products table */}
      <DataTable
        data={products}
        columns={columns}
        filters={filters}
        searchPlaceholder="Buscar por nombre o SKU..."
        searchKeys={['name', 'sku', 'short_name']}
        loading={loading}
        emptyMessage="No hay productos"
        onRowClick={(p) => router.push(`/admin/productos/${p.id}`)}
      />
    </div>
  );
}
