'use client';

/**
 * Admin Yape/Plin Configuration Page
 *
 * Configure merchant phone numbers and names for Yape/Plin QR payments.
 * Dark theme (zinc-900/800) consistent with admin UI.
 *
 * @module app/admin/configuracion/yape-plin/page
 */

import { useState, useEffect } from 'react';
import { Smartphone, Save, Loader2, QrCode, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useYapePlinSettings } from '@/src/hooks/useYapePlinSettings';
import { Button, Card, PageHeader } from '@/src/components/ui';

export default function YapePlinConfigPage() {
  const { settings, isLoading, mutate } = useYapePlinSettings();

  const [yapePhone, setYapePhone] = useState('');
  const [yapeName, setYapeName] = useState('');
  const [plinPhone, setPlinPhone] = useState('');
  const [plinName, setPlinName] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewQR, setPreviewQR] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Sync form with fetched settings
  useEffect(() => {
    if (settings) {
      setYapePhone(settings.yape_merchant_phone ?? '');
      setYapeName(settings.yape_merchant_name ?? '');
      setPlinPhone(settings.plin_merchant_phone ?? '');
      setPlinName(settings.plin_merchant_name ?? '');
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/yape-plin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yape_merchant_phone: yapePhone || null,
          yape_merchant_name: yapeName || null,
          plin_merchant_phone: plinPhone || null,
          plin_merchant_name: plinName || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Error al guardar');
        return;
      }

      toast.success('Configuración guardada');
      mutate();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (method: 'YAPE' | 'PLIN') => {
    const phone = method === 'YAPE' ? yapePhone : plinPhone;
    if (!phone) {
      toast.error(`Ingrese teléfono de ${method} primero`);
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await fetch('/api/pos/payment-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, amountCents: 1000, orderNumber: 'TEST' }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Error al generar QR de prueba');
        return;
      }

      setPreviewQR(data.qrDataUrl);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <Card>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Yape / Plin"
        description="Configure los datos del comercio para pagos con QR"
      />

      {/* Yape Section */}
      <Card>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-purple-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Yape</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-park-gray-400 uppercase mb-1">
              Teléfono del Comercio
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={yapePhone}
              onChange={(e) => setYapePhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="987654321"
              className="w-full px-3 py-2.5 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white placeholder-park-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
            />
            <p className="text-xs text-park-gray-600 mt-1">9 dígitos, empieza con 9</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-park-gray-400 uppercase mb-1">
              Nombre del Comercio
            </label>
            <input
              type="text"
              value={yapeName}
              onChange={(e) => setYapeName(e.target.value.slice(0, 100))}
              placeholder="Mi Pollería"
              className="w-full px-3 py-2.5 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white placeholder-park-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreview('YAPE')}
          disabled={!yapePhone || previewLoading}
          icon={previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          className="text-purple-400 hover:text-purple-300"
        >
          Ver QR de prueba
        </Button>
      </Card>

      {/* Plin Section */}
      <Card>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-cyan-600/20 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-cyan-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Plin</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-park-gray-400 uppercase mb-1">
              Teléfono del Comercio
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={plinPhone}
              onChange={(e) => setPlinPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="987654321"
              className="w-full px-3 py-2.5 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white placeholder-park-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm"
            />
            <p className="text-xs text-park-gray-600 mt-1">9 dígitos, empieza con 9</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-park-gray-400 uppercase mb-1">
              Nombre del Comercio
            </label>
            <input
              type="text"
              value={plinName}
              onChange={(e) => setPlinName(e.target.value.slice(0, 100))}
              placeholder="Mi Pollería"
              className="w-full px-3 py-2.5 bg-park-gray-800 border border-park-gray-700 rounded-lg text-white placeholder-park-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreview('PLIN')}
          disabled={!plinPhone || previewLoading}
          icon={previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          className="text-cyan-400 hover:text-cyan-300"
        >
          Ver QR de prueba
        </Button>
      </Card>

      {/* QR Preview */}
      {previewQR && (
        <Card className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-park-gray-300">
            <QrCode className="w-4 h-4" />
            QR de Prueba (S/ 10.00)
          </div>
          <img
            src={previewQR}
            alt="QR Preview"
            className="w-[200px] h-[200px] rounded-lg bg-white p-1"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewQR(null)}
          >
            Cerrar preview
          </Button>
        </Card>
      )}

      {/* Save Button */}
      <Button
        variant="primary"
        size="lg"
        icon={<Save className="w-5 h-5" />}
        onClick={handleSave}
        loading={saving}
        className="w-full"
      >
        {saving ? 'Guardando...' : 'Guardar Configuración'}
      </Button>
    </div>
  );
}
