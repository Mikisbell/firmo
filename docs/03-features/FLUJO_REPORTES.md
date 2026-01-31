# 📊 FLUJO DE REPORTES Y CIERRE DE DÍA — Diseño

> **Documento:** Diseño del sistema de reportes (no existe actualmente)  
> **Fecha:** Enero 2026  
> **Estado:** Diseño desde cero

---

## 📋 ÍNDICE

1. [Contexto del Negocio](#contexto-del-negocio)
2. [Reportes Necesarios](#reportes-necesarios)
3. [Escenarios Reales](#escenarios-reales)
4. [Diseño Propuesto](#diseño-propuesto)
5. [Implementación](#implementación)

---

## CONTEXTO DEL NEGOCIO

### ¿Qué necesita ver el dueño de una pollería?

```
DIARIO (al cerrar):
- ¿Cuánto vendí hoy?
- ¿Cuánto hay en caja?
- ¿Cuántos pollos vendí?
- ¿Hubo descuadres?

SEMANAL:
- ¿Qué día vendí más?
- ¿Qué productos se venden más?
- ¿Cómo van las promociones?

MENSUAL:
- Comparativo con mes anterior
- Productos más/menos rentables
- Análisis de horarios pico
```

### Usuarios de Reportes

| Rol | Necesita Ver | Frecuencia |
|-----|--------------|------------|
| Cajero | Resumen de su turno | Al cerrar turno |
| Administrador | Ventas del día, descuadres | Diario |
| Dueño | Todo, comparativos | Semanal/Mensual |
| Contador | Facturas, impuestos | Mensual |

---

## REPORTES NECESARIOS

### 1. Reporte de Cierre de Turno

```
┌─────────────────────────────────────────────────────────────┐
│              CIERRE DE TURNO - CAJA 1                       │
│              05/01/2026 - Turno Tarde                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CAJERO: María García                                       │
│  INICIO: 17:00    FIN: 23:15                                │
│  DURACIÓN: 6h 15m                                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  VENTAS                                                     │
│  ─────────────────────────────────────────────────────────  │
│  Órdenes completadas:              45                       │
│  Órdenes canceladas:                2                       │
│  Ticket promedio:              S/ 52.30                     │
│                                                             │
│  Ventas brutas:              S/ 2,353.50                    │
│  Descuentos:                   - S/ 45.00                   │
│  Devoluciones:                 - S/ 32.00                   │
│  ─────────────────────────────────────────────────────────  │
│  VENTAS NETAS:               S/ 2,276.50                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  MÉTODOS DE PAGO                                            │
│  ─────────────────────────────────────────────────────────  │
│  Efectivo:                   S/ 1,250.00  (55%)             │
│  Yape:                         S/ 580.00  (25%)             │
│  Plin:                         S/ 230.00  (10%)             │
│  Tarjeta:                      S/ 216.50  (10%)             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ARQUEO DE CAJA                                             │
│  ─────────────────────────────────────────────────────────  │
│  Fondo inicial:                S/ 200.00                    │
│  + Ventas efectivo:          S/ 1,250.00                    │
│  - Cambios dados:              S/ 185.00                    │
│  + Ingresos:                    S/ 50.00  (cambio de banco) │
│  - Salidas:                     S/ 30.00  (compra hielo)    │
│  ─────────────────────────────────────────────────────────  │
│  ESPERADO EN CAJA:           S/ 1,285.00                    │
│  CONTADO:                    S/ 1,280.00                    │
│  ─────────────────────────────────────────────────────────  │
│  DIFERENCIA:                     - S/ 5.00  ⚠️              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  DOCUMENTOS EMITIDOS                                        │
│  ─────────────────────────────────────────────────────────  │
│  Boletas:                          42                       │
│  Facturas:                          3                       │
│  Notas de crédito:                  1                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Reporte de Ventas del Día

```
┌─────────────────────────────────────────────────────────────┐
│              VENTAS DEL DÍA - 05/01/2026                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RESUMEN GENERAL                                            │
│  ─────────────────────────────────────────────────────────  │
│  Total órdenes:                    98                       │
│  Ventas netas:               S/ 4,850.00                    │
│  Ticket promedio:              S/ 49.49                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  POR TURNO                                                  │
│  ─────────────────────────────────────────────────────────  │
│  Mañana (María):    53 órdenes    S/ 2,573.50               │
│  Tarde (Pedro):     45 órdenes    S/ 2,276.50               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  POR HORA                                                   │
│  ─────────────────────────────────────────────────────────  │
│  11:00 ████░░░░░░░░░░░░░░░░  S/ 320                         │
│  12:00 ████████████░░░░░░░░  S/ 680  ← Pico almuerzo        │
│  13:00 ██████████████░░░░░░  S/ 820  ← Pico almuerzo        │
│  14:00 ████████░░░░░░░░░░░░  S/ 450                         │
│  ...                                                        │
│  19:00 ██████████████████░░  S/ 920  ← Pico cena            │
│  20:00 ████████████████░░░░  S/ 780                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  TOP 5 PRODUCTOS                                            │
│  ─────────────────────────────────────────────────────────  │
│  1. 1/2 Pollo c/papas      45 uds    S/ 1,440.00            │
│  2. 1/4 Pollo c/papas      38 uds      S/ 684.00            │
│  3. Gaseosa 1.5L           52 uds      S/ 416.00            │
│  4. Pollo entero           12 uds      S/ 696.00            │
│  5. Chicha morada          35 uds      S/ 175.00            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  MÉTODOS DE PAGO                                            │
│  ─────────────────────────────────────────────────────────  │
│  Efectivo    ████████████████░░░░  S/ 2,650  (55%)          │
│  Yape        ████████░░░░░░░░░░░░  S/ 1,200  (25%)          │
│  Plin        ████░░░░░░░░░░░░░░░░    S/ 500  (10%)          │
│  Tarjeta     ████░░░░░░░░░░░░░░░░    S/ 500  (10%)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Reporte de Productos

```
┌─────────────────────────────────────────────────────────────┐
│              ANÁLISIS DE PRODUCTOS - Enero 2026             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MÁS VENDIDOS (por cantidad)                                │
│  ─────────────────────────────────────────────────────────  │
│  Producto              Cantidad    Ingresos    % del Total  │
│  ─────────────────────────────────────────────────────────  │
│  1/2 Pollo c/papas        1,250    S/ 40,000      28%       │
│  Gaseosa 1.5L             1,100     S/ 8,800       6%       │
│  1/4 Pollo c/papas          980    S/ 17,640      12%       │
│  Chicha morada              850     S/ 4,250       3%       │
│  Pollo entero               320    S/ 18,560      13%       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  MÁS RENTABLES (por ingresos)                               │
│  ─────────────────────────────────────────────────────────  │
│  1. 1/2 Pollo c/papas              S/ 40,000                │
│  2. Pollo entero                   S/ 18,560                │
│  3. 1/4 Pollo c/papas              S/ 17,640                │
│  4. Gaseosa 1.5L                    S/ 8,800                │
│  5. Ensalada                        S/ 5,400                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  MENOS VENDIDOS (revisar)                                   │
│  ─────────────────────────────────────────────────────────  │
│  ⚠️ Ensalada César           12 uds    S/ 144               │
│  ⚠️ Jugo de maracuyá         18 uds    S/ 108               │
│  ⚠️ Porción extra ají         8 uds     S/ 16               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Reporte de Descuadres

```
┌─────────────────────────────────────────────────────────────┐
│              REPORTE DE DESCUADRES - Enero 2026             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RESUMEN                                                    │
│  ─────────────────────────────────────────────────────────  │
│  Total turnos:                     62                       │
│  Turnos con descuadre:             15  (24%)                │
│  Descuadre total:              - S/ 85.00                   │
│  Descuadre promedio:             - S/ 5.67                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  POR CAJERO                                                 │
│  ─────────────────────────────────────────────────────────  │
│  Cajero          Turnos    Descuadres    Total              │
│  ─────────────────────────────────────────────────────────  │
│  María García       31          5       - S/ 25.00          │
│  Pedro López        31         10       - S/ 60.00  ⚠️      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  DETALLE DE DESCUADRES                                      │
│  ─────────────────────────────────────────────────────────  │
│  Fecha       Cajero    Esperado    Contado    Diferencia    │
│  ─────────────────────────────────────────────────────────  │
│  05/01 PM    Pedro     S/ 1,285    S/ 1,280    - S/ 5.00    │
│  04/01 AM    María     S/ 1,450    S/ 1,448    - S/ 2.00    │
│  03/01 PM    Pedro     S/ 1,320    S/ 1,305    - S/ 15.00   │
│  ...                                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5. Reporte Fiscal (SUNAT)

```
┌─────────────────────────────────────────────────────────────┐
│              REPORTE FISCAL - Enero 2026                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DOCUMENTOS EMITIDOS                                        │
│  ─────────────────────────────────────────────────────────  │
│  Tipo              Cantidad    Base Imponible    IGV        │
│  ─────────────────────────────────────────────────────────  │
│  Boletas             2,850      S/ 102,500    S/ 18,450     │
│  Facturas              120       S/ 15,800     S/ 2,844     │
│  ─────────────────────────────────────────────────────────  │
│  TOTAL               2,970      S/ 118,300    S/ 21,294     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  NOTAS DE CRÉDITO                                           │
│  ─────────────────────────────────────────────────────────  │
│  NC Boletas              8        S/ 320        S/ 58       │
│  NC Facturas             2        S/ 180        S/ 32       │
│  ─────────────────────────────────────────────────────────  │
│  TOTAL NC               10        S/ 500        S/ 90       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  RESUMEN TRIBUTARIO                                         │
│  ─────────────────────────────────────────────────────────  │
│  Ventas brutas:                          S/ 118,300         │
│  (-) Notas de crédito:                     - S/ 500         │
│  ─────────────────────────────────────────────────────────  │
│  Base imponible neta:                    S/ 117,800         │
│  IGV a pagar (18%):                       S/ 21,204         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ESCENARIOS REALES

### ESCENARIO R1: Cierre de Día Normal

```
SITUACIÓN:
- Son las 11:30 PM
- Último cliente se fue
- Dueño quiere saber cómo le fue hoy

FLUJO ESPERADO:
1. Cajero cierra su turno (arqueo)
2. Sistema genera reporte de turno
3. Administrador accede a "Cierre del Día"
4. Sistema muestra:
   - Resumen de ambos turnos
   - Ventas totales
   - Comparativo con ayer/semana pasada
   - Alertas (descuadres, devoluciones)
5. Administrador puede exportar a PDF/Excel
6. Sistema envía resumen por WhatsApp/Email al dueño

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO R2: Dueño Revisa desde Casa

```
SITUACIÓN:
- Dueño está en casa
- Quiere ver cómo va el negocio
- Son las 8 PM (hora pico)

FLUJO ESPERADO:
1. Dueño abre app/web en su celular
2. Ve dashboard en tiempo real:
   - Ventas del día hasta ahora
   - Órdenes en cocina
   - Comparativo con mismo día semana pasada
3. Puede ver detalle de cualquier métrica
4. Recibe notificación si hay problema

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO R3: Contador Necesita Datos

```
SITUACIÓN:
- Fin de mes
- Contador necesita:
  - Todas las facturas emitidas
  - Notas de crédito
  - Resumen de IGV

FLUJO ESPERADO:
1. Contador accede con su usuario
2. Selecciona "Reportes Fiscales"
3. Filtra por mes: Enero 2026
4. Sistema genera:
   - Lista de facturas con detalle
   - Lista de NC
   - Resumen de IGV
5. Exporta a Excel para su sistema contable

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO R4: Análisis de Producto Nuevo

```
SITUACIÓN:
- Hace 2 semanas agregaron "Pollo Broaster"
- Dueño quiere saber si está funcionando

FLUJO ESPERADO:
1. Dueño accede a "Análisis de Productos"
2. Filtra por "Pollo Broaster"
3. Ve:
   - Ventas por día desde lanzamiento
   - Comparativo con otros productos similares
   - Horarios de mayor venta
   - Ticket promedio cuando se incluye
4. Decide si mantener, promocionar o quitar

ESTADO ACTUAL: ❌ NO EXISTE
```

---

## DISEÑO PROPUESTO

### Arquitectura de Reportes

```
┌─────────────────────────────────────────────────────────────┐
│                      FUENTES DE DATOS                       │
├─────────────────────────────────────────────────────────────┤
│  Events (PostgreSQL)  │  Orders  │  Shifts  │  Invoices    │
└───────────┬───────────┴────┬─────┴────┬─────┴──────┬───────┘
            │                │          │            │
            ▼                ▼          ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE AGREGACIÓN                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Daily Stats │  │ Shift Stats │  │Product Stats│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API DE REPORTES                        │
│  GET /api/reports/daily?date=2026-01-05                     │
│  GET /api/reports/shift/:shiftId                            │
│  GET /api/reports/products?from=...&to=...                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         UI                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Dashboard  │  │  Reportes   │  │   Export    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Modelo de Datos para Agregaciones

```typescript
// Tabla: daily_stats (se calcula al cerrar día)
interface DailyStats {
  id: string;
  tenant_id: string;
  date: string;  // YYYY-MM-DD
  
  // Ventas
  orders_count: number;
  orders_cancelled: number;
  gross_sales_cents: number;
  discounts_cents: number;
  refunds_cents: number;
  net_sales_cents: number;
  avg_ticket_cents: number;
  
  // Por método de pago
  cash_cents: number;
  card_cents: number;
  yape_cents: number;
  plin_cents: number;
  
  // Caja
  cash_expected_cents: number;
  cash_counted_cents: number;
  variance_cents: number;
  
  // Documentos
  boletas_count: number;
  facturas_count: number;
  nc_count: number;
  
  // Metadata
  shifts_count: number;
  calculated_at: Date;
}

// Tabla: product_stats (se actualiza en tiempo real o batch)
interface ProductStats {
  id: string;
  tenant_id: string;
  product_id: string;
  date: string;
  
  qty_sold: number;
  revenue_cents: number;
  avg_price_cents: number;
  
  // Por hora (array de 24)
  hourly_qty: number[];
}
```

### APIs de Reportes

```typescript
// GET /api/reports/daily
interface DailyReportResponse {
  date: string;
  summary: {
    orders: number;
    net_sales_cents: number;
    avg_ticket_cents: number;
  };
  by_shift: ShiftSummary[];
  by_hour: HourlySales[];
  by_payment_method: PaymentMethodBreakdown;
  top_products: ProductSales[];
  cash_summary: CashSummary;
}

// GET /api/reports/shift/:id
interface ShiftReportResponse {
  shift: ShiftDetails;
  sales: SalesSummary;
  payments: PaymentBreakdown;
  cash: CashReconciliation;
  documents: DocumentsSummary;
  movements: CashMovement[];
}

// GET /api/reports/products
interface ProductsReportResponse {
  period: { from: string; to: string };
  products: ProductAnalysis[];
  categories: CategoryAnalysis[];
  trends: TrendData[];
}
```

---

## IMPLEMENTACIÓN

### Fase 1: Reporte de Cierre de Turno (P0)

```
Tiempo: 8 horas

Ya existe ShiftModal para cerrar turno.
Agregar:
1. Pantalla de resumen post-cierre
2. Cálculo de métricas del turno
3. Opción de imprimir resumen
```

### Fase 2: Dashboard Básico (P0)

```
Tiempo: 12 horas

1. Página /admin/dashboard
2. Ventas del día en tiempo real
3. Gráfico de ventas por hora
4. Top 5 productos
5. Estado de caja
```

### Fase 3: Reportes Históricos (P1)

```
Tiempo: 16 horas

1. Página /admin/reports
2. Filtros por fecha/rango
3. Reporte de ventas
4. Reporte de productos
5. Export a PDF/Excel
```

### Fase 4: Reportes Fiscales (P1)

```
Tiempo: 8 horas

1. Lista de documentos emitidos
2. Filtros por tipo/fecha
3. Resumen de IGV
4. Export para contador
```

### Fase 5: Dashboard Móvil (P2)

```
Tiempo: 12 horas

1. Vista responsive
2. Notificaciones push
3. Acceso desde cualquier lugar
```

---

## PRIORIDADES

| # | Feature | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|----------|-----------|
| 1 | Resumen cierre turno | Alto | 8h | 🔴 P0 |
| 2 | Dashboard ventas día | Alto | 12h | 🔴 P0 |
| 3 | Reporte de productos | Medio | 8h | 🟡 P1 |
| 4 | Reportes históricos | Medio | 16h | 🟡 P1 |
| 5 | Reportes fiscales | Alto | 8h | 🟡 P1 |
| 6 | Export PDF/Excel | Medio | 6h | 🟡 P1 |
| 7 | Dashboard móvil | Bajo | 12h | 🟢 P2 |
| 8 | Alertas automáticas | Bajo | 8h | 🟢 P2 |

---

**Documento creado:** Enero 2026
