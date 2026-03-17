'use client';

/**
 * InvoiceModal - Appears after payment confirmation
 *
 * Allows cashier to emit BOLETA or FACTURA electronically.
 * FACTURA requires RUC (11 digits) + Razón Social.
 * BOLETA has optional DNI (8 digits).
 *
 * Features:
 * - Auto-lookup: searches local DB → RENIEC/SUNAT when doc is complete
 * - Auto-fills Razón Social from lookup result
 * - Shows source badge (local customer / RENIEC / SUNAT)
 *
 * @module app/pos/components/InvoiceModal
 */

import { useState, useEffect, useRef } from 'react';
import { X, FileText, Check, Loader2, ReceiptText, UserCheck, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface InvoiceModalProps {
  orderId: string;
  checkId: string;
  totalCents: number;
  onClose: () => void;
  onEmit: (data: {
    invoiceType: 'BOLETA' | 'FACTURA';
    customerDocType?: string;
    customerDoc?: string;
    customerName?: string;
  }) => void;
  onSkip: () => void;
}

interface LookupResult {
  found: boolean;
  source?: 'local' | 'cache' | 'external';
  customer?: {
    name: string;
    doc_type: string;
    doc_number: string;
    address?: string;
    estado?: string;
    condicion?: string;
  };
  localCustomerId?: string;
}

export function InvoiceModal({ orderId, checkId, totalCents, onClose, onEmit, onSkip }: InvoiceModalProps) {
  const [invoiceType, setInvoiceType] = useState<'BOLETA' | 'FACTURA'>('BOLETA');
  const [ruc, setRuc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lookup state
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [customerHint, setCustomerHint] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-lookup when document number is complete
  useEffect(() => {
    const docNumber = invoiceType === 'FACTURA' ? ruc : dni;
    const docType = invoiceType === 'FACTURA' ? 'RUC' : 'DNI';
    const expectedLen = invoiceType === 'FACTURA' ? 11 : 8;

    // Reset if incomplete
    if (docNumber.length !== expectedLen) {
      setLookupResult(null);
      setCustomerHint('');
      return;
    }

    // Debounce the lookup
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await fetch(
          `/api/pos/customers/lookup?doc_number=${docNumber}&doc_type=${docType}`,
          { credentials: 'include' },
        );
        if (res.ok) {
          const data: LookupResult = await res.json();
          setLookupResult(data);

          if (data.found && data.customer) {
            if (invoiceType === 'FACTURA') {
              // Auto-fill razón social
              setRazonSocial(data.customer.name);
            } else {
              // Show name as hint for BOLETA
              setCustomerHint(data.customer.name);
            }
          }
        }
      } catch {
        // Silently fail — don't block the cashier
      } finally {
        setLookupLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ruc, dni, invoiceType]);

  // Reset lookup when switching type
  useEffect(() => {
    setLookupResult(null);
    setCustomerHint('');
  }, [invoiceType]);

  const isFacturaValid = invoiceType === 'FACTURA'
    ? ruc.length === 11 && razonSocial.trim().length > 0
    : true;

  const isBoletaDniValid = invoiceType === 'BOLETA' && dni.length > 0
    ? dni.length === 8
    : true;

  const canSubmit = isFacturaValid && isBoletaDniValid && !submitting;

  const handleEmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const emitData = invoiceType === 'FACTURA'
        ? { invoiceType: 'FACTURA' as const, customerDocType: 'RUC', customerDoc: ruc, customerName: razonSocial }
        : {
            invoiceType: 'BOLETA' as const,
            customerDocType: dni ? 'DNI' : undefined,
            customerDoc: dni || undefined,
            customerName: customerHint || undefined,
          };

      // Call POS API for SUNAT emission
      const res = await fetch('/api/pos/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId,
          checkId,
          ...emitData,
          paymentSummary: {
            subtotalCents: totalCents,
            discountCents: 0,
            taxCents: Math.round(totalCents * 18 / 118),
            totalCents,
            payments: [],
          },
        }),
      });

      if (res.ok) {
        const invoiceResult = await res.json().catch(() => ({}));
        const loyaltyMsg = invoiceResult.loyaltyPointsEarned
          ? ` — +${invoiceResult.loyaltyPointsEarned} pts (${invoiceResult.loyaltyTier})`
          : '';
        toast.success(`${invoiceType === 'FACTURA' ? 'Factura' : 'Boleta'} emitida${loyaltyMsg}`);
      } else {
        const errData = await res.json().catch(() => ({ error: 'Error al emitir' }));
        // Don't block on emission errors — still call onEmit
        if (res.status !== 409) {
          toast.error(errData.error || 'Error al emitir comprobante');
        }
      }

      onEmit(emitData);
    } catch {
      toast.error('Error de conexión al emitir');
      // Still call onEmit to not block the flow
      onEmit({ invoiceType, customerDocType: invoiceType === 'FACTURA' ? 'RUC' : undefined, customerDoc: invoiceType === 'FACTURA' ? ruc : dni || undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const sourceLabel = lookupResult?.found
    ? lookupResult.source === 'local'
      ? 'Cliente registrado'
      : lookupResult.source === 'external'
        ? (invoiceType === 'FACTURA' ? 'SUNAT' : 'RENIEC')
        : (invoiceType === 'FACTURA' ? 'SUNAT' : 'RENIEC')
    : null;

  const SourceBadge = () => {
    if (lookupLoading) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Consultando...
        </span>
      );
    }
    if (!lookupResult?.found || !sourceLabel) return null;

    const isLocal = lookupResult.source === 'local';
    return (
      <span className={`inline-flex items-center gap-1 text-xs mt-1 ${
        isLocal ? 'text-emerald-600' : 'text-blue-600'
      }`}>
        {isLocal ? <UserCheck className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
        {sourceLabel}
        {lookupResult.customer?.estado && lookupResult.customer.estado !== 'ACTIVO' && (
          <span className="text-red-500 ml-1">({lookupResult.customer.estado})</span>
        )}
      </span>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative bg-white shadow-2xl overflow-hidden border border-gray-100 w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-md md:rounded-2xl flex flex-col"
        >
          {/* Header */}
          <div className="bg-gray-900 px-4 md:px-6 py-4 md:py-5 flex justify-between items-center flex-shrink-0">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-amber-400" />
              Comprobante de Pago
            </h2>
            <button
              onClick={onClose}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-5">
            {/* Total */}
            <div className="text-center">
              <span className="text-xs font-bold text-gray-500 uppercase">Total de la Orden</span>
              <div className="text-3xl font-black text-gray-900">
                <span className="text-lg text-gray-400 mr-1">S/</span>
                {(totalCents / 100).toFixed(2)}
              </div>
            </div>

            {/* Invoice Type Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setInvoiceType('BOLETA')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${
                  invoiceType === 'BOLETA'
                    ? 'border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Boleta
              </button>
              <button
                onClick={() => setInvoiceType('FACTURA')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${
                  invoiceType === 'FACTURA'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Factura
              </button>
            </div>

            {/* FACTURA Fields */}
            {invoiceType === 'FACTURA' && (
              <div className="space-y-3 bg-blue-50 p-4 rounded-xl border border-blue-200">
                <div>
                  <label className="block text-xs font-bold text-blue-700 uppercase mb-1">
                    RUC *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ruc}
                      onChange={(e) => setRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="20123456789"
                      className={`w-full px-3 py-2.5 bg-white border rounded-lg text-sm font-medium outline-none transition-shadow ${
                        ruc.length > 0 && ruc.length !== 11
                          ? 'border-red-400 focus:ring-2 focus:ring-red-500'
                          : 'border-blue-300 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                    {lookupLoading && ruc.length === 11 && (
                      <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-blue-400" />
                    )}
                  </div>
                  {ruc.length > 0 && ruc.length !== 11 && (
                    <p className="text-xs text-red-600 mt-1">RUC debe tener 11 dígitos</p>
                  )}
                  <SourceBadge />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-700 uppercase mb-1">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                    placeholder="Empresa SAC"
                    className="w-full px-3 py-2.5 bg-white border border-blue-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                  />
                  {lookupResult?.found && lookupResult.customer?.address && (
                    <p className="text-xs text-gray-500 mt-1">{lookupResult.customer.address}</p>
                  )}
                </div>
              </div>
            )}

            {/* BOLETA Fields */}
            {invoiceType === 'BOLETA' && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    DNI (opcional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={dni}
                      onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="12345678"
                      className={`w-full px-3 py-2.5 bg-white border rounded-lg text-sm font-medium outline-none transition-shadow ${
                        dni.length > 0 && dni.length !== 8
                          ? 'border-red-400 focus:ring-2 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-amber-500'
                      }`}
                    />
                    {lookupLoading && dni.length === 8 && (
                      <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-amber-400" />
                    )}
                  </div>
                  {dni.length > 0 && dni.length !== 8 && (
                    <p className="text-xs text-red-600 mt-1">DNI debe tener 8 dígitos</p>
                  )}
                  {customerHint && (
                    <p className="text-xs text-emerald-600 mt-1 font-medium">{customerHint}</p>
                  )}
                  <SourceBadge />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Email (opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-gray-500 transition-shadow"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 md:p-6 pt-0 flex-shrink-0 bg-white border-t border-gray-100 space-y-2">
            <button
              onClick={handleEmit}
              disabled={!canSubmit}
              className={`w-full py-3.5 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all touch-manipulation ${
                canSubmit
                  ? 'bg-gray-900 hover:bg-black text-white shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5" />
              )}
              Emitir {invoiceType === 'FACTURA' ? 'Factura' : 'Boleta'}
            </button>
            <button
              onClick={onSkip}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sin Comprobante
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
