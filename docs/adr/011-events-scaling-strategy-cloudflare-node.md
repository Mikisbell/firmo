# ADR-011: Estrategia de escala de la tabla `events` para el target Cloudflare/Node puro

## Estado
Aceptado

## Fecha
2026-06-29

## Decisores
Belico (arquitecto)

## Contexto

La tabla `events` es el event store append-only (núcleo del event sourcing). Surgió la
pregunta de cómo escalarla "ultra rápido con técnicas de vanguardia 2026" (BRIN,
particionamiento, covering indexes). El análisis empírico + la revisión de la
documentación de arquitectura del proyecto reencuadran la pregunta.

### Datos medidos (2026-06-29)
- `events` HOY: **1.022 filas**, 1.2 MB total (tabla 752 kB + índices 480 kB). Diminuta.
- **Append-only puro**: cero `UPDATE`/`DELETE` de eventos vivos en código de app. El
  único borrado es el **archiver** (180 días → `archived_events`, cold storage).
- 6 índices, **todos con uso real** (pg_stat idx_scan > 0): `idx_events_replay`
  (tenant_id, entity_id, occurred_at — el más usado), `events_tenant_id_occurred_at_idx`,
  `idx_events_by_type`, `idx_events_by_terminal`, `events_global_sequence_key` (unique),
  `events_pkey`. **No hay índices muertos para dropear.**

### Escala proyectada (de `architecture/08-decisions.md`)
10 tenants × 500 tx/día × 5 events/tx = 25K events/día = ~9M/año.
Con retención 180d del archiver → **~1.5M filas activas en steady-state.** No billones.

### Target de runtime (de ADR-007, realtime-fase3, CLAUDE.md)
- **Híbrido → Node puro sobre Cloudflare** (Variante B). El **ingest SIEMPRE en Node**:
  TCP (pg, 5432/6543) **muere en V8 isolates**. Edge solo serviría *reads*.
- DB dual: writes con `pg` (TCP, Node); edge futuro con `@neondatabase/serverless`
  (WebSocket). "Neon everywhere" aún NO migrado.
- Caché: Upstash Redis HTTP (catálogo TTL 5m) + Cloudflare KV (plan) + Dexie local.
- **Restricción dura: CPU < 10ms en edge → prohibido escanear JSONB; solo índices
  PK/FK + projections precalculadas.**

## Decisión

**1. NO aplicar BRIN ni particionamiento a `events` ahora (ni a 1.5M).** Son técnicas
para tablas de **~10M+ filas**. A 1.5M, el btree actual rinde mejor (BRIN pierde
precisión en tablas no-masivas; particionar 1.5M es complejidad sin ganancia). El
archiver 180d ya acota el crecimiento; puede que nunca se alcance el umbral.

**2. La escala para el target Cloudflare/Node es SEPARACIÓN de responsabilidades, no
reformar el schema:**
```
WRITES (ingest, replay pesado)  ->  NODE (pg/TCP, sin límite CPU, transacciones)
READS en edge (<10ms CPU)       ->  PROJECTIONS precalculadas + caché (Upstash/KV)
                                    NUNCA queries pesadas a events ni scan JSONB
```

**3. Mantener el schema y los 6 índices btree actuales** (todos usados). `events` se
queda en Node. Su diseño append-only + índices tenant+entity+time es el correcto.

**4. Umbrales de escalado (cuándo activar cada técnica):**

| Cuándo | Acción | Dónde |
|--------|--------|-------|
| Hoy → ~10M activas | btree actual, sin tocar | Node |
| Reads que vayan a edge | servir de projections + caché, jamás de `events` directo | Edge |
| Rebuild offline > 1s | implementar snapshots en Dexie (PERFORMANCE.md lo propone, NO hecho) | Cliente |
| > 10M activas sostenido | particionar `events(tenant_id, occurred_at)` + BRIN por partición | Node/Supabase |
| `archived_events` (crece indefinido) | BRIN + particionamiento temporal | Cold storage |

**5. Deuda de índices abierta (de la limpieza 2026-06-29):** `orders_tenant_id_business_date_idx`
y `orders_tenant_id_shift_id_idx` son redundantes por prefijo (cubiertos por
`idx_orders_business_date_status` / `idx_orders_shift_status`). Marcados como candidatos
en `schema.prisma`. **Pendiente: confirmar con `EXPLAIN` en prod (con volumen)** antes de
dropear — en la DB de test (tabla chica) el planner usa seq scan y no se puede forzar.

## Consecuencias

- ✅ `events` escala por **archival + projections + caché**, no por reformar el schema.
  Se evita optimización prematura (Knuth) y el riesgo de BRIN/particionamiento sin escala.
- ✅ Coherencia con el trabajo ya hecho: dropear el GIN de `orders.items` (no se escanea
  JSONB en edge) y afilar `order_item_projections` (la projection que el edge leería)
  fueron pasos en esta misma dirección.
- ✅ El ingest se mantiene en Node (TCP/transacciones) — no se fuerza a edge donde no cabe.
- ⚠️ Cuando se migre a edge real, auditar que TODA ruta de read en edge use projections +
  caché, nunca `events` directo. Implementar snapshots en Dexie para rebuild offline rápido.
- 📌 `ARCHITECTURE.md` tenía drift (describía 2 índices de `events`; hay 6). Corregido en
  el mismo commit.

## Referencias
- ADR-007 (hybrid-cloud-ingest-security), realtime-fase3-retirar-pg-sse.md, PERFORMANCE.md
- `architecture/08-decisions.md` (proyección de volumen)
- Herramienta de auditoría: `scripts/diagnose-indices.mjs <tabla>` (pg_stat + defs + tamaño)
- Migraciones de limpieza: `20260629_drop_dead_oip_indexes`, `20260629_drop_dead_orders_indexes`
