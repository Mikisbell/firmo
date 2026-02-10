# Actualización de Spec: Playwright E2E Optimization - Fase 2

**Fecha**: 11 Febrero 2026  
**Spec**: `.kiro/specs/playwright-e2e-optimization/`  
**Acción**: Actualización para incluir Fase 2 - Waiter to KDS Flow

---

## 📋 Resumen Ejecutivo

Se ha actualizado el spec existente de optimización de Playwright E2E para incluir una **Fase 2** dedicada a corregir los tests del flujo Mesero → KDS que actualmente están fallando (2/5 pasando).

### Estado del Spec

**Fase 1**: ✅ **COMPLETADA** (9 Febrero 2026)
- 56% reducción en tiempo de ejecución (3.9m → 1.7m)
- 20/21 tests pasando (95%)
- 4 POMs implementados
- Paralelización habilitada (4 workers)

**Fase 2**: ⚠️ **EN PROGRESO** (Iniciada 10 Febrero 2026)
- 2/5 tests pasando (40%)
- 3 problemas críticos identificados
- Soluciones diseñadas y documentadas
- Estimado: 2h 25min para completar

---

## 🔧 Archivos Actualizados

### 1. Requirements Document
**Archivo**: `.kiro/specs/playwright-e2e-optimization/requirements.md`

**Nuevos Requirements Agregados**:
- **Requirement 11**: API Mocking a Nivel de Contexto
- **Requirement 12**: Sincronización de Eventos IndexedDB
- **Requirement 13**: Selectores Robustos para Componentes Dinámicos
- **Requirement 14**: Page Object Models para Waiter y KDS
- **Requirement 15**: Retry Logic para Operaciones Asíncronas

**Total**: 15 requirements (10 de Fase 1 + 5 de Fase 2)

---

### 2. Design Document
**Archivo**: `.kiro/specs/playwright-e2e-optimization/design.md`

**Sección Agregada**: "FASE 2: Waiter to KDS Flow Optimization"

**Contenido**:
- Contexto del problema (3 problemas identificados)
- Análisis de causa raíz para cada problema
- Arquitectura de solución detallada
- Ejemplos de código (POMs, helpers, componentes)
- Métricas de éxito esperadas
- Plan de implementación

**Extensión**: +500 líneas de documentación técnica

---

### 3. Tasks Document
**Archivo**: `.kiro/specs/playwright-e2e-optimization/tasks.md`

**Nuevas Tareas Agregadas**:
- **Task 8**: Fix Waiter to KDS Flow (5 sub-tareas, 1h 25min)
- **Task 9**: Create Waiter/KDS POMs (3 sub-tareas, 45min)
- **Task 10**: Verification and Documentation (2 sub-tareas, 15min)

**Total**: 10 tareas (7 de Fase 1 + 3 de Fase 2)

**Estado**:
- Fase 1: 7/7 tareas completadas ✅
- Fase 2: 0/3 tareas completadas ⏳

---

### 4. Plan Detallado (NUEVO)
**Archivo**: `.kiro/specs/playwright-e2e-optimization/PHASE2_WAITER_KDS_PLAN.md`

**Contenido**:
- Estado actual con métricas
- Problemas identificados con análisis detallado
- Plan de implementación paso a paso
- Orden de ejecución optimizado
- Comandos para ejecutar tests
- Referencias a documentación relacionada

**Propósito**: Guía ejecutiva para implementar Fase 2

---

## 🎯 Problemas Identificados en Fase 2

### Problema 1: Mock de API No Aplica a Páginas Nuevas
**Impacto**: Test "multiple waiters" falla  
**Causa**: `page.route()` solo aplica a una página  
**Solución**: Cambiar a `context.route()`  
**Esfuerzo**: 15 minutos

### Problema 2: Pedidos No Aparecen en KDS
**Impacto**: Test "waiter creates order" falla  
**Causa**: Sincronización IndexedDB  
**Solución**: Esperas estratégicas + retry logic  
**Esfuerzo**: 30 minutos

### Problema 3: Selectores de Texto Muy Específicos
**Impacto**: Test "items remain visible" falla  
**Causa**: Selectores buscan texto exacto  
**Solución**: Agregar data-testid a componentes  
**Esfuerzo**: 30 minutos

---

## 📊 Métricas Esperadas - Fase 2

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Tests Pasando | 2/5 (40%) | 5/5 (100%) | +150% |
| Tiempo Ejecución | ~3 min | <2 min | -33% |
| Código Duplicado | Alto | Bajo (POMs) | -60% |
| Flaky Tests | 3/5 | 0/5 | -100% |
| Mantenibilidad | Baja | Alta | +200% |

---

## 🚀 Plan de Implementación

### Orden de Ejecución
1. **Task 8.1** (15 min) - Mock a nivel de contexto
2. **Task 8.2** (30 min) - Sincronización KDS
3. **Task 8.3** (15 min) - data-testid order panel
4. **Task 8.4** (15 min) - data-testid KDS tickets
5. **Task 8.5** (10 min) - Ajustar timeouts
6. **Task 9** (45 min) - Implementar POMs
7. **Task 10** (15 min) - Verificación y docs

**Total Estimado**: 2 horas 25 minutos

### Archivos a Modificar
**Componentes** (30 min):
- `src/app/mozo/mesa/[tableId]/page.tsx`
- `src/app/cocina/components/KDSTicket.tsx`

**Tests** (1h):
- `e2e/waiter-to-kds.spec.ts`

**POMs** (45 min):
- `e2e/pages/WaiterPage.ts` (nuevo)
- `e2e/pages/KDSPage.ts` (nuevo)

**Documentación** (15 min):
- `README.md`
- `.kiro/specs/playwright-e2e-optimization/PHASE2_COMPLETION.md` (al finalizar)

---

## 💡 Decisiones de Diseño

### 1. Actualizar Spec Existente vs Crear Nuevo
**Decisión**: Actualizar spec existente  
**Razón**: 
- Los problemas son parte de la optimización general de E2E
- Comparten arquitectura y estrategias con Fase 1
- Evita fragmentación de documentación
- Mantiene continuidad del trabajo

### 2. Estructura de Fases
**Decisión**: Dividir en Fase 1 (completa) y Fase 2 (en progreso)  
**Razón**:
- Fase 1 ya está completa y funcionando
- Fase 2 es un conjunto específico de problemas
- Permite tracking independiente de progreso
- Facilita priorización y asignación de recursos

### 3. Nivel de Detalle en Documentación
**Decisión**: Documentación exhaustiva con ejemplos de código  
**Razón**:
- Problemas complejos requieren análisis detallado
- Ejemplos de código facilitan implementación
- Reduce ambigüedad y preguntas
- Sirve como referencia para problemas similares futuros

---

## 🔗 Referencias

### Documentación de Contexto
- `RESUMEN_SESION_WAITER_KDS_E2E_10_FEB_2026.md` - Sesión de diagnóstico
- `WAITER_KDS_E2E_FIX_COMPLETE_10_FEB_2026.md` - Fix parcial implementado
- `WAITER_KDS_E2E_DIAGNOSTIC_10_FEB_2026.md` - Análisis inicial

### Spec Actualizado
- `.kiro/specs/playwright-e2e-optimization/requirements.md` - 15 requirements
- `.kiro/specs/playwright-e2e-optimization/design.md` - Arquitectura completa
- `.kiro/specs/playwright-e2e-optimization/tasks.md` - 10 tareas
- `.kiro/specs/playwright-e2e-optimization/PHASE2_WAITER_KDS_PLAN.md` - Plan ejecutivo

### Tests Afectados
- `e2e/waiter-to-kds.spec.ts` - 5 tests (2 pasando, 3 fallando)

---

## ✅ Checklist de Actualización

- [x] Requirements document actualizado con 5 nuevos requirements
- [x] Design document actualizado con sección de Fase 2
- [x] Tasks document actualizado con 3 nuevas tareas
- [x] Plan ejecutivo creado (PHASE2_WAITER_KDS_PLAN.md)
- [x] Problemas documentados con análisis de causa raíz
- [x] Soluciones diseñadas con ejemplos de código
- [x] Métricas de éxito definidas
- [x] Orden de implementación optimizado
- [x] Referencias cruzadas agregadas

---

## 🎬 Próximos Pasos

### Inmediato
1. Revisar y aprobar el spec actualizado
2. Asignar recursos para implementación de Fase 2
3. Comenzar con Task 8.1 (15 minutos)

### Corto Plazo (Esta Semana)
1. Completar Task 8 (1h 25min) - Fixes críticos
2. Completar Task 9 (45min) - POMs
3. Completar Task 10 (15min) - Verificación
4. Alcanzar 5/5 tests pasando (100%)

### Mediano Plazo (Próxima Semana)
1. Monitorear estabilidad de tests en CI
2. Aplicar lecciones aprendidas a otros flujos E2E
3. Documentar best practices en README

---

## 📈 Impacto Esperado

### Técnico
- ✅ 100% de tests pasando en flujo crítico de negocio
- ✅ Reducción de 33% en tiempo de ejecución
- ✅ Eliminación completa de flaky tests
- ✅ Código más mantenible con POMs

### Negocio
- ✅ Mayor confianza en despliegues
- ✅ Detección temprana de regresiones
- ✅ Reducción de bugs en producción
- ✅ Mejor experiencia de usuario

### Equipo
- ✅ Menos tiempo debugging tests
- ✅ Más tiempo desarrollando features
- ✅ Mejor documentación de patrones
- ✅ Conocimiento compartido

---

**Última Actualización**: 11 Febrero 2026  
**Estado**: Spec actualizado, listo para implementación  
**Próxima Acción**: Comenzar Task 8.1  
**Responsable**: Equipo de Testing  
**Prioridad**: 🔴 ALTA
