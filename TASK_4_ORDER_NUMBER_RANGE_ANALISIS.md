# Tarea 4: Order Number Range Service - Análisis

**Fecha:** 12 Febrero 2026  
**Estado:** ⚠️ PARCIALMENTE IMPLEMENTADO - Requiere integración

---

## 📊 Análisis de Implementación Actual

### Requirement 4.1: Tabla terminal_number_ranges ✅

**Schema Prisma:**
```prisma
model terminal_number_ranges {
  terminal_id    String    @id
  tenant_id      String    @db.Uuid
  range_start    Int
  range_end      Int
  current_number Int
  allocated_at   DateTime? @db.Timestamptz(6)
  exhausted_at   DateTime? @db.Timestamptz(6)
}
```

**Verificación:**
- ✅ Tabla existe con PK en terminal_id
- ✅ Campos range_start, range_end, current_number
- ✅ Campo tenant_id para multi-tenancy
- ⚠️ **FALTA:** PK compuesto (tenant_id, terminal_id) - actualmente solo terminal_id

**Conclusión:** ✅ **IMPLEMENTADO** (con mejora menor pendiente)

---

### Requirement 4.2: Función assignRange() con SELECT FOR UPDATE ❌

**Código Actual:**
```typescript
export async function allocateRange(
    prisma: PrismaClient,
    tenantId: string,
    terminalId: string
): Promise<NumberRange> {
    // Buscar si ya tiene rango asignado
    const existing = await prisma.terminal_number_ranges.findUnique({
        where: { terminal_id: terminalId }
    });

    if (existing) {
        return {
            terminal_id: existing.terminal_id,
            range_start: existing.range_start,
            range_end: existing.range_end,
            current_number: existing.current_number,
        };
    }

    // Buscar el último rango asignado para este tenant
    const lastRange = await prisma.terminal_number_ranges.findFirst({
        where: { tenant_id: tenantId },
        orderBy: { range_end: 'desc' }
    });

    const rangeStart = (lastRange?.range_end ?? 0) + 1;
    const rangeEnd = rangeStart + RANGE_SIZE - 1;

    // Crear nuevo rango
    const newRange = await prisma.terminal_number_ranges.create({
        data: {
            terminal_id: terminalId,
            tenant_id: tenantId,
            range_start: rangeStart,
            range_end: rangeEnd,
            current_number: rangeStart,
        }
    });

    return {
        terminal_id: newRange.terminal_id,
        range_start: newRange.range_start,
        range_end: newRange.range_end,
        current_number: newRange.current_number,
    };
}
```

**Problemas:**
- ❌ **NO usa SELECT FOR UPDATE** - puede haber race condition
- ❌ **NO está en transacción** - puede asignar rangos duplicados
- ❌ **NO usa lock** - múltiples terminales pueden obtener el mismo rango

**Conclusión:** ❌ **NO IMPLEMENTADO CORRECTAMENTE** - Requiere SELECT FOR UPDATE

---

### Requirement 4.3: Validación de order_number en rango asignado ❌

**Búsqueda en código:**
- ❌ No hay validación de order_number en `validateEvent()`
- ❌ No hay validación de order_number en `validateOrderItemAdded()`
- ❌ No hay validación de order_number en ningún lugar del ingest

**Conclusión:** ❌ **NO IMPLEMENTADO** - Falta validación completa

---

### Requirement 4.4: Buffer de números pre-asignados (100 números) ⚠️

**Código Actual:**
```typescript
const RANGE_SIZE = 10000; // 10,000 números por terminal
```

**Análisis:**
- ✅ Hay buffer de números (10,000 por terminal)
- ⚠️ **PROBLEMA:** Buffer es de 10,000, no 100 como especifica el requirement
- ⚠️ **PROBLEMA:** No hay pre-asignación, se asigna todo el rango de una vez

**Conclusión:** ⚠️ **PARCIALMENTE IMPLEMENTADO** - Buffer existe pero no cumple spec

---

### Requirement 4.5: Endpoint API para asignar rangos ✅

**Código Actual:**
```typescript
// GET /api/terminals/range?terminal_id=xxx&tenant_id=xxx
export async function GET(req: Request) {
    const range = await prisma.terminal_number_ranges.findUnique({
        where: { terminal_id: terminalId }
    });
    // ...
}

// POST /api/terminals/range
// Body: { terminal_id, tenant_id, action: "allocate" | "extend" }
export async function POST(req: Request) {
    if (action === "extend") {
        range = await extendRange(prisma, tenant_id, terminal_id);
    } else {
        range = await allocateRange(prisma, tenant_id, terminal_id);
    }
    // ...
}
```

**Verificación:**
- ✅ Endpoint GET para consultar rango
- ✅ Endpoint POST para asignar/extender rango
- ✅ Función `needsNewRange()` para detectar agotamiento
- ✅ Función `extendRange()` para extender rango

**Conclusión:** ✅ **IMPLEMENTADO CORRECTAMENTE**

---

## 🔴 Problemas Críticos Identificados

### 1. Race Condition en Asignación de Rangos ❌

**Problema:**
```typescript
// Terminal A y Terminal B solicitan rango al mismo tiempo
const lastRange = await prisma.terminal_number_ranges.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { range_end: 'desc' }
});

// Ambos obtienen el mismo lastRange
// Ambos calculan el mismo rangeStart
// Ambos crean rangos duplicados
```

**Impacto:** 🔴 **CRÍTICO** - Puede causar colisiones de order_number

**Solución Requerida:**
```typescript
await prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE para lock
    const lastRange = await tx.$queryRaw`
        SELECT * FROM terminal_number_ranges
        WHERE tenant_id = ${tenantId}
        ORDER BY range_end DESC
        LIMIT 1
        FOR UPDATE
    `;
    
    // Calcular y crear nuevo rango
    // ...
});
```

### 2. No Hay Validación de order_number en Ingest ❌

**Problema:**
- Terminal puede enviar order_number fuera de su rango
- No hay validación en `validateEvent()`
- No hay validación en `validateOrderItemAdded()`

**Impacto:** 🔴 **CRÍTICO** - Test 25 fallará

**Solución Requerida:**
```typescript
async function validateOrderCreated(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_number: number;
    };

    // Obtener rango del terminal
    const range = await tx.terminal_number_ranges.findUnique({
        where: { terminal_id: event.terminal_id }
    });

    if (!range) {
        return { 
            valid: false, 
            error: "NO_RANGE_ALLOCATED",
            details: { terminal_id: event.terminal_id }
        };
    }

    // Validar que order_number esté en el rango
    if (payload.order_number < range.range_start || 
        payload.order_number > range.range_end) {
        return {
            valid: false,
            error: "ORDER_NUMBER_OUT_OF_RANGE",
            details: {
                order_number: payload.order_number,
                range_start: range.range_start,
                range_end: range.range_end,
                terminal_id: event.terminal_id
            }
        };
    }

    return { valid: true };
}
```

### 3. PK No Incluye tenant_id ⚠️

**Problema:**
```prisma
model terminal_number_ranges {
  terminal_id    String    @id  // ← Solo terminal_id
  tenant_id      String    @db.Uuid
  // ...
}
```

**Impacto:** 🟡 **MEDIO** - Puede causar conflictos entre tenants

**Solución Requerida:**
```prisma
model terminal_number_ranges {
  terminal_id    String
  tenant_id      String    @db.Uuid
  // ...
  
  @@id([tenant_id, terminal_id])  // ← PK compuesto
}
```

---

## ✅ Verificación de Requirements

| Requirement | Estado | Implementación |
|-------------|--------|----------------|
| 4.1 - Tabla terminal_number_ranges | ⚠️ | Existe pero PK incompleto |
| 4.2 - assignRange() con SELECT FOR UPDATE | ❌ | No usa lock |
| 4.3 - Validación de order_number | ❌ | No implementada |
| 4.4 - Buffer de 100 números | ⚠️ | Buffer de 10,000 (no 100) |
| 4.5 - Endpoint API | ✅ | Implementado |
| 4.6 - Asignación única | ❌ | Race condition posible |
| 4.8 - Extensión de rango | ✅ | Implementado |

---

## 📝 Cambios Requeridos

### 1. Agregar SELECT FOR UPDATE en allocateRange()

**Archivo:** `src/core/order-numbers/range-allocator.ts`

**Cambio:**
```typescript
export async function allocateRange(
    prisma: PrismaClient,
    tenantId: string,
    terminalId: string
): Promise<NumberRange> {
    return await prisma.$transaction(async (tx) => {
        // Buscar si ya tiene rango asignado
        const existing = await tx.terminal_number_ranges.findUnique({
            where: { terminal_id: terminalId }
        });

        if (existing) {
            return {
                terminal_id: existing.terminal_id,
                range_start: existing.range_start,
                range_end: existing.range_end,
                current_number: existing.current_number,
            };
        }

        // SELECT FOR UPDATE para lock
        const lastRange = await tx.$queryRaw<Array<{
            range_end: number;
        }>>`
            SELECT range_end
            FROM terminal_number_ranges
            WHERE tenant_id = ${tenantId}::uuid
            ORDER BY range_end DESC
            LIMIT 1
            FOR UPDATE
        `;

        const rangeStart = (lastRange[0]?.range_end ?? 0) + 1;
        const rangeEnd = rangeStart + RANGE_SIZE - 1;

        // Crear nuevo rango
        const newRange = await tx.terminal_number_ranges.create({
            data: {
                terminal_id: terminalId,
                tenant_id: tenantId,
                range_start: rangeStart,
                range_end: rangeEnd,
                current_number: rangeStart,
                allocated_at: new Date(),
            }
        });

        return {
            terminal_id: newRange.terminal_id,
            range_start: newRange.range_start,
            range_end: newRange.range_end,
            current_number: newRange.current_number,
        };
    });
}
```

### 2. Agregar Validación de order_number en validateEvent()

**Archivo:** `src/core/validation/business-rules.ts`

**Cambio:**
```typescript
export async function validateEvent(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    // ... validaciones existentes ...

    switch (event.event_type) {
        case "ORDER_CREATED":
            return validateOrderCreated(tx, event);
        
        // ... otros casos ...
    }
}

async function validateOrderCreated(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_number: number;
    };

    // Obtener rango del terminal
    const range = await tx.terminal_number_ranges.findUnique({
        where: { terminal_id: event.terminal_id }
    });

    if (!range) {
        return { 
            valid: false, 
            error: "NO_RANGE_ALLOCATED",
            details: { terminal_id: event.terminal_id }
        };
    }

    // Validar que order_number esté en el rango
    if (payload.order_number < range.range_start || 
        payload.order_number > range.range_end) {
        return {
            valid: false,
            error: "ORDER_NUMBER_OUT_OF_RANGE",
            details: {
                order_number: payload.order_number,
                range_start: range.range_start,
                range_end: range.range_end,
                terminal_id: event.terminal_id
            }
        };
    }

    return { valid: true };
}
```

### 3. Migración de Prisma para PK Compuesto

**Archivo:** `prisma/migrations/YYYYMMDD_fix_terminal_ranges_pk/migration.sql`

**Cambio:**
```sql
-- Drop existing PK
ALTER TABLE terminal_number_ranges DROP CONSTRAINT terminal_number_ranges_pkey;

-- Add composite PK
ALTER TABLE terminal_number_ranges ADD PRIMARY KEY (tenant_id, terminal_id);
```

---

## 🎯 Conclusión

**Estado:** ⚠️ **PARCIALMENTE IMPLEMENTADO** (60% completo)

**Implementado:**
- ✅ Tabla terminal_number_ranges
- ✅ Funciones allocateRange(), extendRange(), needsNewRange()
- ✅ Endpoint API /api/terminals/range

**Falta Implementar:**
- ❌ SELECT FOR UPDATE en allocateRange() (race condition)
- ❌ Validación de order_number en validateEvent()
- ⚠️ PK compuesto (tenant_id, terminal_id)

**Prioridad:** 🔴 **ALTA** - Bloqueante para Test 25

**Rating:** ⭐⭐⭐ (3/5) - Funciona pero tiene race conditions

---

## 📝 Próximos Pasos

1. Implementar SELECT FOR UPDATE en allocateRange()
2. Agregar validación de order_number en validateEvent()
3. Crear migración para PK compuesto
4. Ejecutar Test 25 para verificar

---

**Última actualización:** 12 Febrero 2026  
**Verificado por:** Kiro AI  
**Status:** ⚠️ REQUIERE CAMBIOS - 3 fixes críticos pendientes
