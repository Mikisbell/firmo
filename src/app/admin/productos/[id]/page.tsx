'use client';

/**
 * Edit Product Page
 * Form to edit product with all fields
 * 
 * Requirements: 2.3, 2.4, 2.9, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, DollarSign, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardFooter, PageHeader, Input, Select, Checkbox } from '@/src/components/ui';
import { ImageUpload } from '../components/ImageUpload';
import type { ProductImage } from '@/src/core/types/product-images';
import { useProduct, useStations } from '@/src/hooks/useSWRHooks';

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

interface Product {
  id: string;
  sku: string;
  name: string;
  short_name: string | null;
  price_cents: number;
  category: string;
  station: string;
  type: string;
  is_active: boolean;
  images: ProductImage[];
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [productId, setProductId] = useState<string | null>(null);
  
  // Migrado a SWR - deduplicación automática, revalidación inteligente
  const { data: product, error: fetchError, isLoading: loading, mutate } = useProduct(productId);
  const { data: stationsData, isLoading: loadingStations } = useStations();
  const stations = stationsData?.items ?? [];
  
  const [form, setForm] = useState({
    sku: '',
    name: '',
    short_name: '',
    price_soles: '',
    category: '',
    station: '',
    type: '',
    is_active: true,
  });
  const [images, setImages] = useState<ProductImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setProductId(p.id));
  }, [params]);

  useEffect(() => {
    if (!product) return;
    
    setImages(product.images || []);
    setForm({
      sku: product.sku,
      name: product.name,
      short_name: product.short_name || '',
      price_soles: (product.price_cents / 100).toFixed(2),
      category: product.category,
      station: product.station,
      type: product.type,
      is_active: product.is_active,
    });
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    
    setSaving(true);
    setError(null);

    try {
      // Convert price from soles to centavos (integer)
      const price_cents = Math.round(parseFloat(form.price_soles) * 100);

      if (isNaN(price_cents) || price_cents < 0) {
        throw new Error('Precio inválido');
      }

      // Step 1: Delete removed images
      if (imagesToDelete.length > 0) {
        const deletePromises = imagesToDelete.map(async (imageId) => {
          const deleteRes = await fetch(`/api/admin/products/images/${imageId}?product_id=${productId}`, {
            method: 'DELETE',
          });
          if (!deleteRes.ok) {
            console.error(`Failed to delete image ${imageId}`);
          }
        });
        await Promise.all(deletePromises);
      }

      // Step 2: Upload new images
      const newImages = images.filter((img: any) => img.file);
      if (newImages.length > 0) {
        const uploadPromises = newImages.map(async (img: any) => {
          const formData = new FormData();
          formData.append('file', img.file);
          formData.append('product_id', productId);

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

      // Step 3: Update image order if changed
      const imageIds = images.map((img: any) => img.id).filter((id: string) => !id.startsWith('temp-'));
      if (imageIds.length > 0) {
        await fetch(`/api/admin/products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: imageIds }),
        });
      }

      // Step 4: Update product data
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
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
        throw new Error(data.error || 'Error al actualizar producto');
      }

      toast.success('Producto actualizado', {
        description: `${form.name} ha sido actualizado exitosamente`,
      });
      
      // Revalidar datos después de actualizar
      mutate();
      
      router.push('/admin/productos');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      setError(errorMessage);
      toast.error('Error al actualizar producto', {
        description: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!productId) return;
    if (!confirm('¿Desactivar este producto? No aparecerá en el catálogo.')) return;

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al desactivar producto');
      }

      toast.success('Producto desactivado', {
        description: 'El producto ya no aparecerá en el catálogo',
      });
      router.push('/admin/productos');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error('Error al desactivar producto', {
        description: errorMessage,
      });
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
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

  if ((fetchError || error) && !product) {
    return (
      <div className="p-4 space-y-6">
        <PageHeader title="Error" backHref="/admin/productos" />
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {fetchError?.message || error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Editar Producto"
        description={product?.name}
        backHref="/admin/productos"
        actions={
          <Button
            variant="destructive"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDelete}
          >
            Desactivar
          </Button>
        }
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
              leftIcon={<Package className="w-4 h-4" />}
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
              leftIcon={<DollarSign className="w-4 h-4" />}
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
              required
              disabled={loadingStations}
              options={[
                ...(form.station && !stations.find(s => s.code === form.station)
                  ? [{ value: form.station, label: `${form.station} (inactiva)` }]
                  : []),
                ...stations.map((s) => ({ value: s.code, label: s.name })),
              ]}
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
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-park-gray-300 mb-3">
              Imágenes del producto
            </label>
            <ImageUpload
              productId={productId || undefined}
              existingImages={images}
              onImagesChange={(newImages) => {
                // Track deleted images
                const existingIds = images.map(img => img.id);
                const newIds = newImages.map((img: any) => img.id);
                const deleted = existingIds.filter(id => !newIds.includes(id));
                setImagesToDelete(prev => [...new Set([...prev, ...deleted])]);
                setImages(newImages);
              }}
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
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
