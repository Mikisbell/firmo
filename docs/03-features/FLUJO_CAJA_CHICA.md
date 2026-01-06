# 💵 FLUJO_CAJA_CHICA — Gestión de Gastos Menores

> Control de efectivo para gastos operativos diarios

---

## 📋 Resumen Ejecutivo

| Aspecto | Detalle |
|---------|---------|
| **Problema** | Gastos menores no registrados descuadran la caja |
| **Solución** | Registro de retiros/depósitos con aprobación |
| **Complejidad** | Baja |
| **Prioridad** | 🟡 Media - Necesario para cuadre de caja |

---

## 🎯 Escenarios de Uso

### Escenario 1: Retiro para Compra de Emergencia
```
DADO que se acabó el gas y hay que comprar uno
CUANDO el cajero registra retiro de S/45.00
ENTONCES ingresa motivo "Compra gas - emergencia"
Y adjunta foto del recibo
Y el saldo de caja chica disminuye
Y aparece en el cierre de turno
```

### Escenario 2: Retiro que Requiere Aprobación
```
DADO que el límite sin aprobación es S/50.00
CUANDO el cajero intenta retirar S/80.00
ENTONCES el sistema solicita PIN de supervisor
Y el supervisor aprueba con su PIN
Y se registra quién aprobó
```

### Escenario 3: Depósito de Fondo
```
DADO que el admin repone el fondo de caja chica
CUANDO deposita S/200.00
ENTONCES el saldo aumenta
Y se registra el origen (caja principal, banco, etc.)
```

### Escenario 4: Cierre con Caja Chica
```
DADO que es fin de turno
CUANDO el cajero hace cierre
ENTONCES ve:
  - Fondo inicial: S/200.00
  - Retiros del día: S/85.00
  - Depósitos: S/0.00
  - Saldo esperado: S/115.00
  - Saldo contado: [___]
Y debe cuadrar o explicar diferencia
```

### Escenario 5: Reporte de Gastos
```
DADO que el admin quiere ver gastos del mes
CUANDO genera reporte de caja chica
ENTONCES ve todos los retiros agrupados por categoría:
  - Compras emergencia: S/450
  - Transporte: S/120
  - Limpieza: S/80
  - Otros: S/50
```

---

## 📊 Modelo de Datos

### Tabla: Petty_Cash_Transaction
```typescript
interface PettyCashTransaction {
  id: string;
  tenant_id: string;
  location_id: string;
  shift_id: string;              // Turno donde ocurrió
  
  type: 'WITHDRAWAL' | 'DEPOSIT';
  amount: number;                // centavos (siempre positivo)
  
  category: ExpenseCategory;
  description: string;
  
  // Aprobación
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: Date;
  
  // Evidencia
  receipt_photo_url?: string;
  receipt_number?: string;
  supplier_name?: string;
  
  // Auditoría
  created_by: string;
  created_at: Date;
}

type ExpenseCategory = 
  | 'COMPRA_EMERGENCIA'    // Insumos urgentes
  | 'TRANSPORTE'           // Taxi, delivery
  | 'LIMPIEZA'             // Artículos limpieza
  | 'MANTENIMIENTO'        // Reparaciones menores
  | 'PROPINA_DELIVERY'     // Tips a repartidores
  | 'OTROS';
```

### Tabla: Petty_Cash_Balance
```typescript
interface PettyCashBalance {
  id: string;
  tenant_id: string;
  location_id: string;
  
  current_balance: number;       // centavos
  max_balance: number;           // Límite máximo
  min_balance: number;           // Alerta cuando baja de aquí
  
  approval_threshold: number;    // Monto que requiere aprobación
  
  last_reconciled_at: Date;
  last_reconciled_by: string;
  
  updated_at: Date;
}
```

---

## 📡 Eventos de Dominio

```typescript
interface PettyCashWithdrawalEvent {
  type: 'PETTY_CASH_WITHDRAWAL';
  payload: {
    transaction_id: string;
    amount: number;
    category: ExpenseCategory;
    description: string;
    approved_by?: string;
    new_balance: number;
  };
}

interface PettyCashDepositEvent {
  type: 'PETTY_CASH_DEPOSIT';
  payload: {
    transaction_id: string;
    amount: number;
    source: string;              // "CAJA_PRINCIPAL" | "BANCO"
    new_balance: number;
  };
}

interface PettyCashReconciledEvent {
  type: 'PETTY_CASH_RECONCILED';
  payload: {
    expected_balance: number;
    actual_balance: number;
    variance: number;
    variance_reason?: string;
  };
}
```

---

## 🖥️ UI Mockups

### Panel de Caja Chica
```
┌─────────────────────────────────────────────────────────────┐
│  💵 CAJA CHICA                                    [📊 Rep.] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Saldo Actual: S/ 115.00                                    │
│  ████████████████░░░░░░░░░░ 57% del fondo                   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Movimientos de Hoy:                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 14:30 │ 🔴 -S/45.00 │ Gas emergencia    │ Juan C.      ││
│  │ 12:15 │ 🔴 -S/25.00 │ Taxi proveedor    │ María L.     ││
│  │ 10:00 │ 🔴 -S/15.00 │ Bolsas basura     │ Juan C.      ││
│  │ 08:00 │ 🟢 +S/200   │ Fondo inicial     │ Admin        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [➖ Retiro]  [➕ Depósito]  [📋 Reconciliar]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Formulario de Retiro
```
┌─────────────────────────────────────────────────────────────┐
│  ➖ RETIRO DE CAJA CHICA                             [✕]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Monto: S/ [45.00        ]                                  │
│                                                             │
│  Categoría: [Compra Emergencia        ▼]                    │
│                                                             │
│  Descripción: [Balón de gas - se acabó a las 2PM    ]      │
│                                                             │
│  Proveedor: [Distribuidora Gas SAC    ]                     │
│                                                             │
│  N° Recibo: [001-00234               ]                      │
│                                                             │
│  📷 [Adjuntar foto del recibo]                              │
│     recibo_gas.jpg ✓                                        │
│                                                             │
│  ⚠️ Saldo después del retiro: S/ 70.00                      │
│                                                             │
│  [Cancelar]                              [✓ Registrar]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Fases de Implementación

| Fase | Alcance | Duración |
|------|---------|----------|
| **1** | Modelo de datos + eventos | 1 día |
| **2** | UI retiro/depósito | 1 día |
| **3** | Aprobación con PIN | 1 día |
| **4** | Integración con cierre | 1 día |
| **5** | Reportes | 1 día |

**Total estimado: 5 días de desarrollo**

---

*Última actualización: Enero 2026*
