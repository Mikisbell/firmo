# 🚀 Productos P1 - Sesión 27 Enero 2026

**Hora Inicio:** Continuación de sesión anterior  
**Objetivo:** Implementar Task 3 - Image Upload Component

---

## 📊 Estado Actual

### ✅ Completado (Tasks 1-2)

**Task 1: Database Migration** ✅
- Migración `20260127_add_product_images` creada y aplicada
- Campo `images` JSONB agregado a tabla products
- Índice GIN creado para queries eficientes
- Schema Prisma actualizado

**Task 2: TypeScript Types** ✅
- `src/core/types/product-images.ts` - Interfaces completas
- `src/core/admin/schemas/product-image.schema.ts` - Validación Zod
- `src/core/types/product.ts` - Product type con helpers
- 23 tests unitarios pasando ✅
- Type casting corregido (`as unknown as ProductImage[]`)

**Integración Verificada** ✅
- TypeScript diagnostics: Sin errores
- Build de producción: 90 páginas generadas exitosamente
- API GET incluye campo images
- Frontend Product interface actualizada
- Database queries funcionando

---

## 🎯 Task 3: Image Upload Component

### Objetivo
Crear componente React para subir imágenes de productos con drag & drop, preview, y validación.

### Ubicación
`src/app/admin/productos/components/ImageUpload.tsx`

### Features Requeridas

1. **Drag & Drop Zone**
   - Visual feedback al arrastrar archivos
   - Fallback a file input para accesibilidad
   - Soporte para múltiples archivos (hasta 5)

2. **Preview Grid**
   - Mostrar imágenes subidas
   - Reordenar con drag & drop
   - Botón delete por imagen
   - Indicador de imagen principal (order=0)

3. **Validación**
   - Formato: JPG, PNG, WEBP
   - Tamaño máximo: 5MB por archivo
   - Máximo 5 imágenes por producto
   - Validación de file signature (magic bytes)

4. **Progress Indicators**
   - Barra de progreso durante upload
   - Estado de carga por archivo
   - Mensajes de error específicos

5. **Responsive Design**
   - Mobile-friendly
   - Touch gestures para reordenar
   - Adaptable a diferentes tamaños de pantalla

### Props Interface

```typescript
interface ImageUploadProps {
  productId?: string;           // Undefined para productos nuevos
  existingImages?: ProductImage[];
  maxImages?: number;           // Default: 5
  maxSizeBytes?: number;        // Default: 5MB
  onImagesChange: (images: ProductImage[]) => void;
  disabled?: boolean;
}
```

### State Management

```typescript
const [images, setImages] = useState<ProductImage[]>(existingImages || []);
const [uploading, setUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
const [errors, setErrors] = useState<string[]>([]);
const [dragActive, setDragActive] = useState(false);
```

### Dependencias

- `react-dropzone` - Drag & drop functionality
- `@dnd-kit/core` - Reordering images
- `lucide-react` - Icons (Upload, X, GripVertical)
- Zod schemas existentes para validación

### Validación

Usar schemas existentes:
- `ImageUploadRequestSchema` - Validar request
- `ProductImagesArraySchema` - Validar array completo
- Constantes de `product-images.ts`:
  - `MAX_FILE_SIZE` (5MB)
  - `MAX_IMAGES_PER_PRODUCT` (5)
  - `ACCEPTED_MIME_TYPES`

### Error Handling

```typescript
enum ImageUploadError {
  FILE_TOO_LARGE = 'File size exceeds 5MB limit',
  INVALID_FORMAT = 'File must be JPG, PNG, or WEBP',
  INVALID_SIGNATURE = 'File signature does not match extension',
  MAX_IMAGES_REACHED = 'Product already has maximum of 5 images',
  UPLOAD_FAILED = 'Failed to upload image to storage',
}
```

### UI/UX Requirements

1. **Empty State**
   - Icono de upload grande
   - Texto: "Drag & drop images here, or click to select"
   - Mostrar formatos aceptados y tamaño máximo

2. **Drag Active State**
   - Border azul pulsante
   - Background semi-transparente
   - Texto: "Drop images here"

3. **Preview Grid**
   - Grid responsive (2-3 columnas en mobile, 4-5 en desktop)
   - Thumbnails con aspect ratio 1:1
   - Hover effects con botones de acción
   - Badge "Primary" en primera imagen

4. **Progress Indicator**
   - Barra de progreso lineal
   - Porcentaje visible
   - Spinner durante procesamiento

5. **Error Display**
   - Toast notifications para errores
   - Lista de errores debajo del dropzone
   - Iconos de error en archivos rechazados

### Accessibility

- Keyboard navigation (Tab, Enter, Space)
- ARIA labels para screen readers
- Focus indicators visibles
- Alt text para imágenes

---

## 📋 Plan de Implementación

### Paso 1: Instalar Dependencias
```bash
npm install react-dropzone @dnd-kit/core @dnd-kit/sortable
```

### Paso 2: Crear Componente Base
- Estructura del componente
- Props interface
- State management
- Dropzone setup

### Paso 3: Implementar Drag & Drop
- Configurar react-dropzone
- Validación de archivos
- Preview de archivos seleccionados

### Paso 4: Implementar Preview Grid
- Grid layout responsive
- Image thumbnails
- Delete buttons
- Reordering con @dnd-kit

### Paso 5: Implementar Upload Logic
- Función uploadImage (placeholder por ahora)
- Progress tracking
- Error handling
- Success feedback

### Paso 6: Styling
- Tailwind CSS classes
- Responsive design
- Hover states
- Animations

### Paso 7: Tests
- Unit tests para validación
- Component tests con React Testing Library
- Accessibility tests

---

## 🔧 Notas Técnicas

### File Signature Validation

Para prevenir fake extensions, validar magic bytes:

```typescript
const validateFileSignature = async (file: File): Promise<boolean> => {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return file.type === 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return file.type === 'image/png';
  }
  
  // WEBP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return file.type === 'image/webp';
  }
  
  return false;
};
```

### Image Preview

Para mostrar preview antes de upload:

```typescript
const createImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
```

### Reordering Logic

```typescript
const handleReorder = (activeId: string, overId: string) => {
  setImages((prev) => {
    const oldIndex = prev.findIndex(img => img.id === activeId);
    const newIndex = prev.findIndex(img => img.id === overId);
    
    const reordered = arrayMove(prev, oldIndex, newIndex);
    
    // Update order property
    return reordered.map((img, index) => ({
      ...img,
      order: index
    }));
  });
};
```

---

## ✅ Criterios de Aceptación

### Funcionalidad
- [ ] Drag & drop funciona correctamente
- [ ] File input fallback funciona
- [ ] Validación de formato funciona
- [ ] Validación de tamaño funciona
- [ ] Validación de file signature funciona
- [ ] Preview de imágenes se muestra
- [ ] Reordenar imágenes funciona
- [ ] Eliminar imágenes funciona
- [ ] Progress indicator se muestra durante upload
- [ ] Errores se muestran claramente

### UI/UX
- [ ] Responsive en mobile y desktop
- [ ] Drag active state visible
- [ ] Hover effects funcionan
- [ ] Animaciones suaves
- [ ] Loading states claros
- [ ] Error messages útiles

### Accesibilidad
- [ ] Keyboard navigation funciona
- [ ] ARIA labels presentes
- [ ] Focus indicators visibles
- [ ] Screen reader compatible

### Tests
- [ ] Unit tests para validación
- [ ] Component tests pasando
- [ ] Accessibility tests pasando

---

## 🚀 Próximos Pasos Después de Task 3

**Task 4:** Image Storage Service
- Integración con Supabase Storage
- Optimización con Sharp
- Upload real de imágenes
- Generación de thumbnails

**Task 5:** Update Product APIs
- Modificar POST /api/admin/products
- Modificar PUT /api/admin/products/[id]
- Agregar DELETE para imágenes
- Cache invalidation

---

## 📊 Progreso General

**Completado:** 2/10 tareas (20%)  
**En Progreso:** Task 3 - Image Upload Component  
**Tiempo Estimado:** 1.5 días para Task 3

---

**Última Actualización:** 27 Enero 2026  
**Próxima Acción:** Implementar ImageUpload component

