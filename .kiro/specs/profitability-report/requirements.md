# Requirements Document - Reporte de Rentabilidad

## Introducción

El módulo de Reporte de Rentabilidad proporciona análisis financiero completo para PARK POS, permitiendo calcular y visualizar ganancias, márgenes y COGS (Cost of Goods Sold) de productos. El sistema calcula automáticamente el COGS desde recetas, analiza rentabilidad por período y genera dashboards con métricas financieras clave.

## Glossario

- **COGS (Cost of Goods Sold)**: Costo de los bienes vendidos, calculado desde la receta del producto usando el costo de los ingredientes
- **Ganancia**: Diferencia entre el precio de venta y el COGS (Precio - COGS)
- **Margen**: Porcentaje de ganancia sobre el precio de venta ((Ganancia / Precio) × 100)
- **Receta**: Lista de ingredientes con cantidades necesarias para producir un producto
- **Ingrediente**: Insumo del inventario usado en una receta
- **Costo_Promedio_Ponderado**: Método de cálculo de costo que considera el precio promedio de múltiples compras
- **Sistema_Rentabilidad**: Módulo completo de análisis de rentabilidad
- **Dashboard_Rentabilidad**: Interfaz visual para análisis de rentabilidad
- **API_Rentabilidad**: Conjunto de endpoints REST para datos de rentabilidad
- **Centavos**: Unidad monetaria base (1/100 de la moneda, siempre integer)

## Requirements

### Requirement 1: Cálculo Automático de COGS

**User Story:** Como administrador, quiero que el sistema calcule automáticamente el COGS de cada producto desde su receta, para tener costos precisos sin cálculo manual.

#### Acceptance Criteria

1. WHEN una receta existe para un producto, THE Sistema_Rentabilidad SHALL calcular el COGS sumando el costo de todos los ingredientes
2. WHEN un ingrediente tiene múltiples compras, THE Sistema_Rentabilidad SHALL usar el costo promedio ponderado
3. WHEN el costo de un ingrediente cambia, THE Sistema_Rentabilidad SHALL recalcular el COGS de todos los productos que lo usan
4. THE Sistema_Rentabilidad SHALL almacenar el COGS en centavos (integer)
5. WHEN un producto no tiene receta, THE Sistema_Rentabilidad SHALL retornar COGS como cero

### Requirement 2: Cálculo de Ganancia y Margen

**User Story:** Como administrador, quiero ver la ganancia y margen de cada producto, para identificar cuáles son más rentables.

#### Acceptance Criteria

1. THE Sistema_Rentabilidad SHALL calcular ganancia como (Precio_Venta - COGS)
2. THE Sistema_Rentabilidad SHALL calcular margen como ((Ganancia / Precio_Venta) × 100)
3. WHEN el precio de venta es cero, THE Sistema_Rentabilidad SHALL retornar margen como cero
4. THE Sistema_Rentabilidad SHALL almacenar ganancia en centavos (integer)
5. THE Sistema_Rentabilidad SHALL almacenar margen como número decimal con 2 decimales
6. THE Sistema_Rentabilidad SHALL validar que margen esté en el rango [-100, 100]

### Requirement 3: Análisis por Producto

**User Story:** Como administrador, quiero ver el análisis de rentabilidad de un producto específico, para evaluar su desempeño financiero.

#### Acceptance Criteria

1. WHEN se solicita análisis de un producto, THE Sistema_Rentabilidad SHALL retornar precio, COGS, ganancia y margen
2. WHEN se especifica un período, THE Sistema_Rentabilidad SHALL calcular ventas totales en ese período
3. WHEN se especifica un período, THE Sistema_Rentabilidad SHALL calcular ganancia total en ese período
4. THE Sistema_Rentabilidad SHALL incluir cantidad de unidades vendidas
5. THE Sistema_Rentabilidad SHALL incluir información de la receta si existe

### Requirement 4: Análisis por Categoría

**User Story:** Como administrador, quiero ver rentabilidad agrupada por categoría, para identificar qué categorías son más rentables.

#### Acceptance Criteria

1. WHEN se solicita análisis por categoría, THE Sistema_Rentabilidad SHALL agrupar productos por su categoría
2. THE Sistema_Rentabilidad SHALL calcular ganancia total por categoría
3. THE Sistema_Rentabilidad SHALL calcular margen promedio por categoría
4. THE Sistema_Rentabilidad SHALL calcular ventas totales por categoría
5. THE Sistema_Rentabilidad SHALL ordenar categorías por ganancia total descendente

### Requirement 5: Análisis por Período

**User Story:** Como administrador, quiero analizar rentabilidad en diferentes períodos de tiempo, para identificar tendencias.

#### Acceptance Criteria

1. WHEN se especifica un rango de fechas, THE Sistema_Rentabilidad SHALL calcular métricas solo para ese período
2. THE Sistema_Rentabilidad SHALL soportar períodos: día, semana, mes, año, personalizado
3. WHEN se solicita evolución temporal, THE Sistema_Rentabilidad SHALL retornar datos agrupados por día
4. THE Sistema_Rentabilidad SHALL calcular ganancia total del período
5. THE Sistema_Rentabilidad SHALL calcular margen promedio del período

### Requirement 6: APIs REST de Rentabilidad

**User Story:** Como desarrollador, quiero APIs REST para acceder a datos de rentabilidad, para integrarlos en diferentes interfaces.

#### Acceptance Criteria

1. THE API_Rentabilidad SHALL exponer endpoint GET /api/admin/reports/profitability para reporte completo
2. THE API_Rentabilidad SHALL exponer endpoint GET /api/admin/reports/profit-by-product/:id para producto específico
3. THE API_Rentabilidad SHALL exponer endpoint GET /api/admin/reports/margin-analysis para análisis de márgenes
4. WHEN se recibe una petición, THE API_Rentabilidad SHALL validar parámetros con Zod
5. WHEN se recibe una petición inválida, THE API_Rentabilidad SHALL retornar error 400 con mensaje descriptivo
6. THE API_Rentabilidad SHALL soportar filtros: startDate, endDate, productIds, categoryIds
7. THE API_Rentabilidad SHALL responder en menos de 200ms para 1000+ productos

### Requirement 7: Dashboard de Rentabilidad

**User Story:** Como administrador, quiero un dashboard visual de rentabilidad, para analizar datos financieros fácilmente.

#### Acceptance Criteria

1. THE Dashboard_Rentabilidad SHALL mostrar tabla de productos con: nombre, ventas, precio, COGS, ganancia, margen%
2. THE Dashboard_Rentabilidad SHALL mostrar gráfico de barras de márgenes por categoría
3. THE Dashboard_Rentabilidad SHALL mostrar gráfico de línea de evolución de ganancia en el tiempo
4. THE Dashboard_Rentabilidad SHALL incluir filtros por rango de fechas
5. THE Dashboard_Rentabilidad SHALL incluir filtros por categoría
6. THE Dashboard_Rentabilidad SHALL permitir exportar datos a CSV
7. WHEN no hay datos, THE Dashboard_Rentabilidad SHALL mostrar mensaje informativo

### Requirement 8: Seguridad Financiera con Branded Types

**User Story:** Como desarrollador, quiero usar branded types para dinero, para prevenir errores de tipo en cálculos financieros.

#### Acceptance Criteria

1. THE Sistema_Rentabilidad SHALL usar tipo Centavos para todos los valores monetarios
2. THE Sistema_Rentabilidad SHALL usar tipo Profit para valores de ganancia
3. THE Sistema_Rentabilidad SHALL usar tipo Margin para valores de margen
4. THE Sistema_Rentabilidad SHALL validar que Centavos sea siempre integer
5. THE Sistema_Rentabilidad SHALL validar que Margin esté en rango [-100, 100]
6. WHEN se realiza conversión de tipos, THE Sistema_Rentabilidad SHALL usar funciones helper seguras

### Requirement 9: Caché de COGS Calculados

**User Story:** Como administrador, quiero que los COGS calculados se cacheen, para mejorar el rendimiento del sistema.

#### Acceptance Criteria

1. WHEN se calcula un COGS, THE Sistema_Rentabilidad SHALL almacenarlo en caché con TTL de 5 minutos
2. WHEN se solicita un COGS cacheado, THE Sistema_Rentabilidad SHALL retornarlo sin recalcular
3. WHEN el costo de un ingrediente cambia, THE Sistema_Rentabilidad SHALL invalidar caché de productos afectados
4. WHEN una receta cambia, THE Sistema_Rentabilidad SHALL invalidar caché del producto
5. THE Sistema_Rentabilidad SHALL usar Redis para almacenar caché

### Requirement 10: Optimizaciones de Performance

**User Story:** Como usuario, quiero que el dashboard cargue rápidamente, para analizar datos sin esperas.

#### Acceptance Criteria

1. THE Dashboard_Rentabilidad SHALL usar lazy loading para gráficos
2. THE Dashboard_Rentabilidad SHALL usar code splitting para reducir bundle inicial
3. THE Dashboard_Rentabilidad SHALL usar memoización para cálculos pesados
4. THE Dashboard_Rentabilidad SHALL usar SWR para datos con revalidación automática
5. WHEN se carga el dashboard, THE Dashboard_Rentabilidad SHALL mostrar skeleton loaders
6. THE Dashboard_Rentabilidad SHALL cargar en menos de 2 segundos en conexión 3G

### Requirement 11: Integración con Event Sourcing

**User Story:** Como auditor, quiero que todos los cambios de rentabilidad queden registrados, para tener trazabilidad completa.

#### Acceptance Criteria

1. WHEN se calcula un COGS, THE Sistema_Rentabilidad SHALL emitir evento COGS_CALCULATED
2. WHEN cambia el costo de un ingrediente, THE Sistema_Rentabilidad SHALL emitir evento INGREDIENT_COST_CHANGED
3. WHEN se genera un reporte, THE Sistema_Rentabilidad SHALL emitir evento PROFITABILITY_REPORT_GENERATED
4. THE Sistema_Rentabilidad SHALL almacenar eventos en la tabla events
5. THE Sistema_Rentabilidad SHALL incluir tenant_id en todos los eventos

### Requirement 12: Exportación de Datos

**User Story:** Como administrador, quiero exportar datos de rentabilidad a CSV/Excel, para análisis externo.

#### Acceptance Criteria

1. WHEN se solicita exportación, THE Dashboard_Rentabilidad SHALL generar archivo CSV con todos los datos visibles
2. THE Dashboard_Rentabilidad SHALL incluir encabezados descriptivos en español
3. THE Dashboard_Rentabilidad SHALL formatear valores monetarios con símbolo S/
4. THE Dashboard_Rentabilidad SHALL formatear porcentajes con símbolo %
5. WHEN la exportación es exitosa, THE Dashboard_Rentabilidad SHALL descargar el archivo automáticamente

### Requirement 13: Validación de Datos

**User Story:** Como desarrollador, quiero validación estricta de datos, para prevenir errores en cálculos financieros.

#### Acceptance Criteria

1. WHEN se recibe un precio, THE Sistema_Rentabilidad SHALL validar que sea >= 0
2. WHEN se recibe un COGS, THE Sistema_Rentabilidad SHALL validar que sea >= 0
3. WHEN se recibe una cantidad, THE Sistema_Rentabilidad SHALL validar que sea > 0
4. WHEN se recibe un margen, THE Sistema_Rentabilidad SHALL validar que esté en [-100, 100]
5. WHEN la validación falla, THE Sistema_Rentabilidad SHALL retornar error con mensaje descriptivo

### Requirement 14: Property-Based Testing

**User Story:** Como desarrollador, quiero tests basados en propiedades, para garantizar corrección matemática de cálculos.

#### Acceptance Criteria

1. THE Sistema_Rentabilidad SHALL tener property test: profit = revenue - cogs (siempre)
2. THE Sistema_Rentabilidad SHALL tener property test: margin = (profit / revenue) × 100 (siempre)
3. THE Sistema_Rentabilidad SHALL tener property test: cogs >= 0 (nunca negativo)
4. THE Sistema_Rentabilidad SHALL tener property test: si precio aumenta y COGS constante → ganancia aumenta
5. THE Sistema_Rentabilidad SHALL tener stress test: 1000+ productos simultáneos
6. THE Sistema_Rentabilidad SHALL ejecutar cada property test con mínimo 100 iteraciones

### Requirement 15: Manejo de Errores

**User Story:** Como usuario, quiero mensajes de error claros, para entender qué salió mal y cómo solucionarlo.

#### Acceptance Criteria

1. WHEN un producto no existe, THE Sistema_Rentabilidad SHALL retornar error 404 con mensaje "Producto no encontrado"
2. WHEN una receta no existe, THE Sistema_Rentabilidad SHALL retornar COGS como cero sin error
3. WHEN falla el cálculo de COGS, THE Sistema_Rentabilidad SHALL retornar error 500 con detalles del fallo
4. WHEN falla la conexión a base de datos, THE Sistema_Rentabilidad SHALL retornar error 503 con mensaje de reintento
5. THE Sistema_Rentabilidad SHALL loggear todos los errores con contexto completo
