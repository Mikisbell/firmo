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
import { Button, Card, PageHeader, EmptyState } from '@/src/components/ui';

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

  const { items: qrItems, isLoading, error: qrError } = useTableQRs(selectedLocation);

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
      <PageHeader
        title="QR Mesas"
        description="Genere e imprima QR para que los clientes vean el menú digital"
        actions={
          qrItems.length > 0 ? (
            <Button
              variant="primary"
              icon={<Download className="w-4 h-4" />}
              onClick={handleDownloadAll}
            >
              Descargar Todos
            </Button>
          ) : undefined
        }
      />

      {/* Location selector */}
      {locations.length > 1 && (
        <Card>
          <label className="block text-xs font-bold text-park-gray-400 uppercase mb-2">
            Sucursal
          </label>
          <select
            value={selectedLocation ?? ''}
            onChange={(e) => setSelectedLocation(e.target.value || null)}
            className="w-full px-3 py-2.5 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-park-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* API error */}
      {!isLoading && qrError && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm">
          {qrError.message?.includes('slug') || String(qrError).includes('slug')
            ? 'El restaurante no tiene slug configurado. Ve a Configuración -> Perfil del restaurante y define el identificador URL.'
            : 'Error al generar los códigos QR. Intenta de nuevo.'}
        </div>
      )}

      {/* No tables */}
      {!isLoading && !qrError && selectedLocation && qrItems.length === 0 && (
        <Card padding="none">
          <EmptyState
            icon={<Grid3X3 />}
            title="No hay mesas activas en esta sucursal"
          />
        </Card>
      )}

      {/* QR Grid */}
      {qrItems.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {qrItems.map((item) => (
            <Card key={item.tableId} className="flex flex-col items-center gap-3 !p-4">
              <img
                src={item.qrDataUrl}
                alt={`QR ${item.displayName}`}
                className="w-full aspect-square rounded-lg bg-white p-2"
              />
              <p className="text-sm font-bold text-white text-center">{item.displayName}</p>
              <Button
                variant="ghost"
                size="sm"
                icon={<Download className="w-3 h-3" />}
                onClick={() => handleDownload(item.qrDataUrl, item.displayName)}
                className="w-full text-amber-400"
              >
                Descargar
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
