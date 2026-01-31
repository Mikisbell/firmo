# 🚀 PLAN DE ACCIÓN: OPTIMIZAR PARA PASAR STRESS TESTS

**Fecha:** 29 Enero 2026  
**Objetivo:** Optimizar Event-Driven Architecture para pasar 9/9 stress tests  
**Status:** 📋 PLAN DEFINIDO - LISTO PARA IMPLEMENTAR

---

## 🎯 ACLARACIÓN IMPORTANTE

**NO tenemos polling obsoleto.** Ya usamos SSE (Server-Sent Events) que es la técnica moderna de 2026.

**Lo que SÍ necesitamos:**
1. ✅ Mantener SSE (ya es correcto)
2. 🔧 Optimizar Event-Driven para pasar stress tests
3. 🔧 Configurar connection pooling
4. 🔧 Implementar bulk operations

---

## 📊 ESTADO ACTUAL

### Stress Tests: 6/9 Pasando (66.7%)

| Test | Status | Problema |
|------|--------|----------|
| Bulk update 1000 | ✅ PASS | - |
| Bulk delete 1000 | ✅ PASS | - |
| CSV export 316 | ✅ PASS | - |
| CSV export filtered | ✅ PASS | - |
| Concurrent ops 10 | ✅ PASS | - |
| Memory 10k rows | ✅ PASS | - |
| **CSV import 5000** | ❌ FAIL | Muy lento (8 min) |
| **DB pool 50 queries** | ❌ FAIL | Pool agotado |
| **Transaction rollbacks** | ❌ FAIL | Pool agotado |

---

## 🎯 PLAN DE ACCIÓN (3 FASES)

### FASE 1: CONNECTION POOLING (CRÍTICO) ⏱️ 15 minutos

**Objetivo:** Resolver errores de connection pool

**Problema:**
```
Error: FATAL: MaxClientsInSessionMode: max clients reached
```

**Causa:** Event-Driven genera 4x más queries, pool se agota

**Solución:**

#### Paso 1.1: Actualizar Prisma Schema

**Archivo:** `prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // ← Pooled connection (Transaction Mode)
  directUrl = env("DIRECT_URL")        // ← Direct connection (para migraciones)
}
```

#### Paso 1.2: Actualizar Variables de Entorno

**Archivo:** `.env`

```bash
# ✅ NUEVO: Pooled connection (Transaction Mode, Port 6543)
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"

# ✅ NUEVO: Direct connection (para migraciones, Port 5432)
DIRECT_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
```

**Archivo:** `.env.local`

```bash
# Development: Usar pooled connection también
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
```

#### Paso 1.3: Configurar Supabase

1. Ir a **Supabase Dashboard** → Project Settings → Database
2. **Connection Pooling:**
   - Mode: **Transaction** (NO Session)
   - Pool Size: **20** (aumentar de 15)
   - Port: **6543** (pooler port)

#### Paso 1.4: Regenerar Prisma Client

```bash
npx prisma generate
```

#### Paso 1.5: Validar

```bash
# Re-ejecutar stress tests
npx tsx scripts/test-products-p1-stress.ts

# Buscar en output:
# ✅ Database pool stress test - PASS
# ✅ Transaction rollback stress test - PASS
```

**Resultado Esperado:**
- ✅ Tests 6 y 7 pasan
- ✅ Soporta 100+ queries concurrentes
- ✅ Sin errores de connection pool

---

### FASE 2: BULK OPERATIONS (ALTO) ⏱️ 45 minutos

**Objetivo:** Optimizar CSV import de 8 minutos a <1 minuto

**Problema:** CSV import 5000 rows toma 8 minutos (10 ops/sec)

**Causa:** Individual creates generan 4 queries por producto

```typescript
// ❌ ACTUAL: 4 queries × 5000 = 20,000 queries
for (const product of batch) {
  await prisma.products.create({ data: product });           // 1
  await prisma.catalog_versions.create({ ... });             // 2
  await prisma.audit_log.create({ ... });                    // 3
}
```

**Solución:**

#### Paso 2.1: Crear Función de Bulk Import

**Archivo:** `src/core/admin/csv.service.ts`

```typescript
/**
 * Bulk import products using createMany for performance.
 * Reduces queries from 4N to 4 (where N = batch size).
 */
async function bulkImportBatch(
  batch: ProductInput[],
  tenantId: string,
  userId: string
): Promise<{ success: number; failed: number }> {
  return await prisma.$transaction(async (tx) => {
    // 1. Bulk insert products (1 query para N productos)
    const products = await tx.products.createMany({
      data: batch.map(p => ({
        id: p.id,
        tenant_id: tenantId,
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

    // 2. Bulk insert catalog versions (1 query para N versiones)
    await tx.catalog_versions.createMany({
      data: batch.map(p => ({
        id: randomUUID(),
        tenant_id: tenantId,
        version: 1,
        product_id: p.id,
        name: p.name,
        price_cents: p.price_cents,
        is_active: true,
        created_at: new Date(),
      })),
    });

    // 3. Single audit log entry for entire batch (1 query)
    await tx.audit_log.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: userId,
        action: 'BULK_CREATE',
        entity_type: 'products',
        entity_id: 'batch',
        changes: { 
          count: batch.length,
          product_ids: batch.map(p => p.id)
        },
        timestamp: new Date(),
      },
    });

    return { success: batch.length, failed: 0 };
  });
}
```

#### Paso 2.2: Actualizar CSV Import Service

**Archivo:** `src/core/admin/csv.service.ts`

```typescript
async importProducts(
  csvData: string,
  tenantId: string,
  userId: string
): Promise<ImportResult> {
  const rows = this.parseCSV(csvData);
  const batches = this.createBatches(rows, 100); // ✅ Aumentar a 100
  
  let totalSuccess = 0;
  let totalFailed = 0;
  
  for (const batch of batches) {
    // ✅ NUEVO: Usar bulk import
    const result = await this.bulkImportBatch(batch, tenantId, userId);
    totalSuccess += result.success;
    totalFailed += result.failed;
    
    // ❌ VIEJO: Individual creates
    // for (const row of batch) {
    //   await prisma.products.create({ data: row });
    // }
  }
  
  // Invalidate cache
  await this.cacheService.invalidate('products:*');
  
  return {
    total_rows: rows.length,
    created_count: totalSuccess,
    updated_count: 0,
    skipped_count: totalFailed,
    errors: [],
  };
}
```

#### Paso 2.3: Aumentar Batch Size

**Archivo:** `src/core/admin/csv.service.ts`

```typescript
// ❌ ACTUAL: 50 items/batch
const BATCH_SIZE = 50;

// ✅ NUEVO: 100 items/batch (para CSV imports)
const CSV_IMPORT_BATCH_SIZE = 100;
const BULK_UPDATE_BATCH_SIZE = 50; // Mantener 50 para updates
```

#### Paso 2.4: Validar

```bash
# Re-ejecutar stress tests
npx tsx scripts/test-products-p1-stress.ts

# Buscar en output:
# ✅ CSV import 5000 rows
#    Operations: 5000 | Duration: <60000ms | 100+ ops/sec
```

**Resultado Esperado:**
- ✅ CSV import 5000 rows en <60 segundos (de 8 minutos)
- ✅ 100+ ops/sec (de 10 ops/sec)
- ✅ 10x mejora en performance

---

### FASE 3: VALIDACIÓN FINAL (VERIFICACIÓN) ⏱️ 10 minutos

**Objetivo:** Confirmar que todos los tests pasan

#### Paso 3.1: Re-ejecutar Stress Tests Completos

```bash
npx tsx scripts/test-products-p1-stress.ts
```

#### Paso 3.2: Verificar Resultados

**Resultado Esperado:**

```
================================================================================
📊 STRESS TEST SUMMARY
================================================================================

✅ Passed: 9/9
❌ Failed: 0/9
⏱️  Total Duration: ~120s

================================================================================
STRESS TEST METRICS
================================================================================
Test                              | Operations | Duration  | Ops/Sec | Status
--------------------------------------------------------------------------------
Bulk update 1000 products         | 1000       | 11971ms   | 84      | ✅ PASS
Bulk delete 1000 products         | 1000       | 11485ms   | 87      | ✅ PASS
CSV import 5000 rows              | 5000       | 50000ms   | 100     | ✅ PASS
CSV export 316 products           | 316        | 792ms     | 399     | ✅ PASS
CSV export with filters           | 241        | 443ms     | 544     | ✅ PASS
10 concurrent bulk updates        | 100        | 3714ms    | 27      | ✅ PASS
Memory usage for 10000 row CSV    | 10000      | 0ms       | N/A     | ✅ PASS
Database pool stress test         | 50         | 2000ms    | 25      | ✅ PASS
Transaction rollback stress test  | 50         | 5000ms    | 10      | ✅ PASS
================================================================================

✅ All stress tests passed!
```

#### Paso 3.3: Documentar Resultados

Crear documento final con:
- ✅ Métricas antes/después
- ✅ Fixes implementados
- ✅ Performance improvements
- ✅ Lecciones aprendidas

---

## 📊 MÉTRICAS ESPERADAS: ANTES vs DESPUÉS

### CSV Import (5000 rows)

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Duración | 477s (8 min) | <60s | **8x más rápido** |
| Ops/sec | 10 | 100+ | **10x throughput** |
| Queries | 20,000 | 400 | **50x menos** |
| Status | ❌ FAIL | ✅ PASS | **Fixed** |

### Database Pool (50 queries)

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Status | ❌ ERROR | ✅ PASS | **Fixed** |
| Max queries | ~10 | 100+ | **10x capacidad** |
| Pool config | Session Mode | Transaction Mode | **Correcto** |
| Connection limit | 10 | 20 | **2x más** |

### Transaction Rollbacks

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Status | ❌ ERROR | ✅ PASS | **Fixed** |
| Concurrent ops | 0 | 50 | **Funciona** |

---

## 🎯 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Connection Pooling (15 min) 🔴 CRÍTICO

- [ ] Actualizar `prisma/schema.prisma` con `directUrl`
- [ ] Actualizar `.env` con pooled + direct URLs
- [ ] Actualizar `.env.local` con pooled + direct URLs
- [ ] Configurar Supabase: Transaction Mode, Pool Size 20
- [ ] Ejecutar `npx prisma generate`
- [ ] Validar: `npx tsx scripts/test-products-p1-stress.ts`
- [ ] Confirmar: Tests 6 y 7 pasan

### Fase 2: Bulk Operations (45 min) 🟡 ALTO

- [ ] Crear función `bulkImportBatch()` en `csv.service.ts`
- [ ] Actualizar `importProducts()` para usar bulk import
- [ ] Cambiar batch size de 50 a 100 para CSV imports
- [ ] Mantener batch size 50 para bulk updates
- [ ] Validar: `npx tsx scripts/test-products-p1-stress.ts`
- [ ] Confirmar: Test 2 (CSV import) pasa en <60s

### Fase 3: Validación Final (10 min) ✅ VERIFICACIÓN

- [ ] Re-ejecutar todos los stress tests
- [ ] Confirmar: 9/9 tests pasando
- [ ] Documentar métricas antes/después
- [ ] Actualizar documentación
- [ ] Commit y push cambios

---

## 🚀 ORDEN DE EJECUCIÓN

### Día 1: Fase 1 (Connection Pooling)

**Tiempo:** 15 minutos  
**Prioridad:** 🔴 CRÍTICO

1. Actualizar Prisma schema
2. Actualizar .env files
3. Configurar Supabase
4. Regenerar Prisma client
5. Validar con stress tests

**Resultado:** Tests 6 y 7 pasan

---

### Día 1: Fase 2 (Bulk Operations)

**Tiempo:** 45 minutos  
**Prioridad:** 🟡 ALTO

1. Crear función `bulkImportBatch()`
2. Actualizar `importProducts()`
3. Ajustar batch sizes
4. Validar con stress tests

**Resultado:** Test 2 (CSV import) pasa en <60s

---

### Día 1: Fase 3 (Validación)

**Tiempo:** 10 minutos  
**Prioridad:** ✅ VERIFICACIÓN

1. Re-ejecutar todos los tests
2. Documentar resultados
3. Commit y push

**Resultado:** 9/9 tests pasando

---

## 📝 COMANDOS RÁPIDOS

### Setup Completo

```bash
# 1. Actualizar Prisma
npx prisma generate

# 2. Validar configuración
npx tsx scripts/test-products-p1-stress.ts

# 3. Ver resultados
# Buscar: "✅ Passed: 9/9"
```

### Debugging

```bash
# Ver connection pool status
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"

# Ver queries lentas
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

---

## 🎓 LECCIONES APRENDIDAS

### 1. Connection Pooling es ESENCIAL

**Lección:** Event-Driven genera 4x más queries, necesita pool configurado.

**Acción:** Siempre configurar Transaction Mode + pool size adecuado.

---

### 2. Bulk Operations para Imports Masivos

**Lección:** Individual creates no escalan (10 ops/sec).

**Acción:** Usar `createMany` para imports masivos (100+ ops/sec).

---

### 3. Stress Testing Temprano

**Lección:** Stress tests revelan problemas antes de producción.

**Acción:** Ejecutar stress tests en cada feature importante.

---

### 4. Event-Driven Requiere Optimización

**Lección:** Event-Driven es poderoso pero necesita configuración correcta.

**Acción:** Connection pooling + bulk operations + transacciones.

---

## 🏁 RESULTADO FINAL ESPERADO

### Stress Tests: 9/9 Pasando (100%)

| Test | Antes | Después | Status |
|------|-------|---------|--------|
| Bulk update 1000 | ✅ PASS | ✅ PASS | Mantenido |
| Bulk delete 1000 | ✅ PASS | ✅ PASS | Mantenido |
| CSV import 5000 | ❌ 8 min | ✅ <1 min | **Fixed** |
| CSV export 316 | ✅ PASS | ✅ PASS | Mantenido |
| CSV export filtered | ✅ PASS | ✅ PASS | Mantenido |
| Concurrent ops 10 | ✅ PASS | ✅ PASS | Mantenido |
| Memory 10k rows | ✅ PASS | ✅ PASS | Mantenido |
| DB pool 50 queries | ❌ ERROR | ✅ PASS | **Fixed** |
| Transaction rollbacks | ❌ ERROR | ✅ PASS | **Fixed** |

### Performance Improvements

- ✅ CSV import: **8x más rápido** (8 min → <1 min)
- ✅ Connection pool: **10x capacidad** (10 → 100+ queries)
- ✅ Queries: **50x menos** (20,000 → 400 para CSV import)
- ✅ Throughput: **10x mejor** (10 → 100+ ops/sec)

### Sistema Listo para Producción

- ✅ Soporta 100+ queries concurrentes
- ✅ CSV import escalable (5000+ rows en <1 min)
- ✅ Connection pooling configurado correctamente
- ✅ Event-Driven optimizado
- ✅ Todos los stress tests pasando

---

**Última Actualización:** 29 Enero 2026  
**Próximo Paso:** Implementar Fase 1 (Connection Pooling)  
**Tiempo Total Estimado:** 70 minutos (15 + 45 + 10)  
**Status:** 📋 PLAN LISTO - COMENZAR IMPLEMENTACIÓN
