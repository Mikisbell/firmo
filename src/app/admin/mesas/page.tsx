'use client';

/**
 * Tables Management Page
 * CRUD de mesas con filtros por zona
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Check, X, MapPin } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../components/DataTable';

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
  const [tables, setTables] = useState<Table[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tablesRes, zonesRes] = await Promise.all([
        fetch('/api/admin/tables'),
        fetch('/api/admin/zones'),
      ]);
      
      if (!tablesRes.ok || !zonesRes.ok) throw new Error('Failed to fetch data');
      
      const [tablesData, zonesData] = await Promise.all([
        tablesRes.json(),
        zonesRes.json(),
      ]);
      
      setTables(tablesData);
      setZones(zonesData);
      setError(null);
    } catch (err) {
      setError('Error al cargar datos');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar esta mesa?')) return;
    
    try {
      const res = await fetch(`/api/admin/tables/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      fetchData();
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
    { key: 'number', label: 'Número', width: '80px' },
    { key: 'display_name', label: 'Nombre', render: (t) => t.display_name || `Mesa ${t.number}` },
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
    { key: 'capacity', label: 'Capacidad', width: '90px', render: (t) => `${t.capacity} pers.` },
    { key: 'shape', label: 'Forma', width: '100px', render: (t) => ({
      SQUARE: 'Cuadrada',
      ROUND: 'Redonda',
      RECTANGLE: 'Rectangular',
    }[t.shape] || t.shape) },
    {
      key: 'status',
      label: 'Estado',
      width: '100px',
      render: (t) => (
        <span className={`px-2 py-1 rounded text-xs ${
          t.status === 'AVAILABLE' ? 'bg-green-500/20 text-green-400' :
          t.status === 'OCCUPIED' ? 'bg-amber-500/20 text-amber-400' :
          'bg-zinc-500/20 text-zinc-400'
        }`}>
          {t.status === 'AVAILABLE' ? 'Libre' : t.status === 'OCCUPIED' ? 'Ocupada' : t.status}
        </span>
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
          <button
            onClick={(e) => { e.stopPropagation(); setEditingTable(t); setShowModal(true); }}
            className="p-2 rounded hover:bg-zinc-800"
            title="Editar"
          >
            <Edit2 className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
            className="p-2 rounded hover:bg-zinc-800"
            title="Desactivar"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mesas</h1>
          <p className="text-zinc-400 mt-1">
            {tables.length} mesas en {zones.length} zonas
          </p>
        </div>
        <button
          onClick={() => { setEditingTable(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Nueva Mesa
        </button>
      </div>

      {/* Zone summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(zones && Array.isArray(zones) ? zones : []).map(zone => (
          <div 
            key={zone.id}
            className="p-3 rounded-lg border border-zinc-800"
            style={{ borderLeftColor: zone.color, borderLeftWidth: 4 }}
          >
            <div className="text-sm text-zinc-400">{zone.name}</div>
            <div className="text-xl font-bold">{zone.tables_count} mesas</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <DataTable
        data={tables}
        columns={columns}
        filters={filters}
        searchPlaceholder="Buscar por número o nombre..."
        searchKeys={['number', 'display_name']}
        loading={loading}
        emptyMessage="No hay mesas"
      />

      {showModal && (
        <TableModal
          table={editingTable}
          zones={zones}
          onClose={() => { setShowModal(false); setEditingTable(null); }}
          onSave={() => { setShowModal(false); setEditingTable(null); fetchData(); }}
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-md border border-zinc-800">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold">{table ? 'Editar Mesa' : 'Nueva Mesa'}</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Número *</label>
              <input
                type="text"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Capacidad</label>
              <input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 4 })}
                min={1}
                max={20}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nombre (opcional)</label>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder={`Mesa ${form.number}`}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Zona</label>
              <select
                value={form.zone_id}
                onChange={(e) => setForm({ ...form, zone_id: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none"
              >
                <option value="">Sin zona</option>
                {zones.map(z => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Forma</label>
              <select
                value={form.shape}
                onChange={(e) => setForm({ ...form, shape: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none"
              >
                <option value="SQUARE">Cuadrada</option>
                <option value="ROUND">Redonda</option>
                <option value="RECTANGLE">Rectangular</option>
              </select>
            </div>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm">Mesa activa</span>
          </label>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
