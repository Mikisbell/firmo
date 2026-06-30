# ADR-012: El ingest valida transiciones de estado de items (defensa de ORDER_ITEM_VOIDED)

## Estado
Aceptado

## Fecha
2026-06-29

## Decisores
Belico (arquitecto)

## Contexto

Hallazgo de la **auditoría fresca de seguridad/calidad** (2026-06-29). El validador
server-side `validateItemVoided` (`src/core/validation/business-rules.ts`) verificaba la
razón, la existencia de la orden y su estado, y los permisos de manager — pero **NO el
estado del ITEM que se anula**.

### El hueco
- El inventario de un item se **deduce cuando pasa a `DONE`**
  (`ORDER_ITEM_STATUS_CHANGED -> DONE` en `project-event.ts:686`, vía `deductInventoryForOrder`).
- `DONE` y `VOIDED` son **estados terminales** (`item-status-machine.ts`): un item `DONE`
  NO puede transicionar a `VOIDED`.
- El **frontend** (KDS: cocina, bar, horno, empaque) respeta `canTransition`, así que
  **nunca ofrece anular un item `DONE`**. En uso normal el problema no ocurre.
- PERO `canTransition` **solo se usa en el front**, jamás en el server. En event-sourcing
  **offline-first, el ingest no debe confiar en que el cliente respetó la máquina de
  estados** (eventos offline, replay fuera de orden, manipulación). Un `ORDER_ITEM_VOIDED`
  para un item `DONE` **pasaba la validación** → el handler borraba la proyección
  (`DELETE FROM order_item_projections`) **sin reversar el inventario ya deducido** →
  **descuadre de stock**.

Severidad: **MEDIA** (el front lo previene; el flanco abierto es server-side, requiere un
evento corrupto/manipulado). Se corrige por principio: el ingest es la frontera de
confianza.

## Decisión

`validateItemVoided` lee el **status VIVO** del item desde `order_item_projections` (única
fuente, ver [ADR-010](010-item-status-projection-ownership.md)) y **rechaza** anular items
en estado terminal:

```ts
const statuses = await getItemStatuses(tx, event.tenant_id, payload.order_id);
const itemStatus = statuses.get(payload.line_id)?.status;
if (itemStatus === "DONE" || itemStatus === "VOIDED") {
  return { valid: false, error: "ITEM_NOT_VOIDABLE", details: { line_id, status } };
}
```

**Se cierra el hueco en la RAÍZ (validación), no con un parche en el handler.** NO se
agregó una "reversa de inventario" en el handler de `ORDER_ITEM_VOIDED`: con esta
validación, el handler **nunca** procesa un VOID de item deducido, así que una reversa ahí
sería **código muerto**. Arreglar el problema donde nace, no maquillar la capa siguiente.

## Capas tocadas
- **DB**: sin cambios. El status vivo ya vive en `order_item_projections` (ADR-010).
- **Backend**: `validateItemVoided` rechaza `DONE`/`VOIDED` con `ITEM_NOT_VOIDABLE`.
- **Frontend**: sin cambios — ya respeta `canTransition` (no ofrece VOID en terminales).

## Consecuencias

- ✅ El ingest deja de confiar en el cliente para la transición de estado del item.
- ✅ Imposible descuadrar inventario anulando un item ya deducido (validación lo bloquea).
- ✅ Test de caracterización: `src/core/validation/__tests__/item-voidable.test.ts` (4/4):
  rechaza DONE y VOIDED; permite COOKING y PENDING (sin proyección).
- 🔭 Generalizable: la misma idea (validar la máquina de estados server-side) aplica a
  futuros eventos de transición; por ahora se acota a `ORDER_ITEM_VOIDED` (el único con
  efecto colateral de inventario).

## Referencias
- Auditoría fresca 2026-06-29 (4 dimensiones: auth, dinero, concurrencia, validación).
- ADR-010 (status de items en la proyección). `item-status-machine.ts` (transiciones).
