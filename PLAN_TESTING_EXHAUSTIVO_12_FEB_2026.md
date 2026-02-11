# Plan de Testing Exhaustivo - 12 Febrero 2026

## Objetivo

Ejecutar una batería completa de tests antes de continuar con Task 18, incluyendo:
1. Tests unitarios (Vitest)
2. Tests de integración
3. Tests E2E (Playwright)
4. Verificación de TypeScript
5. Build completo

## Plan de Ejecución

### Fase 1: Verificación de TypeScript ✅

**Comando:**
```bash
npx tsc --noEmit
```

**Objetivo:** Asegurar que no hay errores de tipos en todo el proyecto.

**Criterio de éxito:** 0 errores de TypeScript

---

### Fase 2: Tests Unitarios (Vitest)

**Comando:**
```bash
npm test
```

**Alcance:**
- Tests de observabilidad (logger, error-tracker, metrics)
- Tests de cache (cache-service)
- Tests de recovery (recovery-service)
- Tests de alerts (alert-config, alert-notifier)
- Tests de health check
- Tests de log-config
- Tests de OpenAPI/Postman
- Tests de performance (pagination, slow-query-logging)
- Tests de web vitals
- Tests de lazy loading

**Criterio de éxito:** Todos los tests unitarios pasando

---

### Fase 3: Tests E2E Críticos (Playwright)

#### 3.1 Multi-Tenant RLS Isolation

**Comando:**
```bash
npx playwright test e2e/multi-tenant-rls-isolation.spec.ts
```

**Alcance:**
- 19 tests de aislamiento RLS
- Verificación de tenant isolation
- APIs de admin (employees, products, analytics, settings)

**Criterio de éxito:** 19/19 tests pasando

#### 3.2 Waiter → KDS Flow

**Comando:**
```bash
npx playwright test e2e/waiter-to-kds.spec.ts
```

**Alcance:**
- 5 tests de flujo mesero → cocina
- Verificación de order submission
- Status changes en KDS

**Criterio de éxito:** 4/5 tests pasando (1 skipped con justificación)

#### 3.3 Admin Panel CRUD

**Comando:**
```bash
npx playwright test e2e/04-admin-employees-crud.spec.ts
npx playwright test e2e/05-admin-products-crud.spec.ts
npx playwright test e2e/06-admin-drivers-crud.spec.ts
npx playwright test e2e/07-admin-promotions-crud.spec.ts
```

**Alcance:**
- CRUD de empleados
- CRUD de productos
- CRUD de drivers
- CRUD de promociones

**Criterio de éxito:** Todos los tests CRUD pasando

#### 3.4 Sale Flow

**Comando:**
```bash
npx playwright test e2e/01-sale-flow.spec.ts
```

**Alcance:**
- Flujo completo de venta
- Caja → Pago → Factura

**Criterio de éxito:** Tests de sale flow pasando

---

### Fase 4: Build Completo

**Comando:**
```bash
npm run build
```

**Objetivo:** Verificar que el build de producción se genera correctamente.

**Criterio de éxito:** Build exitoso, 154 páginas generadas

---

## Orden de Ejecución

1. **TypeScript Diagnostics** (más rápido, ~10s)
2. **Tests Unitarios** (medio, ~2-5 min)
3. **Tests E2E Multi-Tenant** (crítico, ~3-5 min)
4. **Tests E2E Waiter-KDS** (crítico, ~2-3 min)
5. **Tests E2E Admin CRUD** (importante, ~5-10 min)
6. **Tests E2E Sale Flow** (importante, ~2-3 min)
7. **Build Completo** (verificación final, ~30s)

**Tiempo total estimado:** 15-30 minutos

---

## Criterios de Éxito Global

Para considerar el sistema listo para continuar:

- ✅ 0 errores de TypeScript
- ✅ 100% tests unitarios pasando
- ✅ 19/19 tests E2E Multi-Tenant pasando
- ✅ 4/5 tests E2E Waiter-KDS pasando (1 skipped justificado)
- ✅ 100% tests E2E Admin CRUD pasando
- ✅ 100% tests E2E Sale Flow pasando
- ✅ Build de producción exitoso

---

## Manejo de Fallos

### Si fallan tests unitarios:
1. Identificar el test que falla
2. Analizar el error
3. Corregir el código
4. Re-ejecutar tests
5. NO continuar hasta que todos pasen

### Si fallan tests E2E:
1. Revisar el trace de Playwright
2. Identificar el selector o timing issue
3. Corregir el test o el código
4. Re-ejecutar tests
5. NO continuar hasta que todos pasen

### Si falla el build:
1. Revisar errores de compilación
2. Corregir errores de TypeScript
3. Regenerar cliente de Prisma si es necesario
4. Re-ejecutar build
5. NO continuar hasta que pase

---

## Documentación de Resultados

Después de cada fase, documentar:
- ✅ Tests ejecutados
- ✅ Tests pasando / total
- ✅ Tiempo de ejecución
- ✅ Errores encontrados (si aplica)
- ✅ Correcciones aplicadas (si aplica)

---

## Próximos Pasos Después del Testing

Si todos los tests pasan:
1. Marcar Task 18 como completada
2. Actualizar `.kiro/specs/system-consolidation-phase1/tasks.md`
3. Continuar con Phase 5: Integration and Deployment

Si hay fallos:
1. Documentar los fallos
2. Crear plan de corrección
3. Aplicar correcciones
4. Re-ejecutar tests
5. NO continuar hasta que todo pase

---

**Fecha:** 12 Febrero 2026  
**Autor:** Kiro AI  
**Estado:** 📋 PLAN CREADO - Listo para ejecución
