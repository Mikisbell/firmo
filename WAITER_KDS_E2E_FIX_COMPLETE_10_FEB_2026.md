# Fix Completo: Tests E2E Mesero → KDS

**Fecha:** 10 Febrero 2026  
**Status:** ⚠️ EN PROGRESO - Requiere seed de datos

## 🔧 Cambios Implementados

### 1. Agregado data-testid a Productos
**Archivo:** `src/app/pos/components/CatalogGrid.tsx`

```typescript
<motion.button
    data-testid={`product-${p.id}`}  // ← NUEVO
    onClick={() => shiftOpen ? onAdd(p) : alert("Abre un turno para vender")}
    // ... resto del código
>
```

**Beneficio:** Permite seleccionar productos de forma confiable sin depender de nombres específicos.

### 2. Refactorizado Tests para Usar Selectores Robustos
**Archivo:** `e2e/waiter-to-kds.spec.ts`

**Antes:**
```typescript
const polloButton = page.locator('button:has-text("Pollo")').first();
if (await polloButton.isVisible()) {
    await polloButton.click();
}
```

**Después:**
```typescript
await page.waitForSelector('[data-testid^="product-"]', { timeout: 10000 });
const productButtons = page.locator('[data-testid^="product-"]');
await productButtons.nth(0).click();
```

**Beneficios:**
- No depende de nombres específicos de productos
- Usa cualquier producto disponible en el catálogo
- Más resiliente a cambios en el catálogo

## 🔴 Problema Actual: No Hay Productos en Catálogo

Los tests ahora fallan porque:
1. La API `/api/catalog/latest` no retorna productos
2. El catálogo está vacío en la base de datos de test
3. Sin productos, no se pueden agregar items al pedido

### Error Específico
```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
- waiting for locator('[data-testid^="product-"]') to be visible
```

## 🎯 Solución Requerida: Seed de Datos E2E

Necesitamos crear un seed script que garantice productos para tests E2E.

### Opción 1: Seed Script Dedicado (RECOMENDADO)
Crear `scripts/seed-e2e-catalog.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const E2E_PRODUCTS = [
  {
    id: 'e2e-pollo-entero',
    sku: 'POLLO-001',
    name: 'Pollo a la Brasa Entero',
    price_cents: 3500,
    station: 'PARRILLA',
    category: 'POLLOS',
    is_active: true,
  },
  {
    id: 'e2e-papas-fritas',
    sku: 'GUARN-001',
    name: 'Papas Fritas',
    price_cents: 800,
    station: 'COCINA',
    category: 'GUARNICIONES',
    is_active: true,
  },
  {
    id: 'e2e-gaseosa',
    sku: 'BEB-001',
    name: 'Gaseosa 1.5L',
    price_cents: 500,
    station: 'BAR',
    category: 'BEBIDAS',
    is_active: true,
  },
];

async function seedE2ECatalog() {
  console.log('🌱 Seeding E2E catalog...');
  
  for (const product of E2E_PRODUCTS) {
    await prisma.catalog_item.upsert({
      where: { id: product.id },
      update: product,
      create: {
        ...product,
        tenant_id: '00000000-0000-0000-0000-000000000001',
        version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }
  
  console.log('✅ E2E catalog seeded');
}

seedE2ECatalog()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Opción 2: Modificar beforeEach en Tests
Agregar seed de productos en el setup de cada test:

```typescript
test.beforeEach(async ({ page, context }) => {
    // ... existing setup ...
    
    // Seed products via API
    await page.evaluate(async () => {
        const products = [
            { id: 'e2e-1', name: 'Pollo', price: 3500, station: 'PARRILLA' },
            { id: 'e2e-2', name: 'Papas', price: 800, station: 'COCINA' },
            { id: 'e2e-3', name: 'Gaseosa', price: 500, station: 'BAR' },
        ];
        
        // Store in IndexedDB for offline access
        const db = await indexedDB.open('park-pos', 1);
        // ... store products ...
    });
});
```

### Opción 3: Mock de API en Tests
Interceptar la llamada a `/api/catalog/latest`:

```typescript
await page.route('/api/catalog/latest', async route => {
    await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            items: [
                { id: 'e2e-1', name: 'Pollo', price_cents: 3500, station: 'PARRILLA' },
                { id: 'e2e-2', name: 'Papas', price_cents: 800, station: 'COCINA' },
                { id: 'e2e-3', name: 'Gaseosa', price_cents: 500, station: 'BAR' },
            ],
        }),
    });
});
```

## 📊 Estado de Tests

| Test | Status Anterior | Status Actual | Bloqueador |
|------|----------------|---------------|------------|
| waiter creates order | ❌ Botón disabled | ⚠️ No hay productos | Seed |
| KDS change status | ❌ Botón disabled | ⚠️ No hay productos | Seed |
| multiple waiters | ❌ Botón disabled | ⚠️ No hay productos | Seed |
| items remain visible | ❌ Botón disabled | ⚠️ No hay productos | Seed |
| no items cannot submit | ✅ PASA | ✅ PASA | - |

## 🎬 Próximos Pasos

1. **Inmediato:** Crear seed script E2E o usar mock de API
2. **Verificar:** Ejecutar tests nuevamente
3. **Validar:** Confirmar que flujo Mesero → KDS funciona end-to-end

## 📝 Archivos Modificados

1. ✅ `src/app/pos/components/CatalogGrid.tsx` - Agregado data-testid
2. ✅ `e2e/waiter-to-kds.spec.ts` - Refactorizado selectores
3. ⏳ `scripts/seed-e2e-catalog.ts` - PENDIENTE (crear)

## 💡 Recomendación

**Usar Opción 3 (Mock de API)** por ser:
- Más rápido de implementar
- No requiere cambios en base de datos
- Aislado y predecible
- Fácil de mantener

---

**Prioridad:** 🔴 ALTA  
**Impacto:** 🟡 MEDIO - Tests bloqueados pero funcionalidad existe  
**Esfuerzo:** 🟢 BAJO - 30 minutos adicionales
