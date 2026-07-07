# FIRMO POS — Principios de Ingeniería

> Lecciones de proceso destiladas de refactors reales. No son reglas de estilo
> (esas viven en `AGENTS.md` / `CLAUDE.md`); son **cómo pensar** un cambio de alto
> riesgo para "codear con inteligencia" y no reintroducir los traps que ya matamos.

El caso de referencia recurrente es la **erradicación del trap de status de items**
(jun 2026, ver ADR-010): el campo mutable `status` vivía duplicado entre el snapshot
`orders.items[]` (congelado) y la proyección `order_item_projections` (viva). Lo
sacamos del write-model dejando la proyección como única dueña.

---

## 1. MEDIR antes de refactorizar

El refactor del writer fue catalogado como "HIGH risk: radio de ~4900 tests que
asumen `items[].status`". Al **medirlo** en modo WARN, las violaciones reales fueron
**0** y los tests rotos fueron **0** (#2190). La fase de migración masiva de ~4900
tests (P5) resultó innecesaria y se colapsó.

> **No asumas el peor caso: medilo.** Antes de planear un backfill, una migración
> masiva o una ventana de mantenimiento, corré la query/escáner que cuenta las
> víctimas REALES. "Cuántas órdenes tienen un STATUS_CHANGED distinto al congelado"
> no es un debate, es un `SELECT`. El número decide la estrategia, no la intuición.

## 2. Characterization test ANTES de un refactor de alto riesgo

Construir una **red de seguridad independiente** de los tests que vas a tocar, que
assertee el comportamiento esperado vía la **fuente correcta** (la proyección, vía
`getItemStatuses`), NUNCA vía la que va a cambiar (el JSON `items[].status`).

Ejemplo real: `tests/integration/item-status-lifecycle.characterization.test.ts`
(7 casos, DB real) ejerce el pipeline de producción (`projectEvent`) y lee el status
SOLO de la proyección. Por eso pasa HOY y sigue pasando tras quitar `status` del
snapshot — si sigue verde, el comportamiento está preservado (#2189).

> **La red debe ser inmune al cambio que vas a hacer.** Si tu test de seguridad lee
> de lo que vas a refactorizar, no es una red: es parte del andamiaje que se cae con
> el cambio.

## 3. Fundaciones primero, write-model al final

El orden importa. Construimos el **read-model** (`order-items.read.ts`) y **migramos
todos los lectores** ANTES de tocar el writer. Cuando finalmente quitamos `status` del
snapshot, no quedaba ningún consumer dependiendo del JSON → el cambio fue **atómico e
inofensivo**.

> **Migrá a la nueva fuente, después apagá la vieja.** Tocar el write-model con
> lectores aún apuntando al campo viejo es lo que convierte un refactor seguro en una
> cascada de breakage.

## 4. REPARAR > BORRAR código muerto

Ante código huérfano (0 llamadores), la salida fácil es borrarlo — y perder la
intención original. La preferencia del equipo (#2174) es **leer su propósito, analizar
dónde DEBERÍA conectarse, y repararlo con las mejores prácticas actuales** (leer de la
proyección, no del JSON congelado; prisma singleton; tenant seguro).

Ejemplo: el portal QR no era código muerto sino un bypass del event-sourcing
(`prisma.orders.create` directo); se **reparó** para emitir `ORDER_CREATED` +
`ORDER_ITEM_ADDED` por el pipeline real (#2181), no se borró ni se dejó roto.

> **Borrar pierde la intención. Entender + reparar preserva valor.** Default: reparar.
> Si no tiene llamadores, reportá el punto de integración natural — no lo re-wirees a
> producción sin OK.

## 5. Panel de perspectivas (council) para decisiones con tradeoffs

La primera solución propuesta (un read-model que FUSIONA JSON + proyección con fallback
`?? item.status`) parecía razonable. Un panel de 5 asesores la calificó de **"80%
correcta y por eso peligrosa"**: el 20% veneno era que la fusión **consagraba** la
duplicación en vez de matarla (#2179). El council redirigió del "cómo no duplico la
query" al "por qué existen dos verdades".

> **Lo peligroso no es la idea 100% mala — es la 80% buena.** Para decisiones de
> arquitectura con tradeoffs reales, pasá la propuesta por múltiples perspectivas
> (skill `llm-council`) antes de cementarla. Una buena idea con un defecto sutil pasa
> el sniff-test y escala el defecto.

## 6. El test de arquitectura como red permanente

Una convención que vive solo en la cabeza del que la escribió se erosiona. La
convertimos en un **gate de CI**: `no-json-status-read.test.ts` escanea el código y
falla el build si alguien lee `status` del JSON. Pasó de WARN a **bloqueante** una vez
que las violaciones reales llegaron a 0.

> **Convertí la convención en un gate.** Un test de arquitectura (fs+regex sobre las
> rutas, sin ts-morph en este repo) es la diferencia entre "acordate de no leer el
> JSON" y "el CI no te deja". Aceptá un falso negativo acotado (gate conservador) antes
> que un WARN que todos ignoran.

---

## Referencias
- ADR-010: El status de items vive en la proyección, no en el write-model
- `docs/02-architecture/EVENTS.md` — sección "Snapshot del agregado vs Proyección"
- Engram (project `park`): `#2190` (medición: 0 tests rotos), `#2189` (characterization test), `#2179` (veredicto council), `#2174` (reparar > borrar), `#2181` (reparación portal QR)
