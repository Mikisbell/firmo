# Plan de Corrección de Errores TypeScript - 11 Febrero 2026

## Resumen Ejecutivo

**Total de errores:** 543 errores TypeScript  
**Fecha:** 11 Febrero 2026  
**Prioridad:** 🔴 CRÍTICA - Bloquea build de producción

## Categorías de Errores Identificadas

### 1. Errores de Tipo `never` (Alta frecuencia)
- **Archivos afectados:** 
  - `e2e/03-concurrency.spec.ts`
  - `src/app/admin/monitoring/__tests__/page.test.tsx`
  - `src/core/__tests__/properties-compatibility.test.ts`
  - `src/core/auth/__tests__/audit-logger.test.ts`
- **Causa:** Tipos inferidos incorrectamente como `never`
- **Solución:** Agregar type assertions explícitas

### 2. Módulos No Encontrados
- **Archivo:** `src/app/admin/productos/components/__tests__/ImageUpload.test.tsx`
- **Error:** Cannot find module '@/core/types/product-images'
- **Solución:** Crear el módulo faltante o corregir import

### 3. Errores de Contexto `this` en FileReader
- **Archivo:** `src/app/admin/productos/components/__tests__/ImageUpload.test.tsx`
- **Error:** The 'this' context of type 'this' is not assignable to method's 'this' of type 'FileReader'
- **Solución:** Usar arrow functions o bind correcto

### 4. Propiedades No Conocidas en Objetos Literales
- **Archivos afectados:**
  - `src/app/api/admin/employees/__tests__/employees-api.test.ts` (múltiples ocurrencias)
  - `src/app/api/admin/terminals-v2/[terminalId]/__tests__/terminal-detail-api.test.ts`
- **Error:** Object literal may only specify known properties
- **Solución:** Corregir estructura de objetos o tipos

### 5. Argumentos Faltantes
- **Archivo:** `src/app/api/admin/employees/__tests__/employees-api.test.ts`
- **Error:** Expected 1 arguments, but got 0
- **Solución:** Agregar argumentos requeridos

### 6. Request vs NextRequest
- **Archivo:** `src/app/api/admin/terminals-v2/[terminalId]/__tests__/terminal-detail-api.test.ts`
- **Error:** Argument of type 'Request' is not assignable to parameter of type 'NextRequest'
- **Solución:** Usar NextRequest de next/server

### 7. Propiedades Faltantes en Tipos
- **Archivos:**
  - `src/core/__tests__/properties-security.test.ts`
  - `src/core/alerts/__tests__/alert-deduplication.property.test.ts`
- **Error:** Property does not exist on type
- **Solución:** Agregar type guards o corregir tipos

### 8. Tipos de String Literales
- **Archivo:** `src/core/alerts/__tests__/alert-deduplication.property.test.ts`
- **Error:** Type 'string' is not assignable to type 'ThresholdUnit' | 'ComparisonOperator'
- **Solución:** Usar type casting o valores literales correctos

## Plan de Ejecución

### Fase 1: Errores Críticos de Módulos (5 min)
1. Crear módulo faltante `@/core/types/product-images`
2. Verificar imports

### Fase 2: Errores de Tipos `never` (10 min)
1. Agregar type assertions en tests de concurrency
2. Corregir tipos en monitoring tests
3. Corregir tipos en properties tests
4. Corregir tipos en audit logger tests

### Fase 3: Errores de Request/NextRequest (5 min)
1. Actualizar imports en terminal tests
2. Cambiar Request a NextRequest

### Fase 4: Errores de Objetos Literales (10 min)
1. Corregir estructura de objetos en employees tests
2. Corregir estructura de objetos en terminals tests

### Fase 5: Errores de Propiedades y Tipos (10 min)
1. Agregar type guards en security tests
2. Corregir tipos en alert tests
3. Agregar argumentos faltantes

### Fase 6: Verificación Final (5 min)
1. Ejecutar `npx tsc --noEmit`
2. Verificar que todos los errores estén resueltos
3. Ejecutar tests para verificar que no se rompió nada

## Tiempo Estimado Total

**45 minutos** para corrección completa

## Próximos Pasos

1. Ejecutar Fase 1
2. Verificar progreso
3. Continuar con fases siguientes
4. Commit final con todos los fixes

---

**Estado:** 🔴 EN PROGRESO  
**Última actualización:** 11 Febrero 2026 - 10:30 AM
