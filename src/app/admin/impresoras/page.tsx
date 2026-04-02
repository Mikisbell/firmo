'use client';

/**
 * Gestion de Impresoras Termicas
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Printer,
  Plus,
  Pencil,
  TestTube2,
  Power,
  PowerOff,
  Wifi,
  Globe,
  Usb,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PrinterRecord {
  id: string;
  name: string;
  stationId: string | null;
  stationCode: string;
  stationName: string | null;
  connectionType: 'TCP' | 'HTTP' | 'USB';
  connection: Record<string, unknown>;
  paperWidth: number;
  isActive: boolean;
  pendingJobs: number;
}

interface Station {
  id: string;
  code: string;
  name: string;
}

interface PrinterFormData {
  name: string;
  stationId: string;
  stationCode: string;
  connectionType: 'TCP' | 'HTTP' | 'USB';
  address: string;
  paperWidth: 58 | 80;
}

// ============================================================================
// Page
// ============================================================================

export default function PrintersPage() {
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterRecord | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/admin/printers?all=true');
      if (res.ok) {
        const data = await res.json();
        setPrinters(data.printers || []);
      }
    } catch {
      toast.error('Error al cargar impresoras');
    } finally {
      setLoading(false);
    }
  };

  const fetchStations = async () => {
    try {
      const res = await fetch('/api/admin/stations?pageSize=100');
      if (res.ok) {
        const data = await res.json();
        const list = data.data || data.stations || [];
        setStations(list.map((s: any) => ({ id: s.id, code: s.code, name: s.name })));
      }
    } catch (err) {
      console.error('Error fetching stations:', err);
    }
  };

  useEffect(() => {
    fetchPrinters();
    fetchStations();
  }, []);

  const handleToggleActive = async (printer: PrinterRecord) => {
    try {
      const res = await fetch(`/api/admin/printers/${printer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !printer.isActive }),
      });
      if (res.ok) {
        toast.success(
          printer.isActive ? 'Impresora desactivada' : 'Impresora activada',
          { description: `${printer.name} ha sido ${printer.isActive ? 'desactivada' : 'activada'}` },
        );
        await fetchPrinters();
      } else {
        throw new Error('Error al actualizar estado');
      }
    } catch (err) {
      toast.error('Error al actualizar impresora', {
        description: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  };

  const handleTestPrint = async (printer: PrinterRecord) => {
    setTestingId(printer.id);
    try {
      const res = await fetch(`/api/admin/printers/${printer.id}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Prueba enviada', { description: data.message });
      } else {
        toast.error('Prueba fallida', { description: data.error || 'Error desconocido' });
      }
    } catch (err) {
      toast.error('Error al enviar prueba', {
        description: err instanceof Error ? err.message : 'Error de conexion',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleSave = async (formData: PrinterFormData) => {
    try {
      const station = stations.find((s) => s.id === formData.stationId);
      const body: Record<string, unknown> = {
        name: formData.name,
        stationId: formData.stationId || undefined,
        stationCode: station?.code || formData.stationCode,
        connectionType: formData.connectionType,
        paperWidth: formData.paperWidth,
        connection:
          formData.connectionType === 'USB'
            ? {}
            : { address: formData.address },
      };

      let res;
      if (editingPrinter) {
        res = await fetch(`/api/admin/printers/${editingPrinter.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/admin/printers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar');
      }

      toast.success(
        editingPrinter ? 'Impresora actualizada' : 'Impresora creada',
        { description: `${formData.name} ha sido ${editingPrinter ? 'actualizada' : 'agregada'} exitosamente` },
      );
      setShowForm(false);
      setEditingPrinter(null);
      await fetchPrinters();
    } catch (err) {
      toast.error('Error al guardar impresora', {
        description: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Printer className="h-7 w-7" />
          Impresoras
        </h1>
        <button
          onClick={() => { setEditingPrinter(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          Nueva Impresora
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Estacion</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tipo Conexion</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Direccion</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Ancho Papel</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {printers.map((printer) => (
                <tr key={printer.id} className={!printer.isActive ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-3 font-medium text-gray-900">{printer.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {printer.stationName || printer.stationCode}
                  </td>
                  <td className="px-4 py-3">
                    <ConnectionBadge type={printer.connectionType} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                    {(printer.connection as any)?.address || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{printer.paperWidth}mm</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={printer.isActive} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditingPrinter(printer); setShowForm(true); }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleTestPrint(printer)}
                        disabled={!printer.isActive || testingId === printer.id}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Prueba de impresion"
                      >
                        {testingId === printer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube2 className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleToggleActive(printer)}
                        className={`p-1.5 rounded ${printer.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                        title={printer.isActive ? 'Desactivar' : 'Activar'}
                      >
                        {printer.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {printers.length === 0 && (
          <p className="p-8 text-center text-gray-500">
            No hay impresoras registradas
          </p>
        )}
      </div>

      {showForm && (
        <PrinterFormModal
          printer={editingPrinter}
          stations={stations}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingPrinter(null); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`text-xs px-2 py-1 rounded ${
        active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {active ? 'Activa' : 'Inactiva'}
    </span>
  );
}

function ConnectionBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; icon: typeof Wifi }> = {
    TCP: { bg: 'bg-blue-100 text-blue-700', icon: Wifi },
    HTTP: { bg: 'bg-yellow-100 text-yellow-700', icon: Globe },
    USB: { bg: 'bg-purple-100 text-purple-700', icon: Usb },
  };

  const { bg, icon: Icon } = config[type] || config.TCP;

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${bg}`}>
      <Icon className="h-3 w-3" />
      {type}
    </span>
  );
}

function PrinterFormModal({
  printer,
  stations,
  onSave,
  onCancel,
}: {
  printer: PrinterRecord | null;
  stations: Station[];
  onSave: (data: PrinterFormData) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(printer?.name || '');
  const [stationId, setStationId] = useState(printer?.stationId || '');
  const [connectionType, setConnectionType] = useState<'TCP' | 'HTTP' | 'USB'>(
    (printer?.connectionType as 'TCP' | 'HTTP' | 'USB') || 'TCP',
  );
  const [address, setAddress] = useState(
    (printer?.connection as any)?.address || '',
  );
  const [paperWidth, setPaperWidth] = useState<58 | 80>(
    (printer?.paperWidth as 58 | 80) || 80,
  );

  const selectedStation = stations.find((s) => s.id === stationId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      stationId,
      stationCode: selectedStation?.code || '',
      connectionType,
      address,
      paperWidth,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {printer ? 'Editar Impresora' : 'Nueva Impresora'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Cocina Principal"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estacion
            </label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              <option value="">Seleccionar estacion...</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Conexion
            </label>
            <select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value as 'TCP' | 'HTTP' | 'USB')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              <option value="TCP">TCP (Red local)</option>
              <option value="HTTP">HTTP (Web)</option>
              <option value="USB">USB (Directo)</option>
            </select>
          </div>

          {connectionType !== 'USB' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Direccion IP:Puerto
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="192.168.1.100:9100"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ancho de Papel
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paperWidth"
                  value={58}
                  checked={paperWidth === 58}
                  onChange={() => setPaperWidth(58)}
                  className="accent-orange-500"
                />
                <span className="text-sm">58mm</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paperWidth"
                  value={80}
                  checked={paperWidth === 80}
                  onChange={() => setPaperWidth(80)}
                  className="accent-orange-500"
                />
                <span className="text-sm">80mm (estandar)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              {printer ? 'Guardar Cambios' : 'Crear Impresora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
