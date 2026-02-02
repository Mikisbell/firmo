# 🔴 PROBLEMA: Código de Activación se Pide Cada Vez

## El Problema

Actualmente, el sistema pide el código de activación **CADA VEZ** que inicias la aplicación, cuando debería:

1. ✅ Pedir código **UNA SOLA VEZ** al registrar el dispositivo
2. ✅ Guardar el dispositivo en localStorage/sessionStorage
3. ✅ En inicios posteriores, solo pedir **PIN**

## ¿Por Qué Sucede?

### Flujo Actual (INCORRECTO)

```
Inicio 1:
  ├─ TerminalSetup carga
  ├─ Genera fingerprint
  ├─ Llama a /api/terminals/validate
  ├─ Retorna 401 (no vinculado)
  ├─ Muestra pantalla de activación
  ├─ Usuario ingresa código
  ├─ Llama a /api/terminals/activate
  ├─ Guarda config en localStorage
  └─ Navega a /pos

Inicio 2:
  ├─ App carga
  ├─ Lee config de localStorage ✅
  ├─ Pero... genera NUEVO fingerprint
  ├─ Llama a /api/terminals/validate
  ├─ Compara: nuevo fingerprint ≠ fingerprint guardado
  ├─ Retorna 401 (fingerprint mismatch)
  ├─ Muestra pantalla de activación NUEVAMENTE ❌
  └─ Usuario debe ingresar código de nuevo ❌
```

### El Problema Raíz

En `TerminalSetup.tsx` línea ~150:

```typescript
// Cuando valida terminal, compara fingerprints
const validateResponse = await fetch('/api/terminals/validate', {
  method: 'POST',
  body: JSON.stringify({
    terminal_id: id,
    tenant_id: TENANT_ID,
    fingerprint,  // ← NUEVO fingerprint generado cada vez
  }),
});

// Si no coincide con el guardado en BD → 401
// → Muestra pantalla de activación
```

**El problema:** Se genera un fingerprint NUEVO cada vez, aunque sea el mismo dispositivo.

---

## La Solución Correcta

### Opción 1: Usar MAC Address (Recomendado)

**Ventajas:**
- ✅ Identificador único del dispositivo físico
- ✅ No cambia aunque se reinicie el navegador
- ✅ Funciona offline
- ✅ Más confiable que fingerprint

**Desventajas:**
- ❌ Requiere permisos especiales en navegador
- ❌ No disponible en todos los navegadores

### Opción 2: Usar Device ID Persistente (MEJOR)

**Ventajas:**
- ✅ Se genera UNA SOLA VEZ
- ✅ Se guarda en localStorage
- ✅ Funciona en todos los navegadores
- ✅ Funciona offline
- ✅ Identificador único por dispositivo

**Desventajas:**
- ⚠️ Se puede limpiar si se borra localStorage

### Opción 3: Usar Fingerprint Cacheado (ACTUAL - INCORRECTO)

**Ventajas:**
- ✅ Funciona en todos los navegadores

**Desventajas:**
- ❌ Fingerprint cambia cada vez (canvas, WebGL, etc.)
- ❌ Pide código cada vez
- ❌ No es confiable

---

## Flujo Correcto (Propuesto)

### Primer Inicio

```
Inicio 1:
  ├─ App carga
  ├─ Genera Device ID único (UUID)
  ├─ Guarda en localStorage: device_id
  ├─ TerminalSetup carga
  ├─ Usuario selecciona terminal
  ├─ Usuario ingresa código de activación
  ├─ Envía: { terminal_id, code, device_id }
  ├─ Servidor vincula: device_id → terminal_id
  ├─ Guarda config en localStorage
  └─ Navega a /pos ✅
```

### Inicios Posteriores

```
Inicio 2, 3, 4, ...:
  ├─ App carga
  ├─ Lee device_id de localStorage
  ├─ Lee terminal_id de localStorage
  ├─ Valida: device_id + terminal_id
  ├─ Servidor confirma: vinculación válida
  ├─ Salta TerminalSetup
  ├─ Muestra LoginScreen
  ├─ Usuario ingresa PIN
  ├─ Crea sesión
  └─ Navega a /pos ✅
```

---

## Implementación Propuesta

### 1. Generar Device ID (UNA SOLA VEZ)

```typescript
// src/core/auth/device-id.ts
export function getOrCreateDeviceId(): string {
  const stored = localStorage.getItem('park_pos_device_id');
  
  if (stored) {
    return stored;
  }
  
  // Generar UUID v4
  const deviceId = crypto.randomUUID();
  localStorage.setItem('park_pos_device_id', deviceId);
  
  return deviceId;
}
```

### 2. Modificar Activación

```typescript
// En TerminalSetup.tsx
const handleActivation = async (code: string) => {
  const deviceId = getOrCreateDeviceId();
  
  const response = await fetch('/api/terminals/activate', {
    method: 'POST',
    body: JSON.stringify({
      code,
      terminal_id: pendingTerminal.id,
      device_id: deviceId,  // ← Usar device_id en lugar de fingerprint
    }),
  });
  
  // ... resto del código
};
```

### 3. Modificar Validación

```typescript
// En TerminalSetup.tsx
const handleSelect = async (id: string) => {
  const deviceId = getOrCreateDeviceId();
  
  const validateResponse = await fetch('/api/terminals/validate', {
    method: 'POST',
    body: JSON.stringify({
      terminal_id: id,
      device_id: deviceId,  // ← Usar device_id
    }),
  });
  
  if (validateResponse.ok) {
    // Terminal ya está vinculado a este dispositivo
    // Navegar directamente a /pos
    window.location.href = '/pos';
    return;
  }
  
  // Si no está vinculado, mostrar pantalla de activación
  setView('activation');
};
```

### 4. Modificar Servidor

```typescript
// En /api/terminals/activate
export async function POST(request: NextRequest) {
  const { code, terminal_id, device_id } = await request.json();
  
  // Validar código
  const activationCode = await prisma.activation_codes.findFirst({
    where: { code, used: false }
  });
  
  if (!activationCode) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
  }
  
  // Vincular device_id a terminal
  await prisma.terminal_devices.update({
    where: { terminal_id },
    data: {
      device_id: device_id,  // ← Guardar device_id
      status: 'active',
      bound_at: new Date(),
    },
  });
  
  // Marcar código como usado
  await prisma.activation_codes.update({
    where: { id: activationCode.id },
    data: { used: true },
  });
  
  return NextResponse.json({ success: true });
}
```

---

## Comparación: Antes vs Después

### ANTES (Actual - Incorrecto)

```
Inicio 1: Código ✅
Inicio 2: Código ❌ (debería ser PIN)
Inicio 3: Código ❌ (debería ser PIN)
Inicio 4: Código ❌ (debería ser PIN)
```

### DESPUÉS (Propuesto - Correcto)

```
Inicio 1: Código ✅
Inicio 2: PIN ✅
Inicio 3: PIN ✅
Inicio 4: PIN ✅
```

---

## Cambios Necesarios en BD

### Agregar columna device_id a terminal_devices

```sql
ALTER TABLE terminal_devices ADD COLUMN device_id TEXT UNIQUE;

CREATE INDEX idx_terminal_devices_device_id ON terminal_devices(device_id);
```

### Migración Prisma

```prisma
model terminal_devices {
  id                    String    @id @default(cuid())
  terminal_id           String
  tenant_id             String
  device_id             String?   @unique  // ← NUEVO
  fingerprint_hash      String?
  fingerprint_salt      String
  status                String    @default("pending")
  bound_at              DateTime?
  last_seen_at          DateTime  @default(now())
  last_fingerprint_check DateTime @default(now())
  drift_score           Int       @default(0)
  location_id           String
  device_name           String
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  
  @@unique([tenant_id, terminal_id])
  @@index([device_id])
}
```

---

## Beneficios de Esta Solución

✅ **Código se pide UNA SOLA VEZ**  
✅ **Inicios posteriores solo piden PIN**  
✅ **Funciona offline**  
✅ **Identificador único por dispositivo**  
✅ **Compatible con todos los navegadores**  
✅ **Más rápido (no genera fingerprint cada vez)**  
✅ **Más seguro (device_id no cambia)**  

---

## Resumen

**Problema:** Código se pide cada vez porque se genera fingerprint nuevo cada inicio

**Solución:** Usar Device ID persistente en lugar de fingerprint

**Impacto:** 
- Mejor UX (solo PIN después de primera activación)
- Más rápido (no genera fingerprint)
- Más seguro (identificador único)

**Tiempo de implementación:** 2-3 horas

---

**Documento creado:** 2 Febrero 2026  
**Prioridad:** 🔴 ALTA - Afecta experiencia de usuario  
**Estado:** Propuesta lista para implementación
