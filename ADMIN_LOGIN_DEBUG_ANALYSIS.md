# Análisis: Problema de Login del Admin

**Fecha:** 2 de Febrero, 2026  
**PIN:** 1234  
**Estado:** INVESTIGANDO

---

## Hallazgos

### ✅ Verificación del PIN en BD

Ejecuté script de debug: `scripts/test-admin-login-debug.ts`

**Resultado:**
```
✓ PIN: 1234
✓ SALT: PARK_POS_2026_
✓ Hash esperado: 7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558

✓ Admin encontrado: Admin Principal
  ID: 00000000-0000-0000-0000-000000000001
  Role: ADMIN
  Activo: true
  PIN Hash en BD: 7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558

✅ ¡Los hashes coinciden! El PIN es correcto.
```

**Conclusión:** El PIN en la BD es correcto. El problema NO está en la BD.

---

## Posibles Causas

### 1. ❓ Frontend no envía el PIN correctamente
- El componente `PinPad.tsx` captura dígitos correctamente
- El componente `PinModal.tsx` envía el PIN al endpoint `/api/auth/session`
- Hay logging en el frontend que muestra qué se envía

**Verificación necesaria:**
- Revisar la consola del navegador para ver qué PIN se envía
- Verificar que el PIN se envía como string "1234"

### 2. ❓ Endpoint `/api/auth/session` no recibe el PIN
- El endpoint espera `{ pin, allowedRoles }`
- Llama a `authenticate(prisma, tenantId, pin, allowedRoles, metadata)`

**Verificación necesaria:**
- Agregar logging en el endpoint para ver qué recibe
- Verificar que el PIN llega como string

### 3. ❓ Función `authenticate()` no encuentra el admin
- Busca: `employees.findFirst({ where: { tenant_id, pin_hash } })`
- Compara el hash del PIN recibido con el hash en BD

**Verificación necesaria:**
- Agregar logging en `authenticate()` para ver qué hash calcula
- Verificar que el SALT es correcto

### 4. ❓ Problema de roles
- El endpoint envía `allowedRoles: ['ADMIN']`
- El admin tiene `role: 'ADMIN'`
- Debería pasar la verificación de roles

**Verificación necesaria:**
- Revisar que el admin tiene role 'ADMIN' (ya verificado ✅)

---

## Pasos para Resolver

### Paso 1: Agregar Logging en el Endpoint

Actualizar `src/app/api/auth/session/route.ts` para loguear:

```typescript
console.log('[Session API] POST request received');
console.log('  PIN:', pin);
console.log('  PIN type:', typeof pin);
console.log('  PIN length:', pin?.length);
console.log('  Allowed roles:', allowedRoles);
```

### Paso 2: Agregar Logging en authenticate()

Actualizar `src/core/auth/auth.service.ts` para loguear:

```typescript
console.log('[authenticate] Starting authentication');
console.log('  PIN received:', pin);
console.log('  PIN type:', typeof pin);

const pinHash = await hashPin(pin);
console.log('  PIN hash calculated:', pinHash);

const employee = await prisma.employees.findFirst({
  where: {
    tenant_id: tenantId,
    pin_hash: pinHash,
  },
});

console.log('  Employee found:', employee?.name || 'NOT FOUND');
console.log('  Expected hash:', pinHash);
console.log('  DB hash:', employee?.pin_hash);
```

### Paso 3: Probar el Endpoint Directamente

Crear script: `scripts/test-admin-login-direct.ts`

```typescript
const response = await fetch('http://localhost:3000/api/auth/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pin: '1234',
    allowedRoles: ['ADMIN'],
  }),
});

const data = await response.json();
console.log('Response:', data);
```

### Paso 4: Revisar Consola del Navegador

Cuando intentes login en el admin panel:
1. Abre DevTools (F12)
2. Ve a la pestaña "Console"
3. Busca logs de `[PinModal]`
4. Verifica qué PIN se envía

---

## Hipótesis Más Probable

**El PIN se envía correctamente, pero hay un problema en la validación.**

Posibles razones:
1. El SALT en `.env.local` no coincide con el usado en seed
2. El PIN se envía como número en lugar de string
3. Hay un problema con la codificación de caracteres

**Verificación:**
- El debug script confirma que el SALT es correcto: `PARK_POS_2026_`
- El hash coincide exactamente
- El admin existe y está activo

---

## Próximos Pasos

1. **Agregar logging** en endpoint y authenticate()
2. **Probar el endpoint** directamente con curl/script
3. **Revisar consola del navegador** cuando intentes login
4. **Verificar que el PIN se envía como string** "1234"

---

## Información Útil

**Archivo de configuración:**
- `.env.local`: PIN_SALT="PARK_POS_2026_"

**Archivos relevantes:**
- `src/app/api/auth/session/route.ts` - Endpoint de login
- `src/core/auth/auth.service.ts` - Función authenticate()
- `src/core/auth/crypto-utils.ts` - Función hashPin()
- `src/components/inventory/PinModal.tsx` - Modal del frontend
- `src/components/auth/PinPad.tsx` - Componente de entrada de PIN

**Scripts de debug:**
- `scripts/test-admin-login-debug.ts` - Verificar PIN en BD ✅
- `scripts/test-admin-login-endpoint.ts` - Probar endpoint (crear)
- `scripts/test-admin-login-direct.ts` - Prueba directa (crear)

---

## Conclusión

El PIN en la BD es correcto. El problema está en:
1. Cómo se envía desde el frontend, O
2. Cómo se procesa en el endpoint/authenticate()

Necesitamos agregar logging para identificar dónde se pierde el PIN.

