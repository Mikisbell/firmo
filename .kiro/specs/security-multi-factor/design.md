# Design: Multi-Factor Security & Session Management

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (TerminalSetup.tsx, page.tsx)                  │
├─────────────────────────────────────────────────────────┤
│ 1. Obtener IP + ubicación (geolocation API)             │
│ 2. Enviar: device_id + IP + ubicación + PIN             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Backend: POST /api/auth/login                           │
├─────────────────────────────────────────────────────────┤
│ 1. Validar PIN                                          │
│ 2. Validar device_id                                    │
│ 3. Validar IP (¿es sospechosa?)                         │
│ 4. Validar ubicación (¿viaje imposible?)                │
│ 5. Detectar acceso simultáneo                           │
│ 6. Crear sesión en active_sessions                      │
│ 7. Generar session_token                                │
│ 8. Registrar en audit_log                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Base de Datos                                           │
├─────────────────────────────────────────────────────────┤
│ active_sessions:                                        │
│   - id, employee_id, terminal_id, device_id             │
│   - ip_address, location_lat, location_lng              │
│   - session_token, started_at, last_activity_at         │
│   - is_active, is_suspicious, blocked_reason            │
│                                                         │
│ security_alerts:                                        │
│   - id, type, employee_id, reason                       │
│   - ip_address, location, timestamp                     │
│   - is_resolved, resolved_by, resolved_at              │
│                                                         │
│ transaction_limits:                                     │
│   - employee_id, max_per_hour, max_per_day              │
│   - max_amount_per_transaction                          │
│                                                         │
│ audit_log:                                              │
│   - id, employee_id, action, resource                   │
│   - ip_address, timestamp, details                      │
└─────────────────────────────────────────────────────────┘
```

## Tablas Nuevas

### active_sessions

```sql
CREATE TABLE active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  terminal_id STRING NOT NULL,
  device_id UUID NOT NULL,
  session_token STRING UNIQUE NOT NULL,
  
  -- Contexto de acceso
  ip_address STRING NOT NULL,
  user_agent STRING,
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  is_suspicious BOOLEAN DEFAULT false,
  blocked_reason STRING,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(tenant_id, employee_id, is_active),
  INDEX(terminal_id, is_active),
  INDEX(session_token),
  INDEX(ip_address)
);
```

### security_alerts

```sql
CREATE TABLE security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  alert_type STRING NOT NULL,  -- SIMULTANEOUS_LOGIN, SUSPICIOUS_IP, IMPOSSIBLE_TRAVEL, RATE_LIMIT_EXCEEDED
  
  -- Detalles
  reason STRING NOT NULL,
  ip_address STRING,
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  
  -- Resolución
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMP,
  resolution_notes STRING,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(tenant_id, alert_type, is_resolved),
  INDEX(employee_id, created_at DESC),
  INDEX(created_at DESC)
);
```

### transaction_limits

```sql
CREATE TABLE transaction_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  
  -- Límites
  max_transactions_per_hour INT DEFAULT 100,
  max_transactions_per_day INT DEFAULT 500,
  max_amount_per_transaction INT DEFAULT 100000,  -- en centavos
  max_price_changes_per_hour INT DEFAULT 20,
  max_refunds_per_day INT DEFAULT 10,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, employee_id)
);
```

### audit_log

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  action STRING NOT NULL,  -- LOGIN, LOGOUT, TRANSACTION, PRICE_CHANGE, REFUND
  resource STRING,  -- order_id, product_id, etc
  
  -- Contexto
  ip_address STRING,
  session_id UUID,
  
  -- Detalles
  details JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(tenant_id, employee_id, created_at DESC),
  INDEX(action, created_at DESC),
  INDEX(created_at DESC)
);
```

## Endpoints Nuevos

### POST /api/auth/login (Mejorado)

```typescript
Request:
{
  terminal_id: "CAJA_01",
  pin: "1234",
  device_id: "uuid-device",
  ip_address: "192.168.1.100",
  location: { lat: -12.0464, lng: -77.0428 }
}

Response (Éxito):
{
  success: true,
  session_token: "token-xyz",
  employee: { id, name, role },
  terminal: { id, name }
}

Response (Fallo - Acceso Simultáneo):
{
  success: false,
  error: "SIMULTANEOUS_LOGIN",
  message: "Ya hay una sesión activa en otro dispositivo",
  existing_session: {
    device_id: "uuid-otro",
    ip_address: "192.168.1.50",
    started_at: "2026-02-02T10:00:00Z"
  }
}

Response (Fallo - IP Sospechosa):
{
  success: false,
  error: "SUSPICIOUS_IP",
  message: "Acceso desde IP sospechosa",
  requires_confirmation: true,
  confirmation_code: "123456"  // Enviar por email
}

Response (Fallo - Viaje Imposible):
{
  success: false,
  error: "IMPOSSIBLE_TRAVEL",
  message: "Viaje imposible entre ubicaciones",
  last_location: { lat, lng, timestamp }
}
```

### POST /api/auth/confirm-suspicious-login

```typescript
Request:
{
  confirmation_code: "123456",
  session_token: "token-xyz"
}

Response:
{
  success: true,
  message: "Acceso confirmado"
}
```

### GET /api/admin/security/sessions

```typescript
Response:
{
  sessions: [
    {
      id: "session-1",
      employee: { id, name },
      terminal: { id, name },
      device_id: "uuid",
      ip_address: "192.168.1.100",
      location: { lat, lng },
      started_at: "2026-02-02T10:00:00Z",
      last_activity_at: "2026-02-02T10:30:00Z",
      is_suspicious: false
    }
  ]
}
```

### POST /api/admin/security/sessions/[sessionId]/revoke

```typescript
Request:
{
  reason: "Acceso sospechoso"
}

Response:
{
  success: true,
  message: "Sesión revocada"
}
```

### GET /api/admin/security/alerts

```typescript
Response:
{
  alerts: [
    {
      id: "alert-1",
      type: "SIMULTANEOUS_LOGIN",
      employee: { id, name },
      reason: "Acceso simultáneo desde 2 dispositivos",
      ip_address: "192.168.1.100",
      created_at: "2026-02-02T10:05:00Z",
      is_resolved: false
    }
  ]
}
```

## Validaciones

### 1. Validación de IP

```typescript
const validateIP = async (
  employeeId: string,
  currentIP: string
): Promise<{ is_suspicious: boolean; reason?: string }> => {
  const lastSession = await getLastSession(employeeId);
  
  if (!lastSession) {
    return { is_suspicious: false };
  }
  
  // Si IP es diferente, es sospechosa
  if (lastSession.ip_address !== currentIP) {
    return {
      is_suspicious: true,
      reason: `IP diferente: ${lastSession.ip_address} → ${currentIP}`
    };
  }
  
  return { is_suspicious: false };
};
```

### 2. Validación de Ubicación

```typescript
const validateLocation = async (
  employeeId: string,
  currentLocation: { lat: number; lng: number }
): Promise<{ is_valid: boolean; reason?: string }> => {
  const lastSession = await getLastSession(employeeId);
  
  if (!lastSession || !lastSession.location_lat) {
    return { is_valid: true };
  }
  
  const distance = calculateDistance(
    lastSession.location_lat,
    lastSession.location_lng,
    currentLocation.lat,
    currentLocation.lng
  );
  
  const timeDiff = (Date.now() - lastSession.last_activity_at) / 1000 / 60; // minutos
  const maxDistance = (timeDiff / 60) * 900; // 900 km/h
  
  if (distance > maxDistance) {
    return {
      is_valid: false,
      reason: `Viaje imposible: ${distance}km en ${timeDiff}min`
    };
  }
  
  return { is_valid: true };
};
```

### 3. Detección de Acceso Simultáneo

```typescript
const detectSimultaneousLogin = async (
  employeeId: string,
  terminalId: string,
  deviceId: string
): Promise<{ has_active_session: boolean; session?: any }> => {
  const activeSessions = await prisma.active_sessions.findMany({
    where: {
      employee_id: employeeId,
      terminal_id: terminalId,
      is_active: true,
      device_id: { not: deviceId }  // Dispositivo diferente
    }
  });
  
  if (activeSessions.length > 0) {
    return {
      has_active_session: true,
      session: activeSessions[0]
    };
  }
  
  return { has_active_session: false };
};
```

### 4. Rate Limiting

```typescript
const checkRateLimit = async (
  employeeId: string,
  action: string
): Promise<{ allowed: boolean; reason?: string }> => {
  const limits = await getTransactionLimits(employeeId);
  
  if (action === 'TRANSACTION') {
    const lastHour = await countTransactions(employeeId, 60);
    if (lastHour >= limits.max_transactions_per_hour) {
      return {
        allowed: false,
        reason: `Límite de transacciones por hora alcanzado`
      };
    }
  }
  
  return { allowed: true };
};
```

## Correctness Properties

1. **Acceso simultáneo es rechazado**
   - Si empleado tiene sesión activa → nuevo login falla

2. **IP sospechosa es detectada**
   - Si IP es diferente → requiere confirmación

3. **Viaje imposible es rechazado**
   - Si distancia > velocidad máxima → login falla

4. **Rate limiting funciona**
   - Si transacciones > límite → acción bloqueada

5. **Auditoría es completa**
   - Cada acción registra: quién, cuándo, desde dónde

6. **Alertas son inmediatas**
   - Acceso sospechoso → alerta al admin en <1 segundo
