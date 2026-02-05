# 🔴 PROBLEMA CRÍTICO: PIN_SALT en Vercel

**Fecha:** 5 Febrero 2026  
**Status:** 🔴 BLOQUEANTE  
**Impacto:** Login completamente roto en producción

---

## 🎯 Problema Real

El `PIN_SALT` configurado en Vercel es **diferente** al que se usó para generar los hashes de PIN en la base de datos.

### Evidencia

1. **Hash en DB (Admin Principal):**
   ```
   7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558
   ```

2. **SALT que genera ese hash:**
   ```
   PARK_POS_2026_
   ```

3. **Cálculo:**
   ```typescript
   SHA256("PARK_POS_2026_" + "1234") 
   = 7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558
   ```

4. **Problema:**
   - Vercel probablemente tiene un `PIN_SALT` diferente
   - Cuando calcula el hash con su SALT, no coincide con el hash en DB
   - Resultado: "PIN inválido"

---

## 🔍 Diagnóstico

### Endpoint de Debug Creado

He creado un endpoint temporal para verificar el `PIN_SALT` en Vercel:

```
GET https://parkperu.vercel.app/api/debug/env
```

**Response esperado:**
```json
{
  "pin_salt_configured": true/false,
  "pin_salt_value": "ACTUAL_VALUE_IN_VERCEL",
  "pin_salt_length": 15,
  "test_pin_hash": "hash_calculado_con_salt_de_vercel",
  "node_env": "production",
  "warning": "DELETE THIS ENDPOINT IMMEDIATELY AFTER DEBUGGING"
}
```

### Cómo Usar

1. Esperar que Vercel termine el rebuild (~2-3 min)
2. Abrir: https://parkperu.vercel.app/api/debug/env
3. Comparar `test_pin_hash` con el hash en DB
4. Si NO coinciden → Actualizar `PIN_SALT` en Vercel

---

## ✅ Solución

### Opción A: Actualizar PIN_SALT en Vercel (RECOMENDADO)

1. **Ir a Vercel Dashboard**
   - https://vercel.com/dashboard
   - Seleccionar proyecto "parkperu"

2. **Settings → Environment Variables**
   - Buscar `PIN_SALT`
   - Actualizar valor a: `PARK_POS_2026_`
   - Aplicar a: Production, Preview, Development

3. **Redeploy**
   - Vercel rebuildeará automáticamente
   - O forzar redeploy desde Deployments tab

### Opción B: Regenerar Hashes en DB

Si no puedes cambiar el `PIN_SALT` en Vercel, regenerar todos los hashes:

```typescript
// Script para regenerar hashes con el SALT de Vercel
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const VERCEL_SALT = 'SALT_ACTUAL_DE_VERCEL'; // Del endpoint /api/debug/env

async function regenerateHashes() {
  const employees = await prisma.employees.findMany();
  
  for (const emp of employees) {
    // Asumiendo que conoces los PINs originales
    const pin = '1234'; // Ejemplo
    const newHash = crypto.createHash('sha256')
      .update(VERCEL_SALT + pin)
      .digest('hex');
    
    await prisma.employees.update({
      where: { id: emp.id },
      data: { pin_hash: newHash },
    });
  }
}
```

**PROBLEMA:** No conocemos los PINs originales, solo los hashes.

---

## 🚨 Acciones Inmediatas

### 1. Verificar PIN_SALT en Vercel

```bash
# Después del rebuild, ejecutar:
curl https://parkperu.vercel.app/api/debug/env
```

### 2. Comparar Hashes

```typescript
// Hash en DB
const dbHash = "7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558";

// Hash de Vercel (del endpoint)
const vercelHash = response.test_pin_hash;

if (dbHash === vercelHash) {
  console.log("✅ SALT correcto");
} else {
  console.log("❌ SALT incorrecto - actualizar en Vercel");
}
```

### 3. Actualizar PIN_SALT en Vercel

Si los hashes NO coinciden:

1. Ir a Vercel Dashboard
2. Settings → Environment Variables
3. Actualizar `PIN_SALT` a `PARK_POS_2026_`
4. Redeploy

### 4. Limpiar Lockout

```bash
npx tsx scripts/clear-lockout-production.ts
```

### 5. Probar Login

```
URL: https://parkperu.vercel.app/
PIN: 1234
```

---

## 📊 Timeline

| Tiempo | Acción | Status |
|--------|--------|--------|
| 00:00 | Identificado problema de SALT | ✅ |
| 00:05 | Creado endpoint de debug | ✅ |
| 00:10 | Pusheado a GitHub | ✅ |
| 00:12 | Vercel rebuilding | 🟡 |
| 00:15 | Verificar endpoint /api/debug/env | ⏳ |
| 00:20 | Actualizar PIN_SALT en Vercel | ⏳ |
| 00:25 | Probar login | ⏳ |

---

## 🔐 Seguridad

**IMPORTANTE:** El endpoint `/api/debug/env` expone el `PIN_SALT`.

**Acciones post-fix:**

1. ✅ Verificar que el login funciona
2. ✅ Eliminar el endpoint de debug
3. ✅ Commit y push del delete
4. ✅ Verificar que el endpoint ya no existe

```bash
# Después de fix
rm src/app/api/debug/env/route.ts
git add src/app/api/debug/env/route.ts
git commit -m "security: remove debug endpoint"
git push
```

---

## 📝 Lecciones Aprendidas

### 1. Environment Variables Críticas

El `PIN_SALT` es **crítico** para la seguridad:
- Debe ser el mismo en todos los ambientes
- Debe estar documentado
- Debe estar en `.env.example`
- Cambiar el SALT invalida todos los PINs

### 2. Verificación Pre-Deploy

Antes de deployment:
- ✅ Verificar que todas las env vars coinciden
- ✅ Probar localmente con valores de producción
- ✅ Documentar valores esperados
- ✅ Crear scripts de verificación

### 3. Debug Endpoints

Para debugging de producción:
- ✅ Crear endpoints temporales
- ✅ Proteger con autenticación
- ✅ Eliminar inmediatamente después de fix
- ✅ Nunca exponer secretos en logs

---

## 🎯 Próximos Pasos

1. **Esperar Vercel Build** (~2-3 min)
2. **Verificar Endpoint** https://parkperu.vercel.app/api/debug/env
3. **Actualizar PIN_SALT** en Vercel si es necesario
4. **Limpiar Lockout** con script
5. **Probar Login** con PIN 1234
6. **Eliminar Debug Endpoint** después de fix

---

**Última actualización:** 5 Febrero 2026 - 00:30  
**Commit:** aa72c79  
**Status:** 🟡 WAITING FOR VERCEL BUILD
