# Tasks: P3.5 — RLS Guardrail en PostgreSQL

## Phase 1: SQL Preparation

- [x] 1.1 **Unificar `prisma/rls/enable-selective-rls.sql`** — Agregar `DROP POLICY IF EXISTS tenant_isolation_*` antes de cada `CREATE POLICY` para las 7 tablas (events, orders, employees, payments, active_sessions, archived_events, pending_events). Mantener patron `tenant_id::text = current_setting('app.current_tenant_id', true)`. Actualizar header con version y fecha.

- [x] 1.2 **Crear `prisma/rls/rollback-rls.sql`** — Nuevo archivo con `DROP POLICY IF EXISTS` + `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` para cada una de las 7 tablas. Incluir header con instrucciones y query de verificacion post-rollback.

## Phase 2: Verification Scripts

- [x] 2.1 **Actualizar `scripts/check-rls-status.ts`** — Reemplazar las 4 tablas actuales (orders, tenant_settings, employees, stations) por las 7 de ADR-009 (events, orders, employees, payments, active_sessions, archived_events, pending_events). Mejorar output con formato claro: tabla, rowsecurity enabled, numero de policies.

## Phase 3: Documentation

- [x] 3.1 **Actualizar ADR-009 en `docs/architecture/08-decisions.md`** — Cambiar estado a "Parcialmente implementado (Guardrail)". Agregar fecha de implementacion, referencia a scripts, nota sobre superuser bypass y upgrade path.

- [x] 3.2 **Crear `docs/operations/rls-setup.md`** — Instrucciones paso a paso para habilitar/verificar/rollback RLS via Supabase Dashboard. Notas sobre superuser bypass y upgrade path futuro.

## Phase 4: Verification

- [x] 4.1 **Ejecutar `npx tsc --noEmit`** — TypeScript compila con 0 errores. Zero regresion confirmada. (No hay tests unitarios para scripts/).
