'use client';

/**
 * Tables Management Page
 * CRUD de mesas con filtros por zona
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, MapPin, LayoutGrid } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../components/DataTable';
import { useTables } from '@/src/hooks/useSWRHooks';
import { Button, Badge, Card, PageHeader, EmptyState, Modal, Input, Select, Checkbox } from '@/src/components/ui';
import { useQueryStates } from '@/src/hooks/useQueryState';

interface Zone {
  id: string;
  code: string;
  name: string;
  color: string;
  tables_count: number;
}

interface Table {
  id: string;
  number: string;
  display_name: string | null;
  capacity: number;
  shape: string;
  status: string;
  is_active: boolean;
  zone_id: string | null;
  zone: { id: string; code: string; name: string; color: string } | null;
}

export default function TablesPage() {
  // Migrado a SWR - Tarea 9.3 Lote 2
  const { data, error: swrError, isLoading: loading, mutate } = useTables();
  const tables = data?.items || [];
  const error = swrError ? 'Error al cargar datos' : null;
  
  const [zones, setZones] = useState<Zone[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [tableFilters, setTableFilters] = useQueryStates({ zone_id: '', is_active: '', shape: '' });

  const fetchData = useCallback(async () => {
    try {
      // Solo necesitamos cargar zones, tables viene de SWR
      const zonesRes = await fetch('/api/admin/zones');
      
      if (!zonesRes.ok) throw new Error('Failed to fetch zones');
      
      const zonesData = await zonesRes.json();
      setZones(zonesData.items || zonesData);
      
      // Revalidar tables con SWR
      mutate();
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, [mutate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar esta mesa?')) return;
    
    try {
      const res = await fetch(`/api/admin/tables/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      mutate(); // Revalidar con SWR
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const zoneOptions = (zones && Array.isArray(zones) ? zones : []).map(z => ({ value: z.id, label: z.name }));
  
  const filters: FilterConfig[] = [
    { key: 'zone_id', label: 'Zona', options: zoneOptions },
    { key: 'is_active', label: 'Estado', options: [
      { value: 'true', label: 'Activa' },
      { value: 'false', label: 'Inactiva' },
    ]},
    { key: 'shape', label: 'Forma', options: [
      { value: 'SQUARE', label: 'Cuadrada' },
      { value: 'ROUND', label: 'Redonda' },
      { value: 'RECTANGLE', label: 'Rectangular' },
    ]},
  ];

  const columns: Column<Table>[] = [
    { key: 'number', label: 'Número', width: '80px', sortable: true },
    { key: 'display_name', label: 'Nombre', sortable: true, render: (t) => t.display_name || `Mesa ${t.number}` },
    {
      key: 'zone',
      label: 'Zona',
      width: '120px',
      render: (t) => t.zone ? (
        <span 
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{ backgroundColor: `${t.zone.color}20`, color: t.zone.color }}
        >
          <MapPin className="w-3 h-3" />
          {t.zone.name}
        </span>
      ) : <span className="text-zinc-500">Sin zona</span>,
    },
    { key: 'capacity', label: 'Capacidad', width: '90px', sortable: true, numeric: true, render: (t) => `${t.capacity} pers.` },
    {
      key: 'shape',
      label: 'Forma',
      width: '100px',
      render: (t) => (
        <Badge variant={
          t.shape === 'SQUARE' ? 'success' :
          t.shape === 'ROUND' ? 'info' :
          'neutral'
        }>
          {({ SQUARE: 'Cuadrada', ROUND: 'Redonda', RECTANGLE: 'Rectangular' }[t.shape] || t.shape)}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      width: '100px',
      render: (t) => (
        <Badge variant={
          t.status === 'AVAILABLE' ? 'success' :
          t.status === 'OCCUPIED' ? 'warning' :
          'neutral'
        } dot>
          {t.status === 'AVAILABLE' ? 'Libre' : t.status === 'OCCUPIED' ? 'Ocupada' : t.status}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: 'Activa',
      width: '70px',
      render: (t) => t.is_active ? 
        <Check className="w-4 h-4 text-green-400" /> : 
        <X className="w-4 h-4 text-zinc-500" />,
    },
    {
      key: 'actions',
      label: '',
      width: '100px',
      render: (t) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setEditingTable(t); setShowModal(true); }}
            icon={<Edit2 className="w-4 h-4" />}
          >
            Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
            icon={<Trash2 className="w-4 h-4" />}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} padding="md">
              <div className="space-y-2">
                <div className="h-4 w-20 bg-park-gray-800 rounded animate-pulse" />
                <div className="h-6 w-16 bg-park-gray-800 rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
        <Card padding="none">
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mesas"
        description={`${tables.length} mesas en ${zones.length} zonas`}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => { setEditingTable(null); setShowModal(true); }}
          >
            Nueva Mesa
          </Button>
        }
      />

      {/* Zone summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(zones && Array.isArray(zones) ? zones : []).map(zone => (
          <Card
            key={zone.id}
            padding="md"
          >
            <div style={{ borderLeftColor: zone.color, borderLeftWidth: 4, paddingLeft: 12 }}>
              <div className="text-sm text-park-gray-400">{zone.name}</div>
              <div className="text-xl font-bold text-white">{zone.tables_count} mesas</div>
            </div>
          </Card>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <Card padding="none">
        {tables.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid />}
            title="Sin mesas"
            description="Agrega tu primera mesa para gestionar el salón"
            action={{ label: 'Nueva Mesa', onClick: () => { setEditingTable(null); setShowModal(true); } }}
          />
        ) : (
          <DataTable
            data={tables}
            columns={columns}
            filters={filters}
            searchPlaceholder="Buscar por número o nombre..."
            searchKeys={['number', 'display_name']}
            loading={loading}
            emptyMessage="No hay mesas"
            exportable={true}
            exportFileName="mesas"
            activeFilters={tableFilters}
            onFiltersChange={(f) => setTableFilters({
              zone_id: f.zone_id || '',
              is_active: f.is_active || '',
              shape: f.shape || '',
            })}
          />
        )}
      </Card>

      {showModal && (
        <TableModal
          table={editingTable}
          zones={zones}
          onClose={() => { setShowModal(false); setEditingTable(null); }}
          onSave={() => { setShowModal(false); setEditingTable(null); mutate(); }}
        />
      )}
    </div>
  );
}

function TableModal({ 
  table, 
  zones, 
  onClose, 
  onSave 
}: { 
  table: Table | null; 
  zones: Zone[]; 
  onClose: () => void; 
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    number: table?.number || '',
    display_name: table?.display_name || '',
    zone_id: table?.zone_id || '',
    capacity: table?.capacity || 4,
    shape: table?.shape || 'SQUARE',
    is_active: table?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      const url = table ? `/api/admin/tables/${table.id}` : '/api/admin/tables';
      const method = table ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          zone_id: form.zone_id || null,
          display_name: form.display_name || null,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={table ? 'Editar Mesa' : 'Nueva Mesa'}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="table-form"
            disabled={saving}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="table-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Número"
              type="text"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              required
            />
            <Input
              label="Capacidad"
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 4 })}
              min={1}
              max={20}
            />
          </div>

          <Input
            label="Nombre (opcional)"
            type="text"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder={`Mesa ${form.number}`}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Zona"
              value={form.zone_id}
              onChange={(e) => setForm({ ...form, zone_id: e.target.value })}
              placeholder="Sin zona"
              options={zones.map(z => ({
                value: z.id,
                label: z.name,
              }))}
            />
            <Select
              label="Forma"
              value={form.shape}
              onChange={(e) => setForm({ ...form, shape: e.target.value })}
              options={[
                { value: 'SQUARE', label: 'Cuadrada' },
                { value: 'ROUND', label: 'Redonda' },
                { value: 'RECTANGLE', label: 'Rectangular' },
              ]}
            />
          </div>

          <Checkbox
            label="Mesa activa"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          
      </form>
    </Modal>
  );
}
