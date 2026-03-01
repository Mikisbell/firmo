# 9. Riesgos y Deuda Técnica

> Lo que puede fallar, lo que ya sabemos que es subóptimo, y qué hacer al respecto.

## Riesgos Arquitectónicos

### R1. Event Store sin Retention — MITIGADO (MEDIO)

**Estado**: Mitigado (Mar 1, 2026)

**Problema original**: La tabla `events` crecía indefinidamente. Sin archival, partitioning, ni TTL.

**Impacto**: Con 10 tenants × 500 tx/día × 5 events/tx = 25K events/día = 9M/año.

**Mitigación implementada**:
- Tabla `archived_events` para cold storage (misma estructura que `events` + metadata de archival)
- Servicio `archive-events.ts` con archival por batches de 1000 (transaccional)
- Endpoint admin `POST /api/admin/archive-events` (OWNER/ADMIN only)
- Endpoint `GET /api/admin/archive-events` para estadísticas de almacenamiento
- Default: 180 días retención, configurable 30-730 días
- Modo dry-run para preview sin ejecutar

**Cron automático implementado**: Vercel Cron Job semanal (domingos 3AM UTC) en `/api/cron/maintenance` ejecuta archival para todos los tenants activos + cleanup de `processed_events`. Protegido por `CRON_SECRET`. Config en `vercel.json`.

**Severidad reducida a BAJO**: Archival automatizado + manual disponible.

**Pendiente**:
1. Partitioning de tabla `events` por `(tenant_id, occurred_at)` para queries rápidos

### R2. Event Migrator Desconectado del Ingest — RESUELTO ✓

**Estado**: Resuelto (Mar 1, 2026)

**Problema original**: `EventMigratorService` existía pero `migrate()` no se llamaba en el ingest route. Eventos con schema antiguo se guardaban sin migrar.

**Solución implementada**: Write-time migration en `src/app/api/events/ingest/route.ts`. Cada evento pasa por `eventMigrator.migrate()` ANTES de guardarse en DB y proyectarse. Aplica tanto a eventos normales como a queued events (out-of-order). El event store siempre contiene la versión más reciente del schema.

**Defensa en profundidad**: Los reducers (`sale.reducer.ts`, `shift.reducer.ts`) también llaman `migrate()` al leer (read-time), sirviendo como segunda capa por si eventos legacy existieran antes del fix.

### R3. Out-of-Order Queue In-Memory — RESUELTO ✓

**Estado**: Resuelto (Mar 1, 2026)

**Problema original**: Eventos fuera de orden se almacenaban solo en un `Map` in-memory. Si el proceso se reiniciaba durante la ventana 0-60s, los eventos se perdían.

**Solución implementada**: Cola persistida en tabla `pending_events` (PostgreSQL). `enqueue()` persiste inmediatamente al DB antes de agregar al Map in-memory. `processQueuedEvents()` elimina del DB. `recover()` recarga desde DB en startup. La ventana 0-60s ya no es vulnerable a pérdida.

**Defensa en profundidad**: El Map in-memory se mantiene como cache rápido, pero el DB es la fuente de verdad. Si el Map está vacío (cold start), `processFromDB()` consulta directamente la tabla.

### R4. Single DB sin Row-Level Security — MITIGADO (BAJO)

**Estado**: Mitigado (Mar 1, 2026)

**Problema original**: Aislamiento de tenants dependía SOLO de que todo query incluyera `WHERE tenant_id`. Sin red de seguridad a nivel de DB.

**Mitigación implementada**: RLS selectivo en 7 tablas sensibles (`events`, `orders`, `employees`, `payments`, `active_sessions`, `archived_events`, `pending_events`). Script SQL en `prisma/rls/enable-selective-rls.sql`. Ver ADR-009 actualizado.

**Nota**: Prisma conecta como superuser (bypasea RLS). El RLS protege contra queries directos desde Supabase Dashboard, client libraries, o si se cambia a un rol non-superuser en el futuro. El aislamiento primario sigue siendo por código.

**Severidad reducida a BAJO**: La combinación de middleware + RLS + code reviews proporciona defensa en profundidad.

### R5. Cold Start con 261 Routes en Vercel (BAJO)

**Síntoma**: Cada serverless function es un bundle separado. El primer request a una ruta no invocada recientemente tiene cold start.

**Impacto**: Latencia de primer request 2-5 segundos. Afecta UX si el admin abre una página poco visitada.

**Mitigación actual**: `optimizePackageImports` en next.config.js, chunk splitting custom.

**Recomendación**: Monitorear cold starts reales via Vercel metrics. Si es problema, considerar: edge runtime para rutas ligeras, o consolidar rutas similares.

---

## Deuda Técnica Conocida

### D1. Validación Mixta (Zod + Manual) — RESUELTO ✓

**Estado**: Resuelto (Mar 1, 2026)

**Problema original**: ~23 rutas usaban validación manual (`if/typeof`) en vez de Zod.

**Solución**: 17 rutas migradas a Zod `safeParse()` con schemas tipados. Quedan 6 rutas con validación mixta menor (query params simples donde Zod sería overkill).

### D2. Dos Implementaciones de Cache

**Qué**: `cache-service.ts` (primary, con circuit breaker + tags) y `redis.service.ts` (legacy, con pattern matching). Ambos coexisten.

**Por qué importa**: Confusion sobre cuál usar. La legacy usa `KEYS` pattern que es O(n) en Redis.

**Esfuerzo**: Bajo (migrar las pocas rutas que usan `redis.service.ts` a `cache-service.ts`, eliminar legacy).

### D3. Email Notifications = Stub — RESUELTO ✓

**Estado**: Resuelto (Mar 1, 2026)

**Problema original**: `alert-notifier.ts` tenía un TODO para envío de email.

**Solución**: Servicio `src/core/notifications/email.service.ts` con Resend. `sendEmail()` + `buildAlertEmailHtml()`. Fallback graceful: si `RESEND_API_KEY` no está configurada, logea y retorna `sent: false`. El `alert-notifier.ts` ahora envía emails reales con template HTML a los recipients configurados.

### D4. Printer Driver sin Integración E2E — MITIGADO (BAJO)

**Estado**: Mitigado (Mar 1, 2026)

**Problema original**: No había tests de integración para el pipeline de impresión.

**Mitigación**: Test suite `printer-integration.test.ts` (9 tests) con mock transports que valida el pipeline completo: ESC/POS bytes → transport → mock printer. Cubre TCP/USB/HTTP configs, retry logic, y health checks.

**Pendiente**: Testing con hardware real (requiere impresora térmica + red).

### D5. Sin `.env.example` — RESUELTO ✓

**Estado**: Resuelto (Mar 1, 2026)

**Problema original**: No había archivo documentando las variables de entorno necesarias.

**Solución**: `.env.example` creado con 42 variables organizadas en 12 categorías (Core, Security, Multi-Tenancy, Redis, Supabase, Push, Twilio, SUNAT, Delivery Platforms, Observability, Analytics, App URLs). Cada variable documentada con tipo, formato, y comando de generación donde aplica.

### D6. Bounded Contexts Débiles — MITIGADO (MEDIO)

**Estado**: Mitigado (Mar 1, 2026)

**Problema original**: 326 cross-module imports, sin barrel exports en la mayoría de módulos.

**Mitigación**: Barrel exports (`index.ts`) creados para 5 módulos clave: `domain`, `projections`, `middleware`, `inventory`, `observability`. Proporcionan API pública estable para cada módulo.

**Pendiente**: Migrar consumidores existentes a importar desde barrels. Crear barrel exports para módulos restantes (auth, cache, delivery, etc.). DI para observability (94 imports).

### D7. Sin Observabilidad Distribuida — RESUELTO ✓

**Estado**: Resuelto (Mar 1, 2026)

**Problema original**: Sin OpenTelemetry, sin trace propagation.

**Solución**: `@vercel/otel` + `@opentelemetry/api` integrados en `instrumentation.ts`. El structured logger inyecta `trace_id`, `span_id`, `trace_flags` automáticamente en cada log via Pino mixin. Compatible con Grafana Tempo, Jaeger, Honeycomb, Axiom. Se activa con `OTEL_EXPORTER_OTLP_ENDPOINT`.

---

## Matriz de Riesgo

```
Impacto
Alto   │                      │                      │
       │                      │                      │
Medio  │                      │ D6(Boundaries)       │
       │                      │                      │
       │                      │                      │
Bajo   │                      │ D4(Printer HW)       │ R5(Cold Start)
       │                      │                      │
       └──────────────────────┴──────────────────────┘
         Baja                    Media                Alta
                          Probabilidad
```

**Resueltos (Mar 1, 2026)**:
> ~~R1~~: Event archival automatizado con cron semanal + archival manual.
> ~~R2~~: EventMigrator conectado al ingest con write-time migration.
> ~~R3~~: Out-of-order queue persistida en tabla `pending_events` con recovery en startup.
> ~~D1~~: 17 rutas migradas de validación manual a Zod `safeParse()`.
> ~~D2~~: Cache unificada — `redis.service.ts` es adapter de `cache-service.ts`.
> ~~D3~~: Email notifications con Resend — fallback graceful sin API key.
> ~~D5~~: `.env.example` con 42+ variables documentadas en 12 categorías.
> ~~D7~~: OpenTelemetry integrado — trace_id/span_id en cada log via Pino mixin.
