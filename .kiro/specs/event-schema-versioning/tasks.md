# Implementation Plan: Event Schema Versioning

## Overview

Este plan implementa versionado de schemas para eventos en 3 fases: Registry, Migrator y Integration. El objetivo es permitir evolución de schemas sin romper compatibilidad con eventos históricos.

## Tasks

- [x] 1. Fase 1: Event Version Registry
  - [x] 1.1 Crear archivo de versiones de eventos
    - src/core/domain/event-versions.ts
    - Definir EVENT_VERSIONS con versión actual de cada tipo
    - Función getCurrentVersion(eventType)
    - _Requirements: 3.3, 4.5_

  - [x] 1.2 Actualizar BaseEnvelopeSchema
    - Agregar payload_version con default 1
    - Asegurar schema_version ya existe
    - _Requirements: 1.1_

- [x] 2. Checkpoint - Fase 1 completa
  - Verificar que EVENT_VERSIONS tiene todos los tipos de eventos

- [x] 3. Fase 2: Event Migrator
  - [x] 3.1 Crear servicio EventMigrator
    - src/core/domain/event-migrator.ts
    - Clase EventMigrator con registry de migraciones
    - Método migrate(event) que retorna evento migrado
    - Método needsMigration(event) para check rápido
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Implementar migraciones para ORDER_CREATED
    - src/core/domain/migrations/order-migrations.ts
    - V1→V2: agregar campos de delivery con defaults
    - Registrar en EventMigrator
    - _Requirements: 2.3, 4.1_

  - [x] 3.3 Implementar migraciones para ORDER_ITEM_ADDED
    - V1→V2: agregar timestamps a line items
    - Registrar en EventMigrator
    - _Requirements: 2.3, 4.1_

  - [x] 3.4 Write property test for Migration Idempotence
    - **Property 1: Migration Idempotence**
    - **Validates: Requirements 2.1, 2.4**

  - [x] 3.5 Write property test for Migration Correctness
    - **Property 2: Migration Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 3.6 Write property test for Backward Compatibility
    - **Property 4: Backward Compatibility**
    - **Validates: Requirements 3.1**

- [x] 4. Checkpoint - Fase 2 completa
  - EventMigrator implementado y testeado

- [x] 5. Fase 3: Integration
  - [x] 5.1 Integrar migrator en reducers
    - Modificar sale.reducer.ts para migrar eventos antes de procesar
    - Modificar shift.reducer.ts si aplica
    - _Requirements: 2.1, 3.1_

  - [x] 5.2 Integrar migrator en API ingest
    - Migrar eventos al recibirlos (opcional, para normalización)
    - Preservar payload_version original en storage
    - _Requirements: 1.3, 2.4_

  - [x] 5.3 Write property test for Schema Validation After Migration
    - **Property 5: Schema Validation After Migration**
    - **Validates: Requirements 5.3**

  - [x] 5.4 Write property test for Migration Performance
    - **Property 6: Migration Performance**
    - **Validates: Requirements 6.3**

- [x] 6. Checkpoint - Fase 3 completa
  - Integración completa, todos los tests pasan

- [x] 7. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que eventos v1 se migran correctamente
  - Verificar que reducers procesan eventos migrados

## Notes

- El campo payload_version ya existe como schema_version en BaseEnvelopeSchema
- Las migraciones son lazy (se aplican al procesar, no al almacenar)
- Los eventos originales nunca se modifican en storage
- Property tests usan fast-check con mínimo 100 iteraciones
- Migraciones deben ser < 1ms por evento
