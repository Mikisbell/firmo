'use client';

/**
 * Admin Table QR Codes Page
 *
 * Generate and download QR codes for restaurant tables.
 * Auto-selects the primary location; shows selector only for multi-location tenants.
 *
 * @module app/admin/mesas/qr/page
 */

import { useState, useEffect } from 'react';
import { QrCode, Download, Loader2, Grid3X3 } from 'lucide-react';
import { toast } from 'sonner';
import { useTableQRs } from '@/src/hooks/useTableQRs';
import useSWR from 'swr';
import { fetcher } from '@/src/lib/swr-config';

interface Location {
  id: string;
  code: string;
  name: string;
}

export default function TableQRPage() {
  const { data: locationsData } = useSWR<{ locations: Location[] }>(
    '/api/admin/locations',
    fetcher,
    { revalidateOnFocus: false },
  );

  const locations = locationsData?.locations ?? [];
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // Auto-select first location as soon as list loads
  useEffect(() => {
    if (locations.length > 0 && !selectedLocation) {
      setSelectedLocation(locations[0].id);
    }
  }, [locations, selectedLocation]);

  const { items: qrItems, isLoading } = useTableQRs(selectedLocation);

  const handleDownload = (qrDataUrl: string, displayName: string) => {
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-${displayName.replace(/\s+/g, '-')}.png`;
    link.click();
    toast.success(`QR de ${displayName} descargado`);
  };

  const handleDownloadAll = () => {
    if (qrItems.length === 0) return;
    for (const item of qrItems) {
      const link = document.createElement('a');
      link.href = item.qrDataUrl;
      link.download = `QR-${item.displayName.replace(/\s+/g, '-')}.png`;
      link.click();
    }
    toast.success(`${qrItems.length} códigos QR descargados`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-amber-400" />
            Códigos QR de Mesas
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Genere e imprima QR para que los clientes vean el menú digital
          </p>
        </div>

        {qrItems.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Descargar Todos
          </button>
        )}
      </div>

      {/* Location selector — only shown when tenant has multiple locations */}
      {locations.length > 1 && (
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
            Sucursal
          </label>
          <select
            value={selectedLocation ?? ''}
            onChange={(e) => setSelectedLocation(e.target.value || null)}
            className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-600 rounded-lg text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-amber-500"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
        </div>
      )}

      {/* No tables */}
      {!isLoading && selectedLocation && qrItems.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
          <Grid3X3 className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm">No hay mesas activas en esta sucursal</p>
        </div>
      )}

      {/* QR Grid */}
      {qrItems.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {qrItems.map((item) => (
            <div
              key={item.tableId}
              className="bg-zinc-800 rounded-xl border border-zinc-700 p-4 flex flex-col items-center gap-3"
            >
              <img
                src={item.qrDataUrl}
                alt={`QR ${item.displayName}`}
                className="w-full aspect-square rounded-lg bg-white p-2"
              />
              <div className="text-center">
                <p className="text-sm font-bold text-zinc-100">{item.displayName}</p>
                <p className="text-xs text-zinc-500 truncate max-w-full">{item.menuUrl}</p>
              </div>
              <button
                onClick={() => handleDownload(item.qrDataUrl, item.displayName)}
                className="w-full flex items-center justify-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 py-1.5 border border-zinc-600 rounded-lg hover:border-zinc-500 transition-colors"
              >
                <Download className="w-3 h-3" />
                Descargar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
