# Pruebas Manuales: Implementación de useCallback - 13 Febrero 2026

## Estado Actual

✅ **Implementación Completada**
- 20 funciones optimizadas con useCallback
- 7 componentes modificados
- Build local exitoso (155 páginas generadas)
- Servidor de desarrollo corriendo en `http://localhost:3000`

---

## Objetivo de las Pruebas

Verificar que los componentes optimizados con useCallback funcionan correctamente y no se introdujeron bugs.

---

## Checklist de Pruebas Manuales

### 🔴 PRIORIDAD ALTA - Componentes Críticos

#### 1. AuthProvider - Login/Logout
**Componente**: `src/components/auth/AuthProvider.tsx`  
**Funciones optimizadas**: 5 (handleLogout, handleLogin, handleStepUpAuthComplete, handleStepUpAuthCancel, handleTerminalError)

**Pruebas**:
- [ ] Abrir `http://localhost:3000`
- [ ] Hacer login con PIN 1234
- [ ] Verificar que el login funciona correctamente
- [ ] Hacer logout
- [ ] Verificar que el logout funciona correctamente
- [ ] Verificar que no hay errores en la consola del navegador

**Resultado Esperado**: Login y logout funcionan sin errores

---

#### 2. NumpadCalculator - Teclado Numérico
**Componente**: `src/app/pos/components/NumpadCalculator.tsx`  
**Funciones optimizadas**: 5 (handleDigit, handleDecimal, handleBackspace, handleClear, handleConfirm)

**Pruebas**:
- [ ] Navegar a la página de caja (POS)
- [ ] Abrir el teclado numérico (para ingresar cantidad o precio)
- [ ] Presionar varios dígitos (1, 2, 3, 4, 5)
- [ ] Verificar que los dígitos aparecen correctamente
- [ ] Presionar el botón decimal (.)
- [ ] Verificar que el decimal funciona
- [ ] Presionar backspace
- [ ] Verificar que borra el último dígito
- [ ] Presionar clear
- [ ] Verificar que limpia todo
- [ ] Ingresar un valor y presionar confirmar
- [ ] Verificar que el valor se aplica correctamente
- [ ] Verificar que no hay errores en la consola

**Resultado Esperado**: Teclado numérico responde correctamente a todas las acciones

---

### 🟡 PRIORIDAD MEDIA - Componentes de Navegación

#### 3. WaiterPage - Navegación y Notificaciones
**Componente**: `src/app/mozo/page.tsx`  
**Funciones optimizadas**: 3 (handleExit, handleHome, toggleNotificationPanel)

**Pruebas**:
- [ ] Navegar a la página de mesero (`/mozo`)
- [ ] Presionar el botón de home en el header
- [ ] Verificar que navega correctamente
- [ ] Regresar a `/mozo`
- [ ] Presionar el botón de salida
- [ ] Verificar que navega correctamente
- [ ] Regresar a `/mozo`
- [ ] Presionar el botón de notificaciones
- [ ] Verificar que el panel de notificaciones se abre
- [ ] Presionar nuevamente para cerrar
- [ ] Verificar que el panel se cierra
- [ ] Verificar que no hay errores en la consola

**Resultado Esperado**: Navegación y panel de notificaciones funcionan correctamente

---

#### 4. GlobalHeader - Botones de Navegación
**Componente**: `src/components/layout/GlobalHeader.tsx`  
**Funciones optimizadas**: 2 (handleExit, handleHome)

**Pruebas**:
- [ ] Navegar a cualquier página con GlobalHeader
- [ ] Presionar el botón de home
- [ ] Verificar que navega a la página principal
- [ ] Presionar el botón de salida
- [ ] Verificar que navega correctamente
- [ ] Verificar que no hay errores en la consola

**Resultado Esperado**: Botones de navegación funcionan correctamente

---

### 🟢 PRIORIDAD BAJA - Componentes de UI

#### 5. NotificationPanel - Click en Notificaciones
**Componente**: `src/app/mozo/components/NotificationPanel.tsx`  
**Función optimizada**: 1 (handleNotificationClick)

**Pruebas**:
- [ ] Abrir el panel de notificaciones en `/mozo`
- [ ] Si hay notificaciones, hacer click en una
- [ ] Verificar que se marca como leída
- [ ] Verificar que el panel se cierra
- [ ] Verificar que navega a la página correcta (si aplica)
- [ ] Verificar que no hay errores en la consola

**Resultado Esperado**: Click en notificaciones funciona correctamente

---

#### 6. OptimizedImage - Carga de Imágenes
**Componente**: `src/components/ui/OptimizedImage.tsx`  
**Funciones optimizadas**: 2 (handleLoad, handleError)

**Pruebas**:
- [ ] Navegar a cualquier página con imágenes (catálogo, productos)
- [ ] Verificar que las imágenes cargan correctamente
- [ ] Abrir DevTools → Network tab
- [ ] Recargar la página
- [ ] Verificar que no hay errores de carga de imágenes
- [ ] Verificar que no hay errores en la consola

**Resultado Esperado**: Imágenes cargan sin errores

---

#### 7. TenantLogo - Logo del Tenant
**Componente**: `src/components/branding/TenantLogo.tsx`  
**Funciones optimizadas**: 2 (handleImageError, handleImageLoad)

**Pruebas**:
- [ ] Navegar a cualquier página con el logo del tenant
- [ ] Verificar que el logo carga correctamente
- [ ] Si el logo no existe, verificar que muestra el fallback
- [ ] Verificar que no hay errores en la consola

**Resultado Esperado**: Logo carga correctamente o muestra fallback

---

## Verificación de Performance (Opcional)

### Medir Re-renders con React DevTools Profiler

**Requisitos**:
- React DevTools instalado en el navegador
- Conocimiento básico de React DevTools Profiler

**Pasos**:
1. Abrir React DevTools en el navegador
2. Ir a la pestaña "Profiler"
3. Presionar el botón de grabar (círculo rojo)
4. Realizar acciones en la aplicación (login, navegar, usar teclado numérico)
5. Detener la grabación
6. Revisar el flamegraph para ver re-renders
7. Buscar componentes optimizados (AuthProvider, NumpadCalculator, etc.)
8. Verificar que se re-renderizan menos veces

**Resultado Esperado**: Reducción de 30-40% en re-renders de componentes hijos

---

## Checklist de Errores Comunes

Durante las pruebas, verificar que NO ocurran estos errores:

- [ ] ❌ "Cannot read property 'X' of undefined" en consola
- [ ] ❌ Botones que no responden al click
- [ ] ❌ Navegación que no funciona
- [ ] ❌ Teclado numérico que no ingresa dígitos
- [ ] ❌ Panel de notificaciones que no abre/cierra
- [ ] ❌ Imágenes que no cargan
- [ ] ❌ Login/logout que no funciona
- [ ] ❌ Errores de TypeScript en consola
- [ ] ❌ Warnings de React sobre dependencias

---

## Reporte de Resultados

Después de completar las pruebas, reportar:

1. **Funcionalidad**: ¿Todos los componentes funcionan correctamente? (Sí/No)
2. **Errores**: ¿Se encontraron errores? (Sí/No) - Si sí, listar
3. **Performance**: ¿Se observó mejora en performance? (Sí/No/No medido)
4. **Consola**: ¿Hay errores o warnings en la consola? (Sí/No) - Si sí, listar

---

## Próximos Pasos

Una vez completadas las pruebas exitosamente:

1. ✅ Hacer commit de todos los cambios (siguiendo git workflow: 1 solo commit)
2. ✅ Hacer push a GitHub
3. ✅ Continuar con Tarea 7.9: Identificar cálculos costosos que necesitan useMemo
4. ✅ Continuar con Tarea 7.10: Aplicar useMemo a cálculos costosos

---

## Comandos Útiles

```bash
# Servidor de desarrollo (ya corriendo)
npm run dev

# Abrir en navegador
start http://localhost:3000

# Ver logs del servidor
# (ya visible en la terminal donde corre npm run dev)

# Detener servidor (si necesario)
Ctrl+C en la terminal
```

---

**Fecha**: 13 Febrero 2026  
**Spec**: performance-optimization-vercel-best-practices  
**Tarea**: 7.7 Aplicar useCallback a funciones estables  
**Estado**: ✅ Implementación completa, ⏳ Pruebas manuales pendientes
