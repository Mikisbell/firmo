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
} from 'lucide-react';
import { Button, Badge, Card, PageHeader, EmptyState } from '@/src/components/ui';
import { Tooltip } from '@/src/components/ui/Tooltip';

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

const CONNECTION_BADGE: Record<string, { variant: 'info' | 'warning' | 'neutral'; icon: typeof Wifi }> = {
  TCP: { variant: 'info', icon: Wifi },
  HTTP: { variant: 'warning', icon: Globe },
  USB: { variant: 'neutral', icon: Usb },
};

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
      <div className="p-4 space-y-6">
        <div className="h-10 w-72 bg-park-gray-800 rounded-lg animate-pulse" />
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

  return (
    <div className="p-4">
      <PageHeader
        title="Impresoras"
        description="Impresoras térmicas y cola de impresión"
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => { setEditingPrinter(null); setShowForm(true); }}
          >
            Nueva Impresora
          </Button>
        }
      />

      <Card padding="none">
        {printers.length === 0 ? (
          <EmptyState
            icon={<Printer />}
            title="Sin impresoras"
            description="Agrega tu primera impresora térmica"
            action={{ label: 'Nueva Impresora', onClick: () => setShowForm(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Estacion</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Tipo Conexion</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Direccion</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Ancho Papel</th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {printers.map((printer) => {
                  const conn = CONNECTION_BADGE[printer.connectionType] || CONNECTION_BADGE.TCP;
                  const ConnIcon = conn.icon;
                  return (
                    <tr key={printer.id} className={`border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors ${!printer.isActive ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-medium text-white">{printer.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">
                          {printer.stationName || printer.stationCode}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={conn.variant}>
                          <ConnIcon className="h-3 w-3" />
                          {printer.connectionType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-park-gray-400 font-mono">
                        {(printer.connection as any)?.address || '-'}
                      </td>
                      <td className="px-4 py-3 text-park-gray-400">{printer.paperWidth}mm</td>
                      <td className="px-4 py-3">
                        <Badge variant={printer.isActive ? 'success' : 'neutral'} dot>
                          {printer.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip content="Editar">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Pencil className="h-4 w-4" />}
                              onClick={() => { setEditingPrinter(printer); setShowForm(true); }}
                              title="Editar"
                            />
                          </Tooltip>
                          <Tooltip content="Probar">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<TestTube2 className="h-4 w-4" />}
                              loading={testingId === printer.id}
                              disabled={!printer.isActive}
                              onClick={() => handleTestPrint(printer)}
                              title="Prueba de impresion"
                            />
                          </Tooltip>
                          <Tooltip content={printer.isActive ? 'Desactivar' : 'Activar'}>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={printer.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              onClick={() => handleToggleActive(printer)}
                              title={printer.isActive ? 'Desactivar' : 'Activar'}
                              className={printer.isActive ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}
                            />
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
// Printer Form Modal
// ============================================================================

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
      <Card className="w-full max-w-md mx-4" padding="none">
        <div className="px-6 py-4 border-b border-park-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {printer ? 'Editar Impresora' : 'Nueva Impresora'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-park-gray-300 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Cocina Principal"
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white placeholder-park-gray-500 focus:ring-2 focus:ring-park-brand-500 focus:border-park-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-park-gray-300 mb-1">
              Estacion
            </label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white focus:ring-2 focus:ring-park-brand-500 focus:border-park-brand-500 outline-none"
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
            <label className="block text-sm font-medium text-park-gray-300 mb-1">
              Tipo de Conexion
            </label>
            <select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value as 'TCP' | 'HTTP' | 'USB')}
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white focus:ring-2 focus:ring-park-brand-500 focus:border-park-brand-500 outline-none"
            >
              <option value="TCP">TCP (Red local)</option>
              <option value="HTTP">HTTP (Web)</option>
              <option value="USB">USB (Directo)</option>
            </select>
          </div>

          {connectionType !== 'USB' && (
            <div>
              <label className="block text-sm font-medium text-park-gray-300 mb-1">
                Direccion IP:Puerto
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="192.168.1.100:9100"
                className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white placeholder-park-gray-500 font-mono focus:ring-2 focus:ring-park-brand-500 focus:border-park-brand-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-park-gray-300 mb-1">
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
                  className="accent-park-brand-500"
                />
                <span className="text-sm text-park-gray-300">58mm</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paperWidth"
                  value={80}
                  checked={paperWidth === 80}
                  onChange={() => setPaperWidth(80)}
                  className="accent-park-brand-500"
                />
                <span className="text-sm text-park-gray-300">80mm (estandar)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={onCancel}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {printer ? 'Guardar Cambios' : 'Crear Impresora'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
