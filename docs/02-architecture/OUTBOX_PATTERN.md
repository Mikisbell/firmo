# Outbox Pattern — Sincronización Confiable

## Problema

En un sistema offline-first, los eventos se generan localmente y deben sincronizarse con el servidor. Sin un mecanismo robusto:

1. **Pérdida de datos**: Si la red falla durante el envío, el evento puede perderse
2. **Duplicados**: Si el servidor recibe pero el cliente no confirma, se reenvía
3. **Orden incorrecto**: Eventos pueden llegar desordenados al servidor

## Solución: Outbox Pattern

Cada evento pasa por estados definidos en IndexedDB antes de considerarse sincronizado.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PENDING   │ ──► │   SENDING   │ ──► │   SYNCED    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       └──────────► │   FAILED    │ (retry después)
                    └─────────────┘
```

## Estados del Evento

| Estado | Descripción | Acción |
|--------|-------------|--------|
| `PENDING` | Recién creado, esperando sync | Worker lo procesa |
| `SENDING` | En tránsito al servidor | Timeout → FAILED |
| `SYNCED` | Confirmado por servidor | Puede limpiarse después |
| `FAILED` | Error de red/servidor | Retry con backoff |

## Implementación

### 1. Schema IndexedDB (Dexie)

```typescript
// src/core/db/schema.ts
interface EventRecord {
  event_id: string;           // PK
  terminal_sequence: number;  // Orden local
  synced: 0 | 1;             // 0=pending, 1=synced
  sync_status: 'PENDING' | 'SENDING' | 'SYNCED' | 'FAILED';
  retry_count: number;
  last_error?: string;
  created_at: string;
  synced_at?: string;
  // ... resto del evento
}
```

### 2. Outbox Worker

```typescript
// src/core/sync/outbox-worker.ts
export class OutboxWorker {
  private intervalId: number | null = null;
  private readonly SYNC_INTERVAL_MS = 5000;
  private readonly MAX_RETRIES = 5;
  private readonly BATCH_SIZE = 50;

  start() {
    if (this.intervalId) return;
    this.intervalId = window.setInterval(() => this.processOutbox(), this.SYNC_INTERVAL_MS);
    // Sync inmediato al iniciar
    this.processOutbox();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async processOutbox() {
    // 1. Obtener eventos PENDING (ordenados por sequence)
    const pending = await db.events
      .where('sync_status')
      .equals('PENDING')
      .limit(this.BATCH_SIZE)
      .sortBy('terminal_sequence');

    if (pending.length === 0) return;

    // 2. Marcar como SENDING
    const ids = pending.map(e => e.event_id);
    await db.events.where('event_id').anyOf(ids).modify({ sync_status: 'SENDING' });

    // 3. Enviar batch al servidor
    try {
      const response = await this.sendBatch(pending);
      
      if (response.accepted) {
        // 4a. Éxito: marcar como SYNCED
        await db.events.where('event_id').anyOf(ids).modify({
          sync_status: 'SYNCED',
          synced: 1,
          synced_at: new Date().toISOString(),
        });
      } else {
        // 4b. Rechazo del servidor: marcar errores específicos
        await this.handleRejections(response.rejected);
      }
    } catch (error) {
      // 4c. Error de red: volver a PENDING o FAILED
      await this.handleNetworkError(ids, error);
    }
  }

  private async handleNetworkError(ids: string[], error: Error) {
    for (const id of ids) {
      const event = await db.events.get(id);
      if (!event) continue;

      const newRetryCount = (event.retry_count || 0) + 1;
      
      if (newRetryCount >= this.MAX_RETRIES) {
        await db.events.update(id, {
          sync_status: 'FAILED',
          retry_count: newRetryCount,
          last_error: error.message,
        });
      } else {
        await db.events.update(id, {
          sync_status: 'PENDING',
          retry_count: newRetryCount,
          last_error: error.message,
        });
      }
    }
  }
}
```

### 3. Exponential Backoff

Para eventos que fallan repetidamente:

```typescript
function getRetryDelay(retryCount: number): number {
  // 1s, 2s, 4s, 8s, 16s (max)
  const baseDelay = 1000;
  const maxDelay = 16000;
  return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
}
```

### 4. Indicador Visual

El usuario debe saber el estado de sincronización:

```typescript
// Hook para UI
function useSyncStatus() {
  const [status, setStatus] = useState<'synced' | 'pending' | 'error'>('synced');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      const pending = await db.events.where('synced').equals(0).count();
      const failed = await db.events.where('sync_status').equals('FAILED').count();
      
      setPendingCount(pending);
      if (failed > 0) setStatus('error');
      else if (pending > 0) setStatus('pending');
      else setStatus('synced');
    };

    const interval = setInterval(check, 2000);
    check();
    return () => clearInterval(interval);
  }, []);

  return { status, pendingCount };
}
```

## Flujo Completo

```
1. Usuario agrega item al pedido
   ↓
2. POSActions.addItem() crea evento con sync_status='PENDING'
   ↓
3. Evento se guarda en IndexedDB inmediatamente
   ↓
4. UI se actualiza (optimistic update)
   ↓
5. OutboxWorker detecta evento PENDING
   ↓
6. Worker envía batch al servidor
   ↓
7a. Éxito → sync_status='SYNCED', synced=1
7b. Error red → retry_count++, vuelve a PENDING
7c. Error servidor → sync_status='FAILED' con mensaje
   ↓
8. UI muestra indicador de sync status
```

## Consideraciones

### Idempotencia
El servidor debe manejar eventos duplicados usando `event_id` como clave única.

### Orden de Eventos
Los eventos se envían ordenados por `terminal_sequence`. El servidor debe procesarlos en orden.

### Limpieza
Eventos SYNCED pueden eliminarse después de X días para liberar espacio en IndexedDB.

### Conflictos
Si dos terminales modifican el mismo pedido, el servidor resuelve por timestamp (`occurred_at`).

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/core/db/schema.ts` | Agregar campos sync_status, retry_count |
| `src/core/sync/outbox-worker.ts` | Nuevo: lógica del worker |
| `src/core/sync/client.ts` | Integrar con OutboxWorker |
| `src/app/(pos)/layout.tsx` | Iniciar worker en mount |
| `src/components/SyncIndicator.tsx` | Nuevo: indicador visual |

## Métricas

- Eventos pendientes por terminal
- Tiempo promedio de sincronización
- Tasa de fallos por tipo de error
- Eventos en estado FAILED (requiere atención)
