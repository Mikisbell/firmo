# Hybrid MAC Detection Model - Complete Design

**Status:** Design Phase  
**Date:** February 2, 2026  
**Model:** Hybrid (Detecta dispositivos robados + acceso no autorizado a terminales)

---

## Executive Summary

El modelo híbrido detecta **dos escenarios de seguridad**:

1. **Dispositivos Robados/Comprometidos** - MAC por empleado
   - Si alguien roba el dispositivo del empleado
   - Detecta acceso desde MAC desconocida

2. **Acceso No Autorizado a Terminales** - MAC por terminal
   - Si alguien intenta usar terminal ajena
   - Detecta acceso desde terminal no autorizada

3. **Rotación Legítima** - Permite excepciones
   - Empleados pueden rotar entre terminales
   - Sin confirmación diaria (máxima fricción mínima)

---

## Database Schema (Hybrid)

### Table: device_mac_addresses (MEJORADA)

```sql
CREATE TABLE device_mac_addresses (
  -- Identificador único (MAC + Empleado + Terminal)
  mac_address VARCHAR(17) NOT NULL,
  employee_id UUID NOT NULL,
  terminal_id UUID,                    -- NULL = cualquier terminal
  
  -- Contexto
  tenant_id UUID NOT NULL,
  location_id UUID,
  
  -- Confianza
  trust_level VARCHAR(20) DEFAULT 'UNKNOWN',  -- TRUSTED, UNKNOWN, BLOCKED
  
  -- Auditoría
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  access_count INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Composite Primary Key
  PRIMARY KEY (mac_address, employee_id, COALESCE(terminal_id, '00000000-0000-0000-0000-000000000000'))
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_device_mac_tenant_employee 
  ON device_mac_addresses(tenant_id, employee_id);
  
CREATE INDEX idx_device_mac_terminal 
  ON device_mac_addresses(terminal_id) 
  WHERE terminal_id IS NOT NULL;
  
CREATE INDEX idx_device_mac_employee_last_seen 
  ON device_mac_addresses(employee_id, last_seen DESC);
  
CREATE INDEX idx_device_mac_trust_level
  ON device_mac_addresses(trust_level);
```

### Table: terminal_mac_registry (NUEVA)

Auditoría de qué MACs han accedido a cada terminal:

```sql
CREATE TABLE terminal_mac_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  terminal_id UUID NOT NULL,
  mac_address VARCHAR(17) NOT NULL,
  employee_id UUID NOT NULL,
  
  -- Auditoría
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  access_count INT DEFAULT 1,
  is_authorized BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_terminal_mac_registry_terminal
    (terminal_id, mac_address),
  INDEX idx_terminal_mac_registry_employee
    (employee_id, terminal_id),
  INDEX idx_terminal_mac_registry_unauthorized
    (is_authorized) WHERE is_authorized = FALSE
);
```

### Table: active_sessions (ACTUALIZADA)

```sql
CREATE TABLE active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  terminal_id UUID NOT NULL,
  device_id UUID NOT NULL,
  session_token STRING UNIQUE NOT NULL,
  
  -- Identificadores primarios (MAC es principal)
  mac_address VARCHAR(17) NOT NULL,
  ip_address STRING,                   -- Solo logging
  user_agent STRING,
  
  -- Ubicación
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Estado
  is_active BOOLEAN DEFAULT TRUE,
  is_suspicious BOOLEAN DEFAULT FALSE,
  blocked_reason STRING,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_active_sessions_tenant_employee
    (tenant_id, employee_id, is_active),
  INDEX idx_active_sessions_terminal
    (terminal_id, is_active),
  INDEX idx_active_sessions_mac
    (mac_address),
  INDEX idx_active_sessions_token
    (session_token)
);
```

---

## Validation Logic (Hybrid)

### 1. MAC Validation Function

```typescript
interface MACValidationResult {
  isValid: boolean;
  reason?: string;
  warning?: string;
  requiresConfirmation?: boolean;
  trustLevel?: 'TRUSTED' | 'UNKNOWN' | 'BLOCKED';
}

async function validateMAC(
  tenantId: string,
  employeeId: string,
  macAddress: string,
  terminalId?: string
): Promise<MACValidationResult> {
  
  // 1. ¿Conocemos esta MAC?
  const knownMAC = await prisma.device_mac_addresses.findFirst({
    where: {
      mac_address: macAddress,
      tenant_id: tenantId,
    },
  });

  if (!knownMAC) {
    // MAC completamente desconocida
    return {
      isValid: false,
      reason: 'UNKNOWN_MAC',
      requiresConfirmation: true,
      trustLevel: 'UNKNOWN',
    };
  }

  // 2. ¿Pertenece a este empleado?
  if (knownMAC.employee_id !== employeeId) {
    // MAC conocida pero para otro empleado
    return {
      isValid: false,
      reason: 'WRONG_EMPLOYEE',
      trustLevel: 'BLOCKED',
    };
  }

  // 3. ¿Está bloqueada?
  if (knownMAC.trust_level === 'BLOCKED') {
    return {
      isValid: false,
      reason: 'BLOCKED_MAC',
      trustLevel: 'BLOCKED',
    };
  }

  // 4. ¿Es la terminal correcta? (si aplica)
  if (knownMAC.terminal_id && terminalId && knownMAC.terminal_id !== terminalId) {
    // MAC conocida pero en terminal diferente
    // Opción: Permitir con warning o requerir confirmación
    return {
      isValid: true,
      warning: 'DIFFERENT_TERMINAL',
      requiresConfirmation: false,  // Permitir rotación
      trustLevel: 'TRUSTED',
    };
  }

  // 5. ¿Es terminal NULL? (MAC registrada para cualquier terminal)
  if (!knownMAC.terminal_id) {
    // MAC válida para cualquier terminal
    return {
      isValid: true,
      trustLevel: 'TRUSTED',
    };
  }

  // Todo bien
  return {
    isValid: true,
    trustLevel: 'TRUSTED',
  };
}
```

### 2. Terminal Authorization Check

```typescript
interface TerminalAuthResult {
  isAuthorized: boolean;
  reason?: string;
  shouldAlert?: boolean;
}

async function checkTerminalAuthorization(
  tenantId: string,
  terminalId: string,
  macAddress: string,
  employeeId: string
): Promise<TerminalAuthResult> {
  
  // ¿Ha accedido esta MAC a esta terminal antes?
  const terminalAccess = await prisma.terminal_mac_registry.findFirst({
    where: {
      tenant_id: tenantId,
      terminal_id: terminalId,
      mac_address: macAddress,
    },
  });

  if (!terminalAccess) {
    // Primera vez que esta MAC accede a esta terminal
    // Crear registro
    await prisma.terminal_mac_registry.create({
      data: {
        tenant_id: tenantId,
        terminal_id: terminalId,
        mac_address: macAddress,
        employee_id: employeeId,
        is_authorized: true,
      },
    });

    return {
      isAuthorized: true,
      reason: 'FIRST_ACCESS_TO_TERMINAL',
      shouldAlert: false,
    };
  }

  // ¿Está autorizado?
  if (!terminalAccess.is_authorized) {
    return {
      isAuthorized: false,
      reason: 'UNAUTHORIZED_TERMINAL_ACCESS',
      shouldAlert: true,
    };
  }

  // Actualizar last_seen y access_count
  await prisma.terminal_mac_registry.update({
    where: { id: terminalAccess.id },
    data: {
      last_seen: new Date(),
      access_count: { increment: 1 },
    },
  });

  return {
    isAuthorized: true,
  };
}
```

---

## Login Flow (Hybrid)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Authenticate with PIN                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Detect Simultaneous Login                            │
│    (Mismo empleado, diferente dispositivo)              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Detect MAC Address (WebRTC)                          │
│    (¿Qué dispositivo es?)                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Validate MAC (Hybrid Check)                          │
│    ├─ ¿Conocemos esta MAC?                              │
│    ├─ ¿Pertenece a este empleado?                       │
│    ├─ ¿Está bloqueada?                                  │
│    └─ ¿Es la terminal correcta?                         │
└─────────────────────────────────────────────────────────┘
                          ↓
                    ┌─────┴─────┐
                    │           │
              VÁLIDA        INVÁLIDA
                    │           │
                    ↓           ↓
            ┌──────────────┐  ┌──────────────────┐
            │ 5. Check     │  │ Require           │
            │ Terminal     │  │ Confirmation      │
            │ Auth         │  │ (Send code)       │
            └──────────────┘  └──────────────────┘
                    │                 │
                    ↓                 ↓
            ┌──────────────┐  ┌──────────────────┐
            │ 6. Create    │  │ Wait for          │
            │ Session      │  │ /confirm-device   │
            │ (Inmediato)  │  │ endpoint          │
            └──────────────┘  └──────────────────┘
                    │                 │
                    └────────┬────────┘
                             ↓
                    ┌──────────────────┐
                    │ 7. Return        │
                    │ Session Token    │
                    └──────────────────┘
```

---

## Scenarios (Hybrid Model)

### Scenario 1: Empleado Conocido, Terminal Conocida ✅

```
Empleado: Juan
MAC: AA:BB:CC:DD:EE:01 (registrada para Juan)
Terminal: CAJA_01 (registrada para esta MAC)

Validación:
1. MAC conocida ✅
2. Pertenece a Juan ✅
3. No está bloqueada ✅
4. Terminal correcta ✅

Resultado: ACCESO INMEDIATO (sin fricción)
```

### Scenario 2: Empleado Conocido, Terminal Nueva ⚠️

```
Empleado: Juan
MAC: AA:BB:CC:DD:EE:01 (registrada para Juan)
Terminal: CAJA_02 (primera vez con esta MAC)

Validación:
1. MAC conocida ✅
2. Pertenece a Juan ✅
3. No está bloqueada ✅
4. Terminal diferente ⚠️

Resultado: ACCESO PERMITIDO (con warning)
- Registra acceso en terminal_mac_registry
- Crea alerta de "DIFFERENT_TERMINAL"
- Admin puede revisar si es legítimo
```

### Scenario 3: MAC Desconocida ❌

```
Empleado: Juan
MAC: XX:YY:ZZ:AA:BB:CC (desconocida)
Terminal: CAJA_01

Validación:
1. MAC desconocida ❌

Resultado: REQUIERE CONFIRMACIÓN
- Genera código de confirmación
- Envía por email/SMS
- Empleado confirma
- MAC se registra como TRUSTED
```

### Scenario 4: MAC de Otro Empleado ❌

```
Empleado: Juan
MAC: AA:BB:CC:DD:EE:02 (registrada para María)
Terminal: CAJA_01

Validación:
1. MAC conocida ✅
2. Pertenece a María (no Juan) ❌

Resultado: ACCESO DENEGADO
- Crea alerta de "DEVICE_MISMATCH"
- Admin investiga
- Posible robo de dispositivo
```

### Scenario 5: MAC Bloqueada ❌

```
Empleado: Juan
MAC: AA:BB:CC:DD:EE:01 (bloqueada por admin)
Terminal: CAJA_01

Validación:
1. MAC conocida ✅
2. Pertenece a Juan ✅
3. Está bloqueada ❌

Resultado: ACCESO DENEGADO
- Crea alerta de "BLOCKED_DEVICE"
- Admin debe desbloquear
```

---

## API Endpoints (Hybrid)

### POST /api/auth/login-secure

```typescript
Request:
{
  pin: "1234",
  deviceId: "device-uuid",
  terminalId: "CAJA_01",
  location?: { lat: -12.0, lng: -77.0 }
}

Response (Success - Immediate Access):
{
  success: true,
  sessionToken: "token-xyz",
  sessionId: "session-uuid",
  employee: { id, name, role },
  warning?: "DIFFERENT_TERMINAL"  // Si aplica
}

Response (Requires Confirmation):
{
  error: "UNKNOWN_DEVICE",
  message: "Dispositivo no reconocido",
  requiresConfirmation: true,
  confirmationCode: "ABC123",
  macAddress: "AA:BB:CC:DD:EE:FF"
}

Response (Access Denied):
{
  error: "DEVICE_MISMATCH" | "BLOCKED_DEVICE" | "SIMULTANEOUS_LOGIN",
  message: "Descripción del error"
}
```

### POST /api/auth/confirm-device

```typescript
Request:
{
  sessionToken: "token-xyz",
  macAddress: "AA:BB:CC:DD:EE:FF",
  confirmationCode: "ABC123",
  terminalId?: "CAJA_01"
}

Response:
{
  success: true,
  sessionToken: "new-token-xyz",
  sessionId: "session-uuid",
  message: "Dispositivo confirmado exitosamente"
}
```

### GET /api/admin/security/devices

```typescript
Response:
{
  devices: [
    {
      macAddress: "AA:BB:CC:DD:EE:01",
      employee: { id, name },
      terminal: { id, name },
      trustLevel: "TRUSTED",
      firstSeen: "2026-02-01T10:00:00Z",
      lastSeen: "2026-02-02T15:30:00Z",
      accessCount: 47,
      isActive: true
    }
  ]
}
```

### POST /api/admin/security/devices/[macAddress]/block

```typescript
Request:
{
  reason: "Dispositivo robado"
}

Response:
{
  success: true,
  message: "Dispositivo bloqueado"
}
```

---

## Correctness Properties (Hybrid)

### Property 1: Unknown MAC Requires Confirmation
```
∀ (mac, employee, terminal):
  mac ∉ device_mac_addresses 
  → login_response.requiresConfirmation = true
```

### Property 2: Known MAC Allows Immediate Access
```
∀ (mac, employee, terminal):
  mac ∈ device_mac_addresses 
  ∧ mac.employee_id = employee 
  ∧ mac.trust_level = 'TRUSTED'
  → login_response.success = true
```

### Property 3: MAC of Different Employee is Rejected
```
∀ (mac, employee, terminal):
  mac ∈ device_mac_addresses 
  ∧ mac.employee_id ≠ employee
  → login_response.error = 'DEVICE_MISMATCH'
```

### Property 4: Blocked MAC is Rejected
```
∀ (mac, employee, terminal):
  mac ∈ device_mac_addresses 
  ∧ mac.trust_level = 'BLOCKED'
  → login_response.error = 'BLOCKED_DEVICE'
```

### Property 5: Terminal Access is Logged
```
∀ (mac, employee, terminal):
  login_response.success = true
  → ∃ record ∈ terminal_mac_registry:
    record.mac_address = mac
    ∧ record.terminal_id = terminal
    ∧ record.employee_id = employee
```

### Property 6: Simultaneous Login is Detected
```
∀ (employee, device1, device2):
  device1 ≠ device2
  ∧ ∃ session1 ∈ active_sessions: session1.device_id = device1
  ∧ login_attempt.device_id = device2
  → login_response.error = 'SIMULTANEOUS_LOGIN'
```

### Property 7: Rotation Between Terminals is Allowed
```
∀ (mac, employee, terminal1, terminal2):
  mac ∈ device_mac_addresses
  ∧ mac.employee_id = employee
  ∧ mac.terminal_id = NULL  -- Registrada para cualquier terminal
  → login_response.success = true  -- Para cualquier terminal
```

---

## Migration Strategy

### Phase 1: Database Setup
1. Create `device_mac_addresses` table (hybrid)
2. Create `terminal_mac_registry` table
3. Update `active_sessions` schema
4. Create indexes

### Phase 2: Core Logic
1. Implement `validateMAC()` (hybrid)
2. Implement `checkTerminalAuthorization()`
3. Update login endpoint
4. Create confirmation endpoint

### Phase 3: Admin Panel
1. Create device management UI
2. Add block/unblock functionality
3. Add terminal access audit view

### Phase 4: Testing
1. Unit tests for validation logic
2. Integration tests for login flow
3. E2E tests for all scenarios

---

## Scalability Considerations

### Multi-Terminal Deployment
- ✅ MAC per employee (detecta dispositivos robados)
- ✅ MAC per terminal (detecta acceso no autorizado)
- ✅ Rotation support (empleados pueden cambiar de terminal)
- ✅ Multi-location support (diferentes ubicaciones)

### Performance
- Índices en `device_mac_addresses` para búsquedas rápidas
- Índices en `terminal_mac_registry` para auditoría
- Composite primary key evita duplicados
- Queries optimizadas para login crítico

### Future Extensions
- Geofencing (detecta acceso desde ubicación imposible)
- Time-based restrictions (horarios de trabajo)
- Role-based terminal access (solo ciertos roles en ciertas terminales)
- Device fingerprinting (adicional a MAC)

---

**Status:** Ready for Implementation  
**Next Step:** Update Phase 1 tasks with hybrid model requirements
