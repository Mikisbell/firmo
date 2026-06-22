'use client';

/**
 * Admin Notas de Venta — listado de documentos internos NO fiscales (pre-cuentas
 * formalizadas) con su estado y, si aplica, el comprobante al que se convirtieron.
 *
 * @module app/admin/sales-notes/page
 */

import { useState } from 'react';
import { FileText, Search, Loader2, ArrowRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSalesNotes, type SalesNoteListItem } from '@/src/hooks/useSalesNotes';
import { Badge, Card, PageHeader, EmptyState, Select, Input, Pagination } from '@/src/components/ui';
import { SalesNoteVoidModal } from '@/src/components/SalesNoteVoidModal';

function centsToSoles(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

const STATUS_BADGE_MAP: Record<string, 'success' | 'critical' | 'warning' | 'neutral' | 'info'> = {
  OPEN: 'warning',
  CONVERTED: 'success',
  VOIDED: 'critical',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Abierta',
  CONVERTED: 'Convertida',
  VOIDED: 'Anulada',
};

export default function SalesNotesPage() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [voidingNote, setVoidingNote] = useState<SalesNoteListItem | null>(null);

  const { salesNotes, pagination, isLoading, mutate } = useSalesNotes({
    page,
    limit: 20,
    status: filterStatus || undefined,
    search: search || undefined,
  });

  const handleVoid = async (reason: string) => {
    if (!voidingNote) return;
    const res = await fetch(`/api/admin/sales-notes/${voidingNote.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Error al anular' }));
      toast.error(data.error ?? 'Error al anular la nota');
      return;
    }
    toast.success(`Nota ${voidingNote.serie}-${voidingNote.numero} anulada`);
    setVoidingNote(null);
    mutate();
  };

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Notas de Venta"
        description="Documentos internos (pre-cuentas) NO fiscales, convertibles a boleta o factura"
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <Select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          options={[
            { value: '', label: 'Todos los estados' },
            { value: 'OPEN', label: 'Abierta' },
            { value: 'CONVERTED', label: 'Convertida' },
            { value: 'VOIDED', label: 'Anulada' },
          ]}
        />

        <div className="flex-1 min-w-[200px]">
          <Input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por serie o numero..."
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Tabla */}
      <Card padding="none">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-park-gray-600 animate-spin" />
          </div>
        ) : salesNotes.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="Sin notas de venta"
            description="No hay notas de venta que coincidan con los filtros"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-bold text-park-gray-400 uppercase">Serie - Nro</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-park-gray-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-park-gray-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-park-gray-400 uppercase">Comprobante</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-park-gray-400 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-park-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {salesNotes.map((note) => (
                  <tr key={note.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30">
                    <td className="px-4 py-3 font-mono text-white">
                      {note.serie}-{note.numero}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {centsToSoles(note.total_cents)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_BADGE_MAP[note.status] ?? 'neutral'}>
                        {STATUS_LABEL[note.status] ?? note.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-park-gray-300">
                      {note.status === 'CONVERTED' && note.invoice_type ? (
                        <span className="inline-flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-emerald-400" />
                          {note.invoice_type}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-park-gray-400 text-xs">
                      {new Date(note.created_at).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {note.status === 'OPEN' ? (
                        <button
                          onClick={() => setVoidingNote(note)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-300"
                        >
                          <X className="w-3.5 h-3.5" />
                          Anular
                        </button>
                      ) : (
                        <span className="text-park-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Paginacion */}
      {pagination && pagination.pages > 1 && (
        <Pagination
          page={page}
          totalPages={pagination.pages}
          onPageChange={setPage}
        />
      )}

      {voidingNote && (
        <SalesNoteVoidModal
          label={`${voidingNote.serie}-${voidingNote.numero}`}
          onClose={() => setVoidingNote(null)}
          onConfirm={handleVoid}
        />
      )}
    </div>
  );
}
