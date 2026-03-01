# Proposal: reservas-mesa

**Estado:** DRAFT
**Fecha:** 2026-02-28
**Autor:** SDD Sub-Agent (propose phase)

---

## Intent

Permitir que los clientes reserven mesa desde su celular (interfaz publica mobile-first) y que el admin/manager vea y gestione las reservas del dia desde el panel de administracion.

El restaurante ya tiene el modelo `reservations` en la base de datos (con campos completos: customer_name, phone, date, time, party_size, table_id, status, deposit, special_requests, etc.) y el modelo `tables` con capacidad y zonas. No existen aun: API routes de reservas, UI publica de reservas, ni pagina admin de reservas.

---

## Scope

### In Scope

1. **API publica para clientes** — `POST /api/reservations/[tenantSlug]` (sin auth, rate-limited)
   - Crear reserva: nombre, telefono, fecha, hora, cantidad de personas, pedidos especiales
   - Consultar reserva por codigo de confirmacion: `GET /api/reservations/[tenantSlug]/[confirmationCode]`
   - Cancelar reserva: `PATCH /api/reservations/[tenantSlug]/[confirmationCode]/cancel`

2. **API admin para gestion** — `GET/PATCH /api/admin/reservations` (requireAdminAuth)
   - Listar reservas del dia (filtros: fecha, status, zona)
   - Confirmar/rechazar reserva (PENDING -> CONFIRMED / REJECTED)
   - Marcar llegada (CONFIRMED -> ARRIVED -> SEATED)
   - Marcar no-show (CONFIRMED -> NO_SHOW)
   - Cancelar reserva desde admin

3. **UI publica mobile-first** — `/reservar/[tenantSlug]`
   - Formulario: nombre, telefono, fecha, hora, personas, pedidos especiales
   - Selector de horarios disponibles (basado en capacidad de mesas)
   - Confirmacion con codigo unico
   - Consulta de estado de reserva

4. **Pagina admin** — `/admin/reservas`
   - Vista de reservas del dia (timeline o lista)
   - Filtros por status, zona, hora
   - Acciones rapidas: confirmar, rechazar, marcar llegada, no-show
   - Indicadores: total reservas, confirmadas, pendientes, no-shows

5. **Eventos** — Nuevos tipos de evento para event sourcing:
   - `RESERVATION_CREATED`, `RESERVATION_CONFIRMED`, `RESERVATION_CANCELLED`
   - `RESERVATION_ARRIVED`, `RESERVATION_SEATED`, `RESERVATION_NO_SHOW`

6. **Validaciones de negocio:**
   - No permitir reservas en horarios pasados
   - Validar capacidad disponible (party_size vs mesas libres)
   - Minimo 1 hora de anticipacion
   - Maximo 30 dias en el futuro
   - Maximo 20 personas por reserva
   - Horario del restaurante (configurable en tenant_settings)

### Out of Scope

- Depositos/pagos adelantados (campo existe en DB pero no se implementa aun)
- Notificaciones SMS/WhatsApp automaticas (se deja preparado el campo `confirmation_sent`)
- Waitlist / lista de espera (modelo existe pero es feature separado)
- Integracion con Google Maps / Google Reserve
- Asignacion automatica de mesa (se hace manual por admin/host)
- Merge de mesas para grupos grandes
- Reservas recurrentes (ej: "todos los viernes")

---

## Approach

### Estrategia: CRUD + Event Trail

Dado que las reservas son una entidad CRUD con ciclo de vida simple (no requieren el mismo nivel de event sourcing que las ordenes), el approach es:

1. **CRUD directo en Prisma** — Las reservas se crean/actualizan directamente en la tabla `reservations` (que ya existe)
2. **Event trail opcional** — Se emiten eventos `RESERVATION_*` al event store para auditoria y analytics, pero el state-of-record es la tabla `reservations` (no se reconstruye desde eventos)
3. **API publica sin auth** — El endpoint publico usa `tenantSlug` para resolver el tenant (patron existente en `/api/menu/[tenantSlug]`), con rate limiting por IP
4. **Disponibilidad calculada** — Se consultan mesas disponibles cruzando `tables.capacity` con `reservations` existentes para la fecha/hora solicitada

### Flujo Principal

```
Cliente (celular)                    Admin (panel)
     |                                    |
     |-- POST /api/reservations/slug ---> |
     |    (nombre, tel, fecha, hora,      |
     |     personas, notas)               |
     |                                    |
     |<-- 201 { confirmationCode } ----   |
     |                                    |-- GET /api/admin/reservations?date=today
     |                                    |<-- [lista de reservas]
     |                                    |
     |                                    |-- PATCH confirm/reject/arrive/seat/no-show
     |                                    |
     |-- GET /api/reservations/slug/code  |
     |<-- { status, detalles }            |
```

### Codigo de Confirmacion

- Formato: 6 caracteres alfanumericos (ej: `R4K7M2`)
- Se almacena como campo adicional en `reservations` (requiere ALTER TABLE)
- Unico por tenant + fecha (no globalmente unico)

### Disponibilidad

- Para cada slot de hora, contar mesas con capacidad >= party_size que NO tengan reserva activa (PENDING/CONFIRMED) que se solape
- Duration default: 90 min (ya existe en schema)
- Slots: cada 30 minutos dentro del horario del restaurante

---

## Affected Areas

### Nuevos archivos

| Archivo | Proposito |
|---------|-----------|
| `src/app/api/reservations/[tenantSlug]/route.ts` | API publica: crear reserva, listar horarios |
| `src/app/api/reservations/[tenantSlug]/[code]/route.ts` | API publica: consultar/cancelar reserva |
| `src/app/api/admin/reservations/route.ts` | API admin: listar reservas |
| `src/app/api/admin/reservations/[id]/route.ts` | API admin: acciones sobre reserva |
| `src/app/reservar/[tenantSlug]/page.tsx` | UI publica: formulario de reserva |
| `src/app/admin/reservas/page.tsx` | UI admin: gestion de reservas |
| `src/core/reservations/reservation.service.ts` | Logica de negocio: disponibilidad, validaciones |
| `src/core/reservations/reservation.schema.ts` | Schemas Zod para validacion |
| `src/core/reservations/__tests__/reservation.service.test.ts` | Tests unitarios del servicio |
| `src/core/reservations/__tests__/reservation.property.test.ts` | Property tests con fast-check |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Agregar campo `confirmation_code` a `reservations` |
| `src/core/domain/events.ts` | Agregar eventos RESERVATION_* al discriminated union |
| `src/app/admin/components/AdminSidebar.tsx` | Agregar enlace "Reservas" al menu |
| `src/core/validation/business-rules.ts` | Agregar reglas de validacion de reservas |

### DB Migration

```sql
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS confirmation_code VARCHAR(10);
CREATE UNIQUE INDEX IF NOT EXISTS reservations_tenant_date_code_idx
  ON reservations(tenant_id, date, confirmation_code);
```

---

## Risks

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| Spam de reservas falsas | Alta | Medio | Rate limiting por IP (3 req/min), validacion de telefono, captcha futuro |
| Overbooking (mas reservas que mesas) | Media | Alto | Validacion de capacidad en tiempo real, margin configurable |
| Reservas fantasma (no-shows) | Alta | Medio | Sistema de confirmacion, politica de no-show configurable |
| Performance en calculo de disponibilidad | Baja | Medio | Query optimizada con indices existentes, cache de 60s |
| Tenant slug no existe | Baja | Bajo | 404 limpio sin leak de informacion |
| Concurrencia (dos personas reservan ultima mesa) | Media | Alto | Transaccion Prisma con check-and-create atomico |

---

## Rollback Plan

1. **Rollback de codigo:** Revertir los archivos nuevos (no modifican funcionalidad existente)
2. **Rollback de DB:** La columna `confirmation_code` es nullable y no afecta queries existentes; se puede dejar o `ALTER TABLE DROP COLUMN`
3. **Rollback de eventos:** Los eventos `RESERVATION_*` son nuevos tipos; el ingest los ignora si no hay handler registrado
4. **Feature flag:** Se puede agregar `enable_reservations` a `tenant_settings` para habilitar/deshabilitar por tenant sin deploy

### Riesgo del rollback: BAJO
- Todos los cambios son aditivos (nuevos archivos, nuevos tipos de evento, nueva columna nullable)
- No se modifican flujos existentes (POS, ordenes, pagos)
- La UI publica vive en ruta nueva `/reservar/` sin interferir con rutas existentes

---

## Success Criteria

1. Un cliente puede crear una reserva desde el celular en menos de 60 segundos
2. El admin ve las reservas del dia con filtros funcionales
3. El admin puede confirmar/rechazar/marcar llegada en un click
4. No se permite overbooking (reservas que excedan capacidad de mesas)
5. El codigo de confirmacion permite al cliente consultar su reserva
6. Rate limiting previene spam (max 3 reservas/min por IP)
7. Todos los endpoints admin requieren autenticacion (`requireAdminAuth`)
8. El endpoint publico NO expone datos sensibles del tenant
9. Tests: >= 80% cobertura, property tests para validaciones de negocio
10. Build y typecheck pasan sin errores
