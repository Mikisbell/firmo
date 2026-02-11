# Plan de Implementación: Realtime EventBus con Supabase

## Overview

Este plan implementa la migración del EventBus in-memory a Supabase Realtime usando PostgreSQL LISTEN/NOTIFY. La implementación resuelve el problema crítico donde eventos publicados en una instancia de Next.js no llegan a clientes SSE conectados a otra instancia.

**Problema a resolver:** En Next.js development mode (y producción con múltiples instancias), cada request HTTP puede ser manejado por una instancia diferente del servidor. El EventBus in-memory actual NO comparte eventos entre instancias, causando que el sistema de tiempo real falle completamente.

**Solución:** Usar PostgreSQL LISTEN/NOTIFY a través de Supabase como intermediario compartido, permitiendo que TODAS las instancias se conecten a la MISMA base de datos y compartan eventos en tiempo real.

**Cobertura de testing:**
- 22 correctness properties (property-based tests)
- Unit tests para casos específicos y edge cases
- Integration tests para validar integración con PostgreSQL
- E2E tests para validar flujo completo Mesero → KDS
- Stress tests para validar performance bajo carga

## Tasks

- [x] 1. Implementar SupabaseEventBus con PostgreSQL LISTEN/NOTIFY
  - [x] 1.1 Crear clase SupabaseEventBus con conexión a PostgreSQL
    - Implementar constructor que acepta connectionString
    - Implementar método connect() con manejo de errores
    - Configurar handler para notificaciones de PostgreSQL
    - Inicializar estructuras de datos (listeners Map, ConnectionState)
    - Implementar método disconnect() para cleanup
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [ ]* 1.2 Escribir property test para serialización round-trip
    - **Property 1: Serialización Round-Trip**
    - Para cualquier evento ParkEvent válido, serializar a JSON y deserializar debe producir objeto equivalente
    - **Validates: Requirements 2.4, 2.5**
  
  - [x] 1.3 Implementar método publish() con pg_notify
    - Validar que client está conectado (lanzar error si no)
    - Construir canal con formato `events:{tenant_id}`
    - Serializar evento a JSON usando JSON.stringify()
    - Ejecutar SELECT pg_notify($1, $2) con canal y payload
    - Manejar errores de publicación (log + throw)
    - _Requirements: 1.4, 2.1, 2.4, 3.1_
  
  - [ ]* 1.4 Escribir property test para aislamiento de canal
    - **Property 2: Aislamiento de Canal por Tenant**
    - Para cualquier tenant_id, el canal debe seguir formato `events:{tenant_id}` y solo recibir eventos de ese tenant
    - **Validates: Requirements 3.1, 3.2, 3.3**
  
  - [x] 1.5 Implementar método subscribe() con LISTEN
    - Validar tenant_id (no vacío, formato UUID)
    - Construir canal con formato `events:{tenant_id}`
    - Agregar listener al Map (crear Set si no existe)
    - Ejecutar LISTEN si es primer listener del canal
    - Retornar función de cleanup async
    - _Requirements: 1.5, 2.2, 2.3, 3.2_
  
  - [ ]* 1.6 Escribir property test para cleanup de suscripción
    - **Property 4: Cleanup de Suscripción**
    - Para cualquier suscripción, al llamar cleanup, la suscripción debe cancelarse y no recibir más eventos
    - **Validates: Requirements 2.3**
  
  - [ ]* 1.7 Escribir unit tests para SupabaseEventBus básico
    - Test que constructor inicializa correctamente
    - Test que connect() establece conexión
    - Test que disconnect() limpia recursos
    - Test que publish() lanza error si no conectado
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implementar manejo de notificaciones y tenant isolation
  - [x] 2.1 Implementar handleNotification() con validación de tenant
    - Parsear payload JSON con try/catch
    - Extraer tenant_id del canal (formato `events:{tenant_id}`)
    - Extraer tenant_id del evento parseado
    - Validar que ambos tenant_ids coinciden
    - Si NO coinciden → descartar evento + log WARNING
    - Si coinciden → llamar todos los listeners del canal
    - Manejar errores en listeners individuales (no propagar)
    - _Requirements: 2.5, 3.4, 3.5_
  
  - [ ]* 2.2 Escribir property test para validación de tenant
    - **Property 3: Validación de Tenant en Eventos Recibidos**
    - Para cualquier evento con tenant_id diferente al canal, debe descartarse y registrar advertencia
    - **Validates: Requirements 3.4, 3.5**
  
  - [x] 2.3 Implementar cleanup de suscripciones en función retornada
    - Remover listener del Set del canal
    - Si Set queda vacío → ejecutar UNLISTEN
    - Si Set queda vacío → eliminar canal del Map
    - Manejar errores de UNLISTEN (log pero no throw)
    - _Requirements: 2.3_
  
  - [ ]* 2.4 Escribir unit tests para handleNotification
    - Test que eventos válidos llaman listeners
    - Test que eventos cross-tenant se descartan
    - Test que JSON inválido se maneja correctamente
    - Test que errores en listeners no afectan otros listeners
    - _Requirements: 2.5, 3.4, 3.5_
  
  - [ ]* 2.5 Escribir unit tests para cleanup
    - Test que cleanup cancela suscripción correctamente
    - Test que UNLISTEN se ejecuta cuando no quedan listeners
    - Test que canal se elimina del Map cuando vacío
    - _Requirements: 2.3_

- [x] 3. Checkpoint - Validar funcionalidad básica
  - Ejecutar tests unitarios: `npm test src/core/infra/__tests__/event-bus.test.ts`
  - Ejecutar property tests: `npm test src/core/infra/__tests__/event-bus.property.test.ts`
  - Verificar que publish/subscribe funcionan correctamente
  - Verificar que tenant isolation funciona (eventos cross-tenant se descartan)
  - Verificar que cleanup de suscripciones funciona
  - Asegurar que TODOS los tests pasan antes de continuar

- [x] 4. Implementar reconexión automática con exponential backoff
  - [x] 4.1 Implementar scheduleReconnect() con exponential backoff
    - Calcular delay: Math.min(1000 * Math.pow(2, attempts), 30000)
    - Incrementar reconnectAttempts counter
    - Programar timer con setTimeout
    - Llamar connect() cuando expire el timer
    - Limpiar timer en disconnect()
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 4.2 Escribir property test para exponential backoff
    - **Property 13: Exponential Backoff en Reintentos**
    - Para cualquier secuencia de reintentos, delays deben seguir 1s, 2s, 4s, 8s, 16s, hasta max 30s
    - **Validates: Requirements 7.2**
  
  - [ ]* 4.3 Escribir property test para reconexión automática
    - **Property 12: Reconexión Automática**
    - Para cualquier fallo de conexión, el sistema debe intentar reconectar automáticamente
    - **Validates: Requirements 7.1**
  
  - [x] 4.4 Implementar re-suscripción en reconexión exitosa
    - Iterar sobre listeners Map al conectar
    - Ejecutar LISTEN para cada canal activo
    - Resetear reconnectAttempts a 0 en conexión exitosa
    - Registrar reconexión exitosa con INFO
    - Actualizar lastConnectedAt timestamp
    - _Requirements: 7.4_
  
  - [ ]* 4.5 Escribir property test para re-suscripción
    - **Property 15: Re-suscripción en Reconexión**
    - Para cualquier reconexión exitosa, el sistema debe re-suscribirse a todos los canales activos
    - **Validates: Requirements 7.4**
  
  - [x] 4.6 Implementar evento de reconexión RECONNECTED
    - Crear evento especial con type: 'RECONNECTED'
    - Incluir timestamp, reconnectAttempts, y canales activos
    - Propagar a todos los listeners activos
    - Permitir que clientes actualicen su estado
    - _Requirements: 7.5_
  
  - [ ]* 4.7 Escribir property test para evento de reconexión
    - **Property 16: Evento de Reconexión**
    - Para cualquier reconexión exitosa, debe emitirse evento RECONNECTED
    - **Validates: Requirements 7.5**
  
  - [ ]* 4.8 Escribir unit tests para reconexión completa
    - Test que reconexión se intenta automáticamente tras fallo
    - Test que delays siguen exponential backoff correctamente
    - Test que re-suscripción funciona tras reconexión
    - Test que evento RECONNECTED se emite correctamente
    - Test que reconnectAttempts se resetea tras éxito
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 5. Implementar EventBus factory con fallback a in-memory
  - [x] 5.1 Crear interfaz EventBus común
    - Definir métodos publish(tenantId, event) y subscribe(tenantId, listener)
    - Soportar retorno síncrono (InMemory) y asíncrono (Supabase)
    - Documentar interfaz con JSDoc completo
    - Incluir tipos TypeScript precisos
    - _Requirements: 1.3, 2.1, 2.2_
  
  - [x] 5.2 Crear función createEventBus() con detección automática
    - Leer DATABASE_URL de process.env
    - Leer DIRECT_URL de process.env como fallback
    - Si alguno configurado → crear SupabaseEventBus
    - Si ninguno configurado → crear InMemoryEventBus
    - Registrar advertencia con console.warn si usa fallback
    - Iniciar conexión asíncrona (no bloquear)
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ]* 5.3 Escribir property test para fallback automático
    - **Property 20: Fallback a In-Memory**
    - Para cualquier configuración sin DATABASE_URL, debe usar InMemoryEventBus automáticamente
    - **Validates: Requirements 9.1**
  
  - [ ]* 5.4 Escribir property test para advertencia de fallback
    - **Property 21: Advertencia de Fallback**
    - Para cualquier inicialización con fallback, debe registrar advertencia sobre no compartir eventos
    - **Validates: Requirements 9.3**
  
  - [ ]* 5.5 Escribir property test para funcionalidad single-instance
    - **Property 22: Funcionalidad Single-Instance con Fallback**
    - Para cualquier operación con InMemoryEventBus, debe funcionar correctamente en single-instance
    - **Validates: Requirements 9.4**
  
  - [x] 5.6 Crear singleton global con hot-reload en desarrollo
    - Usar patrón globalForBus para evitar múltiples instancias
    - Reutilizar instancia en development mode (hot-reload)
    - Crear nueva instancia en production
    - _Requirements: 9.5_
  
  - [ ]* 5.7 Escribir unit tests para factory completo
    - Test que usa SupabaseEventBus con DATABASE_URL configurado
    - Test que usa SupabaseEventBus con DIRECT_URL configurado
    - Test que usa InMemoryEventBus sin ninguno configurado
    - Test que registra advertencia correcta con fallback
    - Test que singleton funciona correctamente
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [x] 6. Checkpoint - Validar factory y fallback
  - Ejecutar tests con DATABASE_URL: `DATABASE_URL=postgres://... npm test`
  - Ejecutar tests sin DATABASE_URL: `npm test` (sin variable)
  - Verificar que SupabaseEventBus se usa con DATABASE_URL configurado
  - Verificar que InMemoryEventBus se usa sin DATABASE_URL
  - Verificar advertencias en logs cuando usa fallback
  - Asegurar que TODOS los tests pasan antes de continuar

- [x] 7. Integrar con SSE streaming endpoint
  - [x] 7.1 Actualizar /api/events/stream para usar SupabaseEventBus
    - Importar eventBus desde factory (singleton global)
    - Mantener validación de tenant_id del query string
    - Usar await si subscribe() retorna Promise
    - Mantener keep-alive cada 15 segundos con comentario
    - Llamar cleanup en stream.cancel() o error
    - Manejar errores de suscripción con try/catch
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [ ] 7.2 Escribir property test para propagación SSE
    - **Property 5: Propagación de Eventos a Clientes SSE**
    - Para cualquier evento recibido del canal, debe enviarse a todos los clientes SSE del mismo tenant en JSON
    - **Validates: Requirements 4.3**
  
  - [x] 7.3 Implementar cancelación de suscripción en desconexión SSE
    - Llamar función de cleanup en stream.cancel()
    - Llamar función de cleanup en catch de errores
    - Limpiar timer de keep-alive con clearInterval
    - Registrar desconexión en logs con INFO
    - _Requirements: 4.4_
  
  - [ ]* 7.4 Escribir property test para cancelación SSE
    - **Property 6: Cancelación de Suscripción en Desconexión SSE**
    - Para cualquier cliente SSE que se desconecta, la suscripción debe cancelarse automáticamente
    - **Validates: Requirements 4.4**
  
  - [ ]* 7.5 Escribir integration tests para SSE completo
    - Test que cliente SSE recibe eventos publicados
    - Test que keep-alive mantiene conexión activa
    - Test que desconexión cancela suscripción correctamente
    - Test que múltiples clientes reciben mismo evento
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 8. Integrar con Outbox Pattern en ingest endpoint
  - [x] 8.1 Actualizar /api/events/ingest para usar SupabaseEventBus
    - Importar eventBus desde factory (singleton global)
    - Mantener guardado en event_outbox ANTES de publish (orden crítico)
    - Usar try/catch para manejar errores de publish
    - NO fallar transacción si publish falla (solo log error)
    - Marcar como published=true si publish exitoso
    - Dejar published=false si publish falla (worker reintentará)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 8.2 Escribir property test para orden de Outbox
    - **Property 7: Orden de Outbox Pattern**
    - Para cualquier evento, debe guardarse en event_outbox ANTES de intentar publicarlo
    - **Validates: Requirements 5.1**
  
  - [ ]* 8.3 Escribir property test para marcado de eventos
    - **Property 8: Marcado de Eventos Publicados**
    - Para cualquier evento publicado exitosamente, debe marcarse como published=true en outbox
    - **Validates: Requirements 5.2**
  
  - [ ]* 8.4 Escribir property test para persistencia en fallo
    - **Property 9: Persistencia en Fallo de Publicación**
    - Para cualquier evento cuya publicación falla, debe permanecer en outbox con published=false
    - **Validates: Requirements 5.3**
  
  - [ ]* 8.5 Escribir property test para resiliencia ante fallo
    - **Property 10: Resiliencia ante Fallo de Supabase**
    - Para cualquier evento, el sistema debe aceptarlo incluso si Supabase está no disponible
    - **Validates: Requirements 5.4**
  
  - [ ]* 8.6 Escribir property test para no fallo de transacción
    - **Property 11: No Fallo de Transacción por Error de Publicación**
    - Para cualquier error de publicación, debe registrarse pero NO fallar la transacción de ingest
    - **Validates: Requirements 5.5**
  
  - [ ]* 8.7 Escribir integration tests para Outbox Pattern completo
    - Test que evento se guarda en outbox antes de publish
    - Test que evento se marca published=true tras éxito
    - Test que evento permanece published=false tras fallo
    - Test que transacción NO falla si publish falla
    - Test que sistema acepta eventos con Supabase down
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Checkpoint - Validar integración completa
  - Ejecutar tests de integración: `npm test src/app/api/events/__tests__/`
  - Verificar flujo completo: ingest → outbox → publish → SSE
  - Verificar que Outbox Pattern funciona correctamente
  - Verificar que eventos se propagan a clientes SSE
  - Verificar que transacción NO falla si publish falla
  - Asegurar que TODOS los tests pasan antes de continuar

- [ ] 10. Implementar logging y observabilidad
  - [ ] 10.1 Agregar logging estructurado en SupabaseEventBus
    - Registrar conexiones exitosas con console.log nivel INFO
    - Registrar errores de conexión con console.error nivel ERROR
    - Registrar errores de publicación con console.error nivel ERROR
    - Registrar eventos cross-tenant con console.warn nivel WARN
    - Incluir contexto completo (tenant_id, event_id, attempts, timestamp)
    - Usar formato estructurado JSON para logs
    - _Requirements: 7.3, 12.4_
  
  - [ ]* 10.2 Escribir property test para logging de errores
    - **Property 14: Logging de Errores de Conexión**
    - Para cualquier error de conexión, debe registrarse en logs con nivel ERROR
    - **Validates: Requirements 7.3**
  
  - [ ] 10.3 Agregar métricas de observabilidad al sistema
    - Registrar contador de eventos publicados por tenant
    - Registrar contador de eventos recibidos por tenant
    - Registrar histograma de latencia de publicación (p50, p95, p99)
    - Registrar gauge de conexiones SSE activas por tenant
    - Registrar contador de errores de conexión
    - Integrar con sistema de observabilidad existente
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [ ] 10.4 Actualizar endpoint /api/health con estado de EventBus
    - Agregar campo eventBus al objeto de respuesta
    - Incluir estado de conexión (connected/disconnected/reconnecting)
    - Incluir número de canales activos (listeners.size)
    - Incluir timestamp de última conexión exitosa
    - Incluir número de intentos de reconexión actuales
    - _Requirements: 12.5_
  
  - [ ]* 10.5 Escribir unit tests para observabilidad
    - Test que métricas se registran correctamente
    - Test que health endpoint incluye estado de EventBus
    - Test que logs incluyen contexto completo
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 11. Implementar tests E2E para flujo Mesero → KDS
  - [ ]* 11.1 Escribir E2E test para single waiter → KDS
    - Test que orden de mesero llega a KDS vía SSE
    - Mesero crea orden y envía a cocina
    - KDS se conecta vía SSE y recibe evento
    - Verificar que evento se propaga en <5 segundos
    - Verificar que KDS muestra orden correctamente
    - _Requirements: 10.4_
  
  - [ ]* 11.2 Escribir E2E test para multiple waiters → KDS (CRÍTICO)
    - Test que órdenes de 2 meseros llegan a KDS
    - Mesero 1 crea orden A y envía a cocina
    - Mesero 2 crea orden B y envía a cocina
    - KDS se conecta vía SSE y recibe AMBOS eventos
    - Verificar que ambas órdenes son visibles en KDS
    - Verificar que no hay cross-contamination entre tenants
    - **Este test debe PASAR para considerar la migración exitosa**
    - _Requirements: 10.5_
  
  - [ ]* 11.3 Escribir E2E test para reconexión automática
    - Simular desconexión de PostgreSQL (cerrar conexión)
    - Verificar que sistema reconecta automáticamente
    - Verificar que eventos se propagan después de reconexión
    - Verificar que clientes SSE reciben evento RECONNECTED
    - _Requirements: 7.1, 7.4, 7.5_
  
  - [ ]* 11.4 Escribir E2E test para tenant isolation
    - Crear 2 tenants diferentes (A y B)
    - Mesero de tenant A envía orden
    - KDS de tenant B NO debe recibir el evento
    - KDS de tenant A SÍ debe recibir el evento
    - Verificar aislamiento completo entre tenants
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 12. Checkpoint - Validar tests E2E
  - Ejecutar TODOS los tests E2E con Playwright: `npm run test:e2e`
  - Verificar que test "single waiter → KDS" pasa
  - Verificar que test "multiple waiters → KDS" pasa (CRÍTICO)
  - Verificar que test "reconexión automática" pasa
  - Verificar que test "tenant isolation" pasa
  - Verificar que no hay regresiones en otros tests E2E
  - Asegurar que TODOS los tests E2E pasan antes de continuar

- [ ] 13. Implementar stress tests para performance
  - [ ]* 13.1 Escribir stress test para throughput por tenant
    - **Property 18: Throughput por Tenant**
    - Test que sistema soporta 100 eventos/segundo por tenant
    - Publicar 1000 eventos en 10 segundos
    - Verificar que TODOS los eventos se reciben
    - Verificar que latencia promedio se mantiene <500ms
    - Medir p50, p95, p99 de latencia
    - **Validates: Requirements 8.2**
  
  - [ ]* 13.2 Escribir stress test para conexiones SSE concurrentes
    - **Property 19: Conexiones SSE Concurrentes**
    - Test que sistema soporta 50 conexiones SSE concurrentes por tenant
    - Crear 50 clientes SSE conectados simultáneamente
    - Publicar evento y verificar que TODOS los 50 lo reciben
    - Verificar que no hay degradación de performance
    - Medir tiempo de propagación a cada cliente
    - **Validates: Requirements 8.3**
  
  - [ ]* 13.3 Escribir stress test para latencia de propagación
    - **Property 17: Latencia de Propagación**
    - Test que eventos se propagan en <500ms en percentil 95
    - Publicar 1000 eventos y medir latencia end-to-end
    - Calcular p50, p95, p99 de latencia
    - Verificar que p95 < 500ms
    - Verificar que p99 < 1000ms
    - **Validates: Requirements 8.1**
  
  - [ ]* 13.4 Escribir stress test para connection pooling
    - Test que connection pooling de PostgreSQL funciona correctamente
    - Crear 100 suscripciones concurrentes
    - Verificar que no se agotan las conexiones
    - Verificar que performance se mantiene estable
    - _Requirements: 8.4_
  
  - [ ]* 13.5 Ejecutar todos los stress tests y documentar resultados
    - Ejecutar cada stress test 3 veces para consistencia
    - Documentar métricas: throughput, latencia, conexiones
    - Verificar que TODOS los stress tests pasan
    - Documentar cualquier bottleneck identificado
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 14. Crear documentación de migración y despliegue
  - [ ] 14.1 Crear guía de migración paso a paso
    - Documentar verificación de DATABASE_URL en .env
    - Documentar verificación de DIRECT_URL en .env
    - Documentar proceso de despliegue sin downtime
    - Documentar verificación post-despliegue (health check)
    - Documentar plan de rollback completo
    - Incluir comandos exactos para cada paso
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [ ] 14.2 Crear scripts de verificación
    - Script para verificar conexión a PostgreSQL
    - Script para verificar LISTEN/NOTIFY funciona
    - Script para verificar propagación de eventos end-to-end
    - Script para verificar tenant isolation
    - Script para verificar performance (latencia, throughput)
    - _Requirements: 11.4_
  
  - [ ] 14.3 Actualizar documentación de arquitectura
    - Actualizar diagrama de arquitectura con Supabase Realtime
    - Documentar flujo de eventos completo con PostgreSQL NOTIFY
    - Documentar estrategia de fallback a in-memory
    - Documentar manejo de errores y reconexión
    - Documentar métricas de observabilidad
    - _Requirements: 11.3_
  
  - [ ] 14.4 Crear documentación de troubleshooting
    - Documentar problemas comunes y soluciones
    - Documentar cómo verificar estado de conexión
    - Documentar cómo verificar logs de EventBus
    - Documentar cómo verificar métricas de performance
    - Documentar cómo hacer rollback si es necesario
    - _Requirements: 11.3, 11.5_
  
  - [ ] 14.5 Crear checklist de despliegue
    - Checklist pre-despliegue (verificaciones)
    - Checklist durante despliegue (pasos)
    - Checklist post-despliegue (validaciones)
    - Criterios de éxito claros
    - Plan de rollback detallado
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

- [ ] 15. Checkpoint final - Validación completa del sistema
  - Ejecutar TODOS los tests unitarios: `npm test`
  - Ejecutar TODOS los property tests: `npm test -- --grep "Property"`
  - Ejecutar TODOS los integration tests: `npm test src/app/api/events/__tests__/`
  - Ejecutar TODOS los tests E2E: `npm run test:e2e`
  - Ejecutar TODOS los stress tests: `npm run test:stress`
  - Verificar que NO hay regresiones en funcionalidad existente
  - Verificar que documentación está completa y actualizada
  - Verificar que scripts de verificación funcionan correctamente
  - Verificar que health endpoint incluye estado de EventBus
  - Verificar que sistema está listo para despliegue en producción
  - **Criterio de éxito: 100% de tests pasando**

## Resumen de Cobertura de Testing

### Property-Based Tests (22 properties)
- ✅ Property 1: Serialización Round-Trip (Requirements 2.4, 2.5)
- ✅ Property 2: Aislamiento de Canal por Tenant (Requirements 3.1, 3.2, 3.3)
- ✅ Property 3: Validación de Tenant en Eventos (Requirements 3.4, 3.5)
- ✅ Property 4: Cleanup de Suscripción (Requirements 2.3)
- ✅ Property 5: Propagación a Clientes SSE (Requirements 4.3)
- ✅ Property 6: Cancelación en Desconexión SSE (Requirements 4.4)
- ✅ Property 7: Orden de Outbox Pattern (Requirements 5.1)
- ✅ Property 8: Marcado de Eventos Publicados (Requirements 5.2)
- ✅ Property 9: Persistencia en Fallo (Requirements 5.3)
- ✅ Property 10: Resiliencia ante Fallo (Requirements 5.4)
- ✅ Property 11: No Fallo de Transacción (Requirements 5.5)
- ✅ Property 12: Reconexión Automática (Requirements 7.1)
- ✅ Property 13: Exponential Backoff (Requirements 7.2)
- ✅ Property 14: Logging de Errores (Requirements 7.3)
- ✅ Property 15: Re-suscripción en Reconexión (Requirements 7.4)
- ✅ Property 16: Evento de Reconexión (Requirements 7.5)
- ✅ Property 17: Latencia de Propagación (Requirements 8.1)
- ✅ Property 18: Throughput por Tenant (Requirements 8.2)
- ✅ Property 19: Conexiones SSE Concurrentes (Requirements 8.3)
- ✅ Property 20: Fallback a In-Memory (Requirements 9.1)
- ✅ Property 21: Advertencia de Fallback (Requirements 9.3)
- ✅ Property 22: Funcionalidad Single-Instance (Requirements 9.4)

### Unit Tests
- Conexión/desconexión de SupabaseEventBus
- Manejo de notificaciones y errores
- Cleanup de suscripciones
- Reconexión automática
- Factory y fallback
- Integración con SSE
- Integración con Outbox Pattern
- Logging y observabilidad

### Integration Tests
- Flujo completo ingest → outbox → publish → SSE
- Integración con PostgreSQL LISTEN/NOTIFY
- Outbox Pattern completo
- SSE streaming completo

### E2E Tests (Playwright)
- Single waiter → KDS
- Multiple waiters → KDS (CRÍTICO)
- Reconexión automática
- Tenant isolation

### Stress Tests
- Throughput: 100 eventos/segundo
- Conexiones concurrentes: 50 clientes SSE
- Latencia: <500ms p95
- Connection pooling

## Criterios de Éxito

La migración se considera exitosa cuando:

1. ✅ TODOS los tests pasan (unit, property, integration, E2E, stress)
2. ✅ Test E2E "multiple waiters → KDS" pasa consistentemente
3. ✅ Performance cumple requisitos (100 evt/s, 50 conexiones, <500ms p95)
4. ✅ Tenant isolation funciona correctamente (sin cross-contamination)
5. ✅ Reconexión automática funciona tras fallos de conexión
6. ✅ Outbox Pattern garantiza confiabilidad de eventos
7. ✅ Fallback a in-memory funciona en entornos sin Supabase
8. ✅ Documentación completa y scripts de verificación funcionan
9. ✅ Health endpoint reporta estado correcto de EventBus
10. ✅ Sistema listo para despliegue en producción sin downtime

## Notes

- Tasks marcadas con `*` son opcionales y pueden omitirse para MVP más rápido
- Cada task referencia requirements específicos para trazabilidad
- Checkpoints aseguran validación incremental
- Property tests validan correctitud universal
- Unit tests validan ejemplos específicos y edge cases
- E2E tests validan flujo completo end-to-end
- Stress tests validan performance bajo carga

## 🔴 REGLA CRÍTICA: Testing Después de Cada Implementación

**SIEMPRE ejecutar tests después de implementar cada sub-tarea:**

1. **Después de implementar código:**
   ```bash
   # Ejecutar tests unitarios
   npm test src/core/infra/__tests__/event-bus.test.ts
   
   # Verificar que no hay errores de TypeScript
   npx tsc --noEmit
   ```

2. **Después de implementar property tests:**
   ```bash
   # Ejecutar property tests específicos
   npm test src/core/infra/__tests__/event-bus.property.test.ts
   ```

3. **Después de implementar integración:**
   ```bash
   # Ejecutar tests de integración
   npm test src/app/api/events/__tests__/
   ```

4. **Después de implementar E2E tests:**
   ```bash
   # Ejecutar tests E2E específicos
   npm run test:e2e e2e/waiter-to-kds.spec.ts
   ```

**NO continuar a la siguiente sub-tarea si los tests fallan.**

**Workflow correcto:**
1. Implementar sub-tarea
2. Ejecutar tests correspondientes
3. Si tests pasan → Continuar a siguiente sub-tarea
4. Si tests fallan → Corregir hasta que pasen
5. Marcar sub-tarea como completa solo cuando tests pasan
