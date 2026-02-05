# 🔴 PROBLEMA CRÍTICO: Frontend-Backend Mismatch en Login

**Fecha:** 5 Febrero 2026  
**Status:** 🔴 BLOQUEANTE  
**Impacto:** Login completamente roto en producción

---

## 🎯 Problema Identificado

El **frontend y backend NO están sincronizados**. Están usando diferentes contratos de API.

### Frontend Envía (LoginScreen.tsx)

```typescript
{
  tenant_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  terminal_id: "ADMIN_PANEL",
  pin: "1234",
  fingerprint: {                    // ❌ OBJETO
    hash: "...",
    signals: {},
    signalCount: 14,
    timestamp: 1770318453309
  },
  risk_score: 5                     // ❌ NO ESPERADO
}
```

### Backend Espera (login/route.ts)

```typescript
const LoginSchema = z.object({
  tenant_id: z.string().uuid(),
  terminal_id: z.string().optional(),
  pin: z.string().length(4),
  device_fingerprint: z.string().min(16).optional(),  // ❌ STRING, no objeto
  device_id: z.string().uuid().optional(),
  mac_address: z.string().optional(),
});
```

## 🔍 Análisis Detallado

### 1. Campo `fingerprint` vs `device_fingerprint`

**Frontend:**
```typescript
fingerprint: {
  hash: "...",
  signals: {},
  signalCount: 14,
  timestamp: 1770318453309
}
```

**Backend esperado:**
```typescript
device_fingerprint: "string-hash-here"  // Solo el hash como string
```

### 2. Campo `risk_score` no esperado

El frontend envía `risk_score: 5` pero el backend no lo espera en el schema.

### 3. Campos faltantes

El backend espera (opcionales):
- `device_id`: UUID del dispositivo
- `mac_address`: Dirección MAC para validación híbrida

El frontend NO los envía.

---

## ✅ Soluciones Posibles

### Opción A: Actualizar Frontend (RECOMENDADO)

Modificar `LoginScreen.tsx` para enviar el formato correcto:

```typescript
// ANTES (incorrecto)
body: JSON.stringify({
  tenant_id: terminal.tenant_id,
  terminal_id: terminal.terminal_id,
  pin,
  fingerprint: {
    hash: fingerprint.hash,
    signals: fingerprint.signals,
    signalCount: fingerprint.signalCount,
    timestamp: fingerprint.timestamp,
  },
  risk_score: riskAssessment.score,
}),

// DESPUÉS (correcto)
body: JSON.stringify({
  tenant_id: terminal.tenant_id,
  terminal_id: terminal.terminal_id,
  pin,
  device_fingerprint: fingerprint.hash,  // Solo el hash
  device_id: terminal.terminal_id,       // Usar terminal_id como device_id
  // mac_address es opcional
}),
```

### Opción B: Actualizar Backend

Modificar el schema para aceptar el formato actual del frontend:

```typescript
const LoginSchema = z.object({
  tenant_id: z.string().uuid(),
  terminal_id: z.string().optional(),
  pin: z.string().length(4),
  fingerprint: z.object({              // Aceptar objeto
    hash: z.string(),
    signals: z.any(),
    signalCount: z.number(),
    timestamp: z.number(),
  }).optional(),
  device_fingerprint: z.string().min(16).optional(),
  device_id: z.string().uuid().optional(),
  mac_address: z.string().optional(),
  risk_score: z.number().optional(),   // Aceptar risk_score
});
```

Luego extraer el hash:
```typescript
const deviceFingerprint = data.fingerprint?.hash || data.device_fingerprint;
```

---

## 🚀 Implementación Recomendada

### Paso 1: Fix Frontend (Más Simple)

Actualizar `src/components/auth/LoginScreen.tsx`:

```typescript
// Línea ~71-90
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: terminal.tenant_id,
    terminal_id: terminal.terminal_id,
    pin,
    device_fingerprint: fingerprint.hash,  // ✅ Solo el hash
    device_id: terminal.terminal_id,       // ✅ Agregar device_id
  }),
});
```

### Paso 2: Rebuild y Deploy

```bash
npm run build
git add .
git commit -m "fix: frontend login payload to match backend schema"
git push
```

Vercel rebuildeará automáticamente.

---

## 🔧 Fix Temporal: Actualizar Backend

Si no quieres tocar el frontend, puedo actualizar el backend para aceptar ambos formatos.

---

## 📊 Verificación

Después del fix, el payload debería ser:

```json
{
  "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "terminal_id": "ADMIN_PANEL",
  "pin": "1234",
  "device_fingerprint": "abc123...",
  "device_id": "ADMIN_PANEL"
}
```

Y el backend debería:
1. ✅ Validar el schema correctamente
2. ✅ Buscar el empleado por PIN hash
3. ✅ Retornar token JWT
4. ✅ Login exitoso

---

## 🎯 Decisión Requerida

**¿Qué prefieres?**

1. **Opción A:** Actualizo el frontend (más limpio, sigue el contrato del backend)
2. **Opción B:** Actualizo el backend (más rápido, pero acepta formato legacy)

Ambas opciones funcionarán. La Opción A es más correcta arquitectónicamente.

---

**Última actualización:** 5 Febrero 2026 - 00:15  
**Status:** 🔴 ESPERANDO DECISIÓN
