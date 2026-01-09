# Requirements Document

## Introduction

Este módulo implementa funcionalidades premium para PARK POS: un dashboard de analytics en tiempo real para el dueño/administrador y notificaciones push para mozos cuando sus pedidos están listos. Estas features diferencian PARK POS de la competencia y agregan valor significativo al negocio.

## Glossary

- **Dashboard**: Panel de control con métricas del negocio en tiempo real
- **Analytics_Service**: Servicio que calcula métricas desde eventos
- **Push_Notification**: Notificación enviada al dispositivo del mozo vía Web Push API
- **Notification_Service**: Servicio que gestiona suscripciones y envío de notificaciones
- **KPI**: Key Performance Indicator - métrica clave del negocio
- **Ticket_Promedio**: Venta promedio por orden (total_cents / orders_count)
- **Rotacion_Mesas**: Número de veces que una mesa se ocupa en un período
- **Tiempo_Servicio**: Tiempo desde ORDER_CREATED hasta CHECK_MARKED_PAID

## Requirements

### Requirement 1: Dashboard de Métricas en Tiempo Real

**User Story:** Como dueño/administrador, quiero ver métricas del negocio en tiempo real, para tomar decisiones informadas durante el turno.

#### Acceptance Criteria

1. WHEN el administrador accede a `/admin/dashboard`, THE Dashboard SHALL mostrar las métricas del turno actual
2. WHEN se completa una venta, THE Analytics_Service SHALL actualizar las métricas en menos de 5 segundos
3. THE Dashboard SHALL mostrar: ventas totales, número de órdenes, ticket promedio, y ventas por método de pago
4. THE Dashboard SHALL mostrar: mesas ocupadas, mesas libres, y rotación de mesas del turno
5. THE Dashboard SHALL mostrar: tiempo promedio de servicio y órdenes por hora
6. WHEN el usuario selecciona un rango de fechas, THE Dashboard SHALL filtrar las métricas por ese período
7. THE Dashboard SHALL mostrar gráficos de ventas por hora del día actual
8. IF no hay turno abierto, THEN THE Dashboard SHALL mostrar métricas del último turno cerrado

### Requirement 2: Comparativas y Tendencias

**User Story:** Como dueño, quiero comparar el rendimiento actual con días anteriores, para identificar tendencias.

#### Acceptance Criteria

1. THE Dashboard SHALL mostrar comparativa con el mismo día de la semana anterior
2. THE Dashboard SHALL indicar con colores si las métricas están mejor (verde) o peor (rojo) que la comparativa
3. WHEN las ventas actuales superan el día anterior, THE Dashboard SHALL mostrar un indicador positivo con porcentaje
4. THE Dashboard SHALL mostrar los 5 productos más vendidos del turno

### Requirement 3: Métricas por Estación (KDS)

**User Story:** Como administrador, quiero ver el rendimiento de cada estación de cocina, para identificar cuellos de botella.

#### Acceptance Criteria

1. THE Dashboard SHALL mostrar tiempo promedio de preparación por estación (COCINA, HORNO, BAR)
2. THE Dashboard SHALL mostrar número de items pendientes por estación
3. WHEN una estación tiene más de 10 items pendientes, THE Dashboard SHALL mostrar alerta visual
4. THE Dashboard SHALL mostrar el item que más tiempo lleva en preparación

### Requirement 4: Suscripción a Notificaciones Push

**User Story:** Como mozo, quiero suscribirme a notificaciones push, para recibir alertas cuando mis pedidos estén listos.

#### Acceptance Criteria

1. WHEN el mozo accede a `/mozo`, THE System SHALL solicitar permiso para notificaciones push
2. WHEN el mozo acepta, THE Notification_Service SHALL registrar la suscripción asociada al actor_id
3. THE System SHALL almacenar la suscripción en el servidor para envío posterior
4. IF el mozo rechaza, THEN THE System SHALL mostrar un banner recordando que puede activarlas después
5. WHEN el mozo cambia de dispositivo, THE System SHALL permitir registrar múltiples suscripciones

### Requirement 5: Envío de Notificaciones de Items Listos

**User Story:** Como mozo, quiero recibir una notificación cuando un item de mi pedido está listo, para recogerlo inmediatamente.

#### Acceptance Criteria

1. WHEN un item cambia a status READY, THE Notification_Service SHALL enviar push al mozo que creó la orden
2. THE Notification SHALL incluir: número de mesa, nombre del item, y estación donde recoger
3. WHEN múltiples items están listos, THE Notification_Service SHALL agrupar en una sola notificación
4. THE Notification SHALL mostrar acción para abrir la mesa directamente
5. IF el mozo no tiene suscripción activa, THEN THE System SHALL NO enviar notificación (fail silently)

### Requirement 6: Notificaciones de Solicitud de Cuenta

**User Story:** Como cajero, quiero recibir notificación cuando una mesa solicita la cuenta, para atenderla rápidamente.

#### Acceptance Criteria

1. WHEN se emite evento REQUEST_CHECK, THE Notification_Service SHALL notificar a terminales con rol CASHIER
2. THE Notification SHALL incluir: número de mesa, total de la cuenta, y nombre del mozo
3. THE Notification SHALL mostrar acción para abrir la orden en caja

### Requirement 7: Gestión de Suscripciones

**User Story:** Como administrador, quiero ver qué empleados tienen notificaciones activas, para asegurar cobertura.

#### Acceptance Criteria

1. THE Admin_Panel SHALL mostrar lista de empleados con estado de suscripción (activa/inactiva)
2. WHEN un empleado no ha activado notificaciones en 7 días, THE System SHALL mostrar advertencia
3. THE System SHALL permitir al administrador enviar notificación de prueba a un empleado

### Requirement 8: Offline y Reconexión

**User Story:** Como mozo, quiero que las notificaciones funcionen incluso si la app está en segundo plano.

#### Acceptance Criteria

1. THE Service_Worker SHALL recibir notificaciones push cuando la app está en segundo plano
2. WHEN el mozo hace click en la notificación, THE System SHALL abrir la app en la mesa correspondiente
3. THE System SHALL mostrar badge con número de notificaciones no leídas
4. WHEN el dispositivo reconecta después de estar offline, THE System SHALL sincronizar notificaciones pendientes

### Requirement 9: Configuración de Notificaciones

**User Story:** Como mozo, quiero configurar qué notificaciones recibir, para no ser interrumpido innecesariamente.

#### Acceptance Criteria

1. THE System SHALL permitir al mozo activar/desactivar notificaciones de items listos
2. THE System SHALL permitir al mozo activar/desactivar sonido de notificaciones
3. THE System SHALL respetar el modo "No molestar" del dispositivo
4. WHEN el mozo está en modo offline, THE System SHALL almacenar preferencias localmente

### Requirement 10: API de Métricas

**User Story:** Como desarrollador, quiero una API para obtener métricas, para integrar con sistemas externos.

#### Acceptance Criteria

1. THE API `/api/admin/analytics/realtime` SHALL retornar métricas del turno actual
2. THE API `/api/admin/analytics/history` SHALL retornar métricas históricas con filtros de fecha
3. THE API SHALL requerir autenticación con rol ADMIN o OWNER
4. THE API SHALL responder en menos de 200ms para métricas en tiempo real
5. THE API SHALL soportar formato JSON con estructura consistente
