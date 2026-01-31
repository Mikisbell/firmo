# Requirements Document

## Introduction

Este documento define los requisitos para elevar PARK POS de un MVP funcional a una aplicación enterprise de clase mundial. El enfoque está en completar los gaps identificados en AUDITORIA_CRITICA.md y GAPS.md, sin duplicar funcionalidad ya implementada.

**Ya implementado (no incluido en este spec) - verificado en MASTER.md:**
- Event Deduplication (processed_events) ✅
- Outbox Pattern (event_outbox + worker) ✅
- Order Number Ranges (terminal_number_ranges) ✅
- Server Validation (validateEvent) ✅
- Circuit Breaker (circuit-breaker.ts) ✅
- Rate Limiting básico (rate-limit.ts) ✅
- Performance Indices ✅
- Timezone Handling (business-date.ts) ✅
- Límites de Seguridad (limits.ts) ✅

**Gaps críticos a resolver (P1 según MASTER.md):**
- Clock Skew (timestamps desincronizados) - Gap #1 de GAPS.md
- Reducer muta estado directamente - Problema #5 de AUDITORIA_CRITICA.md
- tenant_id hardcodeado en `src/core/sync/client.ts:91` como `"00000000-0000-0000-0000-000000000001"`
- API secret hardcodeado en `src/core/sync/client.ts:175` como `"park_secret_mvp_2025"`
- Sin snapshots/compaction - Mejora #8 de MEJORAS.md
- Sin observabilidad integrada - Mejora #7 de MEJORAS.md
- Sin UI de resolución de conflictos - Gap #9 de GAPS.md
- Event Schema Versioning - Mejora #2 de MEJORAS.md

**Inconsistencias detectadas en documentación:**
- KDS Estaciones: MASTER.md dice 3 (Horno/Parrilla, Cocina, Bar), FLUJO_KDS.md dice 5 (PARRILLA, FREIDORA, COCINA_FRÍA, BAR, EXPEDICIÓN)
- tenant_id canónico debe ser: `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (unificar en todo el código)

## Glossary

- **Terminal**: Dispositivo físico (tablet/PC) que ejecuta la aplicación POS. Formatos: `CAJA_01`, `MOZO_01`, `KDS_COCINA`
- **Tenant**: Organización/negocio que usa el sistema. ID canónico: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **Event_Sourcing**: Patrón arquitectónico donde el estado se deriva de una secuencia de eventos
- **Device_Token**: Token de larga duración vinculado a fingerprint del dispositivo (extiende auth existente)
- **Clock_Skew**: Diferencia entre relojes de terminales y servidor
- **Reducer**: Función pura que transforma estado basado en eventos (NO debe mutar estado)
- **Adaptive_Snapshot**: Snapshot basado en tamaño de estado (>50KB) o cantidad de eventos (>500)
- **SSE**: Server-Sent Events para comunicación en tiempo real
- **Optimistic_Locking**: Patrón de concurrencia usando campo revision
- **KDS_Stations**: 3 estaciones principales según MASTER.md: Horno/Parrilla, Cocina, Bar

## Requirements

### Requirement 1: Manejo de Clock Skew (CRÍTICO - Gap #1 de GAPS.md)

**User Story:** Como sistema, quiero manejar diferencias de reloj entre terminales, para que el ordenamiento de eventos sea correcto incluso con relojes desincronizados.

#### Acceptance Criteria

1. WHEN un terminal envía evento, THE Ingest_API SHALL asignar `occurred_at_server` con timestamp del servidor
2. THE Event_Schema SHALL preservar `occurred_at_client` original del terminal
3. THE Projection_System SHALL usar `occurred_at_server` para ordenamiento cuando disponible
4. IF la diferencia entre `occurred_at_client` y `occurred_at_server` excede 5 minutos, THEN THE System SHALL registrar warning en logs
5. THE Rebuild_System SHALL usar `occurred_at_server` como fuente de verdad para orden temporal

### Requirement 2: Autenticación por Device Token (Extender auth existente)

**User Story:** Como administrador del sistema, quiero reemplazar el API secret hardcodeado con tokens de dispositivo seguros, para eliminar la vulnerabilidad de seguridad actual.

**Ubicación del problema:** `src/core/sync/client.ts` línea 175:
```typescript
"x-api-secret": "park_secret_mvp_2025" // ❌ Hardcodeado
```

#### Acceptance Criteria

1. WHEN un terminal completa el setup inicial, THE Auth_System SHALL generar un Device_Token de 256 bits vinculado al device_fingerprint existente
2. THE Device_Token SHALL reemplazar el header `x-api-secret: park_secret_mvp_2025` actual en `client.ts:175`
3. WHEN el terminal envía eventos al servidor, THE Ingest_API SHALL validar Device_Token + terminal_id + tenant_id
4. IF el Device_Token es inválido, THEN THE Ingest_API SHALL retornar 401 con código DEVICE_TOKEN_INVALID
5. THE Device_Token SHALL almacenarse encriptado en IndexedDB usando Web Crypto API
6. THE Auth_System SHALL integrar con el flujo de registro de terminal existente (`register-terminal/route.ts`)

### Requirement 3: Tenant ID Dinámico (Eliminar hardcode)

**User Story:** Como desarrollador, quiero que el tenant_id se obtenga de la sesión autenticada, para eliminar el valor hardcodeado en client.ts.

**Ubicación del problema:** `src/core/sync/client.ts` línea 91:
```typescript
const tenantId = "00000000-0000-0000-0000-000000000001"; // ❌ Hardcodeado
```

#### Acceptance Criteria

1. THE Sync_Client SHALL obtener tenant_id del TerminalConfig almacenado en IndexedDB
2. THE Sync_Client SHALL eliminar la línea hardcodeada en `client.ts:91`
3. THE tenant_id canónico para desarrollo/seed SHALL ser: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
4. WHEN se establece conexión SSE, THE Stream_API SHALL filtrar eventos por tenant_id del Device_Token
5. THE Auth_Context SHALL proveer tenant_id, terminal_id y role via React Context existente
6. IF no existe TerminalConfig válido, THEN THE Application SHALL mostrar pantalla de setup

### Requirement 4: Reducer Inmutable (Problema #5 de AUDITORIA_CRITICA.md)

**User Story:** Como desarrollador, quiero que los reducers no muten el estado directamente, para evitar bugs de React y habilitar time-travel debugging.

#### Acceptance Criteria

1. THE Sale_Reducer SHALL retornar nuevo objeto usando spread operator en cada caso
2. FOR ALL eventos aplicados, THE Sale_Reducer SHALL crear copia profunda de arrays y objetos anidados
3. THE Sale_Reducer SHALL eliminar mutaciones directas como `sale.lines[line_id] = {...}`
4. THE Sale_Reducer SHALL usar Object.freeze() en modo desarrollo para detectar mutaciones accidentales
5. THE Shift_Reducer SHALL seguir el mismo patrón de inmutabilidad
6. FOR ALL reducers, serializar y deserializar el estado SHALL producir objeto equivalente (round-trip)

### Requirement 5: Resolución de Conflictos con Optimistic Locking (Gap #9 de GAPS.md)

**User Story:** Como usuario de terminal, quiero que el sistema detecte y resuelva conflictos cuando múltiples terminales editan la misma orden offline.

#### Acceptance Criteria

1. THE Order_Model SHALL incluir campo `revision` que incrementa con cada cambio
2. WHEN un terminal envía evento de modificación, THE Event_Payload SHALL incluir `expected_revision`
3. IF `expected_revision` no coincide con `revision` actual, THEN THE Ingest_API SHALL retornar error REVISION_CONFLICT
4. WHEN se detecta conflicto, THE System SHALL retornar ambas versiones (local y servidor) al cliente
5. THE UI SHALL mostrar diálogo de resolución con opciones: "Usar mi versión", "Usar versión servidor", "Combinar"
6. FOR ALL resoluciones, THE System SHALL generar evento CONFLICT_RESOLVED para auditoría

### Requirement 6: Snapshots Adaptativos (Mejora #8 de MEJORAS.md)

**User Story:** Como usuario, quiero que la aplicación cargue instantáneamente sin importar cuánto tiempo lleve usándola.

#### Acceptance Criteria

1. THE Snapshot_System SHALL crear snapshot WHEN state_size > 50KB OR events_since_snapshot > 500
2. THE Snapshot_System SHALL crear snapshot automático al cerrar orden (CONFIRMED/CANCELLED)
3. WHEN se reconstruye proyección, THE Rebuild_System SHALL cargar snapshot + eventos posteriores
4. THE Rebuild_System SHALL completar en menos de 500ms para órdenes típicas (< 50 items)
5. THE Cleanup_Worker SHALL eliminar eventos de órdenes cerradas mayores a 30 días (alineado con cleanup existente)
6. THE Cleanup_Worker SHALL preservar snapshots de órdenes cerradas por 90 días

### Requirement 7: Event Schema Versioning (Mejora #2 de MEJORAS.md)

**User Story:** Como desarrollador, quiero evolucionar el schema de eventos sin romper datos históricos.

#### Acceptance Criteria

1. THE Event_Schema SHALL incluir campo schema_version (default: 1) en cada evento
2. WHEN se procesa evento con versión < actual, THE Event_Migrator SHALL transformarlo automáticamente
3. THE Event_Migrator SHALL soportar migración incremental (v1→v2→v3→...→vN)
4. FOR ALL eventos migrados, THE System SHALL preservar payload original en _original_payload
5. THE Migration_System SHALL ser idempotente (aplicar migración múltiples veces = mismo resultado)

### Requirement 8: Observabilidad Integrada (Mejora #7 de MEJORAS.md)

**User Story:** Como administrador, quiero ver métricas del sistema sin configurar servidores adicionales.

#### Acceptance Criteria

1. THE Metrics_System SHALL almacenar métricas en tabla PostgreSQL `system_metrics`
2. THE Metrics_System SHALL trackear: sync_latency_p95, sync_errors_count, backlog_size, active_terminals
3. THE Admin_Dashboard SHALL mostrar métricas en tiempo real usando SSE existente
4. WHEN backlog_size > 500 por más de 5 minutos, THE System SHALL mostrar alerta en dashboard
5. THE System SHALL exponer endpoint /api/health con status de DB, sync y terminales
6. THE Logging_System SHALL agregar contexto de terminal_id y order_id a errores existentes

### Requirement 9: Notificaciones Push para KDS

**User Story:** Como cocinero en KDS, quiero recibir notificación sonora cuando llega un pedido nuevo.

#### Acceptance Criteria

1. WHEN se crea nuevo pedido, THE Notification_System SHALL reproducir sonido en terminales KDS relevantes
2. WHEN un pedido lleva más de 10 minutos sin preparar, THE System SHALL mostrar alerta visual parpadeante
3. THE PWA SHALL usar Web Audio API para sonidos (no requiere permisos de notificación)
4. THE User SHALL poder configurar volumen y tipo de sonido por terminal
5. THE KDS_Screen SHALL mostrar contador de pedidos pendientes en título de pestaña

### Requirement 10: Dashboard Admin en Tiempo Real

**User Story:** Como gerente, quiero ver ventas y estado de terminales en tiempo real.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL mostrar: ventas del día (centavos), ticket promedio, pedidos por hora
2. THE Admin_Dashboard SHALL mostrar estado de cada terminal: online/offline, último sync, backlog
3. THE Admin_Dashboard SHALL actualizar automáticamente via SSE (sin polling)
4. THE Admin_Dashboard SHALL ser responsive y funcionar en móvil
5. WHEN se hace click en terminal, THE Dashboard SHALL mostrar últimos 10 eventos del terminal
