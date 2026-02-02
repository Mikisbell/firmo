# Design: Multi-Factor Security & Session Management (MAC-Based)

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (TerminalSetup.tsx, page.tsx)                  │
├─────────────────────────────────────────────────────────┤
│ 1. Detectar MAC address (WebRTC)                        │
│ 2. Enviar: device_id + MAC + PIN                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Backend: POST /api/auth/login                           │
├─────────────────────────────────────────────────────────┤
│ 1. Validar PIN                                          │
│ 2. Validar device_id                                    │
│ 3. Validar MAC address (¿es conocido?)                  │
│ 4. Detectar acceso simultáneo                           │
│ 5. Crear sesión en active_sessions                      │
│ 6. Generar session_token                                │
│ 7. Registrar en audit_log                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Base de Datos                                           │
├─────────────────────────────────────────────────────────┤
│ active_sessions:                                        │
│   - id, employee_id, terminal_id, device_id             │
│   - mac_address, ip_address (logging only)              │
│   - session_token, started_at, last_activity_at         │
│   - is_active, is_suspicious, blocked_reason            │
│                                                         │
│ device_mac_addresses:                                   │
│   - mac_address (PRIMARY), employee_id                  │
│   - first_seen, last_seen, is_active                    │
│                                                         │
│ security_alerts:                                        │
│   - id, type, employee_id, reason                       │
│   - mac_address, ip_address, timestamp                  │
│   - is_resolved, resolved_by, resolved_at              │
│                                                         │
│ transaction_limits:                                     │
│   - employee_id, max_per_hour, max_per_day              │
│   - max_amount_per_transaction                          │
│                                                         │
│ audit_log:                                              │
│   - id, employee_id, action, resource                   │
│   - mac_address, ip_address, timestamp, details         │
└─────────────────────────────────────────────────────────┘
```

## Tablas Nuevas

### device_mac_addresses (NUEVA - Reemplaza IP validation)

```sql
CREATE TABLE device_mac_addresses (
  mac_address STRING PRIMARY KEY,
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  
  -- Timestamps
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(tenant_id, employee_id),
  INDEX(employee_id, last_seen DESC)
);
```

### active_sessions (MODIFICADA)

```sql
CREATE TABLE active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  terminal_id STRING NOT NULL,
  device_id UUID NOT NULL,
  session_token STRING UNIQUE NOT NULL,
  
  -- Contexto de acceso (MAC es primario, IP es logging)
  mac_address STRING NOT NULL,
  ip_address STRING,  -- Solo para logging/auditoría
  user_agent STRING,
  
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
  INDEX(mac_address)
);
```

### security_alerts (SIN CAMBIOS)

```sql
CREATE TABLE security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  alert_type STRING NOT NULL,  -- SIMULTANEOUS_LOGIN, UNKNOWN_DEVICE, DEVICE_MISMATCH, RATE_LIMIT_EXCEEDED
  
  -- Detalles
  reason STRING NOT NULL,
  mac_address STRING,
  ip_address STRING,
  
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

### transaction_limits (SIN CAMBIOS)

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

### audit_log (MODIFICADA)

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  action STRING NOT NULL,  -- LOGIN, LOGOUT, TRANSACTION, PRICE_CHANGE, REFUND
  resource STRING,  -- order_id, product_id, etc
  
  -- Contexto (MAC es primario)
  mac_address STRING,
  ip_address STRING,  -- Solo para logging
  session_id UUID,
  
  -- Detalles
  details JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(tenant_id, employee_id, created_at DESC),
  INDEX(action, created_at DESC),
  INDEX(created_at DESC),
  INDEX(mac_address)
);
```

## Endpoints Nuevos

### POST /api/auth/login (Mejorado con MAC)

```typescript
Request:
{
  terminal_id: "CAJA_01",
  pin: "1234",
  device_id: "uuid-device",
  mac_address: "AA:BB:CC:DD:EE:FF",  // ← NUEVO (MAC address)
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
  existingSession: {
    device_id: "uuid-otro",
    mac_address: "AA:BB:CC:DD:EE:FF",
    started_at: "2026-02-02T10:00:00Z"
  }
}

Response (Fallo - MAC Desconocido):
{
  success: false,
  error: "UNKNOWN_DEVICE",
  message: "Dispositivo desconocido",
  requires_confirmation: true,
  confirmation_code: "123456"  // Enviar por email
}

Response (Fallo - MAC Pertenece a Otro Empleado):
{
  success: false,
  error: "DEVICE_MISMATCH",
  message: "Este dispositivo está registrado a otro empleado",
}
```

### POST /api/auth/confirm-device

```typescript
Request:
{
  confirmation_code: "123456",
  session_token: "token-xyz",
  mac_address: "AA:BB:CC:DD:EE:FF"
}

Response:
{
  success: true,
  message: "Dispositivo confirmado"
}
```

### GET /api/admin/security/sessions (SIN CAMBIOS)

```typescript
Response:
{
  sessions: [
    {
      id: "session-1",
      employee: { id, name },
      terminal: { id, name },
      device_id: "uuid",
      mac_address: "AA:BB:CC:DD:EE:FF",
      ip_address: "192.168.1.100",  // Solo para referencia
      started_at: "2026-02-02T10:00:00Z",
      last_activity_at: "2026-02-02T10:30:00Z",
      is_suspicious: false
    }
  ]
}
```

## Validaciones

### 1. Validación de MAC Address (REEMPLAZA IP validation)

```typescript
const validateMAC = async (
  employeeId: string,
  currentMAC: string
): Promise<{ isValid: boolean; reason?: string }> => {
  const knownMAC = await prisma.device_mac_addresses.findUnique({
    where: { mac_address: currentMAC },
  });
  
  if (!knownMAC) {
    // MAC desconocido → Requiere confirmación
    return {
      isValid: false,
      reason: `MAC desconocido: ${currentMAC}`,
    };
  }
  
  if (knownMAC.employee_id !== employeeId) {
    // MAC pertenece a otro empleado → Alerta
    return {
      isValid: false,
      reason: `MAC pertenece a otro empleado`,
    };
  }
  
  // MAC válido → Acceso sin fricción
  return { isValid: true };
};
```

### 2. Detección de Acceso Simultáneo (SIN CAMBIOS)

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

### 3. Rate Limiting (SIN CAMBIOS)

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

2. **MAC desconocido requiere confirmación**
   - Si MAC no está registrado → requiere confirmación

3. **MAC perteneciente a otro empleado es rechazado**
   - Si MAC pertenece a otro empleado → login falla

4. **MAC conocido permite acceso sin fricción**
   - Si MAC está registrado → acceso inmediato

5. **Rate limiting funciona**
   - Si transacciones > límite → acción bloqueada

6. **Auditoría es completa**
   - Cada acción registra: quién, cuándo, MAC, qué hizo

7. **IP es logging, no validación**
   - IP se registra para auditoría
   - IP NO se usa para bloquear acceso
   - MAC es el identificador principal

