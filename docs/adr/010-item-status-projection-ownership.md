# ADR-010: El status de items vive en la proyección, no en el write-model

## Estado
Aceptado

## Fecha
2026-06-23

## Decisores
Belico (arquitecto), LLM Council (5 asesores + chairman, ver Referencias)

## Contexto

El campo `status` de cada item de orden (`PENDING | COOKING | READY | DONE | VOIDED`)
vivía duplicado en DOS lugares server-side, sin reconciliación:

1. **Congelado** en el JSON del agregado `orders.items[].status` (write-model). El
   writer lo escribía SOLO en la creación de la línea (`ORDER_CREATED` /
   `ORDER_ITEM_ADDED`). El handler de `ORDER_ITEM_STATUS_CHANGED` NO tocaba ese
   JSON — solo actualizaba la proyección. Resultado: el JSON quedaba congelado en
   el valor inicial **para siempre**.
2. **Vivo** en la proyección `order_item_projections`, que sí progresaba con cada
   transición de cocina.

Esto es un olor de CQRS clásico: un campo **mutable** de read-model (el status vivo,
que es un PROCESO) embebido en el **write-model** (el snapshot del agregado, que debe
guardar solo HECHOS INMUTABLES del append: `line_id`, `product_id`, `qty`,
`unit_price_cents`). Esa doble verdad sin reconciliar **ES el trap**.

El trap era real pero tenía cero víctimas activas: PR #15 (portal cliente) y PR #16
(KDS de estación) ya leían la proyección; nadie en el cliente offline leía el JSON
(todos foldean `db.events`). El riesgo era 100% futuro: cualquier endpoint server-side
nuevo que leyera `orders.items[].status` reintroducía el bug silenciosamente.

**El veredicto del council ([[decisions/read-side-refactor-council-verdict]], #2179)
redirigió el problema:** la primera propuesta —un read-model que FUSIONARA JSON +
proyección con fallback `?? item.status`— fue calificada de "80% correcta y por eso
peligrosa". El 20% veneno era que la fusión **consagra** la duplicación en vez de
matarla. La raíz no es "cómo no duplico la query N veces", sino "por qué existen dos
verdades". El status debe vivir SOLO en la proyección, y el read-model debe SOLO LEER
la proyección, sin fusión ni fallback.

## Decisión

La proyección `order_item_projections` es la **única dueña** del status vivo de los
items server-side. En concreto:

- **El writer deja de escribir `status` en el snapshot `orders.items[]`.** El JSON del
  agregado guarda solo hechos inmutables de la línea. La proyección sigue siendo
  alimentada por `projectEvent` (ORDER_CREATED inicializa en `PENDING`,
  ORDER_ITEM_STATUS_CHANGED avanza, ORDER_ITEM_VOIDED elimina).

- **Read-model único `src/core/projections/order-items.read.ts`** (`getItemStatuses` /
  `getItemStatusesForOrders`). Lee EXCLUSIVAMENTE de `order_item_projections`, filtrando
  por `tenant_id`. NO fusiona con el JSON ni aplica fallback `?? item.status`. Una línea
  sin fila proyectada queda AUSENTE del `Map` (ausencia explícita). Consolida las queries
  que cada lector (course-fire, stations, analytics, delivery, sunat-queue-worker)
  duplicaba — mata la duplicación que motivó el council.

- **Tipo `PersistedOrderLine = Omit<OrderLine, 'status'>`** en `src/core/types/shared.ts`.
  El writer tipa el array que mete en `items:` como `PersistedOrderLine[]`. Leer `.status`
  de ese tipo es **error de compilación** (red edit-time).

- **Test de arquitectura BLOQUEANTE** (`src/__tests__/architecture/no-json-status-read.test.ts`).
  Escanea `src/app/api/**` y `src/core/**` (fs + regex) y FALLA el build si un lector
  server-side lee `status` del JSON `orders.items[]` (gate CI permanente).

- **El payload del evento conserva `status`.** `OrderLineSchema.status`
  (`src/core/domain/events.ts`) NO se toca. El cliente offline-first sigue derivando el
  status del FOLD del payload de `db.events` en `sale.reducer.ts`; nunca leyó el snapshot.
  Separamos PAYLOAD-DEL-EVENTO (lo necesita el reducer cliente + auditoría de eventos
  históricos) de SNAPSHOT-DEL-AGREGADO (solo hechos inmutables).

## Consecuencias

### Positivas
- ✅ Una sola fuente de verdad para el status vivo: imposible reintroducir la doble verdad por construcción del tipo + gate de CI.
- ✅ El read-model único elimina la duplicación de la query en los ~25 lectores.
- ✅ El SNAPSHOT del agregado vuelve a su rol correcto: hechos inmutables del append.
- ✅ El cliente offline no cambia (foldea el payload, no el snapshot) — refactor inofensivo verificado: **0 tests rotos** (#2190).
- ✅ Se dropearon 2 matviews muertas (`kds_pending_items`, `station_*`) que leían `item->>'status'` del JSON — el único lector de status-en-JSON fuera de TS.

### Negativas
- ⚠️ Hay que leer el status desde el read-model (un query a la proyección), no "gratis" del JSON ya cargado. Mitigado con `getItemStatusesForOrders` (batch, evita N+1).
- ⚠️ El JSON histórico de órdenes ya creadas conserva su `status` congelado. No se backfillea ni se muta (ver Riesgos: invariante fiscal); el gate impide leerlo, no lo borra de la DB.

### Riesgos
- **Semántica de replay/rebuild.** Un rebuild desde el event log podría PISAR el status vivo con el inicial. Contrato garantizado por: (a) `ON CONFLICT (order_id, line_id) DO NOTHING` en ORDER_CREATED → nunca degrada READY/DONE a PENDING; (b) rebuild SIEMPRE por `global_sequence` ascendente → CREATE precede a STATUS_CHANGED; (c) dependency-check del ingest encola STATUS_CHANGED out-of-order si falta CREATE. **HALLAZGO acotado (#2180):** si STATUS_CHANGED se aplicara ANTES que CREATE, la convergencia NO es total → fijado como PRECONDICIÓN de contrato (property test, numRuns 200), no como bug.
- **Falso negativo acotado del test de arquitectura.** El escáner (fs+regex) detecta el acceso directo y el alias en la MISMA línea; NO sigue aliasing indirecto multi-salto ni desestructuración profunda. Se acepta: gate conservador (mejor bloqueante con FN acotado que WARN ignorado). El escáner tiene auto-validación (4 tests internos: detecta directo, detecta alias, ignora comentario, ignora otras entidades).
- **Invariante fiscal.** El writer omite `status` SOLO en órdenes NUEVAS; NUNCA muta retroactivamente el JSON de órdenes con boleta ACCEPTED. Una boleta emitida fijó sus items desde el snapshot — alterarlo sería un problema de auditoría SUNAT. Garantía por construcción: no hay UPDATE retroactivo sobre `items[]`.

## Alternativas Consideradas

| Alternativa | Pro | Contra (razón de rechazo) |
|-------------|-----|---------------------------|
| Read-model que FUSIONA JSON + proyección con fallback `?? item.status` | No rompe nada si una fila falta en la proyección | **El "20% veneno":** consagra la duplicación en vez de matarla. El fallback es andamiaje temporal con fecha de muerte, no arquitectura. Rechazado por el council (#2179). |
| Feature-flag por tenant (snapshot con/sin status) | Rollout gradual | Crea DOS formas de `orders.items[]` en la MISMA tabla → reintroduce la doble verdad que el change mata y obliga a TODO lector a ramificar. Rechazado (corte global es seguro: backfill aplicado + 0 lectores prod del JSON). |
| `hydrate<T>` genérico / abstracción de fusión reutilizable | "Escala" a las 22 proyecciones | Generalizar una fusión que NO debe existir escala el defecto. Rechazado al Expansionista del council: nada de hydrate genérico / SSE / cache / CQRS sobre esto. |

## Implementación

| Archivo | Rol |
|---------|-----|
| `src/core/types/shared.ts` | `PersistedOrderLine = Omit<OrderLine, 'status'>` (red edit-time) |
| `src/core/projections/order-items.read.ts` | Read-model único: `getItemStatuses` / `getItemStatusesForOrders` (solo lee la proyección) |
| `src/core/events/project-event.ts` | Writer: `items:` se tipa `PersistedOrderLine[]`; la proyección sigue insertando `status='PENDING'` (ORDER_CREATED con `ON CONFLICT DO NOTHING`) |
| `src/core/domain/events.ts` | `OrderLineSchema.status` SIN cambios (payload del evento) |
| `src/core/projections/sale.reducer.ts` | SIN cambios (cliente foldea el payload, no el snapshot) |
| `src/__tests__/architecture/no-json-status-read.test.ts` | Gate bloqueante fs+regex (0 violaciones) |
| `tests/integration/item-status-lifecycle.characterization.test.ts` | Red de caracterización del lifecycle (7 tests, DB real, lee status SOLO vía `getItemStatuses`) |
| `prisma/migrations/20260623_drop_dead_status_materialized_views/migration.sql` | DROP de matviews muertas (`kds_pending_items`, `station_*`) |

## Referencias
- ADR-001: Device SoT Event Log (el dispositivo es la fuente de verdad del event log)
- ADR-008: Outbox Pattern (otro patrón de event-sourcing del sistema)
- `docs/02-architecture/EVENTS.md` — sección "Snapshot del agregado vs Proyección (status de items)"
- `docs/02-architecture/ENGINEERING_PRINCIPLES.md` — lecciones de proceso de esta saga
- Engram (project `park`): `architecture/order-item-status-trap` (#2171), `decisions/read-side-refactor-council-verdict` (#2179), `bugs/order-created-projection-hole` (#2180), `sdd/remove-item-status-from-write-model/design` (#2186), `.../characterization-test` (#2189), `.../apply-progress` (#2190)
