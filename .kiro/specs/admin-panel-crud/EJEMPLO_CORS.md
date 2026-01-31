# Ejemplo de Implementación CORS

## 📋 Resumen

CORS (Cross-Origin Resource Sharing) permite que el frontend (corriendo en un dominio) haga requests al backend API (corriendo en otro dominio).

**Implementado en:**
- `next.config.js` - Configuración global de headers
- `src/lib/cors-helpers.ts` - Helpers para preflight requests
- `.env` - Variable `ALLOWED_ORIGINS`

---

## 🔧 Configuración

### 1. Variables de Entorno

```bash
# .env
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"

# .env.production
ALLOWED_ORIGINS="https://parkpos.pe,https://www.parkpos.pe,https://admin.parkpos.pe"
```

### 2. Next.js Config

```javascript
// next.config.js
async headers() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000'];

  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
        { key: 'Access-Control-Allow-Origin', value: allowedOrigins.join(',') },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: '...' },
        { key: 'Access-Control-Max-Age', value: '86400' }, // 24 hours
      ],
    },
  ];
}
```

---

## 📝 Uso en Endpoints

### Opción 1: Solo agregar OPTIONS handler (Recomendado)

```typescript
// src/app/api/admin/employees/route.ts
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';

// Handle CORS preflight request
export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

export async function GET() {
  // Tu lógica normal
  // Los headers CORS se agregan automáticamente por next.config.js
}

export async function POST() {
  // Tu lógica normal
}
```

### Opción 2: Agregar headers manualmente (Si necesitas control fino)

```typescript
import { addCorsHeaders } from '@/src/lib/cors-helpers';

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // Tu lógica
  const data = await fetchData();
  
  const response = NextResponse.json(data);
  return addCorsHeaders(response, origin || undefined);
}
```

---

## ✅ Endpoints Actualizados

### Autenticación
- [x] `POST /api/auth/login` - OPTIONS handler agregado

### Admin CRUD
- [x] `GET/POST /api/admin/employees` - OPTIONS handler agregado
- [ ] `GET/PUT/DELETE /api/admin/employees/[id]` - Pendiente
- [ ] `GET/POST /api/admin/products` - Pendiente
- [ ] `GET/PUT/DELETE /api/admin/products/[id]` - Pendiente

---

## 🧪 Testing

### Test Manual con curl

```bash
# 1. Preflight request (OPTIONS)
curl -X OPTIONS http://localhost:3000/api/auth/login \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Debe retornar:
# - Status: 204 No Content
# - Header: Access-Control-Allow-Origin: http://localhost:3001
# - Header: Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
# - Header: Access-Control-Max-Age: 86400

# 2. Actual request con credenciales
curl -X POST http://localhost:3000/api/auth/login \
  -H "Origin: http://localhost:3001" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"...","terminal_id":"...","pin":"1234","device_fingerprint":"..."}' \
  -v

# Debe retornar:
# - Status: 200 OK (o 401 si credenciales incorrectas)
# - Header: Access-Control-Allow-Origin: http://localhost:3001
# - Header: Access-Control-Allow-Credentials: true
```

### Test con Postman

1. Crear request POST a `http://localhost:3000/api/auth/login`
2. En Headers, agregar: `Origin: http://localhost:3001`
3. Enviar request
4. Verificar en Console que preflight (OPTIONS) se envió automáticamente
5. Verificar headers de respuesta incluyen `Access-Control-Allow-Origin`

### Test con Frontend

```typescript
// Frontend corriendo en http://localhost:3001
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Importante para cookies
  body: JSON.stringify({
    tenant_id: '...',
    terminal_id: '...',
    pin: '1234',
    device_fingerprint: '...',
  }),
});

// Si CORS está bien configurado, no debe haber error
const data = await response.json();
console.log(data);
```

---

## 🚨 Errores Comunes

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Causa:** El origen no está en `ALLOWED_ORIGINS`

**Solución:**
```bash
# Agregar origen a .env
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:3002"
```

### Error: "CORS policy: Response to preflight request doesn't pass"

**Causa:** Falta el handler OPTIONS en el endpoint

**Solución:**
```typescript
export async function OPTIONS() {
  return handleCorsPreflightRequest();
}
```

### Error: "CORS policy: Credentials flag is 'true', but 'Access-Control-Allow-Credentials' header is ''"

**Causa:** Falta header `Access-Control-Allow-Credentials`

**Solución:** Ya está configurado en `next.config.js` y `cors-helpers.ts`

---

## 📊 Checklist de Implementación

### Configuración Base
- [x] Variable `ALLOWED_ORIGINS` en `.env`
- [x] Headers CORS en `next.config.js`
- [x] Helper `handleCorsPreflightRequest()` creado
- [x] Helper `addCorsHeaders()` creado
- [x] Helper `isOriginAllowed()` creado

### Endpoints Críticos (Prioridad Alta)
- [x] `/api/auth/login` - OPTIONS handler
- [ ] `/api/auth/session` - OPTIONS handler
- [ ] `/api/auth/logout` - OPTIONS handler
- [x] `/api/admin/employees` - OPTIONS handler
- [ ] `/api/admin/products` - OPTIONS handler
- [ ] `/api/admin/promotions` - OPTIONS handler

### Testing
- [ ] Test manual con curl (preflight)
- [ ] Test manual con curl (actual request)
- [ ] Test con Postman
- [ ] Test con frontend real
- [ ] Test con origen no permitido (debe fallar)

---

## 🎯 Próximos Pasos

1. **Agregar OPTIONS handler a todos los endpoints** (40+ endpoints)
2. **Testing completo** con diferentes orígenes
3. **Documentar en README** para el equipo
4. **Configurar para staging/production** con dominios reales

---

**Última actualización:** 20 Enero 2026  
**Completado por:** Dev 2  
**Tiempo:** 4h
