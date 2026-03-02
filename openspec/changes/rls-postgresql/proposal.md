# Propuesta: P3.5 — RLS Guardrail en PostgreSQL

## Resumen Ejecutivo

Habilitar Row-Level Security (RLS) en 7 tablas criticas de PostgreSQL como defensa en profundidad contra acceso directo a la base de datos. Este es un **guardrail rapido**: la aplicacion sigue usando `WHERE tenant_id` como aislamiento primario via middleware; RLS actua como red de seguridad para accesos via Supabase Dashboard, client libraries, o cualquier path que no pase por Prisma.

**Impacto en la aplicacion: CERO.** Prisma conecta como `postgres` (superuser) que bypasea RLS por defecto. Los 4,897 tests existentes no se ven afectados.

## Intencion

### Problema
El sistema multi-tenant aísla datos por `WHERE tenant_id` en codigo (middleware + queries). Pero si alguien accede a la base de datos directamente — via Supabase Dashboard, Supabase client libraries, o un query ad-hoc — no existe proteccion a nivel de base de datos. Un `SELECT * FROM orders` sin filtro devolveria datos de TODOS los tenants.

### Solucion
Ejecutar `ENABLE ROW LEVEL SECURITY` + crear policies de aislamiento por `tenant_id` en las 7 tablas mas sensibles (per ADR-009). Cualquier conexion non-superuser que no setee `app.current_tenant_id` vera 0 filas — diseño intencional.

### Contexto Critico Descubierto en Exploracion

La exploracion revelo un problema importante: existen **DOS estrategias divergentes** de RLS en el codebase:

1. **`prisma/rls/enable-selective-rls.sql`** — 7 tablas per ADR-009, usa `tenant_id::text` (cast a text)
2. **`prisma/migrations/20260204_fix_rls_policies/migration.sql`** — 26+ tablas con full CRUD, usa `::uuid` cast

Estas dos estrategias son incompatibles:
- La migration usa `current_setting(...)::uuid` — si la variable no esta seteada, PostgreSQL lanza error
- El script selectivo usa `tenant_id::text = current_setting(..., true)` — mas seguro, retorna null si no esta seteada (true = missing_ok)

**Este cambio UNIFICA en la estrategia del script selectivo** (7 tablas, text cast, missing_ok=true), que es la correcta para un guardrail que no debe romper nada.

## Alcance

### Dentro del Alcance

| # | Tarea | Tipo | Esfuerzo |
|---|-------|------|----------|
| 1 | Unificar `enable-selective-rls.sql` — resolver inconsistencia text vs uuid, agregar `IF NOT EXISTS` a policies | SQL | 30 min |
| 2 | Crear `rollback-rls.sql` — DISABLE ROW LEVEL SECURITY + DROP POLICY en las 7 tablas | SQL | 15 min |
| 3 | Actualizar `check-rls-status.ts` para validar las 7 tablas de ADR-009 (actualmente solo verifica 4 tablas) | TS | 20 min |
| 4 | Documentar instrucciones de ejecucion (Supabase Dashboard SQL Editor) | Docs | 15 min |
| 5 | Actualizar ADR-009 en `docs/architecture/08-decisions.md` con estado "Parcialmente implementado" | Docs | 10 min |
| 6 | Verificar que la app no se ve afectada: tests pasan, build OK, typecheck OK | Verificacion | 10 min |

**Esfuerzo total estimado: ~2 horas**

### Fuera del Alcance

| Item | Razon del Diferimiento |
|------|----------------------|
| Crear `app_user` (rol non-superuser) en PostgreSQL | Requiere cambios en Supabase, PgBouncer config, y DATABASE_URL — riesgo alto, beneficio incremental |
| `SET LOCAL app.current_tenant_id` en auth middlewares | Solo tiene efecto con `app_user`; con `postgres` superuser es no-op |
| Dual Prisma client (superuser + app_user) | Arquitectura compleja, diferido hasta que `app_user` exista |
| RLS en las 26+ tablas restantes (migration 20260204) | La migration existente tiene riesgo de conflicto con el script selectivo; se abordara cuando `app_user` este listo |
| `setRLSSessionVariables()` en todos los middlewares | Actualmente solo se llama en 3 rutas de export; expandir cuando `app_user` este activo |

## Enfoque

### Paso 1: Unificar enable-selective-rls.sql

Modificar `prisma/rls/enable-selective-rls.sql` para:
- Agregar `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY` (idempotente)
- Mantener el pattern `tenant_id::text = current_setting('app.current_tenant_id', true)` (seguro)
- Agregar comentario de version y fecha
- Las 7 tablas target: `events`, `orders`, `employees`, `payments`, `active_sessions`, `archived_events`, `pending_events`

### Paso 2: Crear rollback-rls.sql

Nuevo archivo `prisma/rls/rollback-rls.sql`:
```sql
-- Rollback: deshabilitar RLS en las 7 tablas
DROP POLICY IF EXISTS tenant_isolation_events ON events;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
-- ... (7 tablas)
```

### Paso 3: Actualizar check-rls-status.ts

El script actual (`scripts/check-rls-status.ts`) solo verifica 4 tablas: `orders`, `tenant_settings`, `employees`, `stations`. Actualizarlo para verificar las 7 tablas de ADR-009 y reportar estado claro (habilitado/no habilitado + numero de policies).

### Paso 4: Documentar instrucciones

Agregar seccion de instrucciones en el propio script SQL y opcionalmente en un README dentro de `prisma/rls/`. Las instrucciones son:
1. Ir a Supabase Dashboard > SQL Editor
2. Copiar y pegar `enable-selective-rls.sql`
3. Ejecutar
4. Verificar con el query de verificacion incluido al final del script

### Paso 5: Actualizar ADR-009

Actualizar `docs/architecture/08-decisions.md` para reflejar:
- Estado: "Parcialmente implementado — RLS habilitado en 7 tablas sensibles"
- Nota: `postgres` superuser bypasea RLS; proteccion efectiva para accesos non-superuser
- Referencia al script y rollback

### Paso 6: Verificacion

Ejecutar:
- `npx vitest run` — todos los tests deben pasar (Prisma usa `postgres`, no afectado por RLS)
- `npx tsc --noEmit` — typecheck limpio
- `npm run build` — build exitoso

## Areas Afectadas

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `prisma/rls/enable-selective-rls.sql` | Modificado | Agregar idempotencia (`DROP POLICY IF EXISTS`), verificar consistencia de cast |
| `prisma/rls/rollback-rls.sql` | **Nuevo** | Script para deshabilitar RLS en las 7 tablas |
| `scripts/check-rls-status.ts` | Modificado | Ampliar a 7 tablas de ADR-009, mejorar formato de output |
| `docs/architecture/08-decisions.md` | Modificado | ADR-009 actualizado con estado "Parcialmente implementado" |

**Archivos NO modificados**: Ningun archivo de aplicacion (`src/`), ningun test, ningun middleware, ningun route handler. Este cambio es puramente SQL + tooling + documentacion.

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| Prisma queries dejan de funcionar despues de habilitar RLS | **Nula** | Critico | Prisma conecta como `postgres` superuser que bypasea RLS. Verificado en la exploracion y documentado en PostgreSQL docs. |
| Migration 20260204 ya habilito RLS en algunas de las 7 tablas — conflicto de policies | **Baja** | Bajo | El script usa `DROP POLICY IF EXISTS` antes de crear. Si la migration ya corrio, las policies existentes se reemplazan. Si no corrio, se crean limpias. |
| Alguien accede via Supabase client library sin setear `app.current_tenant_id` y ve 0 filas | **Media** | Bajo | **Diseño intencional**. RLS sin sesion = 0 filas. Documentar este comportamiento. |
| Scripts de debug/setup que usan non-superuser roles dejan de funcionar | **Baja** | Bajo | Los ~20 scripts de setup en `scripts/` usan Prisma (superuser). Si algun script usa rol diferente, necesitaria `SET LOCAL` primero. |
| Inconsistencia entre migration 20260204 (26 tablas) y script selectivo (7 tablas) causa confusion | **Media** | Bajo | Documentar explicitamente: el script selectivo es la fuente de verdad para P3.5. La migration se evaluara en fase futura. |

## Plan de Rollback

### Procedimiento (< 5 minutos)

1. Abrir Supabase Dashboard > SQL Editor
2. Copiar y pegar contenido de `prisma/rls/rollback-rls.sql`
3. Ejecutar
4. Verificar con:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename IN ('events', 'orders', 'employees', 'payments',
                     'active_sessions', 'archived_events', 'pending_events');
   ```
   Todas deben mostrar `rowsecurity = false`.

### Impacto del Rollback
- **Cero cambios de codigo** necesarios
- **Cero downtime** — el rollback SQL es instantaneo
- La aplicacion no se ve afectada antes ni despues del rollback (superuser bypasea RLS)

## Dependencias

- **Ninguna dependencia de codigo** — no se modifica ningun archivo de aplicacion
- **Acceso a Supabase Dashboard** requerido para ejecutar SQL (no se puede hacer via Prisma migrations porque `prisma migrate` no soporta `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` nativamente)
- **ADR-009 existente** como fuente de verdad para las 7 tablas

## Criterios de Exito

- [ ] `enable-selective-rls.sql` es idempotente (se puede ejecutar multiples veces sin error)
- [ ] `rollback-rls.sql` revierte completamente el RLS en las 7 tablas
- [ ] `check-rls-status.ts` reporta las 7 tablas con estado correcto
- [ ] ADR-009 refleja estado "Parcialmente implementado" con fecha
- [ ] `npx vitest run` — 4,897+ tests pasan (0 regresiones)
- [ ] `npx tsc --noEmit` — 0 errores
- [ ] `npm run build` — exitoso
- [ ] Query de verificacion post-ejecucion muestra `rowsecurity = true` en las 7 tablas
