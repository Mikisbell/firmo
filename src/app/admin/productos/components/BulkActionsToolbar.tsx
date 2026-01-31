'use client';

/**
 * Bulk Actions Toolbar
 * Toolbar para operaciones masivas en productos
 * 
 * Features:
 * - Responsive design (mobile & desktop)
 * - Bulk activate/deactivate
 * - Bulk category change
 * - Bulk station change
 * - Bulk delete
 * - Progress indicators
 * - Toast notifications
 * 
 * Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.11, 2.12
 * Properties: 11, 12, 13, 14, 15, 16, 17
 */

import { useState } from 'react';
import {
  Check,
  X,
  Tag,
  MapPin,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface BulkActionsToolbarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

type BulkAction = 'activate' | 'deactivate' | 'change_category' | 'change_station' | 'delete';

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

export function BulkActionsToolbar({
  selectedIds,
  onClearSelection,
  onActionComplete,
}: BulkActionsToolbarProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const executeBulkAction = async (action: BulkAction, updates?: any) => {
    setIsProcessing(true);
    try {
      const body: any = { product_ids: selectedIds };

      if (action === 'delete') {
        body.operation = 'delete';
      } else {
        body.updates = updates;
      }

      const response = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Error en operación masiva');
      }

      // Success
      const actionLabels: Record<BulkAction, string> = {
        activate: 'activados',
        deactivate: 'desactivados',
        change_category: 'actualizados',
        change_station: 'actualizados',
        delete: 'eliminados',
      };

      if (result.failure_count > 0) {
        showToast(
          'error',
          `${result.success_count} productos ${actionLabels[action]}, ${result.failure_count} fallaron`
        );
      } else {
        showToast('success', `${result.success_count} productos ${actionLabels[action]} exitosamente`);
      }

      onClearSelection();
      onActionComplete();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsProcessing(false);
      setShowCategoryModal(false);
      setShowStationModal(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleActivate = () => executeBulkAction('activate', { is_active: true });
  const handleDeactivate = () => executeBulkAction('deactivate', { is_active: false });
  const handleCategoryChange = () => {
    if (selectedCategory) {
      executeBulkAction('change_category', { category: selectedCategory });
    }
  };
  const handleStationChange = () => {
    if (selectedStation) {
      executeBulkAction('change_station', { station: selectedStation });
    }
  };
  const handleDelete = () => executeBulkAction('delete');

  if (selectedIds.length === 0) return null;

  return (
    <>
      {/* Fixed toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 shadow-2xl md:left-64">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Selection info */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={onClearSelection}
                disabled={isProcessing}
                className="text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Limpiar
              </button>
            </div>

            {/* Actions - Responsive */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Mobile: Dropdown menu */}
              <div className="md:hidden">
                <select
                  onChange={(e) => {
                    const action = e.target.value;
                    if (action === 'activate') handleActivate();
                    else if (action === 'deactivate') handleDeactivate();
                    else if (action === 'category') setShowCategoryModal(true);
                    else if (action === 'station') setShowStationModal(true);
                    else if (action === 'delete') setShowDeleteConfirm(true);
                    e.target.value = '';
                  }}
                  disabled={isProcessing}
                  className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm disabled:opacity-50"
                >
                  <option value="">Acciones...</option>
                  <option value="activate">Activar</option>
                  <option value="deactivate">Desactivar</option>
                  <option value="category">Cambiar categoría</option>
                  <option value="station">Cambiar estación</option>
                  <option value="delete">Eliminar</option>
                </select>
              </div>

              {/* Desktop: Button group */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={handleActivate}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  <Check className="w-4 h-4" />
                  Activar
                </button>
                <button
                  onClick={handleDeactivate}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  <X className="w-4 h-4" />
                  Desactivar
                </button>
                <button
                  onClick={() => setShowCategoryModal(true)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  <Tag className="w-4 h-4" />
                  Categoría
                </button>
                <button
                  onClick={() => setShowStationModal(true)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  <MapPin className="w-4 h-4" />
                  Estación
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>

              {isProcessing && (
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-md">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-lg font-semibold">Cambiar Categoría</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Selecciona la nueva categoría para {selectedIds.length} producto{selectedIds.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                {CATEGORY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="category"
                      value={option.value}
                      checked={selectedCategory === option.value}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-zinc-800 flex gap-2">
              <button
                onClick={() => setShowCategoryModal(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCategoryChange}
                disabled={isProcessing || !selectedCategory}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Station Modal */}
      {showStationModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-md">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-lg font-semibold">Cambiar Estación</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Selecciona la nueva estación para {selectedIds.length} producto{selectedIds.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                {STATION_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="station"
                      value={option.value}
                      checked={selectedStation === option.value}
                      onChange={(e) => setSelectedStation(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-zinc-800 flex gap-2">
              <button
                onClick={() => setShowStationModal(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleStationChange}
                disabled={isProcessing || !selectedStation}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-md">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold">Confirmar Eliminación</h3>
              </div>
            </div>
            <div className="p-4">
              <p className="text-zinc-300">
                ¿Estás seguro de que deseas eliminar {selectedIds.length} producto{selectedIds.length !== 1 ? 's' : ''}?
              </p>
              <p className="text-sm text-zinc-400 mt-2">
                Los productos serán desactivados (soft delete). Esta acción se puede revertir.
              </p>
            </div>
            <div className="p-4 border-t border-zinc-800 flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[70] animate-in slide-in-from-top-2">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg border ${
              toast.type === 'success'
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'bg-red-500/20 border-red-500/30 text-red-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <Check className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
