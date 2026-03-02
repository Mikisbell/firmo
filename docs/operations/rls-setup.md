# RLS Setup — Row-Level Security para PARK POS

> P3.5 Guardrail | ADR-009 | 7 tablas sensibles

## Resumen

RLS (Row-Level Security) en PostgreSQL actua como red de seguridad para el aislamiento multi-tenant. El aislamiento primario es por codigo (middleware + `WHERE tenant_id`). RLS protege contra acceso directo a la base de datos via Supabase Dashboard, client libraries, o queries ad-hoc con roles non-superuser.

**Impacto en la aplicacion: CERO.** Prisma conecta como `postgres` (superuser) que bypasea RLS por defecto.

## Tablas Protegidas

| # | Tabla | Datos Sensibles |
|---|-------|----------------|
| 1 | `events` | Todos los eventos event-sourced |
| 2 | `orders` | Datos financieros (totales, items) |
| 3 | `employees` | PII (nombres, PINs, roles) |
| 4 | `payments` | Transacciones financieras |
| 5 | `active_sessions` | Sesiones de autenticacion |
| 6 | `archived_events` | Eventos historicos archivados |
| 7 | `pending_events` | Cola de eventos out-of-order |

## Habilitar RLS

### Paso 1: Abrir Supabase Dashboard

Ir a **Supabase Dashboard > SQL Editor** del proyecto.

### Paso 2: Ejecutar el script

Copiar el contenido completo de `prisma/rls/enable-selective-rls.sql` y pegarlo en el SQL Editor. Ejecutar.

El script es **idempotente**: se puede ejecutar multiples veces sin error. Usa `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`.

### Paso 3: Verificar en SQL Editor

Ejecutar este query directamente en el SQL Editor para confirmar:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'events', 'orders', 'employees', 'payments',
  'active_sessions', 'archived_events', 'pending_events'
)
ORDER BY tablename;
```

**Esperado**: las 7 filas deben mostrar `rowsecurity = true`.

### Paso 4: Verificar con script

Desde el repositorio local (requiere `DATABASE_URL` configurado):

```bash
npx tsx scripts/check-rls-status.ts
```

Exit code 0 = todo correcto. Exit code 1 = RLS faltante en alguna tabla.

## Rollback (Deshabilitar RLS)

### Procedimiento (< 5 minutos)

1. Ir a **Supabase Dashboard > SQL Editor**
2. Copiar el contenido de `prisma/rls/rollback-rls.sql`
3. Ejecutar
4. Verificar con el mismo query de arriba — todas deben mostrar `rowsecurity = false`

### Impacto del Rollback

- **Zero downtime** — `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` es instantaneo
- **Zero cambios de codigo** — ni para aplicar ni para revertir
- **Zero riesgo** — Prisma como superuser ya bypaseaba RLS

## Notas Importantes

### Superuser Bypass

Prisma conecta como `postgres` (superuser). Los superusers en PostgreSQL **siempre** bypasean RLS, sin importar si esta habilitado o no. Esto significa:

- La aplicacion funciona identica con o sin RLS habilitado
- Los 4,897+ tests pasan sin cambios
- No se necesita `SET LOCAL app.current_tenant_id` para Prisma

### Non-Superuser Behavior

Si alguien accede via un rol non-superuser (e.g., Supabase client libraries con `anon` o `authenticated` role):

- Sin `SET LOCAL app.current_tenant_id` = **0 filas** (diseno intencional)
- Con `SET LOCAL app.current_tenant_id = '<uuid>'` = solo filas de ese tenant

### Upgrade Path Futuro

El estado actual es "guardrail". Para proteccion completa:

1. Crear rol `app_user` (non-superuser) en PostgreSQL
2. Configurar Prisma dual-client: `postgres` para migrations, `app_user` para queries
3. Agregar `SET LOCAL app.current_tenant_id` en auth middleware
4. Extender RLS a mas tablas segun necesidad

Este upgrade esta documentado en `openspec/changes/rls-postgresql/proposal.md`.

## Archivos Relacionados

| Archivo | Descripcion |
|---------|-------------|
| `prisma/rls/enable-selective-rls.sql` | Script para habilitar RLS (idempotente) |
| `prisma/rls/rollback-rls.sql` | Script para deshabilitar RLS (idempotente) |
| `scripts/check-rls-status.ts` | Verificacion automatizada del estado de RLS |
| `docs/architecture/08-decisions.md` | ADR-009 con decision y contexto |
| `openspec/changes/rls-postgresql/` | Artifacts SDD completos (proposal, specs, design, tasks) |
