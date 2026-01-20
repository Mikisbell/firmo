'use client';

/**
 * Create Product Page
 * Form to create new product with all fields
 * 
 * Requirements: 2.1, 2.2, 2.5, 2.6, 2.9, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, DollarSign } from 'lucide-react';

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

const TYPE_OPTIONS = [
  { value: 'SIMPLE', label: 'Simple' },
  { value: 'COMBO', label: 'Combo' },
];

export default function NewProductPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    sku: '',
    name: '',
    short_name: '',
    price_soles: '', // Display as soles, convert to centavos
    category: 'POLLOS',
    station: 'PARRILLA',
    type: 'SIMPLE',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Convert price from soles to centavos (integer)
      const price_cents = Math.round(parseFloat(form.price_soles) * 100);

      if (isNaN(price_cents) || price_cents < 0) {
        throw new Error('Precio inválido');
      }

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku,
          name: form.name,
          short_name: form.short_name || null,
          price_cents,
          category: form.category,
          station: form.station,
          type: form.type,
          is_active: form.is_active,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear producto');
      }

      router.push('/admin/productos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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
          <p className="text-zinc-400 mt-1">Agregar producto al catálogo</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* SKU and Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                <Package className="w-4 h-4 inline mr-1" />
                SKU *
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                placeholder="Ej: POLLO-1/4"
                required
                maxLength={50}
              />
              <p className="text-xs text-zinc-500 mt-1">
                Código único del producto
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Nombre completo *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                placeholder="Ej: 1/4 Pollo a la Brasa"
                required
                maxLength={100}
              />
            </div>
          </div>

          {/* Short name and Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Nombre corto (opcional)
              </label>
              <input
                type="text"
                value={form.short_name}
                onChange={(e) => setForm({ ...form, short_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                placeholder="Ej: 1/4 Pollo"
                maxLength={30}
              />
              <p className="text-xs text-zinc-500 mt-1">
                Para mostrar en pantallas pequeñas
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Precio (S/) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price_soles}
                onChange={(e) => setForm({ ...form, price_soles: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                placeholder="0.00"
                required
              />
              <p className="text-xs text-zinc-500 mt-1">
                Se almacena en centavos (entero)
              </p>
            </div>
          </div>

          {/* Category and Station */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Categoría *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                required
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Estación de preparación *
              </label>
              <select
                value={form.station}
                onChange={(e) => setForm({ ...form, station: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                required
              >
                {STATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Tipo de producto *
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
              required
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Active status */}
          <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="is_active" className="text-sm cursor-pointer">
              Producto activo (visible en el catálogo)
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creando...' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
