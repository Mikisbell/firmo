# Implementation Plan: Enterprise Upgrade

## Overview

Este plan implementa los gaps críticos identificados en AUDITORIA_CRITICA.md y GAPS.md. NO duplica funcionalidad ya implementada (circuit breaker, rate limiting, outbox, etc.).

**Archivos clave a modificar:**
- `src/core/sync/client.ts` - Eliminar hardcodes (líneas 91 y 175)
- `src/core/projections/sale.reducer.ts` - Refactorizar para inmutabilidad
- `src/app/api/events/ingest/route.ts` - Agregar Clock Skew handling
- `src/app/api/auth/register-terminal/route.ts` - Integrar Device Token
- `prisma/schema.prisma` - Agregar nuevos modelos

**Orden de prioridad (alineado con P1 de MASTER.md):**
1. Clock Skew (crítico para ordenamiento de eventos)
2. Eliminar hardcodes (seguridad - tenant_id y API secret)
3. Reducer inmutable (bugs de React, Problema #5 AUDITORIA_CRITICA.md)
4. Conflict resolution (multi-terminal, Gap #9 GAPS.md)
5. Snapshots (performance, Mejora #8 MEJORAS.md)
6. Schema versioning (evolución, Mejora #2 MEJORAS.md)
7. Observabilidad (operaciones, OBSERVABILIDAD.md)
8. UI features (KDS notificaciones, Dashboard admin)

## Tasks

- [ ] 1. Setup de infraestructura
  - [ ] 1.1 Agregar fast-check como dependencia de desarrollo
    - Ejecutar `npm install -D fast-check`
    - _Requirements: Testing Strategy_
  - [ ] 1.2 Crear migración Prisma para nuevos campos y tablas
    - Agregar DeviceToken, Snapshot, SystemMetric a schema.prisma
    - Agregar campos occurred_at_server, schema_version, clock_drift_ms a Event
    - Agregar campo revision a Order
    - Ejecutar `npx prisma migrate dev --name enterprise_upgrade`
    - _Requirements: Data Models_

- [ ] 2. Implementar Clock Skew Handler (CRÍTICO)
  - [ ] 2.1 Modificar ingest API para asignar timestamp del servidor
    - Modificar `src/app/api/events/ingest/route.ts`
    - Agregar `occurred_at_server` a cada evento
    - Preservar `occurred_at_client` original
    - Calcular y registrar `clock_drift_ms`
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 2.2 Agregar logging de warnings para drift > 5 min
    - Log warning con terminal_id y drift
    - _Requirements: 1.4_
  - [ ] 2.3 Write property test for Clock Skew bounded
    - **Property 1: Clock Skew Bounded**
    - **Validates: Requirements 1.1, 1.4**

- [ ] 3. Checkpoint - Clock Skew implementado
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Eliminar hardcodes de seguridad
  - [ ] 4.1 Crear módulo de Device Token
    - Crear `src/core/auth/device-token.ts`
    - Implementar generateDeviceToken() usando fingerprint.ts existente
    - Implementar validateDeviceToken()
    - _Requirements: 2.1, 2.5_
  - [ ] 4.2 Write property test for Device Token uniqueness
    - **Property 2: Device Token Uniqueness**
    - **Validates: Requirements 2.1**
  - [ ] 4.3 Integrar Device Token en registro de terminal
    - Modificar `src/app/api/auth/register-terminal/route.ts`
    - Generar y almacenar Device Token al registrar
    - _Requirements: 2.6_
  - [ ] 4.4 Actualizar ingest API para validar Device Token
    - Modificar `src/app/api/events/ingest/route.ts`
    - Reemplazar validación de `x-api-secret` (línea donde se valida el header)
    - _Requirements: 2.2, 2.3, 2.4_
  - [ ] 4.5 Eliminar tenant_id hardcodeado de SyncClient
    - Modificar `src/core/sync/client.ts`
    - **LÍNEA 91:** Eliminar `const tenantId = "00000000-0000-0000-0000-000000000001"`
    - Obtener tenant_id de TerminalConfig en IndexedDB
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 4.6 Eliminar API secret hardcodeado de SyncClient
    - Modificar `src/core/sync/client.ts`
    - **LÍNEA 175:** Eliminar `"x-api-secret": "park_secret_mvp_2025"`
    - Usar Device Token en su lugar
    - _Requirements: 2.2_
  - [ ] 4.7 Actualizar AuthContext con tenant_id dinámico
    - Modificar `src/components/auth/AuthProvider.tsx`
    - Exponer tenant_id, terminal_id, role via Context
    - _Requirements: 3.4, 3.5_

- [ ] 5. Checkpoint - Seguridad mejorada
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Refactorizar Reducer para inmutabilidad
  - [ ] 6.1 Refactorizar sale.reducer.ts con spread operators
    - Modificar `src/core/projections/sale.reducer.ts`
    - Reemplazar `sale.lines[line_id] = {...}` con spread
    - Reemplazar `sale.subtotal_cents = ...` con nuevo objeto
    - Agregar Object.freeze() en modo desarrollo
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ] 6.2 Write property test for Reducer immutability
    - **Property 3: Reducer Immutability**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [ ] 6.3 Refactorizar shift.reducer.ts con mismo patrón
    - Aplicar mismo patrón de inmutabilidad
    - _Requirements: 4.5_
  - [ ] 6.4 Write property test for State serialization round-trip
    - **Property 4: State Serialization Round-Trip**
    - **Validates: Requirements 4.6**

- [ ] 7. Checkpoint - Reducers inmutables
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implementar Conflict Resolution
  - [ ] 8.1 Agregar campo revision a modelo Order
    - Ya incluido en migración de tarea 1.2
    - Actualizar proyección para incrementar revision
    - _Requirements: 5.1_
  - [ ] 8.2 Crear módulo de detección de conflictos
    - Crear `src/core/conflicts/resolver.ts`
    - Implementar detectConflict()
    - Implementar mergeStates()
    - _Requirements: 5.2, 5.3, 5.4_
  - [ ] 8.3 Write property test for Optimistic Lock detection
    - **Property 5: Optimistic Lock Detection**
    - **Validates: Requirements 5.2, 5.3**
  - [ ] 8.4 Write property test for Merge preserves items
    - **Property 6: Merge Preserves Items**
    - **Validates: Requirements 5.5**
  - [ ] 8.5 Crear UI de resolución de conflictos
    - Crear `src/components/conflicts/ConflictResolver.tsx`
    - Mostrar ambas versiones lado a lado
    - Opciones: Usar local, Usar servidor, Combinar
    - _Requirements: 5.5_
  - [ ] 8.6 Integrar detección de conflictos en ingest
    - Modificar `src/app/api/events/ingest/route.ts`
    - Retornar 409 con ConflictInfo cuando se detecta conflicto
    - _Requirements: 5.3, 5.4_
  - [ ] 8.7 Generar evento CONFLICT_RESOLVED
    - Crear tipo de evento para auditoría
    - _Requirements: 5.6_

- [ ] 9. Checkpoint - Conflict Resolution
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implementar Snapshots Adaptativos
  - [ ] 10.1 Crear servicio de snapshots
    - Crear `src/core/snapshots/adaptive.ts`
    - Implementar shouldCreateSnapshot() con thresholds: 50KB, 500 eventos
    - Implementar createSnapshot()
    - Implementar rebuildFromSnapshot()
    - _Requirements: 6.1, 6.2_
  - [ ] 10.2 Write property test for Snapshot rebuild equivalence
    - **Property 7: Snapshot Rebuild Equivalence**
    - **Validates: Requirements 6.3**
  - [ ] 10.3 Integrar snapshots en proyecciones
    - Modificar rebuild para usar snapshots
    - Crear snapshot automático al cerrar orden
    - _Requirements: 6.3, 6.4_
  - [ ] 10.4 Extender cleanup worker para snapshots
    - Modificar `src/core/db/cleanup.ts`
    - Eliminar eventos > 30 días de órdenes cerradas
    - Preservar snapshots por 90 días
    - _Requirements: 6.5, 6.6_

- [ ] 11. Implementar Event Schema Versioning
  - [ ] 11.1 Crear sistema de migraciones de eventos
    - Crear `src/core/events/versioning.ts`
    - Implementar migrateEvent() con migraciones incrementales
    - Versión inicial: agregar occurred_at_server
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ] 11.2 Write property test for Migration idempotence
    - **Property 8: Event Migration Idempotence**
    - **Validates: Requirements 7.5**
  - [ ] 11.3 Integrar migraciones en procesamiento de eventos
    - Modificar ingest para migrar eventos antes de procesar
    - Preservar _original_payload
    - _Requirements: 7.4_

- [ ] 12. Checkpoint - Snapshots y Versioning
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implementar Observabilidad
  - [ ] 13.1 Crear sistema de métricas
    - Crear `src/core/metrics/system-metrics.ts`
    - Trackear: sync_latency_p95, sync_errors_count, backlog_size, active_terminals
    - Almacenar en tabla system_metrics
    - _Requirements: 8.1, 8.2_
  - [ ] 13.2 Crear endpoint /api/health
    - Crear `src/app/api/health/route.ts`
    - Retornar status de DB, sync y terminales
    - _Requirements: 8.5_
  - [ ] 13.3 Agregar contexto a errores existentes
    - Agregar terminal_id y order_id a logs de error
    - _Requirements: 8.6_

- [ ] 14. Implementar Notificaciones KDS
  - [ ] 14.1 Crear sistema de notificaciones de audio
    - Crear `src/core/notifications/audio.ts`
    - Usar Web Audio API para sonidos
    - _Requirements: 9.1, 9.3_
  - [ ] 14.2 Implementar alertas visuales para pedidos atrasados
    - Modificar `src/app/cocina/page.tsx`
    - Mostrar alerta parpadeante para pedidos > 10 min
    - _Requirements: 9.2_
  - [ ] 14.3 Agregar configuración de sonido por terminal
    - Crear UI de configuración de volumen y tipo de sonido
    - _Requirements: 9.4_
  - [ ] 14.4 Mostrar contador de pedidos en título de pestaña
    - Actualizar document.title con contador
    - _Requirements: 9.5_

- [ ] 15. Implementar Dashboard Admin
  - [ ] 15.1 Crear página de dashboard admin
    - Crear `src/app/admin/dashboard/page.tsx`
    - Mostrar ventas del día (centavos), ticket promedio, pedidos por hora
    - _Requirements: 10.1_
  - [ ] 15.2 Mostrar estado de terminales
    - Agregar sección con online/offline, último sync, backlog
    - _Requirements: 10.2_
  - [ ] 15.3 Implementar actualización en tiempo real via SSE
    - Crear `src/app/api/admin/metrics/stream/route.ts`
    - Conectar dashboard a SSE existente
    - _Requirements: 10.3_
  - [ ] 15.4 Hacer dashboard responsive
    - Usar Tailwind para layout responsive
    - _Requirements: 10.4_
  - [ ] 15.5 Agregar detalle de eventos por terminal
    - Mostrar últimos 10 eventos al hacer click en terminal
    - _Requirements: 10.5_
  - [ ] 15.6 Implementar alertas de backlog
    - Mostrar alerta cuando backlog_size > 500 por > 5 min
    - _Requirements: 8.4_

- [ ] 16. Checkpoint final - Sistema enterprise completo
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que todas las 8 propiedades de correctitud pasan
  - Revisar métricas de performance

## Notes

- All tasks including property tests are required
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- 8 property tests (reducido de 16 para enfocarse en propiedades críticas)
- NO se duplica funcionalidad existente (circuit breaker, rate limiting, outbox, etc.)
- El orden prioriza seguridad y correctitud antes de features de UI

## Inconsistencias Detectadas en Documentación (para resolver)

| Inconsistencia | Ubicación | Valor Actual | Valor Correcto |
|----------------|-----------|--------------|----------------|
| tenant_id hardcodeado | `client.ts:91` | `00000000-0000-0000-0000-000000000001` | Obtener de IndexedDB |
| API secret hardcodeado | `client.ts:175` | `park_secret_mvp_2025` | Usar Device Token |
| KDS estaciones | MASTER.md vs FLUJO_KDS.md | 3 vs 5 estaciones | Unificar a 3: Horno/Parrilla, Cocina, Bar |
| tenant_id canónico | Varios archivos | Inconsistente | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

## Alineación con MASTER.md

Este spec implementa los items P1 pendientes:
- [ ] **Conflict Resolution** → Tareas 8.x
- [ ] **Event Schema Versioning** → Tareas 11.x
- [ ] **Snapshots/Compaction** → Tareas 10.x
- [ ] **Observabilidad** → Tareas 13.x
- [ ] **Role-based event validation** → Incluido en Device Token (tarea 4.4)
