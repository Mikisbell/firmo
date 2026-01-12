# Implementation Plan: Terminal Architecture v2

## Overview

Este plan implementa la arquitectura mejorada de terminales en fases incrementales, comenzando con el fingerprinting mejorado y progresando hacia el sistema completo de device binding y autenticación adaptativa.

**Lenguaje**: TypeScript (Next.js 15 + Prisma)
**Testing**: Vitest + fast-check para property-based tests

## Tasks

- [x] 1. Database Schema y Migraciones ✅ VERIFICADO
  - [x] 1.1 Crear migración Prisma para nuevas tablas
    - Añadir modelos: TerminalDevice, ActivationCode, AuthEvent, SecurityAlert
    - Crear índices para queries frecuentes
    - _Requirements: 2.1, 3.1, 6.1_

  - [x] 1.2 Crear seed data para desarrollo
    - Terminales de prueba con diferentes estados
    - Códigos de activación de ejemplo
    - _Requirements: 2.1_
    - ✅ 9 terminal devices, 2 activation codes, 5 auth events, 2 security alerts

- [x] 2. Enhanced Fingerprint Generator
  - [x] 2.1 Implementar fingerprint-v2.ts con 12+ señales
    - Canvas 2D fingerprint
    - WebGL fingerprint y vendor
    - Audio context fingerprint
    - Font detection
    - Hardware signals (cores, memory, touch)
    - _Requirements: 1.1_

  - [x] 2.2 Write property test for fingerprint signal completeness ✅
    - **Property 1: Fingerprint Signal Completeness**
    - **Validates: Requirements 1.1**
    - ✅ 4 property tests (14 keys, required keys, threshold, low count)

  - [x] 2.3 Implementar calculateSimilarity function ✅
    - Comparación por similitud (0-100)
    - Manejo de fingerprints parciales
    - _Requirements: 1.3, 1.5_

  - [x] 2.4 Write property test for similarity scoring ✅
    - **Property 3: Fingerprint Similarity Scoring**
    - **Validates: Requirements 1.3, 1.5**
    - ✅ 6 property tests (identical, symmetric, bounded, drift, different, partial)

  - [x] 2.5 Implementar hashWithSalt function ✅
    - SHA-256 con salt por tenant
    - _Requirements: 1.2_

  - [x] 2.6 Write property test for hash determinism ✅
    - **Property 2: Fingerprint Hash Determinism with Salt**
    - **Validates: Requirements 1.2**
    - ✅ 5 property tests (format, uniqueness, determinism, hash present, timestamp)

- [x] 3. Checkpoint - Fingerprint Module Complete ✅
  - ✅ 17 property tests passing
  - ✅ fingerprint-v2.ts con 14 señales implementado
  - ✅ calculateSimilarity, getDriftScore, hashWithSalt funcionando

- [x] 4. Terminal Registry Service
  - [x] 4.1 Crear terminal-registry.ts con operaciones CRUD ✅
    - createTerminal, getTerminal, listTerminals
    - disableTerminal, updateTerminal
    - _Requirements: 3.1_

  - [x] 4.2 Implementar generación de códigos de activación ✅
    - Código de 6 dígitos
    - Expiración en 15 minutos
    - Formato XXX-XXX para display
    - _Requirements: 2.1, 2.6_

  - [x] 4.3 Write property test for activation code format ✅
    - **Property 4: Activation Code Format and Expiry**
    - **Validates: Requirements 2.1**
    - ✅ 6 property tests (6 digits, numeric, format, parse, collision, edge cases)

  - [x] 4.4 Implementar activateDevice function ✅
    - Validar código no expirado
    - Bind fingerprint a terminal
    - Marcar código como usado
    - _Requirements: 2.2, 2.3_

  - [x] 4.5 Write property test for device binding exclusivity ✅
    - **Property 5: Device Binding Exclusivity**
    - **Validates: Requirements 2.2, 2.4**
    - ✅ 3 property tests (hash determinism, salt uniqueness, terminal IDs)

  - [x] 4.6 Write property test for code expiry enforcement ✅
    - **Property 6: Activation Code Expiry Enforcement**
    - **Validates: Requirements 2.3**
    - ✅ 4 property tests (15 min expiry, valid before, invalid after, boundary)

- [x] 5. Server-Side Validation API
  - [x] 5.1 Crear API route /api/terminals/validate ✅
    - Validar terminal existe y está activo
    - Verificar fingerprint con tolerancia de drift
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.2 Write property test for server terminal validation ✅
    - **Property 7: Server Terminal Validation**
    - **Validates: Requirements 3.1, 3.3**
    - ✅ 5 property tests (non-existent, active, disabled, pending, no fingerprint)

  - [x] 5.3 Write property test for fingerprint verification with drift ✅
    - **Property 8: Server Fingerprint Verification with Drift**
    - **Validates: Requirements 3.2, 3.4**
    - ✅ 6 property tests (exact match, different hash, low similarity, high similarity, drift score, boundary)

  - [x] 5.4 Crear API route /api/terminals/activate ✅
    - Endpoint para activar dispositivo con código
    - _Requirements: 2.2_

- [x] 6. Checkpoint - Terminal Registry Complete ✅
  - ✅ 57 property tests passing (auth module)
  - ✅ Terminal Registry Service implementado
  - ✅ APIs de validación y activación creadas

- [ ] 7. Risk-Based Auth Validator
  - [ ] 7.1 Implementar risk-validator.ts
    - calculateRiskScore function
    - determineAuthRequirement function
    - _Requirements: 4.4, 4.5_

  - [ ] 7.2 Write property test for risk-based auth requirements
    - **Property 9: Risk-Based Authentication Requirements**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ] 7.3 Write property test for risk score calculation
    - **Property 10: Risk Score Calculation Completeness**
    - **Validates: Requirements 4.4, 4.5**

- [ ] 8. Session Manager v2
  - [ ] 8.1 Implementar session-v2.ts
    - createSession con fingerprint y risk score
    - validateSession con checks periódicos
    - updateActivity y auto-logout
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 8.2 Write property test for session activity and timeout
    - **Property 11: Session Activity Tracking and Timeout**
    - **Validates: Requirements 5.2, 5.3**

  - [ ] 8.3 Implementar periodic fingerprint validation
    - Check cada 5 minutos
    - Invalidar sesión si fingerprint cambia
    - _Requirements: 5.4, 5.5_

  - [ ] 8.4 Write property test for periodic fingerprint validation
    - **Property 12: Periodic Session Fingerprint Validation**
    - **Validates: Requirements 5.4, 5.5**

  - [ ] 8.5 Implementar single session per employee
    - Invalidar sesiones anteriores al crear nueva
    - _Requirements: 5.6_

  - [ ] 8.6 Write property test for single session enforcement
    - **Property 13: Single Session Per Employee**
    - **Validates: Requirements 5.6**

- [ ] 9. Checkpoint - Auth System Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Audit Logger
  - [ ] 10.1 Implementar audit-logger.ts
    - logAuthEvent function
    - createSecurityAlert function
    - queryEvents y queryAlerts
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 10.2 Write property test for audit log completeness
    - **Property 14: Audit Log Completeness**
    - **Validates: Requirements 6.1, 6.2**

  - [ ] 10.3 Crear API routes para audit queries
    - GET /api/admin/audit/events
    - GET /api/admin/audit/alerts
    - _Requirements: 6.4_

- [ ] 11. Offline Auth Cache
  - [ ] 11.1 Implementar offline-cache.ts
    - cacheCredentials function
    - validateOffline function
    - verifyIntegrity con HMAC
    - _Requirements: 8.1, 8.2, 8.5_

  - [ ] 11.2 Write property test for offline credential caching
    - **Property 16: Offline Credential Caching**
    - **Validates: Requirements 8.1, 8.2**

  - [ ] 11.3 Implementar sync de eventos offline
    - getPendingEvents y syncPendingEvents
    - Expiración de cache a 24 horas
    - _Requirements: 8.3, 8.4_

  - [ ] 11.4 Write property test for offline sync and expiry
    - **Property 17: Offline Cache Expiry and Sync**
    - **Validates: Requirements 8.3, 8.4**

  - [ ] 11.5 Write property test for tamper detection
    - **Property 18: Cache Tamper Detection**
    - **Validates: Requirements 8.5**

- [ ] 12. Checkpoint - Backend Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. UI Updates - Terminal Setup
  - [ ] 13.1 Actualizar TerminalSetup.tsx para usar nuevo sistema
    - Integrar fingerprint-v2
    - Mostrar pantalla de activación si no hay binding
    - _Requirements: 7.1_

  - [ ] 13.2 Crear ActivationCodeInput component
    - Input para código XXX-XXX
    - Validación en tiempo real
    - _Requirements: 2.6_

  - [ ] 13.3 Actualizar navegación post-setup
    - Usar hard navigation (window.location)
    - Routing correcto por rol
    - _Requirements: 7.2, 7.4_

  - [ ] 13.4 Write property test for navigation route correctness
    - **Property 15: Navigation Route Correctness**
    - **Validates: Requirements 7.2**

- [ ] 14. UI Updates - Auth Provider
  - [ ] 14.1 Actualizar AuthProvider.tsx para usar session-v2
    - Integrar risk-based auth
    - Mostrar Step_Up_Auth cuando requerido
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 14.2 Crear StepUpAuthModal component
    - Modal para confirmación de manager
    - _Requirements: 4.2_

  - [ ] 14.3 Actualizar LoginScreen.tsx
    - Mostrar risk level al usuario
    - Integrar con nuevo session manager
    - _Requirements: 4.1_

- [ ] 15. Admin Panel - Terminal Management
  - [ ] 15.1 Crear página /admin/terminales
    - Lista de terminales con estado
    - Botón para crear nuevo terminal
    - _Requirements: 3.1_

  - [ ] 15.2 Crear TerminalCreateModal
    - Form para crear terminal
    - Mostrar código de activación generado
    - _Requirements: 2.1, 2.6_

  - [ ] 15.3 Crear TerminalDetailPanel
    - Ver detalles de terminal
    - Opciones: regenerar código, deshabilitar
    - _Requirements: 2.1, 3.3_

- [ ] 16. Admin Panel - Audit Logs
  - [ ] 16.1 Crear página /admin/auditoria
    - Lista de eventos con filtros
    - Filtros: fecha, terminal, empleado, tipo
    - _Requirements: 6.4_

  - [ ] 16.2 Crear SecurityAlertsPanel
    - Lista de alertas activas
    - Opción para acknowledge
    - _Requirements: 6.3_

- [ ] 17. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar flujo completo: crear terminal → activar → login → usar

## Notes

- All tasks including tests are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- El sistema actual seguirá funcionando durante la migración (backward compatible)
