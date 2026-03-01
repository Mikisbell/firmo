# Diseno Tecnico: Hardening 2026

## Descripcion General

Este documento especifica los cambios exactos en archivos, flujos de datos y decisiones de arquitectura para cada uno de los 30 hallazgos distribuidos en 5 fases. Todos los patrones de codigo se derivan de las convenciones existentes en el codebase de PARK POS.

---

## Fase 1 -- Correcciones CRITICAS (mismo dia)

### Hallazgo 1: Agregar `output: 'standalone'` a `next.config.js`

**Archivo:** `next.config.js`

**Ubicacion exacta del cambio:** Agregar `output: 'standalone'` como propiedad de nivel superior en el objeto `nextConfig`, inmediatamente despues de `reactStrictMode: true` (linea 12).

```js
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',  // <-- ADD HERE
    // ...
};
```

**Justificacion:** El Dockerfile (linea 44) ya copia `.next/standalone` en la imagen de produccion: `COPY --from=builder /app/.next/standalone ./`. Sin esta clave de configuracion, `next build` nunca produce el directorio standalone, por lo que el paso COPY de Docker silenciosamente no copia nada y `node server.js` falla en tiempo de ejecucion. Esta es la correccion de mayor prioridad porque bloquea todos los despliegues Docker.

**Verificacion:** `npm run build && ls .next/standalone/server.js` debe tener exito. `docker build .` debe producir una imagen ejecutable.

---

### Hallazgo 2: Agregar autenticacion a `/api/admin/audit-log`

**Archivo:** `src/app/api/admin/audit-log/route.ts`

**Estado actual:** El handler `GET` no tiene ninguna autenticacion -- acepta cualquier solicitud y devuelve eventos de auditoria directamente. Esta es una brecha de seguridad CRITICA: los logs de auditoria contienen IDs de empleados, IDs de terminales y detalles de alertas de seguridad.

**Patron a seguir:** El patron establecido de permisos admin de `src/app/api/admin/employees/route.ts`:

```typescript
import { requireAdminPermission } from '@/src/core/middleware/admin-permission';
```

Luego al inicio del handler:

```typescript
const auth = await requireAdminPermission(request, 'view_audit');
if (!auth.authorized) return auth.response;
```

**Cambios exactos:**

1. Agregar import: `import { requireAdminPermission } from '@/src/core/middleware/admin-permission';`
2. Dentro de `GET(request)`, agregar como las dos primeras lineas del bloque `try`:
   ```typescript
   const auth = await requireAdminPermission(request, 'view_audit');
   if (!auth.authorized) return auth.response;
   ```
3. Opcionalmente limitar la consulta de datos mock a `auth.user.tenantId` para aislamiento de tenant (actualmente los datos mock no tienen alcance por tenant -- esto es aceptable en la Fase 1 ya que el endpoint usa datos mock, pero deberia tener alcance cuando se agreguen consultas reales a la BD).

**Eleccion de permiso:** `view_audit` es el permiso correcto. Segun `src/app/admin/lib/permissions.ts`, este permiso se otorga a los roles OWNER, ADMIN, MANAGER y SUPERVISOR.

---

### Hallazgo 3: Reemplazar `ADMIN_API_KEY` condicional en `/api/admin/cleanup`

**Archivo:** `src/app/api/admin/cleanup/route.ts`

**Estado actual (lineas 17-25):**
```typescript
const authHeader = request.headers.get('authorization');
const adminKey = process.env.ADMIN_API_KEY;
if (adminKey && authHeader !== `Bearer ${adminKey}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Esto esta roto: cuando `ADMIN_API_KEY` no esta definido (que es el valor por defecto -- `.env.example` lo muestra comentado), toda la verificacion de autenticacion se omite. Cualquiera puede hacer POST a cleanup y eliminar eventos procesados.

**Cambios exactos:**

1. Agregar import: `import { requireAdminPermission } from '@/src/core/middleware/admin-permission';`
2. Eliminar el bloque condicional existente de `authHeader` / `adminKey` (lineas 17-25).
3. Reemplazar con:
   ```typescript
   const auth = await requireAdminPermission(request, 'manage_config');
   if (!auth.authorized) return auth.response;
   ```

**Eleccion de permiso:** `manage_config` es apropiado porque cleanup es una operacion administrativa de gestion de datos. Segun la jerarquia de permisos, solo OWNER, ADMIN y MANAGER tienen `manage_config`.

**Decision de arquitectura:** Usamos `requireAdminPermission` (basado en JWT) en lugar de autenticacion por API key porque: (a) las API keys son un segundo mecanismo de autenticacion que incrementa la superficie de ataque, (b) el patron de fallback condicional es inherentemente inseguro, (c) todas las demas rutas admin usan JWT, por lo que esto mantiene la consistencia.

---

## Fase 2 -- Endurecimiento de Seguridad

### Hallazgo 4: Agregar autenticacion a 11 rutas desprotegidas

Las 11 rutas usan el mismo patron. La eleccion de middleware (POS vs Admin) depende de quien llama la ruta:

| Ruta | Middleware | Justificacion |
|------|-----------|---------------|
| `src/app/api/delivery/[id]/route.ts` (GET) | `requirePosAuth` | Llamado por terminal POS y UI de delivery |
| `src/app/api/delivery/checkpoint2/route.ts` (POST) | `requireAdminAuth` | Endpoint de verificacion admin |
| `src/app/api/inventory/stock/route.ts` (GET) | `requirePosAuth` | Llamado por UI de inventario desde POS |
| `src/app/api/inventory/stats/route.ts` (GET) | `requirePosAuth` | Llamado por dashboard de inventario |
| `src/app/api/orders/[orderId]/lock/route.ts` (GET/POST/DELETE) | `requirePosAuth` | Llamado por terminal POS durante edicion de orden |
| `src/app/api/locations/history/[driverId]/route.ts` (GET) | `requirePosAuth` | Llamado por UI de rastreo de delivery |
| `src/app/api/push/send/route.ts` (POST) | `requireAdminAuth` | Endpoint admin de prueba para push |
| `src/app/api/push/subscribe/route.ts` (POST) | `requirePosAuth` | Llamado por app del repartidor |
| `src/app/api/push/unsubscribe/route.ts` (POST) | `requirePosAuth` | Llamado por app del repartidor |
| `src/app/api/terminals/range/route.ts` (GET/POST) | `requirePosAuth` | Llamado por terminal POS |
| `src/app/api/events/stream/route.ts` (GET) | `requirePosAuth` | Llamado por cliente SSE desde POS |

**Patron estandar de insercion de autenticacion para rutas `requirePosAuth`:**

```typescript
import { requirePosAuth } from '@/src/core/middleware/pos-auth';

export async function GET(request: NextRequest) {
  const auth = await requirePosAuth(request);
  if (!auth.authorized) return auth.response;
  // auth.user.tenantId is now available
  // auth.user.id, auth.user.role, auth.user.terminalId are also available
  // ... rest of handler
}
```

**Patron estandar de insercion de autenticacion para rutas `requireAdminAuth`:**

```typescript
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) return auth.response;
  // auth.user.tenantId, auth.user.role, etc.
  // ... rest of handler
}
```

#### Flujo de datos: extraccion de tenant_id desde JWT

Para `inventory/stock` e `inventory/stats`, el codigo actual lee `tenant_id` desde el query string:

```typescript
// CURRENT (insecure -- client controls tenant_id)
const tenantId = searchParams.get('tenant_id');
```

Despues de agregar autenticacion, reemplazar con:

```typescript
// NEW (secure -- tenant_id comes from JWT)
const auth = await requirePosAuth(request);
if (!auth.authorized) return auth.response;
const tenantId = auth.user.tenantId;
```

Eliminar la guarda `if (!tenantId)` ya que `tenantId` siempre esta presente en un JWT valido. El parametro de query `tenant_id` se sigue aceptando como alias de compatibilidad retroactiva pero DEBE validarse contra el valor del JWT:

```typescript
const queryTenantId = searchParams.get('tenant_id');
if (queryTenantId && queryTenantId !== tenantId) {
  return NextResponse.json(
    { error: 'tenant_id mismatch' },
    { status: 403 }
  );
}
```

Este mismo patron aplica a `orders/[orderId]/lock` (que lee `tenant_id` de query/body) y `terminals/range` (que lee `tenant_id` de query/body).

#### Flujo de datos: autenticacion a traves de la ruta SSE

Para `events/stream/route.ts`, el flujo de autenticacion es diferente porque las conexiones SSE son de larga duracion:

1. Agregar `requirePosAuth` al inicio de `GET`, antes de crear el stream.
2. Extraer `tenantId` de `auth.user.tenantId` en lugar de `searchParams.get('tenant_id')`.
3. El cliente SSE EventSource en `src/core/sync/client.ts` actualmente se conecta via parametros de URL. Despues de agregar autenticacion, el cliente debe pasar la cookie JWT (lo cual sucede automaticamente ya que EventSource envia cookies por defecto para solicitudes del mismo origen).

**Nota:** El cliente SSE en la linea 238 actualmente usa:
```typescript
this.eventSource = new EventSource(`/api/events/stream?tenant_id=${tenantId}`);
```
El parametro de query `tenant_id` se vuelve redundante una vez que la autenticacion lo extrae del JWT, pero lo mantenemos para compatibilidad retroactiva durante la ventana de migracion. El servidor DEBE validar que el parametro de query coincida con el `tenantId` del JWT.

#### Rastreo de conexiones SSE (Hallazgo 10)

**Archivo:** `src/app/api/events/stream/route.ts`

Agregar un `Map<string, number>` con alcance de modulo para rastrear conexiones activas por tenant:

```typescript
const activeConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_TENANT = 10;

export async function GET(req: NextRequest) {
  const auth = await requirePosAuth(req);
  if (!auth.authorized) return auth.response;
  const tenantId = auth.user.tenantId;

  // Connection cap
  const current = activeConnections.get(tenantId) ?? 0;
  if (current >= MAX_CONNECTIONS_PER_TENANT) {
    return NextResponse.json(
      { error: 'Too many SSE connections for this tenant' },
      { status: 429 }
    );
  }
  activeConnections.set(tenantId, current + 1);

  // ... create stream ...

  // In cancel() and cleanup:
  const count = activeConnections.get(tenantId) ?? 1;
  activeConnections.set(tenantId, Math.max(0, count - 1));
}
```

**Decision de arquitectura:** Un `Map` con alcance de modulo es correcto aqui porque las conexiones SSE son por proceso. En un despliegue multi-proceso (por ejemplo, cluster PM2), cada proceso rastrea sus propias conexiones. El rastreo basado en Redis es innecesario porque las conexiones SSE estan vinculadas al proceso por naturaleza. El limite `MAX_CONNECTIONS_PER_TENANT = 10` permite 10 terminales simultaneos por tenant, lo cual es generoso para una polleria.

---

### Hallazgo 5: Migrar `NEXT_PUBLIC_API_SECRET` a solo-servidor

**Archivos a modificar:**

1. `src/core/sync/client.ts` -- lineas 412 y 722
2. `.env.example` -- renombrar variable

**Estado actual:** `SyncClient` lee `process.env.NEXT_PUBLIC_API_SECRET` para establecer el header `x-api-secret`. El prefijo `NEXT_PUBLIC_` hace que Next.js empaquete este secreto en el JavaScript del lado del cliente, exponiendolo en el navegador.

**Diseno de migracion:**

El endpoint de ingesta (`src/app/api/events/ingest/route.ts` linea 567) valida:
```typescript
const secret = req.headers.get("x-api-secret");
if (secret !== process.env.PARK_API_SECRET) { ... }
```

El servidor usa `PARK_API_SECRET` (ya en `.env.example`). El cliente usa `NEXT_PUBLIC_API_SECRET`. Estos deberian ser el mismo valor.

**Enfoque:** El `SyncClient` se ejecuta en el lado del cliente (navegador). No puede acceder a variables de entorno solo del servidor. La correccion correcta es:

1. Eliminar el header `x-api-secret` de `SyncClient` por completo.
2. En su lugar, el endpoint de ingesta debe autenticarse via la misma cookie JWT usada por todos los demas endpoints (`requirePosAuth`).
3. Actualizar `src/app/api/events/ingest/route.ts` para usar `requirePosAuth` en lugar de la validacion `x-api-secret`.

**Por que esto funciona:** El `SyncClient` se ejecuta en el contexto del navegador donde el usuario ya esta autenticado con una cookie JWT. `fetch()` automaticamente envia cookies para solicitudes del mismo origen. Esto elimina la necesidad de cualquier API secret en el lado del cliente.

**Cambios exactos a `src/core/sync/client.ts`:**

1. Eliminar lineas 412-415 (uso de `apiSecret` / `NEXT_PUBLIC_API_SECRET` en `syncOnce`).
2. Eliminar el header `x-api-secret` de la llamada fetch (linea 421).
3. Eliminar lineas 722-723 (uso de `NEXT_PUBLIC_API_SECRET` en `refreshOrder`).
4. Eliminar el header `x-api-secret` de la llamada fetch de `refreshOrder` (linea 729).
5. Eliminar el fallback hardcodeado `"park_secret_mvp_2025"` (linea 723).

**Cambios exactos a `src/app/api/events/ingest/route.ts`:**

1. Reemplazar la verificacion de `x-api-secret` (lineas 566-572) con `requirePosAuth`:
   ```typescript
   const auth = await requirePosAuth(req as any);
   if (!auth.authorized) return auth.response;
   ```

**Cambios exactos a `.env.example`:**
1. Eliminar `NEXT_PUBLIC_API_SECRET` si esta presente.
2. `PARK_API_SECRET` ya esta listado -- mantenerlo para cualquier llamada servidor-a-servidor.

---

### Hallazgo 6: Remediar CVEs de npm

**Archivo:** `package.json`

**Enfoque:** Ejecutar `npm audit fix` primero. Para vulnerabilidades que no se puedan corregir automaticamente, agregar `overrides` en `package.json`:

```json
{
  "overrides": {
    "axios": ">=1.7.9",
    "rollup": ">=4.30.1",
    "minimatch": ">=3.1.2"
  }
}
```

**Decision de arquitectura:** Usar `overrides` (npm 8.3+) en lugar de `resolutions` (solo yarn) ya que el proyecto usa npm. Fijar a versiones minimas seguras en lugar de las ultimas para minimizar roturas.

---

### Hallazgo 7: Agregar Dependabot y CodeQL

**Archivo nuevo:** `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
```

**Archivo nuevo:** `.github/workflows/codeql.yml`

```yaml
name: CodeQL Analysis
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Monday at 6 AM UTC

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    strategy:
      matrix:
        language: ['javascript-typescript']
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

---

### Hallazgo 8: Restringir CSP

**Archivo:** `next.config.js` -- el header `Content-Security-Policy` (linea 134)

**El CSP actual incluye:** `'unsafe-eval'` en `script-src`. Esto permite `eval()` y APIs similares, lo cual es un vector de XSS.

**Enfoque:** Eliminar `'unsafe-eval'` y usar CSP basado en nonce. Next.js 16 soporta inyeccion automatica de nonce via `experimental.serverActions.bodySizeLimit`.

Sin embargo, un primer paso mas simple es: eliminar `'unsafe-eval'` y probar. Si Serwist (service worker) u otras dependencias requieren `eval()`, fallaran en tiempo de ejecucion. En ese caso, usar `'wasm-unsafe-eval'` (alcance mas reducido) o pasar primero a CSP-Report-Only.

**Plan por fases:**
1. Desplegar con `Content-Security-Policy-Report-Only` (misma politica pero sin `'unsafe-eval'`) durante 48 horas.
2. Monitorear reportes de violaciones CSP.
3. Si no hay violaciones del codigo de la aplicacion, cambiar a modo de cumplimiento eliminando `'unsafe-eval'`.

**Restriccion de CORS:** Reemplazar el `Access-Control-Allow-Origin` faltante con un origen explicito derivado del entorno:

```typescript
{
  key: 'Access-Control-Allow-Origin',
  value: process.env.ALLOWED_ORIGINS?.split(',')[0] || 'https://your-domain.com',
},
```

**Decision de arquitectura:** La variable de entorno `ALLOWED_ORIGINS` ya existe en `.env.example`. Usamos su primera entrada como el origen CORS. El soporte multi-origen requiere headers CORS dinamicos en middleware (no configuracion estatica), lo cual se difiere a un seguimiento si es necesario.

---

### Hallazgo 9: Extender rate limiting a todas las rutas API

**Estado actual:** El rate limiting se aplica por ruta usando `checkRateLimit()` de `src/lib/rate-limit-response.ts`. Solo ~6 rutas lo importan.

**Enfoque:** Crear un middleware de Next.js (`src/middleware.ts`) que aplique rate limiting a todas las rutas `/api/*`:

**Archivo nuevo:** `src/middleware.ts` (o modificar si existe)

```typescript
import { NextRequest, NextResponse } from 'next/server';

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const DEFAULT_LIMIT = 100; // requests per minute per IP
const WINDOW_MS = 60_000;

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = `${ip}:global`;
  const now = Date.now();

  const entry = requestCounts.get(key);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  entry.count++;
  if (entry.count > DEFAULT_LIMIT) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

**Decision de arquitectura:** El rate limiting a nivel de middleware proporciona una red de seguridad general. Las rutas individuales pueden aplicar limites mas estrictos por endpoint usando el patron existente `checkRateLimit()`. El middleware usa un contador simple en memoria (mismo enfoque que `src/core/middleware/rate-limit.ts`). El rate limiting distribuido basado en Redis ya esta disponible via `src/core/rate-limiting/rate-limiter.ts` pero el middleware se ejecuta en el Edge Runtime donde las conexiones Redis no estan disponibles -- por eso usamos en memoria para la capa de middleware y mantenemos el rate limiting Redis para los handlers por ruta.

---

### Hallazgo 11: Eliminar credenciales hardcodeadas de `docker-compose.yml`

**Archivo:** `docker-compose.yml`

**Estado actual (lineas 37-39):**
```yaml
POSTGRES_USER: park
POSTGRES_PASSWORD: park_secret
POSTGRES_DB: park_pos
```

Y linea 12:
```yaml
DATABASE_URL=postgresql://park:park_secret@postgres:5432/park_pos
```

**Cambios:**

1. Crear `.env.docker` (ignorado por git) con:
   ```env
   POSTGRES_USER=park
   POSTGRES_PASSWORD=change-me-in-production
   POSTGRES_DB=park_pos
   ```

2. Actualizar `docker-compose.yml`:
   ```yaml
   services:
     app:
       env_file:
         - .env.docker
       environment:
         - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
         # ... other vars reference .env.docker

     postgres:
       env_file:
         - .env.docker
   ```

3. Agregar `.env.docker` a `.gitignore`.
4. Agregar `.env.docker.example` con valores placeholder seguros.

---

## Fase 3 -- Mejoras de Arquitectura

### Hallazgo 13: Agregar `framer-motion` a `optimizePackageImports`

**Archivo:** `next.config.js`

**Ubicacion exacta:** Linea 20, el array `optimizePackageImports` dentro de `experimental`:

```js
experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui/react-icons', 'framer-motion'],
},
```

**Justificacion:** `framer-motion` tiene 55 sitios de importacion en todo el codebase. Sin `optimizePackageImports`, Next.js empaqueta toda la libreria incluso cuando solo se importa `motion.div`. Agregarlo al array habilita tree-shaking a nivel de importacion, reduciendo significativamente el tamano del chunk de framer-motion.

---

### Hallazgo 14: Habilitar `noImplicitAny` y `noUncheckedIndexedAccess`

**Archivo:** `tsconfig.json`

**Cambios (lineas 12-13):**

```json
{
  "compilerOptions": {
    "noImplicitAny": true,     // currently false (line 13)
    "noUncheckedIndexedAccess": true,  // new addition
  }
}
```

**Estrategia:** Se espera que esto produzca cientos de errores TS. El enfoque es:

1. Ejecutar `npx tsc --noEmit 2>&1 | wc -l` para contar errores.
2. Corregir problemas genuinos de seguridad de tipos (parametros de funciones, argumentos de callbacks).
3. Para tipos complejos de integracion con terceros que resistan el tipado, usar `// @ts-expect-error` con un comentario explicando por que.
4. Si el conteo de errores excede 500, considerar habilitar `noImplicitAny` primero y `noUncheckedIndexedAccess` en un PR separado.

**Decision de arquitectura:** `noUncheckedIndexedAccess` es particularmente valioso para este codebase porque los payloads de eventos se indexan extensivamente por claves string. Agregar `| undefined` a todos los accesos por indice fuerza verificaciones de null, previniendo la propagacion silenciosa de `undefined` a traves del pipeline de event-sourcing.

---

### Hallazgo 15: Eliminar codigo muerto

**Estrategia:** Usar un enfoque de dos pasadas:

1. **Pasada del compilador TypeScript:** Habilitar `noUnusedLocals` y `noUnusedParameters` temporalmente en `tsconfig.json`. Recopilar todos los errores. Estos identifican variables, imports y parametros de funciones sin usar.

2. **Pasada de analisis de exports:** Usar `ts-prune` o grep manual para encontrar simbolos exportados que tienen cero sitios de importacion:
   ```bash
   npx ts-prune --project tsconfig.json | grep -v '(used in module)'
   ```

3. **Verificacion manual:** Para cada candidato, buscar con grep imports dinamicos (`import()`) y referencias por string antes de eliminar.

**Alcance estimado:** ~4,000 lineas en ~40 archivos. La mayor parte se espera que sea:
- Funciones auxiliares sin usar en modulos de utilidad
- Bloques de codigo comentados (especialmente en `delivery/checkpoint2/route.ts` que tiene ~200 lineas de codigo TODO comentado)
- Metodos de servicio deprecados reemplazados por implementaciones mas nuevas

---

### Hallazgo 16: Reemplazar `console.log` con logger estructurado

**Archivos:** 12 archivos de rutas API con 75 llamadas `console.log` en total.

**Lista verificada de archivos:**

| Archivo | Cantidad |
|---------|----------|
| `src/app/api/auth/login/route.ts` | 38 |
| `src/app/api/admin/security/terminals/[id]/access-log/route.ts` | 5 |
| `src/app/api/admin/security/sessions/route.ts` | 5 |
| `src/app/api/admin/security/devices/[mac]/block/route.ts` | 5 |
| `src/app/api/admin/security/devices/route.ts` | 5 |
| `src/app/api/admin/security/alerts/route.ts` | 5 |
| `src/app/api/events/ingest/route.ts` | 3 |
| `src/app/api/auth/validate-session/route.ts` | 3 |
| `src/app/api/auth/logout/route.ts` | 2 |
| `src/app/api/admin/terminals-v2/[terminalId]/unbind/route.ts` | 2 |
| `src/app/api/terminals/activate-simple/route.ts` | 1 |
| `src/app/api/events/stream/route.ts` | 1 |

**Estrategia de migracion:** Reemplazo por lotes usando el `logger` existente de `src/core/observability/logger.ts`.

**Reglas de reemplazo:**

| Patron original | Reemplazo |
|-----------------|-----------|
| `console.log('message', data)` | `logger.info('api.route_name.action', 'message', { ...data })` |
| `console.error('message', error)` | `logger.error('api.route_name.error', 'message', error instanceof Error ? error : undefined)` |
| `console.warn('message')` | `logger.warn('api.route_name.warning', 'message')` |

**Enfoque:** Reemplazo manual archivo por archivo (no `sed` por lotes) porque:
1. Cada `console.log` necesita un nombre de evento significativo (primer argumento de `logger.info`).
2. La estructura del objeto de contexto varia por sitio de llamada.
3. Algunas llamadas `console.log` en `auth/login` son logging de depuracion de operaciones sensibles que deberian ser `logger.debug` (no `logger.info`).

Para cada archivo, agregar el import:
```typescript
import { logger } from '@/src/core/observability/logger';
```

---

### Hallazgo 17: Adoptar el patron Result de manera consistente

**Patron existente:** `src/core/result.ts` define:
```typescript
type Result<T, E> = { success: true; data: T } | { success: false; error: E }
```

**Estrategia:** Identificar rutas API que usan `try/catch` crudo con respuestas de error sin tipar y refactorizar para retornar tipos `Result` desde sus llamadas de servicio. Este es un refactoring grande que se hace mejor de forma incremental por modulo. La Fase 3 apunta a las rutas de mayor trafico:
- `events/ingest`
- `pos/payments`
- `admin/employees`
- `inventory/stock`

---

### Hallazgo 18: Agregar `ErrorBoundary` al layout raiz y pagina de menu

**Componente existente:** `src/components/ErrorBoundary.tsx` -- ya implementado con UI apropiada (icono AlertTriangle, boton de recarga, seccion expandible de detalles de error). Ya tiene un comentario placeholder para integracion con Sentry (linea 37).

**Archivo:** `src/app/layout.tsx`

**Cambio:** Envolver `{children}` en el layout raiz con `ErrorBoundary`:

```tsx
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

// In render:
<body className={...}>
  <SWRProvider>
    <PWAProvider>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </PWAProvider>
    <Toaster ... />
  </SWRProvider>
</body>
```

**Nota:** `ErrorBoundary` es un componente `'use client'` (componente de clase con `componentDidCatch`). Ya esta marcado con `'use client'` al inicio del archivo, por lo que puede ser importado en el `layout.tsx` del lado del servidor y se renderizara en el cliente.

**Paginas de menu:** Identificar layouts de pagina de menu (`src/app/menu/*/page.tsx` o `src/app/menu/layout.tsx`) y envolver su contenido con `<ErrorBoundary>`. Si existe un `menu/layout.tsx`, envolver ahi (cambio unico). De lo contrario, envolver cada `page.tsx` individualmente.

---

## Fase 4 -- Modernizacion de Infraestructura

### Hallazgo 19: Integracion del SDK de Sentry

**Archivos nuevos:**

1. `src/lib/sentry.ts` -- Inicializacion de Sentry
2. `sentry.client.config.ts` -- Configuracion de Sentry del lado del cliente (convencion Next.js)
3. `sentry.server.config.ts` -- Configuracion de Sentry del lado del servidor (convencion Next.js)

**Dependencias a instalar:**
```bash
npm install @sentry/nextjs
```

**`src/lib/sentry.ts`:**
```typescript
import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    });
  }
}
```

**Integracion con el `ErrorBoundary` existente:**

Actualizar `src/components/ErrorBoundary.tsx` linea 35-37:
```typescript
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  console.error('Error capturado por ErrorBoundary:', error, errorInfo);
  // Activate Sentry capture
  if (typeof window !== 'undefined' && (window as any).__SENTRY__) {
    import('@sentry/nextjs').then(Sentry => {
      Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    });
  }
}
```

**Envolvimiento de `next.config.js`:** Next.js + Sentry requiere envolver la configuracion con `withSentryConfig`. La configuracion actual ya esta envuelta con `withSerwist`. El orden de composicion es:

```js
import { withSentryConfig } from '@sentry/nextjs';
// ...
export default withSentryConfig(withSerwist(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
```

**Decision de arquitectura:** Sentry esta condicionado a que `NEXT_PUBLIC_SENTRY_DSN` este definido. Cuando no esta definido, no se ejecuta codigo de Sentry. Esto permite desarrollo local sin una cuenta de Sentry. El `tracesSampleRate: 0.1` en produccion mantiene los costos manejables mientras captura suficientes traces para depuracion.

**Variables de entorno a agregar a `.env.example`:**
```env
# Error Tracking (Sentry) - Optional
# NEXT_PUBLIC_SENTRY_DSN="https://...@sentry.io/..."
# SENTRY_ORG="your-org"
# SENTRY_PROJECT="park-pos"
# SENTRY_AUTH_TOKEN="your-sentry-auth-token"
```

---

### Hallazgo 20: Actualizar Node.js 20 a 22

**Archivos a modificar:**

1. **`Dockerfile`** -- lineas 6, 14, 29: Cambiar `node:20-alpine` a `node:22-alpine`
2. **`.github/workflows/ci.yml`** -- linea 10: Cambiar `NODE_VERSION: '20'` a `NODE_VERSION: '22'`
3. **Archivo nuevo: `.nvmrc`** -- Contenido: `22`

**Cambios en Dockerfile:**
```dockerfile
# Stage 1
FROM node:22-alpine AS deps
# Stage 2
FROM node:22-alpine AS builder
# Stage 3
FROM node:22-alpine AS runner
```

**Justificacion:** Node 20 llega a fin de vida en abril 2026. Node 22 es el LTS actual (activo hasta octubre 2027). La actualizacion es de bajo riesgo porque:
- El proyecto usa sintaxis de modulos ESNext (ya compatible).
- No hay dependencias de addons nativos (bcrypt usa un fallback en JS).
- Prisma 6.19 soporta Node 22.

---

### Hallazgo 21: Validacion de entorno con Zod al inicio

**Archivo nuevo:** `src/core/config/env-validation.ts`

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Required in production
  REDIS_URL: z.string().url().optional(),
  PARK_API_SECRET: z.string().min(16).optional(),

  // Optional
  TENANT_ID: z.string().uuid().optional(),
  LOCATION_ID: z.string().uuid().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

export function validateEnv(): Env {
  if (validatedEnv) return validatedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  validatedEnv = result.data;
  return validatedEnv;
}

export function getEnv(): Env {
  if (!validatedEnv) return validateEnv();
  return validatedEnv;
}
```

**Punto de integracion:** Llamar a `validateEnv()` en `src/app/api/health/route.ts` (que es el primer endpoint consultado al inicio) y en un archivo `src/instrumentation.ts` (hook de instrumentacion de Next.js, se ejecuta una vez al iniciar el servidor):

```typescript
// src/instrumentation.ts
export async function register() {
  if (process.env.NODE_ENV === 'production') {
    const { validateEnv } = await import('@/src/core/config/env-validation');
    validateEnv(); // throws on invalid env, preventing app from starting
  }
}
```

**Decision de arquitectura:** Usar el hook `instrumentation.ts` de Next.js asegura que la validacion se ejecute exactamente una vez al iniciar el servidor, antes de que se maneje cualquier solicitud. En modo desarrollo/test, la validacion se omite para evitar requerir todas las variables de entorno localmente.

---

### Hallazgo 22: Backup automatizado de BD

**Archivo:** `.github/workflows/ci.yml` -- agregar un nuevo job, o crear un workflow separado.

**Archivo nuevo:** `.github/workflows/db-backup.yml`

```yaml
name: Database Backup
on:
  schedule:
    - cron: '0 3 * * *'  # Daily at 3 AM UTC
  workflow_dispatch:

jobs:
  backup:
    name: PostgreSQL Backup
    runs-on: ubuntu-latest
    steps:
      - name: Create backup
        run: |
          PGPASSWORD=${{ secrets.DB_PASSWORD }} pg_dump \
            -h ${{ secrets.DB_HOST }} \
            -U ${{ secrets.DB_USER }} \
            -d ${{ secrets.DB_NAME }} \
            --format=custom \
            --compress=9 \
            > backup-$(date +%Y%m%d-%H%M%S).dump

      - name: Upload backup artifact
        uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_id }}
          path: backup-*.dump
          retention-days: 30
```

**Decision de arquitectura:** Los artefactos de GitHub Actions para almacenamiento de backups son un punto de partida. Para produccion, el backup deberia enviarse a S3/GCS. El workflow usa `workflow_dispatch` para permitir ejecucion manual ademas del horario diario.

---

### Hallazgo 23: Actualizaciones de Prisma 7.x y Zod 4.x

**Estrategia:** Evaluar en una rama aislada primero.

**Prisma 7.x:**
1. Actualizar `package.json`: `"@prisma/client": "^7.0.0"`, `"prisma": "^7.0.0"`
2. Ejecutar `npx prisma generate`
3. Ejecutar `npx tsc --noEmit` -- verificar cambios de API
4. Ejecutar `npm test` -- suite completa
5. Si los cambios rompedores exceden 20 sitios de llamada, diferir a un cambio separado.

**Zod 4.x:**
1. Actualizar `package.json`: `"zod": "^4.0.0"`
2. Ejecutar `npx tsc --noEmit` -- Zod 4 tiene cambios significativos de API (`.parse()` retorna tipos diferentes)
3. Ejecutar `npm test` -- suite completa
4. Si los cambios rompedores exceden 50 sitios de llamada, diferir.

**Decision de arquitectura:** Ambas actualizaciones se evaluan independientemente. Si una es segura y la otra no, actualizamos la segura y diferimos la otra. El objetivo es mantenerse en versiones soportadas, no adoptar APIs de vanguardia.

---

### Hallazgo 24: Automatizacion de despliegue

**Archivo:** `.github/workflows/ci.yml` -- agregar un job `deploy`:

```yaml
deploy-staging:
  name: Deploy to Staging
  runs-on: ubuntu-latest
  needs: [unit-tests, build, e2e-tests]
  if: github.ref == 'refs/heads/develop'
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to staging
      run: |
        echo "Deployment target TBD -- Railway/Vercel/custom"
        # Placeholder: actual deployment command depends on hosting
```

**Decision de arquitectura:** El destino de despliegue aun no esta decidido (Railway vs Vercel vs VPS personalizado). El job de CI se agrega como placeholder con la cadena de dependencias correcta (`needs: [unit-tests, build, e2e-tests]`) y filtro de rama (`develop`). El comando de despliegue real se completara cuando se configure el hosting.

---

## Fase 5 -- Cobertura de Tests

### Hallazgo 25: Tests unitarios para `src/core/security/`

**Organizacion de archivos de test:**

Crear directorio `src/core/security/__tests__/` con un archivo de test por modulo:

| Archivo fuente | Archivo de test |
|----------------|-----------------|
| `encryption.ts` | `__tests__/encryption.test.ts` |
| `ip-validator.ts` | `__tests__/ip-validator.test.ts` |
| `rate-limiter.ts` | `__tests__/rate-limiter.test.ts` |
| `location-validator.ts` | `__tests__/location-validator.test.ts` |
| `session-validator.ts` | `__tests__/session-validator.test.ts` |
| `mac-validator-hybrid.ts` | `__tests__/mac-validator-hybrid.test.ts` |
| `mac-validator.ts` | `__tests__/mac-validator.test.ts` |
| `alert-service.ts` | `__tests__/alert-service.test.ts` |
| `mac-detector.ts` | `__tests__/mac-detector.test.ts` |

**Patron de test:** Seguir la convencion existente de `src/core/middleware/__tests__/pos-auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    transaction_limits: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    session_audit_log: { count: vi.fn(), create: vi.fn() },
  },
}));

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkTransactionLimit', () => {
    it('should allow transaction within limits', async () => { ... });
    it('should reject transaction exceeding amount limit', async () => { ... });
    it('should reject when hourly limit reached', async () => { ... });
    // ...
  });
});
```

**Objetivo de cobertura:** >= 90% de cobertura de lineas para los 9 archivos (1,712 LOC). Cada archivo de test debe cubrir:
- Camino feliz (entrada valida, salida esperada)
- Casos borde (valores limite, entradas vacias)
- Manejo de errores (entradas invalidas, fallos de servicio)
- Para validadores: tanto entradas validas como invalidas con diversos formatos

---

### Hallazgos 26-27: Tests de integracion para rutas API

**Organizacion:** Crear directorios `__tests__/` junto a los archivos de ruta:

```
src/app/api/delivery/__tests__/delivery-api.test.ts
src/app/api/inventory/__tests__/inventory-stock-api.test.ts
src/app/api/orders/__tests__/order-lock-api.test.ts
src/app/api/push/__tests__/push-api.test.ts
src/app/api/events/__tests__/events-stream-api.test.ts
```

**Patron:** Seguir el existente `src/app/api/pos/payments/__tests__/payments-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth middleware
vi.mock('@/src/core/middleware/pos-auth', () => ({
  requirePosAuth: vi.fn(),
}));

// Mock service layer
vi.mock('@/src/core/delivery', () => ({
  DeliveryService: { getById: vi.fn() },
}));

import { GET } from '../[id]/route';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';

describe('GET /api/delivery/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requirePosAuth as any).mockResolvedValue({
      authorized: true,
      user: { id: 'emp-1', tenantId: 'tenant-1', role: 'DRIVER' },
    });
  });

  it('returns 401 without auth', async () => {
    (requirePosAuth as any).mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    // ...
  });
});
```

---

### Hallazgo 28: Tests de accesibilidad

**Archivos nuevos:** Directorio `e2e/accessibility/`:

```
e2e/accessibility/pos-page.a11y.spec.ts
e2e/accessibility/menu-page.a11y.spec.ts
e2e/accessibility/admin-dashboard.a11y.spec.ts
e2e/accessibility/employee-portal.a11y.spec.ts
e2e/accessibility/kitchen-display.a11y.spec.ts
e2e/accessibility/login-page.a11y.spec.ts
e2e/accessibility/delivery-page.a11y.spec.ts
```

**Dependencia:** `npm install -D @axe-core/playwright`

**Patron:**
```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('POS Page Accessibility', () => {
  test('should have no critical accessibility violations', async ({ page }) => {
    await page.goto('/pos');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });
});
```

---

### Hallazgo 29: Reemplazar `Math.random()` con PRNG con semilla

**Archivos:** 19 archivos de test con 83 llamadas a `Math.random()`.

**Estrategia:** Crear una utilidad compartida de PRNG con semilla para tests:

**Archivo nuevo:** `src/test-utils/seeded-random.ts`

```typescript
/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Produces deterministic sequences given a seed.
 * Use in tests to replace Math.random() for reproducibility.
 */
export function createSeededRandom(seed: number = 42) {
  let state = seed;

  return function random(): number {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Drop-in replacement for Math.random() in test files.
 * Returns a function with the same signature.
 */
export function seededMathRandom(seed?: number) {
  const random = createSeededRandom(seed);
  return {
    random,
    /** Seeded integer in range [min, max) */
    randomInt(min: number, max: number): number {
      return Math.floor(random() * (max - min)) + min;
    },
    /** Pick a random element from an array */
    pick<T>(arr: T[]): T {
      return arr[Math.floor(random() * arr.length)]!;
    },
    /** Shuffle an array (Fisher-Yates) */
    shuffle<T>(arr: T[]): T[] {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
  };
}
```

**Patron de migracion en archivos de test:**

```typescript
// BEFORE
const randomValue = Math.random();
const randomIndex = Math.floor(Math.random() * items.length);

// AFTER
import { seededMathRandom } from '@/src/test-utils/seeded-random';
const { random, randomInt, pick } = seededMathRandom(42);

const randomValue = random();
const randomIndex = randomInt(0, items.length);
```

**Decision de arquitectura:** Se elige Mulberry32 porque es rapido, produce valores bien distribuidos y cabe en una sola funcion. La semilla por defecto `42` asegura reproducibilidad entre ejecuciones de CI. Los tests que necesiten diferentes semillas por ejecucion (para mayor cobertura) pueden usar `seededMathRandom(Date.now())` en desarrollo y `seededMathRandom(42)` en CI (controlado por variable de entorno).

**Nota sobre fast-check:** Las llamadas a `Math.random()` dentro de callbacks `fc.property()` ya son manejadas por el PRNG propio de fast-check (que tiene semilla via `{ seed: ... }` en la configuracion del test). Las 83 llamadas a `Math.random()` estan en codigo de setup/helpers de test fuera del control de fast-check, por lo que necesitan reemplazo manual.

---

### Hallazgo 30: Reducir casts `as any`

**Estado actual:** 438 casts `as any` en 86 archivos de test.

**Estrategia:** Abordar por categoria, no por archivo:

| Categoria | Cantidad (est.) | Solucion |
|-----------|-----------------|----------|
| Casts de funciones mock: `(fn as any)` | ~120 | Usar `vi.mocked(fn)` o tipar el mock correctamente |
| Casts de modelos Prisma: `(record as any).field` | ~80 | Usar tipos `Prisma.ModelGetPayload<{}>` |
| Casts de payload de eventos: `(event.payload as any).field` | ~60 | Definir interfaces de payload tipadas por tipo de evento |
| Casts de usuario auth: `(auth.user as any).terminalId` | ~30 | Extender tipo `AuthenticatedRequest['user']` (ya hecho en pos-auth.ts) |
| Casts de registros Dexie: `(record as any).id` | ~40 | Usar definiciones de tabla tipadas de Dexie |
| Casts DOM/navegador: `(window as any)`, `(performance as any)` | ~20 | Usar `declare global` o aserciones de tipo |
| Varios | ~88 | Caso por caso |

**Enfoque por categoria:**

1. **Funciones mock:** Reemplazar `(requirePosAuth as any).mockResolvedValue(...)` con:
   ```typescript
   vi.mocked(requirePosAuth).mockResolvedValue(...);
   ```
   Esto requiere `vi.mock()` al inicio del archivo (que ya esta presente en la mayoria de los casos).

2. **Payloads de eventos:** Crear un tipo auxiliar:
   ```typescript
   type TypedPayload<T extends ParkEvent['type']> = Extract<ParkEvent, { type: T }>['payload'];
   ```

3. **Modelos Prisma:** Usar tipos generados de `@prisma/client`.

**Objetivo:** Reducir de 438 a menos de 50. Los ~50 restantes seran casos legitimos donde el sistema de tipos de TypeScript no puede expresar el patron (por ejemplo, probar caminos de error que intencionalmente pasan tipos invalidos).

---

### Hallazgo 31: Tests faltantes de paginas UI

**Archivos a crear:**

```
src/app/pos/__tests__/pos-page.test.tsx
src/app/admin/__tests__/admin-dashboard.test.tsx
src/app/employee/__tests__/employee-portal.test.tsx
src/app/cocina/__tests__/kitchen-display.test.tsx
src/app/mozo/__tests__/waiter-page.test.tsx
src/app/bar/__tests__/bar-page.test.tsx
src/app/menu/__tests__/menu-page.test.tsx
```

**Patron:** Seguir las convenciones existentes de tests de componentes:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock heavy dependencies
vi.mock('@/src/core/sync/client', () => ({
  getSyncClient: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}));

describe('POS Page', () => {
  it('renders without crashing', async () => {
    const { default: PosPage } = await import('../page');
    // Test rendering
  });
});
```

---

## Decisiones de Arquitectura Transversales

### Por que JWT sobre API keys para todas las rutas

El codebase tiene dos mecanismos de autenticacion: cookies JWT (usadas por `requirePosAuth`/`requireAdminAuth`) y headers de API secret (usados por `events/ingest` y anteriormente `admin/cleanup`). La Fase 2 estandariza en JWT para todas las rutas porque:

1. **Un solo camino de autenticacion** reduce la superficie de ataque.
2. **El aislamiento de tenant** es automatico -- el JWT contiene `tenantId`.
3. **El acceso basado en roles** ya esta implementado en el middleware.
4. **La exposicion de secretos del lado del cliente** se elimina.

La unica excepcion son las llamadas servidor-a-servidor (webhooks), que continuan usando firmas HMAC-SHA256.

### Capas de rate limiting

Despues de la Fase 2, existen tres capas de rate limiting:

1. **Capa de middleware** (`src/middleware.ts`): 100 req/min/IP en todas las rutas API. En memoria, local al proceso.
2. **Capa por ruta** (`checkRateLimit` en rutas individuales): Limites mas estrictos para endpoints sensibles (por ejemplo, 5 req/min para auth). En memoria, local al proceso.
3. **Capa por tenant** (`src/core/rate-limiting/rate-limiter.ts`): 100 req/s por tenant. Respaldado por Redis para cumplimiento distribuido.

### Jerarquia de manejo de errores

Despues de la Fase 3:

1. **Nivel de ruta:** Cada handler usa `try/catch` con patron `Result`.
2. **Nivel de layout del cliente:** `ErrorBoundary` en el layout raiz captura errores de renderizado de React.
3. **Nivel de servicio:** Sentry captura todas las excepciones no manejadas.
4. **Nivel de infraestructura:** El healthcheck de Docker reinicia contenedores caidos.

---

## Resumen de Cambios en Archivos

| Fase | Archivos Modificados | Archivos Creados | Archivos Eliminados |
|------|---------------------|------------------|---------------------|
| F1 | 3 | 0 | 0 |
| F2 | 15 | 3 | 0 |
| F3 | ~55 | 0 | ~40 (codigo muerto) |
| F4 | 5 | 5 | 0 |
| F5 | ~20 | ~150 | 0 |

**Total estimado de archivos tocados:** ~250 modificados, ~158 creados, ~40 eliminados.
