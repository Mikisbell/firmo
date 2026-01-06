# ADR-008: Outbox Pattern para Garantía de Entrega SSE

## Estado
Propuesto

## Contexto
El sistema actual publica eventos a SSE (Server-Sent Events) después de commitear la transacción en PostgreSQL. Si la publicación falla, el evento queda guardado en DB pero no se notifica a otros terminales, causando inconsistencia temporal.

```typescript
// Flujo actual
await prisma.$transaction(async (tx) => {
  await tx.event.create({...});
  await projectEvent(tx, event);
});
// ❌ Si falla aquí, evento no se notifica
eventBus.publish(tenant_id, event);
```

## Decisión
Implementar el **Outbox Pattern** con una tabla `event_outbox` que garantiza entrega "at least once" de eventos a SSE mediante un worker dedicado.

### Componentes

1. **Tabla event_outbox**: Almacena eventos pendientes de publicación dentro de la transacción
2. **Worker Publisher**: Procesa outbox cada 100ms y publica a EventBus
3. **Retry Logic**: Reintentos automáticos con tracking de errores

### Flujo

```
┌─────────────────────────────────────────┐
│  1. Ingest API recibe batch             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Transaction BEGIN                   │
│     - INSERT events                     │
│     - Project to orders/invoices        │
│     - INSERT event_outbox               │
│  3. Transaction COMMIT                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Worker (cada 100ms)                 │
│     - SELECT * FROM event_outbox        │
│       WHERE published = FALSE           │
│     - eventBus.publish(event)           │
│     - UPDATE published = TRUE           │
└─────────────────────────────────────────┘
```

## Alternativas Consideradas

### 1. Publicar dentro de Transaction
**Rechazado:** EventBus es in-memory, no transaccional. Si falla, rollback no ayuda.

### 2. Two-Phase Commit (2PC)
**Rechazado:** Complejidad innecesaria para MVP. Outbox es más simple y probado.

### 3. Kafka/RabbitMQ
**Rechazado:** Overhead de infraestructura. Outbox + in-memory EventBus es suficiente para 15 terminales.

## Consecuencias

### Positivas
- ✅ Garantía de entrega "at least once"
- ✅ Retry automático en caso de fallo
- ✅ Auditoría completa de publicaciones
- ✅ No pierde eventos si EventBus falla
- ✅ Simple de implementar y mantener

### Negativas
- ⚠️ Latencia adicional de ~100ms (aceptable para MVP)
- ⚠️ Tabla adicional a mantener
- ⚠️ Worker adicional a monitorear

### Mitigación
- Worker con health check
- Alertas si outbox crece > 1000 eventos
- Cleanup de eventos publicados > 7 días

## Implementación

### Schema
```sql
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id),
  payload JSONB NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_outbox_pending (tenant_id, published, created_at)
    WHERE published = FALSE
);
```

### Worker
```typescript
setInterval(async () => {
  const pending = await prisma.eventOutbox.findMany({
    where: { published: false },
    orderBy: { created_at: 'asc' },
    take: 100,
  });

  for (const item of pending) {
    try {
      eventBus.publish(item.tenant_id, item.payload);
      await prisma.eventOutbox.update({
        where: { id: item.id },
        data: { published: true, published_at: new Date() },
      });
    } catch (error) {
      await prisma.eventOutbox.update({
        where: { id: item.id },
        data: { 
          attempts: { increment: 1 },
          last_error: error.message,
        },
      });
    }
  }
}, 100);
```

## Fecha
2026-01-05

## Referencias
- [Outbox Pattern - Microsoft](https://microservices.io/patterns/data/transactional-outbox.html)
- ADR-002: Sync at-least-once
- ADR-007: Hybrid Cloud Security

