'use client';

/**
 * WasteModal Component
 * Modal para registrar merma/pérdida de inventario
 * Task 3.4 + Task 11.2 (FEFO Lot Selector) - Inventory UI Spec
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Hash, AlertCircle, Camera, AlertTriangle, FileText, Package } from 'lucide-react';
import { InventoryItem } from '@/src/core/inventory/stock-types';
import { InventoryLot } from '@/src/app/api/inventory/lots/[code]/route';

// Función para calcular costo de merma (exportada para tests)
export function calculateWasteCost(quantity: number, unitCostCents: number): number {
  return Math.round(quantity * unitCostCents);
}

interface WasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItem: InventoryItem | null;
  tenantId: string;
  locationId: string;
  employeeId: string;
  terminalId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

type WasteReasonCode = 
  | 'EXPIRED' 
  | 'DAMAGED' 
  | 'THEFT' 
  | 'PRODUCTION_LOSS' 
  | 'COUNT_ADJUSTMENT' 
  | 'OTHER';

const WASTE_REASONS: { code: WasteReasonCode; label: string; icon: string }[] = [
  { code: 'EXPIRED', label: 'Vencido', icon: '📅' },
  { code: 'DAMAGED', label: 'Dañado', icon: '💔' },
  { code: 'THEFT', label: 'Robo/Pérdida', icon: '🚨' },
  { code: 'PRODUCTION_LOSS', label: 'Pérdida en producción', icon: '🍳' },
  { code: 'COUNT_ADJUSTMENT', label: 'Ajuste de conteo', icon: '📊' },
  { code: 'OTHER', label: 'Otro', icon: '❓' },
];

interface FormData {
  quantity: string;
  lotNumber: string;
  reasonCode: WasteReasonCode | '';
  reasonDetail: string;
  photoUrl: string;
}

interface FormErrors {
  quantity?: string;
  reasonCode?: string;
  reasonDetail?: string;
  photoUrl?: string;
}

export default function WasteModal({
  isOpen,
  onClose,
  inventoryItem,
  tenantId,
  locationId,
  employeeId,
  terminalId,
  onSuccess,
  onError,
}: WasteModalProps) {
  const [formData, setFormData] = useState<FormData>({
    quantity: '',
    lotNumber: '',
    reasonCode: '',
    reasonDetail: '',
    photoUrl: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // FEFO Lot Selector (Task 11.2)
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [selectedLot, setSelectedLot] = useState<InventoryLot | null>(null);

  // Fetch lots when modal opens (Task 11.2)
  useEffect(() => {
    if (isOpen && inventoryItem) {
      setIsLoadingLots(true);
      fetch(`/api/inventory/lots/${inventoryItem.code}?tenant_id=${tenantId}&location_id=${locationId}`)
        .then(res => res.json())
        .then(data => {
          setLots(data.lots || []);
          // Auto-select first lot (FEFO - earliest expiry)
          if (data.lots?.length > 0) {
            setSelectedLot(data.lots[0]);
            setFormData(prev => ({ ...prev, lotNumber: data.lots[0].lotNumber }));
          }
        })
        .catch(() => setLots([]))
        .finally(() => setIsLoadingLots(false));
    }
  }, [isOpen, inventoryItem, tenantId, locationId]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        quantity: '',
        lotNumber: inventoryItem?.lotNumber || '',
        reasonCode: '',
        reasonDetail: '',
        photoUrl: '',
      });
      setErrors({});
      setSubmitError(null);
      setSelectedLot(null);
    }
  }, [isOpen, inventoryItem]);

  // Calculate cost (use selected lot cost if available)
  const costCents = (() => {
    const qty = parseFloat(formData.quantity) || 0;
    const unitCost = selectedLot?.costCents || inventoryItem?.costCents || 0;
    return calculateWasteCost(qty, unitCost);
  })();

  // Check if quantity exceeds stock (or lot stock if selected)
  const exceedsStock = (() => {
    const qty = parseFloat(formData.quantity) || 0;
    const availableStock = selectedLot?.quantity || inventoryItem?.stock || 0;
    return qty > availableStock;
  })();

  // Check if photo is required (cost > S/50 = 5000 centavos)
  const photoRequired = costCents > 5000;

  // Check if detail is required (THEFT or OTHER)
  const detailRequired = formData.reasonCode === 'THEFT' || formData.reasonCode === 'OTHER';

  // Validate form
  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    
    const qty = parseFloat(formData.quantity);
    if (!formData.quantity || isNaN(qty) || qty <= 0) {
      newErrors.quantity = 'La cantidad debe ser mayor a 0';
    }
    
    if (!formData.reasonCode) {
      newErrors.reasonCode = 'Seleccione un motivo';
    }
    
    if (detailRequired && !formData.reasonDetail.trim()) {
      newErrors.reasonDetail = 'El detalle es obligatorio para este motivo';
    }
    
    if (photoRequired && !formData.photoUrl.trim()) {
      newErrors.photoUrl = 'La foto es obligatoria para mermas > S/50';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate() || !inventoryItem) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const response = await fetch('/api/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          location_id: locationId,
          inventory_code: inventoryItem.code,
          quantity: parseFloat(formData.quantity),
          lot_number: formData.lotNumber || undefined,
          reason_code: formData.reasonCode,
          reason_detail: formData.reasonDetail || undefined,
          photo_url: formData.photoUrl || undefined,
          actor_id: employeeId,
          terminal_id: terminalId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar merma');
      }
      
      onSuccess?.();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setSubmitError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!inventoryItem) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Registrar Merma</h2>
                  <p className="text-sm text-zinc-400">
                    {inventoryItem.code} - {inventoryItem.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Current stock info */}
            <div className="px-6 py-3 bg-zinc-800/30 border-b border-zinc-800">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Stock actual:</span>
                <span className="font-medium">
                  {inventoryItem.stock.toFixed(2)} {inventoryItem.unit}
                </span>
              </div>
            </div>
            
            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Cantidad */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Cantidad a dar de baja *
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className={`w-full pl-10 pr-12 py-2.5 bg-zinc-800 border rounded-lg text-sm focus:outline-none transition-colors ${
                      errors.quantity ? 'border-red-500' : 'border-zinc-700 focus:border-amber-500'
                    }`}
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                    {inventoryItem.unit}
                  </span>
                </div>
                {errors.quantity && (
                  <p className="mt-1 text-xs text-red-400">{errors.quantity}</p>
                )}
                {exceedsStock && !errors.quantity && (
                  <p className="mt-1 text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    La cantidad excede el stock disponible
                  </p>
                )}
              </div>
              
              {/* Selector de Lote FEFO (Task 11.2) */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  <Package className="inline w-4 h-4 mr-1" />
                  Seleccionar Lote (FEFO)
                </label>
                {isLoadingLots ? (
                  <div className="h-20 bg-zinc-800 rounded-lg animate-pulse" />
                ) : lots.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {lots.map((lot) => (
                      <button
                        key={lot.id}
                        type="button"
                        onClick={() => {
                          setSelectedLot(lot);
                          setFormData({ ...formData, lotNumber: lot.lotNumber });
                        }}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          selectedLot?.id === lot.id
                            ? 'bg-amber-500/20 border-amber-500/50'
                            : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-sm">{lot.lotNumber}</span>
                            {lot.expiryDate && (
                              <span className={`ml-2 text-xs ${
                                lot.isExpired ? 'text-red-400' :
                                lot.daysUntilExpiry !== null && lot.daysUntilExpiry <= 3 ? 'text-orange-400' :
                                lot.daysUntilExpiry !== null && lot.daysUntilExpiry <= 7 ? 'text-amber-400' :
                                'text-zinc-400'
                              }`}>
                                {lot.isExpired ? '💀 Vencido' :
                                 lot.daysUntilExpiry === 0 ? '🔴 Vence hoy' :
                                 lot.daysUntilExpiry === 1 ? '🔴 Vence mañana' :
                                 lot.daysUntilExpiry !== null && lot.daysUntilExpiry <= 3 ? `🟠 ${lot.daysUntilExpiry}d` :
                                 lot.daysUntilExpiry !== null && lot.daysUntilExpiry <= 7 ? `🟡 ${lot.daysUntilExpiry}d` :
                                 `Vence: ${lot.expiryDate}`}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-400">
                            {lot.quantity.toFixed(2)} {inventoryItem.unit}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          Costo: S/{(lot.costCents / 100).toFixed(2)}/{inventoryItem.unit}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                    <input
                      type="text"
                      value={formData.lotNumber}
                      onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                      className="w-full bg-transparent text-sm focus:outline-none"
                      placeholder="LOT-2026-001 (opcional)"
                    />
                  </div>
                )}
              </div>
              
              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Motivo *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {WASTE_REASONS.map((reason) => (
                    <button
                      key={reason.code}
                      type="button"
                      onClick={() => setFormData({ ...formData, reasonCode: reason.code })}
                      className={`p-3 rounded-lg border text-sm transition-colors ${
                        formData.reasonCode === reason.code
                          ? 'bg-red-500/20 border-red-500/50 text-red-400'
                          : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <span className="text-lg">{reason.icon}</span>
                      <p className="mt-1 text-xs">{reason.label}</p>
                    </button>
                  ))}
                </div>
                {errors.reasonCode && (
                  <p className="mt-1 text-xs text-red-400">{errors.reasonCode}</p>
                )}
              </div>
              
              {/* Detalle */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Detalle {detailRequired && '*'}
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <textarea
                    value={formData.reasonDetail}
                    onChange={(e) => setFormData({ ...formData, reasonDetail: e.target.value })}
                    rows={2}
                    className={`w-full pl-10 pr-4 py-2.5 bg-zinc-800 border rounded-lg text-sm focus:outline-none transition-colors resize-none ${
                      errors.reasonDetail ? 'border-red-500' : 'border-zinc-700 focus:border-amber-500'
                    }`}
                    placeholder={detailRequired ? 'Describa el incidente...' : 'Observaciones adicionales...'}
                  />
                </div>
                {errors.reasonDetail && (
                  <p className="mt-1 text-xs text-red-400">{errors.reasonDetail}</p>
                )}
              </div>
              
              {/* Foto */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  URL de Foto {photoRequired && '*'}
                </label>
                <div className="relative">
                  <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="url"
                    value={formData.photoUrl}
                    onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                    className={`w-full pl-10 pr-4 py-2.5 bg-zinc-800 border rounded-lg text-sm focus:outline-none transition-colors ${
                      errors.photoUrl ? 'border-red-500' : 'border-zinc-700 focus:border-amber-500'
                    }`}
                    placeholder="https://..."
                  />
                </div>
                {errors.photoUrl && (
                  <p className="mt-1 text-xs text-red-400">{errors.photoUrl}</p>
                )}
                {photoRequired && !errors.photoUrl && (
                  <p className="mt-1 text-xs text-amber-400">
                    Foto obligatoria para mermas mayores a S/50
                  </p>
                )}
              </div>
              
              {/* Costo calculado */}
              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Costo de la merma:</span>
                  <span className="text-xl font-bold text-red-400">
                    S/{(costCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
              
              {/* Error */}
              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {submitError}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-red-600 rounded-lg text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Guardando...' : 'Confirmar Merma'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
