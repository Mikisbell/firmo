# 6. Vista de Deployment

> Cómo se despliega el sistema en producción y desarrollo.

## Topología de Producción

```
┌──────────────────────────────────────────────────────────────────┐
│                         INTERNET                                  │
│                            │                                      │
│    ┌───────────┐    ┌──────┴──────┐    ┌────────────────────┐    │
│    │  Browser  │    │   Vercel    │    │  Delivery Platforms │    │
│    │   (PWA)   │    │   Edge     │    │  PedidosYa         │    │
│    │           │    │   Network   │    │  LlamaFood         │    │
│    │  Dexie    │    │            │    │                    │    │
│    │ IndexedDB │    │            │    └────────┬───────────┘    │
│    └─────┬─────┘    └──────┬──────┘             │               │
│          │                 │                    │               │
│          │  HTTPS          │                    │  Webhooks     │
│          │  + SSE          │                    │  (HMAC)       │
│          │                 │                    │               │
│    ┌─────┴─────────────────┴────────────────────┴───────────┐   │
│    │              VERCEL SERVERLESS FUNCTIONS                │   │
│    │                                                         │   │
│    │   Next.js 16 Standalone (node server.js)               │   │
│    │   261 route handlers → Serverless Functions             │   │
│    │   82 pages → Static/SSR/ISR                            │   │
│    │                                                         │   │
│    │   Security Headers:                                     │   │
│    │     X-Frame-Options: DENY                              │   │
│    │     HSTS: max-age=31536000; includeSubDomains          │   │
│    │     CSP: script-src 'self'                             │   │
│    │     Cache-Control: public, max-age=31536000 (static)   │   │
│    └──────┬──────────────┬──────────────┬───────────────────┘   │
│           │              │              │                        │
│    ┌──────┴──────┐ ┌─────┴──────┐ ┌────┴────────────────┐      │
│    │ Supabase    │ │ Upstash    │ │ Supabase Realtime   │      │
│    │ PostgreSQL  │ │ Redis      │ │ LISTEN/NOTIFY       │      │
│    │ 16          │ │ 7          │ │ Canal: events:{tid} │      │
│    │ 121 models  │ │ 256MB max  │ │                     │      │
│    │             │ │ allkeys-lru│ │                     │      │
│    └─────────────┘ └────────────┘ └─────────────────────┘      │
│                                                                  │
│    ┌──────────────────────────────────────────────────────────┐  │
│    │                   OBSERVABILIDAD                         │  │
│    │  ┌─────────┐  ┌───────────┐  ┌─────────────────────┐   │  │
│    │  │ Sentry  │  │  Logtail  │  │ Vercel Analytics    │   │  │
│    │  │ Errors  │  │  (Better  │  │ Metrics Endpoint    │   │  │
│    │  │ 10%     │  │   Stack)  │  │                     │   │  │
│    │  │ sample  │  │  JSON logs│  │ Prometheus format   │   │  │
│    │  └─────────┘  └───────────┘  └─────────────────────┘   │  │
│    └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│    ┌──────────────────────────────────────────────────────────┐  │
│    │                   EXTERNAL APIS                          │  │
│    │  ┌─────────┐  ┌───────────┐  ┌──────────┐              │  │
│    │  │  SUNAT  │  │  Twilio   │  │  Slack   │              │  │
│    │  │  SOAP/  │  │  WhatsApp │  │  Webhook │              │  │
│    │  │  REST   │  │  API      │  │  Alerts  │              │  │
│    │  └─────────┘  └───────────┘  └──────────┘              │  │
│    └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Desarrollo Local

```
npm run dev    → localhost:3000  (Next.js + Turbopack)
```

Base de datos y Redis son servicios cloud (Supabase y Upstash), no requieren infraestructura local.

## CI/CD Pipeline

```
                push/PR to main/develop
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
    lint-and-typecheck          unit-tests
    (tsc --noEmit + eslint)     (vitest + postgres + redis)
           │                         │
           └────────────┬────────────┘
                        ▼
                      build
                    (next build)
                        │
                        ▼
                    e2e-tests
                 (Playwright +
                  postgres + redis)
                        │
                        ▼
                  deploy-staging
                  [develop only]
                  (placeholder)
```

Backup DB: cron diario a 03:00 UTC → `pg_dump` → GitHub artifact (30 días retención).

## Health Check (`GET /api/health`)

Tres probes en paralelo, timeout 2s cada una:

| Probe | Qué verifica | Degraded si |
|-------|-------------|-------------|
| **database** | `SELECT 1` via Prisma | Query falla |
| **redis** | SET + GET round-trip | Redis no disponible (graceful) |
| **eventSourcing** | Count eventos en últimas 24h | 0 eventos recientes |

Respuesta: `{ status: "healthy|degraded|unhealthy", components: {...}, responseTime: N }`
- `unhealthy` → HTTP 503
- `degraded` → HTTP 200 (Redis puede caer sin bloquear operación)
- `healthy` → HTTP 200

## Variables de Entorno

### Requeridas (sin default — falla al arrancar)

| Variable | Propósito |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Firma JWT (≥32 chars) |
| `PIN_SALT` | Hash de PINs (≥32 chars) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

### Opcionales (con fallback)

| Variable | Default | Propósito |
|----------|---------|-----------|
| `REDIS_URL` | In-memory cache | Cache + rate limiting |
| `LOGTAIL_SOURCE_TOKEN` | Console output | Log shipping a Better Stack |
| `NEXT_PUBLIC_SENTRY_DSN` | Sin tracking | Error tracking |
| `VAPID_PUBLIC_KEY` | Push deshabilitado | Web Push notifications |
| `TWILIO_ACCOUNT_SID` | WhatsApp deshabilitado | Notificaciones delivery |
| `SUNAT_PROVIDER` | `mock` | `mock` / `nubefact` / `sunat-direct` |

Lista completa de env vars: ver código fuente (no existe `.env.example` documentado).
