# FASE 3 - Visualizaciones y Gráficos 📊

**Fecha:** 22 Enero 2026  
**Status:** Planning  
**Prioridad:** Alta

---

## 🎯 Objetivo

Agregar visualizaciones avanzadas, gráficos históricos, heatmaps y exportación de reportes a la página de gestión de Estaciones KDS.

---

## 📊 1. Gráficos de Tendencia

### 1.1 Gráfico de Línea - Tiempo Promedio

**Propósito:** Mostrar evolución del tiempo de preparación promedio

**Datos:** Últimos 7, 30 o 90 días

**Ejemplo Visual:**
```
┌─────────────────────────────────────────────────────────┐
│  Tiempo Promedio de Preparación - Últimos 7 Días       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 15min ┤                                        ●         │
│       │                                    ╱            │
│ 12min ┤                    ●           ●╱               │
│       │                ╱   │       ╱                    │
│  9min ┤            ●╱       │   ●╱                      │
│       │        ╱            │╱                          │
│  6min ┤    ●╱               ●                           │
│       │╱                                                │
│  3min ●                                                 │
│       │                                                 │
│       └─────────────────────────────────────────────────│
│        Lun  Mar  Mié  Jue  Vie  Sáb  Dom               │
│                                                          │
│  ● Parrilla  ● Cocina  ● Bar                           │
└─────────────────────────────────────────────────────────┘
```

**Características:**
- Múltiples líneas (una por estación)
- Color coding: Verde (< 8min), Amarillo (8-12min), Rojo (> 12min)
- Tooltips al hover con valor exacto
- Zoom y pan para explorar datos
- Leyenda interactiva (click para ocultar/mostrar línea)

**Código Recharts:**
```tsx
<LineChart data={trendData} width={800} height={400}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis label={{ value: 'Minutos', angle: -90 }} />
  <Tooltip />
  <Legend />
  <Line 
    type="monotone" 
    dataKey="avgTime" 
    stroke="#10b981" 
    strokeWidth={2}
    dot={{ r: 4 }}
  />
</LineChart>
```

---

### 1.2 Gráfico de Barras - Órdenes por Hora

**Propósito:** Mostrar distribución de órdenes completadas por hora

**Datos:** Día actual o cualquier día histórico

**Ejemplo Visual:**
```
┌─────────────────────────────────────────────────────────┐
│  Órdenes Completadas por Hora - Hoy                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 25 ┤                                                     │
│    │                                                     │
│ 20 ┤        ██                  ██                      │
│    │        ██          ██      ██                      │
│ 15 ┤        ██          ██      ██      ██              │
│    │        ██    ██    ██      ██      ██              │
│ 10 ┤  ██    ██    ██    ██      ██      ██      ██      │
│    │  ██    ██    ██    ██      ██      ██      ██      │
│  5 ┤  ██    ██    ██    ██      ██      ██      ██      │
│    │  ██    ██    ██    ██      ██      ██      ██      │
│  0 ┴──────────────────────────────────────────────────  │
│     11  12  13  14  15  16  17  18  19  20  21  22     │
│                        Hora del día                      │
│                                                          │
│  Peak: 18:00 (22 órdenes)  |  Total: 156 órdenes       │
└─────────────────────────────────────────────────────────┘
```

**Características:**
- Barras con gradiente de color
- Resalta hora pico con color diferente
- Muestra total de órdenes en footer
- Click en barra para ver detalle de esa hora

---

### 1.3 Gráfico de Área - Eficiencia Acumulada

**Propósito:** Mostrar tendencia de eficiencia a lo largo del tiempo

**Datos:** Últimos 30 días

**Ejemplo Visual:**
```
┌─────────────────────────────────────────────────────────┐
│  Eficiencia de Estación - Últimos 30 Días              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│100% ┤                                        ╱▓▓▓▓▓▓▓▓▓  │
│     │                                    ╱▓▓▓           │
│ 90% ┤                                ╱▓▓▓                │
│     │                            ╱▓▓▓                    │
│ 80% ┤                        ╱▓▓▓                        │
│     │                    ╱▓▓▓                            │
│ 70% ┤                ╱▓▓▓                                │
│     │            ╱▓▓▓                                    │
│ 60% ┤        ╱▓▓▓                                        │
│     │    ╱▓▓▓                                            │
│ 50% ┤╱▓▓▓                                                │
│     └─────────────────────────────────────────────────  │
│      Sem1  Sem2  Sem3  Sem4                             │
│                                                          │
│  Promedio: 87%  |  Mejor: 95%  |  Peor: 68%            │
└─────────────────────────────────────────────────────────┘
```

**Características:**
- Área rellena con gradiente
- Línea de promedio (línea punteada)
- Zonas de color (verde > 85%, amarillo 70-85%, rojo < 70%)
- Anotaciones en puntos importantes

---

## 🔥 2. Heatmap de Actividad

### 2.1 Vista Semanal por Hora

**Propósito:** Identificar patrones de actividad por día y hora

**Datos:** Últimos 7 días, agregado por hora

**Ejemplo Visual:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Mapa de Calor - Actividad por Día y Hora                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│        00 02 04 06 08 10 12 14 16 18 20 22                          │
│        ─────────────────────────────────────────                     │
│ Lun │  ░░ ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ██ ██ ▓▓ ▒▒                         │
│ Mar │  ░░ ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ██ ██ ▓▓ ▒▒                         │
│ Mié │  ░░ ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ██ ██ ▓▓ ▒▒                         │
│ Jue │  ░░ ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ██ ██ ▓▓ ▒▒                         │
│ Vie │  ░░ ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ██ ██ ██ ▓▓                         │
│ Sáb │  ░░ ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ██ ██ ██ ▓▓                         │
│ Dom │  ░░ ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ██ ██ ▓▓ ▒▒                         │
│                                                                       │
│  Escala de Intensidad:                                               │
│  ░░ 0-5 órdenes  ▒▒ 6-10  ▓▓ 11-15  ██ 16+ órdenes                 │
│                                                                       │
│  Hora Pico: Viernes 19:00 (28 órdenes)                              │
│  Hora Baja: Lunes 04:00 (0 órdenes)                                 │
└──────────────────────────────────────────────────────────────────────┘
```

**Características:**
- Celda clickeable para ver detalle
- Tooltip muestra: Día, Hora, # Órdenes, Tiempo Promedio
- Selector de estación (ver todas o una específica)
- Selector de métrica (órdenes, tiempo promedio, eficiencia)
- Exportar como imagen PNG

**Código React:**
```tsx
<div className="grid grid-cols-24 gap-1">
  {heatmapData.map((cell) => (
    <div
      key={`${cell.day}-${cell.hour}`}
      className={`h-8 rounded ${getColorClass(cell.intensity)}`}
      onClick={() => showDetail(cell)}
      title={`${cell.day} ${cell.hour}:00 - ${cell.orderCount} órdenes`}
    />
  ))}
</div>
```

---

### 2.2 Tooltip Detallado

**Al hacer hover sobre una celda:**
```
┌─────────────────────────────┐
│  Viernes 19:00              │
├─────────────────────────────┤
│  📦 Órdenes: 28             │
│  ⏱️  Tiempo Promedio: 8 min │
│  ✅ Eficiencia: 92%         │
│  🔥 Carga: 85%              │
│                             │
│  [Ver Detalle →]            │
└─────────────────────────────┘
```

---

## 📈 3. Vista de Comparación

### 3.1 Comparación Multi-Estación

**Propósito:** Comparar rendimiento entre 2-5 estaciones

**Ejemplo Visual:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Comparación de Estaciones - Últimos 7 Días                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Métrica          │ 🔥 Parrilla │ 🍳 Cocina │ 🍺 Bar  │ ❄️ Fríos   │
│  ─────────────────┼─────────────┼───────────┼─────────┼────────────│
│  Órdenes Activas  │     12 🔴   │     8 🟡  │   5 🟢  │    3 🟢    │
│  Tiempo Promedio  │   11min 🟡  │   9min 🟢 │ 7min 🟢 │  5min 🟢   │
│  Eficiencia       │     78% 🟡  │    89% 🟢 │  92% 🟢 │   95% 🟢   │
│  Carga            │     80% 🟡  │    53% 🟢 │  33% 🟢 │   20% 🟢   │
│  Total Órdenes    │     156     │    142    │   98    │    67      │
│                                                                       │
│  🏆 Mejor Rendimiento: Fríos (95% eficiencia)                       │
│  ⚠️  Requiere Atención: Parrilla (carga alta, eficiencia baja)      │
└──────────────────────────────────────────────────────────────────────┘
```

**Características:**
- Tabla comparativa con indicadores visuales
- Gráfico de radar para comparación visual
- Resalta mejor y peor performer
- Exportar comparación como PDF

---

### 3.2 Gráfico de Radar

**Comparación visual de múltiples métricas:**
```
┌─────────────────────────────────────┐
│     Comparación Multi-Dimensional   │
│                                      │
│           Eficiencia                 │
│               ╱ ╲                    │
│              ╱   ╲                   │
│   Velocidad ●─────● Calidad          │
│            ╱ ╲   ╱ ╲                 │
│           ╱   ╲ ╱   ╲                │
│          ●─────●─────●               │
│       Carga    │   Órdenes           │
│                                      │
│  ─── Parrilla  ─── Cocina           │
└─────────────────────────────────────┘
```

---

## 📄 4. Exportación de Reportes

### 4.1 Reporte PDF

**Estructura del PDF:**

```
┌─────────────────────────────────────────────────────────┐
│                    PÁGINA 1                              │
│  ╔═══════════════════════════════════════════════════╗  │
│  ║  PARK POS - Reporte de Estaciones KDS            ║  │
│  ║  Fecha: 22 Enero 2026                            ║  │
│  ║  Período: 15-22 Enero 2026                       ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│                                                          │
│  RESUMEN EJECUTIVO                                       │
│  ─────────────────────────────────────────────────────  │
│  • Total de Estaciones: 5                               │
│  • Estaciones Activas: 5                                │
│  • Total de Órdenes: 1,247                              │
│  • Tiempo Promedio Global: 8.5 minutos                  │
│  • Eficiencia Global: 87%                               │
│                                                          │
│  INDICADORES CLAVE                                       │
│  ─────────────────────────────────────────────────────  │
│  ✅ Mejor Estación: Fríos (95% eficiencia)              │
│  ⚠️  Requiere Atención: Parrilla (78% eficiencia)       │
│  📈 Tendencia: Mejorando (+3% vs semana anterior)       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    PÁGINA 2                              │
│  GRÁFICOS DE TENDENCIA                                   │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  [Gráfico de Línea - Tiempo Promedio]                   │
│                                                          │
│  [Gráfico de Barras - Órdenes por Hora]                 │
│                                                          │
│  [Gráfico de Área - Eficiencia]                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    PÁGINA 3                              │
│  MAPA DE CALOR                                           │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  [Heatmap de Actividad Semanal]                         │
│                                                          │
│  ANÁLISIS:                                               │
│  • Horas pico: 12:00-14:00 y 19:00-21:00               │
│  • Días más ocupados: Viernes y Sábado                  │
│  • Recomendación: Reforzar personal en horas pico       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    PÁGINA 4                              │
│  DETALLE POR ESTACIÓN                                    │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  🔥 PARRILLA                                             │
│  • Órdenes: 312 (25% del total)                         │
│  • Tiempo Promedio: 11 min                              │
│  • Eficiencia: 78%                                       │
│  • Alertas: 12 (8 altas, 4 medias)                      │
│                                                          │
│  🍳 COCINA                                               │
│  • Órdenes: 289 (23% del total)                         │
│  • Tiempo Promedio: 9 min                               │
│  • Eficiencia: 89%                                       │
│  • Alertas: 3 (0 altas, 3 medias)                       │
│                                                          │
│  [... más estaciones ...]                               │
└─────────────────────────────────────────────────────────┘
```

**Botón de Exportación:**
```tsx
<button 
  onClick={exportToPDF}
  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600"
>
  <FileText className="w-4 h-4" />
  Exportar PDF
</button>
```

---

### 4.2 Reporte Excel

**Estructura del Excel:**

```
┌─────────────────────────────────────────────────────────┐
│  HOJA 1: Resumen                                         │
├─────────────────────────────────────────────────────────┤
│  A              B              C              D          │
│  Estación       Órdenes        Tiempo Prom.  Eficiencia │
│  ─────────────────────────────────────────────────────  │
│  Parrilla       312            11 min        78%        │
│  Cocina         289            9 min         89%        │
│  Bar            198            7 min         92%        │
│  Fríos          156            5 min         95%        │
│  Postres        292            6 min         91%        │
│  ─────────────────────────────────────────────────────  │
│  TOTAL          1,247          8.5 min       87%        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  HOJA 2: Métricas por Hora                               │
├─────────────────────────────────────────────────────────┤
│  Fecha          Hora  Estación  Órdenes  Tiempo  Efic.  │
│  ─────────────────────────────────────────────────────  │
│  2026-01-22     12    Parrilla  18       10      85%    │
│  2026-01-22     12    Cocina    15       9       88%    │
│  2026-01-22     13    Parrilla  22       11      82%    │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  HOJA 3: Alertas                                         │
├─────────────────────────────────────────────────────────┤
│  Fecha/Hora         Estación  Severidad  Mensaje        │
│  ─────────────────────────────────────────────────────  │
│  2026-01-22 14:30   Parrilla  Alta       Tiempo > 15min│
│  2026-01-22 19:45   Bar       Media      12 órdenes     │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  HOJA 4: Órdenes Detalladas                             │
├─────────────────────────────────────────────────────────┤
│  ID      Mesa  Estación  Items  Tiempo  Estado          │
│  ─────────────────────────────────────────────────────  │
│  ord-1   15    Parrilla  3      12min   READY           │
│  ord-2   8     Cocina    2      8min    READY           │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

**Botón de Exportación:**
```tsx
<button 
  onClick={exportToExcel}
  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600"
>
  <FileSpreadsheet className="w-4 h-4" />
  Exportar Excel
</button>
```

---

## 🎨 5. Paleta de Colores

### 5.1 Colores de Rendimiento

```css
/* Excelente (> 90%) */
--performance-excellent: #10b981;  /* Green 500 */

/* Bueno (80-90%) */
--performance-good: #84cc16;       /* Lime 500 */

/* Aceptable (70-80%) */
--performance-ok: #eab308;         /* Yellow 500 */

/* Bajo (60-70%) */
--performance-low: #f97316;        /* Orange 500 */

/* Crítico (< 60%) */
--performance-critical: #ef4444;   /* Red 500 */
```

### 5.2 Colores de Heatmap

```css
/* Intensidad Baja (0-20%) */
--heatmap-low: rgba(16, 185, 129, 0.2);

/* Intensidad Media-Baja (21-40%) */
--heatmap-medium-low: rgba(132, 204, 22, 0.4);

/* Intensidad Media (41-60%) */
--heatmap-medium: rgba(234, 179, 8, 0.6);

/* Intensidad Media-Alta (61-80%) */
--heatmap-medium-high: rgba(249, 115, 22, 0.8);

/* Intensidad Alta (81-100%) */
--heatmap-high: rgba(239, 68, 68, 1.0);
```

---

## 🔧 6. Librerías Necesarias

### 6.1 Instalación

```bash
# Charts
npm install recharts
npm install --save-dev @types/recharts

# PDF Export
npm install jspdf html2canvas
npm install --save-dev @types/jspdf

# Excel Export
npm install exceljs
npm install --save-dev @types/exceljs

# Date Handling
npm install date-fns

# Icons (si no están)
npm install lucide-react
```

### 6.2 Imports

```typescript
// Charts
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// PDF
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Excel
import ExcelJS from 'exceljs';

// Date
import { format, subDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
```

---

## 📱 7. Responsive Design

### 7.1 Breakpoints

```css
/* Mobile: 1 columna */
@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-container {
    height: 300px;
  }
}

/* Tablet: 2 columnas */
@media (min-width: 768px) and (max-width: 1024px) {
  .charts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .chart-container {
    height: 350px;
  }
}

/* Desktop: 3 columnas */
@media (min-width: 1024px) {
  .charts-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .chart-container {
    height: 400px;
  }
}
```

---

## ✅ Checklist de Implementación

### Gráficos
- [ ] Instalar Recharts
- [ ] Crear componente TrendChart
- [ ] Implementar LineChart (tiempo promedio)
- [ ] Implementar BarChart (órdenes por hora)
- [ ] Implementar AreaChart (eficiencia)
- [ ] Agregar tooltips personalizados
- [ ] Agregar leyenda interactiva
- [ ] Hacer responsive

### Heatmap
- [ ] Crear componente ActivityHeatmap
- [ ] Implementar grid de 7x24
- [ ] Agregar escala de colores
- [ ] Implementar tooltips
- [ ] Agregar modal de detalle
- [ ] Hacer responsive

### Comparación
- [ ] Crear componente ComparisonView
- [ ] Implementar tabla comparativa
- [ ] Agregar indicadores visuales
- [ ] Implementar gráfico de radar
- [ ] Agregar selector de estaciones

### Exportación
- [ ] Instalar jsPDF y ExcelJS
- [ ] Crear servicio de exportación PDF
- [ ] Crear servicio de exportación Excel
- [ ] Implementar botones de exportación
- [ ] Agregar indicadores de progreso
- [ ] Manejar errores de exportación

---

**Implementado por:** Kiro AI  
**Fecha:** 22 Enero 2026  
**Status:** ⏳ Planning  
**Próximo paso:** Crear design.md con arquitectura detallada
