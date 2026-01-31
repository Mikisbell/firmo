# Implementation Plan: Frontend Cleanup

## Overview

Plan de implementación para las mejoras incrementales al código frontend de PARK POS. Todos los cambios son conservadores y usan infraestructura existente.

## Tasks

- [x] 1. Centralizar uso de DEFAULT_TENANT_ID
  - [x] 1.1 Actualizar TerminalSetup.tsx para usar DEFAULT_TENANT_ID
    - Importar DEFAULT_TENANT_ID desde `src/core/config/terminal.ts`
    - Reemplazar la constante local TENANT_ID con el import
    - Verificar que el componente funciona correctamente
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Actualizar Inventario page.tsx para usar DEFAULT_TENANT_ID
    - Importar DEFAULT_TENANT_ID desde `src/core/config/terminal.ts`
    - Reemplazar la constante local TENANT_ID con el import
    - Verificar que la página funciona correctamente
    - _Requirements: 1.2, 1.4_

  - [x] 1.3 Actualizar DiagnosticsClient.tsx para usar DEFAULT_TENANT_ID
    - Importar DEFAULT_TENANT_ID desde `src/core/config/terminal.ts`
    - Reemplazar el UUID hardcodeado en seedFakeEvent con el import
    - Verificar que el diagnóstico funciona correctamente
    - _Requirements: 1.3, 1.4_

- [x] 2. Remover type casts innecesarios (as any)
  - [x] 2.1 Limpiar CatalogGrid.tsx
    - Remover `as any` de la llamada a formatCents
    - formatCents ya acepta `number | Cents`
    - _Requirements: 2.1, 2.4_

  - [x] 2.2 Limpiar Cart.tsx
    - Remover `as any` de las llamadas a formatCents (3 instancias)
    - _Requirements: 2.2, 2.4_

  - [x] 2.3 Limpiar Mozo page.tsx
    - Remover `as any` de la llamada a formatCents para totalCents
    - _Requirements: 2.3, 2.4_

- [x] 3. Checkpoint - Verificar que no hay errores
  - Ejecutar `npm run lint` para verificar que no hay errores de ESLint
  - Ejecutar `npx tsc --noEmit` para verificar tipos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Exponer funcionalidad Clear en NumpadCalculator
  - [x] 4.1 Renombrar _handleClear a handleClear
    - Remover el prefijo underscore ya que la función será usada
    - _Requirements: 3.2_

  - [x] 4.2 Agregar botón Clear (C) al grid del numpad
    - Agregar botón "C" en la posición apropiada del grid
    - Conectar el botón a handleClear
    - Usar estilo visual diferente (ej: bg-amber-600)
    - _Requirements: 3.1, 3.3_

  - [x] 4.3 Escribir property test para Clear button
    - **Property 1: Clear Button Resets Display**
    - **Validates: Requirements 3.2**

- [x] 5. Implementar Print Precheck
  - [x] 5.1 Revisar infraestructura de printing existente
    - Leer `src/core/printing/templates.tsx` para entender la estructura
    - Identificar si existe template de precheck o crear uno nuevo
    - _Requirements: 4.2_

  - [x] 5.2 Implementar handlePrintPrecheck en Mesa page
    - Reemplazar el TODO con implementación real
    - Usar la infraestructura de printing existente
    - Manejar errores con toast
    - _Requirements: 4.1, 4.3_

  - [x] 5.3 Escribir property test para precheck
    - **Property 2: Precheck Contains All Order Items**
    - **Validates: Requirements 4.1**

- [x] 6. Final checkpoint - Verificar implementación completa
  - Ejecutar todos los tests: `npm test`
  - Verificar que ESLint pasa: `npm run lint`
  - Verificar tipos: `npx tsc --noEmit`
  - Ensure all tests pass, ask the user if questions arise.

## Backend Fixes (Added)

- [x] 7. Backend Validation Fixes
  - [x] 7.1 Fix validateCheckMarkedPaid - busca payments en check.payment.payments
  - [x] 7.2 Fix validateInvoiceIssued - usa check.payment?.status en lugar de check.status
  - [x] 7.3 Add validation for REQUEST_CHECK - valida que order existe y no está cancelada
  - [x] 7.4 Add validation for ORDER_SUBMITTED - valida order existe, tiene items, no cancelada
  - [x] 7.5 Add REQUEST_CHECK y ORDER_SUBMITTED a role-permissions (WAITER, CASHIER, MANAGER, ADMIN)
  - [x] 7.6 Create property tests for sale.reducer.ts (6 properties, 100 runs each)

## Notes

- Todos los cambios usan infraestructura existente - no crear nuevas abstracciones
- formatCents ya acepta `number | Cents`, no necesita cambios
- DEFAULT_TENANT_ID ya existe en `src/core/config/terminal.ts`
- Se creó `src/core/printing/utils.ts` con función común `transformLinesToPrint` para garantizar consistencia entre Mesa page y CheckDetail
- Se corrigió bug en `handleDecimal`: `display || "0" + "."` → `(display || "0") + "."`
- Property tests documentados como model-based testing (simulan comportamiento sin renderizar React)
- Backend fixes: validateCheckMarkedPaid y validateInvoiceIssued corregidos para usar estructura correcta de check.payment
- Nuevas validaciones: REQUEST_CHECK y ORDER_SUBMITTED agregadas a business-rules.ts
- Property tests para sale.reducer: 6 propiedades que validan invariantes del reducer
