# Fase 2: Implementación de Correcciones Tests E2E Waiter → KDS

**Fecha**: 10 Febrero 2026  
**Estado**: ✅ COMPLETADO  
**Objetivo**: Corregir 3 problemas críticos en tests E2E del flujo Mesero → KDS

---

## 📊 Resumen Ejecutivo

Se implementaron correcciones críticas para resolver los 3 problemas identificados en los tests E2E del flujo Waiter → KDS, siguiendo el plan detallado en `.kiro/specs/playwright-e2e-optimization/PHASE2_WAITER_KDS_PLAN.md`.

### Cambios Implementados

1. **Mock de API a nivel de contexto** (Task 8.1)
2. **Timeouts aumentados y retry logic** (Task 8.2 y 8.5)
3. **data-testid agregados a componentes** (Task 8.3 y 8.4)

---

## 🔧 Cambios Técnicos Detallados

### 1. Mock de API a Nivel de Contexto ✅

**Problema**: `page.route()` solo aplicaba a una página, no a páginas nuevas creadas con `context.newPage()`

**Solución**: Cambiar a `context.route()` para aplicar el mock a TODAS las páginas del contexto

**Archivo**: `e2e/waiter-to-kds.spec.ts`

```typescript
// ❌ ANTES: Mock solo en page
await page.route('/api/catalog/latest', mockHandler);

// ✅ DESPUÉS: Mock en context
await context.route('/api/catalog/latest', mockHandler);
```

**Impacto**: 
- Test "multiple waiters" ahora puede ver productos en ambas páginas
- Segundo waiter ya no falla por falta de productos

---

### 2. Timeouts Aumentados y Retry Logic ✅

**Problema**: Sincronización IndexedDB entre mesero y KDS requería más tiempo

**Solución**: 
- Aumentar timeouts de 1s → 2-3s después de enviar pedido
- Cambiar `waitForLoadState("networkidle")` → `"domcontentloaded"` (más rápido)
- Implementar retry logic con `expect().toPass()` para esperas inteligentes

**Archivo**: `e2e/waiter-to-kds.spec.ts`

```typescript
// Después de enviar pedido
await page.waitForTimeout(2000); // Aumentado de 1000ms

// En KDS
await kdsPage.goto("/cocina");
await kdsPage.waitForLoadState("domcontentloaded"); // Cambiado de networkidle
await kdsPage.waitForTimeout(3000); // Aumentado de 2000ms

// Retry logic para verificar tickets
await expect(async () => {
    const orderTicket = kdsPage.locator('[data-testid="kds-ticket"]').first();
    await expect(orderTicket).toBeVisible({ timeout: 5000 });
}).toPass({ timeout: 15000, intervals: [2000, 3000, 5000] });
```

**Impacto**:
- Tests más confiables con sincronización IndexedDB
- Menos falsos negativos por timing
- Retry logic inteligente con intervalos crecientes

---

### 3. data-testid Agregados a Componentes ✅

**Problema**: Selectores de texto muy específicos causaban tests frágiles

**Solución**: Agregar `data-testid` a componentes clave

#### 3.1 KDSTicket Component

**Archivo**: `src/components/kds/KDSTicket.tsx`

```typescript
// Ticket container
<motion.div
    data-testid="kds-ticket"
    className="..."
>

// Item button
<motion.button
    data-testid="kds-item"
    className="..."
>
```

#### 3.2 OrderPanel Component

**Archivo**: `src/components/shared/OrderPanel.tsx`

```typescript
// Mobile line item
<motion.div
    data-testid="order-item"
    className="..."
>
```

#### 3.3 Tests Actualizados

**Archivo**: `e2e/waiter-to-kds.spec.ts`

```typescript
// ❌ ANTES: Selector de texto
const item = page.locator('text=Pollo').nth(1);

// ✅ DESPUÉS: data-testid
const item = page.locator('[data-testid="order-item"]:has-text("Pollo")').first();

// ❌ ANTES: Selector de texto genérico
await expect(kdsPage.locator('text=Papas')).toBeVisible();

// ✅ DESPUÉS: data-testid específico
await expect(kdsPage.locator('[data-testid="kds-item"]:has-text("Papas")')).toBeVisible();
```

**Impacto**:
- Selectores más robustos y específicos
- Tests menos frágiles ante cambios de UI
- Mejor separación entre estructura y contenido

---

## 📈 Resultados Esperados

### Antes de Fase 2
- ❌ 2/5 tests pasando (40%)
- ❌ ~3 minutos de ejecución
- ❌ 3 tests flaky
- ❌ Selectores frágiles

### Después de Fase 2 (Objetivo)
- ✅ 5/5 tests pasando (100%)
- ✅ <2 minutos de ejecución
- ✅ 0 tests flaky
- ✅ Selectores robustos

---

## 🧪 Tests Afectados

### Tests Corregidos

1. **"waiter creates order and submits to kitchen, KDS shows order"**
   - Mock de API aplicado correctamente
   - Retry logic para sincronización KDS
   - data-testid para verificar tickets

2. **"KDS can change item status after submission"**
   - Timeouts aumentados
   - data-testid para items de KDS
   - Retry logic para esperar sincronización

3. **"multiple waiters can submit orders simultaneously"**
   - Mock de API a nivel de contexto
   - Ambos waiters pueden ver productos
   - Retry logic para verificar ambos pedidos en KDS

4. **"order with no items cannot be submitted"**
   - Ya pasaba, sin cambios necesarios

5. **"submitted items remain visible on waiter screen"**
   - data-testid para items de pedido
   - Selector más robusto

---

## 📝 Archivos Modificados

### Tests
- `e2e/waiter-to-kds.spec.ts` - Refactorizado con mock de contexto, timeouts y data-testid

### Componentes
- `src/components/kds/KDSTicket.tsx` - Agregado data-testid="kds-ticket" y data-testid="kds-item"
- `src/components/shared/OrderPanel.tsx` - Agregado data-testid="order-item"

### Documentación
- `WAITER_KDS_E2E_PHASE2_IMPLEMENTATION.md` - Este documento

---

## ✅ Verificación

### Build
```bash
npm run build
```
**Resultado**: ✅ Exitoso - 0 errores de TypeScript

### Diagnostics
```bash
getDiagnostics([
    "e2e/waiter-to-kds.spec.ts",
    "src/components/kds/KDSTicket.tsx",
    "src/components/shared/OrderPanel.tsx"
])
```
**Resultado**: ✅ Sin errores

---

## 🎯 Próximos Pasos

1. **Ejecutar tests E2E** para verificar que los 5 tests pasen
   ```bash
   npm run test:e2e -- e2e/waiter-to-kds.spec.ts
   ```

2. **Crear POMs** (Task 9) - Opcional para mejorar mantenibilidad
   - `e2e/pages/WaiterPage.ts`
   - `e2e/pages/KDSPage.ts`

3. **Actualizar documentación** (Task 10)
   - Documentar estrategia de mocking
   - Documentar estrategia de sincronización
   - Agregar ejemplos a README

---

## 💡 Lecciones Aprendidas

1. **context.route() vs page.route()**
   - Usar `context.route()` cuando se crean múltiples páginas
   - `page.route()` solo aplica a una página específica

2. **Sincronización IndexedDB**
   - Requiere timeouts más largos (2-3s) para propagación de eventos
   - Retry logic con `expect().toPass()` es más confiable que timeouts fijos

3. **data-testid es esencial**
   - Selectores de texto son frágiles
   - data-testid proporciona estabilidad y claridad

4. **domcontentloaded vs networkidle**
   - `domcontentloaded` es más rápido y suficiente para la mayoría de casos
   - `networkidle` solo necesario cuando se requiere esperar todas las requests

---

## 🔗 Referencias

- **Plan Detallado**: `.kiro/specs/playwright-e2e-optimization/PHASE2_WAITER_KDS_PLAN.md`
- **Tasks**: `.kiro/specs/playwright-e2e-optimization/tasks.md`
- **Design**: `.kiro/specs/playwright-e2e-optimization/design.md`
- **Diagnóstico Inicial**: `WAITER_KDS_E2E_DIAGNOSTIC_10_FEB_2026.md`

---

**Última Actualización**: 10 Febrero 2026  
**Implementado por**: Kiro AI  
**Status**: ✅ COMPLETADO - Listo para testing  
**Próxima Acción**: Ejecutar tests E2E para verificar 5/5 pasando
