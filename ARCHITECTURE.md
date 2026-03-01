# PARK POS — Arquitectura del Sistema

> POS empresarial event-sourced, offline-first, multi-tenant para pollerías peruanas.
> Estructura basada en [arc42](https://arc42.org/) + [C4 model](https://c4model.com/).
> Última actualización: Mar 1, 2026

## Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.1 |
| Lenguaje | TypeScript (strict) | 5.7 |
| ORM | Prisma | 6.19 |
| Base de datos | PostgreSQL (Supabase Cloud) | 16 |
| Cache | Redis (Upstash) | 7 |
| Offline DB | Dexie (IndexedDB) | 4.0.11 |
| Tests | Vitest + fast-check + Playwright | — |
| UI | Tailwind CSS 4 + Radix UI + Lucide | — |

## Métricas

| Métrica | Valor |
|---------|-------|
| Modelos Prisma | 121 |
| Tipos de evento | 73 (discriminated union) |
| Endpoints API | 261 route handlers |
| Páginas | 83 |
| Tests | 4813 (295 archivos) |
| Bundle | 6.5MB JS, 124 chunks, standalone 197MB |

## Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────┐
│  BROWSER (PWA)                                           │
│  POS · Cocina KDS · Mozo · Bar KDS · Admin · Employee   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Dexie (IndexedDB) — Offline Store + SyncClient     │ │
│  └─────────────────────────┬───────────────────────────┘ │
└────────────────────────────┼─────────────────────────────┘
                             │ HTTPS + SSE
┌────────────────────────────┼─────────────────────────────┐
│  NEXT.JS 16 MONOLITH       │                              │
│  Auth → Rate Limit → Validate → Route Handler             │
│  Core: Events(72) · Projections · Services(40) · RBAC     │
└────────────────────────────┼─────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────┐
│  PERSISTENCE                │                              │
│  PostgreSQL(121) · Redis · Supabase Realtime(LISTEN/NOTIFY)│
└──────────────────────────────────────────────────────────┘

EXTERNAL: SUNAT · PedidosYa · LlamaFood · Twilio(WhatsApp) · Sentry · Logtail · Slack
```

## Documentación Detallada (arc42)

| # | Sección | Archivo | Contenido |
|---|---------|---------|-----------|
| 1 | **Contexto** | [01-context.md](docs/architecture/01-context.md) | Actores, sistemas externos, integraciones |
| 2 | **Restricciones** | [02-constraints.md](docs/architecture/02-constraints.md) | Negocio, regulatorias, técnicas, organizacionales |
| 3 | **Metas de Calidad** | [03-quality-goals.md](docs/architecture/03-quality-goals.md) | Atributos de calidad con escenarios medibles |
| 4 | **Building Blocks** | [04-building-blocks.md](docs/architecture/04-building-blocks.md) | Módulos, dependencias, componentes internos |
| 5 | **Runtime Views** | [05-runtime-views.md](docs/architecture/05-runtime-views.md) | Flujos: venta, offline→sync, conflicto, plataformas |
| 6 | **Deployment** | [06-deployment.md](docs/architecture/06-deployment.md) | Vercel, CI/CD, health checks, env vars |
| 7 | **Cross-Cutting** | [07-crosscutting.md](docs/architecture/07-crosscutting.md) | Auth, cache, errors, logging, rate limiting, i18n, printing, notifications |
| 8 | **Decisiones (ADRs)** | [08-decisions.md](docs/architecture/08-decisions.md) | 9 ADRs con contexto, alternativas, consecuencias |
| 9 | **Riesgos y Deuda** | [09-risks.md](docs/architecture/09-risks.md) | 5 riesgos + 7 deudas técnicas con matriz de prioridad |
| 10 | **Glosario** | [10-glossary.md](docs/architecture/10-glossary.md) | Términos de dominio, acrónimos, roles |

## Top 2 Riesgos Arquitectónicos

| Riesgo | Severidad | Detalle |
|--------|-----------|---------|
| Event store sin retention (crece infinito) | ALTO | [09-risks.md#R1](docs/architecture/09-risks.md) |
| Single DB sin RLS (aislamiento solo por código) | MEDIO | [09-risks.md#R4](docs/architecture/09-risks.md) |

> Resueltos Mar 1, 2026: R2 (EventMigrator write-time), R3 (OOO queue persistida), D2 (cache unificada).

## Decisiones Clave

| ADR | Decisión | Consecuencia principal |
|-----|----------|----------------------|
| [001](docs/architecture/08-decisions.md) | Event Sourcing | Auditoría perfecta, complejidad en queries |
| [002](docs/architecture/08-decisions.md) | Single DB multi-tenant | Simple ops, sin RLS, sin backup por tenant |
| [003](docs/architecture/08-decisions.md) | SSE (no WebSocket) | Simple, auto-reconnect, unidireccional |
| [005](docs/architecture/08-decisions.md) | Next.js monolith (261 routes, 83 pages) | Un deploy, build time crece |
| [008](docs/architecture/08-decisions.md) | Pagos conflictivos = REJECT | Nunca cobro doble, fricción en reconexión |
| [009](docs/architecture/08-decisions.md) | Sin RLS (aislamiento por código) | Simple, sin overhead de policies, riesgo de data leak por bug |
