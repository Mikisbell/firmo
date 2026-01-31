# 💰 FLUJO_PROPINAS — Gestión de Tips

> Registro y distribución de propinas para 15 meseros

---

## 📋 Resumen Ejecutivo

| Aspecto | Detalle |
|---------|---------|
| **Problema** | Propinas no registradas, distribución manual genera conflictos |
| **Solución** | Registro automático + modos de distribución configurables |
| **Complejidad** | Baja-Media |
| **Prioridad** | 🟡 Media - Importante para moral del equipo |

---

## 🎯 Escenarios de Uso

### Escenario 1: Propina en Efectivo
```
DADO que el cliente deja S/10 de propina en efectivo
CUANDO el mesero cierra la mesa
ENTONCES registra propina de S/10
Y se asocia al mesero que atendió
Y aparece en su reporte diario
```

### Escenario 2: Propina con Tarjeta
```
DADO que el cliente paga S/100 con tarjeta
Y agrega S/15 de propina en el POS
CUANDO se procesa el pago
ENTONCES la propina se registra automáticamente
Y se marca como "pendiente de liquidación"
Y se paga al mesero cuando llega el depósito
```

### Escenario 3: Distribución Pool (Compartida)
```
DADO que el local usa sistema de pool
CUANDO termina el turno
ENTONCES se suman todas las propinas: S/450
Y se divide entre meseros del turno: 5
Y cada uno recibe S/90
```

### Escenario 4: Distribución por Zona
```
DADO que el local distribuye por zona
Y Zona A generó S/200 en propinas
Y Zona A tiene 2 meseros
CUANDO termina el turno
ENTONCES cada mesero de Zona A recibe S/100
```

### Escenario 5: Propina Individual
```
DADO que el local usa propinas individuales
CUANDO el mesero Carlos atiende mesa 5
Y recibe S/20 de propina
ENTONCES los S/20 son 100% para Carlos
```

### Escenario 6: Reporte de Propinas (Impuestos)
```
DADO que el contador necesita declarar propinas
CUANDO genera reporte mensual
ENTONCES ve propinas por empleado
Y puede exportar para planilla
```

---

## 📊 Modelo de Datos

### Tabla: Tip
```typescript
interface Tip {
  id: string;
  tenant_id: string;
  location_id: string;
  
  order_id: string;
  shift_id: string;
  
  amount: number;                // centavos
  payment_method: 'CASH' | 'CARD' | 'TRANSFER';
  
  // Asignación
  waiter_id: string;             // Mesero que atendió
  zone_id?: string;              // Zona (para distribución por zona)
  
  // Estado (para propinas con tarjeta)
  status: TipStatus;
  settled_at?: Date;
  
  created_at: Date;
}

type TipStatus = 
  | 'RECEIVED'           // Efectivo - disponible inmediato
  | 'PENDING_SETTLEMENT' // Tarjeta - esperando depósito
  | 'SETTLED'            // Tarjeta - ya depositado
  | 'DISTRIBUTED';       // Ya repartido (pool)
```

### Tabla: Tip_Distribution
```typescript
interface TipDistribution {
  id: string;
  tenant_id: string;
  location_id: string;
  shift_id: string;
  
  distribution_mode: DistributionMode;
  
  total_tips: number;            // centavos
  participants: number;          // Cuántos meseros
  
  distributions: Array<{
    employee_id: string;
    amount: number;              // centavos
    zone_id?: string;
  }>;
  
  distributed_by: string;
  distributed_at: Date;
}

type DistributionMode = 
  | 'INDIVIDUAL'         // Cada quien lo suyo
  | 'POOL_EQUAL'         // Dividir igual entre todos
  | 'POOL_BY_HOURS'      // Dividir por horas trabajadas
  | 'BY_ZONE';           // Dividir por zona
```

### Configuración
```typescript
interface TipConfig {
  tenant_id: string;
  location_id: string;
  
  distribution_mode: DistributionMode;
  
  // Para pool
  include_kitchen: boolean;      // ¿Cocina participa?
  kitchen_percentage: number;    // % para cocina si participa
  
  // Para tarjeta
  card_tip_fee_percentage: number; // Comisión por propina tarjeta
  
  // Mínimos
  min_tip_to_record: number;     // No registrar < S/1
}
```

---

## 📡 Eventos de Dominio

```typescript
interface TipReceivedEvent {
  type: 'TIP_RECEIVED';
  payload: {
    tip_id: string;
    order_id: string;
    waiter_id: string;
    amount: number;
    payment_method: string;
  };
}

interface TipsDistributedEvent {
  type: 'TIPS_DISTRIBUTED';
  payload: {
    shift_id: string;
    distribution_mode: DistributionMode;
    total_amount: number;
    distributions: Array<{
      employee_id: string;
      amount: number;
    }>;
  };
}
```

---

## 🖥️ UI Mockups

### Registro de Propina (en cierre de mesa)
```
┌─────────────────────────────────────────────────────────────┐
│  💳 PAGO - Mesa 5                              Total: S/85  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Subtotal:        S/ 85.00                                  │
│                                                             │
│  💰 Propina:      S/ [10.00    ]                           │
│                                                             │
│  Sugerencias:  [10%]  [15%]  [20%]  [Otro]                 │
│                 S/8.5  S/12.75 S/17                         │
│                                                             │
│  TOTAL A COBRAR: S/ 95.00                                   │
│                                                             │
│  [💵 Efectivo]  [💳 Tarjeta]  [📱 Yape/Plin]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Reporte de Propinas (Mesero)
```
┌─────────────────────────────────────────────────────────────┐
│  💰 MIS PROPINAS - Carlos M.                     [📅 Hoy]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Hoy: S/ 85.00                                              │
│  Esta semana: S/ 420.00                                     │
│  Este mes: S/ 1,850.00                                      │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Detalle de Hoy:                                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 20:15 │ Mesa 12 │ S/20.00 │ 💵 Efectivo │ ✓ Recibido  ││
│  │ 19:30 │ Mesa 8  │ S/15.00 │ 💳 Tarjeta  │ ⏳ Pendiente ││
│  │ 18:45 │ Mesa 5  │ S/25.00 │ 💵 Efectivo │ ✓ Recibido  ││
│  │ 17:20 │ Mesa 3  │ S/10.00 │ 💵 Efectivo │ ✓ Recibido  ││
│  │ 14:00 │ Mesa 15 │ S/15.00 │ 💳 Tarjeta  │ ⏳ Pendiente ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  💵 Efectivo disponible: S/ 55.00                           │
│  💳 Tarjeta pendiente: S/ 30.00                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Distribución de Pool (Admin)
```
┌─────────────────────────────────────────────────────────────┐
│  💰 DISTRIBUCIÓN DE PROPINAS - Turno Noche       [Distribuir]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Total Propinas del Turno: S/ 450.00                        │
│  Modo: Pool Igualitario                                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Empleado        │ Horas │ Propinas Ind. │ Pool │ Total  ││
│  ├─────────────────┼───────┼───────────────┼──────┼────────┤│
│  │ Carlos M.       │  8h   │    S/85       │ S/90 │ S/175  ││
│  │ María L.        │  8h   │    S/120      │ S/90 │ S/210  ││
│  │ Pedro S.        │  6h   │    S/65       │ S/90 │ S/155  ││
│  │ Ana R.          │  8h   │    S/95       │ S/90 │ S/185  ││
│  │ Luis G.         │  8h   │    S/85       │ S/90 │ S/175  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Cambiar Modo ▼]  [Ajustar Manual]  [✓ Confirmar]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Fases de Implementación

| Fase | Alcance | Duración |
|------|---------|----------|
| **1** | Modelo de datos + registro básico | 1 día |
| **2** | UI en cierre de mesa | 1 día |
| **3** | Distribución pool | 1 día |
| **4** | Reportes por empleado | 1 día |
| **5** | Configuración modos | 1 día |

**Total estimado: 5 días de desarrollo**

---

*Última actualización: Enero 2026*
