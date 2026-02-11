# Errores Críticos de TypeScript - 12 Febrero 2026

## Estado Actual

**Comando ejecutado:** `npx tsc --noEmit`  
**Resultado:** ❌ **526 errores en 46 archivos**

## Resumen Ejecutivo

El sistema tiene errores críticos de TypeScript que bloquean la continuación del testing. Los errores se concentran en:

1. **Property tests** - Problemas con arbitraries y tipos `unknown`
2. **Test utils** - Exports faltantes y tipos incorrectos
3. **Imports** - Módulos no encontrados
4. **Mocks** - Propiedades inexistentes en mocks de Prisma

## Categorías de Errores

### 1. Arbitraries y Tipos Unknown (300+ errores)

**Archivos afectados:**
- `src/core/projection/__tests__/shift.property.test.ts` (23 errores)
- `src/core/validation/__tests__/business-rules.property.test.ts` (32 errores)
- `src/core/validation/__tests__/payment.property.test.ts` (56 errores)
- `src/core/domain/__tests__/data-integrity.property.test.ts` (70 errores)
- `src/core/delivery/__tests__/assignment.property.test.ts` (76 errores)
- `src/core/projection/__tests__/order.property.test.ts` (66 errores)

**Problema:** Los arbitraries de fast-check retornan tipo `unknown` en lugar de tipos específicos.

**Ejemplo:**
```typescript
// Error: 'shift' is of type 'unknown'
(shift) => shift.closed_at === null || shift.closed_at === undefined
```

### 2. Test Utils - Exports Faltantes (10+ errores)

**Archivos afectados:**
- `src/core/validation/__tests__/business-rules.property.test.ts`
- `src/core/validation/__tests__/payment.property.test.ts`

**Exports faltantes:**
- `roleArb` - No existe en `@/src/test-utils`
- `smallCentavosArb` - No existe (existe `centavosArb`)
- `expectValidDiscount` - No existe (existe `expectValidJSONB`)
- `expectValidPayment` - No existe (existe `expectValidEvent`)

### 3. Módulos No Encontrados (10+ errores)

**Archivos afectados:**
- `src/core/result/result.test.ts` - No encuentra `@/core/result`
- `src/core/saga/__tests__/offline.property.test.ts` - No encuentra `../offline`
- `src/core/services/__tests__/integration.test.ts` - No encuentra múltiples servicios
- `src/core/services/__tests__/order.service.test.ts` - No encuentra `@/core/cache/redis.service`
- `src/core/tenant/__tests__/quotas.unit.test.ts` - No encuentra `../quotas`

### 4. Mocks de Prisma (10+ errores)

**Archivo afectado:**
- `src/core/services/__tests__/order.service.test.ts`

**Problema:** Propiedades `mockResolvedValue` no existen en métodos de Prisma.

**Ejemplo:**
```typescript
// Error: Property 'mockResolvedValue' does not exist
mockPrisma.$queryRaw.mockResolvedValue([{ max_num: 100 }]);
mockPrisma.orders.create.mockResolvedValue({...});
```

### 5. Otros Errores (50+ errores)

- Spread types en objetos `unknown`
- Propiedades inexistentes en tipos
- Argumentos incorrectos en funciones
- Expresiones no callable (await faltante)

## Distribución de Errores por Archivo

| Archivo | Errores | Categoría |
|---------|---------|-----------|
| `src/core/delivery/__tests__/assignment.property.test.ts` | 76 | Arbitraries |
| `src/core/domain/__tests__/data-integrity.property.test.ts` | 70 | Arbitraries |
| `src/core/projection/__tests__/order.property.test.ts` | 66 | Arbitraries |
| `src/core/validation/__tests__/payment.property.test.ts` | 56 | Arbitraries + Exports |
| `src/core/delivery/__tests__/whatsapp.unit.test.ts` | 35 | Varios |
| `src/core/validation/__tests__/business-rules.property.test.ts` | 32 | Arbitraries + Exports |
| `src/core/projection/__tests__/shift.property.test.ts` | 23 | Arbitraries |
| `src/core/domain/__tests__/money.property.test.ts` | 17 | Arbitraries |
| `src/core/domain/__tests__/events.property.test.ts` | 13 | Arbitraries |
| `src/core/inventory/__tests__/inventory.property.test.ts` | 13 | Arbitraries |
| Otros 36 archivos | ~125 | Varios |

## Impacto

🔴 **CRÍTICO - BLOQUEANTE**

- ❌ No se puede ejecutar `npm test` (tests unitarios fallarán)
- ❌ No se puede ejecutar `npm run build` (build fallará)
- ❌ No se puede continuar con Task 18
- ❌ No se puede continuar con Phase 5

## Plan de Corrección

### Opción 1: Corrección Completa (Recomendada)

**Tiempo estimado:** 2-4 horas

1. **Corregir test-utils.ts**
   - Agregar exports faltantes: `roleArb`, `smallCentavosArb`, `expectValidDiscount`, `expectValidPayment`
   - Verificar que todos los arbitraries retornen tipos correctos

2. **Corregir arbitraries con tipos unknown**
   - Agregar type annotations explícitas a todos los arbitraries
   - Usar `fc.Arbitrary<TipoEspecífico>` en lugar de `fc.Arbitrary<unknown>`

3. **Corregir módulos no encontrados**
   - Crear archivos faltantes o corregir imports
   - Verificar paths de imports

4. **Corregir mocks de Prisma**
   - Usar `vi.mocked()` correctamente
   - Agregar type assertions donde sea necesario

5. **Verificar con `npx tsc --noEmit`**
   - Ejecutar hasta que no haya errores

### Opción 2: Corrección Parcial (Rápida)

**Tiempo estimado:** 30-60 minutos

1. **Comentar archivos problemáticos**
   - Comentar imports de archivos con errores
   - Marcar como `@ts-ignore` temporalmente

2. **Corregir solo errores críticos**
   - Módulos no encontrados
   - Exports faltantes en test-utils

3. **Verificar que el build pase**
   - `npm run build` debe completar

**⚠️ Advertencia:** Esta opción deja tests sin ejecutar.

### Opción 3: Skip Tests Problemáticos (Temporal)

**Tiempo estimado:** 15-30 minutos

1. **Marcar tests como `.skip`**
   - Agregar `.skip` a todos los tests con errores
   - Documentar razón del skip

2. **Verificar que tests restantes pasen**
   - `npm test` debe completar con tests skipped

**⚠️ Advertencia:** Esta opción reduce cobertura de tests significativamente.

## Recomendación

**Opción 1 (Corrección Completa)** es la recomendada porque:

1. ✅ Resuelve el problema de raíz
2. ✅ Mantiene cobertura de tests completa
3. ✅ Evita deuda técnica
4. ✅ Sistema production-ready

**Razón:** Estamos en Phase 4 de consolidación, es el momento correcto para corregir estos errores antes de deployment.

## Próximos Pasos

1. **Decisión del usuario:** ¿Qué opción prefieres?
2. **Ejecutar corrección** según opción elegida
3. **Verificar con `npx tsc --noEmit`**
4. **Continuar con batería de tests** según `PLAN_TESTING_EXHAUSTIVO_12_FEB_2026.md`

---

**Fecha:** 12 Febrero 2026  
**Autor:** Kiro AI  
**Estado:** 🔴 BLOQUEANTE - Requiere corrección antes de continuar  
**Prioridad:** CRÍTICA

