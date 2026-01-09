# Requirements Document: Conflict Resolution

## Introduction

Este documento define los requisitos para implementar resolución de conflictos en PARK POS. El sistema tiene 15 terminales de meseros + 1 caja + pantallas KDS que pueden editar órdenes simultáneamente mientras están offline. Cuando sincronizan, pueden ocurrir conflictos que deben detectarse y resolverse de forma determinista.

**Escenario crítico:**
- Mesero A (offline): Agrega "Pollo" a orden #123
- Mesero B (offline): Agrega "Papas" a orden #123  
- Ambos sincronizan → Sin estrategia definida = uno sobrescribe al otro

## Glossary

- **Conflict**: Situación donde dos terminales modifican el mismo agregado mientras están offline
- **Revision**: Número de versión de un agregado que incrementa con cada cambio
- **Optimistic_Locking**: Estrategia donde el cliente envía la revisión esperada y el servidor rechaza si no coincide
- **Last_Write_Wins**: Estrategia donde el evento más reciente (por timestamp) gana
- **Merge**: Estrategia donde se combinan los cambios de ambos terminales
- **Vector_Clock**: Estructura que rastrea versiones por terminal para detectar conflictos causales
- **Aggregate**: Entidad raíz en Event Sourcing (Order, Shift, etc.)

---

## Requirements

### Requirement 1: Detección de Conflictos

**User Story:** Como sistema, quiero detectar cuando dos terminales modificaron el mismo agregado mientras estaban offline, para poder aplicar una estrategia de resolución.

#### Acceptance Criteria

1. THE Order SHALL tener un campo `revision` que incrementa con cada evento aplicado
2. WHEN un evento es creado en el cliente, THE Event SHALL incluir `expected_revision` del agregado
3. WHEN el servidor recibe un evento, THE System SHALL comparar `expected_revision` con la revisión actual
4. IF `expected_revision` != `current_revision`, THEN THE System SHALL marcar el evento como conflictivo
5. THE System SHALL registrar conflictos en una tabla `conflict_log` para auditoría
6. WHEN un conflicto es detectado, THE System SHALL incluir información del conflicto en la respuesta de ingest

---

### Requirement 2: Estrategia de Resolución para Items de Orden

**User Story:** Como sistema, quiero que cuando dos meseros agreguen items a la misma orden offline, ambos items se conserven mediante merge automático.

#### Acceptance Criteria

1. WHEN dos eventos ORDER_ITEM_ADDED tienen conflicto de revisión, THE System SHALL aplicar merge automático
2. THE Merge SHALL agregar ambos items a la orden sin perder ninguno
3. IF los items tienen el mismo product_id y modifiers, THEN THE System SHALL sumar las cantidades
4. IF los items son diferentes, THEN THE System SHALL agregar ambos como líneas separadas
5. WHEN se aplica merge, THE System SHALL emitir un evento CONFLICT_RESOLVED con detalle del merge
6. THE System SHALL actualizar la revisión después del merge

---

### Requirement 3: Estrategia de Resolución para Cambios de Estado

**User Story:** Como sistema, quiero que los cambios de estado de items (PENDING→COOKING→READY→DONE) se resuelvan usando Last-Write-Wins basado en timestamp.

#### Acceptance Criteria

1. WHEN dos eventos ORDER_ITEM_STATUS_CHANGED tienen conflicto, THE System SHALL usar Last-Write-Wins
2. THE System SHALL comparar `occurred_at` de ambos eventos
3. THE Event con `occurred_at` más reciente SHALL prevalecer
4. IF los timestamps son idénticos, THE System SHALL usar `terminal_id` como desempate (orden alfabético)
5. WHEN se aplica LWW, THE System SHALL registrar el evento perdedor en `conflict_log`
6. THE System SHALL NO aplicar transiciones de estado inválidas (ej: DONE→PENDING)

---

### Requirement 4: Estrategia de Resolución para Pagos

**User Story:** Como sistema, quiero que los conflictos en pagos se rechacen y requieran intervención manual, porque involucran dinero.

#### Acceptance Criteria

1. WHEN dos eventos CHECK_PAYMENT_ADDED tienen conflicto, THE System SHALL rechazar el segundo
2. THE System SHALL retornar error `PAYMENT_CONFLICT` con código de severidad WARN
3. THE Response SHALL incluir el estado actual del check para que el cliente pueda reintentar
4. THE System SHALL NO aplicar pagos duplicados bajo ninguna circunstancia
5. WHEN un pago es rechazado por conflicto, THE System SHALL registrar en `conflict_log` con reason='PAYMENT_CONFLICT'

---

### Requirement 5: Notificación de Conflictos al Cliente

**User Story:** Como terminal, quiero recibir notificación cuando mis eventos fueron rechazados o modificados por conflicto, para poder actualizar mi estado local.

#### Acceptance Criteria

1. WHEN un evento es rechazado por conflicto, THE IngestResponse SHALL incluir el evento en `rejected[]`
2. THE Rejected entry SHALL incluir: event_id, error_code='REVISION_CONFLICT', current_revision, expected_revision
3. WHEN un evento es aceptado con merge, THE IngestResponse SHALL incluir el evento en `merged[]`
4. THE Merged entry SHALL incluir: event_id, merge_type, resulting_state
5. THE SyncClient SHALL manejar respuestas con conflictos y actualizar estado local
6. WHEN el cliente recibe REVISION_CONFLICT, THE Client SHALL refrescar el agregado desde el servidor

---

### Requirement 6: Refresh de Agregados

**User Story:** Como terminal, quiero poder solicitar el estado actual de un agregado después de un conflicto, para sincronizar mi estado local.

#### Acceptance Criteria

1. THE System SHALL exponer endpoint GET `/api/orders/{order_id}/state` que retorna el estado actual
2. THE Response SHALL incluir: order completa, revision actual, last_updated_at
3. WHEN el cliente recibe REVISION_CONFLICT, THE SyncClient SHALL llamar al endpoint de refresh
4. THE Client SHALL reemplazar su estado local con el estado del servidor
5. THE Client SHALL re-aplicar eventos locales pendientes sobre el nuevo estado
6. IF re-aplicar falla, THE Client SHALL descartar eventos locales y notificar al usuario

---

### Requirement 7: UI de Resolución Manual

**User Story:** Como cajero, quiero ver una notificación cuando hay conflictos que requieren mi atención, para poder resolverlos manualmente.

#### Acceptance Criteria

1. WHEN un conflicto de pago ocurre, THE UI SHALL mostrar un toast de advertencia
2. THE Toast SHALL incluir: orden afectada, tipo de conflicto, acción sugerida
3. THE UI SHALL proveer botón para ver detalles del conflicto
4. THE Conflict detail view SHALL mostrar: versión local vs servidor, timestamp de cada cambio
5. THE UI SHALL permitir elegir: "Usar mi versión", "Usar versión servidor", "Combinar"
6. WHEN el usuario resuelve manualmente, THE System SHALL emitir evento CONFLICT_MANUALLY_RESOLVED

---

### Requirement 8: Prevención de Conflictos

**User Story:** Como sistema, quiero minimizar la ocurrencia de conflictos mediante bloqueos optimistas en operaciones críticas.

#### Acceptance Criteria

1. WHEN un terminal abre una orden para editar, THE System SHALL registrar un "soft lock" con TTL de 30 segundos
2. THE Soft lock SHALL incluir: order_id, terminal_id, locked_at, expires_at
3. WHEN otro terminal intenta editar la misma orden, THE System SHALL advertir que está siendo editada
4. THE Warning SHALL incluir: terminal que tiene el lock, tiempo restante
5. THE Soft lock SHALL expirar automáticamente después del TTL
6. THE System SHALL NO bloquear operaciones, solo advertir (optimistic)

---

### Requirement 9: Eventos de Conflicto

**User Story:** Como sistema Event Sourcing, quiero tener eventos específicos para conflictos, para mantener trazabilidad completa.

#### Acceptance Criteria

1. THE System SHALL definir evento CONFLICT_DETECTED con payload: aggregate_id, aggregate_type, conflicting_events[], detected_at
2. THE System SHALL definir evento CONFLICT_AUTO_RESOLVED con payload: aggregate_id, resolution_strategy, winning_event_id, merged_state
3. THE System SHALL definir evento CONFLICT_MANUALLY_RESOLVED con payload: aggregate_id, resolved_by, chosen_version, discarded_events[]
4. THE System SHALL definir evento CONFLICT_REJECTED con payload: aggregate_id, rejected_event_id, reason, current_state
5. ALL conflict events SHALL ser almacenados en la tabla `events` como cualquier otro evento

---

### Requirement 10: Métricas de Conflictos

**User Story:** Como administrador, quiero ver métricas de conflictos para identificar patrones y optimizar el sistema.

#### Acceptance Criteria

1. THE System SHALL contar conflictos por tipo (REVISION_CONFLICT, PAYMENT_CONFLICT, etc.)
2. THE System SHALL contar conflictos por terminal para identificar terminales problemáticos
3. THE System SHALL contar conflictos por hora del día para identificar picos
4. THE System SHALL exponer métricas en formato Prometheus en `/api/metrics`
5. THE Dashboard SHALL mostrar: total conflictos hoy, tasa de conflictos, top terminales con conflictos

