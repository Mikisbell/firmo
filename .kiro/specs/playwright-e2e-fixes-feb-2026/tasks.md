# Playwright E2E Tests - Plan de Tareas

**Fecha:** 11 Febrero 2026  
**Spec:** playwright-e2e-fixes-feb-2026  
**Objetivo:** Corregir 39 tests E2E fallando → 0 tests fallando

---

## Fase 1: Admin Auditoría (11 tests) - CRÍTICO

### [ ] 1. Crear página Admin Auditoría
- [ ] 1.1 Crear archivo `src/app/admin/auditoria/page.tsx`
- [ ] 1.2 Implementar componente con header, stats, filtros, tabla
- [ ] 1.3 Agregar todos los `aria-label` necesarios
- [ ] 1.4 Implementar estado de carga
- [ ] 1.5 Verificar página renderiza en < 3 segundos

### [ ] 2. Crear API Endpoint Audit Log
- [ ] 2.1 Crear archivo `src/app/api/admin/audit-log/route.ts`
- [ ] 2.2 Implementar GET handler con mock data
- [ ] 2.3 Retornar estructura: `{ events: [], stats: {} }`
- [ ] 2.4 Agregar filtros query params (opcional)
- [ ] 2.5 Verificar API responde en < 1 segundo

### [ ] 3. Agregar Link en Sidebar
- [ ] 3.1 Editar `src/app/admin/components/AdminSidebar.tsx`
- [ ] 3.2 Agregar link "Auditoría" con icono 🔍
- [ ] 3.3 Verificar link funciona

### [ ] 4. Ejecutar Tests Admin Auditoría
- [ ] 4.1 Ejecutar: `npx playwright test e2e/admin-auditoria.spec.ts`
- [ ] 4.2 Verificar 11/11 tests pasan
- [ ] 4.3 Documentar resultados

---

## Fase 2: Multi-Tenant Provisioning (11 tests) - ALTA

### [ ] 5. Agregar data-testid a Formulario
- [ ] 5.1 Editar `src/app/admin/tenant/provisioning/page.tsx`
- [ ] 5.2 Agregar `data-testid="legal-name-input"` a input Legal Name
- [ ] 5.3 Agregar `data-testid="admin-name-input"` a input Admin Name
- [ ] 5.4 Agregar `data-testid="admin-pin-input"` a input Admin PIN
- [ ] 5.5 Agregar `data-testid="submit-button"` a botón Submit
- [ ] 5.6 Verificar formulario carga en < 3 segundos

### [ ] 6. Actualizar Tests con Selectores Robustos
- [ ] 6.1 Editar `e2e/multi-tenant-provisioning.spec.ts`
- [ ] 6.2 Reemplazar selectores `placeholder*` con `data-testid`
- [ ] 6.3 Reducir timeouts de 30s a 10s
- [ ] 6.4 Agregar waits estratégicos

### [ ] 7. Ejecutar Tests Multi-Tenant Provisioning
- [ ] 7.1 Ejecutar: `npx playwright test e2e/multi-tenant-provisioning.spec.ts`
- [ ] 7.2 Verificar 11/11 tests pasan
- [ ] 7.3 Documentar resultados

---

## Fase 3: Flujo Mesero Completo (4 tests) - ALTA

### [ ] 8. Agregar data-testid a Botones de Mesa
- [x] 8.1 Identificar componente de mesas (TableGrid o similar)
- [ ] 8.2 Agregar `data-testid="table-{number}"` a cada botón
- [ ] 8.3 Agregar `data-testid="tables-loading"` a loading state
- [ ] 8.4 Agregar `data-testid="tables-loaded"` a estado cargado
- [ ] 8.5 Verificar mesas cargan en < 5 segundos

### [ ] 9. Actualizar Tests Flujo Mesero
- [ ] 9.1 Editar `e2e/complete-waiter-flow.spec.ts`
- [ ] 9.2 Reemplazar `text=Mesa X` con `[data-testid="table-X"]`
- [ ] 9.3 Agregar wait para `[data-testid="tables-loaded"]`
- [ ] 9.4 Reducir timeouts

### [ ] 10. Ejecutar Tests Flujo Mesero
- [ ] 10.1 Ejecutar: `npx playwright test e2e/complete-waiter-flow.spec.ts`
- [ ] 10.2 Verificar 4/4 tests pasan
- [ ] 10.3 Documentar resultados

---

## Fase 4: Concurrencia y Sincronización (10 tests) - MEDIA

### [ ] 11. Corregir Retry de Pagos
- [ ] 11.1 Editar `src/app/caja/components/PaymentTerminal.tsx`
- [ ] 11.2 Verificar retry funciona con errores de red
- [ ] 11.3 Configurar timeout correcto (5 segundos)
- [ ] 11.4 Agregar logs de debug

### [ ] 12. Corregir Procesamiento de Eventos
- [ ] 12.1 Editar `src/app/api/events/ingest/route.ts`
- [ ] 12.2 Verificar deduplicación funciona
- [ ] 12.3 Verificar order numbers no colisionan
- [ ] 12.4 Verificar rate limiting funciona
- [ ] 12.5 Agregar logs de debug

### [ ] 13. Ejecutar Tests Concurrencia
- [ ] 13.1 Ejecutar: `npx playwright test e2e/01-sale-flow.spec.ts`
- [ ] 13.2 Ejecutar: `npx playwright test e2e/02-offline-sync.spec.ts`
- [ ] 13.3 Ejecutar: `npx playwright test e2e/03-concurrency.spec.ts`
- [ ] 13.4 Verificar 10/10 tests pasan
- [ ] 13.5 Documentar resultados

---

## Fase 5: Permisos y RLS (3 tests) - MEDIA/BAJA

### [ ] 14. Corregir Validación de Permisos
- [ ] 14.1 Editar `src/app/api/admin/drivers/[id]/route.ts`
- [ ] 14.2 Verificar retorna 403 para no-admin
- [ ] 14.3 Verificar retorna 200 para admin
- [ ] 14.4 Agregar logs de debug

### [ ] 15. Corregir Datos de Analytics
- [ ] 15.1 Editar `scripts/provision-e2e-test-tenants.ts`
- [ ] 15.2 Agregar datos de analytics para Tenant 1
- [ ] 15.3 Agregar datos de analytics para Tenant 2 (diferentes)
- [ ] 15.4 Ejecutar script de provisioning

### [ ] 16. Ejecutar Tests Permisos y RLS
- [ ] 16.1 Ejecutar: `npx playwright test e2e/admin-permission-denied.spec.ts`
- [ ] 16.2 Ejecutar: `npx playwright test e2e/multi-tenant-rls-isolation.spec.ts`
- [ ] 16.3 Verificar 3/3 tests pasan
- [ ] 16.4 Documentar resultados

---

## Fase 6: Verificación Final

### [ ] 17. Ejecutar Suite Completa de Tests
- [ ] 17.1 Ejecutar: `npx playwright test --reporter=list`
- [ ] 17.2 Verificar 228/228 tests pasan (100%)
- [ ] 17.3 Verificar tiempo total < 30 minutos
- [ ] 17.4 Verificar no hay tests flaky

### [ ] 18. Documentar Resultados
- [ ] 18.1 Crear documento de resumen
- [ ] 18.2 Incluir métricas: antes/después
- [ ] 18.3 Incluir screenshots de tests pasando
- [ ] 18.4 Incluir lecciones aprendidas

### [ ] 19. Commit y Push
- [ ] 19.1 Verificar `npm run build` pasa
- [ ] 19.2 Verificar `npm run dev` arranca
- [ ] 19.3 Commit con mensaje descriptivo
- [ ] 19.4 Push a GitHub

---

## Métricas de Éxito

### Antes
- ❌ 39 tests fallando (17%)
- ✅ 188 tests pasando (83%)
- ⏱️ 31.7 minutos

### Después (Objetivo)
- ✅ 0 tests fallando (0%)
- ✅ 228 tests pasando (100%)
- ⏱️ < 30 minutos

---

## Notas de Implementación

### Prioridades
1. **CRÍTICO:** Admin Auditoría (bloquea 11 tests)
2. **ALTA:** Multi-Tenant Provisioning (bloquea 11 tests)
3. **ALTA:** Flujo Mesero (bloquea 4 tests)
4. **MEDIA:** Concurrencia (bloquea 10 tests)
5. **BAJA:** Permisos + RLS (bloquea 3 tests)

### Timeouts Recomendados
- Carga de página: 5 segundos
- Carga de datos: 3 segundos
- Interacciones: 2 segundos
- Máximo absoluto: 10 segundos

### Selectores Recomendados
1. `data-testid` (preferido)
2. `role` + `name` (accesibilidad)
3. `aria-label` (accesibilidad)
4. Evitar: `text=`, clases CSS, IDs

---

**Última actualización:** 11 Febrero 2026  
**Estado:** ⏳ PENDIENTE - Listo para ejecución  
**Próximo paso:** Ejecutar Fase 1 - Admin Auditoría
