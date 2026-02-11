# Requirements Document: Realtime EventBus con Supabase

## Introducción

El sistema actual utiliza un EventBus in-memory basado en EventEmitter de Node.js para distribuir eventos en tiempo real a través de Server-Sent Events (SSE). Este enfoque presenta un problema arquitectónico crítico: en Next.js development mode (y potencialmente en producción con múltiples instancias), cada request HTTP puede ser manejado por una instancia diferente del servidor. Los eventos publicados en una instancia NO llegan a los clientes SSE conectados a otra instancia, causando que el sistema de tiempo real falle completamente.

Este documento especifica los requisitos para migrar el EventBus a Supabase Realtime, que utiliza PostgreSQL LISTEN/NOTIFY como intermediario, permitiendo que TODAS las instancias de Next.js se conecten a la MISMA base de datos y compartan eventos en tiempo real.

## Glossary

- **EventBus**: Sistema de publicación/suscripción que distribuye eventos en tiempo real a múltiples clientes
- **SSE (Server-Sent Events)**: Protocolo HTTP para streaming unidireccional de eventos del servidor al cliente
- **Supabase_Realtime**: Servicio de Supabase que proporciona pub/sub en tiempo real usando PostgreSQL LISTEN/NOTIFY
- **Terminal**: Dispositivo físico (tablet/PC) que ejecuta la aplicación POS
- **Tenant**: Organización o negocio que usa el sistema (multi-tenant)
- **ParkEvent**: Evento del sistema que representa un cambio de estado (ORDER_CREATED, PAYMENT_ADDED, etc.)
- **Outbox_Pattern**: Patrón que garantiza que eventos se publican de forma confiable usando una tabla de base de datos
- **Tenant_Isolation**: Garantía de que eventos de un tenant NO son visibles para otros tenants

## Requirements

### Requirement 1: Migración de EventBus a Supabase Realtime

**User Story:** Como desarrollador del sistema, quiero migrar el EventBus in-memory a Supabase Realtime, para que los eventos se distribuyan correctamente entre múltiples instancias del servidor.

#### Acceptance Criteria

1. THE System SHALL reemplazar la clase InMemoryEventBus con una implementación basada en Supabase Realtime
2. WHEN el sistema se inicializa, THE System SHALL establecer una conexión con Supabase Realtime usando las credenciales de PostgreSQL
3. THE System SHALL mantener la misma interfaz pública (publish/subscribe) que el EventBus actual
4. WHEN se publica un evento, THE System SHALL usar PostgreSQL NOTIFY para distribuirlo a todas las instancias
5. WHEN una instancia se suscribe a eventos, THE System SHALL usar PostgreSQL LISTEN para recibir notificaciones

### Requirement 2: Compatibilidad con Interfaz Existente

**User Story:** Como desarrollador del sistema, quiero que la nueva implementación mantenga la misma interfaz, para que no sea necesario modificar el código existente que usa el EventBus.

#### Acceptance Criteria

1. THE SupabaseEventBus SHALL implementar los métodos publish(tenantId, event) y subscribe(tenantId, listener)
2. THE publish() method SHALL aceptar los mismos parámetros que la implementación actual
3. THE subscribe() method SHALL retornar una función de cleanup que cancela la suscripción
4. WHEN se llama a publish(), THE System SHALL serializar el evento a JSON antes de enviarlo
5. WHEN se recibe un evento, THE System SHALL deserializar el JSON y llamar al listener con el objeto ParkEvent

### Requirement 3: Aislamiento por Tenant

**User Story:** Como administrador del sistema, quiero que los eventos estén aislados por tenant, para que un tenant NO pueda recibir eventos de otro tenant.

#### Acceptance Criteria

1. WHEN se publica un evento, THE System SHALL incluir el tenant_id en el canal de PostgreSQL
2. WHEN una instancia se suscribe, THE System SHALL suscribirse solo al canal del tenant especificado
3. THE System SHALL usar el formato de canal `events:{tenant_id}` para garantizar aislamiento
4. WHEN se recibe un evento, THE System SHALL validar que el tenant_id del evento coincide con el tenant_id del canal
5. IF un evento tiene un tenant_id diferente al esperado, THEN THE System SHALL descartar el evento y registrar una advertencia

### Requirement 4: Integración con SSE Streaming

**User Story:** Como terminal POS, quiero recibir eventos en tiempo real vía SSE, para que la interfaz se actualice automáticamente cuando ocurren cambios.

#### Acceptance Criteria

1. THE SSE endpoint (/api/events/stream) SHALL usar el SupabaseEventBus para suscribirse a eventos
2. WHEN un cliente SSE se conecta, THE System SHALL suscribirse al canal del tenant usando Supabase Realtime
3. WHEN se recibe un evento del canal, THE System SHALL enviarlo al cliente SSE en formato JSON
4. WHEN un cliente SSE se desconecta, THE System SHALL cancelar la suscripción de Supabase Realtime
5. THE System SHALL mantener el keep-alive cada 15 segundos para mantener la conexión SSE activa

### Requirement 5: Integración con Outbox Pattern

**User Story:** Como desarrollador del sistema, quiero que la publicación de eventos use el Outbox Pattern, para garantizar que los eventos se publican de forma confiable incluso si Supabase Realtime falla temporalmente.

#### Acceptance Criteria

1. WHEN se acepta un evento en /api/events/ingest, THE System SHALL guardar el evento en la tabla event_outbox ANTES de publicarlo
2. WHEN se publica un evento exitosamente, THE System SHALL marcar el evento como published en event_outbox
3. IF la publicación falla, THEN THE System SHALL dejar el evento en event_outbox para que el worker lo reintente
4. THE System SHALL continuar aceptando eventos incluso si Supabase Realtime está temporalmente no disponible
5. THE System SHALL registrar errores de publicación pero NO fallar la transacción de ingest

### Requirement 6: Soporte Offline-First

**User Story:** Como terminal POS, quiero que el sistema funcione offline, para que pueda seguir operando incluso sin conexión a internet.

#### Acceptance Criteria

1. WHEN una terminal está offline, THE System SHALL almacenar eventos localmente en IndexedDB
2. WHEN la terminal recupera conectividad, THE System SHALL sincronizar eventos pendientes con el servidor
3. THE System SHALL usar el SyncClient existente para manejar la sincronización offline
4. WHEN se reciben eventos vía SSE, THE System SHALL actualizar el estado local en IndexedDB
5. THE System SHALL mantener la funcionalidad de useLiveQuery para actualizar la UI automáticamente

### Requirement 7: Manejo de Errores y Reconexión

**User Story:** Como desarrollador del sistema, quiero que el EventBus maneje errores de conexión automáticamente, para que el sistema sea resiliente a fallos temporales de red.

#### Acceptance Criteria

1. WHEN la conexión con Supabase Realtime falla, THE System SHALL intentar reconectar automáticamente
2. THE System SHALL usar exponential backoff para los reintentos (1s, 2s, 4s, 8s, max 30s)
3. THE System SHALL registrar errores de conexión con nivel ERROR en los logs estructurados
4. WHEN la conexión se recupera, THE System SHALL re-suscribirse a todos los canales activos
5. THE System SHALL emitir un evento de reconexión para que los clientes puedan actualizar su estado

### Requirement 8: Performance y Latencia

**User Story:** Como usuario del sistema, quiero que los eventos se propaguen rápidamente, para que la interfaz se actualice en tiempo real sin retrasos perceptibles.

#### Acceptance Criteria

1. WHEN se publica un evento, THE System SHALL propagarlo a todos los suscriptores en menos de 500ms (percentil 95)
2. THE System SHALL soportar al menos 100 eventos por segundo por tenant
3. THE System SHALL soportar al menos 50 conexiones SSE concurrentes por tenant
4. THE System SHALL usar connection pooling de PostgreSQL para optimizar el rendimiento
5. THE System SHALL monitorear la latencia de publicación y registrar métricas en el sistema de observabilidad

### Requirement 9: Fallback a EventBus In-Memory

**User Story:** Como desarrollador del sistema, quiero que el sistema tenga un fallback a EventBus in-memory, para que pueda funcionar en entornos de desarrollo sin Supabase configurado.

#### Acceptance Criteria

1. IF las credenciales de Supabase NO están configuradas, THEN THE System SHALL usar el EventBus in-memory como fallback
2. THE System SHALL detectar automáticamente si Supabase está disponible al inicializar
3. THE System SHALL registrar una advertencia si usa el fallback in-memory
4. WHERE el fallback está activo, THE System SHALL funcionar correctamente en modo single-instance
5. THE System SHALL permitir cambiar entre implementaciones sin reiniciar el servidor (hot-reload en desarrollo)

### Requirement 10: Testing y Validación

**User Story:** Como desarrollador del sistema, quiero que el EventBus tenga tests completos, para garantizar que funciona correctamente en todos los escenarios.

#### Acceptance Criteria

1. THE System SHALL incluir unit tests para SupabaseEventBus que validen publish/subscribe
2. THE System SHALL incluir integration tests que validen la integración con PostgreSQL LISTEN/NOTIFY
3. THE System SHALL incluir property-based tests que validen el aislamiento por tenant
4. THE System SHALL incluir E2E tests que validen el flujo completo Mesero → KDS vía SSE
5. THE E2E test "multiple waiters can submit orders simultaneously" SHALL pasar exitosamente

### Requirement 11: Migración y Despliegue

**User Story:** Como DevOps, quiero que la migración sea segura y reversible, para minimizar el riesgo de downtime en producción.

#### Acceptance Criteria

1. THE System SHALL soportar feature flag para habilitar/deshabilitar Supabase Realtime
2. THE System SHALL permitir desplegar la nueva implementación sin downtime
3. THE System SHALL incluir documentación de migración con pasos detallados
4. THE System SHALL incluir scripts de verificación para validar que Supabase Realtime funciona correctamente
5. IF ocurre un problema, THEN THE System SHALL permitir rollback al EventBus in-memory sin pérdida de datos

### Requirement 12: Monitoreo y Observabilidad

**User Story:** Como DevOps, quiero monitorear el estado del EventBus, para detectar y resolver problemas proactivamente.

#### Acceptance Criteria

1. THE System SHALL registrar métricas de eventos publicados/recibidos en el sistema de observabilidad
2. THE System SHALL registrar métricas de latencia de publicación (p50, p95, p99)
3. THE System SHALL registrar métricas de conexiones SSE activas por tenant
4. THE System SHALL registrar errores de conexión con Supabase Realtime
5. THE System SHALL exponer un endpoint /api/health que incluya el estado de Supabase Realtime
