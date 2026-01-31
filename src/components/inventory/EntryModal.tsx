'use client';

/**
 * EntryModal Component
 * Modal para registrar entrada de mercadería (Goods Receipt)
 * Task 3.3 - Inventory UI Spec
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Calendar, FileText, Hash, DollarSign, Truck, AlertCircle } from 'lucide-react';
import { InventoryItem } from '@/src/core/inventory/stock-types';

interface EntryModalProps {
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

interface FormData {
  quantity: string;
  unitCostCents: string;
  supplierId: string;
  invoiceNumber: string;
  lotNumber: string;
  expiryDate: string;
  notes: string;
}

interface FormErrors {
  quantity?: string;
  unitCostCents?: string;
  expiryDate?: string;
}

export default function EntryModal({
  isOpen,
  onClose,
  inventoryItem,
  tenantId,
  locationId,
  employeeId,
  terminalId,
  onSuccess,
  onError,
}: EntryModalProps) {
  const [formData, setFormData] = useState<FormData>({
    quantity: '',
    unitCostCents: '',
    supplierId: '',
    invoiceNumber: '',
    lotNumber: '',
    expiryDate: '',
    notes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        quantity: '',
        unitCostCents: inventoryItem?.costCents ? (inventoryItem.costCents / 100).toFixed(2) : '',
        supplierId: '',
        invoiceNumber: '',
        lotNumber: '',
        expiryDate: '',
        notes: '',
      });
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, inventoryItem]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    
    const qty = parseFloat(formData.quantity);
    if (!formData.quantity || isNaN(qty) || qty <= 0) {
      newErrors.quantity = 'La cantidad debe ser mayor a 0';
    }
    
    const cost = parseFloat(formData.unitCostCents);
    if (!formData.unitCostCents || isNaN(cost) || cost < 0) {
      newErrors.unitCostCents = 'El costo debe ser >= 0';
    }
    
    // Fecha de vencimiento obligatoria para perecederos (simplificado: siempre recomendado)
    // En producción, esto dependería de una propiedad del insumo
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Calculate total cost
  const totalCostCents = (() => {
    const qty = parseFloat(formData.quantity) || 0;
    const cost = parseFloat(formData.unitCostCents) || 0;
    return Math.round(qty * cost * 100);
  })();

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate() || !inventoryItem) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const response = await fetch('/api/inventory/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          location_id: locationId,
          inventory_code: inventoryItem.code,
          quantity: parseFloat(formData.quantity),
          unit_cost_cents: Math.round(parseFloat(formData.unitCostCents) * 100),
          supplier_id: formData.supplierId || undefined,
          invoice_number: formData.invoiceNumber || undefined,
          lot_number: formData.lotNumber || undefined,
          expiry_date: formData.expiryDate || undefined,
          notes: formData.notes || undefined,
          actor_id: employeeId,
          terminal_id: terminalId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar entrada');
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
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Registrar Entrada</h2>
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
            
            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Cantidad y Costo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Cantidad *
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
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Costo Unitario *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unitCostCents}
                      onChange={(e) => setFormData({ ...formData, unitCostCents: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2.5 bg-zinc-800 border rounded-lg text-sm focus:outline-none transition-colors ${
                        errors.unitCostCents ? 'border-red-500' : 'border-zinc-700 focus:border-amber-500'
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.unitCostCents && (
                    <p className="mt-1 text-xs text-red-400">{errors.unitCostCents}</p>
                  )}
                </div>
              </div>
              
              {/* Proveedor y Factura */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Proveedor
                  </label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
                      placeholder="ID proveedor"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Nº Factura
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
                      placeholder="F001-00001"
                    />
                  </div>
                </div>
              </div>
              
              {/* Lote y Vencimiento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Nº Lote
                  </label>
                  <input
                    type="text"
                    value={formData.lotNumber}
                    onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="LOT-2026-001"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Fecha Vencimiento
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
              
              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  placeholder="Observaciones adicionales..."
                />
              </div>
              
              {/* Total */}
              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Costo Total:</span>
                  <span className="text-xl font-bold text-green-400">
                    S/{(totalCostCents / 100).toFixed(2)}
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
                  className="flex-1 px-4 py-2.5 bg-green-600 rounded-lg text-sm font-medium hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Guardando...' : 'Confirmar Entrada'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
