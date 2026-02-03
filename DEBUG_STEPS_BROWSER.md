# 🔍 Pasos de Debug en el Navegador

El backend está 100% funcional. Ahora necesitamos verificar qué está pasando en el navegador.

## Paso 1: Abre el navegador

1. Ve a `http://localhost:3000/admin/terminales`
2. Presiona **F12** para abrir DevTools
3. Ve a la pestaña **Console**

## Paso 2: Intenta hacer login

1. Debería aparecer un modal de PIN
2. Ingresa: **1234**
3. Presiona Enter o el botón de confirmar

## Paso 3: Observa la consola

Deberías ver logs como estos:

```
[PinModal] Submitting PIN:
  PIN value: 1234
  PIN type: string
  PIN length: 4
  Allowed roles: ["ADMIN", "OWNER"]
[PinModal] Request body: {"pin":"1234","allowedRoles":["ADMIN","OWNER"]}
[PinModal] Response received:
  Status: 200
  OK: true
  Headers: {contentType: 'application/json', setCookie: null}
[PinModal] Response data: {success: true, employee: {…}}
[PinModal] Authentication successful!
  Employee: {id: '00000000-0000-0000-0000-000000000001', name: 'Admin Principal', role: 'ADMIN'}
[PinModal] Calling onSuccess()...
[AdminLayout] handleAuthSuccess called with: {id: '00000000-0000-0000-0000-000000000001', name: 'Admin Principal', role: 'ADMIN'}
[AdminLayout] login() called, setting showPinModal to false
[AdminLayout] showPinModal set to false
[AuthContext] login() called with: {id: '00000000-0000-0000-0000-000000000001', name: 'Admin Principal', role: 'ADMIN'}
[AuthContext] setEmployee() called
[AuthContext] setPermissions() called
[AuthContext] setIsAuthenticated(true) called
[PinModal] onSuccess() completed
```

## Paso 4: Copia EXACTAMENTE lo que ves en la consola

Después de ingresar el PIN, copia TODO lo que aparece en la consola y pégalo aquí.

**Importante**: Si ves errores en rojo, cópialos también.

## Paso 5: Revisa la pestaña Network

1. Ve a la pestaña **Network** en DevTools
2. Busca la solicitud `session` (POST)
3. Haz clic en ella
4. Ve a la pestaña **Response Headers**
5. Busca `set-cookie`

**Debería ver algo como:**
```
set-cookie: auth_token=eyJhbGciOiJIUzI1NiJ9...; Path=/; HttpOnly; SameSite=Lax
```

Copia exactamente lo que ves.

## Paso 6: Revisa la pestaña Application

1. Ve a la pestaña **Application** (o **Storage** en Firefox)
2. Expande **Cookies** en el lado izquierdo
3. Selecciona `http://localhost:3000`
4. Busca `auth_token`

**¿Aparece el cookie `auth_token`?**
- Si SÍ → El cookie se guardó correctamente
- Si NO → El navegador rechazó el cookie

Si aparece, copia el valor (primeras 50 caracteres).

## Paso 7: Revisa los logs del servidor

En la terminal donde corre `npm run dev`, deberías ver logs como:

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
[Session API] Cookie config: {
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  maxAge: 28800,
  path: '/',
  NODE_ENV: 'development'
}
```

Copia estos logs también.

## Paso 8: Reporta lo que ves

Dime exactamente:

1. **¿Aparece el modal de PIN?** (SÍ/NO)
2. **¿Qué ves en la consola después de ingresar 1234?** (Copia los logs)
3. **¿Aparece el cookie `auth_token` en Application → Cookies?** (SÍ/NO)
4. **¿Qué dice en Response Headers → set-cookie?** (Copia exactamente)
5. **¿Se cierra el modal después de ingresar el PIN?** (SÍ/NO)
6. **¿Eres redirigido al dashboard?** (SÍ/NO)
7. **¿Qué ves en los logs del servidor?** (Copia los logs)
8. **¿Hay errores en rojo en la consola?** (SÍ/NO - si SÍ, cópialos)

Con esta información podré diagnosticar exactamente dónde está el problema en 5 minutos.

## Paso 9: Alternativa - Usa el script de test

Si prefieres, también puedes ejecutar:

```bash
node scripts/test-frontend-pin-flow.mjs
```

Este script simula exactamente lo que hace el navegador y te mostrará si el problema es del navegador o del servidor.

---

**IMPORTANTE**: No hagas nada más hasta que me reportes lo que ves. Necesito esta información para diagnosticar el problema.
