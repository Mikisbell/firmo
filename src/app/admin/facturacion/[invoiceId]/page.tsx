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
import { FileText, Download, XCircle, Loader2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoice } from '@/src/hooks/useFacturacion';
import { Button, Badge, Card, PageHeader, Breadcrumbs } from '@/src/components/ui';

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
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <Card padding="none">
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-4 text-center text-park-gray-500 py-16">
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
  }[invoice.sunat_status] ?? <Clock className="w-5 h-5 text-park-gray-400" />;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: 'Facturación', href: '/admin/facturacion' },
            { label: `${invoice.series}-${invoice.invoice_number}` },
          ]}
        />
      </div>
      <PageHeader
        title={`${invoice.series}-${invoice.invoice_number}`}
      />

      {/* Header Card */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={invoice.invoice_type === 'FACTURA' ? 'info' : 'warning'}>
                {invoice.invoice_type}
              </Badge>
              <Badge variant={
                invoice.status === 'ISSUED' ? 'success'
                  : invoice.status === 'VOIDED' ? 'critical'
                  : 'warning'
              }>
                {invoice.status}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-white font-mono">
              {invoice.series}-{invoice.invoice_number}
            </h1>
            <p className="text-sm text-park-gray-400 mt-1">
              {new Date(invoice.created_at).toLocaleString('es-PE')}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-park-gray-500 uppercase">Total</span>
            <p className="text-2xl font-black text-white">{centsToSoles(invoice.total_cents)}</p>
          </div>
        </div>

        {/* Customer */}
        {invoice.customer_doc && (
          <div className="mt-4 pt-4 border-t border-park-gray-700">
            <span className="text-xs font-bold text-park-gray-400 uppercase">Cliente</span>
            <p className="text-sm text-park-gray-200">
              {invoice.customer_doc_type}: {invoice.customer_doc}
            </p>
          </div>
        )}

        {/* Void reason */}
        {invoice.void_reason && (
          <div className="mt-4 pt-4 border-t border-park-gray-700 bg-red-400/5 -mx-5 -mb-5 p-5 rounded-b-xl">
            <span className="text-xs font-bold text-red-400 uppercase">Motivo de Anulación</span>
            <p className="text-sm text-park-gray-300 mt-1">{invoice.void_reason}</p>
            {invoice.voided_at && (
              <p className="text-xs text-park-gray-500 mt-1">
                Anulada: {new Date(invoice.voided_at).toLocaleString('es-PE')}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* SUNAT Status */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          {sunatStatusIcon}
          <h2 className="text-sm font-bold text-white">Estado SUNAT: {invoice.sunat_status}</h2>
        </div>

        {invoice.cdr && (
          <div className="space-y-2 text-sm">
            <p className="text-park-gray-300">
              <span className="text-park-gray-500">Código:</span> {invoice.cdr.response_code}
            </p>
            <p className="text-park-gray-300">
              <span className="text-park-gray-500">Mensaje:</span> {invoice.cdr.response_message}
            </p>
            {invoice.cdr.hash && (
              <p className="text-park-gray-300 font-mono text-xs">
                <span className="text-park-gray-500">Hash:</span> {invoice.cdr.hash}
              </p>
            )}
            <p className="text-park-gray-400 text-xs">
              Recibido: {new Date(invoice.cdr.received_at).toLocaleString('es-PE')}
            </p>
          </div>
        )}
      </Card>

      {/* Credit Notes */}
      {invoice.credit_notes?.length > 0 && (
        <Card>
          <h2 className="text-sm font-bold text-white mb-3">Notas de Crédito</h2>
          <div className="space-y-2">
            {invoice.credit_notes.map((cn: any) => (
              <div key={cn.id} className="flex items-center justify-between text-sm bg-park-gray-900 rounded-lg p-3">
                <div>
                  <span className="font-mono text-park-gray-200">{cn.series}-{cn.number}</span>
                  <span className="text-park-gray-500 ml-2">{cn.reason}</span>
                </div>
                <span className="font-bold text-white">{centsToSoles(cn.total_cents)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          icon={<Download className="w-4 h-4" />}
          onClick={() => window.open(`/api/admin/facturacion/${invoiceId}/pdf`, '_blank')}
        >
          Ver / Imprimir
        </Button>

        {invoice.status === 'ISSUED' && (
          <Button
            variant="destructive"
            size="lg"
            className="flex-1"
            icon={<XCircle className="w-4 h-4" />}
            onClick={handleVoid}
          >
            Anular
          </Button>
        )}
      </div>
    </div>
  );
}
