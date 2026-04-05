'use client';

/**
 * Create Product Page
 * Form to create new product with all fields
 *
 * Requirements: 2.1, 2.2, 2.5, 2.6, 2.9, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardFooter,
  PageHeader,
  Input,
  Select,
  Checkbox,
} from '@/src/components/ui';
import { ImageUpload } from '../components/ImageUpload';
import type { ProductImage } from '@/src/core/types/product-images';
import { useStations } from '@/src/hooks/useSWRHooks';

const CATEGORY_OPTIONS = [
  { value: 'POLLOS', label: 'Pollos' },
  { value: 'PARRILLAS', label: 'Parrillas' },
  { value: 'CRIOLLOS', label: 'Criollos' },
  { value: 'SALCHIPAPAS', label: 'Salchipapas' },
  { value: 'ALITAS', label: 'Alitas' },
  { value: 'PIQUEOS', label: 'Piqueos' },
  { value: 'BEBIDAS', label: 'Bebidas' },
  { value: 'GUARNICIONES', label: 'Guarniciones' },
  { value: 'EXTRAS', label: 'Extras' },
  { value: 'POSTRES', label: 'Postres' },
  { value: 'COMBOS', label: 'Combos' },
];

const TYPE_OPTIONS = [
  { value: 'SIMPLE', label: 'Simple' },
  { value: 'COMBO', label: 'Combo' },
];

export default function NewProductPage() {
  const router = useRouter();
  const { data: stationsData, isLoading: loadingStations } = useStations();
  const stations = stationsData?.items ?? [];

  const [form, setForm] = useState({
    sku: '',
    name: '',
    short_name: '',
    price_soles: '',
    category: 'POLLOS',
    station: '',
    type: 'SIMPLE',
    is_active: true,
  });

  // Auto-select first station when loaded
  useEffect(() => {
    if (stations.length > 0 && !form.station) {
      setForm(f => ({ ...f, station: stations[0].code }));
    }
  }, [stations]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Convert price from soles to centavos (integer)
      const price_cents = Math.round(parseFloat(form.price_soles) * 100);

      if (isNaN(price_cents) || price_cents < 0) {
        throw new Error('Precio inválido');
      }

      // Step 1: Create product
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku,
          name: form.name,
          short_name: form.short_name || null,
          price_cents,
          category: form.category,
          station: form.station,
          type: form.type,
          is_active: form.is_active,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear producto');
      }

      const createdProduct = await res.json();

      // Step 2: Upload images if any
      if (images.length > 0) {
        const uploadPromises = images.map(async (img: any) => {
          if (!img.file) return; // Skip existing images (shouldn't happen in create)

          const formData = new FormData();
          formData.append('file', img.file);
          formData.append('product_id', createdProduct.id);

          const uploadRes = await fetch('/api/admin/products/images', {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            const errorData = await uploadRes.json();
            throw new Error(`Error uploading image: ${errorData.error}`);
          }
        });

        await Promise.all(uploadPromises);
      }

      toast.success('Producto creado exitosamente', {
        description: `${form.name} ha sido agregado al catálogo${images.length > 0 ? ` con ${images.length} imagen(es)` : ''}`,
      });
      router.push('/admin/productos');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      setError(errorMessage);
      toast.error('Error al crear producto', {
        description: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  const stationOptions = stations.map((s) => ({ value: s.code, label: s.name }));

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Nuevo Producto"
        description="Agregar producto al catálogo"
        backHref="/admin/productos"
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* SKU and Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="SKU *"
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="Ej: POLLO-1/4"
              required
              maxLength={50}
              hint="Código único del producto"
            />

            <Input
              label="Nombre completo *"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: 1/4 Pollo a la Brasa"
              required
              maxLength={100}
            />
          </div>

          {/* Short name and Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre corto (opcional)"
              type="text"
              value={form.short_name}
              onChange={(e) => setForm({ ...form, short_name: e.target.value })}
              placeholder="Ej: 1/4 Pollo"
              maxLength={30}
              hint="Para mostrar en pantallas pequeñas"
            />

            <Input
              label="Precio (S/) *"
              type="number"
              step="0.01"
              min="0"
              value={form.price_soles}
              onChange={(e) => setForm({ ...form, price_soles: e.target.value })}
              placeholder="0.00"
              required
              hint="Se almacena en centavos (entero)"
            />
          </div>

          {/* Category and Station */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Categoría *"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={CATEGORY_OPTIONS}
              required
            />

            <Select
              label="Estación de preparación *"
              value={form.station}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              options={stationOptions}
              placeholder={loadingStations ? 'Cargando estaciones...' : undefined}
              required
              disabled={loadingStations}
            />
          </div>

          {/* Type */}
          <Select
            label="Tipo de producto *"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={TYPE_OPTIONS}
            required
          />

          {/* Active status */}
          <div className="p-4 bg-park-gray-800/50 rounded-lg">
            <Checkbox
              label="Producto activo (visible en el catálogo)"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-park-gray-300 mb-3">
              Imágenes del producto (opcional)
            </label>
            <ImageUpload
              onImagesChange={setImages}
              disabled={saving}
            />
            <p className="text-xs text-park-gray-500 mt-2">
              La primera imagen será la imagen principal del producto
            </p>
          </div>

          <CardFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              className="flex-1"
            >
              {saving ? 'Creando...' : 'Crear Producto'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
