# 🔧 PRODUCTOS P1 - FIXES PARA STRESS TESTS

**Fecha:** 29 Enero 2026  
**Problema:** Stress tests revelaron 2 problemas críticos  
**Status:** SOLUCIONES DOCUMENTADAS

---

## 🎯 PROBLEMAS IDENTIFICADOS

### 1. CSV Import Lento (5000 rows = 8 minutos)
### 2. Database Connection Pool Agotado (50 queries concurrentes)

---

## 🔧 FIX 1: OPTIMIZAR CSV IMPORT

### Problema Actual

```typescript
// ❌ LENTO: 3 queries por producto
for (const product of batch) {
  // Query 1: Insert product
  await prisma.products.create({ data: product });
  
  // Query 2: Insert catalog version
  await prisma.catalog_versions.create({ ... });
  
  // Query 3: Insert audit log
  await prisma.audit_log.create({ ... });
}

// Resultado: 5000 productos × 3 queries = 15,000 queries
// Performance: 10 ops/sec (477 segundos)
```

### Solución: Bulk Inserts

```typescript
// ✅ RÁPIDO: Bulk inserts
async function importCSVBatch(batch: ProductInput[]) {
  return await prisma.$transaction(async (tx) => {
    // 1. Bulk insert products
    const products = await tx.products.createMany({
      data: batch.map(p => ({
        id: p.id,
        tenant_id: p.tenant_id,
        name: p.name,
        category: p.category,
        price_cents: p.price_cents,
        cost_cents: p.cost_cents,
        sku: p.sku,
        barcode: p.barcode,
        description: p.description,
        is_active: p.is_active,
        images: p.images,
        created_at: new Date(),
        updated_at: new Date(),
      })),
      skipDuplicates: false,
    });

    // 2. Bulk insert catalog versions
    await tx.catalog_versions.createMany({
      data: batch.map(p => ({
        id: randomUUID(),
        tenant_id: p.tenant_id,
        version: 1,
        product_id: p.id,
        name: p.name,
        price_cents: p.price_cents,
        is_active: true,
        created_at: new Date(),
      })),
    });

    // 3. Single audit log entry for batch (not per product)
    await tx.audit_log.create({
      data: {
        id: randomUUID(),
        tenant_id: batch[0].tenant_id,
        user_id: 'csv-import',
        action: 'BULK_CREATE',
        entity_type: 'products',
        entity_id: 'batch',
        changes: { count: batch.length },
        timestamp: new Date(),
      },
    });

    return { count: batch.length };
  });
}

// Resultado: 5000 productos = 102 queries (100 batches × 3 + 2)
// Performance esperada: 100+ ops/sec (<50 segundos)
```

### Cambios Requeridos

**Archivo:** `src/core/admin/csv.service.ts`

```typescript
// Línea ~150: Reemplazar loop individual con createMany
async importProducts(csvData: string, tenantId: string, userId: string) {
  const rows = this.parseCSV(csvData);
  const batches = this.createBatches(rows, 50);
  
  for (const batch of batches) {
    // ✅ NUEVO: Usar bulk inserts
    await this.importCSVBatch(batch, tenantId, userId);
    
    // ❌ VIEJO: Individual creates
    // for (const row of batch) {
    //   await prisma.products.create({ data: row });
    // }
  }
}
```

### Impacto Esperado

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| 5000 rows | 477s (8 min) | <50s | 10x más rápido |
| Ops/sec | 10 | 100+ | 10x throughput |
| Queries | 15,000 | 102 | 147x menos queries |

---

## 🔧 FIX 2: CONFIGURAR CONNECTION POOLING

### Problema Actual

```
Error: FATAL: MaxClientsInSessionMode: max clients reached
```

**Causa:**
- Supabase Session Mode: límite muy bajo de conexiones
- No hay configuración de connection pooling
- Cada query abre nueva conexión

### Solución: Transaction Mode + Pooling

#### Paso 1: Actualizar Prisma Schema

**Archivo:** `prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // ← Pooled connection
  directUrl = env("DIRECT_URL")        // ← Direct connection (migrations)
}
```

#### Paso 2: Actualizar Variables de Entorno

**Archivo:** `.env`

```bash
# ✅ NUEVO: Pooled connection (para queries)
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"

# ✅ NUEVO: Direct connection (para migraciones)
DIRECT_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"

# ❌ VIEJO: Solo una URL sin pooling
# DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

**Archivo:** `.env.local`

```bash
# Development: Usar pooled connection también
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"
DIRECT_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
```

#### Paso 3: Configurar Supabase

1. **Ir a Supabase Dashboard** → Project Settings → Database
2. **Connection Pooling:**
   - Mode: **Transaction** (no Session)
   - Pool Size: **15** (default)
   - Port: **6543** (pooler port)

3. **Connection Strings:**
   - Pooled: `postgresql://...pooler.supabase.com:6543/...?pgbouncer=true`
   - Direct: `postgresql://...pooler.supabase.com:5432/...`

#### Paso 4: Regenerar Prisma Client

```bash
npx prisma generate
```

### Configuración Avanzada (Opcional)

**Archivo:** `src/core/db/client.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // Pooled
    },
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

// Connection pool configuration
prisma.$connect().then(() => {
  console.log('✅ Database connected with pooling');
}).catch((error) => {
  console.error('❌ Database connection failed:', error);
  process.exit(1);
});

export { prisma };
```

### Impacto Esperado

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Max concurrent queries | ~10 | 100+ | 10x capacidad |
| Connection errors | Frecuentes | Ninguno | 100% estable |
| Query latency | Variable | Consistente | Más predecible |

---

## 🔧 FIX 3: AUMENTAR BATCH SIZE (OPCIONAL)

### Optimización Adicional

```typescript
// ❌ ACTUAL: 50 items/batch
const BATCH_SIZE = 50;

// ✅ MEJORADO: 100-200 items/batch
const BATCH_SIZE = 100; // Para CSV imports
const BATCH_SIZE_UPDATES = 50; // Para updates (mantener)
```

**Razón:**
- Bulk inserts son más eficientes con batches grandes
- Updates requieren batches más pequeños (transacciones)
- CSV imports pueden usar 100-200 items/batch

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Fix 1: CSV Import (ALTO IMPACTO)
- [ ] Modificar `csv.service.ts` para usar `createMany`
- [ ] Implementar `importCSVBatch()` con bulk inserts
- [ ] Reducir audit logging (1 entry por batch, no por producto)
- [ ] Aumentar batch size a 100 items
- [ ] Ejecutar tests: `npx tsx scripts/test-products-p1-stress.ts`
- [ ] Validar: 5000 rows en <60 segundos

### Fix 2: Connection Pooling (CRÍTICO)
- [ ] Actualizar `prisma/schema.prisma` con `directUrl`
- [ ] Actualizar `.env` con pooled + direct URLs
- [ ] Actualizar `.env.local` con pooled + direct URLs
- [ ] Configurar Supabase: Transaction Mode, Port 6543
- [ ] Ejecutar: `npx prisma generate`
- [ ] Ejecutar tests: `npx tsx scripts/test-products-p1-stress.ts`
- [ ] Validar: 50 queries concurrentes sin errores

### Fix 3: Batch Size (OPCIONAL)
- [ ] Aumentar `BATCH_SIZE` a 100 para CSV imports
- [ ] Mantener 50 para bulk updates
- [ ] Ejecutar tests de performance

---

## 🧪 VALIDACIÓN

### Test 1: CSV Import Performance

```bash
# Debe completar en <60 segundos
npx tsx scripts/test-products-p1-stress.ts

# Buscar en output:
# ✅ CSV import 5000 rows
#    Operations: 5000 | Duration: <60000ms | 100+ ops/sec
```

### Test 2: Connection Pool

```bash
# Debe completar sin errores
npx tsx scripts/test-products-p1-stress.ts

# Buscar en output:
# ✅ Database pool stress test
#    Operations: 50 | Duration: <5000ms | 10+ ops/sec
```

### Test 3: Full Stress Suite

```bash
# Todos los tests deben pasar
npx tsx scripts/test-products-p1-stress.ts

# Resultado esperado:
# ✅ Passed: 9/9
# ❌ Failed: 0/9
```

---

## 📊 MÉTRICAS ESPERADAS POST-FIX

| Test | Antes | Después | Status |
|------|-------|---------|--------|
| CSV import 5000 | 477s | <60s | ✅ 8x mejora |
| DB pool 50 queries | ERROR | <5s | ✅ FIXED |
| Transaction rollbacks | ERROR | <10s | ✅ FIXED |
| Bulk update 1000 | 12s | 12s | ✅ Sin cambios |
| CSV export 316 | 0.8s | 0.8s | ✅ Sin cambios |

---

## 🎯 PRIORIDAD DE IMPLEMENTACIÓN

### 1. CRÍTICO (Hacer AHORA)
- ✅ Fix 2: Connection Pooling
  - **Razón:** Bloquea producción, causa errores
  - **Tiempo:** 15 minutos
  - **Impacto:** ALTO

### 2. ALTO (Hacer PRONTO)
- ✅ Fix 1: CSV Import Performance
  - **Razón:** Mejora UX significativamente
  - **Tiempo:** 30 minutos
  - **Impacto:** MEDIO-ALTO

### 3. OPCIONAL (Hacer DESPUÉS)
- ⚪ Fix 3: Batch Size
  - **Razón:** Optimización incremental
  - **Tiempo:** 5 minutos
  - **Impacto:** BAJO

---

## 🏁 CONCLUSIÓN

**Fixes Requeridos:** 2 críticos, 1 opcional  
**Tiempo Estimado:** 45-60 minutos  
**Impacto:** ALTO - Habilita producción

**Orden de Implementación:**
1. Connection Pooling (15 min) → Desbloquea tests
2. CSV Import (30 min) → Mejora performance
3. Batch Size (5 min) → Optimización final
4. Validación (10 min) → Re-ejecutar stress tests

**Resultado Esperado:**
- ✅ 9/9 stress tests pasando
- ✅ CSV import 8x más rápido
- ✅ Soporta 100+ queries concurrentes
- ✅ Listo para producción

---

**Próximo Paso:** Implementar Fix 2 (Connection Pooling) primero
