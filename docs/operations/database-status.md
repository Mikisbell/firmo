# Estado de la Base de Datos — PARK POS

> Supabase Cloud (sa-east-1) | PostgreSQL | Ultima auditoria: 2 Marzo 2026

## Resumen

| Metrica | Valor |
|---------|-------|
| Tamano total | 31 MB |
| Tablas publicas | 126 |
| Tablas con RLS | 123 (98.4%) |
| Tablas sin RLS | 3 (`_prisma_migrations`, `shift_denominations`, `z_reports`) |
| Migraciones aplicadas | 5 (ultima: `20260222_premium_hardening`) |

## Registros por Tabla Principal

| Tabla | Registros | Notas |
|-------|-----------|-------|
| `stations` | 3,271 | Estaciones KDS/bar/cocina de todos los tenants |
| `employees` | 943 | Incluye datos de tests |
| `tenants` | 939 | Mayormente creados por unit tests |
| `terminals` | 826 | Terminales POS registrados |
| `products` | 226 | Catalogo de productos |
| `active_sessions` | 108 | Sesiones JWT activas |
| `onboarding_steps` | 48 | 8 tenants x 6 pasos |
| `events` | 15 | Eventos event-sourced |
| `orders` | 12 | Ordenes creadas |
| `shifts` | 2 | Turnos registrados |
| `payments` | 1 | Pagos procesados |
| `reservations` | 1 | Reservaciones |
| `archived_events` | 0 | Sin eventos archivados aun |
| `pending_events` | 0 | Cola OOO limpia |
| `dead_letter_queue` | 0 | Sin eventos fallidos |
| `z_reports` | 0 | Sin reportes Z generados |
| `invoices` | 0 | Sin facturas emitidas |
| `push_subscriptions` | 0 | Sin suscripciones push |

## Tablas Mas Pesadas

| Tabla | Tamano Total | Causa |
|-------|-------------|-------|
| `admin_access_logs` | 2.2 MB | Logs de acceso admin acumulados |
| `login_attempts` | 2.0 MB | Intentos de login (rate limiting) |
| `sessions` | 2.0 MB | Sesiones historicas |
| `terminal_number_ranges` | 1.9 MB | Rangos de numeracion por terminal |
| `stations` | 768 KB | 3,271 estaciones |
| `employees` | 552 KB | 943 empleados |

## Row-Level Security (RLS)

### Estado Global

Supabase habilita RLS por defecto en tablas nuevas. De 126 tablas:
- **123 tablas** con RLS habilitado (policies de Supabase + nuestras P3.5)
- **3 tablas** sin RLS:
  - `_prisma_migrations` — Tabla interna de Prisma, no contiene datos de negocio
  - `shift_denominations` — Denominaciones de billetes/monedas, datos de referencia
  - `z_reports` — Reportes Z de cierre de caja

### Policies por Tabla

| Grupo | # Policies | Tablas | Origen |
|-------|-----------|--------|--------|
| 5 policies | events, orders, employees | 4 Supabase auto + 1 `tenant_isolation_*` (P3.5) |
| 4 policies | ~115 tablas restantes | Supabase auto-generadas |
| 1 policy | payments, active_sessions, archived_events, pending_events | Solo `tenant_isolation_*` (P3.5) |

### P3.5 vs Supabase Nativas

Nuestro script P3.5 (`enable-selective-rls.sql`) agrego `tenant_isolation_*` policies en 7 tablas criticas. Para `events`, `orders` y `employees`, Supabase ya tenia 4 policies previas — nuestra policy se sumo como la 5ta. Para las otras 4 tablas (`payments`, `active_sessions`, `archived_events`, `pending_events`), nuestra policy fue la primera.

## Observaciones

### Datos de Tests en Produccion

La mayoria de los 939 tenants son creados por unit tests (nombres: "Test Terminal", "Test Admin", "Test Ranges", "Polleria Unit Test 1"). Esto indica que los tests de integracion corren contra la base de datos de produccion/staging.

**Recomendacion**: Configurar una base de datos separada para CI/tests (`DATABASE_URL_TEST`) para evitar contaminar datos de produccion.

### Onboarding Steps Legacy

Los 48 onboarding steps existentes usan los step_keys anteriores:
- `CONFIGURE_BASIC_INFO` (viejo) vs `CONFIGURE_BUSINESS_INFO` (nuevo)
- `CONFIGURE_PAYMENT_METHODS` (viejo, eliminado en P3.6)

Los nuevos tenants creados despues de P3.6 usaran los step_keys actualizados de `onboarding-steps.ts`.

### Tablas sin RLS — Evaluacion

| Tabla | Tiene `tenant_id`? | Riesgo | Accion |
|-------|-------------------|--------|--------|
| `_prisma_migrations` | No | Ninguno | No aplicar RLS |
| `shift_denominations` | Si | Bajo (datos de referencia) | Opcional |
| `z_reports` | Si | Medio (datos financieros) | Considerar agregar |

## Conexiones

| Tipo | Puerto | Uso |
|------|--------|-----|
| PgBouncer (transaction mode) | 6543 | `DATABASE_URL` — queries Prisma |
| Directo | 5432 | `DIRECT_URL` — migrations, DDL, `prisma db execute` |

## Como Auditar

```bash
# Verificar RLS en 7 tablas ADR-009
npx tsx scripts/check-rls-status.ts

# Conectar con psql para queries ad-hoc
PGPASSWORD='...' psql -h aws-1-sa-east-1.pooler.supabase.com -p 5432 -U postgres.ncwdmdjnelopikpgrhty -d postgres

# Contar registros por tabla
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC
LIMIT 20;
```
