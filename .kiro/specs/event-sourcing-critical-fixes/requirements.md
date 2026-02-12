# Requirements Document: Event Sourcing Critical Fixes

## Introduction

Este documento especifica los requisitos para corregir problemas críticos en el sistema de Event Sourcing de PARK POS que están bloqueando el despliegue a producción. Los tests E2E de Playwright han identificado 8 tests fallando en tres áreas críticas: deduplicación de eventos, concurrencia multi-terminal, y rate limiting.

El sistema actualmente tiene un 91% de tests pasando (95/104), pero los 9 tests fallando representan funcionalidades críticas que pueden causar pérdidas financieras, inconsistencias de datos, y vulnerabilidades de seguridad.

## Glossary

- **Event**: Evento inmutable que representa un cambio en el sistema (ORDER_CREATED, ITEM_ADDED, etc.)
- **Event_ID**: Identificador único UUID de un evento
- **Deduplication**: Proceso de detectar y rechazar eventos duplicados
- **Processed_Events**: Tabla de base de datos que registra eventos ya procesados
- **Idempotency**: Propiedad donde procesar el mismo evento múltiples veces produce el mismo resultado
- **Terminal**: Dispositivo físico (caja, mesero, KDS) que genera eventos
- **Terminal_Sequence**: Número secuencial de eventos por terminal
- **Concurrency**: Capacidad de procesar múltiples eventos simultáneamente sin conflictos
- **Race_Condition**: Situación donde el resultado depende del orden de ejecución de operaciones concurrentes
- **Order_Number**: Número único de orden asignado secuencialmente
- **Rate_Limiting**: Mecanismo para limitar la cantidad de requests por unidad de tiempo
- **Burst_Traffic**: Ráfaga de múltiples requests en un período corto
- **Ingest_Endpoint**: API endpoint `/api/events/ingest` que recibe eventos
- **ProjectEvent**: Función que aplica un evento a las proyecciones de base de datos
- **Aggregate**: Entidad del dominio (ORDER, SHIFT, INVOICE) que agrupa eventos relacionados
- **Revision**: Número de versión de un aggregate para detectar conflictos

## Requirements

### Requirement 1: Event Deduplication Idempotente

**User Story:** Como desarrollador del sistema, quiero que el sistema detecte y rechace eventos duplicados de manera idempotente, para que los eventos procesados múltiples veces no causen inconsistencias financieras o de datos.

#### Acceptance Criteria

1. WHEN un evento con el mismo event_id es enviado múltiples veces, THE System SHALL procesar el evento solo una vez y retornar éxito en todas las solicitudes
2. WHEN se verifica si un evento fue procesado, THE System SHALL consultar la tabla processed_events usando el event_id como clave primaria
3. WHEN se marca un evento como procesado, THE System SHALL insertar el registro en processed_events ANTES de aplicar las proyecciones
4. IF un evento ya existe en processed_events, THEN THE System SHALL retornar éxito inmediatamente sin aplicar proyecciones
5. WHEN múltiples requests con el mismo event_id llegan simultáneamente, THE System SHALL usar constraints de base de datos para garantizar que solo uno sea procesado
6. THE System SHALL registrar en processed_events el tenant_id, event_id, processed_at, aggregate_id, event_type, y processor
7. WHEN un evento es rechazado por duplicación, THE System SHALL incluir el event_id en el array deduped_event_ids de la respuesta
8. THE System SHALL mantener un índice en processed_events(tenant_id, processed_at) para limpieza periódica de registros antiguos

### Requirement 2: Verificación Atómica de Duplicados

**User Story:** Como desarrollador del sistema, quiero que la verificación y marcado de eventos como procesados sea atómica, para que no haya race conditions que permitan procesar el mismo evento dos veces.

#### Acceptance Criteria

1. WHEN se verifica y marca un evento como procesado, THE System SHALL ejecutar ambas operaciones dentro de una transacción de base de datos
2. THE System SHALL usar el constraint UNIQUE en processed_events(event_id) para prevenir inserciones duplicadas
3. IF la inserción en processed_events falla por violación de constraint único, THEN THE System SHALL capturar el error y retornar éxito (idempotencia)
4. WHEN se procesa un batch de eventos, THE System SHALL verificar duplicados para cada evento individualmente dentro de la transacción
5. THE System SHALL usar isolation level SERIALIZABLE o REPEATABLE READ para prevenir phantom reads en verificación de duplicados

### Requirement 3: Multi-Terminal Concurrency Sin Conflictos

**User Story:** Como administrador del restaurante, quiero que 15 meseros y 1 cajero puedan trabajar simultáneamente sin conflictos, para que el sistema soporte la carga operativa real del negocio.

#### Acceptance Criteria

1. WHEN múltiples terminales envían eventos simultáneamente, THE System SHALL procesar todos los eventos sin pérdida de datos
2. WHEN dos terminales intentan crear órdenes con el mismo order_number, THE System SHALL detectar el conflicto y asignar un número diferente a uno de ellos
3. WHEN dos terminales agregan items a la misma orden simultáneamente, THE System SHALL aplicar ambos cambios sin pérdida de datos
4. THE System SHALL usar optimistic locking con el campo revision en la tabla orders para detectar conflictos
5. WHEN se detecta un conflicto de revisión, THE System SHALL incrementar el revision del aggregate después de aplicar cada evento
6. THE System SHALL procesar eventos en orden de terminal_sequence dentro de cada terminal
7. WHEN múltiples eventos del mismo terminal llegan fuera de orden, THE System SHALL rechazar eventos con terminal_sequence no consecutivo
8. THE System SHALL soportar al menos 16 terminales concurrentes (15 meseros + 1 cajero) procesando eventos simultáneamente

### Requirement 4: Asignación Segura de Order Numbers

**User Story:** Como desarrollador del sistema, quiero que los order numbers sean asignados de manera segura y sin colisiones, para que cada orden tenga un número único y secuencial.

#### Acceptance Criteria

1. THE System SHALL usar la tabla terminal_number_ranges para asignar rangos de números a cada terminal
2. WHEN un terminal necesita un order_number, THE System SHALL obtenerlo de su rango asignado sin consultar la base de datos
3. WHEN un terminal agota su rango asignado, THE System SHALL solicitar un nuevo rango al servidor de manera atómica
4. THE System SHALL usar SELECT FOR UPDATE o equivalent locking mechanism para asignar rangos sin colisiones
5. WHEN se asigna un rango a un terminal, THE System SHALL actualizar terminal_number_ranges con el último número asignado
6. THE System SHALL validar que el order_number en eventos ORDER_CREATED esté dentro del rango asignado al terminal
7. IF un order_number está fuera del rango asignado, THEN THE System SHALL rechazar el evento con error INVALID_ORDER_NUMBER
8. THE System SHALL mantener un buffer de números pre-asignados por terminal para evitar latencia en asignación

### Requirement 5: Manejo de Eventos Fuera de Orden

**User Story:** Como desarrollador del sistema, quiero que el sistema maneje eventos que llegan fuera de orden de manera predecible, para que no se pierdan datos ni se corrompan las proyecciones.

#### Acceptance Criteria

1. WHEN un evento ORDER_ITEM_ADDED llega antes que ORDER_CREATED para la misma orden, THE System SHALL encolar el evento hasta que ORDER_CREATED sea procesado
2. THE System SHALL mantener una cola temporal de eventos pendientes por aggregate_id
3. WHEN se procesa un evento que crea un aggregate, THE System SHALL verificar si hay eventos encolados para ese aggregate y procesarlos en orden
4. THE System SHALL usar el campo terminal_sequence para determinar el orden correcto de eventos del mismo terminal
5. WHEN eventos del mismo terminal llegan con terminal_sequence no consecutivo, THE System SHALL encolar los eventos con sequence mayor hasta que lleguen los faltantes
6. THE System SHALL tener un timeout de 60 segundos para eventos encolados, después del cual serán rechazados
7. WHEN un evento encolado expira, THE System SHALL registrar el evento en una tabla dead_letter_queue para análisis posterior
8. THE System SHALL emitir una alerta cuando más de 10 eventos estén encolados para el mismo aggregate

### Requirement 6: Rate Limiting con Burst Handling

**User Story:** Como administrador del sistema, quiero que el sistema tenga rate limiting para proteger contra ataques DoS y burst traffic excesivo, para que el sistema permanezca estable bajo carga alta.

#### Acceptance Criteria

1. THE System SHALL implementar rate limiting en el endpoint /api/events/ingest usando sliding window algorithm
2. THE System SHALL permitir un máximo de 100 requests por segundo por tenant_id
3. THE System SHALL permitir bursts de hasta 200 requests en una ventana de 1 segundo
4. WHEN se excede el rate limit, THE System SHALL retornar HTTP 429 (Too Many Requests) con header Retry-After
5. THE System SHALL usar Redis o memoria compartida para mantener contadores de rate limiting
6. THE System SHALL aplicar rate limiting por tenant_id, no por terminal_id, para permitir múltiples terminales
7. WHEN se rechaza un request por rate limiting, THE System SHALL incluir en la respuesta el tiempo de espera recomendado
8. THE System SHALL registrar métricas de rate limiting (requests rechazados, burst detectados) para monitoreo

### Requirement 7: Retry Logic con Exponential Backoff

**User Story:** Como desarrollador del cliente de sincronización, quiero que el cliente implemente retry logic con exponential backoff, para que los eventos eventualmente sean procesados incluso bajo condiciones de red inestables.

#### Acceptance Criteria

1. WHEN un request al ingest endpoint falla con error de red, THE SyncClient SHALL reintentar el request con exponential backoff
2. THE SyncClient SHALL usar un backoff inicial de 1 segundo, duplicando el tiempo en cada intento hasta un máximo de 60 segundos
3. THE SyncClient SHALL agregar jitter aleatorio del 20% al tiempo de backoff para evitar thundering herd
4. WHEN un request falla con HTTP 429 (rate limit), THE SyncClient SHALL respetar el header Retry-After antes de reintentar
5. WHEN un request falla con HTTP 4xx (excepto 429), THE SyncClient SHALL NO reintentar automáticamente
6. WHEN un request falla con HTTP 5xx, THE SyncClient SHALL reintentar hasta 5 veces antes de marcar el evento como fallido
7. THE SyncClient SHALL mantener un circuit breaker que se abre después de 10 fallos consecutivos
8. WHEN el circuit breaker está abierto, THE SyncClient SHALL esperar 30 segundos antes de intentar cerrar el circuito

### Requirement 8: Validación de Eventos Antes de Procesamiento

**User Story:** Como desarrollador del sistema, quiero que todos los eventos sean validados antes de ser procesados, para que eventos inválidos no corrompan las proyecciones.

#### Acceptance Criteria

1. THE System SHALL validar el schema de cada evento usando Zod antes de procesarlo
2. WHEN un evento falla validación de schema, THE System SHALL rechazar el evento y retornar error SCHEMA_VALIDATION_FAILED
3. THE System SHALL validar que todos los UUIDs en el evento sean válidos (event_id, aggregate_id, actor_id, etc.)
4. THE System SHALL validar que el tenant_id en el evento coincida con el tenant_id del request
5. THE System SHALL validar que el terminal_id en el evento esté registrado en la tabla terminals
6. THE System SHALL validar reglas de negocio específicas por tipo de evento (ej: ORDER_ITEM_ADDED requiere que la orden exista)
7. WHEN un evento falla validación de negocio, THE System SHALL rechazar el evento y agregarlo al array rejected en la respuesta
8. THE System SHALL incluir en la respuesta de rechazo el error específico y detalles para debugging

### Requirement 9: Logging y Observabilidad de Eventos

**User Story:** Como desarrollador del sistema, quiero que todos los eventos procesados, rechazados, y deduplicados sean registrados con contexto completo, para que pueda diagnosticar problemas en producción.

#### Acceptance Criteria

1. THE System SHALL registrar en logs estructurados cada evento procesado con tenant_id, event_id, event_type, y processing_time_ms
2. THE System SHALL registrar eventos deduplicados con nivel INFO incluyendo el event_id y timestamp del procesamiento original
3. THE System SHALL registrar eventos rechazados con nivel WARN incluyendo el motivo de rechazo y detalles del evento
4. THE System SHALL registrar conflictos de concurrencia con nivel WARN incluyendo aggregate_id, expected_revision, y actual_revision
5. THE System SHALL emitir métricas de Prometheus para: eventos procesados, eventos deduplicados, eventos rechazados, y latencia de procesamiento
6. THE System SHALL mantener un dashboard de Grafana con métricas en tiempo real de procesamiento de eventos
7. WHEN se detecta un patrón anómalo (ej: >10% eventos deduplicados), THE System SHALL emitir una alerta
8. THE System SHALL registrar en la tabla conflict_logs todos los conflictos detectados para análisis posterior

### Requirement 10: Tests E2E para Validar Correcciones

**User Story:** Como desarrollador del sistema, quiero que todos los tests E2E fallando pasen después de las correcciones, para que pueda verificar que el sistema está listo para producción.

#### Acceptance Criteria

1. THE System SHALL pasar el test "should handle duplicate event submission (idempotency)" en 02-offline-sync.spec.ts
2. THE System SHALL pasar el test "should handle simultaneous orders from multiple waiters" en 03-concurrency.spec.ts
3. THE System SHALL pasar el test "should handle same product added from 2 terminals to same order" en 03-concurrency.spec.ts
4. THE System SHALL pasar el test "should handle order number collision prevention" en 03-concurrency.spec.ts
5. THE System SHALL pasar el test "should handle rapid sequential events from same terminal" en 03-concurrency.spec.ts
6. THE System SHALL pasar el test "should handle 15 waiters + 1 cashier simultaneous operations" en 03-concurrency.spec.ts
7. THE System SHALL pasar el test "should deduplicate identical events sent multiple times" en 03-concurrency.spec.ts
8. THE System SHALL pasar el test "should handle out-of-order event delivery" en 03-concurrency.spec.ts
9. THE System SHALL pasar el test "should handle burst of events gracefully" en 03-concurrency.spec.ts
10. THE System SHALL ejecutar todos los 228 tests E2E sin timeout y con 100% de éxito

