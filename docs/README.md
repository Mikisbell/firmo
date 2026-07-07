# 📚 FIRMO POS — Documentación

> Sistema POS offline-first para pollerías peruanas

---

## 🚀 Inicio Rápido

| Quiero... | Ir a |
|-----------|------|
| **Ver TODA la documentación** | [📚 Índice Completo](INDICE_COMPLETO.md) ⭐ |
| Entender qué es FIRMO POS | [Contexto](01-vision/CONTEXT.md) |
| Ver la arquitectura | [Arquitectura](02-architecture/ARCHITECTURE.md) |
| Conocer los eventos | [Eventos](02-architecture/EVENTS.md) |
| Ver qué falta por hacer | [Gaps](05-improvements/GAPS.md) |
| Ver el plan de trabajo completo | [🗺️ Roadmap Consolidado 2026](ROADMAP_CONSOLIDADO_2026.md) |
| Ver el roadmap original | [Roadmap](05-improvements/ROADMAP.md) |

---

## 📁 Estructura

### 01-vision/ — Qué es el proyecto
- [CONTEXT.md](01-vision/CONTEXT.md) — Contexto del negocio y problema a resolver
- [SPECS.md](01-vision/SPECS.md) — Especificaciones funcionales detalladas

### 02-architecture/ — Cómo está construido
- [ARCHITECTURE.md](02-architecture/ARCHITECTURE.md) — Arquitectura Event Sourcing + Offline-First
- [EVENTS.md](02-architecture/EVENTS.md) — Catálogo de 30+ eventos del sistema
- [SECURITY.md](02-architecture/SECURITY.md) — Modelo de seguridad y autenticación
- [PERFORMANCE.md](02-architecture/PERFORMANCE.md) — Optimizaciones y snapshots
- [MONEY_SAFETY.md](02-architecture/MONEY_SAFETY.md) — 🆕 8 riesgos de pérdida de dinero y soluciones
- [AUDITORIA_CRITICA.md](02-architecture/AUDITORIA_CRITICA.md) — 🆕 10 problemas críticos en código actual
- [IMPLEMENTACION_PASO_A_PASO.md](02-architecture/IMPLEMENTACION_PASO_A_PASO.md) — 🆕 Guía de 10 fases para producción

### 03-features/ — Funcionalidades

#### Operación Diaria
- [FLUJO_CAJERO.md](03-features/FLUJO_CAJERO.md) — Análisis de Caja y Split Bill (10 escenarios)
- [FLUJO_MESERO.md](03-features/FLUJO_MESERO.md) — 15 meseros, zonas, 15 escenarios, barra
- [FLUJO_KDS.md](03-features/FLUJO_KDS.md) — 5 estaciones (Parrilla, Freidora, Cocina Fría, Bar, Expedición)
- [FLUJO_MESAS_LAYOUT.md](03-features/FLUJO_MESAS_LAYOUT.md) — 🆕 Mapa visual de 50 mesas, zonas, unir/dividir
- [FLUJO_RESERVAS.md](03-features/FLUJO_RESERVAS.md) — 🆕 Reservaciones con WhatsApp y depósitos

#### Administración
- [FLUJO_ADMIN.md](03-features/FLUJO_ADMIN.md) — Panel de administración completo (10 escenarios)
- [FLUJO_INVENTARIO.md](03-features/FLUJO_INVENTARIO.md) — 🆕 Control de stock, recetas, mermas, COGS
- [FLUJO_EMPLEADOS_TURNOS.md](03-features/FLUJO_EMPLEADOS_TURNOS.md) — 🆕 Horarios, asistencia, horas extra
- [FLUJO_REPORTES.md](03-features/FLUJO_REPORTES.md) — Diseño de reportes y cierre de día

#### Finanzas
- [FLUJO_FACTURACION_SUNAT.md](03-features/FLUJO_FACTURACION_SUNAT.md) — 🆕 Boletas, facturas, NC, contingencia
- [FLUJO_CAJA_CHICA.md](03-features/FLUJO_CAJA_CHICA.md) — 🆕 Gastos menores con aprobación
- [FLUJO_PROPINAS.md](03-features/FLUJO_PROPINAS.md) — 🆕 Tips individuales o pool
- [FLUJO_DEVOLUCIONES.md](03-features/FLUJO_DEVOLUCIONES.md) — Diseño de devoluciones y notas de crédito
- [FLUJO_DESCUENTOS.md](03-features/FLUJO_DESCUENTOS.md) — Gap analysis de descuentos vs PROMOTIONS_DSL

#### Sistema
- [FLUJO_OFFLINE_SYNC.md](03-features/FLUJO_OFFLINE_SYNC.md) — Sincronización offline, 7 escenarios
- [FLUJO_AUTENTICACION.md](03-features/FLUJO_AUTENTICACION.md) — Login, roles, permisos, PINs
- [FLUJO_CONFIGURACION.md](03-features/FLUJO_CONFIGURACION.md) — Setup de terminal, tenant, onboarding

#### Crecimiento
- [FLUJO_DELIVERY.md](03-features/FLUJO_DELIVERY.md) — 🆕 Delivery propio + Rappi/PedidosYa
- [FLUJO_CRM_FIDELIZACION.md](03-features/FLUJO_CRM_FIDELIZACION.md) — 🆕 CRM con IA multi-proveedor
- [FLUJO_PREMIUM_DASHBOARD.md](03-features/FLUJO_PREMIUM_DASHBOARD.md) — 🆕 Analytics tiempo real + Push Notifications
- [PROMOTIONS_DSL.md](03-features/PROMOTIONS_DSL.md) — DSL para promociones y descuentos
- [GROWTH.md](03-features/GROWTH.md) — Features de crecimiento (P2)
- [NAVEGACION_UX.md](03-features/NAVEGACION_UX.md) — Flujos de navegación UI/UX

### 04-operations/ — Operación del sistema
- [OBSERVABILIDAD.md](04-operations/OBSERVABILIDAD.md) — Monitoring con OpenTelemetry

### 05-improvements/ — Mejoras planificadas
- [GAPS.md](05-improvements/GAPS.md) — 23 huecos críticos identificados
- [MEJORAS.md](05-improvements/MEJORAS.md) — 10 mejoras arquitectónicas
- [ROADMAP.md](05-improvements/ROADMAP.md) — Plan de implementación por fases
- [ESTADO.md](05-improvements/ESTADO.md) — Estado actual del proyecto
- [RESUMEN.md](05-improvements/RESUMEN.md) — Resumen ejecutivo

### 06-deployment/ — Despliegue a Producción
- [DEPLOYMENT.md](06-deployment/DEPLOYMENT.md) — 🆕 Guía completa de despliegue a Vercel + Supabase

### adr/ — Decisiones Arquitectónicas
- [001-event-sourcing.md](adr/001-event-sourcing.md)
- [002-device-sot.md](adr/002-device-sot.md)
- [003-dexie-indexeddb.md](adr/003-dexie-indexeddb.md)
- [004-supabase-postgres.md](adr/004-supabase-postgres.md)
- [005-sse-sync.md](adr/005-sse-sync.md)
- [006-money-cents.md](adr/006-money-cents.md)
- [007-order-lifecycle.md](adr/007-order-lifecycle.md)
- [008-outbox-pattern.md](adr/008-outbox-pattern.md)

---

## 📊 Estado del Proyecto

| Fase | Progreso | Estado |
|------|----------|--------|
| P0 — MVP | 100% | ✅ Completado |
| P1 — Multi-Terminal | 100% | ✅ Completado |
| P2 — Growth | 35% | 🟡 En progreso |
| P3 — Enterprise | 0% | ⬜ Planificado |

**Tests:** 214 unit + 10 stress + 52 E2E (Playwright)

**Próxima tarea:** P2 - Saga Pattern + Property-Based Testing

**Ver roadmap completo:** [🗺️ Roadmap Consolidado 2026](ROADMAP_CONSOLIDADO_2026.md)

---

## 🔧 Para Desarrolladores

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Base de datos
npx prisma migrate dev
npx prisma db seed

# Tests unitarios (101 tests)
npm run test

# Tests de estrés (10 tests)
npx tsx scripts/stress-test.ts

# Tests E2E (52 tests - requiere servidor corriendo)
npm run dev  # En una terminal
npx playwright test  # En otra terminal
```

**Archivos clave:**
- `prisma/schema.prisma` — Modelo de datos (63 tablas)
- `src/core/domain/events.ts` — Definición de eventos (30+ tipos)
- `src/core/domain/inventory-events.ts` — Eventos de inventario (7 tipos)
- `src/core/sync/client.ts` — Cliente de sincronización
- `src/core/projections/` — Reducers de proyecciones
- `e2e/` — Tests E2E con Playwright (52 tests)
- `src/core/inventory/` — Servicios de inventario (4 servicios)
- `src/app/admin/inventario/` — Panel de inventario con PIN

---

*Última actualización: 6 de Enero 2026*
