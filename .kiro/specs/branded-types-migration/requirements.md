# Requirements: Branded Types Migration

## Overview

Migración gradual de tipos planos (`number`, `string`) a Branded Types (`Centavos`, `OrderId`, etc.) en el código de producción de PARK POS. Los Branded Types ya existen en `src/core/types/shared.ts` pero solo se usan en tests.

## Motivation

1. **Prevención de errores financieros** - `Centavos` evita mezclar soles con centavos
2. **Type safety en IDs** - Evita pasar `orderId` donde se espera `shiftId`
3. **Documentación en código** - Los tipos expresan la intención
4. **Validación en runtime** - `asCentavos()` valida que sea entero no-negativo

## Functional Requirements

### FR-1: Migración de Centavos (Prioridad Alta)
- FR-1.1: Todos los campos `*_cents` en projections deben usar `Centavos`
- FR-1.2: Funciones de cálculo de dinero deben retornar `Centavos`
- FR-1.3: Validaciones de negocio deben aceptar `Centavos`
- FR-1.4: APIs deben convertir input a `Centavos` en el boundary

### FR-2: Migración de IDs (Prioridad Media)
- FR-2.1: `order_id` debe usar `OrderId` en projections
- FR-2.2: `shift_id` debe usar `ShiftId` en projections
- FR-2.3: `tenant_id` debe usar `TenantId` en config y services
- FR-2.4: `terminal_id` debe usar `TerminalId` en config

### FR-3: Migración de BusinessDate (Prioridad Media)
- FR-3.1: Campos `business_date` deben usar `BusinessDate`
- FR-3.2: Queries de Prisma deben usar `BusinessDate` para filtros

### FR-4: Compatibilidad
- FR-4.1: Tests existentes deben seguir pasando
- FR-4.2: APIs externas no cambian (JSON sigue siendo number/string)
- FR-4.3: Prisma queries funcionan con Branded Types (cast implícito)

## Non-Functional Requirements

### NFR-1: Zero Breaking Changes
- Migración debe ser incremental sin romper funcionalidad
- Cada fase debe ser deployable independientemente

### NFR-2: Performance
- Branded Types tienen zero runtime cost (solo compile-time)
- Helpers de validación solo en boundaries (input)

### NFR-3: Developer Experience
- Errores de tipo deben ser claros y accionables
- Documentación inline en tipos

## Out of Scope

- Cambios a schema de Prisma (ya usa Int para centavos)
- Cambios a formato de eventos (JSON sigue igual)
- Migración de código de UI (solo core domain)
- Enforcement estricto (sigue siendo opt-in por limitaciones de TS)

## Success Criteria

1. ✅ 100% de campos `*_cents` en projections usan `Centavos`
2. ✅ 100% de IDs en projections usan Branded Types
3. ✅ Todos los tests existentes pasan
4. ✅ Nuevos tests validan type safety
5. ✅ Zero regresiones en funcionalidad
