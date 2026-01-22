# 📊 Week 2 - Analytics & Charts
**Estado:** PENDIENTE  
**Prerequisito:** Week 1 ✅ COMPLETADO  
**Estimación:** 3-4 horas

## 🎯 Objetivo

Agregar visualizaciones avanzadas y análisis histórico al dashboard de estaciones KDS, permitiendo a los administradores:
- Ver tendencias de métricas en el tiempo
- Comparar performance entre estaciones
- Identificar patrones y problemas
- Exportar reportes

## 📋 Tareas Principales

### 1. Integración de Librería de Gráficos (30 min)

#### Opción A: Recharts (Recomendado)
```bash
npm install recharts
```

**Ventajas:**
- ✅ Componentes React nativos
- ✅ Responsive por defecto
- ✅ Fácil de usar
- ✅ Bien documentado
- ✅ TypeScript support

#### Opción B: Chart.js + react-chartjs-2
```bash
npm install chart.js react-chartjs-2
```

**Ventajas:**
- ✅ Más opciones de gráficos
- ✅ Muy popular
- ✅ Buena performance

### 2. Backend - Endpoints de Analytics (1 hora)

#### 2.1 GET /api/admin/stations/:id/trends
**Propósito:** Obtener tendencias históricas de una estación

**Query Params:**
- `period`: `hour` | `day` | `week` | `month`
- `metric`: `avgTime` | `load` | `efficiency` | `activeOrders`
- `from`: ISO date (opcional)
- `to`: ISO date (opcional)

**Response:**
```typescript
{
  stationId: string;
  stationName: string;
  metric: string;
  period: string;
  data: Array<{
    timestamp: string;
    value: number;
    label: string; // "10:00", "Lunes", "Semana 3", etc.
  }>;
  summary: {
    min: number;
    max: number;
    avg: number;
    trend: 'up' | 'down' | 'stable';
  };
}
```

**Implementación:**
```typescript
// src/app/api/admin/stations/[id]/trends/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { verifyAdminAuth } from '@/src/core/middleware/admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'day';
  const metric = searchParams.get('metric') || 'avgTime';
  
  // Query a vista materializada station_hourly_metrics
  // o station_daily_summary según el period
  
  // Calcular tendencias y retornar
}
```

#### 2.2 GET /api/admin/stations/compare
**Propósito:** Comparar métricas entre estaciones

**Query Params:**
- `metric`: `avgTime` | `load` | `efficiency`
- `period`: `today` | `week` | `month`

**Response:**
```typescript
{
  metric: string;
  period: string;
  stations: Array<{
    id: string;
    name: string;
    value: number;
    rank: number;
    change: number; // % change vs previous period
  }>;
}
```

#### 2.3 GET /api/admin/stations/summary
**Propósito:** Resumen ejecutivo del sistema

**Response:**
```typescript
{
  period: string;
  totalOrders: number;
  avgTime: number;
  efficiency: number;
  alerts: {
    high: number;
    medium: number;
    low: number;
  };
  topPerformers: Array<{
    stationId: string;
    stationName: string;
    metric: string;
    value: number;
  }>;
  bottlenecks: Array<{
    stationId: string;
    stationName: string;
    issue: string;
    severity: string;
  }>;
}
```

### 3. Frontend - Componentes de Gráficos (1.5 horas)

#### 3.1 TrendChart Component
**Ubicación:** `src/app/admin/estaciones/components/TrendChart.tsx`

**Props:**
```typescript
interface TrendChartProps {
  stationId: string;
  metric: 'avgTime' | 'load' | 'efficiency';
  period: 'hour' | 'day' | 'week' | 'month';
}
```

**Features:**
- Gráfico de línea con tendencia
- Selector de métrica
- Selector de período
- Indicador de tendencia (↑↓→)
- Min/Max/Avg labels

#### 3.2 ComparisonChart Component
**Ubicación:** `src/app/admin/estaciones/components/ComparisonChart.tsx`

**Props:**
```typescript
interface ComparisonChartProps {
  metric: 'avgTime' | 'load' | 'efficiency';
  period: 'today' | 'week' | 'month';
}
```

**Features:**
- Gráfico de barras horizontal
- Ranking de estaciones
- Indicador de cambio (% vs período anterior)
- Colores según performance

#### 3.3 SummaryDashboard Component
**Ubicación:** `src/app/admin/estaciones/components/SummaryDashboard.tsx`

**Features:**
- KPIs principales (total orders, avg time, efficiency)
- Top performers (mejores 3 estaciones)
- Bottlenecks (estaciones con problemas)
- Distribución de alertas (pie chart)

### 4. Hooks Personalizados (30 min)

#### 4.1 useStationTrends
```typescript
// src/app/admin/estaciones/hooks/useStationTrends.ts
import useSWR from 'swr';

export function useStationTrends(
  stationId: string,
  metric: string,
  period: string
) {
  const { data, error, isLoading } = useSWR(
    `/api/admin/stations/${stationId}/trends?metric=${metric}&period=${period}`,
    fetcher,
    { refreshInterval: 60000 } // 1 min
  );

  return {
    trends: data,
    isLoading,
    error,
  };
}
```

#### 4.2 useStationComparison
```typescript
// src/app/admin/estaciones/hooks/useStationComparison.ts
import useSWR from 'swr';

export function useStationComparison(
  metric: string,
  period: string
) {
  const { data, error, isLoading } = useSWR(
    `/api/admin/stations/compare?metric=${metric}&period=${period}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    comparison: data,
    isLoading,
    error,
  };
}
```

### 5. UI/UX Improvements (30 min)

#### 5.1 Tabs Navigation
Agregar tabs para navegar entre vistas:
- **Overview** (vista actual)
- **Trends** (gráficos de tendencias)
- **Comparison** (comparación entre estaciones)
- **Reports** (exportación de reportes)

#### 5.2 Date Range Picker
Agregar selector de rango de fechas:
```typescript
import { DateRangePicker } from '@/components/ui/DateRangePicker';

<DateRangePicker
  from={startDate}
  to={endDate}
  onChange={(range) => {
    setStartDate(range.from);
    setEndDate(range.to);
  }}
/>
```

#### 5.3 Export Buttons
Agregar botones de exportación:
- **Export PDF** - Reporte completo en PDF
- **Export Excel** - Datos en formato Excel
- **Share Link** - Link compartible con filtros

### 6. Optimizaciones (30 min)

#### 6.1 Cache Strategy
```typescript
// Cache de 5 minutos para trends
await cache.set(
  `station:${stationId}:trends:${metric}:${period}`,
  data,
  300 // 5 min
);
```

#### 6.2 Materialized Views Refresh
```sql
-- Refresh automático cada hora
CREATE OR REPLACE FUNCTION refresh_station_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY station_hourly_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY station_daily_summary;
END;
$$ LANGUAGE plpgsql;

-- Cron job (pg_cron)
SELECT cron.schedule(
  'refresh-station-metrics',
  '0 * * * *', -- cada hora
  'SELECT refresh_station_metrics();'
);
```

## 📊 Estructura de Archivos

```
src/app/admin/estaciones/
├── page.tsx                          # Página principal con tabs
├── components/
│   ├── GlobalStatsCard.tsx          # (existente)
│   ├── StationCard.tsx              # (existente)
│   ├── TrendChart.tsx               # NUEVO
│   ├── ComparisonChart.tsx          # NUEVO
│   ├── SummaryDashboard.tsx         # NUEVO
│   └── ExportButtons.tsx            # NUEVO
├── hooks/
│   ├── useStationMetrics.ts         # (existente)
│   ├── useStationOrders.ts          # (existente)
│   ├── useStationAlerts.ts          # (existente)
│   ├── useStationTrends.ts          # NUEVO
│   └── useStationComparison.ts      # NUEVO
└── utils/
    ├── chartHelpers.ts              # NUEVO
    └── exportHelpers.ts             # NUEVO

src/app/api/admin/stations/
├── [id]/
│   ├── metrics/route.ts             # (existente)
│   ├── orders/route.ts              # (existente)
│   └── trends/route.ts              # NUEVO
├── alerts/route.ts                  # (existente)
├── compare/route.ts                 # NUEVO
└── summary/route.ts                 # NUEVO
```

## 🎨 Diseño Visual

### Color Palette para Gráficos
```typescript
const CHART_COLORS = {
  avgTime: '#3b82f6',    // blue-500
  load: '#f59e0b',       // amber-500
  efficiency: '#10b981', // emerald-500
  alerts: {
    high: '#ef4444',     // red-500
    medium: '#f59e0b',   // amber-500
    low: '#3b82f6',      // blue-500
  },
};
```

### Responsive Breakpoints
```typescript
// Mobile: 1 columna
// Tablet: 2 columnas
// Desktop: 3 columnas
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

## 🧪 Testing

### Unit Tests
```typescript
// src/app/admin/estaciones/components/__tests__/TrendChart.test.tsx
describe('TrendChart', () => {
  it('renders trend data correctly', () => {});
  it('handles period changes', () => {});
  it('shows loading state', () => {});
  it('handles errors gracefully', () => {});
});
```

### Integration Tests
```typescript
// e2e/admin-estaciones-analytics.spec.ts
test('should display trend charts', async ({ page }) => {
  await page.goto('/admin/estaciones');
  await page.click('text=Trends');
  await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible();
});
```

## 📝 Checklist de Implementación

### Backend
- [ ] Endpoint GET /api/admin/stations/:id/trends
- [ ] Endpoint GET /api/admin/stations/compare
- [ ] Endpoint GET /api/admin/stations/summary
- [ ] Cache strategy implementada
- [ ] Queries optimizadas con índices
- [ ] Tests unitarios (3 endpoints)

### Frontend
- [ ] TrendChart component
- [ ] ComparisonChart component
- [ ] SummaryDashboard component
- [ ] ExportButtons component
- [ ] Tabs navigation
- [ ] Date range picker
- [ ] useStationTrends hook
- [ ] useStationComparison hook
- [ ] Responsive design
- [ ] Loading states
- [ ] Error handling

### Testing
- [ ] Unit tests (6 componentes)
- [ ] Integration tests (3 flujos)
- [ ] E2E tests (2 escenarios)
- [ ] Performance tests

### Documentation
- [ ] README actualizado
- [ ] API documentation
- [ ] Component documentation
- [ ] User guide

## 🚀 Comandos Útiles

```bash
# Instalar dependencias
npm install recharts

# Ejecutar dev server
npm run dev

# Ejecutar tests
npm test

# Ejecutar E2E tests
npm run test:e2e

# Build para producción
npm run build

# Verificar tipos TypeScript
npx tsc --noEmit
```

## 📚 Referencias

### Recharts Documentation
- https://recharts.org/en-US/
- https://recharts.org/en-US/examples

### Chart.js Documentation
- https://www.chartjs.org/docs/latest/
- https://react-chartjs-2.js.org/

### SWR Documentation
- https://swr.vercel.app/
- https://swr.vercel.app/docs/options

## 🎯 Criterios de Éxito

### Funcionalidad
- ✅ Gráficos de tendencias funcionando
- ✅ Comparación entre estaciones
- ✅ Resumen ejecutivo
- ✅ Exportación de reportes
- ✅ Filtros por fecha

### Performance
- ✅ Carga inicial < 2 segundos
- ✅ Actualización de gráficos < 500ms
- ✅ Cache funcionando correctamente
- ✅ Responsive en mobile

### Calidad
- ✅ 0 errores TypeScript
- ✅ 100% tests pasando
- ✅ Código documentado
- ✅ UI/UX intuitiva

---

**Prerequisito:** Week 1 ✅ COMPLETADO  
**Próximo paso:** Implementar Week 2 - Analytics & Charts  
**Estimación:** 3-4 horas de trabajo
