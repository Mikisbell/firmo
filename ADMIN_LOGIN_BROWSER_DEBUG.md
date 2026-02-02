# Debuggear Login del Admin desde el Navegador

**Objetivo:** Identificar por qué el login no funciona desde el navegador, aunque el endpoint funciona correctamente.

---

## Paso 1: Preparar el Entorno

1. Asegúrate de que el servidor está corriendo:
   ```bash
   npm run dev
   ```

2. Abre el navegador en: `http://localhost:3000/admin`

3. Abre DevTools (F12)

---

## Paso 2: Revisar la Consola

1. Ve a la pestaña **Console** en DevTools
2. Limpia la consola (Ctrl+L o click en el icono de basura)
3. Intenta ingresar el PIN 1234 en el modal

**Busca estos logs:**

```
[PinModal] Submitting PIN:
  PIN value: 1234
  PIN type: string
  PIN length: 4
  Allowed roles: ['ADMIN']
[PinModal] Request body: {"pin":"1234","allowedRoles":["ADMIN"]}
```

**Si ves estos logs:**
- ✅ El frontend está enviando el PIN correctamente
- Continúa al Paso 3

**Si NO ves estos logs:**
- ❌ El PinPad no está capturando el PIN
- Verifica que estés haciendo click en los números correctamente
- Verifica que el modal está visible

---

## Paso 3: Revisar la Respuesta de la API

1. Ve a la pestaña **Network** en DevTools
2. Filtra por `session` (para ver solo requests a `/api/auth/session`)
3. Intenta ingresar el PIN 1234 nuevamente
4. Haz click en el request `session` (POST)

**Verifica:**

- **Status:** Debe ser `200` (no 401 o 400)
- **Response:** Debe ser:
  ```json
  {
    "success": true,
    "employee": {
      "id": "00000000-0000-0000-0000-000000000001",
      "name": "Admin Principal",
      "role": "ADMIN"
    }
  }
  ```

**Si ves status 200 y response correcta:**
- ✅ El backend está respondiendo correctamente
- Continúa al Paso 4

**Si ves status 401:**
- ❌ El PIN es inválido
- Verifica que escribiste 1234 correctamente
- Verifica que no hay intentos fallidos previos (lockout)

---

## Paso 4: Revisar la Cookie

1. Ve a la pestaña **Application** en DevTools
2. En el lado izquierdo, ve a **Cookies**
3. Selecciona `http://localhost:3000`
4. Busca la cookie `auth_token`

**Verifica:**

- ¿Existe la cookie `auth_token`?
- ¿Tiene un valor largo (JWT)?
- ¿El atributo `HttpOnly` está marcado?
- ¿El atributo `SameSite` es `Lax`?

**Si la cookie existe y tiene valor:**
- ✅ El backend estableció la cookie correctamente
- Continúa al Paso 5

**Si la cookie NO existe:**
- ❌ El backend no estableció la cookie
- Verifica que el response tiene `Set-Cookie` header
- Verifica que `credentials: 'include'` está en el fetch del frontend

---

## Paso 5: Revisar el Contexto de Autenticación

1. Ve a la pestaña **Console** en DevTools
2. Ejecuta este comando:
   ```javascript
   // Esto debería mostrar el estado del contexto
   // Si el login fue exitoso, debería mostrar los datos del empleado
   console.log('Checking auth state...');
   ```

3. Intenta ingresar el PIN nuevamente
4. Busca en la consola si hay algún error después del login

**Busca estos logs:**

```
[PinModal] Submitting PIN:
  PIN value: 1234
  ...
[PinModal] Request body: {"pin":"1234","allowedRoles":["ADMIN"]}
```

Seguido de:

```
// No debería haber error aquí
// Si hay error, verifica el mensaje
```

---

## Paso 6: Verificar Redirección

1. Después de ingresar el PIN correctamente, ¿qué sucede?

**Opciones:**

A. **Se cierra el modal y ves el dashboard**
   - ✅ Login exitoso
   - El problema está resuelto

B. **Se cierra el modal pero vuelve a aparecer**
   - ❌ El contexto no se actualiza
   - Verifica que `login()` se llama en `handleAuthSuccess()`
   - Verifica que `isAuthenticated` se actualiza

C. **El modal se queda abierto con error**
   - ❌ Hay un error en la respuesta
   - Verifica el mensaje de error en la consola
   - Verifica que el PIN es correcto

D. **No pasa nada**
   - ❌ El fetch no se completa
   - Verifica que hay conexión a internet
   - Verifica que el servidor está corriendo
   - Verifica que no hay CORS error

---

## Paso 7: Revisar Errores de CORS

1. Ve a la pestaña **Console** en DevTools
2. Busca errores que digan "CORS" o "Cross-Origin"

**Si ves error CORS:**
- ❌ El servidor no permite requests desde el navegador
- Verifica que `handleCorsPreflightRequest()` está en el endpoint
- Verifica que el header `Access-Control-Allow-Origin` está presente

---

## Checklist de Debugging

Marca cada paso mientras lo completes:

- [ ] Servidor corriendo (`npm run dev`)
- [ ] DevTools abierto (F12)
- [ ] Consola limpia
- [ ] Logs `[PinModal]` aparecen cuando ingreso PIN
- [ ] Request a `/api/auth/session` aparece en Network
- [ ] Status es 200
- [ ] Response tiene `success: true`
- [ ] Cookie `auth_token` existe
- [ ] Cookie tiene valor JWT
- [ ] No hay errores en la consola
- [ ] Modal se cierra después del login
- [ ] Dashboard se muestra

---

## Comandos Útiles en la Consola

```javascript
// Ver el estado actual de la sesión
fetch('/api/auth/session', { 
  method: 'GET',
  credentials: 'include'
}).then(r => r.json()).then(console.log);

// Ver todas las cookies
console.log(document.cookie);

// Ver si hay errores de red
// (Abre la pestaña Network y intenta login)
```

---

## Próximos Pasos

Después de completar este debugging:

1. **Si todo funciona:**
   - El problema está resuelto
   - Documenta qué estaba mal
   - Haz commit de los cambios

2. **Si algo no funciona:**
   - Toma screenshot de los logs
   - Copia el error exacto
   - Crea un issue con los detalles

---

## Información Útil

**Archivos relevantes:**
- `src/app/admin/layout.tsx` - Donde se abre el PinModal
- `src/components/inventory/PinModal.tsx` - Modal de PIN
- `src/components/auth/PinPad.tsx` - Componente de entrada
- `src/app/admin/context/AuthContext.tsx` - Contexto de autenticación
- `src/app/api/auth/session/route.ts` - Endpoint de autenticación

**Logs esperados en el servidor:**
```
[Session API] POST request received
[Session API] Calling authenticate()...
[authenticate] Starting authentication
[authenticate] Authentication successful - creating session and token
[Session API] Auth result: { success: true, error: undefined }
POST /api/auth/session 200
```

---

**Última actualización:** 2 de Febrero, 2026
