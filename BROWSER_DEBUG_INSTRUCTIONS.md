# 🔍 Instrucciones de Debug en el Navegador

El backend funciona perfectamente (✅ 200 OK), pero el cookie no persiste entre solicitudes.

## Paso 1: Abre DevTools (F12)

1. Presiona **F12** para abrir Developer Tools
2. Ve a la pestaña **Console**

## Paso 2: Intenta el login

1. Ve a `http://localhost:3000/admin/terminales`
2. Debería aparecer un modal de PIN
3. Ingresa: **1234**
4. Presiona Enter

## Paso 3: Observa la consola

Deberías ver logs como:
```
[PinModal] Submitting PIN:
  PIN value: 1234
  PIN type: string
  PIN length: 4
  Allowed roles: ["ADMIN", "OWNER"]
```

## Paso 4: Revisa la pestaña Network

1. Ve a la pestaña **Network** en DevTools
2. Busca la solicitud `session` (POST)
3. Haz clic en ella
4. Ve a la pestaña **Response Headers**
5. Busca `set-cookie`

**Debería ver algo como:**
```
set-cookie: auth_token=eyJhbGciOiJIUzI1NiJ9...; Path=/; HttpOnly; SameSite=Lax
```

## Paso 5: Revisa la pestaña Application

1. Ve a la pestaña **Application** (o **Storage** en Firefox)
2. Expande **Cookies**
3. Selecciona `http://localhost:3000`
4. Busca `auth_token`

**Debería estar allí después del login**

## Paso 6: Si el cookie NO aparece

Si el cookie NO aparece en Application → Cookies, entonces:

1. El servidor NO está enviando el cookie correctamente
2. O el navegador lo está rechazando por CORS/SameSite

**Solución:**
- Verifica que `secure: false` en desarrollo
- Verifica que `sameSite: 'lax'` (no 'strict')
- Verifica que `path: '/'`

## Paso 7: Si el cookie SÍ aparece

Si el cookie aparece pero el login falla:

1. El cookie se establece correctamente
2. Pero el frontend no lo está enviando en la siguiente solicitud
3. O el frontend no está procesando la respuesta correctamente

**Solución:**
- Verifica que `credentials: 'include'` en el fetch
- Verifica que el modal se cierra después del login
- Verifica que el usuario es redirigido al dashboard

## Paso 8: Revisa los logs del servidor

En la terminal donde corre `npm run dev`, deberías ver:

```
[Session API] POST request received
  PIN: 1234
  PIN type: string
  PIN length: 4
  Allowed roles: ["ADMIN","OWNER"]
[Session API] Tenant ID: 00000000-0000-0000-0000-000000000000
[Session API] Metadata: { ip: '::1', userAgent: '...', terminalId: 'admin-panel' }
[Session API] Calling authenticate()...
[authenticate] Starting authentication
  PIN received: 1234
  PIN type: string
  PIN length: 4
  Tenant ID: 00000000-0000-0000-0000-000000000000
  Allowed roles: ["ADMIN","OWNER"]
  PIN hash calculated: 7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558
  Lockout check: { locked: false, attempts: 0 }
[authenticate] Searching for employee with PIN hash...
  Employee found: Admin Principal
  Employee ID: 00000000-0000-0000-0000-000000000001
  Employee role: ADMIN
  Employee active: true
[authenticate] Checking role authorization...
  Employee role: ADMIN
  Allowed roles: ["ADMIN","OWNER"]
  Role allowed: true
[authenticate] Authentication successful - creating session and token
  Session created: { sessionId: '...', expiresAt: ... }
[Session API] Auth result: { success: true, error: undefined }
[Session API] Setting cookie:
  Token exists: true
  Token length: 395
[Session API] Cookie set successfully
```

## Paso 9: Reporta lo que ves

Dime exactamente:

1. ¿Aparece el modal de PIN?
2. ¿Qué ves en la consola cuando ingresas 1234?
3. ¿Aparece el cookie en Application → Cookies?
4. ¿Qué ves en la pestaña Network para la solicitud POST?
5. ¿Qué ves en los logs del servidor?
6. ¿Se cierra el modal después de ingresar el PIN?
7. ¿Eres redirigido al dashboard?

Con esta información podré diagnosticar exactamente dónde está el problema.
