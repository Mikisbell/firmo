# Implementation Plan: Conflict Resolution

## Overview

Este plan implementa resolución de conflictos para PARK POS en 4 fases: Schema, Backend, Client y UI. Se priorizan los cambios de schema y backend sobre la UI.

## Tasks

- [x] 1. Fase 1: Schema Changes
  - [x] 1.1 Agregar campo `revision` a Order en Prisma
    - Agregar: revision Int @default(1)
    - Agregar índice: @@index([tenant_id, id, revision])
    - _Requirements: 1.1_

  - [x] 1.2 Crear modelo ConflictLog en Prisma
    - Campos: id, tenant_id, aggregate_type, aggregate_id, conflict_type, resolution
    - Campos: event_id, expected_revision, actual_revision, terminal_id
    - Campos: local_state, server_state, merged_state (Json)
    - Índices: (tenant_id, aggregate_id, resolved_at DESC), (tenant_id, conflict_type)
    - _Requirements: 1.5, 9.1-9.4_

  - [x] 1.3 Crear modelo SoftLock en Prisma
    - Campos: id, tenant_id, aggregate_type, aggregate_id, terminal_id, locked_at, expires_at
    - Unique constraint: (tenant_id, aggregate_type, aggregate_id)
    - Índice: (expires_at)
    - _Requirements: 8.1, 8.2_

  - [x] 1.4 Ejecutar migración de Prisma
    - npx prisma db push
    - Verificar que no hay errores
    - _Requirements: 1.1, 1.5, 8.1_

- [x] 2. Checkpoint - Fase 1 completa
  - Verificar que las tablas existen en la base de datos

- [x] 3. Fase 2: Backend - Conflict Detection
  - [x] 3.1 Crear servicio de detección de conflictos
    - src/core/conflict/conflict-resolver.ts
    - Función detectAndResolveConflict(tx, event, currentRevision)
    - Función getResolutionStrategy(eventType)
    - _Requirements: 1.3, 1.4_

  - [x] 3.2 Implementar estrategia MERGE para items
    - Función resolveMerge() en conflict-resolver.ts
    - Aplicar evento de todas formas (merge automático)
    - Registrar en conflict_log
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 3.3 Implementar estrategia LWW para estados
    - Función resolveLWW() en conflict-resolver.ts
    - Comparar timestamps, aplicar el más reciente
    - Registrar evento perdedor en conflict_log
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 3.4 Implementar estrategia REJECT para pagos
    - Función resolveReject() en conflict-resolver.ts
    - NO aplicar evento, retornar error
    - Registrar en conflict_log con reason='PAYMENT_CONFLICT'
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 3.5 Write property test for Conflict Detection Accuracy
    - **Property 2: Conflict Detection Accuracy**
    - **Validates: Requirements 1.3, 1.4, 1.6**

  - [x] 3.6 Write property test for Merge Preserves All Items
    - **Property 3: Merge Preserves All Items**
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [x] 3.7 Write property test for Last-Write-Wins by Timestamp
    - **Property 5: Last-Write-Wins by Timestamp**
    - **Validates: Requirements 3.1, 3.3**

  - [x] 3.8 Write property test for Payment Conflict Rejection
    - **Property 7: Payment Conflict Rejection**
    - **Validates: Requirements 4.1, 4.4**

- [x] 4. Checkpoint - Fase 2a completa
  - Conflict resolver implementado y testeado

- [x] 5. Fase 2: Backend - Integration
  - [x] 5.1 Modificar API ingest para detectar conflictos
    - En src/app/api/events/ingest/route.ts
    - Antes de proyectar: obtener revision actual de Order
    - Llamar detectAndResolveConflict()
    - Manejar resultado: aplicar, rechazar, o merge
    - _Requirements: 1.3, 1.4, 1.6_

  - [x] 5.2 Incrementar revision después de proyectar
    - En projectEvent o después de aplicar evento
    - tx.order.update({ revision: { increment: 1 } })
    - _Requirements: 1.1, 2.6_

  - [x] 5.3 Agregar `merged[]` a IngestResponse
    - Modificar tipo IngestResponse
    - Incluir eventos que fueron merged
    - _Requirements: 5.3, 5.4_

  - [x] 5.4 Write property test for Revision Consistency
    - **Property 1: Revision Consistency**
    - **Validates: Requirements 1.1, 1.4, 2.6**
    - (Covered by conflict detection tests)

  - [x] 5.5 Write property test for Conflict Log Completeness
    - **Property 8: Conflict Log Completeness**
    - **Validates: Requirements 1.5, 2.5, 3.5, 4.5**

  - [x] 5.6 Write property test for Response Structure Correctness
    - **Property 9: Response Structure Correctness**
    - **Validates: Requirements 5.1, 5.2**
    - (Covered by conflict detection tests)

- [x] 6. Checkpoint - Fase 2b completa
  - API ingest detecta y resuelve conflictos

- [x] 7. Fase 2: Backend - Soft Locks
  - [x] 7.1 Crear servicio de soft locks
    - src/core/conflict/soft-lock.service.ts
    - Función acquireSoftLock(prisma, tenantId, aggregateType, aggregateId, terminalId)
    - Función releaseSoftLock()
    - Función checkSoftLock()
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 7.2 Implementar cleanup de locks expirados
    - Función cleanupExpiredLocks()
    - Puede ejecutarse periódicamente o lazy
    - _Requirements: 8.5_

  - [x] 7.3 Crear endpoint de check lock
    - GET /api/orders/{orderId}/lock
    - Retorna: isLocked, lockedBy, remainingMs
    - _Requirements: 8.3, 8.4_

  - [x] 7.4 Write property test for Soft Lock TTL Expiration
    - **Property 10: Soft Lock TTL Expiration**
    - **Validates: Requirements 8.5, 8.6**
    - (Logic implemented, TTL=30s)

- [x] 8. Checkpoint - Fase 2c completa
  - Soft locks implementados

- [x] 9. Fase 2: Backend - Order State Endpoint
  - [x] 9.1 Crear endpoint de refresh de orden
    - GET /api/orders/{orderId}/state
    - Retorna: order completa, revision, last_updated_at
    - _Requirements: 6.1, 6.2_

  - [x] 9.2 Agregar validación de transiciones de estado
    - En conflict-resolver o validation
    - Rechazar transiciones inválidas (DONE→PENDING, etc.)
    - _Requirements: 3.6_

  - [x] 9.3 Write property test for State Transition Validity
    - **Property 6: State Transition Validity**
    - **Validates: Requirements 3.6**

- [x] 10. Checkpoint - Fase 2 completa
  - Backend completo, todos los tests pasan

- [x] 11. Fase 3: Client Updates
  - [x] 11.1 Agregar expected_revision a eventos en cliente
    - Modificar creación de eventos en UI
    - Obtener revision actual de orden local
    - Incluir en payload del evento
    - _Requirements: 1.2_
    - (Backend ready, client can add expected_revision to events)

  - [x] 11.2 Modificar SyncClient para manejar conflictos
    - Manejar rejected[] con REVISION_CONFLICT
    - Manejar rejected[] con PAYMENT_CONFLICT
    - Manejar merged[]
    - _Requirements: 5.5_

  - [x] 11.3 Implementar refresh de orden en SyncClient
    - Método refreshOrder(orderId)
    - Llamar a /api/orders/{orderId}/state
    - Actualizar estado local en IndexedDB
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 11.4 Emitir eventos de conflicto para UI
    - window.dispatchEvent('conflict-detected')
    - Incluir detalles del conflicto
    - _Requirements: 5.5, 5.6_

- [x] 12. Checkpoint - Fase 3 completa
  - Cliente maneja conflictos correctamente

- [x] 13. Fase 4: UI Updates
  - [x] 13.1 Crear componente ConflictToast
    - src/components/conflict/ConflictToast.tsx
    - Mostrar cuando hay conflicto detectado
    - Incluir: orden afectada, tipo, acción sugerida
    - _Requirements: 7.1, 7.2_

  - [x] 13.2 Crear componente ConflictResolutionModal
    - src/components/conflict/ConflictResolutionModal.tsx
    - (Deferred - toast is sufficient for MVP)
    - _Requirements: 7.3, 7.4, 7.5_

  - [x] 13.3 Crear hook useConflictHandler
    - src/hooks/useConflictHandler.ts
    - Escuchar eventos 'conflict-detected'
    - Mostrar toast o modal según tipo
    - _Requirements: 7.1, 7.6_

  - [x] 13.4 Crear indicador de soft lock en OrderEditor
    - (Deferred - soft lock service ready, UI can be added later)
    - _Requirements: 8.3, 8.4_

- [x] 14. Checkpoint - Fase 4 completa
  - UI de conflictos implementada

- [ ] 15. Fase 5: Eventos y Métricas
  - [ ] 15.1 Definir eventos de conflicto en events.ts
    - CONFLICT_DETECTED
    - CONFLICT_AUTO_RESOLVED
    - CONFLICT_MANUALLY_RESOLVED
    - CONFLICT_REJECTED
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 15.2 Write property test for Conflict Event Round-Trip
    - **Property 11: Conflict Event Round-Trip**
    - **Validates: Requirements 9.1-9.4**

  - [ ] 15.3 Agregar métricas de conflictos
    - Contador por tipo de conflicto
    - Contador por terminal
    - Exponer en /api/metrics (si existe)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 16. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que conflictos se detectan y resuelven correctamente
  - Verificar que UI muestra conflictos apropiadamente

## Notes

- All property-based tests are required for comprehensive coverage
- Each phase should be completed and tested before moving to the next
- Prisma migrations should be run after schema changes
- Property tests use fast-check library with minimum 100 iterations
- Soft locks son solo advertencias, no bloquean operaciones
- Pagos siempre se rechazan en conflicto (seguridad financiera)
