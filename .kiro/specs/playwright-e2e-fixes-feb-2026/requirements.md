# Playwright E2E Tests - Corrección de 39 Tests Fallando

**Fecha:** 11 Febrero 2026  
**Estado:** 🔴 CRÍTICO - 39/228 tests fallando (17%)

---

## 1. Contexto del Problema

### Estado Actual
- ✅ **188 tests pasando** (83%)
- ❌ **39 tests fallando** (17%)
- ⏭️ **1 test skipped**
- ⏱️ **Tiempo total:** 31.7 minutos

### Categorías de Fallos

#### 1.1 Tests de Concurrencia y Sincronización (10 fallos)
**Archivos afectados:**
- `e2e/01-sale-flow.spec.ts` (1 test)
- `e2e/02-offline-sync.spec.ts` (1 test)
- `e2e/03-concurrency.spec.ts` (8 tests)

**Problemas:**
- Eventos no se procesan correctamente
- Deduplicación falla
- Rate limiting no funciona
- Colisiones de order numbers

#### 1.2 Tests de Admin Auditoría (11 fallos)
**Archivos afectados:**
- `e2e/admin-auditoria.spec.ts` (11 tests)

**Problemas:**
- Página `/admin/auditoria` no existe o no renderiza
- Selectores no encuentran elementos
- Filtros no funcionan
- Tabla de eventos vacía

#### 1.3 Tests de Permisos Admin (2 fallos)
**Archivos afectados:**
- `e2e/admin-permission-denied.spec.ts` (2 tests)

**Problemas:**
- Validación de permisos incorrecta
- Códigos HTTP incorrectos (401/403)

#### 1.4 Tests de Flujo Mesero Completo (4 fallos)
**Archivos afectados:**
- `e2e/complete-waiter-flow.spec.ts` (4 tests)

**Problemas:**
- Mesas no cargan (timeout)
- Selectores `text=Mesa X` no encuentran elementos
- Flujo completo bloqueado

#### 1.5 Tests de Multi-Tenant Provisioning (11 fallos)
**Archivos afectados:**
- `e2e/multi-tenant-provisioning.spec.ts` (11 tests)

**Problemas:**
- Página `/admin/tenant/provisioning` no carga
- Formularios no aparecen
- Inputs no se encuentran (timeout 30s)

#### 1.6 Tests de RLS Multi-Tenant (1 fallo)
**Archivos afectados:**
- `e2e/multi-tenant-rls-isolation.spec.ts` (1 test)

**Problemas:**
- Analytics muestra datos incorrectos
- Ambos tenants muestran "S/ 0.00"

---

## 2. Requisitos de Corrección

### 2.1 Prioridad CRÍTICA - Admin Auditoría (11 tests)

**Requisito 1.1:** Crear página `/admin/auditoria` funcional
- **Criterio de aceptación:**
  - Página renderiza correctamente
  - Título "Auditoría de Autenticación" visible
  - Descripción "Registro completo de eventos de seguridad" visible
  - Tiempo de carga < 3 segundos

**Requisito 1.2:** Implementar tarjetas de estadísticas
- **Criterio de aceptación:**
  - Tarjeta "Total Eventos" visible con número
  - Tarjeta "Login Exitoso" visible con número
  - Tarjeta "Login Fallido" visible con número
  - Tarjeta "Alertas" visible con número

**Requisito 1.3:** Implementar controles de filtros
- **Criterio de aceptación:**
  - Input "Fecha Inicio" visible y funcional
  - Input "Fecha Fin" visible y funcional
  - Select "Terminal" visible y funcional
  - Select "Empleado" visible y funcional
  - Select "Tipo de Evento" visible y funcional

**Requisito 1.4:** Implementar tabla de eventos
- **Criterio de aceptación:**
  - Headers: Fecha/Hora, Evento, Terminal, Empleado, Estado, Detalles
  - Datos de eventos se cargan desde API
  - Paginación funcional
  - Botón "Actualizar" funcional

**Requisito 1.5:** Implementar filtrado funcional
- **Criterio de aceptación:**
  - Filtro por terminal funciona
  - Filtro por tipo de evento funciona
  - Botón "Limpiar Filtros" funciona
  - Resultados se actualizan en < 1 segundo

### 2.2 Prioridad ALTA - Multi-Tenant Provisioning (11 tests)

**Requisito 2.1:** Verificar página `/admin/tenant/provisioning` existe
- **Criterio de aceptación:**
  - Página carga en < 3 segundos
  - Formulario visible
  - Todos los inputs renderizados

**Requisito 2.2:** Corregir selectores de formulario
- **Criterio de aceptación:**
  - Input "Legal Name" encontrado con selector robusto
  - Input "Admin Name" encontrado con selector robusto
  - Input "Admin PIN" encontrado con selector robusto
  - Selectores usan `data-testid` en lugar de placeholders

**Requisito 2.3:** Implementar validaciones de formulario
- **Criterio de aceptación:**
  - PIN debe ser 4 dígitos (validación funciona)
  - Legal name es requerido (validación funciona)
  - Admin name es requerido (validación funciona)
  - Mensajes de error visibles

### 2.3 Prioridad ALTA - Flujo Mesero Completo (4 tests)

**Requisito 3.1:** Corregir carga de mesas en `/mozo`
- **Criterio de aceptación:**
  - Mesas cargan en < 5 segundos
  - Botones de mesa visibles
  - Selectores `text=Mesa X` funcionan
  - Error "Tables did not load" no aparece

**Requisito 3.2:** Implementar data-testid para mesas
- **Criterio de aceptación:**
  - Cada mesa tiene `data-testid="table-{number}"`
  - Tests usan selectores robustos
  - No dependen de texto variable

### 2.4 Prioridad MEDIA - Concurrencia y Sincronización (10 tests)

**Requisito 4.1:** Corregir procesamiento de eventos
- **Criterio de aceptación:**
  - Eventos se procesan correctamente
  - Deduplicación funciona
  - Order numbers no colisionan
  - Rate limiting funciona

**Requisito 4.2:** Corregir retry de pagos
- **Criterio de aceptación:**
  - Retry funciona con errores de red
  - Timeout configurado correctamente
  - Test pasa consistentemente

### 2.5 Prioridad MEDIA - Permisos Admin (2 tests)

**Requisito 5.1:** Corregir validación de permisos
- **Criterio de aceptación:**
  - API retorna 403 para usuarios no-admin
  - API retorna 200 para usuarios admin
  - Tests verifican códigos HTTP correctos

### 2.6 Prioridad BAJA - RLS Analytics (1 test)

**Requisito 6.1:** Corregir datos de analytics
- **Criterio de aceptación:**
  - Tenant 1 muestra datos reales (no "S/ 0.00")
  - Tenant 2 muestra datos reales (no "S/ 0.00")
  - Datos son diferentes entre tenants

---

## 3. Restricciones

### 3.1 Técnicas
- No modificar arquitectura existente
- Mantener compatibilidad con tests pasando
- Usar selectores robustos (`data-testid`)
- Timeouts razonables (< 10 segundos)

### 3.2 Calidad
- Todos los tests deben pasar consistentemente
- No tests flaky
- Cobertura E2E > 95%

### 3.3 Performance
- Tiempo total de ejecución < 30 minutos
- Tests individuales < 30 segundos

---

## 4. Criterios de Éxito

### 4.1 Objetivo Principal
- ✅ **0 tests fallando** (100% passing)
- ✅ **228 tests pasando**
- ✅ **Tiempo < 30 minutos**

### 4.2 Objetivos Secundarios
- ✅ Selectores robustos implementados
- ✅ Páginas faltantes creadas
- ✅ Validaciones funcionando
- ✅ Documentación actualizada

---

## 5. Fuera de Alcance

- Refactorización completa de tests
- Cambios en arquitectura de backend
- Optimización de performance (fuera de timeouts)
- Nuevos tests (solo corrección de existentes)

---

## 6. Dependencias

### 6.1 Páginas que deben existir
- `/admin/auditoria` - **NO EXISTE** ❌
- `/admin/tenant/provisioning` - **EXISTE** ✅
- `/mozo` - **EXISTE** ✅

### 6.2 APIs que deben funcionar
- `/api/admin/audit-log` - **VERIFICAR**
- `/api/admin/tenants/provision` - **VERIFICAR**
- `/api/events/ingest` - **VERIFICAR**

---

## 7. Plan de Ejecución

### Fase 1: Admin Auditoría (Prioridad CRÍTICA)
1. Crear página `/admin/auditoria`
2. Implementar componentes UI
3. Conectar con API
4. Ejecutar tests

### Fase 2: Multi-Tenant Provisioning (Prioridad ALTA)
1. Verificar página existe
2. Corregir selectores
3. Implementar validaciones
4. Ejecutar tests

### Fase 3: Flujo Mesero (Prioridad ALTA)
1. Corregir carga de mesas
2. Implementar data-testid
3. Ejecutar tests

### Fase 4: Concurrencia (Prioridad MEDIA)
1. Corregir procesamiento de eventos
2. Corregir retry de pagos
3. Ejecutar tests

### Fase 5: Permisos y RLS (Prioridad MEDIA/BAJA)
1. Corregir validación de permisos
2. Corregir datos de analytics
3. Ejecutar tests

---

**Última actualización:** 11 Febrero 2026  
**Próximo paso:** Crear design.md con soluciones técnicas
