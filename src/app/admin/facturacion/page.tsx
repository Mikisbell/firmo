'use client';

/**
 * Admin Facturación Page - Invoice Management Dashboard
 *
 * Stats cards, filters, and invoice table.
 * Dark theme (zinc-900/800) consistent with admin UI.
 *
 * @module app/admin/facturacion/page
 */

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Search, Download, Eye, XCircle, Loader2, ReceiptText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoices, useInvoiceStats } from '@/src/hooks/useFacturacion';

function centsToSoles(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

export default function FacturacionPage() {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const { stats, isLoading: statsLoading } = useInvoiceStats();
  const { invoices, pagination, isLoading, mutate } = useInvoices({
    page,
    limit: 20,
    type: filterType || undefined,
    status: filterStatus || undefined,
    search: search || undefined,
  });

  const handleVoid = async (invoiceId: string) => {
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

      toast.success('Factura anulada');
      mutate();
    } catch {
      toast.error('Error de conexión');
    }
  };

  const statusColor: Record<string, string> = {
    ISSUED: 'text-green-400 bg-green-400/10',
    VOIDED: 'text-red-400 bg-red-400/10',
    PENDING: 'text-yellow-400 bg-yellow-400/10',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <ReceiptText className="w-6 h-6 text-amber-400" />
          Facturación Electrónica
        </h1>
        <p className="text-sm text-zinc-400 mt-1">Gestión de boletas, facturas y comprobantes SUNAT</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Boletas', value: stats?.boletaCount ?? 0, icon: FileText, color: 'text-amber-400' },
          { label: 'Facturas', value: stats?.facturaCount ?? 0, icon: FileText, color: 'text-blue-400' },
          { label: 'Anuladas', value: stats?.voidedCount ?? 0, icon: XCircle, color: 'text-red-400' },
          { label: 'Pendientes SUNAT', value: stats?.pendingSunatCount ?? 0, icon: AlertTriangle, color: 'text-yellow-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs font-bold text-zinc-400 uppercase">{stat.label}</span>
            </div>
            <p className="text-2xl font-black text-zinc-100">
              {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none"
        >
          <option value="">Todos los tipos</option>
          <option value="BOLETA">Boleta</option>
          <option value="FACTURA">Factura</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="ISSUED">Emitida</option>
          <option value="VOIDED">Anulada</option>
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por documento, serie..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">No hay comprobantes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-900/50">
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Serie - Nro</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Doc. Cliente</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-zinc-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-zinc-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-zinc-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/30">
                    <td className="px-4 py-3 font-mono text-zinc-100">
                      {inv.series}-{inv.invoice_number}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        inv.invoice_type === 'FACTURA' ? 'text-blue-400 bg-blue-400/10' : 'text-amber-400 bg-amber-400/10'
                      }`}>
                        {inv.invoice_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {inv.customer_doc_type ? `${inv.customer_doc_type}: ${inv.customer_doc}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-100">
                      {centsToSoles(inv.total_cents)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColor[inv.status] ?? 'text-zinc-400'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {new Date(inv.created_at).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/admin/facturacion/${inv.id}`}
                          className="p-1.5 hover:bg-zinc-600 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <a
                          href={`/api/admin/facturacion/${inv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-zinc-600 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
                          title="Descargar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {inv.status === 'ISSUED' && (
                          <button
                            onClick={() => handleVoid(inv.id)}
                            className="p-1.5 hover:bg-red-600/20 rounded text-zinc-400 hover:text-red-400 transition-colors"
                            title="Anular"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-zinc-400">
            Página {page} de {pagination.pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pagination.pages, page + 1))}
            disabled={page >= pagination.pages}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
