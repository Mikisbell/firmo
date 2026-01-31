# Design Document: Frontend Cleanup

## Overview

Este documento describe el diseño para las mejoras incrementales al código frontend de PARK POS. Los cambios son conservadores, mantienen la funcionalidad existente y mejoran la consistencia del código.

## Architecture

No hay cambios arquitectónicos. Todos los cambios son refactorizaciones menores que:
1. Usan constantes centralizadas existentes
2. Remueven type casts innecesarios
3. Exponen funcionalidad existente en la UI
4. Implementan un TODO pendiente usando infraestructura existente

## Components and Interfaces

### Componentes Afectados

```
src/
├── components/auth/
│   └── TerminalSetup.tsx          # Usar DEFAULT_TENANT_ID
├── app/inventario/
│   └── page.tsx                   # Usar DEFAULT_TENANT_ID
├── app/pos/
│   ├── diagnostics/
│   │   └── DiagnosticsClient.tsx  # Usar DEFAULT_TENANT_ID
│   └── components/
│       ├── CatalogGrid.tsx        # Remover as any
│       ├── Cart.tsx               # Remover as any
│       └── NumpadCalculator.tsx   # Agregar botón Clear
├── app/mozo/
│   ├── page.tsx                   # Remover as any
│   └── mesa/[tableId]/
│       └── page.tsx               # Implementar print precheck
└── core/
    ├── config/terminal.ts         # Ya existe DEFAULT_TENANT_ID
    ├── domain/money.ts            # formatCents ya acepta number | Cents
    └── printing/templates.tsx     # Usar para precheck
```

### Interfaces Existentes (Sin Cambios)

```typescript
// src/core/config/terminal.ts - YA EXISTE
export const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID 
    || "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// src/core/domain/money.ts - YA EXISTE
export function formatCents(c: number | Cents): string;
```

## Data Models

No hay cambios en modelos de datos.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Clear Button Resets Display
*For any* NumpadCalculator display state (empty, with digits, with decimal, after "00" button), clicking the Clear button SHALL result in an empty display string.
**Validates: Requirements 3.2**

### Property 2: Precheck Contains All Order Items
*For any* order with N items, the generated precheck document SHALL contain all N items with their correct names, quantities, and prices. The sum of line totals SHALL equal the order total.
**Validates: Requirements 4.1**

### Property 3: Value Constraints
*For any* sequence of numpad inputs, the display value in cents SHALL never exceed maxValue.
**Validates: Requirements 3.2 (implicit)**

### Property 4: Decimal Handling
*For any* sequence of numpad inputs, the display SHALL contain at most one decimal point.
**Validates: Requirements 3.2 (implicit)**

### Property 5: Double Zero Button
*For any* valid display state, the "00" button SHALL add two zeros when the resulting value is within maxValue.
**Validates: Requirements 3.1 (implicit)**

## Error Handling

### Print Precheck Errors
- Si la impresión falla, mostrar toast de error usando el sistema existente de `sonner`
- No bloquear la UI - el usuario puede reintentar

## Testing Strategy

### Unit Tests
- Verificar que los imports de DEFAULT_TENANT_ID existen en los archivos modificados
- Verificar que no existen constantes TENANT_ID locales duplicadas
- Verificar que no hay `as any` en llamadas a formatCents

### Property-Based Tests
- **Property 1**: Generar estados aleatorios del NumpadCalculator y verificar que Clear siempre resulta en display vacío
- **Property 2**: Generar órdenes con items aleatorios y verificar que el precheck contiene todos los items

### Integration Tests
- Verificar que TerminalSetup funciona correctamente con DEFAULT_TENANT_ID
- Verificar que el flujo de print precheck completo funciona

## Implementation Notes

### Cambio 1: Usar DEFAULT_TENANT_ID

**Antes (TerminalSetup.tsx):**
```typescript
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

**Después:**
```typescript
import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';
// Usar DEFAULT_TENANT_ID en lugar de TENANT_ID
```

### Cambio 2: Remover as any

**Antes (CatalogGrid.tsx):**
```typescript
{formatCents(p.price as any)}
```

**Después:**
```typescript
{formatCents(p.price)}
```

### Cambio 3: Agregar Botón Clear

**Antes (NumpadCalculator.tsx):**
```typescript
const _handleClear = () => {
    setDisplay("");
};
// Función existe pero no se usa
```

**Después:**
```typescript
const handleClear = () => {
    setDisplay("");
};
// Agregar botón "C" en el grid que llama a handleClear
```

### Cambio 4: Implementar Print Precheck

**Ubicación:** `src/app/mozo/mesa/[tableId]/page.tsx` y `src/app/pos/components/CheckDetail.tsx`

Se creó una función común `transformLinesToPrint` en `src/core/printing/utils.ts` para garantizar consistencia entre ambas implementaciones:

```typescript
// src/core/printing/utils.ts
export interface OrderLineInput {
  line_id: string;
  product_id: string;
  name: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  station?: string;
}

export interface PrintLine {
  name: string;
  qty: number;
  total: number;
}

export function transformLinesToPrint(items: OrderLineInput[]): PrintLine[] {
  return items.map(item => ({
    name: item.name || item.product_id,
    qty: item.qty,
    total: item.line_total_cents
  }));
}
```

**Uso en Mesa page:**
```typescript
import { transformLinesToPrint } from '@/src/core/printing/utils';

const handlePrintPrecheck = () => {
    if (!activeSale || items.length === 0) {
        toast.error("No hay items para imprimir");
        return;
    }
    
    const linesToPrint = transformLinesToPrint(items);
    
    printComponent(
        <TicketTemplate
            tenantName="PARK POS"
            date={new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()}
            orderNumber={activeSale.order_number || 0}
            lines={linesToPrint}
            subtotal={activeSale.subtotal_cents}
            discount={0}
            total={activeSale.subtotal_cents}
            invoiceType="PRE-CUENTA"
        />,
        `Pre-cuenta Mesa ${tableId}`
    );
    toast.success("Pre-cuenta enviada a impresora");
};
```
