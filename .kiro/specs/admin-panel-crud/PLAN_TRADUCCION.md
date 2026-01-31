# Plan de Traducción al Español - Sistema Completo

## 📊 Estado Actual

### ✅ Completado (20 Enero 2026)
- **Panel de Administración** - 100% traducido
  - Empleados (`/api/admin/employees`)
  - Productos (`/api/admin/products`)
  - Promociones (`/api/admin/promotions`)
  - Drivers (`/api/drivers`)
  - Configuración (`/api/admin/config`)
  - Middleware de autenticación (`admin-auth.ts`)

---

## 📋 PLAN DETALLADO DE EJECUCIÓN

### Resumen Ejecutivo
- **Total de endpoints:** 60+ endpoints
- **Tiempo estimado total:** 12-15 horas
- **Prioridad:** Crítico → Importante → Medio → Bajo
- **Metodología:** Traducir → Build → Test → Commit

### Estrategia de Verificación
Después de cada endpoint traducido:
1. ✅ `npm run build` - Verificar compilación
2. ✅ `npm test` - Verificar tests (si existen)
3. ✅ Commit con mensaje descriptivo

---

## 🎯 Pendiente de Traducción

### Prioridad 1: APIs Core (CRÍTICO) ⏱️ 4-5 horas
**Impacto:** Alto - Usuarios finales ven estos mensajes constantemente

#### 1.1 Autenticación (`/api/auth`) ⏱️ 2 horas

##### Tarea 1.1.1: Login Endpoint
- **Archivo:** `src/app/api/auth/login/route.ts`
- **Líneas a traducir:** ~10 mensajes de error
- **Tiempo estimado:** 15 minutos
- **Mensajes típicos:**
  - `"Missing required fields"` → `"Faltan campos requeridos"`
  - `"Invalid credentials"` → `"Credenciales inválidas"`
  - `"Terminal not found"` → `"Terminal no encontrado"`
  - `"Employee not found"` → `"Empleado no encontrado"`
  - `"Incorrect PIN"` → `"PIN incorrecto"`
  - `"Employee is inactive"` → `"Empleado inactivo"`
- **Verificación:** Build + test auth flow

##### Tarea 1.1.2: Session Endpoints (POST, GET, DELETE)
- **Archivo:** `src/app/api/auth/session/route.ts`
- **Líneas a traducir:** ~15 mensajes
- **Tiempo estimado:** 20 minutos
- **Mensajes típicos:**
  - `"Missing required fields"` → `"Faltan campos requeridos"`
  - `"Invalid token"` → `"Token inválido"`
  - `"Session expired"` → `"Sesión expirada"`
  - `"Unauthorized"` → `"No autorizado"`
  - `"Session not found"` → `"Sesión no encontrada"`
- **Verificación:** Build + test session validation

##### Tarea 1.1.3: Terminal Verification
- **Archivo:** `src/app/api/auth/verify-terminal/route.ts`
- **Líneas a traducir:** ~8 mensajes
- **Tiempo estimado:** 15 minutos
- **Mensajes típicos:**
  - `"Missing terminal_id"` → `"Falta terminal_id"`
  - `"Terminal not found"` → `"Terminal no encontrado"`
  - `"Terminal is inactive"` → `"Terminal inactivo"`
- **Verificación:** Build

##### Tarea 1.1.4: Manager Verification
- **Archivo:** `src/app/api/auth/verify-manager/route.ts`
- **Líneas a traducir:** ~10 mensajes
- **Tiempo estimado:** 15 minutos
- **Mensajes típicos:**
  - `"Missing required fields"` → `"Faltan campos requeridos"`
  - `"Employee not found"` → `"Empleado no encontrado"`
  - `"Incorrect PIN"` → `"PIN incorrecto"`
  - `"Not a manager"` → `"No es gerente"`
- **Verificación:** Build

##### Tarea 1.1.5: Terminals List
- **Archivo:** `src/app/api/auth/terminals/route.ts`
- **Líneas a traducir:** ~5 mensajes
- **Tiempo estimado:** 10 minutos
- **Mensajes típicos:**
  - `"Failed to fetch terminals"` → `"Error al obtener terminales"`
- **Verificación:** Build

**Subtotal Autenticación:** 1h 15min

---

#### 1.2 Eventos (`/api/events`) ⏱️ 1.5 horas

##### Tarea 1.2.1: Event Ingest
- **Archivo:** `src/app/api/events/ingest/route.ts`
- **Líneas a traducir:** ~30 mensajes (archivo grande)
- **Tiempo estimado:** 45 minutos
- **Mensajes típicos:**
  - `"Rate limit exceeded"` → `"Límite de tasa excedido"`
  - `"Invalid event format"` → `"Formato de evento inválido"`
  - `"Missing required fields"` → `"Faltan campos requeridos"`
  - `"Event validation failed"` → `"Validación de evento fallida"`
  - `"Duplicate event detected"` → `"Evento duplicado detectado"`
  - `"Failed to process event"` → `"Error al procesar evento"`
  - Validaciones específicas por tipo de evento
- **Verificación:** Build + test event ingestion

##### Tarea 1.2.2: Event Stream
- **Archivo:** `src/app/api/events/stream/route.ts`
- **Líneas a traducir:** ~5 mensajes
- **Tiempo estimado:** 10 minutos
- **Mensajes típicos:**
  - `"Missing tenant_id"` → `"Falta tenant_id"`
  - `"Stream error"` → `"Error en stream"`
- **Verificación:** Build

**Subtotal Eventos:** 55min

---

#### 1.3 Órdenes (`/api/orders`) ⏱️ 45 minutos

##### Tarea 1.3.1: Order State
- **Archivo:** `src/app/api/orders/[orderId]/state/route.ts`
- **Líneas a traducir:** ~8 mensajes
- **Tiempo estimado:** 15 minutos
- **Mensajes típicos:**
  - `"Order not found"` → `"Orden no encontrada"`
  - `"Failed to fetch order state"` → `"Error al obtener estado de orden"`
- **Verificación:** Build

##### Tarea 1.3.2: Order Lock (GET, POST, DELETE)
- **Archivo:** `src/app/api/orders/[orderId]/lock/route.ts`
- **Líneas a traducir:** ~15 mensajes
- **Tiempo estimado:** 30 minutos
- **Mensajes típicos:**
  - `"Order not found"` → `"Orden no encontrada"`
  - `"Lock already held by another terminal"` → `"Orden bloqueada por otra terminal"`
  - `"Lock acquired"` → `"Bloqueo adquirido"`
  - `"Lock released"` → `"Bloqueo liberado"`
  - `"Failed to acquire lock"` → `"Error al adquirir bloqueo"`
- **Verificación:** Build + test lock mechanism

**Subtotal Órdenes:** 45min

---

**TOTAL PRIORIDAD 1:** 3 horas

---

### Prioridad 2: Inventario (IMPORTANTE) ⏱️ 3-4 horas
**Impacto:** Medio-Alto - Usado por personal de inventario

#### 2.1 Inventario Core ⏱️ 2.5 horas

##### Tarea 2.1.1: Stock Endpoint
- **Archivo:** `src/app/api/inventory/stock/route.ts`
- **Líneas a traducir:** ~10 mensajes
- **Tiempo estimado:** 20 minutos
- **Mensajes típicos:**
  - `"Missing tenant_id"` → `"Falta tenant_id"`
  - `"Failed to fetch stock"` → `"Error al obtener stock"`
  - `"No stock found"` → `"No se encontró stock"`
- **Verificación:** Build + test stock query

##### Tarea 2.1.2: Receive Goods
- **Archivo:** `src/app/api/inventory/receive/route.ts`
- **Líneas a traducir:** ~20 mensajes
- **Tiempo estimado:** 30 minutos
- **Mensajes típicos:**
  - `"Missing required fields"` → `"Faltan campos requeridos"`
  - `"Invalid quantity"` → `"Cantidad inválida"`
  - `"Product not found"` → `"Producto no encontrado"`
  - `"Failed to receive goods"` → `"Error al recibir mercadería"`
  - `"Goods received successfully"` → `"Mercadería recibida exitosamente"`
- **Verificación:** Build + test receive flow

##### Tarea 2.1.3: Waste Registration
- **Archivo:** `src/app/api/inventory/waste/route.ts`
- **Líneas a traducir:** ~20 mensajes
- **Tiempo estimado:** 30 minutos
- **Mensajes típicos:**
  - `"Missing required fields"` → `"Faltan campos requeridos"`
  - `"Invalid quantity"` → `"Cantidad inválida"`
  - `"Insufficient stock"` → `"Stock insuficiente"`
  - `"Failed to register waste"` → `"Error al registrar merma"`
  - `"Waste registered successfully"` → `"Merma registrada exitosamente"`
- **Verificación:** Build + test waste flow

##### Tarea 2.1.4: Inventory Stats
- **Archivo:** `src/app/api/inventory/stats/route.ts`
- **Líneas a traducir:** ~8 mensajes
- **Tiempo estimado:** 15 minutos
- **Mensajes típicos:**
  - `"Missing tenant_id"` → `"Falta tenant_id"`
  - `"Failed to fetch stats"` → `"Error al obtener estadísticas"`
- **Verificación:** Build

##### Tarea 2.1.5: Recent Movements
- **Archivo:** `src/app/api/inventory/movements/recent/route.ts`
- **Líneas a traducir:** ~10 mensajes
- **Tiempo estimado:** 20 minutos
- **Mensajes típicos:**
  - `"Missing tenant_id"` → `"Falta tenant_id"`
  - `"Invalid limit"` → `"Límite inválido"`
  - `"Failed to fetch movements"` → `"Error al obtener movimientos"`
- **Verificación:** Build

##### Tarea 2.1.6: PIN Verification (ya traducido)
- **Archivo:** `src/app/api/inventory/verify-pin/route.ts`
- **Estado:** ✅ Ya traducido
- **Tiempo:** 0 minutos

**Subtotal Inventario Core:** 1h 55min

---

#### 2.2 Kardex y Lotes ⏱️ 1 hora

##### Tarea 2.2.1: Kardex by Product
- **Archivo:** `src/app/api/inventory/kardex/[code]/route.ts`
- **Líneas a traducir:** ~12 mensajes
- **Tiempo estimado:** 30 minutos
- **Mensajes típicos:**
  - `"Missing product code"` → `"Falta código de producto"`
  - `"Product not found"` → `"Producto no encontrado"`
  - `"Failed to fetch kardex"` → `"Error al obtener kardex"`
  - `"No movements found"` → `"No se encontraron movimientos"`
- **Verificación:** Build

##### Tarea 2.2.2: Lots by Product
- **Archivo:** `src/app/api/inventory/lots/[code]/route.ts`
- **Líneas a traducir:** ~10 mensajes
- **Tiempo estimado:** 30 minutos
- **Mensajes típicos:**
  - `"Missing product code"` → `"Falta código de producto"`
  - `"Product not found"` → `"Producto no encontrado"`
  - `"Failed to fetch lots"` → `"Error al obtener lotes"`
  - `"No lots available"` → `"No hay lotes disponibles"`
- **Verificación:** Build

**Subtotal Kardex y Lotes:** 1h

---

**TOTAL PRIORIDAD 2:** 3 horas

---

### Prioridad 3: Delivery (IMPORTANTE) ⏱️ 2.5-3 horas
**Impacto:** Medio - Usado por módulo de delivery

#### 3.1 Delivery CRUD ⏱️ 2 horas

##### Tarea 3.1.1: Create & List Deliveries
- **Archivo:** `src/app/api/delivery/route.ts`
- **Líneas a traducir:** ~20 mensajes
- **Tiempo estimado:** 40 minutos
- **Mensajes típicos:**
  - `"Missing required fields"` → `"Faltan campos requeridos"`
  - `"Invalid delivery data"` → `"Datos de entrega inválidos"`
  - `"Order not found"` → `"Orden no encontrada"`
  - `"Failed to create delivery"` → `"Error al crear entrega"`
  - `"Delivery created successfully"` → `"Entrega creada exitosamente"`
  - `"Failed to fetch deliveries"` → `"Error al obtener entregas"`
- **Verificación:** Build + test delivery creation

##### Tarea 3.1.2: Get Delivery by ID
- **Archivo:** `src/app/api/delivery/[id]/route.ts`
- **Líneas a traducir:** ~8 mensajes
- **Tiempo estimado:** 15 minutos
- **Mensajes típicos:**
  - `"Delivery not found"` → `"Entrega no encontrada"`
  - `"Failed to fetch delivery"` → `"Error al obtener entrega"`
- **Verificación:** Build

##### Tarea 3.1.3: Assign Driver
- **Archivo:** `src/app/api/delivery/[id]/assign/route.ts`
- **Líneas a traducir:** ~15 mensajes
- **Tiempo estimado:** 25 minutos
- **Mensajes típicos:**
  - `"Missing driver_id"` → `"Falta driver_id"`
  - `"Delivery not found"` → `"Entrega no encontrada"`
  - `"Driver not found"` → `"Repartidor no encontrado"`
  - `"Driver not available"` → `"Repartidor no disponible"`
  - `"Failed to assign driver"` → `"Error al asignar repartidor"`
  - `"Driver assigned successfully"` → `"Repartidor asignado exitosamente"`
- **Verificación:** Build + test assignment

##### Tarea 3.1.4: Dispatch Delivery
- **Archivo:** `src/app/api/delivery/[id]/dispatch/route.ts`
- **Líneas a traducir:** ~12 mensajes
- **Tiempo estimado:** 20 minutos
- **Mensajes típicos:**
  - `"Delivery not found"` → `"Entrega no encontrada"`
  - `"No driver assigned"` → `"No hay repartidor asignado"`
  - `"Failed to dispatch"` → `"Error al despachar"`
  - `"Dispatched successfully"` → `"Despachado exitosamente"`
- **Verificación:** Build

##### Tarea 3.1.5: Deliver (Complete)
- **Archivo:** `src/app/api/delivery/[id]/deliver/route.ts`
- **Líneas a traducir:** ~12 mensajes
- **Tiempo estimado:** 20 minutos
- **Mensajes típicos:**
  - `"Delivery not found"` → `"Entrega no encontrada"`
  - `"Not dispatched yet"` → `"Aún no despachado"`
  - `"Failed to complete delivery"` → `"Error al completar entrega"`
  - `"Delivered successfully"` → `"Entregado exitosamente"`
- **Verificación:** Build

##### Tarea 3.1.6: Mark as Failed
- **Archivo:** `src/app/api/delivery/[id]/fail/route.ts`
- **Líneas a traducir:** ~12 mensajes
- **Tiempo estimado:** 20 minutos
- **Mensajes típicos:**
  - `"Missing reason"` → `"Falta razón"`
  - `"Delivery not found"` → `"Entrega no encontrada"`
  - `"Failed to mark as failed"` → `"Error al marcar como fallido"`
  - `"Marked as failed"` → `"Marcado como fallido"`
- **Verificación:** Build

**Subtotal Delivery CRUD:** 2h 20min

---

#### 3.2 Driver Queries ⏱️ 30 minutos

##### Tarea 3.2.1: Deliveries by Driver
- **Archivo:** `src/app/api/delivery/driver/[driverId]/route.ts`
- **Líneas a traducir:** ~8 mensajes
- **Tiempo estimado:** 15 minutos
- **Mensajes típicos:**
  - `"Driver not found"` → `"Repartidor no encontrado"`
  - `"Failed to fetch deliveries"` → `"Error al obtener entregas"`
- **Verificación:** Build

##### Tarea 3.2.2: Available Drivers
- **Archivo:** `src/app/api/drivers/available/route.ts`
- **Líneas a traducir:** ~5 mensajes
- **Tiempo estimado:** 10 minutos
- **Mensajes típicos:**
  - `"Failed to fetch available drivers"` → `"Error al obtener repartidores disponibles"`
- **Verificación:** Build

**Subtotal Driver Queries:** 25min

---

**TOTAL PRIORIDAD 3:** 2h 45min

---

### Prioridad 4: Terminales (MEDIO) ⏱️ 1-1.5 horas
**Impacto:** Medio - Usado en configuración inicial

#### 4.1 Terminal Management ⏱️ 1 hora

##### Tarea 4.1.1: Validate Terminal
- **Archivo:** `src/app/api/terminals/validate/route.ts`
- **Líneas a traducir:** ~12 mensajes
- **Tiempo estimado:** 20 minutos
- **Mensajes típicos:**
  - `"Missing activation_code"` → `"Falta código de activación"`
  - `"Invalid activation code"` → `"Código de activación inválido"`
  - `"Code already used"` → `"Código ya usado"`
  - `"Code expired"` → `"Código expirado"`
  - `"Failed to validate"` → `"Error al validar"`
- **Verificación:** Build

##### Tarea 4.1.2: Activate Terminal
- **Archivo:** `src/app/api/terminals/activate/route.ts`
- **Líneas a traducir:** ~15 mensajes
- **Tiempo estimado:** 25 minutos
- **Mensajes típicos:**
  - `"Missing required fields"` → `"Faltan campos requeridos"`
  - `"Invalid activation code"` → `"Código de activación inválido"`
  - `"Terminal already exists"` → `"Terminal ya existe"`
  - `"Failed to activate"` → `"Error al activar"`
  - `"Terminal activated successfully"` → `"Terminal activado exitosamente"`
- **Verificación:** Build + test activation

##### Tarea 4.1.3: Number Ranges (GET, POST)
- **Archivo:** `src/app/api/terminals/range/route.ts`
- **Líneas a traducir:** ~15 mensajes
- **Tiempo estimado:** 25 minutos
- **Mensajes típicos:**
  - `"Missing terminal_id"` → `"Falta terminal_id"`
  - `"Range not found"` → `"Rango no encontrado"`
  - `"Failed to allocate range"` → `"Error al asignar rango"`
  - `"Range allocated successfully"` → `"Rango asignado exitosamente"`
  - `"Range exhausted"` → `"Rango agotado"`
- **Verificación:** Build

**Subtotal Terminales:** 1h 10min

---

**TOTAL PRIORIDAD 4:** 1h 10min

---

### Prioridad 5: Notificaciones (BAJO) ⏱️ 1 hora
**Impacto:** Bajo - Funcionalidad secundaria

#### 5.1 Notification Management ⏱️ 1 hora

##### Tarea 5.1.1: Subscribe to Notifications
- **Archivo:** `src/app/api/notifications/subscribe/route.ts`
- **Líneas a traducir:** ~15 mensajes (POST + DELETE)
- **Tiempo estimado:** 25 minutos
- **Mensajes típicos:**
  - `"Missing subscription data"` → `"Faltan datos de suscripción"`
  - `"Invalid subscription"` → `"Suscripción inválida"`
  - `"Failed to subscribe"` → `"Error al suscribirse"`
  - `"Subscribed successfully"` → `"Suscrito exitosamente"`
  - `"Unsubscribed successfully"` → `"Desuscrito exitosamente"`
- **Verificación:** Build

##### Tarea 5.1.2: Notification Preferences (GET, PATCH)
- **Archivo:** `src/app/api/notifications/preferences/route.ts`
- **Líneas a traducir:** ~12 mensajes
- **Tiempo estimado:** 20 minutos
- **Mensajes típicos:**
  - `"Failed to fetch preferences"` → `"Error al obtener preferencias"`
  - `"Invalid preferences"` → `"Preferencias inválidas"`
  - `"Preferences updated"` → `"Preferencias actualizadas"`
- **Verificación:** Build

##### Tarea 5.1.3: Test Notification
- **Archivo:** `src/app/api/notifications/test/route.ts`
- **Líneas a traducir:** ~8 mensajes
- **Tiempo estimado:** 15 minutos
- **Mensajes típicos:**
  - `"Missing subscription"` → `"Falta suscripción"`
  - `"Failed to send test"` → `"Error al enviar prueba"`
  - `"Test sent successfully"` → `"Prueba enviada exitosamente"`
- **Verificación:** Build

**Subtotal Notificaciones:** 1h

---

**TOTAL PRIORIDAD 5:** 1 hora

---

### Prioridad 6: Admin Adicional (BAJO) ⏱️ 2-3 horas
**Impacto:** Bajo - Funcionalidades administrativas avanzadas

#### 6.1 Admin Endpoints Restantes ⏱️ 2.5 horas

##### Tarea 6.1.1: Analytics Endpoints
- **Archivos:** `src/app/api/admin/analytics/**/*.ts`
- **Líneas a traducir:** ~30 mensajes (múltiples endpoints)
- **Tiempo estimado:** 45 minutos
- **Mensajes típicos:**
  - `"Failed to fetch analytics"` → `"Error al obtener analíticas"`
  - `"Invalid date range"` → `"Rango de fechas inválido"`
  - `"No data available"` → `"No hay datos disponibles"`
- **Verificación:** Build

##### Tarea 6.1.2: Audit Endpoints
- **Archivos:** `src/app/api/admin/audit/**/*.ts`
- **Líneas a traducir:** ~20 mensajes
- **Tiempo estimado:** 30 minutos
- **Mensajes típicos:**
  - `"Failed to fetch audit logs"` → `"Error al obtener logs de auditoría"`
  - `"Invalid filters"` → `"Filtros inválidos"`
- **Verificación:** Build

##### Tarea 6.1.3: Dashboard Stats
- **Archivos:** `src/app/api/admin/dashboard/**/*.ts`
- **Líneas a traducir:** ~15 mensajes
- **Tiempo estimado:** 25 minutos
- **Mensajes típicos:**
  - `"Failed to fetch dashboard data"` → `"Error al obtener datos del dashboard"`
- **Verificación:** Build

##### Tarea 6.1.4: Reports
- **Archivos:** `src/app/api/admin/reports/**/*.ts`
- **Líneas a traducir:** ~20 mensajes
- **Tiempo estimado:** 30 minutos
- **Mensajes típicos:**
  - `"Failed to generate report"` → `"Error al generar reporte"`
  - `"Invalid report type"` → `"Tipo de reporte inválido"`
- **Verificación:** Build

##### Tarea 6.1.5: Tables Management
- **Archivos:** `src/app/api/admin/tables/**/*.ts`
- **Líneas a traducir:** ~15 mensajes
- **Tiempo estimado:** 25 minutos
- **Mensajes típicos:**
  - `"Failed to fetch tables"` → `"Error al obtener mesas"`
  - `"Table not found"` → `"Mesa no encontrada"`
- **Verificación:** Build

##### Tarea 6.1.6: Zones Management
- **Archivo:** `src/app/api/admin/zones/route.ts`
- **Líneas a traducir:** ~12 mensajes
- **Tiempo estimado:** 20 minutos
- **Mensajes típicos:**
  - `"Failed to fetch zones"` → `"Error al obtener zonas"`
  - `"Zone not found"` → `"Zona no encontrada"`
  - `"Zone created successfully"` → `"Zona creada exitosamente"`
- **Verificación:** Build

**Subtotal Admin Adicional:** 2h 55min

---

**TOTAL PRIORIDAD 6:** 3 horas

---

## 📋 Estrategia de Implementación

### Resumen de Tiempos
| Prioridad | Módulo | Tiempo Estimado | Endpoints |
|-----------|--------|-----------------|-----------|
| **P1** | APIs Core | 3 horas | 10 endpoints |
| **P2** | Inventario | 3 horas | 8 endpoints |
| **P3** | Delivery | 2h 45min | 8 endpoints |
| **P4** | Terminales | 1h 10min | 3 endpoints |
| **P5** | Notificaciones | 1 hora | 3 endpoints |
| **P6** | Admin Adicional | 3 horas | 15+ endpoints |
| **TOTAL** | **13-14 horas** | **47+ endpoints** |

### Fases de Ejecución

#### Fase 1: APIs Core (Semana 1 - Días 1-2) ⏱️ 3 horas
**Objetivo:** Traducir todos los mensajes que ven los usuarios finales

**Día 1 (2 horas):**
1. ✅ Autenticación completa (1h 15min)
   - Login, session, verify-terminal, verify-manager, terminals
2. ✅ Eventos (45min)
   - Event ingest, event stream

**Día 2 (1 hora):**
3. ✅ Órdenes (45min)
   - Order state, order lock
4. ✅ Verificación final
   - `npm run build`
   - `npm test`
   - Commit: "feat(i18n): translate core APIs to Spanish"

---

#### Fase 2: Inventario (Semana 1 - Días 3-4) ⏱️ 3 horas
**Objetivo:** Traducir módulo de inventario completo

**Día 3 (2 horas):**
1. ✅ Inventario Core (1h 55min)
   - Stock, receive, waste, stats, movements

**Día 4 (1 hora):**
2. ✅ Kardex y Lotes (1h)
   - Kardex by product, lots by product
3. ✅ Verificación final
   - `npm run build`
   - `npm test`
   - Commit: "feat(i18n): translate inventory APIs to Spanish"

---

#### Fase 3: Delivery y Terminales (Semana 2 - Días 1-2) ⏱️ 4 horas
**Objetivo:** Completar módulos secundarios

**Día 1 (2h 45min):**
1. ✅ Delivery completo (2h 45min)
   - CRUD, assign, dispatch, deliver, fail
   - Driver queries

**Día 2 (1h 10min):**
2. ✅ Terminales (1h 10min)
   - Validate, activate, ranges
3. ✅ Verificación final
   - `npm run build`
   - `npm test`
   - Commit: "feat(i18n): translate delivery and terminals APIs to Spanish"

---

#### Fase 4: Notificaciones y Admin (Semana 2 - Días 3-4) ⏱️ 4 horas
**Objetivo:** Completar funcionalidades administrativas

**Día 3 (1 hora):**
1. ✅ Notificaciones (1h)
   - Subscribe, preferences, test

**Día 4 (3 horas):**
2. ✅ Admin adicional (3h)
   - Analytics, audit, dashboard, reports, tables, zones
3. ✅ Verificación final completa
   - `npm run build`
   - `npm test`
   - Pruebas manuales de flujos críticos
   - Commit: "feat(i18n): complete Spanish translation for all APIs"

---

## 🔧 Metodología de Trabajo

### Para cada endpoint:

#### 1. Preparación (2 min)
```bash
# Abrir archivo
code src/app/api/[ruta]/route.ts
```

#### 2. Identificar mensajes en inglés (3 min)
Buscar patrones:
```typescript
{ error: 'Failed to...' }
{ error: 'Internal server error' }
{ error: 'Validation error' }
{ error: 'Invalid...' }
{ error: 'Not found' }
{ message: 'Success...' }
```

#### 3. Traducir a español (5 min)
Aplicar glosario:
```typescript
{ error: 'Error al...' }
{ error: 'Error interno del servidor' }
{ error: 'Error de validación' }
{ error: 'Inválido...' }
{ error: 'No encontrado' }
{ message: 'Éxito...' }
```

#### 4. Verificar (5 min)
```bash
# Build
npm run build

# Tests (si existen)
npm test -- [archivo-test]

# Commit
git add .
git commit -m "feat(i18n): translate [endpoint] to Spanish"
```

**Tiempo total por endpoint:** 15-20 minutos

---

## 📝 Glosario de Traducción

### Términos Técnicos
| Inglés | Español |
|--------|---------|
| Failed to... | Error al... |
| Internal server error | Error interno del servidor |
| Validation error | Error de validación |
| Invalid data | Datos inválidos |
| Not found | No encontrado |
| Unauthorized | No autorizado |
| Forbidden | Acceso denegado |
| Bad request | Solicitud incorrecta |
| Required field | Campo requerido |
| Must be | Debe ser |
| Already exists | Ya existe |
| Cannot be | No puede ser |

### Términos de Negocio
| Inglés | Español |
|--------|---------|
| Employee | Empleado |
| Product | Producto |
| Promotion | Promoción |
| Driver | Repartidor/Conductor |
| Order | Orden/Pedido |
| Delivery | Entrega/Delivery |
| Terminal | Terminal |
| Inventory | Inventario |
| Stock | Stock/Existencias |
| Waste | Merma |
| Receipt | Recepción |

---

## ✅ Checklist de Ejecución

### Fase 1: APIs Core ⏱️ 3 horas
- [x] **1.1 Autenticación** (1h 15min)
  - [x] 1.1.1 Login endpoint (15min) ✅ Ya estaba traducido
  - [x] 1.1.2 Session endpoints (20min) ✅ Ya estaba traducido
  - [x] 1.1.3 Terminal verification (15min) ✅ Ya estaba traducido
  - [x] 1.1.4 Manager verification (15min) ✅ Ya estaba traducido
  - [x] 1.1.5 Terminals list (10min) ✅ Sin mensajes para traducir
  - [x] ✅ Build exitoso
  - [x] ✅ Tests pasando
  - [x] ✅ Commit realizado

- [x] **1.2 Eventos** (55min)
  - [x] 1.2.1 Event ingest (45min) ✅ Ya estaba traducido
  - [x] 1.2.2 Event stream (10min) ✅ Sin mensajes para traducir
  - [x] ✅ Build exitoso
  - [x] ✅ Tests pasando
  - [x] ✅ Commit realizado

- [x] **1.3 Órdenes** (45min)
  - [x] 1.3.1 Order state (15min) ✅ Traducido
  - [x] 1.3.2 Order lock (30min) ✅ Traducido
  - [x] ✅ Build exitoso
  - [x] ✅ Tests pasando
  - [x] ✅ Commit realizado

### Fase 2: Inventario ⏱️ 3 horas
- [x] **2.1 Inventario Core** (1h 55min)
  - [x] 2.1.1 Stock endpoint (20min) ✅ Ya estaba traducido
  - [x] 2.1.2 Receive goods (30min) ✅ Ya estaba traducido
  - [x] 2.1.3 Waste registration (30min) ✅ Ya estaba traducido
  - [x] 2.1.4 Inventory stats (15min) ✅ Ya estaba traducido
  - [x] 2.1.5 Recent movements (20min) ✅ Ya estaba traducido
  - [x] ✅ Build exitoso
  - [x] ✅ Tests pasando
  - [x] ✅ Commit realizado

- [x] **2.2 Kardex y Lotes** (1h)
  - [x] 2.2.1 Kardex by product (30min) ✅ Ya estaba traducido
  - [x] 2.2.2 Lots by product (30min) ✅ Ya estaba traducido
  - [x] ✅ Build exitoso
  - [x] ✅ Tests pasando
  - [x] ✅ Commit realizado

### Fase 3: Delivery y Terminales ⏱️ 4 horas
- [x] **3.1 Delivery CRUD** (2h 20min)
  - [x] 3.1.1 Create & list deliveries (40min) ✅ Traducido
  - [x] 3.1.2 Get delivery by ID (15min) ✅ Traducido
  - [x] 3.1.3 Assign driver (25min) ✅ Traducido
  - [x] 3.1.4 Dispatch delivery (20min) ✅ Traducido
  - [x] 3.1.5 Deliver (complete) (20min) ✅ Traducido
  - [x] 3.1.6 Mark as failed (20min) ✅ Traducido
  - [x] ✅ Build exitoso
  - [x] ✅ Tests pasando
  - [x] ✅ Commit realizado

- [x] **3.2 Driver Queries** (25min)
  - [x] 3.2.1 Deliveries by driver (15min) ✅ Sin mensajes para traducir
  - [x] 3.2.2 Available drivers (10min) ✅ Sin mensajes para traducir
  - [x] ✅ Build exitoso
  - [x] ✅ Commit realizado

- [x] **4.1 Terminal Management** (1h 10min)
  - [x] 4.1.1 Validate terminal (20min) ✅ Ya estaba traducido
  - [x] 4.1.2 Activate terminal (25min) ✅ Ya estaba traducido
  - [x] 4.1.3 Number ranges (25min) ✅ Traducido
  - [x] ✅ Build exitoso
  - [x] ✅ Tests pasando
  - [x] ✅ Commit realizado

### Fase 4: Notificaciones y Admin ⏱️ 4 horas
- [x] **5.1 Notification Management** (1h)
  - [x] 5.1.1 Subscribe to notifications (25min) ✅ Traducido
  - [x] 5.1.2 Notification preferences (20min) ✅ Traducido
  - [x] 5.1.3 Test notification (15min) ✅ Traducido
  - [x] ✅ Build exitoso
  - [x] ✅ Commit realizado

- [x] **6.1 Admin Endpoints** (2h 55min)
  - [x] 6.1.1 Analytics endpoints (45min) ✅ Traducido
  - [x] 6.1.2 Audit endpoints (30min) ✅ Traducido
  - [x] 6.1.3 Dashboard stats (25min) ✅ Traducido
  - [x] 6.1.4 Reports (30min) ✅ Traducido
  - [x] 6.1.5 Tables management (25min) ✅ Traducido
  - [x] 6.1.6 Zones management (20min) ✅ Traducido
  - [x] ✅ Build exitoso
  - [x] ✅ Tests pasando
  - [x] ✅ Commit realizado

### Verificación Final
- [x] ✅ Todos los builds exitosos
- [x] ✅ Todos los tests pasando
- [x] ✅ Pruebas manuales de flujos críticos
- [x] ✅ Documentación actualizada
- [x] ✅ **Traducción 100% completa** 🎉

---

**Última actualización:** 20 Enero 2026  
**Estado:** ✅ TODAS LAS FASES COMPLETADAS - Traducción 100% completa

## 🎉 RESUMEN FINAL

**Total traducido:** 47+ endpoints en 6 fases
- ✅ Fase 1: APIs Core (10 endpoints)
- ✅ Fase 2: Inventario (8 endpoints)
- ✅ Fase 3: Delivery y Terminales (11 endpoints)
- ✅ Fase 4: Notificaciones (3 endpoints)
- ✅ Fase 5: Admin CRUD (17 endpoints)
- ✅ Fase 6: Admin Adicional (10 endpoints)

**Compilación:** ✅ Exitosa sin errores  
**Tests:** ✅ Todos pasando  
**Listo para producción:** ✅ Sí

### Archivos Traducidos en Fase 6:
1. `src/app/api/admin/analytics/comparison/route.ts` ✅
2. `src/app/api/admin/analytics/history/route.ts` ✅
3. `src/app/api/admin/analytics/realtime/route.ts` ✅
4. `src/app/api/admin/analytics/top-products/route.ts` ✅
5. `src/app/api/admin/audit/events/route.ts` ✅
6. `src/app/api/admin/dashboard/stats/route.ts` ✅
7. `src/app/api/admin/reports/route.ts` ✅
8. `src/app/api/admin/tables/route.ts` ✅
9. `src/app/api/admin/zones/route.ts` ✅

### Patrón de Traducción Aplicado:
- "Failed to..." → "Error al..."
- "Internal server error" → "Error interno del servidor"
- "Invalid..." → "Inválido..."
- "Not found" → "No encontrado"
- "Already exists" → "Ya existe"
- "Missing..." → "Falta..." / "Faltan..."

---

## 📚 Referencias Rápidas

### Comandos Útiles
```bash
# Verificar compilación
npm run build

# Ejecutar tests
npm test

# Ejecutar tests específicos
npm test -- src/app/api/auth

# Ver archivos modificados
git status

# Commit de cambios
git add .
git commit -m "feat(i18n): translate [módulo] to Spanish"
```

### Patrones de Búsqueda (VS Code)
```regex
# Buscar mensajes en inglés
error: ['"].*['"]
message: ['"].*['"]

# Buscar NextResponse.json con error
NextResponse\.json\(\s*\{\s*error:

# Buscar return con error
return.*\{\s*error:
```

### Atajos de Teclado
- `Ctrl+Shift+F` - Buscar en todos los archivos
- `Ctrl+H` - Buscar y reemplazar
- `F2` - Renombrar símbolo
- `Ctrl+D` - Seleccionar siguiente ocurrencia

### Archivos de Referencia
- **Glosario completo:** Ver sección "📝 Glosario de Traducción" arriba
- **Ejemplos traducidos:** `src/app/api/admin/employees/route.ts`
- **Middleware auth:** `src/core/middleware/admin-auth.ts`

### Contacto y Soporte
- **Documentación:** `.kiro/specs/admin-panel-crud/`
- **Issues:** Reportar en el repositorio
- **Preguntas:** Consultar con el equipo

---

## 🎯 Próximos Pasos

1. **Revisar este plan** con el equipo
2. **Asignar responsables** para cada fase
3. **Comenzar Fase 1** - APIs Core (3 horas)
4. **Seguir checklist** marcando tareas completadas
5. **Reportar progreso** diariamente

**¿Listo para empezar?** 🚀

Comienza con: `Tarea 1.1.1: Login Endpoint` (15 minutos)
