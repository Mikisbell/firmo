# Reservations Domain Specification

**Domain:** reservations
**Last updated:** 2026-02-28
**Source change:** reservas-mesa

---

## Purpose

Especificacion del sistema de reservas de mesa para clientes (endpoint publico mobile-first) y gestion administrativa (panel admin con autenticacion). Cubre la API publica, la API admin, las validaciones de negocio y los eventos de auditoria.

---

## Requirements

### Requirement: Creacion de reserva por cliente

El sistema MUST permitir que un cliente cree una reserva a traves del endpoint publico `POST /api/reservations/[tenantSlug]` sin autenticacion.

La reserva MUST incluir: nombre del cliente, telefono, fecha, hora, cantidad de personas y opcionalmente pedidos especiales.

El sistema MUST generar un codigo de confirmacion unico de 6 caracteres alfanumericos por tenant + fecha.

El sistema MUST retornar HTTP 201 con el codigo de confirmacion al crear exitosamente.

El sistema MUST resolver el `tenant_id` a partir del `tenantSlug` — NUNCA aceptar `tenant_id` del cliente.

El sistema MUST almacenar la reserva con status `PENDING`.

El sistema MUST emitir un evento `RESERVATION_CREATED` al event store tras crear la reserva.

#### Scenario: Cliente crea reserva exitosamente (happy path)

- GIVEN un tenant con slug `polleria-don-pepe` que tiene mesas disponibles
- AND el horario del restaurante es 11:00 a 22:00
- WHEN el cliente envia POST `/api/reservations/polleria-don-pepe` con:
  - `customer_name`: "Maria Lopez"
  - `phone`: "987654321"
  - `date`: manana
  - `time`: "19:00"
  - `party_size`: 4
  - `special_requests`: "Mesa cerca de la ventana"
- THEN el sistema responde con HTTP 201
- AND el body contiene `confirmation_code` de 6 caracteres alfanumericos
- AND la reserva se almacena con status `PENDING`
- AND se emite un evento `RESERVATION_CREATED`

#### Scenario: Cliente crea reserva sin campos opcionales

- GIVEN un tenant valido con disponibilidad
- WHEN el cliente envia POST con solo los campos obligatorios (nombre, telefono, fecha, hora, party_size)
- THEN el sistema responde con HTTP 201
- AND `special_requests` se almacena como `null`

#### Scenario: Tenant slug no existe

- GIVEN un slug `restaurante-fantasma` que no corresponde a ningun tenant
- WHEN el cliente envia POST `/api/reservations/restaurante-fantasma`
- THEN el sistema responde con HTTP 404
- AND el body NO expone informacion interna del tenant

---

### Requirement: Validaciones de negocio para reservas

El sistema MUST rechazar reservas en horarios pasados.

El sistema MUST rechazar reservas con menos de 1 hora de anticipacion.

El sistema MUST rechazar reservas a mas de 30 dias en el futuro.

El sistema MUST rechazar reservas con `party_size` mayor a 20 personas.

El sistema MUST rechazar reservas con `party_size` menor a 1 persona.

El sistema MUST rechazar reservas fuera del horario del restaurante (configurable en tenant_settings).

El sistema MUST validar que el telefono tenga formato valido (9 digitos numericos para Peru).

El sistema MUST validar que `customer_name` no este vacio y tenga maximo 100 caracteres.

El sistema SHOULD sanitizar `special_requests` para prevenir XSS (strip HTML tags).

#### Scenario: Reserva en horario pasado

- GIVEN la fecha/hora actual es 2026-02-28 15:00
- WHEN el cliente intenta reservar para 2026-02-28 14:00
- THEN el sistema responde con HTTP 400
- AND el mensaje de error dice "No se puede reservar en un horario pasado"

#### Scenario: Reserva con menos de 1 hora de anticipacion

- GIVEN la fecha/hora actual es 2026-02-28 18:30
- WHEN el cliente intenta reservar para 2026-02-28 19:00
- THEN el sistema responde con HTTP 400
- AND el mensaje de error dice "La reserva debe hacerse con al menos 1 hora de anticipacion"

#### Scenario: Reserva a mas de 30 dias en el futuro

- GIVEN la fecha actual es 2026-02-28
- WHEN el cliente intenta reservar para 2026-04-15
- THEN el sistema responde con HTTP 400
- AND el mensaje de error dice "No se puede reservar con mas de 30 dias de anticipacion"

#### Scenario: Party size excede el maximo

- GIVEN un tenant valido
- WHEN el cliente envia una reserva con `party_size`: 25
- THEN el sistema responde con HTTP 400
- AND el mensaje de error dice "El maximo de personas por reserva es 20"

#### Scenario: Party size es cero o negativo

- GIVEN un tenant valido
- WHEN el cliente envia una reserva con `party_size`: 0
- THEN el sistema responde con HTTP 400
- AND el mensaje de error dice "La cantidad de personas debe ser al menos 1"

#### Scenario: Reserva fuera del horario del restaurante

- GIVEN un tenant cuyo horario es 11:00 a 22:00
- WHEN el cliente intenta reservar para las 08:00
- THEN el sistema responde con HTTP 400
- AND el mensaje de error dice "El restaurante no esta abierto en ese horario"

---

### Requirement: Disponibilidad de mesas

El sistema MUST calcular la disponibilidad de mesas cruzando la capacidad de cada mesa (`tables.capacity`) con reservas activas (status `PENDING` o `CONFIRMED`) para la fecha/hora solicitada.

El sistema MUST considerar una duracion de reserva de 90 minutos por defecto al calcular solapamiento.

El sistema MUST mostrar slots de horarios disponibles en intervalos de 30 minutos dentro del horario del restaurante.

El sistema MUST NOT permitir crear una reserva si no hay mesas con capacidad suficiente disponibles para el slot solicitado.

#### Scenario: Mesa no disponible (overbooking prevention)

- GIVEN un tenant con 2 mesas de capacidad >= 4
- AND ambas mesas tienen reservas activas (PENDING o CONFIRMED) de 19:00 a 20:30
- WHEN el cliente intenta reservar para 4 personas a las 19:30
- THEN el sistema responde con HTTP 409
- AND el mensaje de error dice "No hay mesas disponibles para ese horario"

#### Scenario: Mesa disponible por no solaparse

- GIVEN un tenant con 1 mesa de capacidad >= 4
- AND esa mesa tiene una reserva activa de 19:00 a 20:30
- WHEN el cliente intenta reservar para 4 personas a las 21:00
- THEN el sistema responde con HTTP 201
- AND la reserva se crea exitosamente

#### Scenario: Prevencion de overbooking por concurrencia

- GIVEN un tenant con exactamente 1 mesa de capacidad >= 2 disponible a las 20:00
- WHEN dos clientes envian una reserva para 2 personas a las 20:00 simultaneamente
- THEN exactamente una reserva se crea con HTTP 201
- AND la otra recibe HTTP 409 con "No hay mesas disponibles para ese horario"

---

### Requirement: Consulta de reserva por cliente

El sistema MUST permitir que un cliente consulte el estado de su reserva via `GET /api/reservations/[tenantSlug]/[confirmationCode]`.

La respuesta MUST incluir: status, fecha, hora, cantidad de personas, nombre del restaurante.

La respuesta MUST NOT incluir: `tenant_id`, `table_id`, datos internos del restaurante, ni datos de otras reservas.

#### Scenario: Cliente consulta reserva existente

- GIVEN una reserva con codigo `R4K7M2` en el tenant `polleria-don-pepe`
- WHEN el cliente envia GET `/api/reservations/polleria-don-pepe/R4K7M2`
- THEN el sistema responde con HTTP 200
- AND el body contiene status, fecha, hora, party_size y nombre del restaurante
- AND el body NO contiene tenant_id ni table_id

#### Scenario: Codigo de confirmacion no existe

- GIVEN no existe una reserva con codigo `XXXXXX` en el tenant `polleria-don-pepe`
- WHEN el cliente envia GET `/api/reservations/polleria-don-pepe/XXXXXX`
- THEN el sistema responde con HTTP 404

---

### Requirement: Cancelacion de reserva por cliente

El sistema MUST permitir que un cliente cancele su reserva via `PATCH /api/reservations/[tenantSlug]/[confirmationCode]/cancel`.

El sistema MUST cambiar el status de la reserva a `CANCELLED`.

El sistema MUST emitir un evento `RESERVATION_CANCELLED`.

El sistema MUST NOT permitir cancelar una reserva que ya fue `SEATED`, `ARRIVED`, `NO_SHOW` o `CANCELLED`.

#### Scenario: Cliente cancela reserva pendiente

- GIVEN una reserva con status `PENDING` y codigo `R4K7M2`
- WHEN el cliente envia PATCH `.../R4K7M2/cancel`
- THEN el sistema responde con HTTP 200
- AND el status cambia a `CANCELLED`
- AND se emite un evento `RESERVATION_CANCELLED`

#### Scenario: Cliente intenta cancelar reserva ya completada

- GIVEN una reserva con status `SEATED` y codigo `R4K7M2`
- WHEN el cliente envia PATCH `.../R4K7M2/cancel`
- THEN el sistema responde con HTTP 409
- AND el mensaje de error dice "No se puede cancelar una reserva en estado SEATED"

---

### Requirement: Gestion admin de reservas — Listado

El sistema MUST proporcionar `GET /api/admin/reservations` protegido con `requireAdminAuth`.

El endpoint MUST soportar filtro por `date` (default: hoy), `status`, y `zone`.

El sistema MUST retornar las reservas ordenadas por hora ascendente.

El endpoint MUST incluir totales: total reservas, confirmadas, pendientes, no-shows del dia.

El sistema MUST limitar la respuesta al `tenant_id` del admin autenticado (nunca cross-tenant).

#### Scenario: Admin consulta reservas del dia

- GIVEN un admin autenticado del tenant `polleria-don-pepe`
- AND existen 5 reservas para hoy: 2 PENDING, 2 CONFIRMED, 1 CANCELLED
- WHEN el admin envia GET `/api/admin/reservations?date=2026-02-28`
- THEN el sistema responde con HTTP 200
- AND el body contiene las 5 reservas ordenadas por hora
- AND el body contiene totales: `{ total: 5, confirmed: 2, pending: 2, cancelled: 1, no_show: 0 }`

#### Scenario: Admin sin autenticacion

- GIVEN una peticion sin cookie de sesion valida
- WHEN se envia GET `/api/admin/reservations`
- THEN el sistema responde con HTTP 401

#### Scenario: Admin filtra por zona

- GIVEN reservas en zonas "Salon Principal" y "Terraza"
- WHEN el admin envia GET `/api/admin/reservations?date=2026-02-28&zone=Terraza`
- THEN el sistema retorna solo las reservas de la zona "Terraza"

---

### Requirement: Gestion admin de reservas — Acciones

El sistema MUST proporcionar `PATCH /api/admin/reservations/[id]` protegido con `requireAdminAuth`.

El sistema MUST soportar las siguientes transiciones de estado:
- `PENDING` -> `CONFIRMED` (confirmar)
- `PENDING` -> `REJECTED` (rechazar)
- `CONFIRMED` -> `ARRIVED` (marcar llegada)
- `ARRIVED` -> `SEATED` (sentar en mesa)
- `CONFIRMED` -> `NO_SHOW` (no se presento)
- Cualquier estado activo -> `CANCELLED` (cancelar desde admin)

El sistema MUST NOT permitir transiciones invalidas (ej: `CANCELLED` -> `CONFIRMED`).

El sistema MUST emitir el evento correspondiente para cada transicion (`RESERVATION_CONFIRMED`, `RESERVATION_ARRIVED`, `RESERVATION_SEATED`, `RESERVATION_NO_SHOW`, `RESERVATION_CANCELLED`).

El admin MAY asignar una mesa (`table_id`) al confirmar la reserva.

#### Scenario: Admin confirma reserva pendiente

- GIVEN una reserva con status `PENDING` y id `uuid-123`
- AND un admin autenticado
- WHEN el admin envia PATCH `/api/admin/reservations/uuid-123` con `{ "action": "confirm" }`
- THEN el sistema responde con HTTP 200
- AND el status cambia a `CONFIRMED`
- AND se emite un evento `RESERVATION_CONFIRMED`

#### Scenario: Admin marca no-show

- GIVEN una reserva con status `CONFIRMED` y id `uuid-456`
- AND la hora de la reserva ya paso
- WHEN el admin envia PATCH `/api/admin/reservations/uuid-456` con `{ "action": "no_show" }`
- THEN el sistema responde con HTTP 200
- AND el status cambia a `NO_SHOW`
- AND se emite un evento `RESERVATION_NO_SHOW`

#### Scenario: Transicion de estado invalida

- GIVEN una reserva con status `CANCELLED`
- WHEN el admin envia PATCH con `{ "action": "confirm" }`
- THEN el sistema responde con HTTP 409
- AND el mensaje de error dice "No se puede confirmar una reserva en estado CANCELLED"

#### Scenario: Admin asigna mesa al confirmar

- GIVEN una reserva PENDING para 4 personas
- AND existe una mesa con id `table-1` de capacidad 6
- WHEN el admin envia PATCH con `{ "action": "confirm", "table_id": "table-1" }`
- THEN el sistema responde con HTTP 200
- AND la reserva se actualiza con `table_id`: "table-1"
- AND el status cambia a `CONFIRMED`

---

### Requirement: Rate limiting para endpoint publico

El sistema MUST aplicar rate limiting al endpoint publico `POST /api/reservations/[tenantSlug]`.

El limite MUST ser maximo 3 peticiones por minuto por IP.

El sistema MUST retornar HTTP 429 cuando se excede el limite.

El rate limiting SHOULD aplicarse tambien a GET y PATCH del endpoint publico con un limite mayor (10 req/min).

El rate limiting MUST NOT aplicarse a los endpoints admin (ya protegidos por auth).

#### Scenario: Rate limiting en creacion de reserva

- GIVEN un cliente con IP 192.168.1.100
- AND el cliente ya envio 3 peticiones POST en el ultimo minuto
- WHEN el cliente envia una 4ta peticion POST
- THEN el sistema responde con HTTP 429
- AND el mensaje dice "Demasiadas peticiones. Intente de nuevo en un momento"

#### Scenario: Rate limiting no bloquea peticiones normales

- GIVEN un cliente con IP 192.168.1.100
- AND el cliente no ha enviado peticiones en el ultimo minuto
- WHEN el cliente envia POST para crear una reserva
- THEN el sistema procesa la peticion normalmente (no HTTP 429)

---

### Requirement: Eventos de reserva en event store

El sistema MUST emitir los siguientes tipos de evento al event store:
- `RESERVATION_CREATED` — al crear una reserva
- `RESERVATION_CONFIRMED` — al confirmar (admin)
- `RESERVATION_CANCELLED` — al cancelar (cliente o admin)
- `RESERVATION_ARRIVED` — al marcar llegada (admin)
- `RESERVATION_SEATED` — al sentar en mesa (admin)
- `RESERVATION_NO_SHOW` — al marcar no-show (admin)

Los eventos MUST seguir la estructura del discriminated union existente en `src/core/domain/events.ts`.

Los eventos MUST incluir: `reservation_id`, `tenant_id`, `timestamp`, y datos relevantes del cambio.

Los eventos son de auditoria — el state-of-record es la tabla `reservations`, NO la proyeccion de eventos.

#### Scenario: Evento emitido al crear reserva

- GIVEN un cliente crea una reserva exitosamente
- WHEN la reserva se almacena en la base de datos
- THEN se emite un evento `RESERVATION_CREATED` con `reservation_id`, `tenant_id`, `customer_name`, `date`, `time`, `party_size`

---

### Requirement: Codigo de confirmacion

El sistema MUST generar un codigo de confirmacion de 6 caracteres alfanumericos (A-Z, 0-9) para cada reserva.

El codigo MUST ser unico por combinacion de `tenant_id` + `date`.

El sistema MUST utilizar un indice unico en la base de datos (`reservations_tenant_date_code_idx`) para garantizar unicidad.

El sistema SHOULD reintentar la generacion si hay colision (maximo 3 reintentos).

El codigo MUST NOT contener caracteres ambiguos que puedan confundir al cliente (el sistema MAY excluir 0/O, 1/I/L).

#### Scenario: Generacion de codigo unico

- GIVEN un tenant con 50 reservas para la misma fecha
- WHEN se crea una nueva reserva
- THEN el codigo de confirmacion generado es unico entre todas las reservas de ese tenant + fecha

#### Scenario: Colision de codigo con reintento

- GIVEN un codigo generado ya existe para ese tenant + fecha
- WHEN el sistema detecta la colision (unique constraint violation)
- THEN regenera un nuevo codigo y reintenta la insercion
- AND se acepta la reserva si el reintento es exitoso (maximo 3 intentos)

---

### Requirement: UI publica mobile-first

El sistema MUST proveer una pagina en `/reservar/[tenantSlug]` accesible sin autenticacion.

La pagina MUST incluir un formulario con: nombre, telefono, fecha, hora (selector de slots disponibles), cantidad de personas, y notas especiales (opcional).

La pagina MUST mostrar el nombre del restaurante obtenido del tenant.

La pagina MUST ser responsive y optimizada para dispositivos moviles.

La pagina MUST mostrar una pantalla de confirmacion con el codigo de reserva tras crearla exitosamente.

La pagina SHOULD permitir consultar el estado de una reserva existente ingresando el codigo de confirmacion.

La pagina MUST NOT exponer datos internos del tenant.

#### Scenario: Cliente completa flujo de reserva en UI

- GIVEN el cliente accede a `/reservar/polleria-don-pepe` desde su celular
- WHEN completa el formulario con datos validos y presiona "Reservar"
- THEN ve una pantalla de confirmacion con el codigo de reserva
- AND el mensaje dice "Tu reserva ha sido registrada. Codigo: XXXXXX"

#### Scenario: Slug de tenant invalido en UI

- GIVEN el cliente accede a `/reservar/no-existe`
- WHEN la pagina intenta cargar datos del tenant
- THEN muestra un mensaje "Restaurante no encontrado"

---

### Requirement: Pagina admin de reservas

El sistema MUST proveer una pagina en `/admin/reservas` protegida por autenticacion admin.

La pagina MUST mostrar las reservas del dia en formato lista o timeline.

La pagina MUST incluir filtros por: status, zona, hora.

La pagina MUST mostrar indicadores: total reservas, confirmadas, pendientes, no-shows.

La pagina MUST permitir acciones rapidas (confirmar, rechazar, marcar llegada, no-show) con un click.

El enlace "Reservas" MUST aparecer en el AdminSidebar.

#### Scenario: Admin gestiona reservas del dia

- GIVEN un admin autenticado accede a `/admin/reservas`
- AND hay 8 reservas para hoy
- WHEN la pagina carga
- THEN muestra las 8 reservas con sus datos (nombre, hora, personas, status)
- AND muestra indicadores en la parte superior
- AND cada reserva tiene botones de accion segun su estado actual

---

### Requirement: Migracion de base de datos

El sistema MUST agregar la columna `confirmation_code` (VARCHAR 10, nullable) a la tabla `reservations`.

El sistema MUST crear un indice unico compuesto en `(tenant_id, date, confirmation_code)`.

La migracion MUST usar `IF NOT EXISTS` para ser idempotente.

#### Scenario: Migracion idempotente

- GIVEN la columna `confirmation_code` ya existe en la tabla
- WHEN se ejecuta la migracion nuevamente
- THEN no falla y no duplica la columna

---

## Summary

| Domain | Type | Requirements | Scenarios |
|--------|------|-------------|-----------|
| reservations (public API) | Active | 4 (creation, query, cancel, rate limit) | 12 |
| reservations (admin API) | Active | 2 (listing, actions) | 7 |
| reservations (business rules) | Active | 3 (validation, availability, confirmation code) | 10 |
| reservations (events) | Active | 1 (event store) | 1 |
| reservations (UI) | Active | 2 (public page, admin page) | 4 |
| reservations (DB) | Active | 1 (migration) | 1 |
| **Total** | | **13 requirements** | **35 scenarios** |

---

## Change History

| Date | Change | Description |
|------|--------|-------------|
| 2026-02-28 | reservas-mesa | Initial creation: 13 requirements, 35 scenarios. Full reservation system (public API, admin API, business rules, events, UI, DB migration). |
