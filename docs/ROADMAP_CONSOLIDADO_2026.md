# PARK POS — Roadmap 2026

**Version:** 3.0.0
**Fecha:** 2 Marzo 2026
**Estado:** P2 Growth ~85% completado

---

## Resumen Ejecutivo

| Fase | Progreso | Estado | Fecha |
|------|----------|--------|-------|
| **P0 — MVP** | 100% | Completado | Ene 2026 |
| **P1 — Multi-Terminal** | 100% | Completado | Feb 2026 |
| **P2 — Growth** | ~85% | En progreso | En curso |
| **P2.5 — Hardening** | 100% | Completado | Mar 1 2026 |
| **P3 — Production Ready** | 0% | Siguiente | Mar-Abr 2026 |
| **P4 — Enterprise** | 0% | Planificado | Q2 2026 |

### Metricas Actuales (Mar 2 2026)

| Metrica | Valor |
|---------|-------|
| Test files | 301 |
| Tests totales | 4,882 (0 fallas) |
| E2E specs | 31 (Playwright) |
| Property tests | 22+ (fast-check) |
| TypeScript | 0 errores (strict) |
| Event types | 73 |
| Modelos Prisma | 123 |
| API endpoints | 261 |
| Paginas | 83 |
| Build | OK (Next.js 16.1 + Turbopack) |

---

## Completado (P0 + P1 + P2 parcial + P2.5)

### P0: MVP (Dic 2025 - Ene 2026)
- Event Sourcing completo (Dexie + PostgreSQL)
- Sync offline con SyncClient + Circuit Breaker
- POS: ordenes, pagos, split bill, comprobantes
- Mesero: 15 terminales, zonas, envio a cocina
- KDS: 5 estaciones, timers, estados
- Admin: dashboard, CRUD empleados/productos
- PWA con Service Worker
- JWT auth con PIN

### P1: Multi-Terminal (Ene - Feb 2026)
- Conflict resolution (soft-lock, 3 estrategias)
- Event schema versioning (V1 → V2 + migrators)
- Snapshots & compaction
- Observabilidad (Pino + OpenTelemetry)
- Role-based validation (11 roles)
- Branded types (Centavos, OrderId, etc.)

### P2: Growth (Feb - Mar 2026)
- Premium Analytics Dashboard
- Delivery module + tracking
- React Cache (SWR, -40% requests)
- Multi-tenant (provisioning, quotas, cross-tenant)
- Reservaciones (API + Admin UI + public booking)
- HR completo (asistencia, planillas, vacaciones, evaluaciones)
- Caja chica, compras, facturacion stubs
- Dashboard Ejecutivo unificado (P&L, margen, alertas)
- Caja Peru (Z/X reports, denominaciones PEN, IGV SUNAT, alertas varianza)

### P2.5: Hardening 2026 (Feb 28 - Mar 1)
- 12 items deuda tecnica resueltos
- Arquitectura arc42 documentada (10 secciones en `docs/architecture/`)
- 9 ADRs formato Nygard
- Zod safeParse en todas las rutas
- Cache unificado (Redis + circuit breaker)
- Email con Resend
- OpenTelemetry tracing
- RBAC hardening (guards, IDOR, sanitizacion)
- Event archival + cron
- EventMigrator conectado al ingest

---

## P3: Production Ready (Mar - Abr 2026)

Objetivo: llevar PARK POS a produccion real en una polleria piloto.

### P3.1 — Offline Queue Persistente (CRITICO)

**Problema:** La out-of-order queue es in-memory (`Map`). Se pierde en restart/deploy. En una polleria real, perder internet y luego reiniciar el POS = perder eventos.

**Solucion:** Persistir la OOO queue en IndexedDB (Dexie) con TTL y cleanup automatico.

**Archivos clave:**
- `src/app/api/events/ingest/route.ts` — OOO queue actual
- `src/core/db/schema.ts` — Dexie schema
- `src/core/sync/sync-client.ts` — SyncClient

**Criterio de exito:**
- [ ] OOO queue persiste entre restarts
- [ ] TTL: eventos expirados se descartan (24h)
- [ ] Tests: property tests para invariantes de orden
- [ ] E2E: simular desconexion → reconexion → sincronizacion completa

### P3.2 — E2E Flujo POS Completo

**Problema:** Hay 31 E2E specs pero falta un test end-to-end del flujo critico de negocio: abrir turno → crear orden → cobrar → cerrar turno → Z report.

**Solucion:** E2E que simule un dia completo de operacion de polleria.

**Archivos clave:**
- `e2e/` — specs existentes
- `e2e/helpers/test-utils.ts` — utilidades
- `e2e/pages/` — Page Objects

**Criterio de exito:**
- [ ] E2E: dia completo (abrir → N ordenes → pagos mixtos → cierre → Z report)
- [ ] Validar: totales de Z report coinciden con ordenes creadas
- [ ] Validar: denominaciones cuadran con pagos en efectivo

### P3.3 — Observabilidad en Produccion

**Problema:** OpenTelemetry esta instalado (`@vercel/otel`) pero no se ha verificado que traces lleguen correctamente en Vercel. Sin esto, debuggear 500s en produccion es adivinar.

**Solucion:** Verificar tracing end-to-end, agregar spans custom en rutas criticas.

**Archivos clave:**
- `instrumentation.ts` — setup OpenTelemetry
- `src/core/logging/logger.ts` — Pino logger
- `src/app/api/events/ingest/route.ts` — ruta mas critica

**Criterio de exito:**
- [ ] Traces visibles en Vercel dashboard para rutas criticas
- [ ] Spans custom: ingest, payment, shift-close
- [ ] Error traces con stack completo

### P3.4 — Cold Starts y Performance

**Problema:** 261 endpoints en monolito Next.js. Vercel cold starts pueden ser problematicos en rutas criticas del POS.

**Solucion:** Medir, identificar bottlenecks, optimizar rutas criticas.

**Archivos clave:**
- Rutas criticas: `/api/events/ingest`, `/api/pos/*`, `/api/auth/*`
- `next.config.ts` — bundling config

**Criterio de exito:**
- [ ] Benchmark: cold start < 3s en rutas POS
- [ ] Warm response: < 200ms P95 para ingest
- [ ] Bundle analysis: identificar y reducir chunks grandes

### P3.5 — RLS en PostgreSQL

**Problema:** Aislamiento multi-tenant depende solo de `WHERE tenant_id` en codigo. RLS seria defensa en profundidad. ADR-009 dice "RLS selectivo" pero no esta implementado.

**Solucion:** RLS en tablas criticas (orders, payments, events, employees).

**Archivos clave:**
- `prisma/schema.prisma` — 123 modelos
- `docs/architecture/08-decisions.md` — ADR-009

**Criterio de exito:**
- [ ] RLS activo en: orders, payments, events, employees, shifts
- [ ] Prisma queries siguen funcionando (connection-level tenant_id)
- [ ] Tests: intentar acceder datos de otro tenant falla
- [ ] Rollback plan documentado

### P3.6 — Onboarding Real de Tenant

**Problema:** El flujo de provisioning existe (`/admin/tenant/provisioning`) pero no se ha probado end-to-end. Un nuevo dueno de polleria debe poder registrarse y tener todo listo.

**Solucion:** Validar y completar el flujo de onboarding.

**Archivos clave:**
- `src/app/admin/tenant/provisioning/page.tsx`
- `src/core/tenant/` — servicios de tenant
- `src/core/tenant/__tests__/onboarding.unit.test.ts`

**Criterio de exito:**
- [ ] Flujo completo: registro → config basica → primer empleado → primer producto → POS funcional
- [ ] E2E test del onboarding
- [ ] Documentacion para el dueno (guia de inicio)

### P3.7 — Fixes Menores

- [ ] `P&amp;L` en sidebar → debe ser `P&L` (HTML entity escapado)
- [ ] Version hardcodeada `v2.1.1` en sidebar → leer de `package.json`
- [ ] Warning zustand default export → viene de Vercel, monitorear

---

## P4: Enterprise (Q2 2026)

Despues de validar en produccion con el piloto:

- **Facturacion SUNAT real** — integracion con OSE para boletas/facturas electronicas
- **CRM & Fidelizacion** — programa de puntos, niveles, promociones personalizadas
- **Multi-sucursal** — consolidacion de reportes, gestion centralizada
- **Saga Pattern** — compensating transactions para flujos complejos
- **Integracion WhatsApp** — confirmaciones, notificaciones, pedidos

---

## Orden de Ejecucion Recomendado

| # | Item | Prioridad | Esfuerzo | Dependencias |
|---|------|-----------|----------|--------------|
| 1 | P3.1 Offline Queue Persistente | CRITICO | Alto | Ninguna |
| 2 | P3.2 E2E Flujo POS Completo | ALTO | Medio | Ninguna |
| 3 | P3.3 Observabilidad Produccion | ALTO | Bajo | Ninguna |
| 4 | P3.7 Fixes Menores | BAJO | Bajo | Ninguna |
| 5 | P3.4 Cold Starts | MEDIO | Medio | P3.3 (necesita traces) |
| 6 | P3.5 RLS PostgreSQL | MEDIO | Alto | P3.2 (necesita E2E para validar) |
| 7 | P3.6 Onboarding Tenant | MEDIO | Medio | P3.5 (RLS primero) |

Items 1-3 pueden ejecutarse en paralelo. Item 4 es quick win para hacer en cualquier momento.

---

## Arquitectura de Referencia

- Documentacion arc42: `docs/architecture/01-10.md`
- ADRs: `docs/architecture/08-decisions.md`
- SDD artifacts: `openspec/changes/`
- Engram memory: `mem_search` por topic `architecture/*`, `decisions/*`

---

**Ultima actualizacion:** 2 Marzo 2026
**Proxima revision:** Cuando P3.1 este completo
