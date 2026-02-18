# Implementation Plan: Reporte de Rentabilidad

## Overview

Este plan implementa el módulo completo de Reporte de Rentabilidad para PARK POS, incluyendo cálculo automático de COGS desde recetas, análisis de ganancias y márgenes, APIs REST, dashboard visual, y sistema completo de testing con property-based tests.

## Tasks

- [x] 1. Setup de infraestructura y tipos base
  - Crear branded types (COGS, Profit, Margin) en `src/core/types/profitability.ts`
  - Crear interfaces de servicios en `src/core/services/profitability.service.ts`
  - Crear migración Prisma para tabla `cogs_cache`
  - Configurar Redis para caché de COGS
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 2. Implementar cálculo de COGS
  - [x] 2.1 Implementar COGSCalculator
    - Crear `src/core/services/cogs-calculator.ts`
    - Implementar `calculateFromRecipe()`: Calcular COGS sumando costos de ingredientes
    - Implementar `getWeightedAverageCost()`: Calcular costo promedio ponderado
    - Implementar caché de COGS con Redis (TTL 5 min)
    - _Requirements: 1.1, 1.2, 1.4, 9.1, 9.2_
  
  - [ ]* 2.2 Write property test para COGS
    - **Property 4: COGS es Suma de Costos de Ingredientes**
    - **Validates: Requirements 1.1**
  
  - [ ]* 2.3 Write property test para costo promedio ponderado
    - **Property 5: Costo Promedio Ponderado es Correcto**
    - **Validates: Requirements 1.2**
  
  - [ ]* 2.4 Write property test para COGS nunca negativo
    - **Property 7: COGS Nunca es Negativo**
    - **Validates: Requirements 14.3**
  
  - [ ]* 2.5 Write unit tests para edge cases
    - Test: Producto sin receta retorna COGS = 0
    - Test: Ingrediente sin compras retorna costo = 0
    - _Requirements: 1.5_

- [ ] 3. Implementar cálculos de ganancia y margen
  - [x] 3.1 Implementar funciones de cálculo
    - Implementar `calculateProfit()` en `src/core/types/profitability.ts`
    - Implementar `calculateMargin()` con manejo de división por cero
    - Implementar helpers de branded types (toCOGS, toProfit, toMargin)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ]* 3.2 Write property test para fórmula de ganancia
    - **Property 1: Fórmula Fundamental de Ganancia**
    - **Validates: Requirements 2.1, 14.1**
  
  - [ ]* 3.3 Write property test para fórmula de margen
    - **Property 2: Fórmula Fundamental de Margen**
    - **Validates: Requirements 2.2, 14.2**
  
  - [ ]* 3.4 Write property test para margen con precio cero
    - **Property 3: Margen Cero Cuando Precio es Cero**
    - **Validates: Requirements 2.3**
  
  - [ ]* 3.5 Write property test metamórfica
    - **Property 8: Precio Aumenta → Ganancia Aumenta**
    - **Validates: Requirements 14.4**
  
  - [ ]* 3.6 Write property test para branded types
    - **Property 6: Branded Types Mantienen Invariantes**
    - **Validates: Requirements 1.4, 2.4, 2.6, 8.1-8.5**

- [x] 4. Checkpoint - Validar cálculos base
  - Ejecutar todos los property tests (mínimo 100 iteraciones cada uno)
  - Verificar que branded types previenen errores de tipo
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas

- [ ] 5. Implementar ProfitabilityService
  - [x] 5.1 Implementar servicio principal
    - Crear `src/core/services/profitability.service.ts`
    - Implementar `getProfitabilityReport()`: Reporte completo con filtros
    - Implementar `getProductAnalysis()`: Análisis detallado por producto
    - Implementar `getMarginAnalysis()`: Análisis por categoría
    - Integrar COGSCalculator para cálculos
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 5.2 Write property tests para agregaciones
    - **Property 9: Agregación de Ventas es Correcta**
    - **Property 10: Agregación de Ganancias es Correcta**
    - **Validates: Requirements 3.2, 3.3, 4.2, 4.4, 5.4**
  
  - [ ]* 5.3 Write property test para agrupamiento
    - **Property 11: Agrupación por Categoría Preserva Totales**
    - **Validates: Requirements 4.1, 4.2, 4.4**
  
  - [ ]* 5.4 Write property test para ordenamiento
    - **Property 12: Ordenamiento por Ganancia es Correcto**
    - **Validates: Requirements 4.5**
  
  - [ ]* 5.5 Write property test para filtrado por período
    - **Property 13: Filtrado por Período es Correcto**
    - **Validates: Requirements 5.1**

- [ ] 6. Implementar invalidación de caché
  - [x] 6.1 Implementar invalidación inteligente
    - Implementar `invalidateCacheForIngredient()`: Invalidar productos afectados
    - Implementar `onIngredientCostChanged()`: Handler de cambio de costo
    - Implementar `onRecipeChanged()`: Handler de cambio de receta
    - _Requirements: 1.3, 9.3, 9.4_
  
  - [ ]* 6.2 Write property tests para caché
    - **Property 14: Caché Round-Trip Preserva Valor**
    - **Property 15: Invalidación Afecta Productos Correctos**
    - **Validates: Requirements 1.3, 9.1, 9.2, 9.3, 9.4**

- [ ] 7. Implementar APIs REST
  - [x] 7.1 Implementar endpoint de reporte completo
    - Crear `src/app/api/admin/reports/profitability/route.ts`
    - Implementar GET con validación Zod
    - Soportar filtros: startDate, endDate, productIds, categoryIds
    - Retornar ProfitabilityReport con métricas
    - _Requirements: 6.1, 6.4, 6.6_
  
  - [x] 7.2 Implementar endpoint de análisis por producto
    - Crear `src/app/api/admin/reports/profit-by-product/[id]/route.ts`
    - Implementar GET con validación de ID
    - Incluir desglose de receta si existe
    - Incluir ventas por día del período
    - _Requirements: 6.2, 6.4_
  
  - [x] 7.3 Implementar endpoint de análisis de márgenes
    - Crear `src/app/api/admin/reports/margin-analysis/route.ts`
    - Implementar GET con filtros
    - Retornar categorías ordenadas por ganancia
    - Incluir margen promedio y ventas totales
    - _Requirements: 6.3, 6.4, 6.6_
  
  - [ ]* 7.4 Write unit tests para validación de APIs
    - Test: Parámetros inválidos retornan 400
    - Test: Producto no encontrado retorna 404
    - Test: Filtros funcionan correctamente
    - _Requirements: 6.4, 6.5, 15.1_
  
  - [ ]* 7.5 Write property test para validación
    - **Property 17: Validación Rechaza Valores Inválidos**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

- [-] 8. Checkpoint - Validar APIs
  - Ejecutar tests de APIs con Postman o curl
  - Verificar que validación Zod funciona correctamente
  - Verificar que códigos HTTP son apropiados (400, 404, 500, 503)
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas

- [ ] 9. Implementar Dashboard UI
  - [x] 9.1 Crear componente principal del dashboard
    - Crear `src/app/admin/reports/profitability/page.tsx`
    - Implementar layout con tabla, gráficos y filtros
    - Usar SWR para fetching con auto-revalidación (30s)
    - Implementar skeleton loaders para carga
    - _Requirements: 7.1, 7.4, 7.5, 10.4, 10.5_
  
  - [x] 9.2 Implementar tabla de productos
    - Crear componente `ProductsTable.tsx`
    - Mostrar: nombre, ventas, precio, COGS, ganancia, margen%
    - Implementar ordenamiento por columnas
    - Usar memoización para cálculos pesados
    - _Requirements: 7.1, 10.3_
  
  - [x] 9.3 Implementar gráficos
    - Crear componente `MarginChart.tsx`: Gráfico de barras por categoría
    - Crear componente `ProfitTrendChart.tsx`: Gráfico de línea temporal
    - Usar lazy loading para gráficos (React.lazy)
    - Usar Chart.js o Recharts para visualización
    - _Requirements: 7.2, 7.3, 10.1_
  
  - [x] 9.4 Implementar filtros
    - Crear componente `ReportFilters.tsx`
    - Filtro de rango de fechas (date picker)
    - Filtro de categorías (multi-select)
    - Aplicar filtros con debounce (300ms)
    - _Requirements: 7.4, 7.5_
  
  - [x] 9.5 Implementar exportación a CSV
    - Crear función `exportToCSV()` en `src/lib/csv-export.ts`
    - Formatear valores monetarios con "S/ X.XX"
    - Formatear porcentajes con "X.XX%"
    - Incluir encabezados en español
    - Descargar archivo automáticamente
    - _Requirements: 7.6, 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ]* 9.6 Write property test para formato CSV
    - **Property 18: Formato de Exportación CSV es Correcto**
    - **Validates: Requirements 12.3, 12.4**
  
  - [ ]* 9.7 Write unit tests para UI
    - Test: Dashboard renderiza correctamente
    - Test: Filtros aplican correctamente
    - Test: Exportación genera CSV válido
    - Test: Empty state se muestra cuando no hay datos
    - _Requirements: 7.1-7.7, 12.1-12.5_

- [ ] 10. Implementar optimizaciones de performance
  - [x] 10.1 Configurar code splitting
    - Configurar Next.js para code splitting automático
    - Usar dynamic imports para dashboard
    - Verificar bundle size con `npm run build`
    - _Requirements: 10.2_
  
  - [x] 10.2 Implementar lazy loading
    - Usar React.lazy para gráficos
    - Usar Intersection Observer para carga bajo demanda
    - Implementar Suspense con fallbacks
    - _Requirements: 10.1_
  
  - [x] 10.3 Configurar SWR
    - Crear archivo `src/lib/swr-config.ts`
    - Configurar revalidación automática (30s)
    - Configurar deduplicación de requests
    - Configurar error retry (3 intentos)
    - _Requirements: 10.4_

- [ ] 11. Implementar Event Sourcing
  - [x] 11.1 Crear eventos de rentabilidad
    - Definir evento `COGS_CALCULATED` en `src/core/domain/events.ts`
    - Definir evento `INGREDIENT_COST_CHANGED`
    - Definir evento `PROFITABILITY_REPORT_GENERATED`
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [x] 11.2 Implementar emisión de eventos
    - Emitir `COGS_CALCULATED` al calcular COGS
    - Emitir `INGREDIENT_COST_CHANGED` al cambiar costo
    - Emitir `PROFITABILITY_REPORT_GENERATED` al generar reporte
    - Incluir tenant_id en todos los eventos
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [ ]* 11.3 Write property test para eventos
    - **Property 16: Eventos Contienen Tenant ID**
    - **Validates: Requirements 11.5**

- [ ] 12. Implementar manejo de errores
  - [x] 12.1 Crear clases de error
    - Crear `ValidationError` en `src/core/errors/profitability-errors.ts`
    - Crear `NotFoundError`
    - Crear `CalculationError`
    - Crear `InfrastructureError`
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  
  - [x] 12.2 Implementar error handlers en APIs
    - Implementar try-catch en todos los endpoints
    - Retornar códigos HTTP apropiados (400, 404, 500, 503)
    - Retornar mensajes descriptivos en español
    - Loggear errores con contexto completo
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ]* 12.3 Write property test para error logging
    - **Property 20: Error Logging Incluye Contexto Completo**
    - **Validates: Requirements 15.5**
  
  - [ ]* 12.4 Write unit tests para manejo de errores
    - Test: Producto no encontrado retorna 404
    - Test: Parámetros inválidos retornan 400
    - Test: Error de cálculo retorna 500
    - Test: Error de DB retorna 503
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 13. Checkpoint - Validar sistema completo
  - Ejecutar todos los tests (unit + property + integration)
  - Verificar cobertura de tests (objetivo: 80%+)
  - Probar dashboard manualmente en navegador
  - Verificar que exportación CSV funciona
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas

- [ ] 14. Implementar stress tests
  - [ ]* 14.1 Write stress test para 1000+ productos
    - **Property 19: Stress Test - 1000+ Productos Simultáneos**
    - **Validates: Requirements 14.5**
  
  - [ ]* 14.2 Write stress test para caché
    - Test: 1000+ requests simultáneos con caché
    - Verificar que caché reduce tiempo de respuesta
    - Verificar que no hay race conditions
    - _Requirements: 9.1, 9.2_
  
  - [ ]* 14.3 Write stress test para agregaciones
    - Test: Agregación de 10,000+ ventas
    - Verificar que tiempo de respuesta < 5s
    - Verificar que memoria no crece indefinidamente
    - _Requirements: 3.2, 3.3, 4.2, 4.4_

- [ ] 15. Integración y wiring final
  - [x] 15.1 Integrar con sistema existente
    - Agregar link al dashboard en sidebar de admin
    - Agregar permisos de acceso (solo admin)
    - Integrar con sistema de autenticación existente
    - Verificar multi-tenancy (tenant_id en todas las queries)
    - _Requirements: Todos_
  
  - [x] 15.2 Crear documentación
    - Crear README.md en `.kiro/specs/profitability-report/`
    - Documentar APIs con ejemplos de uso
    - Documentar fórmulas de cálculo
    - Documentar estrategia de caché
  
  - [ ]* 15.3 Write integration tests E2E
    - Test: Flujo completo desde UI hasta DB
    - Test: Crear producto → Agregar receta → Ver reporte
    - Test: Cambiar costo ingrediente → Verificar invalidación caché
    - Test: Exportar CSV → Verificar formato
    - _Requirements: Todos_

- [ ] 16. Final checkpoint - Sistema listo para producción
  - Ejecutar suite completa de tests (unit + property + integration + stress)
  - Verificar que cobertura >= 80%
  - Verificar que performance cumple requisitos (< 200ms para 1000+ productos)
  - Verificar que dashboard funciona en Chrome, Firefox, Safari
  - Verificar que exportación CSV funciona correctamente
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas

## Notes

- Tasks marcados con `*` son opcionales (tests) y pueden omitirse para MVP más rápido
- Cada task referencia requirements específicos para trazabilidad
- Checkpoints aseguran validación incremental
- Property tests validan corrección matemática con 100+ iteraciones
- Unit tests validan ejemplos específicos y edge cases
- Stress tests validan escalabilidad con 1000+ productos
- Todos los valores monetarios DEBEN usar branded types (Centavos, COGS, Profit, Margin)
- Todos los cálculos DEBEN usar integers para dinero (nunca float)
- Todos los eventos DEBEN incluir tenant_id para multi-tenancy
- Todas las APIs DEBEN validar inputs con Zod
- Todos los errores DEBEN loggearse con contexto completo
