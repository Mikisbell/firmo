'use client';

/**
 * Admin Invoice Detail Page
 *
 * Shows full invoice detail: header, items, totals, SUNAT status, CDR, credit notes.
 * Dark theme (zinc-900/800) consistent with admin UI.
 *
 * @module app/admin/facturacion/[invoiceId]/page
 */

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Download, XCircle, Loader2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoice } from '@/src/hooks/useFacturacion';

function centsToSoles(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

interface PageParams {
  invoiceId: string;
}

export default function InvoiceDetailPage({ params }: { params: Promise<PageParams> }) {
  const { invoiceId } = use(params);
  const { invoice, isLoading, mutate } = useInvoice(invoiceId);

  const handleVoid = async () => {
    const reason = prompt('Razón de anulación (mín. 5 caracteres):');
    if (!reason || reason.length < 5) {
      toast.error('La razón debe tener al menos 5 caracteres');
      return;
    }

    try {
      const res = await fetch(`/api/admin/facturacion/${invoiceId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Error al anular');
        return;
      }

      toast.success('Factura anulada exitosamente');
      mutate();
    } catch {
      toast.error('Error de conexión');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center text-zinc-500 py-16">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Factura no encontrada</p>
        <Link href="/admin/facturacion" className="text-amber-400 hover:underline text-sm mt-2 inline-block">
          Volver a facturación
        </Link>
      </div>
    );
  }

  const sunatStatusIcon = {
    ACCEPTED: <CheckCircle className="w-5 h-5 text-green-400" />,
    REJECTED: <AlertTriangle className="w-5 h-5 text-red-400" />,
    PENDING: <Clock className="w-5 h-5 text-yellow-400" />,
  }[invoice.sunat_status] ?? <Clock className="w-5 h-5 text-zinc-400" />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/admin/facturacion"
        className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a facturación
      </Link>

      {/* Header Card */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                invoice.invoice_type === 'FACTURA' ? 'text-blue-400 bg-blue-400/10' : 'text-amber-400 bg-amber-400/10'
              }`}>
                {invoice.invoice_type}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                invoice.status === 'ISSUED' ? 'text-green-400 bg-green-400/10'
                  : invoice.status === 'VOIDED' ? 'text-red-400 bg-red-400/10'
                  : 'text-yellow-400 bg-yellow-400/10'
              }`}>
                {invoice.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-zinc-100 font-mono">
              {invoice.series}-{invoice.invoice_number}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              {new Date(invoice.created_at).toLocaleString('es-PE')}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-500 uppercase">Total</span>
            <p className="text-2xl font-black text-zinc-100">{centsToSoles(invoice.total_cents)}</p>
          </div>
        </div>

        {/* Customer */}
        {invoice.customer_doc && (
          <div className="mt-4 pt-4 border-t border-zinc-700">
            <span className="text-xs font-bold text-zinc-400 uppercase">Cliente</span>
            <p className="text-sm text-zinc-200">
              {invoice.customer_doc_type}: {invoice.customer_doc}
            </p>
          </div>
        )}

        {/* Void reason */}
        {invoice.void_reason && (
          <div className="mt-4 pt-4 border-t border-zinc-700 bg-red-400/5 -mx-5 -mb-5 p-5 rounded-b-xl">
            <span className="text-xs font-bold text-red-400 uppercase">Motivo de Anulación</span>
            <p className="text-sm text-zinc-300 mt-1">{invoice.void_reason}</p>
            {invoice.voided_at && (
              <p className="text-xs text-zinc-500 mt-1">
                Anulada: {new Date(invoice.voided_at).toLocaleString('es-PE')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* SUNAT Status */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-5">
        <div className="flex items-center gap-2 mb-3">
          {sunatStatusIcon}
          <h2 className="text-sm font-bold text-zinc-100">Estado SUNAT: {invoice.sunat_status}</h2>
        </div>

        {invoice.cdr && (
          <div className="space-y-2 text-sm">
            <p className="text-zinc-300">
              <span className="text-zinc-500">Código:</span> {invoice.cdr.response_code}
            </p>
            <p className="text-zinc-300">
              <span className="text-zinc-500">Mensaje:</span> {invoice.cdr.response_message}
            </p>
            {invoice.cdr.hash && (
              <p className="text-zinc-300 font-mono text-xs">
                <span className="text-zinc-500">Hash:</span> {invoice.cdr.hash}
              </p>
            )}
            <p className="text-zinc-400 text-xs">
              Recibido: {new Date(invoice.cdr.received_at).toLocaleString('es-PE')}
            </p>
          </div>
        )}
      </div>

      {/* Credit Notes */}
      {invoice.credit_notes?.length > 0 && (
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-5">
          <h2 className="text-sm font-bold text-zinc-100 mb-3">Notas de Crédito</h2>
          <div className="space-y-2">
            {invoice.credit_notes.map((cn: any) => (
              <div key={cn.id} className="flex items-center justify-between text-sm bg-zinc-900 rounded-lg p-3">
                <div>
                  <span className="font-mono text-zinc-200">{cn.series}-{cn.number}</span>
                  <span className="text-zinc-500 ml-2">{cn.reason}</span>
                </div>
                <span className="font-bold text-zinc-100">{centsToSoles(cn.total_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={`/api/admin/facturacion/${invoiceId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-200 font-bold py-3 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          Ver / Imprimir
        </a>

        {invoice.status === 'ISSUED' && (
          <button
            onClick={handleVoid}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600/10 border border-red-600/30 hover:bg-red-600/20 text-red-400 font-bold py-3 rounded-xl transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Anular
          </button>
        )}
      </div>
    </div>
  );
}
