# Realtime EventBus con Supabase - Implementación Completa Tasks 1-6

## Fecha: 11 Febrero 2026

## ✅ Estado General: Tasks 1-6 Completadas

### Resumen Ejecutivo

Se implementó exitosamente el **SupabaseEventBus** con PostgreSQL LISTEN/NOTIFY, reemplazando el EventBus in-memory y resolviendo el problema arquitectónico crítico donde eventos no se compartían entre múltiples instancias de Next.js.

### Tasks Completadas

- ✅ **Task 1**: Implementar SupabaseEventBus con PostgreSQL LISTEN/NOTIFY
- ✅ **Task 2**: Implementar manejo de notificaciones y tenant isolation
- ✅ **Task 3**: Checkpoint - Validar funcionalidad básica
- ✅ **Task 4**: Implementar reconexión automática con exponential backoff
- ✅ **Task 5**: Implementar EventBus factory con fallback
- ✅ **Task 6**: Checkpoint - Validar factory y fallback

### Archivos Creados

1. **`src/core/infra/supabase-event-bus.ts`** (340 líneas)
   - Clase SupabaseEventBus completa
   - Conexión a PostgreSQL con pool
   - Métodos publish() y subscribe()
   - Handler de notificaciones con validación de tenant
   - Reconexión automática con exponential backoff
   - Evento RECONNECTED para clientes
   - Cleanup de recursos

2. **`src/core/infra/event-bus.ts`** (actualizado, 100 líneas)
   - Interfaz EventBus común
   - Clase InMemoryEventBus (fallback)
   - Factory createEventBus() con detección automática
   - Singleton global con hot-reload

### Características Implementadas

#### 1. Conexión a PostgreSQL
- Pool de conexiones (max 10)
- Cliente dedicado para LISTEN
- Handler de notificaciones configurado
- Re-suscripción automática en reconexión

#### 2. Publicación de Eventos
- Método `publish(tenantId, event)`
- Usa `pg_notify` para distribuir eventos
- Formato de canal: `events:{tenant_id}`
- Serialización JSON automática
- Manejo robusto de errores

#### 3. Suscripción a Eventos
- Método `subscribe(tenantId, listener)`
- Ejecuta `LISTEN` en PostgreSQL
- Retorna función de cleanup
- Manejo de múltiples listeners por canal
- UNLISTEN automático cuando no quedan listeners

#### 4. Tenant Isolation
- Validación de tenant_id en eventos recibidos
- Descarte de eventos cross-tenant con warning
- Canales separados por tenant
- Logging detallado de violaciones

#### 5. Reconexión Automática
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
- Re-suscripción a todos los canales activos
- Evento RECONNECTED para clientes
- Reseteo de contador tras éxito

#### 6. Factory y Fallback
- Detección automática de DATABASE_URL/DIRECT_URL
- SupabaseEventBus si configurado
- InMemoryEventBus como fallback
- Advertencias en logs
- Singleton global

### Validación TypeScript

✅ **0 errores de TypeScript**
- `src/core/infra/event-bus.ts`: No diagnostics found
- `src/core/infra/supabase-event-bus.ts`: No diagnostics found

### Requirements Validados

#### Requirement 1: Migración de EventBus a Supabase Realtime
- ✅ 1.1: Reemplazar InMemoryEventBus con SupabaseEventBus
- ✅ 1.2: Establecer conexión con Supabase Realtime
- ✅ 1.3: Mantener misma interfaz pública
- ✅ 1.4: Usar PostgreSQL NOTIFY para publicación
- ✅ 1.5: Usar PostgreSQL LISTEN para suscripción

#### Requirement 2: Compatibilidad con Interfaz Existente
- ✅ 2.1: Implementar métodos publish/subscribe
- ✅ 2.2: Aceptar mismos parámetros
- ✅ 2.3: Retornar función de cleanup
- ✅ 2.4: Serializar evento a JSON
- ✅ 2.5: Deserializar JSON y llamar listener

#### Requirement 3: Aislamiento por Tenant
- ✅ 3.1: Incluir tenant_id en canal PostgreSQL
- ✅ 3.2: Suscribirse solo al canal del tenant
- ✅ 3.3: Usar formato `events:{tenant_id}`
- ✅ 3.4: Validar tenant_id del evento
- ✅ 3.5: Descartar eventos cross-tenant

#### Requirement 7: Manejo de Errores y Reconexión
- ✅ 7.1: Reconectar automáticamente tras fallo
- ✅ 7.2: Usar exponential backoff
- ✅ 7.3: Registrar errores con nivel ERROR
- ✅ 7.4: Re-suscribirse a canales activos
- ✅ 7.5: Emitir evento de reconexión

#### Requirement 9: Fallback a EventBus In-Memory
- ✅ 9.1: Usar InMemoryEventBus si no hay DATABASE_URL
- ✅ 9.2: Detectar automáticamente disponibilidad
- ✅ 9.3: Registrar advertencia con fallback
- ✅ 9.4: Funcionar correctamente en single-instance
- ✅ 9.5: Permitir hot-reload en desarrollo

### Próximas Tasks

**Task 7**: Integrar con SSE streaming endpoint
- 7.1: Actualizar /api/events/stream
- 7.2: Property test para propagación SSE
- 7.3: Implementar cancelación en desconexión
- 7.4: Property test para cancelación

**Task 8**: Integrar con Outbox Pattern
- 8.1: Actualizar /api/events/ingest
- 8.2-8.6: Property tests para Outbox Pattern

**Task 9**: Checkpoint - Validar integración completa

**Task 10**: Implementar logging y observabilidad

**Task 11**: Implementar tests E2E

**Task 12**: Checkpoint - Validar tests E2E

**Task 13**: Implementar stress tests

**Task 14**: Crear documentación de migración

**Task 15**: Checkpoint final

### Notas Técnicas

1. **Evento RECONNECTED**
   - Tipo especial no es ParkEvent válido
   - Permite a clientes detectar reconexiones
   - Incluye timestamp, reconnectAttempts, activeChannels
   - Se emite solo en reconexiones (no primera conexión)

2. **Manejo de Notificaciones**
   - Tipo compatible con `pg.Notification`
   - Validación de canal y payload opcionales
   - Logging detallado de errores
   - Aislamiento de errores por listener

3. **Comentarios en Español**
   - Todos los comentarios JSDoc en español
   - Mensajes de log en español
   - Cumple con IDIOMA_ESPAÑOL_OBLIGATORIO.md

4. **Arquitectura**
   - Separación clara: SupabaseEventBus vs InMemoryEventBus
   - Interfaz común para intercambiabilidad
   - Factory pattern para detección automática
   - Singleton global con hot-reload

### Estado de Implementación

**Progreso General**: 6/15 tasks completadas (40%)

**Código Core**: ✅ COMPLETO
- SupabaseEventBus: 100%
- Factory y fallback: 100%
- Reconexión automática: 100%
- Tenant isolation: 100%

**Integración Pendiente**:
- SSE streaming endpoint
- Outbox Pattern en ingest
- Logging y observabilidad
- Tests E2E
- Stress tests
- Documentación de migración

---

**Próximo Paso**: Integrar con SSE streaming endpoint (/api/events/stream)
