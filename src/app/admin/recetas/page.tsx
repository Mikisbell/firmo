'use client';

/**
 * Recetas / Fichas Técnicas - Página de gestión
 * CRUD de recetas con tabla de ingredientes, filtros por área/categoría,
 * y cálculo de costo en tiempo real.
 */

import { useState } from 'react';
import { BookOpen, Plus, Edit2, Trash2, Calculator, ChefHat } from 'lucide-react';
import { toast } from 'sonner';
import { useRecipes } from '@/src/hooks/useRecipes';
import { motion, AnimatePresence } from 'framer-motion';
import RecipeModal from './components/RecipeModal';

interface Recipe {
  id: string;
  product_id: string;
  name: string | null;
  ingredients: Array<{ inventory_code: string; quantity: number; unit: string; is_optional?: boolean }>;
  yield_qty: number;
  yield_unit: string;
  conversion_factor: number;
  category: string | null;
  preparation_time_minutes: number | null;
  cost_cents: number | null;
  is_active: boolean;
  product_name: string | null;
  product_station: string | null;
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'POLLO', label: 'Pollo' },
  { value: 'ADEREZO', label: 'Aderezo' },
  { value: 'GUARNICION', label: 'Guarnición' },
  { value: 'SALSA', label: 'Salsa' },
  { value: 'BEBIDA', label: 'Bebida' },
  { value: 'POSTRE', label: 'Postre' },
  { value: 'OTRO', label: 'Otro' },
];

const STATION_OPTIONS = [
  { value: '', label: 'Todas las áreas' },
  { value: 'PARRILLA', label: 'Parrillas' },
  { value: 'HORNO', label: 'Horno' },
  { value: 'COCINA', label: 'Cocina' },
  { value: 'BAR', label: 'Bar' },
  { value: 'EMPAQUE', label: 'Empaque' },
];

const STATION_COLORS: Record<string, string> = {
  PARRILLA: 'bg-orange-900/30 text-orange-300 border-orange-700',
  HORNO: 'bg-red-900/30 text-red-300 border-red-700',
  COCINA: 'bg-amber-900/30 text-amber-300 border-amber-700',
  BAR: 'bg-sky-900/30 text-sky-300 border-sky-700',
  EMPAQUE: 'bg-violet-900/30 text-violet-300 border-violet-700',
};

export default function RecetasPage() {
  const [category, setCategory] = useState('');
  const [station, setStation] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const { recipes, total, totalPages, isLoading, error, mutate } = useRecipes({
    page,
    limit: 20,
    category: category || undefined,
    station: station || undefined,
  });

  const formatCost = (cents: number | null) =>
    cents != null ? `S/ ${(cents / 100).toFixed(2)}` : '—';

  const handleCalculateCost = async (recipeId: string) => {
    try {
      const res = await fetch(`/api/admin/recipes/${recipeId}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        toast.success('Costo recalculado');
        mutate();
      } else {
        toast.error('Error al recalcular costo');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleDeactivate = async (recipeId: string) => {
    try {
      const res = await fetch(`/api/admin/recipes/${recipeId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Receta desactivada');
        mutate();
      } else {
        toast.error('Error al desactivar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-900/30 rounded-lg">
            <BookOpen className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Recetas / Fichas Técnicas</h1>
            <p className="text-sm text-zinc-400">{total} recetas registradas</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors min-h-[44px]"
          onClick={() => { setEditingRecipe(null); setShowModal(true); }}
        >
          <Plus className="w-4 h-4" />
          Nueva Receta
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={station}
          onChange={(e) => { setStation(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 min-h-[44px]"
        >
          {STATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 min-h-[44px]"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
          Error al cargar recetas: {error.message}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Producto</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Receta</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Área</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Categoría</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium">Ingredientes</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium">Rendimiento</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Costo</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !recipes.length ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    Cargando recetas...
                  </td>
                </tr>
              ) : recipes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <ChefHat className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
                    No hay recetas registradas
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {(recipes as Recipe[]).map((recipe) => (
                    <motion.tr
                      key={recipe.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-zinc-200 font-medium">
                        {recipe.product_name ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-zinc-300">
                        {recipe.name ?? recipe.product_name ?? '—'}
                      </td>
                      <td className="py-3 px-4">
                        {recipe.product_station && (
                          <span className={`px-2 py-1 text-xs rounded border ${STATION_COLORS[recipe.product_station] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                            {recipe.product_station}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {recipe.category ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-zinc-300">
                        {recipe.ingredients.length}
                      </td>
                      <td className="py-3 px-4 text-center text-zinc-300">
                        {recipe.yield_qty} {recipe.yield_unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-200">
                        {formatCost(recipe.cost_cents)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleCalculateCost(recipe.id)}
                            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Recalcular costo"
                          >
                            <Calculator className="w-4 h-4 text-emerald-400" />
                          </button>
                          <button
                            onClick={() => { setEditingRecipe(recipe); setShowModal(true); }}
                            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4 text-zinc-400" />
                          </button>
                          <button
                            onClick={() => handleDeactivate(recipe.id)}
                            className="p-2 hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Desactivar"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
            <span className="text-sm text-zinc-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded text-sm text-zinc-300 min-h-[36px]"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded text-sm text-zinc-300 min-h-[36px]"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Recipe Create / Edit Modal */}
    {showModal && (
      <RecipeModal
        recipe={editingRecipe}
        onClose={() => { setShowModal(false); setEditingRecipe(null); }}
        onSuccess={() => mutate()}
      />
    )}
    </>
  );
}
