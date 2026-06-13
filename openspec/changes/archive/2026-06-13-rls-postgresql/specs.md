# Specs: P3.5 — RLS Guardrail en PostgreSQL

## Purpose

Especificaciones para habilitar Row-Level Security (RLS) selectivo en 7 tablas criticas de PostgreSQL como defensa en profundidad contra acceso directo no autorizado a datos multi-tenant.

## Requirements

### Requirement: RLS habilitado en 7 tablas sensibles

El sistema MUST tener RLS habilitado en las 7 tablas definidas en ADR-009: `events`, `orders`, `employees`, `payments`, `active_sessions`, `archived_events`, `pending_events`.

#### Scenario: RLS habilitado en todas las tablas target

- GIVEN la base de datos PostgreSQL con las 7 tablas sensibles
- WHEN se ejecuta `enable-selective-rls.sql` en Supabase SQL Editor
- THEN `pg_tables.rowsecurity` MUST ser `true` para las 7 tablas
- AND cada tabla MUST tener exactamente 1 policy de tenant isolation

#### Scenario: Tablas fuera de scope no son afectadas

- GIVEN la base de datos con ~121 tablas
- WHEN se ejecuta `enable-selective-rls.sql`
- THEN solo las 7 tablas target tienen RLS habilitado
- AND las demas tablas (e.g., `tenants`, `stations`, `categories`) mantienen `rowsecurity = false`

---

### Requirement: Policies usan current_setting con ::text cast y missing_ok

Cada policy MUST usar el patron `tenant_id::text = current_setting('app.current_tenant_id', true)` con cast `::text` y `missing_ok=true`.

#### Scenario: Policy permite acceso con tenant_id correcto

- GIVEN RLS habilitado y un rol non-superuser conectado
- WHEN la conexion ejecuta `SET LOCAL app.current_tenant_id = '<tenant-uuid>'`
- AND ejecuta `SELECT * FROM orders`
- THEN solo retorna filas donde `tenant_id` coincide con el valor seteado

#### Scenario: Policy bloquea acceso sin tenant_id seteado

- GIVEN RLS habilitado y un rol non-superuser conectado
- WHEN la conexion NO ejecuta `SET LOCAL app.current_tenant_id`
- AND ejecuta `SELECT * FROM orders`
- THEN retorna 0 filas (missing_ok=true produce NULL, que no matchea ningun tenant_id)

#### Scenario: Policy aplica tanto a lectura como escritura

- GIVEN RLS habilitado con policies USING + WITH CHECK
- WHEN un rol non-superuser intenta INSERT/UPDATE con tenant_id distinto al seteado
- THEN la operacion es rechazada por la clausula WITH CHECK

---

### Requirement: Prisma como superuser bypasea RLS

Prisma MUST continuar funcionando sin cambios al conectar como rol `postgres` (superuser), que bypasea RLS por defecto en PostgreSQL.

#### Scenario: Queries de Prisma no son afectados por RLS

- GIVEN RLS habilitado en las 7 tablas
- AND Prisma conectado como rol `postgres` (superuser)
- WHEN la aplicacion ejecuta queries via Prisma (e.g., `prisma.orders.findMany()`)
- THEN los queries retornan datos normalmente sin restriccion de RLS
- AND los 4,897+ tests existentes pasan sin regresion

#### Scenario: Build y typecheck no son afectados

- GIVEN RLS habilitado en las 7 tablas
- WHEN se ejecuta `npx tsc --noEmit` y `npm run build`
- THEN ambos completan exitosamente con 0 errores

---

### Requirement: Script de rollback deshabilita RLS

El sistema MUST proveer `prisma/rls/rollback-rls.sql` que revierte completamente el RLS en las 7 tablas.

#### Scenario: Rollback deshabilita RLS en todas las tablas

- GIVEN RLS habilitado en las 7 tablas con policies activas
- WHEN se ejecuta `rollback-rls.sql` en Supabase SQL Editor
- THEN `pg_tables.rowsecurity` MUST ser `false` para las 7 tablas
- AND no quedan policies residuales en `pg_policies` para esas tablas

#### Scenario: Rollback no afecta otras tablas

- GIVEN la base de datos con ~121 tablas
- WHEN se ejecuta `rollback-rls.sql`
- THEN solo las 7 tablas target son afectadas
- AND las demas tablas mantienen su estado previo

#### Scenario: Rollback es seguro de ejecutar multiples veces

- GIVEN `rollback-rls.sql` ya fue ejecutado previamente
- WHEN se ejecuta nuevamente
- THEN completa sin errores (DROP POLICY IF EXISTS)

---

### Requirement: Scripts SQL son idempotentes

Ambos scripts (`enable-selective-rls.sql` y `rollback-rls.sql`) MUST ser idempotentes — ejecutables multiples veces sin error.

#### Scenario: enable-selective-rls.sql es idempotente

- GIVEN RLS ya habilitado y policies ya creadas en las 7 tablas
- WHEN se ejecuta `enable-selective-rls.sql` una segunda vez
- THEN completa sin errores
- AND las policies resultantes son identicas (DROP POLICY IF EXISTS antes de CREATE)

#### Scenario: rollback-rls.sql es idempotente

- GIVEN RLS ya deshabilitado en las 7 tablas
- WHEN se ejecuta `rollback-rls.sql` una segunda vez
- THEN completa sin errores (DROP POLICY IF EXISTS + DISABLE es no-op si ya esta deshabilitado)

---

### Requirement: ADR-009 refleja estado de implementacion

`docs/architecture/08-decisions.md` ADR-009 MUST ser actualizado con estado "Parcialmente implementado" y referencia a los scripts.

#### Scenario: ADR-009 documenta estado actual

- GIVEN ADR-009 existente con estado "Actualizada"
- WHEN se actualiza la documentacion
- THEN el estado MUST ser "Parcialmente implementado — RLS habilitado en 7 tablas sensibles"
- AND MUST referenciar `prisma/rls/enable-selective-rls.sql` y `prisma/rls/rollback-rls.sql`
- AND MUST incluir nota sobre superuser bypass y fecha de implementacion

---

### Requirement: Script de verificacion cubre las 7 tablas

`scripts/check-rls-status.ts` MUST verificar el estado de RLS en las 7 tablas de ADR-009.

#### Scenario: check-rls-status reporta las 7 tablas

- GIVEN el script `scripts/check-rls-status.ts`
- WHEN se ejecuta
- THEN consulta `pg_tables` para las 7 tablas: events, orders, employees, payments, active_sessions, archived_events, pending_events
- AND consulta `pg_policies` para las mismas 7 tablas
- AND reporta estado claro (habilitado/no habilitado + numero de policies por tabla)

#### Scenario: check-rls-status reemplaza las 4 tablas anteriores

- GIVEN el script anterior que verificaba 4 tablas (orders, tenant_settings, employees, stations)
- WHEN se actualiza el script
- THEN las 7 tablas de ADR-009 reemplazan las 4 anteriores
- AND `tenant_settings` y `stations` ya no se verifican (no estan en scope de ADR-009)
