# 7. Conceptos Cross-Cutting

> Patrones y decisiones que afectan a múltiples módulos del sistema.

## 7.1 Autenticación y Autorización

### Flujo JWT

```
Login → PIN + tenant_id → employees table lookup
  → lockout check (3 fails en 5min → bloqueado 5min)
  → MAC validation (device + terminal level)
  → terminal validation (non-admin: must be allowed)
  → simultaneous login detection (alerta + cierre sesión previa)
  → session creation (active_sessions table)
  → JWT (HS256, jose library)
    payload: { sub: employee_id, tid: tenant_id, role, name, sid: session_id }
    expiry: 30 min
  → Set cookies: auth_token (httpOnly, sameSite strict) + session_id
```

### Auth Middleware (3 niveles)

| Guard | Uso | Verifica |
|-------|-----|----------|
| `requirePosAuth(req)` | Terminales POS/KDS/Mozo | JWT válido, sesión activa |
| `requireAdminAuth(req)` | Panel admin | JWT válido + `ADMIN_ROLES.includes(role)` |
| `requireAdminPermission(req, perms)` | Permisos granulares | Admin auth + permiso específico |

### RBAC

```
OWNER (level 4) ──▶ Todo
ADMIN (level 3) ──▶ Todo excepto gestión de tenant
MANAGER (level 2) ──▶ Operaciones + reportes
SUPERVISOR (level 1) ──▶ Operaciones limitadas
CASHIER, WAITER, KITCHEN, COOK, PACKER, BAR, DRIVER ──▶ Solo su módulo
```

Regla: `ADMIN_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR']`
**NUNCA** `role === 'ADMIN'` (excluiría OWNER, MANAGER, SUPERVISOR).

---

## 7.2 Caching

### Arquitectura

```
Request → CacheService.get(key)
             │
             ├─ Circuit Breaker OPEN? → fallback in-memory Map
             │
             ├─ Redis SET/GET (Upstash)
             │    Key: "tenant:{tid}:{resource}:{id}"
             │    Compression: >1KB → gzip con prefijo "compressed:"
             │
             └─ Miss? → compute → CacheService.set(key, value, ttl)
```

### TTLs por Recurso

| Recurso | TTL | Razón |
|---------|-----|-------|
| Products | 1 hora | Cambios infrecuentes |
| Terminals | 15 min | Config puede cambiar durante servicio |
| Employees | 10 min | Roles y permisos pueden actualizarse |
| Tenants | 5 min | Config podría cambiar |
| Default | 5 min | Seguro por defecto |

### Invalidación

- **Tag-based** (preferido): `cache.deleteByTag('products')` → elimina todas las keys taggeadas
- **Pattern-based** (legacy): `redis.invalidatePattern('products:*')` → usa `KEYS` (O(n), evitar en producción con muchas keys)

### Circuit Breaker (Redis)

| Estado | Comportamiento | Transición |
|--------|---------------|------------|
| CLOSED | Opera normal | → OPEN tras 5 failures consecutivos |
| OPEN | Fast-fail, retorna `null`, usa in-memory | → HALF_OPEN tras 60s |
| HALF_OPEN | Permite 1 probe | → CLOSED (éxito) o → OPEN (fallo) |

---

## 7.3 Error Handling

### Patrón Estándar (API Routes)

```typescript
export async function POST(request: NextRequest) {
  // 1. Auth
  const authResult = await requireAdminAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  // 2. Input validation
  try {
    const data = Schema.parse(body);         // Zod
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
  }

  // 3. Business logic
  try {
    const result = await service.doSomething(data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    // 4. Logging con redacción automática
    logger.error('Error al [acción]', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Error al [acción]' }, { status: 500 });
  }
}
```

**Invariantes**:
- Error responses siempre `{ error: string }` — texto en español, sin detalles internos
- HTTP codes semánticos: 401 (no auth), 403 (sin permiso), 400 (input), 404 (no existe), 409 (conflicto), 429 (rate limit), 500 (inesperado)
- Rate limit 429 incluye `Retry-After` header
- Datos sensibles NUNCA en error responses

### Error Boundaries (Frontend)

Componente `ErrorBoundary` (class-based, `getDerivedStateFromError`) wrappea todos los módulos principales. Fallback: UI en español con botón "Recargar página". Sentry: `captureException()` dinámicamente importado.

---

## 7.4 Logging

### Stack

```
Pino (structured JSON)
  ├─ Development: pino-pretty (colorized, timestamps HH:MM:ss)
  ├─ Production:  @logtail/pino → Better Stack
  └─ Test:        silent
```

### Redacción Automática

Campos que matchean estos patterns se convierten en `[REDACTED]`:
`pin`, `password`, `token`, `secret`, `authorization`, `cookie`, `credit*card`, `cvv`, `ssn`, `tax*id`

### Contexto por Request

```typescript
const log = createRequestLogger(crypto.randomUUID(), { terminalId, tenantId });
// Todas las líneas de este request llevan: requestId, correlationId, tenantId, terminalId
log.info('Autenticación exitosa', { employeeName, role });
```

**Gap**: `correlationId` se genera localmente pero NO se propaga desde headers HTTP entrantes (`x-correlation-id` / `traceparent`). No hay distributed tracing.

---

## 7.5 Rate Limiting

### Algoritmo

Sliding window con Redis Sorted Set (score = timestamp ms).

```
ZREMRANGEBYSCORE key 0 (now - 1000ms)   // limpiar viejos
ZCARD key                                 // contar en ventana
ZADD key now requestId                    // agregar actual
EXPIRE key 2                              // TTL de seguridad
```

### Límites

| Nivel | Límite | Ventana |
|-------|--------|---------|
| Per-tenant normal | 100 req/s | 1 segundo |
| Per-tenant burst | 200 req/s | 1 segundo |
| Login per-IP | 10 req | 1 minuto |

Fallback: in-memory `Map` con cleanup cada 5 segundos si Redis no disponible.

---

## 7.6 Input Validation

**Mixto**: Zod en rutas críticas (auth, events, bulk operations), validación manual en muchas rutas admin CRUD.

- **Con Zod**: `LoginSchema.parse(body)` → `ZodError` → 400
- **Manual**: `if (!Number.isInteger(price_cents) || price_cents < 0)` → 400
- **Eventos**: `ParkEvent` es una Zod discriminated union por `event_type` (73 tipos)

---

## 7.7 Internacionalización

**No hay i18n library.** Todos los strings user-facing están hardcodeados en español directamente en el código. Decisión deliberada: mercado único (Perú), equipo pequeño, sin plan inmediato de internacionalización.

Si se necesitara i18n en el futuro, requeriría extraer ~500+ strings a archivos de traducción.

---

## 7.8 Printing

```
PrintQueueService (in-memory, priority queue)
  └── ReceiptBuilder / KitchenTicketBuilder
        └── ESCPOSBuilder (raw bytes: Uint8Array)
              └── PrinterTransport (TCP:9100 | WebUSB | HTTP relay)
```

- Recibos: header con RUC, items alineados a 48 chars, IGV desglosado, QR SUNAT
- Tickets cocina: número grande, badge tipo orden, ítems con modificadores
- **Estado actual**: generación de bytes ESC/POS completa, transporte TCP/USB/HTTP definido, integración E2E pendiente

---

## 7.9 Notificaciones

| Canal | Destinatario | Implementación |
|-------|-------------|----------------|
| **Web Push (VAPID)** | Empleados + Drivers | `web-push` library, subs en DB, retry 3x |
| **WhatsApp** | Clientes (delivery) | Twilio API, 5 templates, rate limit 10/día/phone |
| **SSE** | Terminales POS/KDS | PostgreSQL LISTEN/NOTIFY (no Supabase Realtime) → canales `events:{tid}` |
| **Slack** | Admins (alertas) | Incoming Webhook |
| **In-app** | Admin panel | `AdminNotification` en DB, badge counts API |
| **Email** | — | **No implementado** (stub TODO) |

Driver push offline queue: Redis `RPUSH push:queue:{tid}:{driverId}`, drenado al reconectar.
