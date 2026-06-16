# PARK POS

<!-- Logo placeholder -->
<p align="center">
  <img src="docs/assets/logo-placeholder.png" alt="PARK POS" width="200" />
</p>

<p align="center">
  <strong>Sistema POS empresarial event-sourced, offline-first, multi-tenant para pollerias peruanas</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-6.19-2D3748" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-336791" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D" alt="Redis" />
  <img src="https://img.shields.io/badge/Tests-7400%2B-green" alt="Tests" />
</p>

---

## Caracteristicas

| Modulo | Descripcion |
|--------|-------------|
| Punto de Venta | Ordenes, checks, split bill, multiples metodos de pago (efectivo, Yape, Plin, tarjeta) |
| Kitchen Display System | 7 estaciones (parrilla, bar, cocina fria, freidora, expedicion, etc.), course-fire |
| Delivery | Tracking en tiempo real, asignacion de drivers, integracion con plataformas (PedidosYa, LlamaFood) |
| Inventario | FEFO, lotes, kardex, recetas con deduccion automatica, control de merma |
| RRHH | Asistencia (clock-in/out), planillas, evaluaciones, capacitaciones, adelantos, licencias |
| Finanzas | Z-Report, P&L, conciliacion bancaria, caja chica, analisis de margen |
| SUNAT | Facturacion electronica directa (nodefact), boletas, facturas, notas de credito, contingencia |
| Analytics | Dashboard ejecutivo, metricas por hora, ranking de meseros, top productos |
| Impresoras | ESC/POS via TCP y USB, cola de impresion, reintento automatico |
| Tracking Publico | Codigo PARK-XXXXXX, pagina publica para seguimiento del cliente |
| Design System | 50+ componentes UI, Cmd+K command palette, keyboard shortcuts |
| Accesibilidad | ARIA labels, focus trap, skip link, vitest-axe |
| Seguridad | RBAC con 11 roles, auth guards, RLS en PostgreSQL, audit log |
| Offline-first | Dexie/IndexedDB, saga queue, conflict resolution (MERGE/LWW/REJECT) |
| Multi-tenant | Aislamiento completo por tenant, encryption, cross-tenant admin |
| CRM | Segmentacion RFM, campanas, templates de mensajes |
| Reservas | Reservas online con pagina publica por tenant |
| Notificaciones | Push notifications (web-push), preferences por usuario |
| Pollo Control | Control de produccion de pollos a la brasa, historial |
| Promociones | Aplicacion y validacion de promociones en POS |

---

## Stack Tecnologico

| Capa | Tecnologia | Version |
|------|------------|---------|
| Framework | Next.js (App Router + Cloudflare Pages) | 16.1 |
| Lenguaje | TypeScript | 5.7 |
| ORM | Prisma (Neon Adapter) | 6.19 |
| Base de Datos | PostgreSQL (Neon Serverless) | — |
| Cache | Redis (Upstash REST) | — |
| DB Local | Dexie (IndexedDB) | 4.0.11 |
| UI | Tailwind CSS | 4.x |
| Animaciones | Framer Motion | 12.x |
| Validacion | Zod | 3.x |
| Estado | Zustand (1 store) + Context + SWR + useState | 5.x |
| Charts | Recharts | 3.x |
| Testing | Vitest + Playwright + fast-check | — |
| Observabilidad | Pino + OpenTelemetry | — |
| Email | Resend | — |
| SUNAT | nodefact (MIT) | — |
| PWA | Serwist | 9.x |

---

## Inicio Rapido

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/park.git
cd park

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Generar cliente Prisma
npx prisma generate

# Aplicar schema a la base de datos
npx prisma db push

# Iniciar servidor de desarrollo (Turbopack)
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

**Credenciales de prueba:**
- PIN Admin: `1234`
- PIN Cajero: `5678`
- PIN Mesero: `9012`

---

## Scripts

| Script | Descripcion |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo con Turbopack |
| `npm run build` | Build de produccion |
| `npm start` | Servidor de produccion |
| `npm run lint` | ESLint sobre `src/**/*.{ts,tsx}` |
| `npm test` | Vitest — 7400+ tests unitarios y property tests |
| `npm run test:watch` | Vitest en modo watch |
| `npm run test:property` | Solo property tests (`*.property.test.ts`) |
| `npm run test:property:watch` | Property tests en modo watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | Playwright E2E (31+ specs) |
| `npm run test:e2e:debug` | E2E en modo debug |
| `npm run test:e2e:headed` | E2E con navegador visible |
| `npm run test:e2e:report` | Ver reporte HTML de Playwright |
| `npm run test:e2e:trace` | Ver trace de Playwright |
| `npm run test:e2e:single` | E2E solo tests con `@focus` |
| `npm run stress-test` | Tests de estres |
| `npm run seed:prod` | Sembrar datos de produccion |
| `npm run verify:prod` | Verificar seed de produccion |
| `npm run diagnose:terminals` | Diagnosticar terminales |
| `npm run docs:generate` | Generar docs con TypeDoc |
| `npm run docs:watch` | TypeDoc en modo watch |
| `npm run analyze` | Analisis de bundle (`ANALYZE=true`) |
| `npm run redis:up` | Levantar Redis con Docker Compose |
| `npm run redis:down` | Bajar Redis |
| `npm run ci` | Pipeline CI: typecheck + lint + test |

---

## Estructura del Proyecto

```
src/
  app/                    # Next.js App Router
    admin/                # 57 paginas de administracion
    pos/                  # 6 paginas del punto de venta
    mozo/                 # 4 paginas para meseros
    kds/                  # 3 paginas Kitchen Display System
    employee-portal/      # 5 paginas portal del empleado
    api/                  # 316 route handlers (ver docs/API.md)
  components/
    ui/                   # 50+ componentes del Design System
    admin/                # Componentes del panel admin
    kds/                  # Componentes KDS
    layout/               # Layout compartido
    shared/               # Componentes compartidos
  core/
    actions/              # Server Actions y POS Actions
    auth/                 # Autenticacion JWT + PIN
    db/                   # Prisma singleton + Dexie schema
    delivery/             # Modulo de delivery
    domain/               # Eventos (73 tipos), branded types
    hr/                   # Recursos Humanos
    integrations/         # SUNAT, plataformas externas
    inventory/            # Inventario, FEFO, recetas
    jobs/                 # Workers: SUNAT queue, daily summary
    middleware/            # Auth guards, rate limiting
    observability/        # Logging (Pino), tracing (OTEL)
    projections/          # Reducers de sale y shift
    saga/                 # Orchestrator + compensation
    security/             # RBAC, device validation
    services/             # 45 business services
    sync/                 # Sincronizacion offline
    types/                # Branded types (Centavos, OrderId, etc.)
    workers/              # Archiver, outbox, cleanup
  hooks/                  # React hooks compartidos
  lib/                    # Utilidades
  test-utils/             # Utilidades de testing
```

---

## Design System

Acceder a `/admin/design-system` para explorar todos los componentes.

- 50+ componentes UI en `src/components/ui/`
- Command Palette con `Cmd+K` (busqueda global)
- Keyboard shortcuts para operaciones frecuentes
- Temas con variables CSS de Tailwind 4
- Componentes accesibles (ARIA, focus management)

---

## Arquitectura

```
Terminales (Tablet/PC/Movil)
        |
        v
  Dexie (IndexedDB) --- Event Log local
        |
        v (sync)
  Next.js API Routes --- Auth Guards (JWT + PIN)
        |
        v
  PostgreSQL (Supabase) --- 126 tablas, RLS
        |
        v
  Redis --- Cache, pub/sub
```

**Principios:**
- **Event Sourcing**: 73 tipos de eventos inmutables, projections server-side
- **Offline-First**: Funciona sin conexion, sincroniza cuando puede
- **Multi-Tenant**: Aislamiento por `tenant_id`, RLS en PostgreSQL
- **Dinero en centavos**: Tipo branded `Centavos` (integer), nunca float

Ver [docs/02-architecture/ARCHITECTURE.md](./docs/02-architecture/ARCHITECTURE.md) para detalles.

---

## Metricas del Proyecto

| Metrica | Valor |
|---------|-------|
| Modelos Prisma | 121 (112 con tenant_id) |
| Migraciones | 38 |
| Endpoints API | 316 route handlers |
| Paginas | 88 (57 admin, 6 POS, 4 mozo, 3 KDS, 5 portal) |
| Tipos de eventos | 73 |
| Business services | 45 |
| Tests unitarios + property | 7400+ |
| Tests E2E (Playwright) | 31+ specs |
| Property tests (fast-check) | 96 archivos, numRuns=100 |
| Bundle JS | 5.15 MB (136 chunks) |

---

## Testing

```bash
# Tests unitarios y property (7400+)
npm test

# Property tests solamente
npm run test:property

# E2E con Playwright (31+ specs)
npm run test:e2e

# Smoke tests de integracion
node scripts/smoke-all.mjs
```

**Estrategia de testing:**
- Vitest para unit + integration
- fast-check para property-based testing (importado en 147 archivos)
- Playwright para E2E con Page Object pattern
- vitest-axe para accesibilidad

---

## Deployment

**Plataforma:** Cloudflare Pages / Workers (Edge Runtime)

**Crons configurados** (`vercel.json`):

| Cron | Schedule | Descripcion |
|------|----------|-------------|
| `/api/cron/maintenance` | Domingos 03:00 UTC | Mantenimiento general |
| `/api/cron/sunat-daily-summary` | Diario 11:00 UTC (6:00 AM Lima) | Resumen diario SUNAT |
| `/api/cron/rfm` | Diario 05:00 UTC | Calculo RFM de clientes |
| `/api/cron/sunat-queue` | Diario 12:00 UTC | Procesar cola SUNAT |
| `/api/cron/message-outbox` | Diario 18:00 UTC | Procesar outbox de mensajes |

**Variables de entorno requeridas:**

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
JWT_SECRET="..."
PIN_SALT="PARK_POS_2026_"
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
REDIS_URL="redis://..."
```

**CI:** 5 jobs en GitHub Actions — lint, unit+pg+redis, build, e2e, deploy-staging.

---

## Documentacion

| Documento | Descripcion |
|-----------|-------------|
| [docs/API.md](./docs/API.md) | Referencia completa de 316 endpoints |
| [docs/02-architecture/](./docs/02-architecture/) | Arquitectura tecnica |
| [docs/03-features/](./docs/03-features/) | Flujos de funcionalidades |
| [docs/06-deployment/](./docs/06-deployment/) | Guia de despliegue |
| [docs/adr/](./docs/adr/) | Decisiones arquitectonicas (ADRs) |
| [docs/ROADMAP_CONSOLIDADO_2026.md](./docs/ROADMAP_CONSOLIDADO_2026.md) | Roadmap 2026 |

---

## Estado del Proyecto

| Fase | Estado |
|------|--------|
| P0 — MVP | Completado |
| P1 — Multi-Terminal | Completado |
| P2 — Growth | Completado |
| P3 — Production Ready | Completado |
| P4.1 — SUNAT Facturacion | ~95% (2 bugs pendientes) |
| P4 — Enterprise (CRM, multi-sucursal) | En progreso |

---

## Licencia

Proyecto privado y propietario. Todos los derechos reservados.

---

**Ultima actualizacion:** Abril 2026
