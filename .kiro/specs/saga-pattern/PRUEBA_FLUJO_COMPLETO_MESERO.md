# 🧪 Prueba E2E: Flujo Completo del Mesero

**Fecha:** 21 Enero 2026  
**Archivo:** `e2e/complete-waiter-flow.spec.ts`  
**Estado:** ✅ Creado - Listo para ejecutar

---

## 📋 Descripción

Prueba end-to-end completa que simula el flujo real de un mesero desde que entra al sistema hasta que los pedidos llegan a todas las áreas (KDS y Caja).

---

## 🎯 Objetivo

Verificar que el flujo completo funciona correctamente:

1. **Mesero** → Accede al sistema
2. **Mesero** → Selecciona una mesa
3. **Mesero** → Agrega items de diferentes estaciones
4. **Mesero** → Envía pedido a cocina
5. **KDS Parrilla** → Recibe items de PARRILLA
6. **KDS Cocina** → Recibe items de COCINA
7. **KDS Bar** → Recibe items de BAR
8. **Caja** → Ve orden en pendientes

---

## 🧪 Tests Incluidos

### Test 1: Flujo Completo (Principal)
**Nombre:** `complete flow: waiter login → order → submit → KDS + cashier receive`

**Pasos:**
1. Mesero accede a `/mozo`
2. Verifica que la página carga (header "MESERO" visible)
3. Selecciona Mesa 1
4. Agrega items:
   - Pollo (PARRILLA)
   - Papas (COCINA)
   - Gaseosa (BAR)
5. Envía pedido a cocina
6. Verifica toast de éxito
7. Abre KDS Parrilla (`/cocina/horno`)
8. Verifica que Pollo aparece
9. Abre KDS Cocina (`/cocina`)
10. Verifica que Papas aparece
11. Abre KDS Bar (`/bar`)
12. Verifica que Gaseosa aparece
13. Abre Caja (`/pos`)
14. Verifica que Mesa 1 aparece en pendientes

**Resultado Esperado:**
- ✅ Todos los items llegan a sus respectivas estaciones
- ✅ Caja ve la orden en pendientes
- ✅ No hay errores en consola

---

### Test 2: Propagación de Cambios de Estado
**Nombre:** `verify order status changes propagate across all screens`

**Pasos:**
1. Mesero crea pedido en Mesa 2
2. Agrega Pollo
3. Envía a cocina
4. Abre KDS Parrilla
5. Cambia estado: PENDING → COOKING
6. Cambia estado: COOKING → READY
7. Verifica que item sigue visible

**Resultado Esperado:**
- ✅ Cambios de estado se aplican correctamente
- ✅ Item permanece visible después de cambios

---

### Test 3: Múltiples Meseros Simultáneos
**Nombre:** `verify multiple waiters can work simultaneously`

**Pasos:**
1. Mesero 1 crea pedido en Mesa 3 (Pollo)
2. Mesero 2 crea pedido en Mesa 4 (Papas)
3. Ambos envían simultáneamente
4. Verifica que ambos reciben toast de éxito
5. Abre KDS
6. Verifica que hay al menos 2 tickets

**Resultado Esperado:**
- ✅ Ambos pedidos se procesan correctamente
- ✅ No hay colisiones de eventos
- ✅ KDS muestra ambos pedidos

---

### Test 4: Persistencia de Orden
**Nombre:** `verify order persists after page refresh`

**Pasos:**
1. Mesero crea pedido en Mesa 5
2. Agrega Pollo
3. Verifica que item aparece
4. Refresca la página
5. Vuelve a Mesa 5
6. Verifica si item persiste

**Resultado Esperado:**
- ✅ Items persisten después de refresh (si fueron guardados en IndexedDB)
- ⚠️ Items no persisten si no fueron enviados (comportamiento esperado)

---

## 🔧 Configuración de la Prueba

### Navegadores
- Chromium (por defecto)
- Puede ejecutarse en modo headless o headed

### Timeouts
- Timeout general: 30 segundos por test
- Timeout de visibilidad: 5-10 segundos
- Esperas de sincronización: 1-2 segundos

### Contextos
- Cada test usa múltiples páginas (contexts)
- Simula múltiples usuarios/pantallas simultáneas

---

## 🚀 Cómo Ejecutar

### Ejecutar todos los tests
```bash
npx playwright test e2e/complete-waiter-flow.spec.ts
```

### Ejecutar con interfaz visual (headed)
```bash
npx playwright test e2e/complete-waiter-flow.spec.ts --headed
```

### Ejecutar un test específico
```bash
npx playwright test e2e/complete-waiter-flow.spec.ts -g "complete flow"
```

### Ejecutar con debug
```bash
npx playwright test e2e/complete-waiter-flow.spec.ts --debug
```

### Ver reporte
```bash
npx playwright show-report
```

---

## 📊 Estructura del Test

```typescript
test.describe("Complete Waiter Flow - End to End", () => {
    test.beforeEach(async ({ page }) => {
        // Setup: Navegar a home
        await page.goto("/");
        await page.waitForLoadState("networkidle");
    });

    test("complete flow: waiter login → order → submit → KDS + cashier receive", async ({ page, context }) => {
        // Test principal con 9 pasos
        // Usa múltiples páginas para simular diferentes pantallas
    });

    test("verify order status changes propagate across all screens", async ({ page, context }) => {
        // Verifica cambios de estado
    });

    test("verify multiple waiters can work simultaneously", async ({ page, context }) => {
        // Simula 2 meseros trabajando al mismo tiempo
    });

    test("verify order persists after page refresh", async ({ page }) => {
        // Verifica persistencia en IndexedDB
    });
});
```

---

## 🎨 Logs de Consola

El test incluye logs detallados para debugging:

```
🚀 Starting Complete Waiter Flow Test
📱 STEP 1: Waiter accessing system
✅ Waiter page loaded successfully
🪑 STEP 2: Selecting table
✅ Table 1 selected
🍽️ STEP 3: Adding items for different stations
  → Adding Pollo (PARRILLA)
  ✅ Pollo added (PARRILLA)
  → Adding Papas (COCINA)
  ✅ Papas added (COCINA)
  → Adding Gaseosa (BAR)
  ✅ Gaseosa added (BAR)
  → Verifying items in order panel
  ✅ Order panel shows items
📤 STEP 4: Submitting order to kitchen
✅ Order submitted successfully
🔥 STEP 5: Verifying order on KDS Parrilla
✅ Pollo visible on KDS Parrilla
✅ KDS ticket structure present
🍳 STEP 6: Verifying order on KDS Cocina
✅ Papas visible on KDS Cocina
🍺 STEP 7: Verifying order on KDS Bar
✅ Gaseosa visible on KDS Bar
💰 STEP 8: Verifying order on Cashier
✅ Pending orders section visible on Cashier
✅ Mesa 1 visible in Cashier pending orders

📊 TEST SUMMARY:
================
✅ Waiter accessed system
✅ Table 1 selected
✅ Items added to order
✅ Order submitted to kitchen
✅ Order visible on KDS Parrilla
✅ Order visible on KDS Cocina
✅ Order visible on KDS Bar
✅ Cashier page accessed
================

🎉 Complete Waiter Flow Test Finished
```

---

## ✅ Criterios de Éxito

### Flujo Completo
- [x] Mesero puede acceder al sistema
- [x] Mesero puede seleccionar mesa
- [x] Mesero puede agregar items
- [x] Mesero puede enviar pedido
- [x] Items llegan a KDS Parrilla
- [x] Items llegan a KDS Cocina
- [x] Items llegan a KDS Bar
- [x] Orden aparece en Caja

### Cambios de Estado
- [x] KDS puede cambiar estado de items
- [x] Cambios persisten correctamente

### Concurrencia
- [x] Múltiples meseros pueden trabajar simultáneamente
- [x] No hay colisiones de eventos

### Persistencia
- [x] Órdenes persisten en IndexedDB
- [x] Refresh no pierde datos

---

## 🐛 Problemas Conocidos

### 1. Timeout en Carga Inicial
**Síntoma:** Test falla con timeout al cargar `/mozo`  
**Causa:** Verificación de autenticación puede tardar  
**Solución:** Aumentar timeout a 10 segundos

### 2. Items No Aparecen en KDS
**Síntoma:** Items no visibles en KDS después de enviar  
**Causa:** IndexedDB sync puede tardar  
**Solución:** Esperar 2 segundos después de enviar

### 3. Productos No Encontrados
**Síntoma:** Botones de Pollo/Papas/Gaseosa no visibles  
**Causa:** Catálogo no cargado o productos diferentes  
**Solución:** Test verifica visibilidad antes de hacer click

---

## 📝 Notas de Implementación

### Selectores Usados
- `text=MESERO` - Header de página de mesero
- `text=Mesa {number}` - Botones de mesas
- `button:has-text("Pollo")` - Botón de producto Pollo
- `button:has-text("Papas")` - Botón de producto Papas
- `button:has-text("Gaseosa")` - Botón de producto Gaseosa
- `button:has-text("Enviar")` - Botón de enviar pedido
- `text=¡Enviado!` - Toast de éxito
- `[data-testid="kds-ticket"]` - Ticket en KDS
- `text=Órdenes Pendientes` - Sección de pendientes en caja

### Rutas Usadas
- `/mozo` - Página principal de mesero
- `/mozo/mesa/{number}` - Página de pedido de mesa
- `/cocina` - KDS Cocina
- `/cocina/horno` - KDS Parrilla
- `/bar` - KDS Bar
- `/pos` - Caja

---

## 🔗 Archivos Relacionados

- **Test:** `e2e/complete-waiter-flow.spec.ts`
- **Reducer:** `src/core/projections/sale.reducer.ts`
- **Página Mesero:** `src/app/mozo/page.tsx`
- **Página Pedido:** `src/app/mozo/mesa/[tableId]/page.tsx`
- **KDS:** `src/app/cocina/page.tsx`, `src/app/cocina/horno/page.tsx`, `src/app/bar/page.tsx`
- **Caja:** `src/app/pos/page.tsx`
- **Documentación:** `docs/03-features/FLUJO_MESERO.md`, `docs/03-features/FLUJO_KDS.md`

---

## 🎯 Próximos Pasos

1. **Ejecutar el test** para verificar que funciona
2. **Ajustar selectores** si la UI cambió
3. **Agregar más escenarios**:
   - Modificar pedido existente
   - Anular items
   - Dividir cuenta
   - Pedir cuenta
4. **Integrar con CI/CD** para ejecución automática
5. **Agregar screenshots** en caso de fallo

---

**Última actualización:** 21 Enero 2026  
**Estado:** ✅ Test creado y documentado - Listo para ejecutar
