'use client';

/**
 * Admin Facturacion Page — Tabbed dashboard for invoicing management.
 *
 * Tabs: Comprobantes | Configuracion | Resumenes Diarios | Contingencia
 * Dark theme consistent with admin UI.
 *
 * @module app/admin/facturacion/page
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Download,
  Eye,
  XCircle,
  Loader2,
  ReceiptText,
  AlertTriangle,
  Settings,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInvoices, useInvoiceStats } from '@/src/hooks/useFacturacion';
import ConfiguracionTab from './configuracion-tab';
import ResumenesTab from './resumenes-tab';
import ContingenciaTab from './contingencia-tab';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState } from '@/src/components/ui';

function centsToSoles(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

type Tab = 'comprobantes' | 'configuracion' | 'resumenes' | 'contingencia';

const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'comprobantes', label: 'Comprobantes', icon: FileText },
  { id: 'configuracion', label: 'Configuracion', icon: Settings },
  { id: 'resumenes', label: 'Resumenes Diarios', icon: CalendarDays },
  { id: 'contingencia', label: 'Contingencia', icon: ShieldAlert },
];

export default function FacturacionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('comprobantes');

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <PageHeader
        title="Facturacion"
        description="Boletas, facturas y notas SUNAT"
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-park-gray-800 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-park-brand-500 text-park-brand-400'
                  : 'border-transparent text-park-gray-400 hover:text-park-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'comprobantes' && <ComprobantesTab />}
      {activeTab === 'configuracion' && <ConfiguracionTab />}
      {activeTab === 'resumenes' && <ResumenesTab />}
      {activeTab === 'contingencia' && <ContingenciaTab />}
    </div>
  );
}

// ============================================================================
// Comprobantes Tab (original content)
// ============================================================================

const STATUS_BADGE_MAP: Record<string, 'success' | 'critical' | 'warning' | 'neutral'> = {
  ISSUED: 'success',
  VOIDED: 'critical',
  PENDING: 'warning',
};

function ComprobantesTab() {
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
    const reason = prompt('Razon de anulacion (min. 5 caracteres):');
    if (!reason || reason.length < 5) {
      toast.error('La razon debe tener al menos 5 caracteres');
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
      toast.error('Error de conexion');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Boletas"
          value={statsLoading ? '...' : (stats?.boletaCount ?? 0)}
          icon={<FileText className="w-5 h-5 text-amber-400" />}
        />
        <MetricCard
          label="Facturas"
          value={statsLoading ? '...' : (stats?.facturaCount ?? 0)}
          icon={<FileText className="w-5 h-5 text-blue-400" />}
        />
        <MetricCard
          label="Anuladas"
          value={statsLoading ? '...' : (stats?.voidedCount ?? 0)}
          icon={<XCircle className="w-5 h-5 text-red-400" />}
        />
        <MetricCard
          label="Pendientes SUNAT"
          value={statsLoading ? '...' : (stats?.pendingSunatCount ?? 0)}
          icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm text-park-gray-200 outline-none"
        >
          <option value="">Todos los tipos</option>
          <option value="BOLETA">Boleta</option>
          <option value="FACTURA">Factura</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm text-park-gray-200 outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="ISSUED">Emitida</option>
          <option value="VOIDED">Anulada</option>
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-park-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por documento, serie..."
            className="w-full pl-9 pr-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-sm text-park-gray-200 placeholder-park-gray-400 outline-none focus:ring-1 focus:ring-park-brand-500"
          />
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-park-gray-600 animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="Sin comprobantes"
            description="No hay comprobantes que coincidan con los filtros"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-bold text-park-gray-400 uppercase">Serie - Nro</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-park-gray-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-park-gray-400 uppercase">Doc. Cliente</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-park-gray-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-park-gray-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-park-gray-400 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-park-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30">
                    <td className="px-4 py-3 font-mono text-white">
                      {inv.series}-{inv.invoice_number}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.invoice_type === 'FACTURA' ? 'info' : 'warning'}>
                        {inv.invoice_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-park-gray-300">
                      {inv.customer_doc_type ? `${inv.customer_doc_type}: ${inv.customer_doc}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {centsToSoles(inv.total_cents)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_BADGE_MAP[inv.status] ?? 'neutral'}>
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-park-gray-400 text-xs">
                      {new Date(inv.created_at).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/admin/facturacion/${inv.id}`}
                          className="p-1.5 hover:bg-park-gray-800 rounded text-park-gray-400 hover:text-white transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <a
                          href={`/api/admin/facturacion/${inv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-park-gray-800 rounded text-park-gray-400 hover:text-white transition-colors"
                          title="Descargar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {inv.status === 'ISSUED' && (
                          <button
                            onClick={() => handleVoid(inv.id)}
                            className="p-1.5 hover:bg-red-600/20 rounded text-park-gray-400 hover:text-red-400 transition-colors"
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
      </Card>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-park-gray-400">
            Pagina {page} de {pagination.pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(Math.min(pagination.pages, page + 1))}
            disabled={page >= pagination.pages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
