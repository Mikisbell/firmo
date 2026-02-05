# 🧪 Smoke Tests - Checklist de Verificación

**URL:** https://parkperu.vercel.app/  
**Fecha:** 5 Febrero 2026  
**Status:** 🟢 READY TO TEST

---

## 📋 Instrucciones

Este checklist te guía paso a paso para verificar que el sistema funciona correctamente en producción.

**Cómo usar:**
1. Abre https://parkperu.vercel.app/ en tu navegador
2. Sigue cada test en orden
3. Marca ✅ si pasa, ❌ si falla
4. Anota cualquier error o comportamiento extraño

---

## 1️⃣ Test de Login

### 1.1 Login con Admin Principal

**Pasos:**
1. Abrir https://parkperu.vercel.app/
2. Ingresar PIN: `1234`
3. Presionar Enter o click en botón de login

**Resultado esperado:**
- [ ] ✅ No hay error 401
- [ ] ✅ No hay mensaje "PIN inválido"
- [ ] ✅ No hay mensaje "Terminal bloqueado"
- [ ] ✅ Redirige a dashboard o selector de módulo
- [ ] ✅ Nombre de usuario visible: "Admin Principal"

**Si falla:**
- Abrir DevTools (F12) → Console
- Copiar el error completo
- Verificar que el PIN_SALT es correcto: `curl https://parkperu.vercel.app/api/debug/env`

---

### 1.2 Verificar Cookie de Sesión

**Pasos:**
1. Después de login exitoso
2. Abrir DevTools (F12)
3. Ir a tab **Application** (Chrome) o **Storage** (Firefox)
4. Expandir **Cookies**
5. Seleccionar `https://parkperu.vercel.app`

**Resultado esperado:**
- [ ] ✅ Existe cookie `auth_token`
- [ ] ✅ Cookie tiene `HttpOnly: true`
- [ ] ✅ Cookie tiene `Secure: true`
- [ ] ✅ Cookie tiene `SameSite: Lax`
- [ ] ✅ Cookie tiene un valor (JWT largo)

---

## 2️⃣ Test de Navegación

### 2.1 Dashboard Principal

**Pasos:**
1. Después de login, verificar que carga el dashboard

**Resultado esperado:**
- [ ] ✅ Dashboard carga sin errores
- [ ] ✅ Nombre de usuario visible en header
- [ ] ✅ Logo o branding visible
- [ ] ✅ Menú de navegación visible
- [ ] ✅ No hay errores en console (F12)

---

### 2.2 Selector de Módulos

**Pasos:**
1. Si hay selector de módulos, verificar que muestra las opciones

**Resultado esperado:**
- [ ] ✅ Muestra módulo "Caja"
- [ ] ✅ Muestra módulo "Mesero"
- [ ] ✅ Muestra módulo "KDS"
- [ ] ✅ Muestra módulo "Admin"
- [ ] ✅ Iconos o imágenes cargan correctamente

---

## 3️⃣ Test de Módulos

### 3.1 Módulo Caja

**Pasos:**
1. Click en módulo "Caja"
2. Esperar a que cargue

**Resultado esperado:**
- [ ] ✅ Módulo carga sin errores
- [ ] ✅ UI de POS visible
- [ ] ✅ Productos cargan (si hay)
- [ ] ✅ Botones funcionan
- [ ] ✅ No hay errores en console

**Si falla:**
- Verificar errores en console
- Verificar que la base de datos tiene productos

---

### 3.2 Módulo Mesero

**Pasos:**
1. Volver al selector de módulos
2. Click en módulo "Mesero"
3. Esperar a que cargue

**Resultado esperado:**
- [ ] ✅ Módulo carga sin errores
- [ ] ✅ UI de mesero visible
- [ ] ✅ Zonas/mesas cargan (si hay)
- [ ] ✅ Productos cargan (si hay)
- [ ] ✅ No hay errores en console

---

### 3.3 Módulo KDS

**Pasos:**
1. Volver al selector de módulos
2. Click en módulo "KDS"
3. Esperar a que cargue

**Resultado esperado:**
- [ ] ✅ Módulo carga sin errores
- [ ] ✅ UI de cocina visible
- [ ] ✅ Estaciones visibles (Parrilla, Cocina, Bar, etc.)
- [ ] ✅ Órdenes cargan (si hay)
- [ ] ✅ No hay errores en console

---

### 3.4 Módulo Admin

**Pasos:**
1. Volver al selector de módulos
2. Click en módulo "Admin"
3. Esperar a que cargue

**Resultado esperado:**
- [ ] ✅ Panel admin carga sin errores
- [ ] ✅ Sidebar con opciones visible
- [ ] ✅ Dashboard con métricas visible
- [ ] ✅ Gráficas cargan (si hay datos)
- [ ] ✅ No hay errores en console

---

## 4️⃣ Test de Admin Panel

### 4.1 Navegación en Admin

**Pasos:**
1. En el panel admin, probar las opciones del sidebar

**Resultado esperado:**
- [ ] ✅ Click en "Dashboard" funciona
- [ ] ✅ Click en "Empleados" funciona
- [ ] ✅ Click en "Productos" funciona
- [ ] ✅ Click en "Inventario" funciona
- [ ] ✅ Click en "Reportes" funciona
- [ ] ✅ Cada página carga sin errores

---

### 4.2 CRUD de Empleados

**Pasos:**
1. En Admin, ir a "Empleados"
2. Verificar que la lista carga

**Resultado esperado:**
- [ ] ✅ Lista de empleados carga
- [ ] ✅ Muestra 241 empleados
- [ ] ✅ Botón "Crear Empleado" visible
- [ ] ✅ Botones de editar/eliminar visibles
- [ ] ✅ Paginación funciona (si hay)

---

### 4.3 CRUD de Productos

**Pasos:**
1. En Admin, ir a "Productos"
2. Verificar que la lista carga

**Resultado esperado:**
- [ ] ✅ Lista de productos carga
- [ ] ✅ Muestra productos (si hay)
- [ ] ✅ Botón "Crear Producto" visible
- [ ] ✅ Botones de editar/eliminar visibles
- [ ] ✅ Imágenes de productos cargan

---

## 5️⃣ Test de Funcionalidad Offline

### 5.1 Service Worker

**Pasos:**
1. Abrir DevTools (F12)
2. Ir a tab **Application**
3. Expandir **Service Workers**

**Resultado esperado:**
- [ ] ✅ Service Worker registrado
- [ ] ✅ Status: "activated and is running"
- [ ] ✅ Scope: https://parkperu.vercel.app/

---

### 5.2 IndexedDB

**Pasos:**
1. En DevTools → Application
2. Expandir **IndexedDB**
3. Verificar bases de datos

**Resultado esperado:**
- [ ] ✅ Base de datos "park-pos" existe
- [ ] ✅ Tablas visibles (events, products, etc.)
- [ ] ✅ Datos se almacenan localmente

---

## 6️⃣ Test de Logout

### 6.1 Cerrar Sesión

**Pasos:**
1. Click en botón de logout (icono de salida o "Cerrar Sesión")
2. Confirmar si hay diálogo

**Resultado esperado:**
- [ ] ✅ Redirige a pantalla de login
- [ ] ✅ Cookie `auth_token` se elimina
- [ ] ✅ No se puede acceder a módulos sin login
- [ ] ✅ Volver atrás no permite acceso

---

### 6.2 Re-login

**Pasos:**
1. Después de logout, intentar login nuevamente
2. Ingresar PIN: `1234`

**Resultado esperado:**
- [ ] ✅ Login funciona nuevamente
- [ ] ✅ Redirige al dashboard
- [ ] ✅ Sesión se restaura correctamente

---

## 7️⃣ Test de Otros Empleados

### 7.1 Login con Otro Empleado

**Pasos:**
1. Logout del Admin Principal
2. Intentar login con otro PIN (ej: `0001`, `0002`, etc.)

**Resultado esperado:**
- [ ] ✅ Login funciona con otros PINs
- [ ] ✅ Muestra nombre correcto del empleado
- [ ] ✅ Permisos correctos según rol

**Nota:** Si no conoces otros PINs, puedes verificar en la base de datos o usar el script:
```bash
npx tsx scripts/check-production-employees.ts
```

---

## 8️⃣ Test de Performance

### 8.1 Tiempo de Carga

**Pasos:**
1. Abrir DevTools (F12) → Network
2. Recargar la página (Ctrl+R)
3. Verificar tiempo de carga

**Resultado esperado:**
- [ ] ✅ Página carga en < 3 segundos
- [ ] ✅ No hay requests fallidos (404, 500)
- [ ] ✅ Assets cargan correctamente (CSS, JS, imágenes)

---

### 8.2 Console Errors

**Pasos:**
1. Abrir DevTools (F12) → Console
2. Navegar por diferentes módulos
3. Verificar que no hay errores

**Resultado esperado:**
- [ ] ✅ No hay errores rojos en console
- [ ] ✅ No hay warnings críticos
- [ ] ✅ No hay requests fallidos

---

## 9️⃣ Test de Seguridad

### 9.1 Debug Endpoint Eliminado

**Pasos:**
1. Abrir nueva pestaña
2. Ir a: https://parkperu.vercel.app/api/debug/env

**Resultado esperado:**
- [ ] ✅ Retorna 404 Not Found
- [ ] ✅ No expone información sensible

**Si falla:**
- Esperar a que Vercel termine el redeploy (~2 min)
- Verificar que el commit d023cc3 se deployó

---

### 9.2 Acceso sin Autenticación

**Pasos:**
1. Abrir ventana de incógnito
2. Intentar acceder a: https://parkperu.vercel.app/caja
3. Sin hacer login

**Resultado esperado:**
- [ ] ✅ Redirige a login
- [ ] ✅ No permite acceso sin autenticación
- [ ] ✅ Muestra mensaje apropiado

---

## 🔟 Test de Responsive

### 10.1 Mobile View

**Pasos:**
1. Abrir DevTools (F12)
2. Click en icono de dispositivo móvil (Ctrl+Shift+M)
3. Seleccionar "iPhone 12 Pro" o similar
4. Navegar por el sistema

**Resultado esperado:**
- [ ] ✅ UI se adapta a pantalla móvil
- [ ] ✅ Botones son clickeables
- [ ] ✅ Texto es legible
- [ ] ✅ No hay overflow horizontal

---

### 10.2 Tablet View

**Pasos:**
1. En DevTools, seleccionar "iPad"
2. Navegar por el sistema

**Resultado esperado:**
- [ ] ✅ UI se adapta a pantalla tablet
- [ ] ✅ Layout apropiado para tablet
- [ ] ✅ Funcionalidad completa

---

## 📊 Resumen de Resultados

### Tests Pasados

- [ ] 1. Login: ___/2
- [ ] 2. Navegación: ___/2
- [ ] 3. Módulos: ___/4
- [ ] 4. Admin Panel: ___/3
- [ ] 5. Offline: ___/2
- [ ] 6. Logout: ___/2
- [ ] 7. Otros Empleados: ___/1
- [ ] 8. Performance: ___/2
- [ ] 9. Seguridad: ___/2
- [ ] 10. Responsive: ___/2

**Total:** ___/22 tests pasados

---

## 🚨 Problemas Encontrados

### Problema 1
**Test:** _______________  
**Descripción:** _______________  
**Error:** _______________  
**Severidad:** 🔴 Alta / 🟡 Media / 🟢 Baja

### Problema 2
**Test:** _______________  
**Descripción:** _______________  
**Error:** _______________  
**Severidad:** 🔴 Alta / 🟡 Media / 🟢 Baja

### Problema 3
**Test:** _______________  
**Descripción:** _______________  
**Error:** _______________  
**Severidad:** 🔴 Alta / 🟡 Media / 🟢 Baja

---

## 🎯 Criterios de Aceptación

### Mínimo para Producción

**DEBE pasar:**
- ✅ Login funciona (Test 1)
- ✅ Navegación básica funciona (Test 2)
- ✅ Al menos 1 módulo funciona (Test 3)
- ✅ Logout funciona (Test 6)
- ✅ Debug endpoint eliminado (Test 9.1)

**DEBERÍA pasar:**
- ✅ Todos los módulos funcionan (Test 3)
- ✅ Admin panel funciona (Test 4)
- ✅ Performance aceptable (Test 8)
- ✅ Responsive funciona (Test 10)

**PUEDE fallar (no crítico):**
- ⚠️ Offline funciona (Test 5) - puede requerir configuración adicional
- ⚠️ Otros empleados (Test 7) - depende de datos en DB

---

## 📝 Notas Adicionales

### Comandos Útiles

**Verificar PIN_SALT:**
```bash
curl https://parkperu.vercel.app/api/debug/env
```

**Verificar empleados en DB:**
```bash
npx tsx scripts/check-production-employees.ts
```

**Limpiar lockout:**
```bash
npx tsx scripts/clear-lockout-production.ts
```

### Información de Contacto

**URL Producción:** https://parkperu.vercel.app/  
**Vercel Dashboard:** https://vercel.com/dashboard  
**GitHub Repo:** https://github.com/Mikisbell/park  
**Commit Actual:** d023cc3

---

**Última actualización:** 5 Febrero 2026 - 15:15  
**Versión:** 1.0  
**Status:** 🟢 READY TO TEST

