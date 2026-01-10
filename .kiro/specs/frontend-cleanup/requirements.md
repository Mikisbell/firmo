# Requirements Document

## Introduction

Este documento especifica mejoras incrementales al código frontend de PARK POS identificadas durante una auditoría. Los cambios son conservadores y mantienen la funcionalidad existente mientras mejoran la consistencia y mantenibilidad del código.

## Glossary

- **Tenant_ID**: Identificador único del inquilino/negocio en formato UUID
- **DEFAULT_TENANT_ID**: Constante centralizada en `src/core/config/terminal.ts` que ya existe
- **Terminal_Config**: Configuración almacenada del terminal incluyendo tenant_id, terminal_id, role
- **formatCents**: Función en `src/core/domain/money.ts` que ya acepta `number | Cents`

## Requirements

### Requirement 1: Usar DEFAULT_TENANT_ID Centralizado

**User Story:** Como desarrollador, quiero que todos los componentes usen la constante centralizada DEFAULT_TENANT_ID, para mantener consistencia y facilitar cambios futuros.

#### Acceptance Criteria

1. WHEN the TerminalSetup component initializes, THE System SHALL import and use DEFAULT_TENANT_ID from `src/core/config/terminal.ts`
2. WHEN the Inventario page loads, THE System SHALL import and use DEFAULT_TENANT_ID from `src/core/config/terminal.ts`
3. WHEN the DiagnosticsClient seeds a fake event, THE System SHALL import and use DEFAULT_TENANT_ID from `src/core/config/terminal.ts`
4. THE System SHALL remove the local TENANT_ID constants from these files after importing the centralized one

### Requirement 2: Remover Type Casts Innecesarios

**User Story:** Como desarrollador, quiero que el código no tenga `as any` innecesarios, para mejorar la legibilidad sin cambiar la funcionalidad.

#### Acceptance Criteria

1. WHEN displaying prices in CatalogGrid, THE System SHALL pass the price directly to formatCents without `as any` cast since formatCents already accepts `number | Cents`
2. WHEN displaying prices in Cart component, THE System SHALL pass values directly to formatCents without `as any` cast
3. WHEN displaying table totals in Mozo page, THE System SHALL pass totalCents directly to formatCents without `as any` cast
4. THE formatCents function signature SHALL remain unchanged as it already accepts `number | Cents`

### Requirement 3: Exponer Funcionalidad Clear en NumpadCalculator

**User Story:** Como cajero, quiero poder limpiar el monto ingresado con un botón Clear, para corregir errores rápidamente sin borrar dígito por dígito.

#### Acceptance Criteria

1. WHEN the NumpadCalculator renders, THE System SHALL display a Clear button (C) in the numpad grid
2. WHEN the user clicks the Clear button, THE System SHALL reset the display to empty using the existing _handleClear function
3. THE Clear button SHALL be visually distinguishable from digit buttons with a different background color

### Requirement 4: Implementar Print Precheck

**User Story:** Como mesero, quiero poder imprimir una pre-cuenta desde la mesa, para mostrar al cliente el total antes del pago.

#### Acceptance Criteria

1. WHEN a waiter clicks the print precheck button, THE System SHALL generate a precheck document with current order items and totals
2. WHEN printing a precheck, THE System SHALL use the existing printing templates infrastructure in `src/core/printing/templates.tsx`
3. IF printing fails, THEN THE System SHALL display an error toast notification using the existing toast system
