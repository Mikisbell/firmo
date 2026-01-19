 son sueñ# 🎯 PARK POS — Master Steering

> **Este archivo guía TODO el desarrollo del proyecto. Léelo SIEMPRE antes de cualquier tarea.**

---

## 📋 CONTEXTO RÁPIDO (30 segundos)

**PARK POS** = Sistema POS offline-first para pollerías peruanas
- **Arquitectura:** Event Sourcing + Device-SoT + IndexedDB/PostgreSQL
- **Stack:** Next.js 15 + Prisma + Dexie + Supabase + Tailwind
- **Fase actual:** P0 (MVP) ✅ + P1 (Multi-Terminal) ✅ → P2 pendiente

**Reglas de oro:**
- 💰 Dinero SIEMPRE en centavos (int), NUNCA float
- 📱 15 terminales + 1 caja + KDS screens
- 🔌 Funciona 100% offline, sincroniza cuando hay conexión

**Tests:** 214 unit + 10 stress + 52 E2E (Playwright)

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### P0 — MVP (Antes de producción)

#### 💰 SEGURIDAD FINANCIERA (CRÍTICO) → `docs/02-architecture/MONEY_SAFETY.md`
- [x] **Event Deduplication** — Tabla `processed_events` + check en projectEvent
- [x] **Outbox Pattern** — Tabla `event_outbox` + worker de publicación
- [x] **Order Number Ranges** — Tabla `terminal_number_ranges` + allocation
- [x] **Server Validation** — validateEvent() para pagos, facturas, items, voids
- [x] **Timezone Handling** — getBusinessDate() con hora de corte 6AM
- [x] **Límites de Seguridad** — MAX_ITEMS, MAX_TOTAL, validación cliente+server

#### Core Event Sourcing
- [x] Eventos base (30+ tipos definidos)
- [x] SyncClient con retry + SSE
- [x] Reducers: sale.reducer, shift.reducer
- [x] **Circuit Breaker** → `docs/05-improvements/MEJORAS.md#4`
- [x] **Performance Indices** → `docs/05-improvements/MEJORAS.md#10`

#### UI Roles
- [x] Caja (POS principal)
- [x] KDS (Kitchen Display)
- [x] Mesero (Waiter)
- [x] Split Bill UI — División por items + equitativo
- [x] Service Worker para PWA — Offline cache + update prompt

#### Infraestructura
- [x] **Rate Limiting** → `docs/05-improvements/MEJORAS.md#6`
- [x] **IndexedDB cleanup** → `docs/05-improvements/GAPS.md#8`

#### Testing (Enero 2026)
- [x] **E2E Tests (Playwright)** — 52 tests (chromium + mobile)
- [x] **Stress Tests** — 10 tests de carga
- [x] **Inventory Admin Panel** — `/admin/inventario` con PIN
- [x] **Schema Completeness** — Eventos de inventario, servicios, migraciones

### P1 — Multi-Terminal ✅ COMPLETADO

- [x] **Conflict Resolution** → `docs/05-improvements/MEJORAS.md#5` ✅ (Fases 1-4 completas, 21 tests)
- [x] **Event Schema Versioning** → `docs/05-improvements/MEJORAS.md#2` ✅ (19 tests, migraciones V1→V2)
- [x] **Snapshots/Compaction** → `docs/05-improvements/MEJORAS.md#8` ✅ (13 tests, rebuild optimizado)
- [x] **Observabilidad** → `docs/04-operations/OBSERVABILIDAD.md` ✅ (24 tests, métricas + logger)
- [x] Terminal registration flow
- [x] Role-based event validation ✅ (28 tests, 5 property-based)
- [x] **JWT Authentication** → `docs/02-architecture/SECURITY.md#5.7` ✅ (8 tests, PIN lockout + sessions)
- [x] **Branded Types** → `src/core/types/shared.ts` ✅ (15 tests, Centavos/OrderId/BusinessDate)

### P2 — Growth (Futuro)

- [x] **Premium Dashboard** → `.kiro/specs/premium-dashboard/` ✅ (98 analytics + notifications tests, Dashboard UI completo)
- [x] **Delivery Module** → `.kiro/specs/delivery-module/` ✅ (Services, APIs, UIs, Notifications, POS Integration)
- [x] **Admin Panel CRUD** → `.kiro/specs/admin-panel-crud/` ✅ (Employees & Products CRUD completo, 100% tests passing)
- [ ] Saga Pattern para flujos complejos
- [ ] Property-Based Testing
- [ ] Multi-tenant improvements

---

## 🔄 FLUJO DE TRABAJO AUTOMÁTICO

Cuando el usuario diga **"siguiente tarea"** o **"continuar"**:

1. **Lee este checklist** y encuentra el primer item `[ ]` sin completar
2. **Lee la documentación referenciada** (solo esa sección)
3. **Implementa** siguiendo el código de ejemplo en la doc
4. **Valida** con tests o verificación manual
5. **Marca como completado** `[x]` en este archivo
6. **Reporta** qué se hizo y cuál es la siguiente tarea

### Comando: "status"
Muestra el progreso actual del checklist.

### Comando: "siguiente tarea"
Ejecuta el flujo automático con la siguiente tarea pendiente.

### Comando: "tarea X"
Ejecuta una tarea específica (ej: "tarea Outbox Pattern").

---

## 📁 ESTRUCTURA DE DOCUMENTACIÓN

```
docs/
├── README.md                    # Índice navegable
├── 01-vision/                   # Qué es el proyecto
│   ├── CONTEXT.md              # Contexto del negocio
│   └── SPECS.md                # Especificaciones
├── 02-architecture/             # Cómo está construido
│   ├── ARCHITECTURE.md         # Arquitectura general
│   ├── EVENTS.md               # Sistema de eventos
│   ├── SECURITY.md             # Seguridad
│   ├── PERFORMANCE.md          # Optimizaciones
│   ├── MONEY_SAFETY.md         # 🔴 Riesgos financieros
│   ├── AUDITORIA_CRITICA.md    # 🔴 10 problemas críticos
│   └── IMPLEMENTACION_PASO_A_PASO.md  # 🔴 Guía de 10 fases
├── 03-features/                 # Funcionalidades
│   ├── FLUJO_CAJERO.md         # Caja, Split Bill
│   ├── FLUJO_MESERO.md         # 15 meseros, zonas, barra
│   ├── FLUJO_KDS.md            # 5 estaciones (Parrilla, Bar, etc.)
│   ├── FLUJO_ADMIN.md          # Panel de administración
│   ├── FLUJO_OFFLINE_SYNC.md   # Sincronización offline
│   ├── FLUJO_DEVOLUCIONES.md   # Devoluciones y NC
│   ├── FLUJO_DESCUENTOS.md     # Descuentos y promociones
│   ├── FLUJO_REPORTES.md       # Reportes y cierre
│   ├── FLUJO_AUTENTICACION.md  # Login, roles, PINs
│   ├── FLUJO_CONFIGURACION.md  # Setup terminal/tenant
│   ├── PROMOTIONS_DSL.md       # DSL de promociones
│   ├── GROWTH.md               # Features futuras
│   └── NAVEGACION_UX.md        # UX/UI
├── 04-operations/               # Operación
│   └── OBSERVABILIDAD.md       # Monitoring
├── 05-improvements/             # Mejoras planificadas
│   ├── GAPS.md                 # 23 huecos identificados
│   ├── MEJORAS.md              # 10 mejoras arquitectónicas
│   ├── ROADMAP.md              # Plan de implementación
│   ├── ESTADO.md               # Status actual
│   └── RESUMEN.md              # Resumen ejecutivo
├── adr/                         # Decisiones arquitectónicas
└── CHANGELOG.md                 # Historial
```

---

## ⚡ REFERENCIAS RÁPIDAS

| Necesito... | Archivo |
|-------------|---------|
| **🔴 AUDITORÍA CRÍTICA** | `docs/02-architecture/AUDITORIA_CRITICA.md` |
| **🔴 SEGURIDAD FINANCIERA** | `docs/02-architecture/MONEY_SAFETY.md` |
| **🔴 IMPLEMENTACIÓN PASO A PASO** | `docs/02-architecture/IMPLEMENTACION_PASO_A_PASO.md` |
| **🔴 Prisma Naming Convention** | `docs/02-architecture/PRISMA_NAMING.md` |
| **🔴 Role-Based Validation** | `docs/02-architecture/SECURITY.md#5-role-based-event-validation` |
| **🔴 Branded Types (Type Safety)** | `src/core/types/shared.ts` |
| Entender el negocio | `docs/01-vision/CONTEXT.md` |
| Ver arquitectura | `docs/02-architecture/ARCHITECTURE.md` |
| Lista de eventos | `docs/02-architecture/EVENTS.md` |
| Gaps críticos | `docs/05-improvements/GAPS.md` |
| Mejoras a implementar | `docs/05-improvements/MEJORAS.md` |
| Plan de trabajo | `docs/05-improvements/ROADMAP.md` |
| **Flujo Cajero/Split Bill** | `docs/03-features/FLUJO_CAJERO.md` |
| **Flujo Mesero (15 terminales)** | `docs/03-features/FLUJO_MESERO.md` |
| **Flujo KDS (5 estaciones)** | `docs/03-features/FLUJO_KDS.md` |
| **Flujo Admin (Panel completo)** | `docs/03-features/FLUJO_ADMIN.md` |
| **Admin Panel CRUD** | `.kiro/specs/admin-panel-crud/` |
| **Flujo Offline/Sync** | `docs/03-features/FLUJO_OFFLINE_SYNC.md` |
| **Flujo Devoluciones** | `docs/03-features/FLUJO_DEVOLUCIONES.md` |
| **Flujo Descuentos** | `docs/03-features/FLUJO_DESCUENTOS.md` |
| **Flujo Reportes** | `docs/03-features/FLUJO_REPORTES.md` |
| **Flujo Autenticación** | `docs/03-features/FLUJO_AUTENTICACION.md` |
| **Flujo Configuración** | `docs/03-features/FLUJO_CONFIGURACION.md` |
| **Premium Dashboard** | `docs/03-features/FLUJO_PREMIUM_DASHBOARD.md` |
| Schema Prisma | `prisma/schema.prisma` |
| Eventos TypeScript | `src/core/domain/events.ts` |
| Sync Client | `src/core/sync/client.ts` |
| API Ingest | `src/app/api/events/ingest/route.ts` |
| **E2E Tests** | `e2e/` |
| **Inventory Services** | `src/core/inventory/` |
| **Admin Panel** | `src/app/admin/inventario/` |
| **Role Permissions** | `src/core/validation/role-permissions.ts` |

---

## 🚨 REGLAS CRÍTICAS

1. **NO crear archivos .md nuevos** salvo que el usuario lo pida
2. **NO leer toda la documentación** — solo lo necesario para la tarea
3. **Código mínimo** — implementar solo lo esencial
4. **Validar siempre** — usar getDiagnostics después de cambios
5. **Actualizar checklist** — marcar `[x]` al completar
6. **🔴 PRISMA NAMING** — Usar nombres EXACTOS del schema.prisma (NO camelCase automático)

---

## 🛑 REGLAS DE AUDITORÍA DE CÓDIGO (CRÍTICO)

**ANTES de proponer eliminar o modificar código existente:**

1. **ENTENDER EL PROPÓSITO** — Leer el código completo y su contexto
2. **BUSCAR USOS** — Verificar si el código se usa en otros lugares
3. **VERIFICAR CONVENCIONES** — Variables con prefijo `_` son intencionalmente no usadas (convención TypeScript)
4. **CONSOLE.LOG DE DEBUG** — En componentes críticos (backup, restore, auth) son útiles para troubleshooting
5. **CONSTANTES DUPLICADAS** — Verificar si ya existe una versión centralizada antes de proponer cambios
6. **TYPE CASTS** — Verificar si la función destino ya acepta el tipo antes de proponer cambios

**NUNCA proponer:**
- ❌ Eliminar variables `_prefixed` — son intencionales
- ❌ Eliminar console.log en componentes de diagnóstico/backup
- ❌ Cambiar código que funciona sin entender su propósito
- ❌ Crear nuevas constantes si ya existen centralizadas

**SIEMPRE verificar:**
- ✅ `src/core/config/terminal.ts` — DEFAULT_TENANT_ID ya existe
- ✅ `src/core/domain/money.ts` — formatCents ya acepta `number | Cents`
- ✅ `src/core/types/shared.ts` — Branded Types y helpers ya existen
- ✅ Funciones con `_` prefijo — son reservadas para uso futuro

**Archivos de configuración centralizada:**
| Constante | Ubicación |
|-----------|-----------|
| DEFAULT_TENANT_ID | `src/core/config/terminal.ts` |
| EMPLOYEE_IDS | `src/core/config/terminal.ts` |
| TERMINAL_CONFIG | `src/core/config/terminal.ts` |
| Branded Types | `src/core/types/shared.ts` |
| Money helpers | `src/core/domain/money.ts` |

---

**Última actualización:** 19 Enero 2026  
**Próxima tarea pendiente:** P2 - Saga Pattern o Multi-tenant improvements  
**Última implementación:** Admin Panel CRUD (Employees & Products) ✅

---

## 🐛 FIXES RECIENTES

### 19 Enero 2026 - Admin Panel CRUD Implementation
**Implementación:** CRUD completo para Employees y Products en Panel de Administración  
**Features:**
- APIs REST con validación Zod
- Frontend con formularios de creación/edición
- PIN hashing con SHA-256 + salt
- Money safety (centavos integer)
- Audit trail para todas las operaciones
- Catalog versioning para productos
- Soft deletes (is_active flag)
**Tests:** 100% integration tests passing ✅  
**Archivos:** `.kiro/specs/admin-panel-crud/`  
**Status:** ✅ COMPLETADO - Listo para producción

### 19 Enero 2026 - KDS Order Submission Fix
**Problema:** Pedidos del mesero no llegaban a KDS (cocina, bar, parrilla) ni a caja  
**Causa:** Evento `ORDER_SUBMITTED` no procesado por reducer  
**Solución:** Agregado case `ORDER_SUBMITTED` en `sale.reducer.ts`  
**Tests:** 7 unit tests + 5 E2E tests ✅  
**Archivos:** `.kiro/specs/kds-order-submission-fix/`  
**Status:** ✅ FIXED - Listo para producción

**Flujo completo ahora funciona:**
```
Mesero → Enviar a Cocina → ORDER_SUBMITTED → Reducer procesa → 
  ├─> KDS Parrilla ve items de PARRILLA
  ├─> KDS Cocina ve items de COCINA
  ├─> KDS Bar ve items de BAR
  └─> Caja ve orden en "Órdenes Pendientes"
```