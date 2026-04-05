'use client';

/**
 * Recetas / Fichas Técnicas - Página de gestión
 * CRUD de recetas con tabla de ingredientes, filtros por área/categoría,
 * y cálculo de costo en tiempo real.
 */

import { useState } from 'react';
import { Plus, Edit2, Trash2, Calculator, ChefHat } from 'lucide-react';
import { toast } from 'sonner';
import { useRecipes } from '@/src/hooks/useRecipes';
import { motion, AnimatePresence } from 'framer-motion';
import RecipeModal from './components/RecipeModal';
import { Button, Badge, Card, PageHeader, EmptyState } from '@/src/components/ui';
import { Tooltip } from '@/src/components/ui/Tooltip';

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

const STATION_BADGE_VARIANT: Record<string, 'warning' | 'critical' | 'info' | 'neutral'> = {
  PARRILLA: 'warning',
  HORNO: 'critical',
  COCINA: 'warning',
  BAR: 'info',
  EMPAQUE: 'neutral',
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
      <PageHeader
        title="Recetas / Fichas Técnicas"
        description={`${total} recetas registradas`}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => { setEditingRecipe(null); setShowModal(true); }}
          >
            Nueva Receta
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={station}
          onChange={(e) => { setStation(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-park-gray-200 min-h-[44px]"
        >
          {STATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-park-gray-200 min-h-[44px]"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-park-critical-subtle border border-red-700 rounded-lg text-red-400">
          Error al cargar recetas: {error.message}
        </div>
      )}

      {/* Tabla */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                <th className="text-left py-3 px-4 text-park-gray-400 font-medium">Producto</th>
                <th className="text-left py-3 px-4 text-park-gray-400 font-medium">Receta</th>
                <th className="text-left py-3 px-4 text-park-gray-400 font-medium">Área</th>
                <th className="text-left py-3 px-4 text-park-gray-400 font-medium">Categoría</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Ingredientes</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Rendimiento</th>
                <th className="text-right py-3 px-4 text-park-gray-400 font-medium">Costo</th>
                <th className="text-center py-3 px-4 text-park-gray-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !recipes.length ? (
                <tr>
                  <td colSpan={8} className="py-4 px-4">
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 bg-park-gray-800 rounded animate-pulse" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : recipes.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={<ChefHat />}
                      title="Sin recetas"
                      description="Agrega tu primera receta o ficha técnica"
                      action={{ label: 'Nueva Receta', onClick: () => setShowModal(true) }}
                    />
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
                      className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-white font-medium">
                        {recipe.product_name ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-park-gray-300">
                        {recipe.name ?? recipe.product_name ?? '—'}
                      </td>
                      <td className="py-3 px-4">
                        {recipe.product_station && (
                          <Badge variant={STATION_BADGE_VARIANT[recipe.product_station] ?? 'neutral'}>
                            {recipe.product_station}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {recipe.category ? (
                          <Badge variant="neutral">{recipe.category}</Badge>
                        ) : (
                          <span className="text-park-gray-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="neutral">{recipe.ingredients.length}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center text-park-gray-300">
                        {recipe.yield_qty} {recipe.yield_unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-park-gray-200">
                        {formatCost(recipe.cost_cents)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip content="Recalcular costo">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Calculator className="w-4 h-4 text-emerald-400" />}
                              onClick={() => handleCalculateCost(recipe.id)}
                              title="Recalcular costo"
                            />
                          </Tooltip>
                          <Tooltip content="Editar">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Edit2 className="w-4 h-4" />}
                              onClick={() => { setEditingRecipe(recipe); setShowModal(true); }}
                              title="Editar"
                            />
                          </Tooltip>
                          <Tooltip content="Desactivar">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 className="w-4 h-4 text-red-400" />}
                              onClick={() => handleDeactivate(recipe.id)}
                              title="Desactivar"
                              className="hover:bg-red-900/30"
                            />
                          </Tooltip>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-park-gray-800">
            <span className="text-sm text-park-gray-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>
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
