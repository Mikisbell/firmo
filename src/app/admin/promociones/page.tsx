'use client';

/**
 * Promotions Management Page
 * Requirements: 6.1, 6.2, 6.3
 */

import { useCallback, useState } from 'react';
import { Plus, Check, X, Calendar, Percent, Edit, Trash2, Tag } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../components/DataTable';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAdminData } from '@/src/hooks/useAdminData';
import { usePromotions } from '@/src/hooks/useSWRHooks';
import { Badge, Card, PageHeader, EmptyState, Button, Tooltip, ConfirmDialog } from '@/src/components/ui';

interface Promotion {
  id: string;
  name: string;
  type: string;
  value: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

const TYPE_OPTIONS = [
  { value: 'PERCENT', label: 'Porcentaje' },
  { value: 'FIXED', label: 'Monto Fijo' },
  { value: 'HAPPY_HOUR', label: 'Happy Hour' },
  { value: '2X1', label: '2x1' },
];

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activa' },
  { value: 'false', label: 'Inactiva' },
];

const filters: FilterConfig[] = [
  { key: 'type', label: 'Tipo', options: TYPE_OPTIONS },
  { key: 'is_active', label: 'Estado', options: STATUS_OPTIONS },
];

export default function PromotionsPage() {
  // Migrado a SWR - Tarea 9.3 Lote 2
  const { data, error: swrError, isLoading: loading, mutate } = usePromotions();
  const promotions = data?.items || [];
  const error = swrError ? 'Error al cargar promociones' : null;

  const isExpired = (endsAt: string) => new Date(endsAt) < new Date();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClick = useCallback((id: string) => {
    setConfirmDeleteId(id);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDeleteId) return;
    try {
      const res = await fetch(`/api/admin/promotions/${confirmDeleteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al desactivar');
      }
      toast.success('Promocion desactivada', {
        description: 'La promocion ha sido desactivada exitosamente',
      });
      mutate(); // Revalidar con SWR
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error('Error al desactivar promocion', {
        description: errorMessage,
      });
    }
  }, [confirmDeleteId, mutate]);

  const columns: Column<Promotion>[] = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'type',
      label: 'Tipo',
      width: '120px',
      render: (p) => (
        <Badge variant="info">
          <span className="inline-flex items-center gap-1">
            <Percent className="w-3 h-3" />
            {TYPE_OPTIONS.find((t) => t.value === p.type)?.label || p.type}
          </span>
        </Badge>
      ),
    },
    { key: 'value', label: 'Valor', width: '80px' },
    {
      key: 'dates',
      label: 'Vigencia',
      render: (p) => (
        <span className={`text-xs ${isExpired(p.ends_at) ? 'text-red-400' : 'text-park-gray-400'}`}>
          <Calendar className="w-3 h-3 inline mr-1" />
          {new Date(p.starts_at).toLocaleDateString()} - {new Date(p.ends_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Estado',
      width: '100px',
      render: (p) => {
        const expired = isExpired(p.ends_at);
        const variant = p.is_active && !expired ? 'success' : expired ? 'critical' : 'neutral';
        const label = expired ? 'Expirada' : p.is_active ? 'Activa' : 'Inactiva';
        return <Badge variant={variant} dot>{label}</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Acciones',
      width: '120px',
      render: (p) => (
        <div className="flex items-center gap-2">
          <Tooltip content="Editar">
            <Link
              href={`/admin/promociones/${p.id}`}
              data-testid={`edit-promotion-${p.id}`}
              aria-label={`Editar promocion ${p.name}`}
              className="p-1.5 hover:bg-park-gray-800 rounded transition-colors inline-flex"
            >
              <Edit className="w-4 h-4" />
            </Link>
          </Tooltip>
          <Tooltip content="Desactivar">
            <button
              onClick={() => handleDeleteClick(p.id)}
              data-testid={`delete-promotion-${p.id}`}
              aria-label={`Desactivar promocion ${p.name}`}
              className="p-1.5 hover:bg-red-500/10 text-red-400 rounded transition-colors inline-flex"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Promociones"
        description="Gestionar ofertas y descuentos"
        actions={
          <Link
            href="/admin/promociones/nuevo"
            data-testid="create-promotion-btn"
            aria-label="Crear nueva promocion"
          >
            <Button variant="primary" icon={<Plus size={16} />}>
              Nueva Promocion
            </Button>
          </Link>
        }
      />

      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <DataTable data={promotions || []} columns={columns} filters={filters} searchPlaceholder="Buscar..." searchKeys={['name']} loading={loading} emptyMessage="No hay promociones" />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="¿Desactivar promocion?"
        description="La promocion dejara de aplicarse a nuevas ordenes. Esta accion se puede revertir reactivandola."
        confirmLabel="Desactivar"
        variant="destructive"
      />
    </div>
  );
}
