# FASE 1: SEGURIDAD CRÍTICA (48 horas)

**Duración:** Días 1-5 (Semana 1)  
**Objetivo:** Sistema seguro y estable  
**Bloqueante:** SÍ

---

## DÍA 1: Rate Limiting + CORS (8h)

### MAÑANA (4h): Rate Limiting

#### Dev 1: Implementar Middleware (4h)

**08:00-08:30 (30min)** - Setup inicial
- [ ] Crear `src/core/middleware/rate-limit.ts`
- [ ] Crear `src/core/middleware/rate-limit.test.ts`
- [ ] Definir interfaces TypeScript

**08:30-09:30 (1h)** - Lógica core
- [ ] Implementar Map para contadores
- [ ] Implementar ventana deslizante
- [ ] Implementar limpieza de expirados
- [ ] Manejar edge cases (IP undefined, etc.)

**09:30-10:30 (1h)** - Headers y respuestas
- [ ] Agregar `X-RateLimit-Limit`
- [ ] Agregar `X-RateLimit-Remaining`
- [ ] Agregar `X-RateLimit-Reset`
- [ ] Agregar `Retry-After` cuando se excede
- [ ] Respuesta 429 con mensaje en español

**10:30-11:30 (1h)** - Tests
- [ ] Test: permite requests dentro del límite
- [ ] Test: bloquea cuando excede límite
- [ ] Test: resetea después de ventana
- [ ] Test: limpia entradas expiradas
- [ ] Test: maneja múltiples IPs simultáneas

**11:30-12:00 (30min)** - Documentación
- [ ] Documentar uso en README
- [ ] Ejemplos de código
- [ ] Configuración recomendada por endpoint

---

### TARDE (4h): CORS Configuration

#### Dev 2: Configurar CORS (4h)

**13:00-14:00 (1h)** - next.config.js
- [ ] Agregar configuración de headers
- [ ] Configurar `Access-Control-Allow-Origin`
- [ ] Configurar `Access-Control-Allow-Methods`
- [ ] Configurar `Access-Control-Allow-Headers`
- [ ] Configurar `Access-Control-Allow-Credentials`
- [ ] Configurar `Access-Control-Max-Age`

**14:00-15:00 (1h)** - OPTIONS handlers
- [ ] Crear helper `handleCorsPreflightRequest()`
- [ ] Implementar en 5 endpoints de ejemplo
- [ ] Validar que devuelve 204
- [ ] Validar headers correctos

**15:00-16:00 (1h)** - Variables de entorno
- [ ] Agregar `ALLOWED_ORIGINS` a `.env.example`
- [ ] Documentar formato (comma-separated)
- [ ] Configurar para dev/staging/prod
- [ ] Validar en startup

**16:00-17:00 (1h)** - Testing
- [ ] Test manual con Postman/curl
- [ ] Test preflight request
- [ ] Test con credenciales
- [ ] Test con origen no permitido
- [ ] Documentar resultados

---

## DÍA 2: httpOnly Cookies Migration (10h)

### MAÑANA (5h): Backend Auth

#### Dev 1: API de Login/Logout (5h)

**08:00-09:00 (1h)** - Endpoint de login
- [ ] Modificar `/api/auth/login/route.ts`
- [ ] Validar PIN contra BD
- [ ] Generar JWT token
- [ ] Configurar httpOnly cookie
  ```typescript
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 1800, // 30 min
    path: '/',
  });
  ```
- [ ] Retornar employee data (sin token)

**09:00-10:00 (1h)** - Endpoint de logout
- [ ] Modificar `/api/auth/session DELETE`
- [ ] Revocar token en BD (tabla `sessions`)
- [ ] Limpiar cookie
  ```typescript
  response.cookies.delete('auth_token');
  ```
- [ ] Retornar success

**10:00-11:00 (1h)** - Endpoint de session check
- [ ] Modificar `/api/auth/session GET`
- [ ] Leer cookie automáticamente
- [ ] Validar token
- [ ] Retornar employee data si válido
- [ ] Retornar 401 si inválido/expirado

**11:00-12:00 (1h)** - Middleware update
- [ ] Modificar `src/core/middleware/admin-auth.ts`
- [ ] Priorizar cookie sobre Authorization header
  ```typescript
  const cookieToken = request.cookies.get('auth_token')?.value;
  const headerToken = authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : null;
  const token = cookieToken || headerToken;
  ```
- [ ] Mantener backward compatibility temporalmente

**12:00-13:00 (1h)** - Tests de integración
- [ ] Test: login exitoso crea cookie
- [ ] Test: cookie tiene httpOnly=true
- [ ] Test: cookie tiene secure=true en prod
- [ ] Test: logout elimina cookie
- [ ] Test: session check valida cookie
- [ ] Test: cookie expirada retorna 401

---

### TARDE (5h): Frontend Migration

#### Dev 2: Actualizar Layout (5h)

**13:00-14:30 (1.5h)** - Modificar layout.tsx
- [ ] Eliminar imports de `useAdminAuth`
- [ ] Usar solo fetch con `credentials: 'include'`
- [ ] Actualizar `checkSession()` para no esperar token
- [ ] Actualizar `handleLogout()` para no enviar token
- [ ] Eliminar cualquier referencia a localStorage

**14:30-16:00 (1.5h)** - Crear AuthContext
- [ ] Crear `src/app/admin/context/AuthContext.tsx`
- [ ] Proveer `employee`, `isAuthenticated`, `logout`
- [ ] NO exponer token (no existe en frontend)
- [ ] Implementar refresh automático cada 15min

**16:00-17:00 (1h)** - Actualizar componentes
- [ ] Buscar todos los usos de `useAdminAuth`
- [ ] Reemplazar con `useAuth` del contexto
- [ ] Eliminar cualquier uso de `token`
- [ ] Verificar que compile sin errores

**17:00-18:00 (1h)** - Testing manual
- [ ] Test: login funciona
- [ ] Test: cookie se crea (DevTools)
- [ ] Test: refresh mantiene sesión
- [ ] Test: logout limpia sesión
- [ ] Test: sesión expira después de 30min
- [ ] Test: no hay token en localStorage

---

## DÍA 3: Eliminar useAdminAuth + Paginación Parte 1 (10h)

### MAÑANA (6h): Eliminar Sistema Viejo

#### Dev 1 + Dev 2: Pair Programming (6h)

**08:00-09:00 (1h)** - Auditoría de código
- [ ] Buscar todos los archivos que usan `useAdminAuth`
  ```bash
  grep -r "useAdminAuth" src/
  ```
- [ ] Listar componentes afectados
- [ ] Crear checklist de migración

**09:00-11:00 (2h)** - Migrar componentes
- [ ] Migrar cada componente a `useAuth`
- [ ] Eliminar imports de `useAdminAuth`
- [ ] Verificar que compile
- [ ] Commit por cada componente migrado

**11:00-12:00 (1h)** - Eliminar archivo
- [ ] Eliminar `src/app/admin/hooks/useAdminAuth.ts`
- [ ] Eliminar tests relacionados
- [ ] Actualizar imports en toda la app
- [ ] Verificar que compile

**12:00-13:00 (1h)** - Testing completo
- [ ] Test: login flow completo
- [ ] Test: logout flow completo
- [ ] Test: refresh session
- [ ] Test: expiración de sesión
- [ ] Test: navegación entre páginas
- [ ] Test: permisos por rol

---

### TARDE (4h): Paginación - Helpers

#### Dev 1: Backend Helpers (2h)

**13:00-14:00 (1h)** - Crear helper de paginación
- [ ] Crear `src/lib/pagination.ts`
- [ ] Función `parsePaginationParams(searchParams)`
  ```typescript
  interface PaginationParams {
    page: number;
    limit: number;
    skip: number;
  }
  ```
- [ ] Validar page >= 1
- [ ] Validar limit entre 1 y 100
- [ ] Calcular skip automáticamente

**14:00-15:00 (1h)** - Función de respuesta
- [ ] Función `createPaginatedResponse(items, total, params)`
  ```typescript
  interface PaginatedResponse<T> {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }
  ```
- [ ] Tests unitarios

#### Dev 2: Frontend Hook (2h)

**13:00-14:00 (1h)** - Crear usePagination hook
- [ ] Crear `src/hooks/usePagination.ts`
- [ ] Estado: page, limit, total, loading
- [ ] Funciones: nextPage, prevPage, goToPage
- [ ] Calcular hasNext, hasPrev, totalPages

**14:00-15:00 (1h)** - Componente de paginación
- [ ] Crear `src/components/ui/Pagination.tsx`
- [ ] Botones: Primera, Anterior, Siguiente, Última
- [ ] Mostrar: "Página X de Y"
- [ ] Mostrar: "Mostrando X-Y de Z resultados"
- [ ] Deshabilitar botones según estado
- [ ] Estilos con Tailwind

---

## DÍA 4: Paginación Parte 2 (10h)

### TODO EL DÍA: Implementar en Endpoints

#### Dev 1: Endpoints Admin (5h)

**08:00-09:00 (1h)** - Employees
- [ ] Modificar `GET /api/admin/employees`
- [ ] Agregar paginación
- [ ] Agregar filtro `is_active`
- [ ] Tests de integración

**09:00-10:00 (1h)** - Products
- [ ] Modificar `GET /api/admin/products`
- [ ] Agregar paginación
- [ ] Agregar filtro `is_active`
- [ ] Tests de integración

**10:00-11:00 (1h)** - Promotions
- [ ] Modificar `GET /api/admin/promotions`
- [ ] Agregar paginación
- [ ] Tests de integración

**11:00-12:00 (1h)** - Tables
- [ ] Modificar `GET /api/admin/tables`
- [ ] Agregar paginación
- [ ] Agregar filtro `zone_id`
- [ ] Tests de integración

**12:00-13:00 (1h)** - Terminals
- [ ] Modificar `GET /api/admin/terminals`
- [ ] Agregar paginación
- [ ] Tests de integración

---

#### Dev 2: Endpoints Analytics (5h)

**08:00-09:00 (1h)** - Audit Logs
- [ ] Modificar `GET /api/admin/audit/events`
- [ ] Agregar paginación
- [ ] Ya tiene, verificar formato
- [ ] Tests de integración

**09:00-10:00 (1h)** - Delivery Orders
- [ ] Modificar `GET /api/admin/delivery/history`
- [ ] Ya tiene paginación, verificar
- [ ] Estandarizar formato de respuesta
- [ ] Tests de integración

**10:00-11:00 (1h)** - Notifications
- [ ] Modificar `GET /api/admin/notifications`
- [ ] Agregar paginación
- [ ] Tests de integración

**11:00-12:00 (1h)** - Analytics History
- [ ] Modificar `GET /api/admin/analytics/history`
- [ ] Agregar paginación
- [ ] Tests de integración

**12:00-13:00 (1h)** - Inventory Movements
- [ ] Modificar `GET /api/inventory/movements/recent`
- [ ] Agregar paginación
- [ ] Tests de integración

---

### TARDE: Frontend Pages (5h)

#### Dev 1 + Dev 2: Pair Programming

**13:00-14:00 (1h)** - Employees Page
- [ ] Actualizar `src/app/admin/empleados/page.tsx`
- [ ] Usar `usePagination` hook
- [ ] Agregar componente `<Pagination />`
- [ ] Test manual

**14:00-15:00 (1h)** - Products Page
- [ ] Actualizar `src/app/admin/productos/page.tsx`
- [ ] Usar `usePagination` hook
- [ ] Agregar componente `<Pagination />`
- [ ] Test manual

**15:00-16:00 (1h)** - Promotions Page
- [ ] Actualizar `src/app/admin/promociones/page.tsx`
- [ ] Usar `usePagination` hook
- [ ] Agregar componente `<Pagination />`
- [ ] Test manual

**16:00-17:00 (1h)** - Tables Page
- [ ] Actualizar `src/app/admin/mesas/page.tsx`
- [ ] Usar `usePagination` hook
- [ ] Agregar componente `<Pagination />`
- [ ] Test manual

**17:00-18:00 (1h)** - Testing completo
- [ ] Test: paginación funciona en todas las páginas
- [ ] Test: límites respetados (max 100)
- [ ] Test: navegación entre páginas
- [ ] Test: total de páginas correcto
- [ ] Test: performance con 1000+ registros

---

## DÍA 5: Race Condition + Rate Limiting Rollout (10h)

### MAÑANA (5h): Race Condition Fix

#### Dev 1: catalog_version Fix (5h)

**08:00-09:30 (1.5h)** - Implementar solución
- [ ] Modificar `src/app/api/admin/products/route.ts`
- [ ] Usar raw SQL para increment atómico
  ```typescript
  await tx.$queryRaw`
    INSERT INTO catalog_meta (tenant_id, catalog_version, updated_at)
    VALUES (${TENANT_ID}, 1, NOW())
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      catalog_version = catalog_meta.catalog_version + 1,
      updated_at = NOW()
    RETURNING catalog_version
  `;
  ```
- [ ] Aplicar mismo fix en `products/[id]/route.ts`

**09:30-11:00 (1.5h)** - Tests de concurrencia
- [ ] Test: 10 productos creados simultáneamente
- [ ] Verificar: catalog_version incrementa correctamente
- [ ] Test: 10 productos actualizados simultáneamente
- [ ] Verificar: no hay lost updates

**11:00-12:00 (1h)** - Aplicar a otros endpoints
- [ ] Buscar otros usos de `catalog_version`
- [ ] Aplicar mismo patrón
- [ ] Tests de integración

**12:00-13:00 (1h)** - Documentación
- [ ] Documentar el problema
- [ ] Documentar la solución
- [ ] Agregar a ADR (Architecture Decision Record)

---

### TARDE (5h): Rate Limiting Rollout

#### Dev 2: Aplicar a Todos los Endpoints (5h)

**13:00-14:00 (1h)** - Employees endpoints
- [ ] POST /api/admin/employees (10 req/min)
- [ ] PUT /api/admin/employees/[id] (10 req/min)
- [ ] DELETE /api/admin/employees/[id] (5 req/min)

**14:00-15:00 (1h)** - Products endpoints
- [ ] POST /api/admin/products (10 req/min)
- [ ] PUT /api/admin/products/[id] (10 req/min)
- [ ] DELETE /api/admin/products/[id] (5 req/min)

**15:00-16:00 (1h)** - Promotions endpoints
- [ ] POST /api/admin/promotions (10 req/min)
- [ ] PUT /api/admin/promotions/[id] (10 req/min)
- [ ] DELETE /api/admin/promotions/[id] (5 req/min)

**16:00-17:00 (1h)** - Auth endpoints
- [ ] POST /api/auth/login (5 req/min) - CRÍTICO
- [ ] POST /api/auth/logout (10 req/min)

**17:00-18:00 (1h)** - Testing
- [ ] Test: rate limiting funciona en todos
- [ ] Test: headers correctos
- [ ] Test: mensaje en español
- [ ] Documentar configuración por endpoint

---

## ✅ CHECKLIST FASE 1

Al final del Día 5, debes tener:

- [x] Rate limiting implementado en 40+ endpoints
- [x] CORS configurado correctamente
- [x] httpOnly cookies funcionando
- [x] useAdminAuth.ts eliminado
- [x] Paginación en todos los endpoints GET
- [x] Race condition de catalog_version resuelto
- [x] 50+ tests passing
- [x] Sistema seguro y estable

**Criterio de éxito:** Todos los problemas P0 resueltos.

---

**Próximo:** [FASE 2: Integridad de Datos](./FASE2_INTEGRIDAD.md)
