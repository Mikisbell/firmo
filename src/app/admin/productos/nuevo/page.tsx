'use client';

/**
 * Create Product Page
 * Requirements: 2.1, 2.2, 2.5, 2.6, 2.9, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { handleApiCall, formatApiError } from '@/src/lib/api-utils';

const CATEGORIES = [
  { value: 'POLLOS', label: 'Pollos' },
  { value: 'PARRILLAS', label: 'Parrillas' },
  { value: 'BEBIDAS', label: 'Bebidas' },
  { value: 'EXTRAS', label: 'Extras' },
  { value: 'POSTRES', label: 'Postres' },
  { value: 'COMBOS', label: 'Combos' },
];

const STATIONS = [
  { value: 'PARRILLA', label: 'Parrilla' },
  { value: 'COCINA', label: 'Cocina' },
  { value: 'BAR', label: 'Bar' },
  { value: 'HORNO', label: 'Horno' },
  { value: 'POSTRES', label: 'Postres' },
  { value: 'EMPAQUE', label: 'Empaque' },
];

const TYPES = [
  { value: 'SIMPLE', label: 'Simple' },
  { value: 'COMBO', label: 'Combo' },
];

export default function NewProductPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    sku: '',
    name: '',
    short_name: '',
    price_cents: 0,
    category: 'POLLOS',
    station: 'PARRILLA',
    type: 'SIMPLE',
    is_active: true,
  });
  const [priceDisplay, setPriceDisplay] = useState('0.00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePriceChange = (value: string) => {
    // Remove non-numeric characters except decimal point
    const cleaned = value.replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? `${parts[0]}.${parts.slice(1).join('')}` 
      : cleaned;
    
    setPriceDisplay(formatted);
    
    // Convert to centavos (integer)
    const cents = Math.round(parseFloat(formatted || '0') * 100);
    setForm({ ...form, price_cents: cents });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Client-side validation
      if (!form.sku.trim()) {
        throw new Error('El SKU es requerido');
      }

      if (!form.name.trim()) {
        throw new Error('El nombre es requerido');
      }

      if (form.price_cents < 0) {
        throw new Error('El precio debe ser mayor o igual a 0');
      }

      await handleApiCall('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          short_name: form.short_name || null,
        }),
      });

      router.push('/admin/productos');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Nuevo Producto</h1>
          <p className="text-zinc-400 mt-1">Agregar un nuevo producto al menú</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* SKU and Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              SKU *
            </label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none transition-colors"
              placeholder="Ej: POLLO-1/4"
              required
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Precio (S/) *
            </label>
            <input
              type="text"
              value={priceDisplay}
              onChange={(e) => handlePriceChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none transition-colors"
              placeholder="0.00"
              required
            />
            <p className="text-xs text-zinc-500 mt-1">
              Centavos: {form.price_cents}
            </p>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Nombre *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none transition-colors"
            placeholder="Ej: 1/4 Pollo a la Brasa"
            required
            maxLength={100}
          />
        </div>

        {/* Short Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Nombre Corto (opcional)
          </label>
          <input
            type="text"
            value={form.short_name}
            onChange={(e) => setForm({ ...form, short_name: e.target.value })}
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none transition-colors"
            placeholder="Ej: 1/4 Pollo"
            maxLength={30}
          />
          <p className="text-xs text-zinc-500 mt-1">
            Nombre abreviado para tickets y pantallas
          </p>
        </div>

        {/* Category, Station, Type */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Categoría *
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none transition-colors"
              required
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Estación *
            </label>
            <select
              value={form.station}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none transition-colors"
              required
            >
              {STATIONS.map(station => (
                <option key={station.value} value={station.value}>
                  {station.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Tipo *
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none transition-colors"
              required
            >
              {TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Status */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-sm text-zinc-300">Producto activo</span>
        </label>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear Producto'}
          </button>
        </div>
      </form>
    </div>
  );
}
