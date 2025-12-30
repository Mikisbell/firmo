# ADR-002: Sync at-least-once con idempotencia y ACK por secuencia

## Estado
Aceptado

## Contexto
La red es intermitente. El cliente debe reintentar sin duplicar ventas en cloud.

## Decisión
El cliente sincroniza batches de eventos a `POST /api/events/ingest`.
El cloud dedupea por `UNIQUE(store_id, event_id)`.
La respuesta incluye `acked_through_terminal_sequence` y el cliente marca como synced todos los eventos <= ack.
El sistema opera "at least once" + idempotencia.

## Alternativas Consideradas
- **Exactly-once:** costoso y complejo sin necesidad real.
- **Sync por "último timestamp":** falla con relojes y reintentos.
- **Cola con confirmación por cada evento:** más latencia.

## Consecuencias

### Positivas
- Reintentos seguros.
- ACK simple y eficiente.

### Negativas
- Requiere mantener `terminal_sequence` estricto y batches ordenados.

## Fecha
2025-12-30
