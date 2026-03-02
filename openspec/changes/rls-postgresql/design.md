# Design: P3.5 — RLS Guardrail en PostgreSQL

## Technical Approach

Habilitar RLS como guardrail de base de datos ejecutando SQL directamente en Supabase Dashboard. No hay cambios en codigo de aplicacion (`src/`). El trabajo consiste en: (1) hacer el script SQL existente idempotente, (2) crear script de rollback, (3) actualizar tooling de verificacion, y (4) documentar. Prisma como `postgres` superuser bypasea RLS por defecto — zero impacto en la app.

## Architecture Decisions

### Decision: DROP POLICY IF EXISTS antes de CREATE POLICY

**Choice**: Agregar `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY` en `enable-selective-rls.sql`
**Alternatives considered**: Usar `CREATE POLICY ... IF NOT EXISTS` (no existe en PostgreSQL), o manejar errores con `DO $$ ... EXCEPTION ... $$` blocks
**Rationale**: `DROP POLICY IF EXISTS` + `CREATE POLICY` es el patron mas limpio y legible en PostgreSQL. Garantiza idempotencia sin bloques PL/pgSQL. Si la policy ya existe, se recrea identica; si no existe, se crea nueva.

### Decision: Mantener ::text cast con missing_ok=true

**Choice**: `tenant_id::text = current_setting('app.current_tenant_id', true)`
**Alternatives considered**: `tenant_id = current_setting(...)::uuid` (cast a uuid — usado en migration 20260204)
**Rationale**: El patron `::text` + `missing_ok=true` es mas seguro para un guardrail. Si `app.current_tenant_id` no esta seteado, `current_setting(..., true)` retorna `NULL` en vez de lanzar error. El `::uuid` cast de la migration 20260204 lanzaria un error de PostgreSQL si la variable no existe, rompiendo queries de roles que no setean la variable. Para un guardrail defensivo, el comportamiento "retorna 0 filas" es preferible a "lanza error".

### Decision: Ejecucion manual via Supabase Dashboard

**Choice**: Ejecutar SQL manualmente en Supabase Dashboard SQL Editor
**Alternatives considered**: `prisma db execute --file`, Supabase CLI `supabase db push`
**Rationale**: `prisma migrate` no soporta `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` nativamente. `prisma db execute` requiere DATABASE_URL configurado localmente. Supabase Dashboard es accesible sin setup local y permite copiar/pegar/verificar en un solo flujo. Para un script que se ejecuta una vez (no en CI), el Dashboard es la opcion mas simple y segura.

## Data Flow

```
Operador humano
       │
       ▼
┌─────────────────────────┐
│  Supabase Dashboard     │
│  SQL Editor             │
│                         │
│  1. Copiar SQL          │
│  2. Ejecutar            │
│  3. Verificar resultado │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  PostgreSQL             │
│                         │
│  ALTER TABLE ... ENABLE │
│  ROW LEVEL SECURITY     │
│                         │
│  CREATE POLICY          │
│  tenant_isolation_*     │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Efecto                 │
│                         │
│  Superuser (Prisma):    │
│    Sin cambio (bypass)  │
│                         │
│  Non-superuser:         │
│    Requiere SET LOCAL    │
│    o ve 0 filas         │
└─────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/rls/enable-selective-rls.sql` | Modify | Agregar `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY` para idempotencia. Actualizar header con version/fecha. |
| `prisma/rls/rollback-rls.sql` | **Create** | Script que ejecuta `DROP POLICY IF EXISTS` + `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` en las 7 tablas. |
| `scripts/check-rls-status.ts` | Modify | Cambiar las 4 tablas actuales (orders, tenant_settings, employees, stations) por las 7 de ADR-009. Mejorar output con formato tabla. |
| `docs/architecture/08-decisions.md` | Modify | ADR-009: estado "Parcialmente implementado", fecha de implementacion, referencia a scripts. |

**No se modifica ningun archivo en `src/`** — zero cambios de aplicacion.

## Interfaces / Contracts

No hay interfaces nuevas. Los scripts SQL no exponen APIs ni tipos TypeScript.

El unico "contrato" es el nombre de la session variable de PostgreSQL:

```sql
-- Contrato: variable de sesion para RLS
-- Nombre: app.current_tenant_id
-- Tipo: text (UUID como string)
-- Setter: SET LOCAL app.current_tenant_id = '<uuid>';
-- Getter: current_setting('app.current_tenant_id', true)
-- Valor cuando no seteado: NULL (missing_ok=true)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| SQL verification | RLS habilitado en 7 tablas | Query `pg_tables.rowsecurity` post-ejecucion (incluido en el script SQL como comentario) |
| Script verification | `check-rls-status.ts` reporta 7 tablas | Ejecutar manualmente: `npx tsx scripts/check-rls-status.ts` |
| Regression | App no afectada por RLS | `npx vitest run` (4,897+ tests), `npx tsc --noEmit`, `npm run build` |
| Idempotency | Script ejecutable multiples veces | Ejecutar `enable-selective-rls.sql` dos veces consecutivas sin error |

**No se requieren tests nuevos.** RLS es transparente para Prisma (superuser), y la verificacion es via SQL queries directos.

## Migration / Rollout

### Procedimiento de Aplicacion (< 10 minutos)

1. Ir a **Supabase Dashboard > SQL Editor**
2. Copiar contenido de `prisma/rls/enable-selective-rls.sql`
3. Ejecutar
4. Verificar con el query al final del script
5. Ejecutar `npx tsx scripts/check-rls-status.ts` para doble verificacion

### Procedimiento de Rollback (< 5 minutos)

1. Ir a **Supabase Dashboard > SQL Editor**
2. Copiar contenido de `prisma/rls/rollback-rls.sql`
3. Ejecutar
4. Verificar que `rowsecurity = false` en las 7 tablas

### Impacto

- **Zero downtime** — ALTER TABLE ... ENABLE ROW LEVEL SECURITY no bloquea queries
- **Zero cambios de codigo** — ni para aplicar ni para revertir
- **Zero riesgo para la app** — Prisma como superuser bypasea RLS

## Open Questions

Ninguna. Todos los aspectos tecnicos fueron resueltos en la exploracion.
