# ✅ Checklist de Producción - Admin Panel

**Fecha**: 19 Enero 2026  
**Propósito**: Lista verificable para despliegue a producción

---

## 🚦 ESTADO ACTUAL: 🔴 NO LISTO PARA PRODUCCIÓN

**Razón**: Vulnerabilidad crítica de seguridad (localStorage)

---

## 📋 CHECKLIST COMPLETO

### 🔴 P0 - CRÍTICO (BLOQUEANTES)

- [ ] **1. Implementar httpOnly Cookies**
  - [ ] Actualizar `/api/auth/session/route.ts`
    - [ ] Usar `cookies().set()` en lugar de retornar token
    - [ ] Configurar httpOnly, secure, sameSite flags
    - [ ] Mantener compatibilidad con JWT existente
  - [ ] Crear `src/middleware.ts`
    - [ ] Validar cookie de sesión en rutas `/admin/*`
    - [ ] Usar `jwtVerify` de jose
    - [ ] Agregar headers x-user-id, x-user-role
    - [ ] Redirigir a login si no hay cookie válida
  - [ ] Actualizar `src/components/inventory/PinModal.tsx`
    - [ ] Remover `localStorage.setItem('park_pos_auth_token')`
    - [ ] Remover funciones `getAuthToken`, `setAuthToken`, `clearAuthToken`
    - [ ] Confiar en cookies automáticas
  - [ ] Actualizar `src/app/admin/layout.tsx`
    - [ ] Remover `localStorage.getItem('admin_session')`
    - [ ] Remover `localStorage.setItem('admin_session')`
    - [ ] Remover `localStorage.removeItem('admin_session')`
    - [ ] Validar sesión con endpoint GET `/api/auth/session`
  - [ ] Probar flujo completo
    - [ ] Login exitoso
    - [ ] Sesión persiste en refresh
    - [ ] Logout limpia cookie
    - [ ] Sesión expira después de 30 min
    - [ ] No hay tokens en localStorage
  - [ ] Verificar seguridad
    - [ ] Cookie tiene flag httpOnly
    - [ ] Cookie tiene flag secure (producción)
    - [ ] Cookie tiene sameSite=strict
    - [ ] No hay XSS posible

**Tiempo estimado**: 4-6 horas  
**Responsable**: Backend + Frontend Lead  
**Prioridad**: 🔴 CRÍTICA

---

### 🟡 P1 - ALTA (RECOMENDADAS)

- [ ] **2. Completar Migración de Toasts**
  - [x] Employees pages ✅
  - [ ] Products nuevo (`src/app/admin/productos/nuevo/page.tsx`)
    - [ ] Importar `toast` de sonner
    - [ ] Reemplazar `setError()` con `toast.error()`
    - [ ] Agregar `toast.success()` en éxito
  - [ ] Products editar (`src/app/admin/productos/[id]/page.tsx`)
    - [ ] Importar `toast` de sonner
    - [ ] Reemplazar `setError()` con `toast.error()`
    - [ ] Agregar `toast.success()` en éxito
    - [ ] Reemplazar `alert()` con `toast` en delete
  - [ ] Promotions nuevo (`src/app/admin/promociones/nuevo/page.tsx`)
    - [ ] Importar `toast` de sonner
    - [ ] Reemplazar `setError()` con `toast.error()`
    - [ ] Agregar `toast.success()` en éxito
  - [ ] Promotions editar (`src/app/admin/promociones/[id]/page.tsx`)
    - [ ] Importar `toast` de sonner
    - [ ] Reemplazar `setError()` con `toast.error()`
    - [ ] Agregar `toast.success()` en éxito
    - [ ] Reemplazar `alert()` con `toast` en delete
  - [ ] Drivers (`src/app/admin/drivers/page.tsx`)
    - [ ] Importar `toast` de sonner
    - [ ] Reemplazar todos los `alert()` con `toast`
  - [ ] Configuration (`src/app/admin/configuracion/page.tsx`)
    - [ ] Importar `toast` de sonner
    - [ ] Reemplazar `setError()` con `toast.error()`
    - [ ] Agregar `toast.success()` en éxito

**Tiempo estimado**: 3 horas  
**Responsable**: Frontend Developer  
**Prioridad**: 🟡 ALTA

- [ ] **3. Migrar Páginas a Hooks**
  - [ ] Employees nuevo
    - [ ] Usar `useAdminMutation` para crear
    - [ ] Remover código de fetch manual
  - [ ] Employees editar
    - [ ] Usar `useAdminData` para cargar
    - [ ] Usar `useAdminMutation` para actualizar/eliminar
    - [ ] Remover código de fetch manual
  - [ ] Products nuevo
    - [ ] Usar `useAdminMutation` para crear
  - [ ] Products editar
    - [ ] Usar `useAdminData` para cargar
    - [ ] Usar `useAdminMutation` para actualizar/eliminar
  - [ ] Promotions nuevo
    - [ ] Usar `useAdminMutation` para crear
  - [ ] Promotions editar
    - [ ] Usar `useAdminData` para cargar
    - [ ] Usar `useAdminMutation` para actualizar/eliminar
  - [ ] Drivers
    - [ ] Usar `useAdminData` para cargar lista
    - [ ] Usar `useAdminMutation` para operaciones
  - [ ] Configuration
    - [ ] Usar `useAdminData` para cargar config
    - [ ] Usar `useAdminMutation` para actualizar

**Tiempo estimado**: 6 horas  
**Responsable**: Frontend Developer  
**Prioridad**: 🟡 ALTA

- [ ] **4. Centralizar Tenant ID**
  - [ ] Buscar todos los usos de `process.env.TENANT_ID`
  - [ ] Reemplazar con `import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal'`
  - [ ] Verificar consistencia en todos los archivos

**Tiempo estimado**: 1 hora  
**Responsable**: Backend Developer  
**Prioridad**: 🟡 MEDIA

- [ ] **5. Mejorar Manejo de Errores de Red**
  - [ ] Crear `src/lib/errors.ts`
    - [ ] Clase `ApiError`
    - [ ] Clase `NetworkError`
    - [ ] Clase `ValidationError`
  - [ ] Actualizar `src/hooks/useAdminData.ts`
    - [ ] Distinguir errores de red vs API
    - [ ] Lanzar tipos de error apropiados
  - [ ] Actualizar páginas para manejar tipos de error
    - [ ] Mostrar mensaje específico para NetworkError
    - [ ] Ofrecer retry para errores de red

**Tiempo estimado**: 2 horas  
**Responsable**: Frontend Developer  
**Prioridad**: 🟡 MEDIA

---

### 🟢 P2 - BAJA (MEJORAS OPCIONALES)

- [ ] **6. Implementar toast.promise**
  - [ ] Actualizar operaciones asíncronas para usar `toast.promise()`
  - [ ] Mejor feedback visual durante operaciones largas

**Tiempo estimado**: 2 horas  
**Prioridad**: 🟢 BAJA

- [ ] **7. Configurar Sentry**
  - [ ] Instalar `@sentry/nextjs`
  - [ ] Configurar DSN
  - [ ] Integrar con Error Boundary
  - [ ] Probar captura de errores

**Tiempo estimado**: 2 horas  
**Prioridad**: 🟢 BAJA

---

## 🧪 TESTING CHECKLIST

### Tests Unitarios
- [x] Hooks tests (useAdminData, useAdminMutation) - Pendiente
- [x] Error Boundary tests - Pendiente
- [x] Toast integration tests - Pendiente

### Tests de Integración
- [ ] Login con httpOnly cookies
- [ ] Refresh mantiene sesión
- [ ] Logout limpia sesión
- [ ] Sesión expira correctamente
- [ ] Toasts aparecen en operaciones
- [ ] Error Boundary captura errores

### Tests E2E
- [ ] Flujo completo de login
- [ ] CRUD de Employees con toasts
- [ ] CRUD de Products con toasts
- [ ] Manejo de errores de red
- [ ] Sesión expira y redirige a login

---

## 🔒 SECURITY CHECKLIST

- [ ] **Cookies Seguras**
  - [ ] httpOnly flag activado
  - [ ] secure flag en producción
  - [ ] sameSite=strict configurado
  - [ ] maxAge apropiado (30 min)

- [ ] **No hay localStorage**
  - [ ] Buscar `localStorage.setItem` (debe ser 0 resultados)
  - [ ] Buscar `localStorage.getItem` (debe ser 0 resultados)
  - [ ] Buscar `localStorage.removeItem` (debe ser 0 resultados)

- [ ] **JWT Seguro**
  - [ ] JWT_SECRET en variables de entorno
  - [ ] JWT_SECRET suficientemente largo (>32 chars)
  - [ ] Algoritmo HS256 o superior

- [ ] **Middleware**
  - [ ] Valida todas las rutas /admin/*
  - [ ] Redirige a login si no hay sesión
  - [ ] No expone información sensible en headers

---

## 📊 PERFORMANCE CHECKLIST

- [ ] **Bundle Size**
  - [ ] Verificar que Sonner no aumentó bundle >50KB
  - [ ] Code splitting en rutas admin

- [ ] **Loading States**
  - [ ] Todos los botones muestran loading
  - [ ] Toasts aparecen <100ms
  - [ ] No hay re-renders innecesarios

---

## 📱 UX CHECKLIST

- [ ] **Feedback Visual**
  - [ ] Toasts en todas las operaciones exitosas
  - [ ] Toasts en todos los errores
  - [ ] Loading states en todos los botones
  - [ ] Confirmaciones para acciones destructivas

- [ ] **Accesibilidad**
  - [ ] Toasts son accesibles por screen readers
  - [ ] Error Boundary es accesible
  - [ ] Navegación por teclado funciona

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deploy
- [ ] Todas las tareas P0 completadas
- [ ] Tests pasando (unit + integration + E2E)
- [ ] No hay errores de TypeScript
- [ ] No hay warnings críticos
- [ ] Bundle size aceptable

### Variables de Entorno
- [ ] `JWT_SECRET` configurado (producción)
- [ ] `NODE_ENV=production`
- [ ] `TENANT_ID` configurado

### Post-Deploy
- [ ] Verificar login funciona
- [ ] Verificar sesión persiste
- [ ] Verificar toasts aparecen
- [ ] Verificar Error Boundary funciona
- [ ] Monitorear logs por errores
- [ ] Verificar cookies en DevTools

---

## ✅ CRITERIOS DE ACEPTACIÓN

### Mínimo para Producción (P0)
- ✅ httpOnly cookies implementadas
- ✅ No hay localStorage con tokens
- ✅ Middleware valida sesiones
- ✅ Tests de seguridad pasando

### Recomendado para Producción (P0 + P1)
- ✅ Toasts en todas las páginas
- ✅ Hooks utilizados (sin código duplicado)
- ✅ Tenant ID centralizado
- ✅ Manejo de errores de red

### Ideal para Producción (P0 + P1 + P2)
- ✅ toast.promise implementado
- ✅ Sentry configurado
- ✅ Tests E2E completos

---

## 📞 CONTACTOS

**En caso de problemas**:
- Backend: Revisar `AUDITORIA_MEJORAS.md` sección httpOnly cookies
- Frontend: Revisar `SOLUCIONES_IMPLEMENTACION.md`
- General: Revisar `RESUMEN_FINAL.md`

---

## 🎯 ESTADO FINAL

**Fecha de última actualización**: 19 Enero 2026

**Estado actual**:
- 🔴 P0: 0/2 completadas (0%)
- 🟡 P1: 0/4 completadas (0%)
- 🟢 P2: 0/2 completadas (0%)

**Total**: 0/8 tareas completadas (0%)

**Infraestructura**: ✅ 100% lista  
**Migración**: 🚧 0% completada  

**Bloqueante para producción**: SÍ (httpOnly cookies)

---

**Próxima revisión**: Después de implementar httpOnly cookies
