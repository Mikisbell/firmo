# Implementation Plan: Event Sourcing Critical Fixes

## Overview

Este plan de implementación corrige los problemas críticos de Event Sourcing identificados en los tests E2E de Playwright. El objetivo es hacer que los 8 tests fallando pasen y que el sistema esté listo para producción.

**Prioridad:** 🔴 BLOQUEANTE para producción

**Tests a Corregir:**
- Test 18: Event Deduplication (Idempotency)
- Tests 23-27: Multi-Terminal Concurrency (5 tests)
- Test 29: Event Deduplication (Identical Events)
- Test 30: Out-of-Order Event Delivery
- Test 31: Rate Limiting (Burst Events)

## Tasks

- [x] 1. Implementar Deduplication Service con processed_events
  - Crear tabla `processed_events` con constraint UNIQUE en event_id
  - Implementar función `markAsProcessed()` con manejo de P2002
  - Modificar `projectEvent()` para verificar duplicados ANTES de proyectar
  - Agregar índice `(tenant_id, processed_at)` para limpieza
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.8_

- [ ]* 1.1 Escribir property test para idempotencia de deduplicación
  - **Property 1: Idempotencia de Deduplicación**
  - **Validates: Requirements 1.1, 1.4, 1.7**

- [ ]* 1.2 Escribir unit tests para deduplication service
  - Test: inserción simultánea del mismo evento
  - Test: event_id en deduped_event_ids
  - Test: verificación de processed_events
  - _Requirements: 1.2, 1.3, 1.7_

- [x] 2. Implementar Atomicidad en Verificación de Duplicados
  - Configurar isolation level SERIALIZABLE en transacciones
  - Mover verificación de duplicados dentro de `prisma.$transaction()`
  - Implementar manejo de constraint violations (P2002)
  - Agregar logging para eventos deduplicados
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 2.1 Escribir property test para atomicidad de transacciones
  - **Property 2: Atomicidad de Verificación y Marcado**
  - **Validates: Requirements 2.1, 2.4**

- [x] 3. Implementar Optimistic Locking en Orders
  - Agregar campo `revision` a tabla orders (default 1)
  - Modificar `projectEvent()` para verificar revision antes de aplicar
  - Implementar incremento de revision después de cada evento
  - Integrar con `detectAndResolveConflict()` existente
  - _Requirements: 3.4, 3.5_

- [ ]* 3.1 Escribir property test para detección de conflictos
  - **Property 4: Detección de Conflictos de Revisión**
  - **Validates: Requirements 3.4, 3.5**

- [x] 4. Implementar Order Number Range Service
  - Crear tabla `terminal_number_ranges` con PK (tenant_id, terminal_id)
  - Implementar función `assignRange()` con SELECT FOR UPDATE
  - Implementar validación de order_number en rango asignado
  - Agregar buffer de números pre-asignados por terminal (100 números)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8_

- [ ]* 4.1 Escribir property test para asignación única de order numbers
  - **Property 6: Asignación Única de Order Numbers**
  - **Validates: Requirements 4.2, 4.5, 4.6**

- [ ]* 4.2 Escribir unit tests para order number ranges
  - Test: asignación atómica de rangos
  - Test: validación de números fuera de rango
  - Test: solicitud de nuevo rango al agotar
  - _Requirements: 4.3, 4.4, 4.7_

- [x] 5. Implementar Out-of-Order Event Queue
  - Crear clase `OutOfOrderQueue` con Map<aggregate_id, QueuedEvent[]>
  - Implementar función `enqueue()` para eventos fuera de orden
  - Implementar función `processQueuedEvents()` para procesar cola
  - Implementar cleanup job con timeout de 60 segundos
  - Crear tabla `dead_letter_queue` para eventos expirados
  - Agregar alerta cuando >10 eventos encolados
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [ ]* 5.1 Escribir property test para orden de eventos por terminal
  - **Property 5: Orden de Eventos por Terminal**
  - **Validates: Requirements 3.6, 5.4**

- [ ]* 5.2 Escribir unit tests para out-of-order queue
  - Test: encolado de eventos con gap en sequence
  - Test: procesamiento de cola cuando llega evento faltante
  - Test: timeout y movimiento a DLQ
  - Test: alerta con >10 eventos encolados
  - _Requirements: 5.1, 5.5, 5.6, 5.7, 5.8_

- [x] 6. Implementar Rate Limiter con Redis
  - Crear `RateLimiterService` con sliding window algorithm
  - Implementar función `checkLimit()` usando Redis sorted sets
  - Configurar límites: 100 req/s normal, 200 req/s burst
  - Crear middleware `rateLimitMiddleware` para Express
  - Retornar HTTP 429 con header Retry-After cuando se excede
  - Agregar métricas de rate limiting (requests rechazados, bursts)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ]* 6.1 Escribir property test para rate limiting por tenant
  - **Property 7: Rate Limiting por Tenant**
  - **Validates: Requirements 6.2, 6.3, 6.6**

- [ ]* 6.2 Escribir unit tests para rate limiter
  - Test: límite de 100 req/s
  - Test: burst de 200 req/s
  - Test: HTTP 429 con Retry-After
  - Test: rate limiting por tenant_id (no por terminal_id)
  - _Requirements: 6.2, 6.3, 6.4, 6.6, 6.7_

- [x] 7. Mejorar Retry Logic en SyncClient
  - Implementar exponential backoff (1s → 60s)
  - Agregar jitter aleatorio del 20%
  - Respetar header Retry-After para HTTP 429
  - NO reintentar HTTP 4xx (excepto 429)
  - Reintentar hasta 5 veces para HTTP 5xx
  - Integrar con circuit breaker existente
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ]* 7.1 Escribir property test para retry con exponential backoff
  - **Property 8: Retry con Exponential Backoff**
  - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ]* 7.2 Escribir unit tests para retry logic
  - Test: backoff inicial de 1s
  - Test: duplicación de tiempo en cada intento
  - Test: jitter del 20%
  - Test: respeto de Retry-After
  - Test: no retry para 4xx
  - Test: circuit breaker abre después de 10 fallos
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 8. Implementar Validación Exhaustiva de Eventos
  - Agregar validación de UUIDs (event_id, aggregate_id, actor_id)
  - Validar tenant_id coincide con request
  - Validar terminal_id está registrado en tabla terminals
  - Implementar validación de reglas de negocio por tipo de evento
  - Agregar respuestas estructuradas con error_code y detalles
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ]* 8.1 Escribir property test para validación de UUIDs
  - **Property 9: Validación de UUIDs**
  - **Validates: Requirements 8.3**

- [ ]* 8.2 Escribir unit tests para validación de eventos
  - Test: rechazo de UUIDs inválidos
  - Test: rechazo de tenant_id incorrecto
  - Test: rechazo de terminal_id no registrado
  - Test: validación de reglas de negocio
  - Test: respuestas con error_code y detalles
  - _Requirements: 8.2, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ] 9. Implementar Logging y Observabilidad
  - Agregar logs estructurados para eventos procesados
  - Registrar eventos deduplicados con nivel INFO
  - Registrar eventos rechazados con nivel WARN
  - Registrar conflictos con nivel WARN
  - Emitir métricas de Prometheus (eventos procesados, deduplicados, rechazados, latencia)
  - Registrar conflictos en tabla conflict_logs
  - Implementar alerta para >10% eventos deduplicados
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8_

- [ ]* 9.1 Escribir property test para logging de eventos
  - **Property 10: Logging de Eventos Procesados**
  - **Validates: Requirements 9.1**

- [ ]* 9.2 Escribir unit tests para observabilidad
  - Test: logs estructurados con contexto completo
  - Test: métricas de Prometheus
  - Test: registro en conflict_logs
  - Test: alerta para patrón anómalo
  - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.7, 9.8_

- [ ] 10. Checkpoint - Ejecutar Tests E2E
  - Ejecutar test "should handle duplicate event submission (idempotency)"
  - Ejecutar test "should handle simultaneous orders from multiple waiters"
  - Ejecutar test "should handle same product added from 2 terminals to same order"
  - Ejecutar test "should handle order number collision prevention"
  - Ejecutar test "should handle rapid sequential events from same terminal"
  - Ejecutar test "should handle 15 waiters + 1 cashier simultaneous operations"
  - Ejecutar test "should deduplicate identical events sent multiple times"
  - Ejecutar test "should handle out-of-order event delivery"
  - Ejecutar test "should handle burst of events gracefully"
  - Verificar que todos los 8 tests pasen
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

- [ ] 11. Integración y Wiring
  - Integrar deduplication service en ingest endpoint
  - Integrar rate limiter middleware en ruta /api/events/ingest
  - Integrar order number validation en validateEvent()
  - Integrar out-of-order queue en flujo de procesamiento
  - Configurar Redis para rate limiting
  - Configurar isolation level en Prisma
  - _Requirements: Todos_

- [ ]* 11.1 Escribir integration tests end-to-end
  - Test: flujo completo de deduplicación
  - Test: flujo completo de concurrencia
  - Test: flujo completo de rate limiting
  - Test: flujo completo de out-of-order events
  - _Requirements: Todos_

- [ ] 12. Final Checkpoint - Verificación Completa
  - Ejecutar todos los 228 tests E2E sin timeout
  - Verificar 100% de tests pasando
  - Verificar coverage ≥90% en componentes críticos
  - Verificar property tests con 100 iteraciones
  - Verificar métricas de performance (latencia <200ms p95)
  - Confirmar sistema listo para producción
  - _Requirements: 10.10_

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requirements específicos que valida
- Los property tests deben ejecutar mínimo 100 iteraciones
- Los checkpoints aseguran validación incremental
- Prioridad: Tareas 1-6 son críticas, 7-9 son importantes, 10-12 son validación

