# 💰 FLUJO DE DESCUENTOS Y PROMOCIONES — Análisis

> **Documento:** Análisis del sistema de descuentos (diseñado pero no implementado)  
> **Fecha:** Enero 2026  
> **Estado:** DSL diseñado, implementación pendiente

---

## 📋 ÍNDICE

1. [Estado Actual](#estado-actual)
2. [Tipos de Descuentos](#tipos-de-descuentos)
3. [Escenarios Reales](#escenarios-reales)
4. [Gap Analysis](#gap-analysis)
5. [Plan de Implementación](#plan-de-implementación)

---

## ESTADO ACTUAL

### Lo que existe (Diseño)

✅ **PROMOTIONS_DSL.md** — Documento completo con:
- Estructura JSON de reglas
- Condiciones (when/all/any/none)
- Tipos de aplicación (PERCENT, FIXED, BUY_X_GET_Y, etc.)
- Ejemplos reales (Happy Hour, 2x1, Cumpleaños)
- Lógica de stacking
- Snapshots inmutables

### Lo que NO existe (Código)

❌ **Motor de evaluación** — No hay código que evalúe las reglas
❌ **UI de descuentos** — No hay botón/modal para aplicar descuentos
❌ **Evento ORDER_DISCOUNT_APPLIED** — Definido pero no usado
❌ **Almacenamiento de promociones** — No hay tabla/colección
❌ **Validación de límites** — No hay control de uso

### Código Actual Relacionado

```typescript
// sale.reducer.ts - El campo existe pero no se usa
interface CheckProjection {
  discount_cents: number;  // Siempre 0
}

// events.ts - Evento definido pero no implementado
type EventType = 
  | "ORDER_DISCOUNT_APPLIED"  // ← Existe en tipos
  // ...

// CheckDetail.tsx - Muestra descuento si existe
{check.discount_cents > 0 && (
  <div className="flex justify-between text-red-500">
    <span>DESCUENTO</span>
    <span>- S/ {(check.discount_cents / 100).toFixed(2)}</span>
  </div>
)}
// Pero nunca hay descuento porque no se puede aplicar
```

---

## TIPOS DE DESCUENTOS

### Tipo 1: Descuento Manual (Cajero)

```
SITUACIÓN:
Cliente frecuente, cajero quiere dar 10% de cortesía.

FLUJO ESPERADO:
1. Cajero tiene orden con total S/ 50
2. Cajero presiona "Descuento"
3. Modal muestra opciones:
   - Porcentaje: [10]%
   - Monto fijo: S/ [___]
4. Si > 20%, pide autorización
5. Cajero confirma
6. Total se actualiza: S/ 45

ESTADO: ❌ NO IMPLEMENTADO
```

### Tipo 2: Promoción Automática

```
SITUACIÓN:
Viernes 7 PM, Happy Hour activo (20% en bebidas).

FLUJO ESPERADO:
1. Cliente pide 1/2 pollo + 2 gaseosas
2. Sistema detecta:
   - Es viernes
   - Hora: 19:00 (dentro de 18-21)
   - Hay bebidas en la orden
3. Sistema aplica automáticamente 20% a gaseosas
4. UI muestra: "🎉 Happy Hour aplicado"

ESTADO: ❌ NO IMPLEMENTADO
```

### Tipo 3: Cupón/Código

```
SITUACIÓN:
Cliente tiene código "NAVIDAD10" para 10% de descuento.

FLUJO ESPERADO:
1. Cajero presiona "Cupón"
2. Ingresa código: NAVIDAD10
3. Sistema valida:
   - Código existe y está activo
   - Orden cumple mínimo (S/ 50)
   - Cliente no lo usó hoy
4. Sistema aplica 10%
5. Código se marca como usado

ESTADO: ❌ NO IMPLEMENTADO
```

### Tipo 4: 2x1 / Combos

```
SITUACIÓN:
Promoción: 2x1 en gaseosas 500ml.

FLUJO ESPERADO:
1. Cliente pide 2 gaseosas 500ml
2. Sistema detecta promoción aplicable
3. Sistema descuenta 1 gaseosa (la más barata)
4. UI muestra: "2x1 Gaseosas aplicado"

ESTADO: ❌ NO IMPLEMENTADO
```

### Tipo 5: Descuento por Línea

```
SITUACIÓN:
Pollo tiene mancha, cliente acepta con 20% de descuento.

FLUJO ESPERADO:
1. Cajero selecciona línea "1/2 Pollo"
2. Cajero presiona "Descuento en item"
3. Aplica 20% solo a ese item
4. Resto de la orden sin descuento

ESTADO: ❌ NO IMPLEMENTADO
```

---

## ESCENARIOS REALES

### ESCENARIO P1: Cliente Frecuente Pide Descuento

```
SITUACIÓN:
- Don Carlos viene todos los días
- Siempre pide lo mismo: 1/4 pollo + chicha = S/ 23
- Hoy pide "su descuentito de siempre" (10%)

FLUJO ACTUAL:
1. Cajero no puede aplicar descuento en sistema
2. Cajero hace cálculo mental: S/ 23 - 10% = S/ 20.70
3. Cajero cobra S/ 21 (redondea)
4. Registra venta por S/ 23 (precio completo)
5. Diferencia sale del bolsillo del cajero o se "pierde"

PROBLEMAS:
- Sin registro del descuento
- Sin control de quién autoriza
- Sin límite de descuentos por día
- Posible fraude (cajero dice "descuento" y se queda diferencia)

FLUJO ESPERADO:
1. Cajero aplica 10% en sistema
2. Sistema pide motivo: "Cliente frecuente"
3. Sistema registra descuento
4. Total real: S/ 20.70
5. Reporte muestra: "Descuentos del día: S/ 2.30"
```

### ESCENARIO P2: Happy Hour Automático

```
SITUACIÓN:
- Viernes 7:30 PM
- Promoción activa: 20% en bebidas de 6-9 PM
- Cliente pide: Pollo S/ 32 + 2 Cervezas S/ 8 c/u = S/ 48

FLUJO ESPERADO:
1. Cajero agrega items normalmente
2. Sistema detecta Happy Hour activo
3. Sistema calcula:
   - Pollo: S/ 32 (sin descuento)
   - Cervezas: S/ 16 - 20% = S/ 12.80
   - Total: S/ 44.80
4. UI muestra badge "🍺 Happy Hour -S/ 3.20"
5. Cliente ve el descuento antes de pagar

ESTADO: ❌ NO IMPLEMENTADO

COMPLEJIDAD:
- Evaluación en tiempo real
- Múltiples promociones pueden aplicar
- Stacking rules
```

### ESCENARIO P3: Código de Descuento con Límites

```
SITUACIÓN:
- Campaña: "VERANO2026" = 15% (máx S/ 20)
- Límite: 500 usos totales, 1 por cliente/día
- Cliente quiere usar en orden de S/ 200

FLUJO ESPERADO:
1. Cajero ingresa código "VERANO2026"
2. Sistema valida:
   ✓ Código existe
   ✓ Campaña activa (fecha)
   ✓ Quedan usos (450/500)
   ✓ Cliente no lo usó hoy
   ✓ Orden cumple mínimo
3. Sistema calcula: 15% de S/ 200 = S/ 30
4. Pero máximo es S/ 20, aplica S/ 20
5. Total: S/ 180

ESTADO: ❌ NO IMPLEMENTADO

COMPLEJIDAD:
- Tracking de usos por código
- Tracking de usos por cliente
- Límites globales y por cliente
```

### ESCENARIO P4: Descuento que Requiere Autorización

```
SITUACIÓN:
- Política: Descuentos > 20% requieren gerente
- Cajero quiere dar 30% a cliente que tuvo mala experiencia

FLUJO ESPERADO:
1. Cajero selecciona 30% de descuento
2. Sistema detecta: > 20%, requiere autorización
3. Sistema muestra: "Ingrese PIN de supervisor"
4. Gerente ingresa su PIN
5. Sistema registra:
   - Descuento: 30%
   - Autorizado por: Gerente (ID)
   - Motivo: "Compensación por mala experiencia"
6. Descuento se aplica

ESTADO: ❌ NO IMPLEMENTADO

COMPLEJIDAD:
- Sistema de PINs/autorizaciones
- Niveles de autorización
- Auditoría de quién autorizó qué
```

### ESCENARIO P5: Múltiples Descuentos (Stacking)

```
SITUACIÓN:
- Cliente tiene código "NAVIDAD10" (10%)
- Es viernes Happy Hour (20% bebidas)
- ¿Se acumulan?

POLÍTICA TÍPICA:
- Opción A: Solo el mejor descuento
- Opción B: Se acumulan hasta un máximo
- Opción C: Algunos se acumulan, otros no

FLUJO ESPERADO (Opción A):
1. Sistema evalúa ambas promociones
2. Código: 10% de S/ 100 = S/ 10
3. Happy Hour: 20% de S/ 20 (bebidas) = S/ 4
4. Sistema aplica el mayor: S/ 10
5. UI muestra: "Descuento NAVIDAD10: -S/ 10"

ESTADO: ❌ NO IMPLEMENTADO

COMPLEJIDAD:
- Reglas de stacking configurables
- Prioridades entre promociones
- UI clara de qué se aplicó
```

### ESCENARIO P6: Combo/Menú del Día

```
SITUACIÓN:
- Menú del día: 1/4 Pollo + Arroz + Refresco = S/ 15
- Precio individual: S/ 18 + S/ 5 + S/ 4 = S/ 27
- Ahorro: S/ 12

FLUJO ESPERADO:
1. Cajero selecciona "Menú del Día" del catálogo
2. Sistema agrega los 3 items como combo
3. Precio total: S/ 15 (no suma individual)
4. Si cliente quiere cambiar refresco por gaseosa (+S/ 2):
   - Sistema permite modificación
   - Nuevo total: S/ 17

ESTADO: ❌ NO IMPLEMENTADO

COMPLEJIDAD:
- Combos como productos especiales
- Modificaciones a combos
- Precio de combo vs suma de partes
```

---

## GAP ANALYSIS

### Modelo de Datos Faltante

```typescript
// Tabla: promotions
interface Promotion {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  rules: PromotionRules;  // JSON del DSL
  is_active: boolean;
  valid_from: Date;
  valid_until?: Date;
  total_uses: number;
  max_uses?: number;
  created_at: Date;
  created_by: string;
}

// Tabla: promotion_uses
interface PromotionUse {
  id: string;
  promotion_id: string;
  order_id: string;
  customer_id?: string;
  discount_cents: number;
  used_at: Date;
}

// Tabla: coupons
interface Coupon {
  code: string;
  promotion_id: string;
  is_active: boolean;
  uses: number;
  max_uses?: number;
}
```

### Eventos Faltantes

```typescript
// Ya definido pero no implementado
interface OrderDiscountAppliedPayload {
  order_id: string;
  check_id?: string;
  discount: {
    type: "PERCENT" | "FIXED" | "PROMOTION" | "COUPON";
    value: number;
    promotion_id?: string;
    coupon_code?: string;
    authorized_by?: string;
    reason?: string;
  };
  discount_cents: number;
  snapshot: PromotionSnapshot;
}

// Nuevo: Para descuentos por línea
interface LineDiscountAppliedPayload {
  order_id: string;
  line_id: string;
  discount_percent: number;
  discount_cents: number;
  reason?: string;
  authorized_by?: string;
}
```

### UI Faltante

```
BOTONES NECESARIOS EN POS:
┌─────────────────────────────────────┐
│  [DESCUENTO]  [CUPÓN]  [PROMOCIONES]│
└─────────────────────────────────────┘

MODAL DE DESCUENTO:
┌─────────────────────────────────────┐
│         APLICAR DESCUENTO           │
├─────────────────────────────────────┤
│  ○ Porcentaje: [___]%               │
│  ○ Monto fijo: S/ [___]             │
│                                     │
│  Motivo: [Cliente frecuente    ▼]   │
│                                     │
│  Subtotal: S/ 50.00                 │
│  Descuento: -S/ 5.00                │
│  TOTAL: S/ 45.00                    │
│                                     │
│  [CANCELAR]        [APLICAR]        │
└─────────────────────────────────────┘

INDICADOR DE PROMOCIÓN ACTIVA:
┌─────────────────────────────────────┐
│ 🎉 Happy Hour activo                │
│    20% en bebidas hasta las 9 PM    │
└─────────────────────────────────────┘
```

### Lógica Faltante

```typescript
// Motor de evaluación de promociones
class PromotionEngine {
  evaluate(order: Order, promotions: Promotion[]): ApplicablePromotion[] {
    const applicable: ApplicablePromotion[] = [];
    
    for (const promo of promotions) {
      if (!this.isActive(promo)) continue;
      if (!this.meetsConditions(order, promo.rules.when)) continue;
      if (!this.withinLimits(order, promo)) continue;
      
      const discount = this.calculateDiscount(order, promo);
      applicable.push({ promo, discount });
    }
    
    return this.applyStackingRules(applicable);
  }
  
  private meetsConditions(order: Order, when: WhenClause): boolean {
    // Evaluar all/any/none
  }
  
  private calculateDiscount(order: Order, promo: Promotion): number {
    // Según tipo: PERCENT, FIXED, BUY_X_GET_Y, etc.
  }
  
  private applyStackingRules(promos: ApplicablePromotion[]): ApplicablePromotion[] {
    // Ordenar por prioridad, aplicar reglas de stacking
  }
}
```

---

## PLAN DE IMPLEMENTACIÓN

### Fase 1: Descuento Manual Básico (P0)

```
Tiempo: 8 horas

1. UI: Botón "Descuento" en CheckDetail
2. Modal: Porcentaje o monto fijo
3. Evento: ORDER_DISCOUNT_APPLIED
4. Reducer: Actualizar discount_cents
5. Validación: Límite 50% sin autorización
```

### Fase 2: Autorización de Descuentos (P0)

```
Tiempo: 4 horas

1. Configuración de límites por rol
2. Modal de PIN para autorización
3. Registro de quién autorizó
4. Auditoría en eventos
```

### Fase 3: Promociones Automáticas (P1)

```
Tiempo: 16 horas

1. Tabla de promociones en DB
2. Motor de evaluación (PromotionEngine)
3. Evaluación al agregar items
4. UI de promociones aplicadas
5. Snapshots inmutables
```

### Fase 4: Cupones (P1)

```
Tiempo: 8 horas

1. Tabla de cupones
2. UI para ingresar código
3. Validación de límites
4. Tracking de usos
```

### Fase 5: Combos (P2)

```
Tiempo: 12 horas

1. Productos tipo "combo" en catálogo
2. Lógica de precio de combo
3. Modificaciones a combos
4. UI de selección de combo
```

---

## PRIORIDADES

| # | Feature | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|----------|-----------|
| 1 | Descuento manual % | Alto | 4h | 🔴 P0 |
| 2 | Descuento monto fijo | Alto | 2h | 🔴 P0 |
| 3 | Autorización por PIN | Alto | 4h | 🔴 P0 |
| 4 | Límites configurables | Medio | 4h | 🟡 P1 |
| 5 | Promociones automáticas | Alto | 16h | 🟡 P1 |
| 6 | Cupones | Medio | 8h | 🟡 P1 |
| 7 | Descuento por línea | Bajo | 4h | 🟢 P2 |
| 8 | Combos | Medio | 12h | 🟢 P2 |

---

**Documento creado:** Enero 2026
