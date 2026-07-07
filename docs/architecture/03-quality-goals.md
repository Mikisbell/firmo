# 3. Metas de Calidad

> Los atributos de calidad que dirigen las decisiones arquitectónicas, ordenados por prioridad.

## Quality Tree

```
                        FIRMO POS
                           │
           ┌───────────────┼───────────────┐
           │               │               │
     Disponibilidad   Integridad      Rendimiento
     (Offline-first)  (Datos correctos) (Respuesta rápida)
           │               │               │
     ┌─────┤         ┌─────┤         ┌─────┤
     │     │         │     │         │     │
   Venta  Sync    Dinero  Audit   POS    KDS
   offline eventual exacto trail  <2s   <1s
```

## Atributos de Calidad con Escenarios

### Q1. Disponibilidad — Operación Offline (PRIORIDAD MÁXIMA)

| Aspecto | Escenario |
|---------|-----------|
| **Estímulo** | Internet cae durante servicio de almuerzo |
| **Respuesta** | El cajero puede seguir vendiendo, tomando pedidos, imprimiendo tickets |
| **Medida** | Operación continua por ≥8 horas sin conexión |
| **Estado actual** | Implementado via Dexie/IndexedDB + SyncClient + Outbox |

| Aspecto | Escenario |
|---------|-----------|
| **Estímulo** | Internet regresa tras 2 horas offline |
| **Respuesta** | Todos los eventos offline se sincronizan sin pérdida |
| **Medida** | 0 eventos perdidos, orden cronológico preservado |
| **Estado actual** | Implementado. Gap: cola out-of-order es in-memory (riesgo de pérdida si tab se cierra) |

### Q2. Integridad de Datos — Dinero Exacto

| Aspecto | Escenario |
|---------|-----------|
| **Estímulo** | Cajero registra pago de S/ 125.50 en 3 formas: efectivo, Yape, vuelto |
| **Respuesta** | Total en centavos = 12550. Suma de pagos = total. Cuadre de turno exacto |
| **Medida** | 0 errores de redondeo. Cuadre automático ±0 centavos |
| **Estado actual** | Implementado. Tipo branded `Centavos`, toda aritmética en integers |

| Aspecto | Escenario |
|---------|-----------|
| **Estímulo** | Dos terminales modifican el mismo pedido simultáneamente offline |
| **Respuesta** | El sistema detecta el conflicto y aplica resolución por tipo de evento |
| **Medida** | Pagos: rechazo + retry manual. Items: merge. Otros: LWW |
| **Estado actual** | Implementado. Pagos se rechazan para evitar cobros dobles |

### Q3. Rendimiento — Respuesta Rápida

| Aspecto | Escenario |
|---------|-----------|
| **Estímulo** | Cajero presiona "Cobrar" en hora punta (20 mesas simultáneas) |
| **Respuesta** | La UI confirma el pago |
| **Medida** | <2 segundos con conexión, <500ms offline |
| **Estado actual** | Parcial. Offline OK (<500ms local). Online depende de latencia DB |

| Aspecto | Escenario |
|---------|-----------|
| **Estímulo** | Cocinero ve nuevo ticket en KDS |
| **Respuesta** | Ticket aparece en pantalla |
| **Medida** | <3 segundos desde que cajero envía la orden |
| **Estado actual** | Implementado via SSE + Supabase LISTEN/NOTIFY. No medido en producción |

### Q4. Auditabilidad — Trazabilidad Completa

| Aspecto | Escenario |
|---------|-----------|
| **Estímulo** | Admin necesita saber quién modificó un precio hace 2 semanas |
| **Respuesta** | Event log muestra: quién, cuándo, desde qué terminal, qué cambió |
| **Medida** | 100% de operaciones de negocio trazables via event store |
| **Estado actual** | Implementado. 73 tipos de evento. Inmutable. Snapshots server-side existen (`snapshot.service.ts`), pero sin archival de eventos viejos |

### Q5. Seguridad — Multi-tenant Isolation

| Aspecto | Escenario |
|---------|-----------|
| **Estímulo** | Un empleado del Tenant A intenta acceder a datos del Tenant B |
| **Respuesta** | Request rechazado con 403 |
| **Medida** | 0 data leaks entre tenants |
| **Estado actual** | Implementado via JWT + WHERE tenant_id. Gap: sin Row-Level Security en PostgreSQL |

## Escenarios NO Cubiertos (Deuda)

| Escenario | Por qué importa | Dificultad |
|-----------|-----------------|------------|
| Event store con 10M filas, rebuild de projections | Full replay sin server-side snapshots | Alta |
| 50+ tenants en single DB | Noisy neighbor sin resource quotas a nivel DB | Media |
| Restaurar datos de un solo tenant | Impossible con backup global de single DB | Alta |
| Cold start de Vercel function con 261 routes | Latencia primer request >3s | Media |
