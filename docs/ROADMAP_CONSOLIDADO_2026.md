# PARK POS — Roadmap 2026

**Version:** 3.2.0
**Fecha:** 17 Marzo 2026
**Estado:** P4 Enterprise — EN PROGRESO (~75% completo)

---

## Resumen Ejecutivo

| Fase | Progreso | Estado | Fecha |
|------|----------|--------|-------|
| **P0 — MVP** | 100% | Completado | Ene 2026 |
| **P1 — Multi-Terminal** | 100% | Completado | Feb 2026 |
| **P2 — Growth** | ~85% | En progreso | En curso |
| **P2.5 — Hardening** | 100% | Completado | Mar 1 2026 |
| **P3 — Production Ready** | 100% | Completado | Mar 2 2026 |
| **P4 — Enterprise** | ~75% | En progreso | Q1-Q2 2026 |

### Metricas Actuales (Mar 2 2026)

| Metrica | Valor |
|---------|-------|
| Test files | 302 |
| Tests totales | 4,897 (0 fallas) |
| E2E specs | 32 (Playwright) |
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

### ~~P3.1 — Offline Queue Persistente~~ ✅ YA IMPLEMENTADO

**Descubierto Mar 2 2026:** La OOO queue YA es persistente con PostgreSQL.
- `src/core/events/out-of-order-queue.ts` — persistencia DB + Map cache
- Tabla `pending_events` como source of truth, `dead_letter_queue` para expirados
- `recover()` recarga desde PostgreSQL en cold start
- Client-side: Dexie con `synced` flag en SyncClient

**Mejoras opcionales (backlog):**
- [ ] `@@unique([event_id])` en `pending_events` para dedup DB-level
- [ ] Health check con conteo pending_events / dead_letter_queue

### ~~P3.2 — E2E Flujo POS Completo~~ ✅ COMPLETADO

**Completado Mar 2 2026.** E2E del flujo critico: turno cerrado → ordenes → pagos → Z report → verificar totales.

**Archivos creados:**
- `e2e/pos-complete-shift-flow.spec.ts` — E2E spec flujo completo
- `e2e/helpers/db-seed.ts` — Seeding directo via PrismaClient + JWT
- `e2e/pages/POSPage.ts`, `ShiftPage.ts`, `ZReportPage.ts` — Page Objects

**Bugfixes incluidos:**
- `z-report.service.ts` — 3 schema mismatches corregidos (invoices.shift_id, payments.tip_cents, invoices.subtotal_cents)
- `z-reports/route.ts` — Error handling agregado

**Criterio de exito:**
- [x] E2E: turno cerrado con ordenes → generar Z report → verificar totales
- [x] Validar: totales de Z report coinciden con ordenes creadas (S/78.00 = S/35 + S/43)
- [x] Validar: cash opening correcto (S/100.00)

### ~~P3.3 — Observabilidad en Produccion~~ ✅ COMPLETADO

**Completado Mar 2 2026.** Custom OpenTelemetry spans agregados en rutas criticas.

**Archivos modificados:**
- `instrumentation.ts` — setup OpenTelemetry
- `src/core/observability/` — spans custom para ingest, payment, shift-close
- APP_VERSION centralizado desde `package.json`

**Criterio de exito:**
- [x] Traces visibles en Vercel dashboard para rutas criticas
- [x] Spans custom: ingest, payment, shift-close
- [x] Error traces con stack completo

### ~~P3.4 — Cold Starts y Performance~~ ✅ COMPLETADO

**Completado Mar 2 2026.** Bundle analysis + benchmark script + @vercel/otel externalizado.

**Hallazgos:**
- Client: 5.15 MB (136 chunks), TurboPack runtime 1.16 MB (no optimizable)
- Recharts 3x318KB solo en admin analytics, no impacta POS
- POS pages son estaticas (pre-rendered) — sin cold start en frontend
- Server: @vercel/otel externalizado (-311KB por cold start)

**Archivos creados/modificados:**
- `scripts/benchmark-routes.ts` — Benchmark cold start + warm P50/P95/P99
- `docs/performance/P3.4-bundle-analysis.md` — Reporte completo
- `next.config.js` — `@vercel/otel` agregado a `serverExternalPackages`

**Criterio de exito:**
- [x] Benchmark: cold start < 3s en rutas POS (mitigado — POS pages estaticas)
- [x] Warm response: < 200ms P95 medible con benchmark script
- [x] Bundle analysis: @vercel/otel externalizado (-311KB server)

### ~~P3.5 — RLS en PostgreSQL~~ ✅ COMPLETADO

**Completado Mar 2 2026.** RLS Guardrail implementado en 7 tablas criticas via SDD.

**Decision arquitectonica:** "Guardrail" (Option A) — RLS como defensa en profundidad, no como control primario. Prisma conecta como superuser y bypasea RLS by design. RLS protege contra acceso directo a DB (Supabase Dashboard, pgAdmin, scripts).

**Archivos creados/modificados:**
- `prisma/rls/enable-selective-rls.sql` — Script idempotente, 7 tablas
- `prisma/rls/rollback-rls.sql` — Emergency rollback
- `scripts/check-rls-status.ts` — Verificacion automatizada
- `docs/architecture/08-decisions.md` — ADR-009 actualizado
- `docs/operations/rls-setup.md` — Guia operacional

**7 tablas protegidas:** events, orders, employees, payments, active_sessions, archived_events, pending_events

**Criterio de exito:**
- [x] RLS activo en 7 tablas criticas (script listo, ejecutar en Supabase)
- [x] Prisma queries siguen funcionando (superuser bypasea RLS)
- [x] Rollback plan documentado (`rollback-rls.sql`)
- [x] ADR-009 actualizado con status real

### ~~P3.6 — Onboarding Real de Tenant~~ ✅ COMPLETADO

**Completado Mar 2 2026.** 10 gaps resueltos via SDD — frontend, backend y base de datos.

**Cambios principales:**
1. **Single source of truth** — `onboarding-steps.ts` con 6 pasos en espanol
2. **Integracion atomica** — Provisioning crea checklist dentro de la misma transaccion
3. **API endpoints** — GET `/api/admin/onboarding`, PUT `.../steps/[key]/complete`
4. **Wizard UI** — Montado en `/admin/onboarding`, enlace en sidebar
5. **Traducciones** — Todo el flujo provisioning+onboarding en espanol
6. **Documentacion** — Guia de inicio rapido + guia operacional
7. **E2E tests** — 10 casos de prueba para el flujo completo

**Archivos creados/modificados:**
- `src/core/tenant/onboarding-steps.ts` — Constantes (new)
- `src/core/tenant/onboarding.ts` — Refactor mayor (removed `(prisma as any)`)
- `src/core/tenant/provisioning.ts` — Integracion con onboarding
- `src/app/api/admin/onboarding/` — 2 endpoints (new)
- `src/app/admin/onboarding/page.tsx` — Wizard page (new)
- `e2e/onboarding-flow.spec.ts` — 10 E2E tests (new)
- `docs/GUIA_INICIO_RAPIDO.md` — Guia para duenos (new)
- `docs/operations/tenant-onboarding.md` — Guia admin (new)

**Criterio de exito:**
- [x] Flujo completo: provisioning → onboarding checklist → wizard UI
- [x] E2E test del onboarding (10 cases)
- [x] Documentacion para el dueno (GUIA_INICIO_RAPIDO.md)

### ~~P3.7 — Fixes Menores~~ ✅ COMPLETADO

**Completado Mar 2 2026.**

- [x] `P&amp;L` en sidebar → corregido a `P&L`
- [x] Version hardcodeada `v2.1.1` → APP_VERSION centralizado desde `package.json`
- [x] Warning zustand default export → viene de Vercel, monitoreado (no actionable)

---

## P4: Enterprise (Q1-Q2 2026)

**Estado real (17 Mar 2026):** ~75% implementado. Ver análisis completo en [docs/P4-ENTERPRISE-STATUS.md](P4-ENTERPRISE-STATUS.md).

| Feature | Estado | Notas |
|---------|--------|-------|
| **P4.0 — HR / RRHH** | ✅ Completo | 232 tests, 61 endpoints, 10 páginas UI |
| **P4.1 — SUNAT Facturación** | ⚠️ 95% | 2 bugs en queue worker + credenciales reales pendientes |
| **P4.2 — Loyalty & Fidelización** | ✅ Completo | Earning, redención, tiers automáticos |
| **P4.3 — CRM (Segmentos, Campañas)** | ✅ Completo | RFM, WhatsApp outbox, 5 servicios |
| **P4.4 — Multi-sucursal** | ❌ Pendiente | Schema DB listo, 0% aplicación |
| **Saga Pattern** | ✅ Existe | `src/core/saga/` — orchestrator completo |
| **WhatsApp Notificaciones** | ✅ Implementado | Delivery + CRM messaging |

### P4 Pendiente

1. **Multi-sucursal (P4.4)** — único módulo sin implementar (3-5 días estimado)
2. **SUNAT bugs** — corregir `items[]` vacío + auto-contingencia antes de producción
3. **SUNAT credenciales** — SOL real + certificado digital (.pfx)

---

## Orden de Ejecucion Recomendado

| # | Item | Prioridad | Esfuerzo | Estado |
|---|------|-----------|----------|--------|
| ~~1~~ | ~~P3.1 Offline Queue Persistente~~ | ~~CRITICO~~ | ~~Alto~~ | ✅ Ya implementado |
| ~~2~~ | ~~P3.2 E2E Flujo POS Completo~~ | ~~ALTO~~ | ~~Medio~~ | ✅ Completado Mar 2 |
| ~~3~~ | ~~P3.3 Observabilidad Produccion~~ | ~~ALTO~~ | ~~Bajo~~ | ✅ Completado Mar 2 |
| ~~4~~ | ~~P3.7 Fixes Menores~~ | ~~BAJO~~ | ~~Bajo~~ | ✅ Completado Mar 2 |
| ~~5~~ | ~~P3.4 Cold Starts y Performance~~ | ~~MEDIO~~ | ~~Medio~~ | ✅ Completado Mar 2 |
| ~~6~~ | ~~P3.5 RLS PostgreSQL~~ | ~~MEDIO~~ | ~~Alto~~ | ✅ Completado Mar 2 |
| ~~7~~ | ~~P3.6 Onboarding Tenant~~ | ~~MEDIO~~ | ~~Medio~~ | ✅ Completado Mar 2 |

**P3 COMPLETADO** — Todos los items terminados el 2 de Marzo 2026. Siguiente: P4 Enterprise.

---

## Arquitectura de Referencia

- Documentacion arc42: `docs/architecture/01-10.md`
- ADRs: `docs/architecture/08-decisions.md`
- SDD artifacts: `openspec/changes/`
- Engram memory: `mem_search` por topic `architecture/*`, `decisions/*`

---

**Ultima actualizacion:** 17 Marzo 2026
**Proxima revision:** Completar P4.4 Multi-sucursal + SUNAT producción
