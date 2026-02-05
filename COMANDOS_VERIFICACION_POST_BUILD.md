# 🧪 Comandos de Verificación Post-Build

**Ejecutar DESPUÉS de que Vercel complete el build**

---

## 1️⃣ Verificar PIN_SALT en Producción

```bash
curl https://parkperu.vercel.app/api/debug/env
```

### ✅ Resultado Esperado

```json
{
  "pin_salt_configured": true,
  "pin_salt_value": "PARK_POS_2026_",
  "pin_salt_length": 15,
  "test_pin_hash": "7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558",
  "node_env": "production",
  "warning": "DELETE THIS ENDPOINT IMMEDIATELY AFTER DEBUGGING"
}
```

### ✅ Verificaciones Críticas

- `pin_salt_value` debe ser exactamente: `"PARK_POS_2026_"`
- `test_pin_hash` debe ser: `"7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558"`

Si estos valores coinciden → ✅ PIN_SALT correcto, login debería funcionar

---

## 2️⃣ Probar Login en Navegador

### Abrir URL

```
https://parkperu.vercel.app/
```

### Ingresar Credenciales

```
PIN: 1234
```

### ✅ Resultado Esperado

- ✅ No hay error 401
- ✅ No hay mensaje "PIN inválido"
- ✅ Redirige al dashboard/módulo
- ✅ Nombre de usuario visible en UI

### ❌ Si Falla

Abrir DevTools (F12) → Console y buscar:
```
POST /api/auth/login 401 (Unauthorized)
```

Copiar el error completo y reportar.

---

## 3️⃣ Verificar Console Logs (DevTools)

### Abrir DevTools

1. Presionar `F12` en el navegador
2. Ir a tab **Console**
3. Limpiar console (icono 🚫)
4. Intentar login con PIN 1234

### ✅ Logs Esperados

```
✅ FINGERPRINT_V2_GENERATED
✅ RISK_ASSESSMENT completed
✅ POST /api/auth/login 200 OK
✅ Login successful
```

### ❌ Logs de Error

Si ves:
```
❌ POST /api/auth/login 401 (Unauthorized)
❌ Error: PIN inválido
```

Entonces hay un problema. Reportar el error completo.

---

## 4️⃣ Verificar Cookies (DevTools)

### Abrir DevTools

1. Presionar `F12`
2. Ir a tab **Application** (Chrome) o **Storage** (Firefox)
3. Expandir **Cookies**
4. Seleccionar `https://parkperu.vercel.app`

### ✅ Cookie Esperada

Debe existir una cookie llamada:
```
auth_token
```

Con propiedades:
- `HttpOnly`: true
- `Secure`: true
- `SameSite`: Lax
- `Value`: (string largo JWT)

Si la cookie existe → ✅ Login exitoso

---

## 5️⃣ Eliminar Debug Endpoint (CRÍTICO)

**IMPORTANTE:** Después de verificar que el login funciona, DEBES eliminar el endpoint de debug.

### Comandos

```bash
# 1. Eliminar archivo
rm src/app/api/debug/env/route.ts

# 2. Verificar que se eliminó
git status

# 3. Commit
git add src/app/api/debug/env/route.ts
git commit -m "security: remove debug endpoint after PIN_SALT verification"

# 4. Push
git push
```

### Verificar Eliminación

Después del redeploy de Vercel (~2 min), verificar que el endpoint ya no existe:

```bash
curl https://parkperu.vercel.app/api/debug/env
```

### ✅ Resultado Esperado

```
404 Not Found
```

---

## 6️⃣ Smoke Tests Básicos

### Test 1: Login

- [ ] Abrir https://parkperu.vercel.app/
- [ ] Ingresar PIN 1234
- [ ] Verificar login exitoso

### Test 2: Navegación

- [ ] Verificar que el dashboard carga
- [ ] Verificar que el nombre de usuario es visible
- [ ] Verificar que el menú funciona

### Test 3: Módulos

- [ ] Probar abrir módulo Caja
- [ ] Probar abrir módulo Mesero
- [ ] Probar abrir módulo KDS
- [ ] Probar abrir Admin Panel

### Test 4: Logout

- [ ] Click en botón de logout
- [ ] Verificar que redirige a login
- [ ] Verificar que cookie se eliminó

---

## 📊 Checklist Completo

### Verificación Técnica

- [ ] `curl /api/debug/env` retorna PIN_SALT correcto
- [ ] `test_pin_hash` coincide con hash esperado
- [ ] Login con PIN 1234 funciona
- [ ] Cookie `auth_token` se establece
- [ ] No hay errores 401 en console
- [ ] Debug endpoint eliminado
- [ ] Endpoint retorna 404 después de eliminar

### Smoke Tests

- [ ] Login funciona
- [ ] Dashboard carga
- [ ] Navegación funciona
- [ ] Módulos cargan
- [ ] Logout funciona

---

## 🚨 Troubleshooting

### Problema: PIN_SALT incorrecto

**Síntoma:**
```json
{
  "pin_salt_value": "IrSv/3gTZtidQCQun6guBi8mkZLu7lmkOoJMFQqc8EU="
}
```

**Solución:**
1. Ir a Vercel Dashboard
2. Settings → Environment Variables
3. Editar `PIN_SALT` a `PARK_POS_2026_`
4. Redeploy

### Problema: Login falla con 401

**Síntoma:**
```
POST /api/auth/login 401 (Unauthorized)
Error: PIN inválido
```

**Diagnóstico:**
```bash
# Verificar hash en producción
curl https://parkperu.vercel.app/api/debug/env

# Verificar lockout
npx tsx scripts/check-production-employees.ts

# Limpiar lockout si es necesario
npx tsx scripts/clear-lockout-production.ts
```

### Problema: Cookie no se establece

**Síntoma:**
- Login retorna 200 OK
- Pero cookie `auth_token` no aparece

**Diagnóstico:**
1. Verificar que el dominio es correcto
2. Verificar que HTTPS está habilitado
3. Verificar que SameSite está configurado

---

## 📝 Notas

### Tiempo Estimado

- Verificación PIN_SALT: 10 segundos
- Probar login: 30 segundos
- Verificar cookies: 30 segundos
- Eliminar endpoint: 2 minutos
- Smoke tests: 5 minutos

**Total:** ~8 minutos

### Orden de Ejecución

1. ✅ Verificar PIN_SALT (crítico)
2. ✅ Probar login (crítico)
3. ✅ Verificar cookies (importante)
4. ✅ Eliminar endpoint (seguridad)
5. ✅ Smoke tests (validación)

---

**Última actualización:** 5 Febrero 2026  
**Status:** 📋 READY TO EXECUTE  
**Ejecutar:** Después de que Vercel complete el build

