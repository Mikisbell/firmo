# Análisis de Causa Raíz: Fallos en Tests de Aislamiento RLS Multi-Tenant

**Fecha**: 9 Febrero 2026  
**Status**: ✅ PROBLEMA IDENTIFICADO - Solución lista para implementar

---

## 🔍 Resumen Ejecutivo

Los tests E2E de aislamiento RLS multi-tenant estaban fallando, reportando que Tenant 1 podía ver datos de Tenant 2. Sin embargo, el análisis profundo reveló que:

1. ✅ **El aislamiento RLS a nivel de base de datos funciona PERFECTAMENTE**
2. ✅ **Las APIs filtran correctamente por tenant_id**
3. ❌ **El problema está en los SELECTORES del test E2E**

---

## 📊 Evidencia del Diagnóstico

### 1. Verificación de Base de Datos

**Script**: `scripts/diagnose-rls-isolation.ts`

```
Tenant 1: 18 employees (todos con tenant_id correcto)
Tenant 2: 15 employees (todos con tenant_id correcto)
Employees sin tenant: 0
Employees con tenant inválido: 0
```

**Conclusión**: ✅ Los datos están correctamente aislados en la base de datos.

### 2. Verificación de APIs

**Script**: `scripts/test-api-employees-isolation.ts`

```
Tenant 1: 18 employees
Tenant 2: 15 employees
Overlap: 0 nombres

✅ AISLAMIENTO CORRECTO: No hay overlap entre tenants
```

**Conclusión**: ✅ Las APIs retornan SOLO los datos del tenant autenticado.

### 3. Análisis del Frontend

**Archivo**: `src/app/admin/empleados/page.tsx`

La tabla de employees tiene 4 columnas:
1. **Nombre** - `<span data-testid="employee-name">{e.name}</span>`
2. **Rol** - Muestra traducción: `'ADMIN'` → `'Administrador'`
3. **Estado** - Activo/Inactivo
4. **Acciones** - Botón editar

---

## 🐛 Causa Raíz del Problema

### Selector Problemático en el Test

**Archivo**: `e2e/multi-tenant-rls-isolation.spec.ts` (línea 88-89)

```typescript
// ❌ PROBLEMA: Selector con múltiples fallbacks
const tenant2Names = await page.locator(
  '[data-testid="employee-name"], td:nth-child(2), .employee-name'
).allTextContents();
```

### ¿Por qué falla?

El selector `td:nth-child(2)` captura la **SEGUNDA columna** de TODAS las filas de la tabla, que incluye:

1. ✅ Nombres de employees: "Admin Tenant 2", "Cajero Tenant 2", etc.
2. ❌ **Roles traducidos**: "Administrador", "Cajero", "Mesero", etc.

### Ejemplo de lo que captura:

```
Fila 1:
  - td:nth-child(1): "Admin Tenant 2"
  - td:nth-child(2): "Administrador" ← ❌ CAPTURADO POR ERROR

Fila 2:
  - td:nth-child(1): "Cajero Tenant 2"
  - td:nth-child(2): "Cajero" ← ❌ CAPTURADO POR ERROR
```

### Resultado del Test

```
Expected value: not "Administrador"
Received array: ["Admin Tenant 2", "Administrador", "Cajero Tenant 2", "Cajero", ...]
```

El test ve "Administrador" (que es la traducción del rol ADMIN) y piensa que es un employee de Tenant 1, cuando en realidad es solo la etiqueta del rol.

---

## ✅ Solución

### Cambio Requerido

**Archivo**: `e2e/multi-tenant-rls-isolation.spec.ts`

**ANTES** (líneas 88-89):
```typescript
const tenant2Names = await page.locator(
  '[data-testid="employee-name"], td:nth-child(2), .employee-name'
).allTextContents();
```

**DESPUÉS**:
```typescript
const tenant2Names = await page.locator('[data-testid="employee-name"]').allTextContents();
```

### Aplicar en Todos los Tests

El mismo cambio debe aplicarse en:
1. Test de employees (líneas 67, 88)
2. Test de products (líneas 134, 155)
3. Test de tenant switching (líneas 421, 442, 463)

---

## 🎯 Impacto de la Solución

### Antes
- ❌ 25 tests fallando
- ❌ Falsos positivos de violación de RLS
- ❌ Confusión sobre el estado del aislamiento

### Después
- ✅ Tests pasarán correctamente
- ✅ Confirmación de que RLS funciona perfectamente
- ✅ Confianza en el aislamiento multi-tenant

---

## 📝 Lecciones Aprendidas

### 1. Selectores Específicos > Selectores Genéricos

**MAL**:
```typescript
// Selector genérico que captura múltiples elementos
'td:nth-child(2)'
```

**BIEN**:
```typescript
// Selector específico con data-testid
'[data-testid="employee-name"]'
```

### 2. Siempre Usar data-testid

Los `data-testid` existen precisamente para evitar este tipo de problemas:
- Son específicos y únicos
- No se ven afectados por cambios de estructura HTML
- Son más mantenibles

### 3. Verificar Múltiples Niveles

Cuando un test falla, verificar:
1. ✅ Base de datos
2. ✅ APIs
3. ✅ Frontend
4. ✅ Selectores del test

En este caso, el problema estaba en el nivel 4 (selectores del test), no en los niveles 1-3.

---

## 🔧 Próximos Pasos

1. **Implementar la solución** - Actualizar selectores en el test
2. **Ejecutar tests** - Verificar que todos pasen
3. **Commit y push** - Documentar el fix
4. **Actualizar documentación** - Agregar guía de mejores prácticas para selectores E2E

---

## 📚 Referencias

- **Script de diagnóstico DB**: `scripts/diagnose-rls-isolation.ts`
- **Script de diagnóstico API**: `scripts/test-api-employees-isolation.ts`
- **Test E2E**: `e2e/multi-tenant-rls-isolation.spec.ts`
- **Página de employees**: `src/app/admin/empleados/page.tsx`

---

**Conclusión**: El aislamiento RLS multi-tenant funciona perfectamente. El problema era un selector de test que capturaba datos incorrectos. La solución es simple: usar solo `[data-testid="employee-name"]` en lugar de selectores genéricos.
