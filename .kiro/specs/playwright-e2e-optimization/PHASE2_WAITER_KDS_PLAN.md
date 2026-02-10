# Fase 2: Plan de Optimización Tests E2E Waiter → KDS

**Fecha Inicio**: 10 Febrero 2026  
**Estado**: ⚠️ EN PROGRESO  
**Objetivo**: Alcanzar 5/5 tests pasando (100%) en flujo Mesero → KDS

---

## 📊 Estado Actual

| Métrica | Valor Actual | Objetivo | Gap |
|---------|--------------|----------|-----|
| Tests Pasando | 2/5 (40%) | 5/5 (100%) | +3 tests |
| Tiempo Ejecución | ~3 min | <2 min | -33% |
| Código Duplicado | Alto | Bajo (POMs) | -60% |
| Flaky Tests | 3/5 | 0/5 | -100% |

---

## 🔴 Problemas Identificados

### Problema 1: Mock de API No Aplica a Páginas Nuevas ⚠️

**Impacto**: Test "multiple waiters" falla  
**Causa**: `page.route()` solo aplica a una página, no al contexto completo  
**Solución**: Cambiar a `context.route()` para aplicar a todas las páginas

```typescript
// ❌ ANTES: Mock solo en page
await page.route('/api/catalog/latest', mockHandler);

// ✅ DESPUÉS: Mock en context
await context.route('/api/catalog/latest', mockHandler);
```

**Esfuerzo**: 15 minutos  
**Prioridad**: 🔴 ALTA

---

### Problema 2: Pedidos No Aparecen en KDS ⚠️

**Impacto**: Test "waiter creates order" falla  
**Causa**: Sincronización IndexedDB entre mesero y KDS  
**Solución**: Agregar esperas estratégicas y retry logic

```typescript
// Después de enviar pedido
await waiterPage.submitOrder();
await page.waitForTimeout(2000); // ← Esperar propagación

// En KDS
await kdsPage.goto("/cocina");
await kdsPage.waitForTimeout(2000); // ← Esperar sincronización
await expect(async () => {
    const tickets = await kdsPage.locator('[data-testid="kds-ticket"]').count();
    expect(tickets).toBeGreaterThan(0);
}).toPass({ timeout: 10000 }); // ← Retry logic
```

**Esfuerzo**: 30 minutos  
**Prioridad**: 🔴 CRÍTICA

---

### Problema 3: Selectores de Texto Muy Específicos ⚠️

**Impacto**: Test "items remain visible" falla  
**Causa**: Selectores buscan texto exacto que incluye información adicional  
**Solución**: Agregar data-testid a componentes

```typescript
// ❌ ANTES: Selector de texto
const item = page.locator(`text=${productName}`).nth(1);

// ✅ DESPUÉS: data-testid
const item = page.locator('[data-testid="order-item"]').first();
```

**Archivos a Modificar**:
- `src/app/mozo/mesa/[tableId]/page.tsx` - Agregar data-testid a items
- `src/app/cocina/components/KDSTicket.tsx` - Agregar data-testid a tickets

**Esfuerzo**: 30 minutos  
**Prioridad**: 🟡 MEDIA

---

## 🎯 Plan de Implementación

### Task 8: Fix Waiter to KDS Flow (1h 25min)

#### 8.1 Apply API Mock at Context Level (15 min)
- [ ] Cambiar `page.route()` a `context.route()` en `beforeEach`
- [ ] Verificar que mock aplica a todas las páginas
- [ ] Ejecutar test "multiple waiters" para validar

**Archivos**: `e2e/waiter-to-kds.spec.ts`

#### 8.2 Investigate KDS Synchronization (30 min)
- [ ] Agregar logging para verificar eventos en IndexedDB
- [ ] Agregar esperas estratégicas (2-3 segundos)
- [ ] Implementar retry logic con `expect().toPass()`
- [ ] Ejecutar test "waiter creates order" para validar

**Archivos**: `e2e/waiter-to-kds.spec.ts`

#### 8.3 Add data-testid to Order Panel (15 min)
- [ ] Agregar `data-testid="order-item"` a items de pedido
- [ ] Agregar `data-testid="order-item-name"` a nombres
- [ ] Actualizar selectores en tests

**Archivos**: 
- `src/app/mozo/mesa/[tableId]/page.tsx`
- `e2e/waiter-to-kds.spec.ts`

#### 8.4 Add data-testid to KDS Tickets (15 min)
- [ ] Agregar `data-testid="kds-ticket"` a tickets
- [ ] Agregar `data-testid="kds-item"` a items
- [ ] Agregar `data-testid="kds-item-status"` a status
- [ ] Actualizar selectores en tests

**Archivos**: 
- `src/app/cocina/components/KDSTicket.tsx`
- `e2e/waiter-to-kds.spec.ts`

#### 8.5 Increase Timeouts (10 min)
- [ ] Aumentar timeout después de enviar pedido (2s → 3s)
- [ ] Aumentar timeout en KDS para sincronización (2s → 3s)
- [ ] Configurar retry timeout de 10 segundos
- [ ] Ejecutar todos los tests para validar

**Archivos**: `e2e/waiter-to-kds.spec.ts`

---

### Task 9: Create Waiter/KDS POMs (45 min)

#### 9.1 Create WaiterPage POM (20 min)
- [ ] Crear `e2e/pages/WaiterPage.ts`
- [ ] Implementar `selectTable(tableNumber)`
- [ ] Implementar `addProduct(productIndex)`
- [ ] Implementar `submitOrder()`
- [ ] Implementar `getOrderItems()`

#### 9.2 Create KDSPage POM (20 min)
- [ ] Crear `e2e/pages/KDSPage.ts`
- [ ] Implementar `waitForTickets(minCount, timeout)`
- [ ] Implementar `getTicketItems(ticketIndex)`
- [ ] Implementar `changeItemStatus(itemIndex)`

#### 9.3 Refactor Tests (5 min)
- [ ] Actualizar tests para usar WaiterPage
- [ ] Actualizar tests para usar KDSPage
- [ ] Eliminar llamadas directas a page.locator()

---

### Task 10: Verification (15 min)

#### 10.1 Run Full Test Suite (10 min)
- [ ] Ejecutar `npm run test:e2e -- e2e/waiter-to-kds.spec.ts`
- [ ] Verificar 5/5 tests pasando
- [ ] Verificar tiempo < 2 minutos
- [ ] Verificar no hay flaky tests

#### 10.2 Update Documentation (5 min)
- [ ] Documentar estrategia de mocking
- [ ] Documentar estrategia de sincronización
- [ ] Documentar uso de POMs
- [ ] Agregar ejemplos a README

---

## 📈 Métricas de Éxito

### Antes de Fase 2
- ❌ 2/5 tests pasando (40%)
- ❌ ~3 minutos de ejecución
- ❌ 3 tests flaky
- ❌ Código duplicado alto
- ❌ Selectores frágiles

### Después de Fase 2 (Objetivo)
- ✅ 5/5 tests pasando (100%)
- ✅ <2 minutos de ejecución
- ✅ 0 tests flaky
- ✅ Código duplicado bajo (POMs)
- ✅ Selectores robustos (data-testid)

---

## 🚀 Orden de Ejecución

1. **Task 8.1** (15 min) - Mock a nivel de contexto → Desbloquea test "multiple waiters"
2. **Task 8.2** (30 min) - Sincronización KDS → Desbloquea test "waiter creates order"
3. **Task 8.3** (15 min) - data-testid order panel → Mejora robustez
4. **Task 8.4** (15 min) - data-testid KDS tickets → Mejora robustez
5. **Task 8.5** (10 min) - Ajustar timeouts → Elimina flaky tests
6. **Task 9** (45 min) - Implementar POMs → Mejora mantenibilidad
7. **Task 10** (15 min) - Verificación y docs → Completar fase

**Total Estimado**: 2 horas 25 minutos

---

## 💡 Lecciones Aprendidas (Fase 1)

1. **POMs reducen duplicación en 80%** - Aplicar a Waiter/KDS
2. **data-testid es más confiable que texto** - Agregar a todos los componentes
3. **Parallel execution requiere aislamiento** - Ya implementado en Fase 1
4. **Smart waits son más rápidos que networkidle** - Aplicar a sincronización

---

## 📝 Archivos a Modificar

### Componentes (30 min)
- `src/app/mozo/mesa/[tableId]/page.tsx` - Agregar data-testid
- `src/app/cocina/components/KDSTicket.tsx` - Agregar data-testid

### Tests (1h)
- `e2e/waiter-to-kds.spec.ts` - Refactorizar con POMs y fixes

### POMs (45 min)
- `e2e/pages/WaiterPage.ts` - Crear nuevo
- `e2e/pages/KDSPage.ts` - Crear nuevo

### Documentación (15 min)
- `README.md` - Actualizar con estrategias
- `.kiro/specs/playwright-e2e-optimization/PHASE2_COMPLETION.md` - Crear al finalizar

---

## 🎬 Comando para Ejecutar

```bash
# Ejecutar solo tests Waiter → KDS
npm run test:e2e -- e2e/waiter-to-kds.spec.ts

# Ejecutar con UI para debugging
npm run test:e2e -- e2e/waiter-to-kds.spec.ts --ui

# Ejecutar test específico
npm run test:e2e -- e2e/waiter-to-kds.spec.ts -g "waiter creates order"
```

---

## 🔗 Referencias

- **Fase 1 Completa**: `.kiro/specs/playwright-e2e-optimization/tasks.md`
- **Diagnóstico Inicial**: `WAITER_KDS_E2E_DIAGNOSTIC_10_FEB_2026.md`
- **Fix Parcial**: `WAITER_KDS_E2E_FIX_COMPLETE_10_FEB_2026.md`
- **Resumen Sesión**: `RESUMEN_SESION_WAITER_KDS_E2E_10_FEB_2026.md`

---

**Última Actualización**: 11 Febrero 2026  
**Próxima Acción**: Comenzar Task 8.1 - Apply API mock at context level  
**Responsable**: Equipo de Testing  
**Prioridad**: 🔴 ALTA - Flujo crítico de negocio
