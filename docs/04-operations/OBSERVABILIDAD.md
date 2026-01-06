# PARK POS — Observabilidad y Monitoring

**Versión:** 1.0  
**Fecha:** Enero 2026  
**Estado:** 📋 Propuesta

> **Objetivo:** Implementar observabilidad enterprise para monitorear salud, performance y errores del sistema en producción.

---

## 1) Problema Actual

```typescript
// ❌ Sin métricas de:
// - Latencia de sync
// - Tasa de errores
// - Backlog size
// - Eventos por segundo
// - Uso de memoria/CPU
// - Errores de usuarios
```

**Consecuencias:**
- No sabemos si el sistema está lento
- No detectamos errores hasta que usuarios reportan
- No podemos optimizar sin datos
- Debugging en producción es ciego

---

## 2) Solución: OpenTelemetry

### Stack Recomendado

```
┌─────────────────────────────────────────┐
│  PARK POS (Frontend + Backend)         │
│  - Traces (spans)                       │
│  - Metrics (counters, histograms)      │
│  - Logs (structured)                    │
└──────────────┬──────────────────────────┘
               │ OTLP Protocol
               ▼
┌─────────────────────────────────────────┐
│  OpenTelemetry Collector                │
│  - Recibe telemetría                    │
│  - Procesa y filtra                     │
│  - Exporta a backends                   │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┬─────────────┐
       ▼                ▼             ▼
┌──────────┐    ┌──────────┐   ┌──────────┐
│ Grafana  │    │Prometheus│   │  Loki    │
│(Dashboards)   │(Metrics) │   │  (Logs)  │
└──────────┘    └──────────┘   └──────────┘
```

---

## 3) Implementación

### 3.1 Setup OpenTelemetry

**Instalación:**
```bash
npm install @opentelemetry/api \
            @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-prometheus \
            @opentelemetry/exporter-trace-otlp-http
```

**Configuración:**
```typescript
// src/core/observability/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  metricReader: new PrometheusExporter({
    port: 9464,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Telemetry terminated'))
    .catch((error) => console.log('Error terminating telemetry', error))
    .finally(() => process.exit(0));
});
```

### 3.2 Métricas Clave

**Sync Client:**
```typescript
// src/core/sync/client.ts
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('park-pos-sync');

const syncLatency = meter.createHistogram('sync.latency', {
  description: 'Sync batch latency in milliseconds',
  unit: 'ms',
});

const syncBacklog = meter.createObservableGauge('sync.backlog', {
  description: 'Number of unsynced events',
});

const eventsProcessed = meter.createCounter('sync.events.processed', {
  description: 'Total events successfully synced',
});

const syncErrors = meter.createCounter('sync.errors', {
  description: 'Total sync errors',
});

export class SyncClient {
  async syncOnce(): Promise<IngestResponse | null> {
    const start = Date.now();
    
    try {
      const result = await this.doSync();
      
      // Métricas de éxito
      syncLatency.record(Date.now() - start);
      eventsProcessed.add(result.events.length);
      
      return result;
    } catch (error) {
      syncErrors.add(1, { error_type: error.code });
      throw error;
    }
  }
}

// Backlog observable
syncBacklog.addCallback(async (result) => {
  const count = await db.events.where('synced').equals(0).count();
  result.observe(count);
});
```

**Backend API:**
```typescript
// src/app/api/events/ingest/route.ts
import { trace, metrics } from '@opentelemetry/api';

const tracer = trace.getTracer('park-pos-api');
const meter = metrics.getMeter('park-pos-api');

const ingestLatency = meter.createHistogram('ingest.latency', {
  description: 'Event ingest latency',
  unit: 'ms',
});

const ingestBatchSize = meter.createHistogram('ingest.batch_size', {
  description: 'Number of events per batch',
});

const projectionErrors = meter.createCounter('projection.errors', {
  description: 'Projection errors by event type',
});

export async function POST(req: Request) {
  const span = tracer.startSpan('ingest.batch');
  const start = Date.now();
  
  try {
    const body = await req.json();
    const { events } = ingestRequestSchema.parse(body);
    
    ingestBatchSize.record(events.length);
    
    await prisma.$transaction(async (tx) => {
      for (const event of events) {
        await tx.event.create({...});
        
        try {
          await projectEvent(tx, event);
        } catch (error) {
          projectionErrors.add(1, { 
            event_type: event.event_type,
            error: error.message 
          });
          throw error;
        }
      }
    });
    
    ingestLatency.record(Date.now() - start);
    span.setStatus({ code: SpanStatusCode.OK });
    
    return NextResponse.json({ accepted: true });
  } catch (error) {
    span.setStatus({ 
      code: SpanStatusCode.ERROR,
      message: error.message 
    });
    throw error;
  } finally {
    span.end();
  }
}
```

---

## 4) Dashboards Grafana

### Dashboard 1: Sync Health

**Métricas:**
- Sync Latency (p50, p95, p99)
- Backlog Size (gauge)
- Events/sec (rate)
- Error Rate (%)
- Circuit Breaker State

**Queries Prometheus:**
```promql
# Latency p95
histogram_quantile(0.95, 
  rate(sync_latency_bucket[5m])
)

# Backlog
sync_backlog

# Events per second
rate(sync_events_processed_total[1m])

# Error rate
rate(sync_errors_total[5m]) / 
rate(sync_events_processed_total[5m])
```

### Dashboard 2: API Performance

**Métricas:**
- Ingest Latency
- Batch Size
- Throughput (events/sec)
- Projection Errors
- Database Connection Pool

### Dashboard 3: Business Metrics

**Métricas:**
- Orders Created (rate)
- Average Ticket Size
- Payment Methods Distribution
- Top Products
- Revenue per Hour

---

## 5) Alertas

### Alertas Críticas

**1. Sync Backlog Alto**
```yaml
alert: SyncBacklogHigh
expr: sync_backlog > 1000
for: 5m
severity: warning
message: "Sync backlog is {{ $value }} events"
```

**2. Error Rate Alto**
```yaml
alert: SyncErrorRateHigh
expr: rate(sync_errors_total[5m]) > 0.1
for: 2m
severity: critical
message: "Sync error rate is {{ $value }}"
```

**3. API Latency Alta**
```yaml
alert: IngestLatencyHigh
expr: histogram_quantile(0.95, rate(ingest_latency_bucket[5m])) > 1000
for: 5m
severity: warning
message: "Ingest p95 latency is {{ $value }}ms"
```

---

## 6) Logs Estructurados

**Formato:**
```typescript
// src/core/observability/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Uso
logger.info({
  event: 'sync.batch.success',
  tenant_id: 'xxx',
  terminal_id: 'term_1',
  events_count: 50,
  latency_ms: 234,
}, 'Sync batch completed');
```

---

## 7) Prioridad y Esfuerzo

**Prioridad:** ⚠️ IMPORTANTE  
**Esfuerzo:** 2-3 días  
**Fase:** P0 (antes de producción)

**Beneficios:**
- ✅ Detección temprana de problemas
- ✅ Optimización basada en datos
- ✅ Debugging rápido
- ✅ SLA monitoring
- ✅ Capacity planning

