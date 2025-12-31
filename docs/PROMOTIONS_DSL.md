# PARK POS — Promotions Rules DSL

**Versión:** 1.0  
**Fecha:** Diciembre 2025

---

## 1) Concepto: 2 Fases

| Fase | Ubicación | Propósito |
|------|-----------|-----------|
| **Pre-evaluación** | Terminal/offline | UX - mostrar "promo aplicable" |
| **Validación final** | Server (caja) | Re-evalúa + calcula descuento + snapshot |

---

## 2) Estructura Canónica

```json
{
  "version": 1,
  "when": {
    "all": [],
    "any": [],
    "none": []
  },
  "scope": "ORDER",
  "apply": {
    "type": "PERCENT",
    "value": 10,
    "max_discount_cents": 2000,
    "rounding": "NEAREST_10"
  },
  "limits": {
    "per_order": 1,
    "per_customer_per_day": 1,
    "total_redemptions": null
  },
  "requires": {
    "coupon": false,
    "membership": null
  },
  "stacking": {
    "stackable": false,
    "priority": 100
  }
}
```

---

## 3) Sintaxis de Condiciones

### Formato
```json
{ "field": "order.subtotal_cents", "op": ">=", "value": 5000 }
```

### Operadores
| Op | Uso |
|----|-----|
| `=`, `!=` | Igualdad |
| `>`, `>=`, `<`, `<=` | Comparación |
| `in`, `not_in` | Conjuntos |
| `contains`, `starts_with` | Strings |
| `between` | Rangos |
| `exists`, `not_exists` | Existencia |

### Campos Permitidos

#### Order
- `order.order_type`
- `order.subtotal_cents`
- `order.total_items_qty`
- `order.category_qty.<CATEGORY>`
- `order.has_product.<SKU>`
- `order.delivery_fee_cents`

#### Time
- `time.local_hour` (0-23)
- `time.local_day_of_week` (MON-SUN)
- `time.local_date`

#### Customer
- `customer.is_known`
- `customer.recency_days`
- `customer.lifetime_value_cents`
- `customer.is_birthday`

#### Coupon
- `coupon.code`
- `coupon.status`

---

## 4) Scope

| Scope | Descripción |
|-------|-------------|
| `ORDER` | Descuento al total |
| `ITEMS` | Descuento a items específicos |

### Items Target
```json
"target": {
  "by": "CATEGORY",
  "value": "BEBIDAS"
}
```

Targets: `CATEGORY`, `SKU`, `STATION`, `TAG`, `CHEAPEST_ITEM`

---

## 5) Tipos de Aplicación

| Tipo | Uso |
|------|-----|
| `PERCENT` | Porcentaje |
| `FIXED` | Monto fijo cents |
| `PRICE_OVERRIDE` | Precio fijo |
| `BUY_X_GET_Y` | 2x1, 3x2 |
| `FREE_ITEM` | Regala item |
| `DELIVERY_FEE_DISCOUNT` | Descuento delivery |

---

## 6) Ejemplos Reales

### 6.1 Happy Hour 20% Bebidas (Viernes 18-21)
```json
{
  "version": 1,
  "when": {
    "all": [
      {"field":"time.local_day_of_week","op":"in","value":["FRI"]},
      {"field":"time.local_hour","op":"between","value":[18,21]}
    ]
  },
  "scope": "ITEMS",
  "apply": {
    "type": "PERCENT",
    "value": 20,
    "target": {"by":"CATEGORY","value":"BEBIDAS"},
    "max_discount_cents": 3000
  },
  "limits": {"per_order": 1},
  "requires": {"coupon": false},
  "stacking": {"stackable": false, "priority": 100}
}
```

### 6.2 Código NAVIDAD10: 10% con Mínimo S/50
```json
{
  "version": 1,
  "when": {
    "all": [
      {"field":"order.subtotal_cents","op":">=","value":5000}
    ]
  },
  "scope": "ORDER",
  "apply": {
    "type": "PERCENT",
    "value": 10,
    "max_discount_cents": 2000
  },
  "limits": {"per_order": 1, "per_customer_per_day": 1, "total_redemptions": 1000},
  "requires": {"coupon": true},
  "stacking": {"stackable": false, "priority": 90}
}
```

### 6.3 2x1 en Gaseosa 500ml
```json
{
  "version": 1,
  "when": {
    "all": [
      {"field":"order.has_product.gaseosa_500","op":"=","value":true},
      {"field":"order.product_qty.gaseosa_500","op":">=","value":2}
    ]
  },
  "scope": "ITEMS",
  "apply": {
    "type": "BUY_X_GET_Y",
    "buy_qty": 1,
    "get_qty": 1,
    "target": {"by":"SKU","value":"gaseosa_500"},
    "discount_mode": "CHEAPEST_FREE"
  },
  "limits": {"per_order": 10},
  "stacking": {"stackable": false, "priority": 80}
}
```

### 6.4 Delivery Gratis desde S/40
```json
{
  "version": 1,
  "when": {
    "all": [
      {"field":"order.order_type","op":"=","value":"DELIVERY"},
      {"field":"order.subtotal_cents","op":">=","value":4000}
    ]
  },
  "scope": "ORDER",
  "apply": {
    "type": "DELIVERY_FEE_DISCOUNT",
    "value": 100
  },
  "limits": {"per_order": 1},
  "stacking": {"stackable": true, "priority": 70}
}
```

### 6.5 Cumpleaños 15%
```json
{
  "version": 1,
  "when": {
    "all": [
      {"field":"customer.is_known","op":"=","value":true},
      {"field":"customer.is_birthday","op":"=","value":true}
    ]
  },
  "scope": "ORDER",
  "apply": {
    "type": "PERCENT",
    "value": 15,
    "max_discount_cents": 3000
  },
  "limits": {"per_order": 1, "per_customer_per_day": 1},
  "stacking": {"stackable": false, "priority": 60}
}
```

---

## 7) Validación Server-Side

### Inputs
```typescript
interface ValidationInput {
  order_snapshot: OrderSnapshot;
  customer_id?: string;
  coupon_code?: string;
  now: Date;
  rules: PromotionRules;
}
```

### Precomputaciones (O(n) items)
```typescript
const ctx = {
  order: {
    subtotal_cents: sum(items.map(i => i.qty * i.unit_price_cents)),
    total_items_qty: sum(items.map(i => i.qty)),
    product_qty: groupBy(items, 'sku').mapValues(sum('qty')),
    has_product: Object.keys(product_qty).reduce((acc, sku) => ({...acc, [sku]: true}), {}),
    category_qty: groupBy(items, 'category').mapValues(sum('qty'))
  }
};
```

### Output
```typescript
interface ValidationResult {
  is_applicable: boolean;
  discount_cents: number;
  applied_lines?: LineRef[];
  promotion_snapshot: PromotionSnapshot;
  reason?: string;
}
```

---

## 8) Snapshot Inmutable

```json
{
  "promotion_id": "uuid",
  "name": "Happy Hour Bebidas",
  "type": "ITEMS:PERCENT",
  "value": 20,
  "rules_version": 1,
  "applied_discount_cents": 500,
  "applied_to": {"scope":"CATEGORY","value":"BEBIDAS"},
  "evaluated_at": "ISO",
  "evaluated_by": "emp_uuid",
  "source": "CASHIER_FINAL"
}
```

---

## 9) Stacking

| stackable | Comportamiento |
|-----------|---------------|
| `false` | Solo 1 promo (mayor priority) |
| `true` | Combinar con límite max_discount_cents |

---

## 10) Split Bill

- Promo se calcula a nivel pedido
- Se reparte a checks proporcional al subtotal
- Sobrante al último check

---

**Fin del Documento v1.0**
