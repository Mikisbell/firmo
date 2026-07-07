# 🔴 AUDITORÍA CRÍTICA — FIRMO POS

> **Fecha:** Enero 2026  
> **Última actualización:** 6 de Enero 2026  
> **Tipo:** Revisión de código real vs documentación  
> **Veredicto:** Sistema con bases sólidas, **P0 completado**, pendientes P1

---

## 🚨 RESUMEN EJECUTIVO

Después de revisar el código real y comparar con MASTER.md:

| Categoría | Estado | Riesgo |
|-----------|--------|--------|
| Event Sourcing básico | ✅ Funcional | Bajo |
| Sync Client | ✅ Completo | Bajo |
| Server Projections | ✅ Implementado | Bajo |
| Validaciones | ✅ Implementado | Bajo |
| Idempotencia | ✅ Implementado | Bajo |
| Performance | ✅ Índices agregados | Bajo |

**Conclusión:** P0 completado. Sistema listo para piloto controlado.

---

## ✅ PROBLEMAS RESUELTOS (P0 Completado)

### ~~PROBLEMA 1: Proyecciones Server-Side NO son Idempotentes~~ ✅ RESUELTO

**Solución implementada:**
- Tabla `processed_events` creada
- `projectEvent()` verifica duplicados ANTES de proyectar
- Ver: `src/app/api/events/ingest/route.ts`

---

### ~~PROBLEMA 2: CERO Validación de Reglas de Negocio~~ ✅ RESUELTO

**Solución implementada:**
- `validateEvent()` implementado en `src/core/validation/business-rules.ts`
- Valida: CHECK_MARKED_PAID, INVOICE_ISSUED, ORDER_ITEM_ADDED, ITEM_VOIDED
- Ver: `docs/02-architecture/MONEY_SAFETY.md` Solución 4

---

### ~~PROBLEMA 3: Order Number Collision Garantizada~~ ✅ RESUELTO

**Solución implementada:**
- Tabla `terminal_number_ranges` creada
- Range Allocation implementado en `src/core/order-numbers/range-allocator.ts`
- API: `src/app/api/terminals/range/route.ts`
- Ver: `docs/02-architecture/MONEY_SAFETY.md` Solución 3

---

### ~~PROBLEMA 4: Outbox Pattern NO Implementado~~ ✅ RESUELTO

**Solución implementada:**
- Tabla `event_outbox` creada
- Worker de publicación en `src/core/workers/outbox-publisher.ts`
- Ver: `docs/02-architecture/OUTBOX_PATTERN.md`

---

## 🟡 PROBLEMAS PENDIENTES (P1)

### PROBLEMA 5: Sale Reducer Muta Estado Directamente

**Código actual (sale.reducer.ts):**
```typescript
case "ORDER_ITEM_ADDED": {
  sale.lines[line_id] = { ... };        // ❌ Mutación directa
  sale.subtotal_cents = computeSubtotal(sale.lines);
  return { state: sale, warnings };
}
```

**Estado:** Pendiente para P1  
**Impacto:** Bugs sutiles con React, dificulta debugging  
**Solución:** Refactorizar con spread operators (ver spec enterprise-upgrade)

---

### PROBLEMA 6: Sync Client Hardcodea tenant_id

**Código actual (client.ts línea 91):**
```typescript
const tenantId = "00000000-0000-0000-0000-000000000001"; // ❌ HARDCODED
```

**Estado:** Pendiente para P1  
**Impacto:** Multi-tenant limitado  
**Solución:** Obtener de TerminalConfig en IndexedDB

---

### PROBLEMA 7: API Secret Hardcodeado en Cliente

**Código actual (client.ts línea 175):**
```typescript
"x-api-secret": "park_secret_mvp_2025" // ❌ EXPUESTO EN BROWSER
```

**Estado:** Pendiente para P1  
**Impacto:** Seguridad básica  
**Solución:** Device Token (ver spec enterprise-upgrade)

---

### ~~PROBLEMA 8: Sin Índices Críticos en PostgreSQL~~ ✅ RESUELTO

**Solución implementada:**
- Migración `20260106_performance_indices` aplicada
- Índices para sync queries y órdenes activas
- Ver: `prisma/migrations/20260106_performance_indices/`

---

### ~~PROBLEMA 9: Timezone NO Manejado~~ ✅ RESUELTO

**Solución implementada:**
- `getBusinessDate()` en `src/core/utils/business-date.ts`
- Hora de corte 6AM configurada
- Ver: `docs/02-architecture/MONEY_SAFETY.md` Solución 5

---

### ~~PROBLEMA 10: Sin Límites de Tamaño~~ ✅ RESUELTO

**Solución implementada:**
- Constantes en `src/core/constants/limits.ts`
- Validación cliente en `src/core/validation/client-validation.ts`
- MAX_ITEMS = 50, MAX_TOTAL = S/100,000

---

## 📊 MATRIZ DE ESTADO ACTUALIZADA

| # | Problema | Estado | Fase |
|---|----------|--------|------|
| 1 | Proyecciones no idempotentes | ✅ Resuelto | P0 |
| 2 | Sin validación de negocio | ✅ Resuelto | P0 |
| 3 | Order number collision | ✅ Resuelto | P0 |
| 4 | Sin Outbox Pattern | ✅ Resuelto | P0 |
| 5 | Reducer muta estado | ⏳ Pendiente | P1 |
| 6 | tenant_id hardcoded | ⏳ Pendiente | P1 |
| 7 | API secret expuesto | ⏳ Pendiente | P1 |
| 8 | Sin índices críticos | ✅ Resuelto | P0 |
| 9 | Timezone no manejado | ✅ Resuelto | P0 |
| 10 | Sin límites de tamaño | ✅ Resuelto | P0 |

---

## 🎯 PRÓXIMOS PASOS (P1)

Ver `.kiro/specs/enterprise-upgrade/tasks.md` para el plan completo:

1. **Clock Skew Handling** - Agregar `occurred_at_server`
2. **Device Token** - Reemplazar API secret
3. **Tenant ID Dinámico** - Eliminar hardcode
4. **Reducer Inmutable** - Refactorizar sale.reducer.ts
5. **Conflict Resolution** - UI para resolver conflictos
6. **Snapshots** - Performance con órdenes grandes
7. **Event Schema Versioning** - Evolución de eventos
8. **Observabilidad** - Métricas y dashboard

---

**Última actualización:** 6 de Enero 2026  
**Estado P0:** ✅ Completado  
**Estado P1:** ⏳ En planificación
