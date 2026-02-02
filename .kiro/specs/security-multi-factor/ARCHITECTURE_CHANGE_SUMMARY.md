# Architecture Change Summary: Simple → Hybrid Model

**Date:** February 2, 2026  
**Decision:** Upgrade from Simple MAC Model to Hybrid MAC Model  
**Impact:** Escalable a todas las terminales, máxima seguridad, mínima fricción

---

## What Changed

### Before (Simple Model - Phase 1)
```
device_mac_addresses:
  mac_address (PRIMARY KEY)
  employee_id
  first_seen, last_seen
  is_active

Validation:
  1. ¿MAC conocida?
  2. ¿Pertenece a este empleado?
  3. ✅ Acceso permitido

Problem:
  - Empleado rota entre terminales → Confirmación diaria
  - No detecta acceso no autorizado a terminales
```

### After (Hybrid Model - Phase 1 Revised)
```
device_mac_addresses (HYBRID):
  mac_address
  employee_id
  terminal_id (NULL = cualquier terminal)  ← NUEVO
  trust_level (TRUSTED, UNKNOWN, BLOCKED)  ← NUEVO
  first_seen, last_seen, access_count

terminal_mac_registry (NEW):
  terminal_id
  mac_address
  employee_id
  access_count, is_authorized
  first_seen, last_seen

Validation:
  1. ¿MAC conocida?
  2. ¿Pertenece a este empleado?
  3. ¿Es la terminal correcta? (si aplica)
  4. ¿Está bloqueada?
  5. ✅ Acceso permitido (con warning si terminal nueva)

Benefits:
  - Empleado rota entre terminales → SIN confirmación
  - Detecta acceso no autorizado a terminales
  - Detecta dispositivos robados
```

---

## Database Schema Changes

### Table: device_mac_addresses

**Before:**
```sql
CREATE TABLE device_mac_addresses (
  mac_address VARCHAR(17) PRIMARY KEY,
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**After (Hybrid):**
```sql
CREATE TABLE device_mac_addresses (
  mac_address VARCHAR(17) NOT NULL,
  employee_id UUID NOT NULL,
  terminal_id UUID,                    -- NULL = cualquier terminal
  
  tenant_id UUID NOT NULL,
  location_id UUID,
  
  trust_level VARCHAR(20) DEFAULT 'UNKNOWN',  -- TRUSTED, UNKNOWN, BLOCKED
  
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  access_count INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Composite Primary Key (permite múltiples terminales por MAC)
  PRIMARY KEY (mac_address, employee_id, COALESCE(terminal_id, '00000000-0000-0000-0000-000000000000'))
);
```

**Changes:**
- ✅ Agregado `terminal_id` (NULL = cualquier terminal)
- ✅ Agregado `trust_level` (TRUSTED, UNKNOWN, BLOCKED)
- ✅ Agregado `access_count` (auditoría)
- ✅ Cambiado PRIMARY KEY a composite (permite múltiples terminales)
- ✅ Agregado `location_id` (para futuro)

### Table: terminal_mac_registry (NEW)

```sql
CREATE TABLE terminal_mac_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  terminal_id UUID NOT NULL,
  mac_address VARCHAR(17) NOT NULL,
  employee_id UUID NOT NULL,
  
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  access_count INT DEFAULT 1,
  is_authorized BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:**
- Auditoría de qué MACs accedieron a qué terminales
- Detecta acceso no autorizado
- Permite investigación de incidentes

---

## Validation Logic Changes

### Before (Simple)
```typescript
async function validateMAC(
  employeeId: string,
  macAddress: string
): Promise<{ isValid: boolean; reason?: string }> {
  
  const knownMAC = await findMAC(macAddress);
  
  if (!knownMAC) {
    return { isValid: false, reason: 'UNKNOWN_MAC' };
  }
  
  if (knownMAC.employee_id !== employeeId) {
    return { isValid: false, reason: 'WRONG_EMPLOYEE' };
  }
  
  return { isValid: true };
}
```

### After (Hybrid)
```typescript
async function validateMAC(
  employeeId: string,
  macAddress: string,
  terminalId?: string
): Promise<MACValidationResult> {
  
  const knownMAC = await findMAC(macAddress);
  
  if (!knownMAC) {
    return { isValid: false, reason: 'UNKNOWN_MAC', requiresConfirmation: true };
  }
  
  if (knownMAC.employee_id !== employeeId) {
    return { isValid: false, reason: 'WRONG_EMPLOYEE' };
  }
  
  if (knownMAC.trust_level === 'BLOCKED') {
    return { isValid: false, reason: 'BLOCKED_MAC' };
  }
  
  // NEW: Check terminal authorization
  if (knownMAC.terminal_id && terminalId && knownMAC.terminal_id !== terminalId) {
    // MAC conocida pero en terminal diferente
    // Permitir con warning (rotación legítima)
    return { isValid: true, warning: 'DIFFERENT_TERMINAL' };
  }
  
  return { isValid: true };
}

// NEW: Terminal authorization check
async function checkTerminalAuthorization(
  terminalId: string,
  macAddress: string,
  employeeId: string
): Promise<TerminalAuthResult> {
  
  const terminalAccess = await findTerminalAccess(terminalId, macAddress);
  
  if (!terminalAccess) {
    // Primera vez que esta MAC accede a esta terminal
    await createTerminalAccess(terminalId, macAddress, employeeId);
    return { isAuthorized: true, reason: 'FIRST_ACCESS' };
  }
  
  if (!terminalAccess.is_authorized) {
    return { isAuthorized: false, reason: 'UNAUTHORIZED' };
  }
  
  return { isAuthorized: true };
}
```

**Changes:**
- ✅ Agregado parámetro `terminalId`
- ✅ Agregado check de `trust_level`
- ✅ Agregado check de terminal (permite rotación)
- ✅ Agregada función `checkTerminalAuthorization()`
- ✅ Retorna warnings en lugar de errores para rotación

---

## Login Flow Changes

### Before (Simple)
```
1. Authenticate with PIN
2. Detect simultaneous login
3. Detect MAC address
4. Validate MAC (employee check)
5. Create session
6. Return token
```

### After (Hybrid)
```
1. Authenticate with PIN
2. Detect simultaneous login
3. Detect MAC address
4. Validate MAC (employee + terminal check)  ← MEJORADO
5. Check terminal authorization              ← NUEVO
6. Create session (with terminal_id)         ← MEJORADO
7. Return token (with warnings if applicable) ← MEJORADO
```

---

## API Response Changes

### Before (Simple)
```json
{
  "success": true,
  "sessionToken": "token-xyz",
  "sessionId": "session-uuid",
  "employee": { "id", "name", "role" }
}
```

### After (Hybrid)
```json
{
  "success": true,
  "sessionToken": "token-xyz",
  "sessionId": "session-uuid",
  "employee": { "id", "name", "role" },
  "warning": "DIFFERENT_TERMINAL"  // Si aplica
}
```

---

## New Endpoints (Hybrid)

### Before (Simple)
```
POST /api/auth/login-secure
POST /api/auth/confirm-device
POST /api/auth/logout
POST /api/auth/validate-session
```

### After (Hybrid)
```
POST /api/auth/login-secure          (mejorado)
POST /api/auth/confirm-device        (mejorado)
POST /api/auth/logout
POST /api/auth/validate-session
GET  /api/admin/security/devices     (NEW)
POST /api/admin/security/devices/[mac]/block  (NEW)
GET  /api/admin/security/terminals/[id]/access-log  (NEW)
```

---

## Alert Types Changes

### Before (Simple)
```
SIMULTANEOUS_LOGIN
NEW_DEVICE
BLOCKED_DEVICE
```

### After (Hybrid)
```
SIMULTANEOUS_LOGIN
NEW_DEVICE
BLOCKED_DEVICE
DIFFERENT_TERMINAL        (NEW - warning, no error)
UNAUTHORIZED_TERMINAL     (NEW - error)
DEVICE_MISMATCH          (NEW - error)
```

---

## Migration Path

### Step 1: Update Database Schema
```bash
# Create new migration
npx prisma migrate dev --name hybrid_mac_model

# Changes:
# - Modify device_mac_addresses (add terminal_id, trust_level)
# - Create terminal_mac_registry (new table)
# - Update indexes
```

### Step 2: Update Core Logic
```bash
# Files to update:
# - src/core/security/mac-validator.ts (add hybrid logic)
# - src/core/security/session-validator.ts (add terminal_id)
# - src/app/api/auth/login-secure/route.ts (use hybrid validation)
```

### Step 3: Update Admin Panel
```bash
# New files:
# - src/app/admin/security/devices/page.tsx
# - src/app/admin/security/terminals/[id]/access-log/page.tsx
# - src/components/admin/DeviceManager.tsx
```

### Step 4: Testing
```bash
# Test all scenarios:
# - Known device, known terminal
# - Known device, new terminal
# - Unknown device
# - Device of different employee
# - Blocked device
```

---

## Backward Compatibility

### Data Migration
```sql
-- Existing device_mac_addresses records:
-- - terminal_id = NULL (válido para cualquier terminal)
-- - trust_level = 'TRUSTED' (asumimos que son conocidas)

UPDATE device_mac_addresses 
SET terminal_id = NULL, trust_level = 'TRUSTED'
WHERE trust_level IS NULL;
```

### API Compatibility
```typescript
// Parámetro terminalId es opcional
// Si no se proporciona, se usa NULL (cualquier terminal)
// Backward compatible con clientes antiguos
```

---

## Performance Impact

### Database Queries
```
Before:
- 1 query: SELECT * FROM device_mac_addresses WHERE mac_address = ?

After:
- 1 query: SELECT * FROM device_mac_addresses WHERE mac_address = ? AND employee_id = ?
- 1 query: SELECT * FROM terminal_mac_registry WHERE terminal_id = ? AND mac_address = ?
- Total: 2 queries (vs 1 antes)

Impact: Negligible (ambas queries usan índices)
```

### Storage
```
Before:
- device_mac_addresses: ~100 bytes por registro

After:
- device_mac_addresses: ~150 bytes por registro (+50%)
- terminal_mac_registry: ~200 bytes por registro (nueva tabla)

Impact: Negligible (PostgreSQL maneja bien)
```

---

## Rollback Plan

Si necesitamos revertir a Simple Model:

```sql
-- 1. Backup de datos
CREATE TABLE device_mac_addresses_backup AS 
SELECT * FROM device_mac_addresses;

-- 2. Revertir schema
ALTER TABLE device_mac_addresses DROP COLUMN terminal_id;
ALTER TABLE device_mac_addresses DROP COLUMN trust_level;
ALTER TABLE device_mac_addresses DROP COLUMN access_count;

-- 3. Revertir PRIMARY KEY
ALTER TABLE device_mac_addresses ADD PRIMARY KEY (mac_address);

-- 4. Eliminar tabla nueva
DROP TABLE terminal_mac_registry;

-- 5. Revertir código
git revert <commit-hash>
```

---

## Summary

| Aspecto | Simple | Hybrid |
|--------|--------|--------|
| Detecta dispositivos robados | ✅ | ✅ |
| Detecta acceso no autorizado a terminales | ❌ | ✅ |
| Permite rotación sin fricción | ❌ | ✅ |
| Escalable | ✅ | ✅ |
| Complejidad | BAJA | MEDIA |
| Tiempo implementación | 3 horas | 5 horas |
| Seguridad | MEDIA | ALTA |
| Fricción | ALTA | BAJA |

---

**Status:** ✅ APROBADO - Cambio de arquitectura completado  
**Próximo:** Implementar Phase 1 con Hybrid Model  
**Impacto:** Máxima seguridad + mínima fricción + escalable
