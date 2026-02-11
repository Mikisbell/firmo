# Plan de Implementación: Realtime EventBus con Supabase

## Overview

Este plan implementa la migración del EventBus in-memory a Supabase Realtime usando PostgreSQL LISTEN/NOTIFY. La implementación se divide en tareas incrementales que construyen sobre las anteriores, con checkpoints para validación y tests para garantizar correctitud.

## Tasks

- [ ] 1. Implementar SupabaseEventBus con PostgreSQL LISTEN/NOTIFY
  - [ ] 1.1 Crear clase SupabaseEventBus con conexión a PostgreSQL
    - Implementar constructor que acepta connectionString
    - Implementar método connect() con manejo de errores
    - Configurar handler para notificaciones de PostgreSQL
    - Inicializar estructuras de datos (listeners Map)
    - _Requirements: 1.2, 1.5_
  
  - [ ]* 1.2 Escribir property test para SupabaseEventBus
    - **Property 1: Serialización Round-Trip**
    - **Validates: Requirements 2.4, 2.5**
  
  - [ ] 1.3 Implementar método publish() con pg_notify
    - Validar que client está conectado
    - Construir canal con formato `events:{tenant_id}`
    - Serializar evento a JSON
    - Ejecutar SELECT pg_notify($1, $2)
    - Manejar errores de publicación
    - _Requirements: 1.4, 2.4, 3.1_
  
  - [ ]* 1.4 Escribir property test para publish()
    - **Property 2: Aislamiento de Canal por Tenant**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  
  - [ ] 1.5 Implementar método subscribe() con LISTEN
    - Validar tenant_id
    - Construir canal con formato `events:{tenant_id}`
    - Agregar listener al Map
    - Ejecutar LISTEN si es primer listener del canal
    - Retornar función de cleanup
    - _Requirements: 1.5, 2.3, 3.2_
  
  - [ ]* 1.6 Escribir property test para subscribe()
    - **Property 4: Cleanup de Suscripción**
    - **Validates: Requirements 2.3**

- [ ] 2. Implementar manejo de notificaciones y tenant isolation
  - [ ] 2.1 Implementar handleNotification() con validación de tenant
    - Parsear payload JSON
    - Extraer tenant_id del canal
    - Validar tenant_id del evento vs canal
    - Descartar eventos cross-tenant con warning
    - Llamar listeners del canal
    - Manejar errores en listeners individuales
    - _Requirements: 3.4, 3.5_
  
  - [ ]* 2.2 Escribir property test para tenant isolation
    - **Property 3: Validación de Tenant en Eventos Recibidos**
    - **Validates: Requirements 3.4, 3.5**
  
  - [ ] 2.3 Implementar cleanup de suscripciones
    - Remover listener del Set
    - Ejecutar UNLISTEN si no quedan listeners
    - Limpiar canal del Map
    - _Requirements: 2.3_
  
  - [ ]* 2.4 Escribir unit tests para cleanup
    - Test que cleanup cancela suscripción
    - Test que UNLISTEN se ejecuta correctamente
    - _Requirements: 2.3_

- [ ] 3. Checkpoint - Validar funcionalidad básica
  - Ejecutar tests unitarios y property tests
  - Verificar que publish/subscribe funcionan correctamente
  - Verificar tenant isolation
  - Asegurar que todos los tests pasan

- [ ] 4. Implementar reconexión automática con exponential backoff
  - [ ] 4.1 Implementar scheduleReconnect() con exponential backoff
    - Calcular delay: Math.min(1000 * 2^attempts, 30000)
    - Incrementar reconnectAttempts
    - Programar timer con setTimeout
    - Llamar connect() cuando expire el timer
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 4.2 Escribir property test para exponential backoff
    - **Property 13: Exponential Backoff en Reintentos**
    - **Validates: Requirements 7.2**
  
  - [ ] 4.3 Implementar re-suscripción en reconexión
    - Iterar sobre listeners Map
    - Ejecutar LISTEN para cada canal activo
    - Resetear reconnectAttempts a 0
    - Registrar reconexión exitosa
    - _Requirements: 7.4_
  
  - [ ]* 4.4 Escribir property test para re-suscripción
    - **Property 15: Re-suscripción en Reconexión**
    - **Validates: Requirements 7.4**
  
  - [ ] 4.5 Implementar evento de reconexión
    - Emitir evento especial RECONNECTED
    - Incluir timestamp y número de intentos
    - Propagar a todos los listeners activos
    - _Requirements: 7.5_
  
  - [ ]* 4.6 Escribir unit tests para reconexión
    - Test que reconexión se intenta automáticamente
    - Test que delays siguen exponential backoff
    - Test que evento RECONNECTED se emite
    - _Requirements: 7.1, 7.2, 7.5_

- [ ] 5. Implementar EventBus factory con fallback
  - [ ] 5.1 Crear función createEventBus() con detección automática
    - Leer DATABASE_URL y DIRECT_URL de env
    - Si configurado → crear SupabaseEventBus
    - Si no configurado → crear InMemoryEventBus
    - Registrar advertencia si usa fallback
    - Iniciar conexión asíncrona
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ]* 5.2 Escribir property test para fallback
    - **Property 20: Fallback a In-Memory**
    - **Validates: Requirements 9.1**
  
  - [ ] 5.3 Crear interfaz EventBus común
    - Definir métodos publish() y subscribe()
    - Soportar retorno síncrono y asíncrono
    - Documentar interfaz con JSDoc
    - _Requirements: 1.3, 2.1, 2.2_
  
  - [ ]* 5.4 Escribir unit tests para factory
    - Test que usa SupabaseEventBus con DATABASE_URL
    - Test que usa InMemoryEventBus sin DATABASE_URL
    - Test que registra advertencia con fallback
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 6. Checkpoint - Validar factory y fallback
  - Ejecutar tests con y sin DATABASE_URL
  - Verificar que fallback funciona correctamente
  - Verificar advertencias en logs
  - Asegurar que todos los tests pasan

- [ ] 7. Integrar con SSE streaming endpoint
  - [ ] 7.1 Actualizar /api/events/stream para usar SupabaseEventBus
    - Importar eventBus desde factory
    - Mantener validación de tenant_id
    - Usar await si subscribe() es async
    - Mantener keep-alive cada 15 segundos
    - Llamar cleanup en cancel()
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [ ]* 7.2 Escribir property test para SSE streaming
    - **Property 5: Propagación de Eventos a Clientes SSE**
    - **Validates: Requirements 4.3**
  
  - [ ] 7.3 Implementar cancelación de suscripción en desconexión
    - Llamar función de cleanup en stream.cancel()
    - Limpiar timer de keep-alive
    - Registrar desconexión en logs
    - _Requirements: 4.4_
  
  - [ ]* 7.4 Escribir property test para cancelación SSE
    - **Property 6: Cancelación de Suscripción en Desconexión SSE**
    - **Validates: Requirements 4.4**

- [ ] 8. Integrar con Outbox Pattern en ingest endpoint
  - [ ] 8.1 Actualizar /api/events/ingest para usar SupabaseEventBus
    - Importar eventBus desde factory
    - Mantener guardado en event_outbox ANTES de publish
    - Usar try/catch para manejar errores de publish
    - NO fallar transacción si publish falla
    - Marcar como published si publish exitoso
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 8.2 Escribir property test para Outbox Pattern
    - **Property 7: Orden de Outbox Pattern**
    - **Validates: Requirements 5.1**
  
  - [ ]* 8.3 Escribir property test para marcado de eventos
    - **Property 8: Marcado de Eventos Publicados**
    - **Validates: Requirements 5.2**
  
  - [ ]* 8.4 Escribir property test para persistencia en fallo
    - **Property 9: Persistencia en Fallo de Publicación**
    - **Validates: Requirements 5.3**
  
  - [ ]* 8.5 Escribir property test para resiliencia
    - **Property 10: Resiliencia ante Fallo de Supabase**
    - **Validates: Requirements 5.4**

- [ ] 9. Checkpoint - Validar integración completa
  - Ejecutar tests de integración
  - Verificar flujo completo: ingest → publish → SSE
  - Verificar Outbox Pattern funciona correctamente
  - Asegurar que todos los tests pasan

- [ ] 10. Implementar logging y observabilidad
  - [ ] 10.1 Agregar logging estructurado en SupabaseEventBus
    - Registrar conexiones exitosas con INFO
    - Registrar errores de conexión con ERROR
    - Registrar errores de publicación con ERROR
    - Registrar eventos cross-tenant con WARN
    - Incluir contexto (tenant_id, event_id, attempts)
    - _Requirements: 7.3, 12.4_
  
  - [ ]* 10.2 Escribir property test para logging
    - **Property 14: Logging de Errores de Conexión**
    - **Validates: Requirements 7.3**
  
  - [ ] 10.3 Agregar métricas de observabilidad
    - Registrar eventos publicados/recibidos por tenant
    - Registrar latencia de publicación (p50, p95, p99)
    - Registrar conexiones SSE activas por tenant
    - Registrar errores de conexión
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [ ] 10.4 Actualizar endpoint /api/health con estado de EventBus
    - Agregar campo eventBus al health check
    - Incluir estado de conexión (connected/disconnected)
    - Incluir número de canales activos
    - Incluir timestamp de última conexión
    - _Requirements: 12.5_

- [ ] 11. Implementar tests E2E para flujo Mesero → KDS
  - [ ]* 11.1 Escribir E2E test para single waiter
    - Test que orden de mesero llega a KDS vía SSE
    - Verificar que evento se propaga en <5 segundos
    - Verificar que KDS muestra orden correctamente
    - _Requirements: 10.4_
  
  - [ ]* 11.2 Escribir E2E test para multiple waiters
    - Test que órdenes de 2 meseros llegan a KDS
    - Verificar que ambas órdenes son visibles
    - Verificar que no hay cross-contamination
    - _Requirements: 10.5_
  
  - [ ]* 11.3 Escribir E2E test para reconexión
    - Simular desconexión de PostgreSQL
    - Verificar que sistema reconecta automáticamente
    - Verificar que eventos se propagan después de reconexión
    - _Requirements: 7.1, 7.4_

- [ ] 12. Checkpoint - Validar tests E2E
  - Ejecutar todos los tests E2E con Playwright
  - Verificar que test "multiple waiters" pasa
  - Verificar que no hay regresiones
  - Asegurar que todos los tests pasan

- [ ] 13. Implementar stress tests para performance
  - [ ]* 13.1 Escribir stress test para throughput
    - **Property 18: Throughput por Tenant**
    - Test que sistema soporta 100 eventos/seg
    - Verificar que latencia se mantiene <500ms
    - _Requirements: 8.2_
  
  - [ ]* 13.2 Escribir stress test para conexiones concurrentes
    - **Property 19: Conexiones SSE Concurrentes**
    - Test que sistema soporta 50 conexiones SSE
    - Verificar que todos reciben eventos
    - _Requirements: 8.3_
  
  - [ ]* 13.3 Escribir stress test para latencia
    - **Property 17: Latencia de Propagación**
    - Test que eventos se propagan en <500ms (p95)
    - Medir latencia end-to-end
    - _Requirements: 8.1_

- [ ] 14. Crear documentación de migración
  - [ ] 14.1 Crear guía de migración paso a paso
    - Documentar verificación de DATABASE_URL
    - Documentar proceso de despliegue
    - Documentar verificación post-despliegue
    - Documentar plan de rollback
    - _Requirements: 11.3, 11.4, 11.5_
  
  - [ ] 14.2 Crear scripts de verificación
    - Script para verificar conexión a PostgreSQL
    - Script para verificar LISTEN/NOTIFY funciona
    - Script para verificar propagación de eventos
    - _Requirements: 11.4_
  
  - [ ] 14.3 Actualizar documentación de arquitectura
    - Actualizar diagrama de arquitectura
    - Documentar flujo de eventos con Supabase
    - Documentar estrategia de fallback
    - _Requirements: 11.3_

- [ ] 15. Checkpoint final - Validación completa
  - Ejecutar TODOS los tests (unit, property, integration, E2E, stress)
  - Verificar que no hay regresiones
  - Verificar que documentación está completa
  - Verificar que sistema está listo para despliegue

## Notes

- Tasks marcadas con `*` son opcionales y pueden omitirse para MVP más rápido
- Cada task referencia requirements específicos para trazabilidad
- Checkpoints aseguran validación incremental
- Property tests validan correctitud universal
- Unit tests validan ejemplos específicos y edge cases
- E2E tests validan flujo completo end-to-end
- Stress tests validan performance bajo carga
