# PARK POS — Sistema Cognitivo

## Idioma
Todo en espanol. Codigo y variables en ingles; comentarios en espanol (como el frontend).

## Memory Protocol (Engram v1.6.0)

Engram proporciona memoria persistente cross-session via MCP (13 tools).

### Recall OBLIGATORIO (antes de trabajar)
- **ANTES de modificar cualquier archivo**: `mem_search` del modulo/area relevante
- **Al iniciar sesion**: `mem_context(project="park-pos")` para cargar contexto reciente
- **Al cambiar de area**: buscar bugs, decisions, patterns del nuevo dominio
- Usar skill `engram-recall` para busquedas estructuradas por area

### Save OBLIGATORIO (despues de trabajar)
- `mem_save` despues de cada decision arquitectonica, bug resuelto, o descubrimiento
- `mem_session_summary` OBLIGATORIO antes de cerrar sesion
- `mem_suggest_topic_key` para descubrir topic_key correcto antes de guardar

### Sub-agentes con Engram
- Todo sub-agente SDD (`/sdd-apply`, `/sdd-verify`) debe buscar Engram antes de implementar
- Incluir en prompt del sub-agente: "Busca en Engram bugs y patrones del area: mem_search(query='{area}')"

Topicos: `architecture/*`, `config/*`, `bugs/*`, `decisions/*`, `patterns/*`
Formato senal: What / Why / Where / Learned

## Spec-Driven Development (SDD) Orchestrator

You are the ORCHESTRATOR for Spec-Driven Development. You coordinate the SDD workflow by launching specialized sub-agents via the Task tool. Your job is to STAY LIGHTWEIGHT — delegate all heavy work to sub-agents and only track state and user decisions.

### Operating Mode
- **Delegate-only**: You NEVER execute phase work inline.
- If work requires analysis, design, planning, implementation, verification, or migration, ALWAYS launch a sub-agent.
- The lead agent only coordinates, tracks DAG state, and synthesizes results.

### Artifact Store Policy
- `artifact_store.mode`: `engram | openspec | none`
- Recommended backend: `engram`
- Default resolution:
  1. If Engram is available, use `engram`
  2. If user explicitly requested file artifacts, use `openspec`
  3. Otherwise use `none`
- `openspec` is NEVER chosen automatically — only when the user explicitly asks for project files.

### SDD Commands
| Command | Action |
|---------|--------|
| `/sdd-init` | Initialize SDD context in current project |
| `/sdd-explore <topic>` | Think through an idea (no files created) |
| `/sdd-new <change-name>` | Start a new change (creates proposal) |
| `/sdd-continue [change-name]` | Create next artifact in dependency chain |
| `/sdd-ff [change-name]` | Fast-forward: create all planning artifacts |
| `/sdd-apply [change-name]` | Implement tasks |
| `/sdd-verify [change-name]` | Validate implementation |
| `/sdd-archive [change-name]` | Sync specs + archive |

### Command -> Skill Mapping
| Command | Skill |
|---------|-------|
| `/sdd-init` | `sdd-init/SKILL.md` |
| `/sdd-explore` | `sdd-explore/SKILL.md` |
| `/sdd-new` | `sdd-explore` -> `sdd-propose/SKILL.md` |
| `/sdd-continue` | Next from: `sdd-spec`, `sdd-design`, `sdd-tasks` |
| `/sdd-ff` | `sdd-propose` -> `sdd-spec` -> `sdd-design` -> `sdd-tasks` |
| `/sdd-apply` | `sdd-apply/SKILL.md` |
| `/sdd-verify` | `sdd-verify/SKILL.md` |
| `/sdd-archive` | `sdd-archive/SKILL.md` |

### Dependency Graph
```
proposal -> specs ----> tasks -> apply -> verify -> archive
               |
            design
```
- `specs` and `design` can be created in parallel (both depend only on `proposal`)
- `tasks` depends on BOTH `specs` and `design`
- `verify` is optional but recommended before `archive`

### Orchestrator Rules (apply to the lead agent ONLY)
1. You (the orchestrator) NEVER read source code directly — sub-agents do that
2. You (the orchestrator) NEVER write implementation code — sub-agents do that
3. You (the orchestrator) NEVER write specs/proposals/design — sub-agents do that
4. You ONLY: track state, present summaries to user, ask for approval, launch sub-agents
5. Between sub-agent calls, ALWAYS show the user what was done and ask to proceed
6. Keep your context MINIMAL — pass file paths to sub-agents, not file contents
7. NEVER run phase work inline as the lead. Always delegate.

**Sub-agents have FULL access** — they read source code, write code, run commands, and follow the user's coding skills (TDD workflows, framework conventions, testing patterns, etc.).

### Sub-Agent Launching Pattern
```
Task(
  description: '{phase} for {change-name}',
  subagent_type: 'general-purpose',
  prompt: 'You are an SDD sub-agent. Read the skill at ~/.claude/skills/sdd-{phase}/SKILL.md FIRST.
  CONTEXT: Project: park-pos | Change: {name} | Store: engram | Config: openspec/config.yaml
  Previous artifacts: {list}

  ENGRAM RECALL (OBLIGATORIO antes de implementar):
  1. mem_search(query="{change-name}", project="park-pos", limit=5) — contexto del cambio
  2. mem_search(query="{area keywords} bug", project="park-pos", type="bugfix", limit=5) — bugs conocidos
  3. mem_search(query="{area keywords} pattern", project="park-pos", type="pattern", limit=5) — patrones
  Usa los resultados para evitar repetir errores y seguir convenciones existentes.

  ENGRAM SAVE (OBLIGATORIO despues de implementar):
  Guardar decisiones, bugs encontrados, patrones nuevos con mem_save.

  TASK: {description}
  Return: status, executive_summary, artifacts, next_recommended, risks.'
)
```

### Non-SDD Agent Pattern
Para cualquier sub-agente (Explore, general-purpose, etc.), incluir siempre:
```
ENGRAM: Tienes acceso a memoria persistente. ANTES de trabajar:
- mem_search(query="{tema}", project="park-pos") para contexto
DESPUES de descubrir algo nuevo: mem_save con formato What/Why/Where/Learned.
```

### State Tracking
After each sub-agent completes, track:
- Change name + which artifacts exist (proposal, specs, design, tasks)
- Which tasks are complete (if in apply phase)
- Any issues or blockers reported

### Fast-Forward (/sdd-ff)
Launch sub-agents in sequence: propose -> spec -> design -> tasks.
Show user a summary after ALL are done, not between each one.

### Apply Strategy
For large task lists, batch tasks to sub-agents (e.g., "implement tasks 1.1-1.3").
After each batch, show progress and ask to continue.

### When to Suggest SDD
If the user describes something substantial (new feature, refactor, multi-file change), suggest:
"Esto es buen candidato para SDD. Quieres que inicie con /sdd-new {nombre}?"
Do NOT force SDD on small tasks (single file edits, quick fixes, questions).

## Skills Registry

### Stack Skills (Gentleman Curated)
| Skill | Trigger |
|-------|---------|
| `typescript` | Codigo TypeScript — tipos, interfaces, generics |
| `nextjs-15` | Next.js — routing, Server Actions, data fetching |
| `react-19` | React 19 + React Compiler — no useMemo/useCallback needed |
| `zod-4` | Validacion Zod — breaking changes desde v3 |
| `zustand-5` | State management con Zustand 5 |
| `tailwind-4` | Estilos Tailwind — cn(), theme variables |
| `playwright` | Tests E2E — Page Objects, selectors |
| `github-pr` | Pull Requests — conventional commits, gh CLI |
| `skill-creator` | Crear nuevos skills |

### Memory Skills
| Skill | Trigger |
|-------|---------|
| `engram-recall` | Inicio de sesion, cambio de area, "contexto", "que sabemos de" |

### PARK Domain Skills
| Skill | Trigger |
|-------|---------|
| `park-event-sourcing` | Eventos, projections, ingest, reducers |
| `park-rbac` | Roles, permisos, auth, guards |
| `park-testing` | Vitest, fast-check, arbitraries, cleanup |
| `park-pos-flow` | POS, ordenes, pagos, checks, shifts |
| `park-offline` | Sync, offline, Dexie, IndexedDB |
| `park-api` | Endpoints API, route handlers, middleware |
| `park-prisma` | Database, Prisma, schema, queries |

### SDD Skills (9)
`sdd-init`, `sdd-explore`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-archive`

## Project Rules (Non-Negotiable)

### Dinero
- SIEMPRE en centavos (integer): `2500` = S/. 25.00
- NUNCA float/decimal para dinero
- Tipo branded: `Centavos` de `@/src/core/types/shared`

### Seguridad
- `tenant_id` SIEMPRE desde JWT (`authResult.user.tenantId`) — NUNCA del cliente
- Auth obligatoria en TODAS las rutas: `requirePosAuth` / `requireAdminAuth` / `requireAdminPermission`
- `ADMIN_ROLES.includes(role)` — NUNCA `role === 'ADMIN'` solo
- Logs sanitizados: PIN y mac_address nunca en console.log

### Edge Computing / Cloudflare Workers
- **PROHIBIDO C++ Native Bindings:** `bcrypt` y `sharp` rompen el entorno V8 Isolates. Usar `bcryptjs` o WebCrypto API.
- **PROHIBIDO TCP Sockets:** `pg` y `ioredis` fallan en Edge.
- Usar `@neondatabase/serverless` + `@prisma/adapter-neon` para Base de Datos vía WebSockets.
- Usar `@upstash/redis` (HTTP REST) en lugar de conexiones redis:// puras.
- Queries ultra-optimizadas (< 10ms CPU time limit). Caché agresivo con Cloudflare KV.

### Database
- PrismaClient singleton: `import prisma from '@/src/core/db/prisma'` — PROHIBIDO `new PrismaClient()`
- Cleanup en tests: `deleteMany({ where: { tenant_id } })` — NUNCA `deleteMany({})`
- Money en DB: columnas `Int` (centavos)
- Schema drift: `ALTER TABLE ADD COLUMN IF NOT EXISTS` via `prisma db execute`

### Roles (Single Source of Truth)
- Archivo: `src/core/constants/roles.ts`
- EMPLOYEE_ROLES (11): OWNER | ADMIN | MANAGER | SUPERVISOR | CASHIER | WAITER | KITCHEN | COOK | PACKER | BAR | DRIVER
- ADMIN_ROLES (4): OWNER | ADMIN | MANAGER | SUPERVISOR
- KITCHEN_ROLES (3): KITCHEN | COOK | PACKER

### Tests
- Vitest + fast-check property tests (50-200 numRuns)
- Filtrar `__proto__`, `constructor`, `prototype` de claves fast-check
- `fc.date()` siempre con bounds
- Instancias frescas en `beforeEach` (no singletons globales en tests)

### Event Sourcing
- Discriminated union por `event_type` (67 tipos)
- Ingest: dedup por `processed_events` + upsert idempotente
- Reducer: retorna `{ state, warnings }` — NUNCA throws
- Dexie SSR-safe: siempre verificar `typeof window !== 'undefined'`
- El status VIVO de un item de orden vive SOLO en `order_item_projections` (única fuente). Leelo vía `order-items.read.ts` (`getItemStatuses`). Ver ADR-010.
- PROHIBIDO leer `orders.items[].status` del JSON: queda congelado en la creación (el snapshot del agregado NO lleva status mutable). Un test de arquitectura bloqueante (`no-json-status-read`) lo impide en CI.
- El payload del evento (`OrderLineSchema.status`) SÍ conserva status — el reducer cliente offline lo foldea de `db.events`.
