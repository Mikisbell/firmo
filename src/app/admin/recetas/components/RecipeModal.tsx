'use client';

/**
 * RecipeModal — Create / Edit modal for recipes (fichas técnicas)
 * - If `recipe` prop is provided → edit mode (PUT /api/admin/recipes/[id])
 * - Otherwise → create mode (POST /api/admin/recipes)
 */

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface RecipeIngredient {
  inventory_code: string;
  quantity: number;
  unit: string;
  is_optional: boolean;
}

interface Recipe {
  id: string;
  product_id: string;
  name: string | null;
  ingredients: Array<{
    inventory_code: string;
    quantity: number;
    unit: string;
    is_optional?: boolean;
  }>;
  yield_qty: number;
  yield_unit: string;
  conversion_factor: number;
  category: string | null;
  preparation_time_minutes: number | null;
  notes?: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  station: string;
}

interface RecipeModalProps {
  recipe?: Recipe | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'POLLO', label: 'Pollo' },
  { value: 'ADEREZO', label: 'Aderezo' },
  { value: 'GUARNICION', label: 'Guarnición' },
  { value: 'SALSA', label: 'Salsa' },
  { value: 'BEBIDA', label: 'Bebida' },
  { value: 'POSTRE', label: 'Postre' },
  { value: 'OTRO', label: 'Otro' },
];

const EMPTY_INGREDIENT: RecipeIngredient = {
  inventory_code: '',
  quantity: 1,
  unit: '',
  is_optional: false,
};

export default function RecipeModal({ recipe, onClose, onSuccess }: RecipeModalProps) {
  const isEditing = Boolean(recipe);

  // Form state
  const [productId, setProductId] = useState(recipe?.product_id ?? '');
  const [name, setName] = useState(recipe?.name ?? '');
  const [category, setCategory] = useState(recipe?.category ?? '');
  const [yieldQty, setYieldQty] = useState<number>(recipe?.yield_qty ?? 1);
  const [yieldUnit, setYieldUnit] = useState(recipe?.yield_unit ?? 'UNIDADES');
  const [conversionFactor, setConversionFactor] = useState<number>(recipe?.conversion_factor ?? 1.0);
  const [prepTime, setPrepTime] = useState<number | ''>(recipe?.preparation_time_minutes ?? '');
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients?.length
      ? recipe.ingredients.map((ing) => ({
          inventory_code: ing.inventory_code,
          quantity: ing.quantity,
          unit: ing.unit,
          is_optional: ing.is_optional ?? false,
        }))
      : [{ ...EMPTY_INGREDIENT }],
  );

  // Products for select
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Submit state
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load products on mount
  useEffect(() => {
    setLoadingProducts(true);
    fetch('/api/admin/products?pageSize=200&is_active=true')
      .then((res) => res.json())
      .then((data) => {
        // Support both array response and paginated {data:[...]} format
        const list: Product[] = Array.isArray(data) ? data : (data.data ?? []);
        setProducts(list);
      })
      .catch(() => {
        // Non-blocking — user can type product_id manually if needed
      })
      .finally(() => setLoadingProducts(false));
  }, []);

  // Ingredient helpers
  const addIngredient = () => {
    setIngredients((prev) => [...prev, { ...EMPTY_INGREDIENT }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: string | number | boolean) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)),
    );
  };

  // Validation
  const validate = (): string | null => {
    if (!isEditing && !productId) return 'Selecciona un producto';
    if (yieldQty <= 0) return 'Rendimiento debe ser mayor a 0';
    if (!yieldUnit.trim()) return 'Unidad de rendimiento es requerida';
    if (ingredients.length === 0) return 'Debe tener al menos 1 ingrediente';
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      if (!ing.inventory_code.trim()) return `Ingrediente ${i + 1}: código de inventario es requerido`;
      if (ing.quantity <= 0) return `Ingrediente ${i + 1}: cantidad debe ser mayor a 0`;
      if (!ing.unit.trim()) return `Ingrediente ${i + 1}: unidad es requerida`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim() || null,
        category: category || null,
        yield_qty: yieldQty,
        yield_unit: yieldUnit.trim(),
        conversion_factor: conversionFactor,
        preparation_time_minutes: prepTime === '' ? null : Number(prepTime),
        notes: notes.trim() || null,
        ingredients: ingredients.map((ing) => ({
          inventory_code: ing.inventory_code.trim(),
          quantity: ing.quantity,
          unit: ing.unit.trim(),
          is_optional: ing.is_optional,
        })),
      };

      if (!isEditing) {
        payload.product_id = productId;
      }

      const url = isEditing
        ? `/api/admin/recipes/${recipe!.id}`
        : '/api/admin/recipes';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      toast.success(isEditing ? 'Receta actualizada' : 'Receta creada');
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(message);
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-xl w-full max-w-2xl border border-zinc-800 my-8">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 rounded-t-xl z-10">
          <h2 className="text-lg font-bold text-zinc-100">
            {isEditing ? 'Editar Receta' : 'Nueva Receta'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {formError}
            </div>
          )}

          {/* Product select — only in create mode */}
          {!isEditing && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Producto <span className="text-red-400">*</span>
              </label>
              {loadingProducts ? (
                <div className="h-11 bg-zinc-800 rounded-lg animate-pulse" />
              ) : (
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500 min-h-[44px]"
                >
                  <option value="">Selecciona un producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Name (optional) */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">
              Nombre de la receta <span className="text-zinc-500">(opcional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="Ej: Pollo a la brasa 1/4"
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500 min-h-[44px]"
            >
              <option value="">Sin categoría</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Yield */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Rendimiento <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={yieldQty}
                onChange={(e) => setYieldQty(Number(e.target.value))}
                min={0.001}
                max={99999}
                step={0.001}
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Unidad <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={yieldUnit}
                onChange={(e) => setYieldUnit(e.target.value)}
                maxLength={30}
                placeholder="porciones, kg, litros..."
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Conversion factor + Prep time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Factor de conversión
              </label>
              <input
                type="number"
                value={conversionFactor}
                onChange={(e) => setConversionFactor(Number(e.target.value))}
                min={0.001}
                max={10}
                step={0.001}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-300">
                Tiempo de preparación (min)
              </label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value === '' ? '' : Number(e.target.value))}
                min={0}
                max={1440}
                step={1}
                placeholder="—"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">
              Notas <span className="text-zinc-500">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Instrucciones especiales, variantes, observaciones..."
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Ingredients */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-300">
                Ingredientes <span className="text-red-400">*</span>
                <span className="text-zinc-500 font-normal ml-1">({ingredients.length})</span>
              </label>
              <button
                type="button"
                onClick={addIngredient}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>

            {/* Header row */}
            <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 px-1">
              <span className="text-xs text-zinc-500">Código inventario</span>
              <span className="text-xs text-zinc-500 text-center">Cantidad</span>
              <span className="text-xs text-zinc-500 text-center">Unidad</span>
              <span />
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {ingredients.map((ing, index) => (
                <div
                  key={index}
                  className={cn(
                    'grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center',
                    ing.is_optional && 'opacity-70',
                  )}
                >
                  <input
                    type="text"
                    value={ing.inventory_code}
                    onChange={(e) => updateIngredient(index, 'inventory_code', e.target.value)}
                    placeholder="INV-001"
                    className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="number"
                    value={ing.quantity}
                    onChange={(e) => updateIngredient(index, 'quantity', Number(e.target.value))}
                    min={0.001}
                    max={99999}
                    step={0.001}
                    className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm text-center focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    value={ing.unit}
                    onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                    placeholder="kg"
                    className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    disabled={ingredients.length <= 1}
                    className="p-1.5 rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Eliminar ingrediente"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
            </div>

            {/* Optional toggle per ingredient — small detail row */}
            {ingredients.length > 0 && (
              <div className="space-y-1 mt-1">
                {ingredients.map((ing, index) => (
                  <label key={index} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ing.is_optional}
                      onChange={(e) => updateIngredient(index, 'is_optional', e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-amber-500"
                    />
                    <span className="text-xs text-zinc-500">
                      Ingrediente {index + 1} es opcional
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : isEditing ? 'Actualizar Receta' : 'Crear Receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
