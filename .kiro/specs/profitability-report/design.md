# Design Document - Reporte de Rentabilidad

## Overview

El módulo de Reporte de Rentabilidad proporciona análisis financiero completo para PARK POS mediante el cálculo automático de COGS (Cost of Goods Sold) desde recetas, análisis de ganancias y márgenes, y visualización de métricas financieras clave.

### Objetivos Principales

1. **Cálculo Automático de COGS**: Calcular el costo de producción desde recetas usando costos de ingredientes del inventario
2. **Análisis de Rentabilidad**: Calcular ganancia (Precio - COGS) y margen ((Ganancia/Precio) × 100) por producto
3. **Visualización de Datos**: Dashboard interactivo con tablas, gráficos y filtros
4. **Performance**: Respuestas < 200ms para 1000+ productos con caché inteligente
5. **Seguridad Financiera**: Branded types y validación estricta para prevenir errores

### Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard UI (Next.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Tabla        │  │ Gráfico      │  │ Filtros      │      │
│  │ Productos    │  │ Márgenes     │  │ Fecha/Cat    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓ SWR (auto-revalidate)
┌─────────────────────────────────────────────────────────────┐
│                    REST APIs (Next.js)                       │
│  /api/admin/reports/profitability                           │
│  /api/admin/reports/profit-by-product/:id                   │
│  /api/admin/reports/margin-analysis                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Profitability Service (TypeScript)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ COGS         │  │ Profit       │  │ Margin       │      │
│  │ Calculator   │  │ Calculator   │  │ Calculator   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ↓                       ↓
┌──────────────────────────┐  ┌──────────────────────────┐
│   Redis Cache (5 min)    │  │   PostgreSQL (Prisma)    │
│   - COGS por producto    │  │   - products             │
│   - Métricas agregadas   │  │   - recipes              │
└──────────────────────────┘  │   - inventory            │
                               │   - orders/order_items   │
                               └──────────────────────────┘
```

## Architecture

### Capas del Sistema

#### 1. Presentation Layer (UI)

**Dashboard de Rentabilidad** (`src/app/admin/reports/profitability/page.tsx`)
- Tabla de productos con métricas financieras
- Gráficos de márgenes por categoría (Chart.js)
- Gráfico de evolución temporal de ganancia
- Filtros por fecha y categoría
- Exportación a CSV

**Optimizaciones:**
- Code splitting: Dashboard cargado dinámicamente
- Lazy loading: Gráficos cargados solo cuando son visibles
- Memoización: Cálculos de agregación cacheados con useMemo
- SWR: Auto-revalidación cada 30 segundos

#### 2. API Layer (REST Endpoints)

**GET /api/admin/reports/profitability**
- Reporte completo de rentabilidad
- Filtros: startDate, endDate, categoryIds
- Retorna: lista de productos con métricas

**GET /api/admin/reports/profit-by-product/:id**
- Análisis detallado de un producto
- Incluye: precio, COGS, ganancia, margen, ventas del período
- Incluye: desglose de receta si existe

**GET /api/admin/reports/margin-analysis**
- Análisis de márgenes por categoría
- Retorna: categorías ordenadas por ganancia total
- Incluye: margen promedio, ventas totales

**Validación:**
- Zod schemas para todos los parámetros
- Validación de rangos de fechas
- Validación de IDs de productos/categorías

#### 3. Service Layer (Business Logic)

**ProfitabilityService** (`src/core/services/profitability.service.ts`)

```typescript
class ProfitabilityService {
  // Calcular COGS desde receta
  async calculateCOGS(productId: string): Promise<Centavos>
  
  // Calcular ganancia
  calculateProfit(price: Centavos, cogs: Centavos): Profit
  
  // Calcular margen
  calculateMargin(profit: Profit, price: Centavos): Margin
  
  // Obtener reporte completo
  async getProfitabilityReport(filters: ReportFilters): Promise<ProfitabilityReport>
  
  // Obtener análisis por producto
  async getProductAnalysis(productId: string, period: DateRange): Promise<ProductAnalysis>
  
  // Obtener análisis de márgenes
  async getMarginAnalysis(filters: ReportFilters): Promise<MarginAnalysis>
}
```

**COGSCalculator** (`src/core/services/cogs-calculator.ts`)

```typescript
class COGSCalculator {
  // Calcular COGS desde receta
  async calculateFromRecipe(recipeId: string): Promise<Centavos>
  
  // Obtener costo promedio ponderado de ingrediente
  async getWeightedAverageCost(ingredientId: string): Promise<Centavos>
  
  // Invalidar caché cuando cambia costo
  async invalidateCacheForIngredient(ingredientId: string): Promise<void>
}
```

#### 4. Data Layer (Prisma)

**Tablas Existentes Usadas:**
- `products`: price_cents, category_id
- `recipes`: product_id, ingredients (JSON)
- `inventory`: cost_cents, quantity
- `orders`: created_at, tenant_id
- `order_items`: product_id, quantity, price_cents

**Nueva Tabla: cogs_cache**

```prisma
model COGSCache {
  id           String   @id @default(cuid())
  product_id   String
  cogs_cents   Int
  calculated_at DateTime @default(now())
  expires_at   DateTime
  tenant_id    String
  
  product      Product  @relation(fields: [product_id], references: [id])
  
  @@index([product_id, tenant_id])
  @@index([expires_at])
}
```

#### 5. Cache Layer (Redis)

**Estrategia de Caché:**
- Key pattern: `cogs:{tenant_id}:{product_id}`
- TTL: 5 minutos
- Invalidación: Cuando cambia costo de ingrediente o receta

**Métricas Cacheadas:**
- COGS por producto
- Agregaciones por categoría (TTL 2 minutos)
- Reportes completos (TTL 1 minuto)

## Components and Interfaces

### Branded Types (Type Safety)

```typescript
// src/core/types/profitability.ts

// Branded type para COGS
export type COGS = Centavos & { readonly __brand: 'COGS' };

// Branded type para Profit
export type Profit = Centavos & { readonly __brand: 'Profit' };

// Branded type para Margin (porcentaje)
export type Margin = number & { readonly __brand: 'Margin' };

// Helper functions
export function toCOGS(cents: number): COGS {
  if (cents < 0) throw new Error('COGS no puede ser negativo');
  if (!Number.isInteger(cents)) throw new Error('COGS debe ser integer');
  return cents as COGS;
}

export function toProfit(cents: number): Profit {
  if (!Number.isInteger(cents)) throw new Error('Profit debe ser integer');
  return cents as Profit;
}

export function toMargin(percentage: number): Margin {
  if (percentage < -100 || percentage > 100) {
    throw new Error('Margin debe estar en rango [-100, 100]');
  }
  return percentage as Margin;
}

// Cálculos seguros
export function calculateProfit(price: Centavos, cogs: COGS): Profit {
  return toProfit(price - cogs);
}

export function calculateMargin(profit: Profit, price: Centavos): Margin {
  if (price === 0) return toMargin(0);
  return toMargin((profit / price) * 100);
}
```

### Service Interfaces

```typescript
// src/core/services/profitability.service.ts

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  productIds?: string[];
  categoryIds?: string[];
  tenantId: string;
}

export interface ProductMetrics {
  productId: string;
  productName: string;
  category: string;
  priceCents: Centavos;
  cogsCents: COGS;
  profitCents: Profit;
  marginPercent: Margin;
  unitsSold: number;
  totalRevenueCents: Centavos;
  totalProfitCents: Profit;
}

export interface ProfitabilityReport {
  products: ProductMetrics[];
  summary: {
    totalRevenueCents: Centavos;
    totalCogsCents: COGS;
    totalProfitCents: Profit;
    averageMargin: Margin;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface ProductAnalysis extends ProductMetrics {
  recipe?: {
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: string;
      costCents: Centavos;
    }>;
    totalCogsCents: COGS;
  };
  salesByDay: Array<{
    date: Date;
    unitsSold: number;
    revenueCents: Centavos;
    profitCents: Profit;
  }>;
}

export interface CategoryMetrics {
  categoryId: string;
  categoryName: string;
  productCount: number;
  totalRevenueCents: Centavos;
  totalCogsCents: COGS;
  totalProfitCents: Profit;
  averageMargin: Margin;
}

export interface MarginAnalysis {
  categories: CategoryMetrics[];
  summary: {
    totalRevenueCents: Centavos;
    totalProfitCents: Profit;
    overallMargin: Margin;
  };
}
```

### API Request/Response Types

```typescript
// src/app/api/admin/reports/profitability/route.ts

export const ProfitabilityQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  productIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
});

export type ProfitabilityQuery = z.infer<typeof ProfitabilityQuerySchema>;

export interface ProfitabilityResponse {
  success: true;
  data: ProfitabilityReport;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

## Data Models

### Cálculo de COGS

**Algoritmo de Cálculo:**

```typescript
async function calculateCOGS(productId: string): Promise<COGS> {
  // 1. Obtener receta del producto
  const recipe = await prisma.recipe.findUnique({
    where: { product_id: productId },
    include: { ingredients: true }
  });
  
  if (!recipe) {
    return toCOGS(0); // Sin receta = COGS 0
  }
  
  // 2. Calcular costo de cada ingrediente
  let totalCogsCents = 0;
  
  for (const ingredient of recipe.ingredients) {
    // Obtener costo promedio ponderado
    const avgCost = await getWeightedAverageCost(ingredient.inventory_item_id);
    
    // Costo = cantidad × costo_unitario
    const ingredientCost = ingredient.quantity * avgCost;
    totalCogsCents += ingredientCost;
  }
  
  return toCOGS(Math.round(totalCogsCents));
}

async function getWeightedAverageCost(itemId: string): Promise<number> {
  // Obtener todas las compras del item
  const purchases = await prisma.inventoryTransaction.findMany({
    where: {
      inventory_item_id: itemId,
      type: 'PURCHASE'
    },
    orderBy: { created_at: 'desc' },
    take: 10 // Últimas 10 compras
  });
  
  if (purchases.length === 0) return 0;
  
  // Calcular promedio ponderado
  let totalCost = 0;
  let totalQuantity = 0;
  
  for (const purchase of purchases) {
    totalCost += purchase.cost_cents * purchase.quantity;
    totalQuantity += purchase.quantity;
  }
  
  return totalQuantity > 0 ? totalCost / totalQuantity : 0;
}
```

### Cálculo de Ganancia y Margen

**Fórmulas:**

```typescript
// Ganancia = Precio - COGS
function calculateProfit(price: Centavos, cogs: COGS): Profit {
  return toProfit(price - cogs);
}

// Margen = (Ganancia / Precio) × 100
function calculateMargin(profit: Profit, price: Centavos): Margin {
  if (price === 0) return toMargin(0);
  
  const marginPercent = (profit / price) * 100;
  
  // Redondear a 2 decimales
  return toMargin(Math.round(marginPercent * 100) / 100);
}
```

**Ejemplo de Cálculo:**

```
Producto: Pollo a la Brasa Entero
Precio: S/ 35.00 = 3500 centavos

Receta:
- 1.5 kg pollo × 1200 cents/kg = 1800 cents
- 0.5 kg papa × 200 cents/kg = 100 cents
- 0.1 L aceite × 1500 cents/L = 150 cents
Total COGS = 2050 centavos

Ganancia = 3500 - 2050 = 1450 centavos (S/ 14.50)
Margen = (1450 / 3500) × 100 = 41.43%
```

### Agregación por Categoría

```typescript
async function getMarginAnalysis(filters: ReportFilters): Promise<MarginAnalysis> {
  // 1. Obtener ventas del período
  const sales = await prisma.orderItem.findMany({
    where: {
      order: {
        created_at: {
          gte: filters.startDate,
          lte: filters.endDate
        },
        tenant_id: filters.tenantId
      }
    },
    include: {
      product: {
        include: { category: true }
      }
    }
  });
  
  // 2. Agrupar por categoría
  const categoryMap = new Map<string, CategoryMetrics>();
  
  for (const item of sales) {
    const categoryId = item.product.category_id;
    const categoryName = item.product.category.name;
    
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        categoryId,
        categoryName,
        productCount: 0,
        totalRevenueCents: 0,
        totalCogsCents: toCOGS(0),
        totalProfitCents: toProfit(0),
        averageMargin: toMargin(0)
      });
    }
    
    const metrics = categoryMap.get(categoryId)!;
    
    // Calcular COGS del producto
    const cogs = await calculateCOGS(item.product_id);
    const profit = calculateProfit(item.price_cents, cogs);
    
    // Agregar a totales
    metrics.totalRevenueCents += item.price_cents * item.quantity;
    metrics.totalCogsCents = toCOGS(metrics.totalCogsCents + cogs * item.quantity);
    metrics.totalProfitCents = toProfit(metrics.totalProfitCents + profit * item.quantity);
  }
  
  // 3. Calcular margen promedio por categoría
  for (const metrics of categoryMap.values()) {
    metrics.averageMargin = calculateMargin(
      metrics.totalProfitCents,
      metrics.totalRevenueCents
    );
  }
  
  // 4. Ordenar por ganancia total descendente
  const categories = Array.from(categoryMap.values())
    .sort((a, b) => b.totalProfitCents - a.totalProfitCents);
  
  return {
    categories,
    summary: {
      totalRevenueCents: categories.reduce((sum, c) => sum + c.totalRevenueCents, 0),
      totalProfitCents: toProfit(categories.reduce((sum, c) => sum + c.totalProfitCents, 0)),
      overallMargin: calculateMargin(
        toProfit(categories.reduce((sum, c) => sum + c.totalProfitCents, 0)),
        categories.reduce((sum, c) => sum + c.totalRevenueCents, 0)
      )
    }
  };
}
```

### Estrategia de Caché

**Caché de COGS:**

```typescript
async function getCachedCOGS(productId: string, tenantId: string): Promise<COGS | null> {
  const key = `cogs:${tenantId}:${productId}`;
  const cached = await redis.get(key);
  
  if (cached) {
    return toCOGS(parseInt(cached));
  }
  
  return null;
}

async function setCachedCOGS(productId: string, tenantId: string, cogs: COGS): Promise<void> {
  const key = `cogs:${tenantId}:${productId}`;
  const ttl = 5 * 60; // 5 minutos
  
  await redis.setex(key, ttl, cogs.toString());
}

async function invalidateCOGSCache(productId: string, tenantId: string): Promise<void> {
  const key = `cogs:${tenantId}:${productId}`;
  await redis.del(key);
}
```

**Invalidación Inteligente:**

```typescript
// Cuando cambia costo de ingrediente
async function onIngredientCostChanged(ingredientId: string, tenantId: string): Promise<void> {
  // 1. Encontrar todos los productos que usan este ingrediente
  const recipes = await prisma.recipe.findMany({
    where: {
      ingredients: {
        some: {
          inventory_item_id: ingredientId
        }
      }
    }
  });
  
  // 2. Invalidar caché de cada producto
  for (const recipe of recipes) {
    await invalidateCOGSCache(recipe.product_id, tenantId);
  }
  
  // 3. Emitir evento para auditoría
  await eventBus.publish({
    type: 'INGREDIENT_COST_CHANGED',
    payload: {
      ingredientId,
      affectedProducts: recipes.map(r => r.product_id),
      tenantId
    }
  });
}
```

