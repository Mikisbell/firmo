# Plan de Implementación: Optimización de Performance - Vercel Best Practices

## Resumen

Este plan implementa 5 optimizaciones críticas de performance para PARK POS basadas en la auditoría arquitectónica del 13 de febrero de 2026. La implementación se divide en 3 fases graduales e independientes, cada una deployable por separado.

**Impacto Esperado:**
- Bundle size: 2.5MB → 2.2MB (-12%)
- Requests duplicados: 40% → 10% (-75%)
- Crashes en incógnito: Sí → No (100%)
- TTFB admin: 800ms → 500ms (-37%)
- Re-renders: Baseline → -50%

**Tiempo Total:** 28 horas (5h + 9h + 14h)

## Tareas

### Fase 1: Optimizaciones Críticas (Esta Semana - 5 horas)

- [x] 1. Verificar tree-shaking de lucide-react
  - Ejecutar build y analizar bundle size de lucide-react
  - Verificar que optimizePackageImports funciona correctamente
  - Si bundle > 50KB, identificar barrel imports y reemplazar con named imports
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Tiempo: 1 hora_
  - _Archivos: 50+ archivos con imports de lucide-react_

  - [x] 1.1 Crear script de análisis de bundle
    - Crear `scripts/analyze-bundle.ts`
    - Implementar función para leer stats del build
    - Implementar función para calcular tamaño de lucide-react
    - Implementar verificación de límite de 50KB
    - _Requirements: 1.2, 1.4_

  - [ ]* 1.2 Escribir tests para script de análisis
    - Test: script detecta bundle size correctamente
    - Test: script falla si lucide-react > 50KB
    - Test: script calcula reducción vs baseline
    - _Requirements: 1.5_

  - [x] 1.3 Ejecutar análisis y verificar tree-shaking
    - Ejecutar `npm run build`
    - Ejecutar `node scripts/analyze-bundle.ts`
    - Documentar resultado actual
    - Si falla, identificar archivos con barrel imports
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.4 Crear script de migración de imports (si necesario)
    - Script para buscar barrel imports de lucide-react
    - Script para reemplazar con named imports
    - Test del script en 5 archivos de prueba
    - _Requirements: 1.1_

- [x] 2. Crear utilidad centralizada de localStorage
  - Crear `src/lib/storage.ts` con clase SafeStorage
  - Implementar try-catch para todas las operaciones
  - Implementar fallback en memoria cuando localStorage falla
  - Implementar logging de errores sin crashear
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_
  - _Tiempo: 2 horas_
  - _Archivos: 7 archivos con acceso directo a localStorage_

  - [x] 2.1 Implementar clase SafeStorage
    - Implementar constructor con detección de disponibilidad
    - Implementar getItem() con try-catch y fallback
    - Implementar setItem() con try-catch y fallback
    - Implementar removeItem() con try-catch y fallback
    - Implementar clear() con try-catch y fallback
    - Implementar isAvailable() para detectar modo incógnito
    - _Requirements: 3.1, 3.2, 3.4, 3.7_

  - [ ]* 2.2 Escribir unit tests para SafeStorage
    - Test: getItem retorna null cuando localStorage no disponible
    - Test: setItem usa fallback cuando localStorage falla
    - Test: removeItem no crashea cuando localStorage falla
    - Test: clear no crashea cuando localStorage falla
    - Test: isAvailable detecta modo incógnito correctamente
    - _Requirements: 3.5_

  - [ ]* 2.3 Escribir property test para manejo de errores
    - **Property 2: localStorage Safe Access with Fallback**
    - **Validates: Requirements 3.1, 3.4, 3.7**
    - Para cualquier operación (get, set, remove, clear), debe usar try-catch, loggear error y usar fallback
    - _Requirements: 3.1, 3.4, 3.7_

  - [ ]* 2.4 Escribir property test para consistencia de fallback
    - **Property 3: localStorage Fallback Consistency**
    - **Validates: Requirements 3.2**
    - Para cualquier secuencia (set → get → remove), fallback debe mantener consistencia
    - _Requirements: 3.2_

  - [x] 2.5 Migrar 7 archivos a SafeStorage
    - Migrar `src/app/delivery/page.tsx` (línea 36)
    - Migrar otros 6 archivos identificados en auditoría
    - Reemplazar accesos directos a localStorage con safeStorage
    - Verificar que no hay crashes en modo incógnito
    - _Requirements: 3.3, 3.6_

- [x] 3. Instalar y configurar SWR
  - Instalar librería SWR
  - Crear `src/lib/swr-config.ts` con configuración global
  - Configurar SWRConfig en _app.tsx o layout.tsx
  - Implementar fetcher global con manejo de errores
  - _Requirements: 2.2, 2.5_
  - _Tiempo: 2 horas_

  - [x] 3.1 Instalar SWR y crear configuración
    - Ejecutar `npm install swr`
    - Crear `src/lib/swr-config.ts`
    - Configurar dedupingInterval: 2000ms
    - Configurar revalidateOnFocus: true
    - Configurar revalidateOnReconnect: true
    - Configurar retry con 3 intentos
    - Implementar fetcher global con manejo de errores
    - _Requirements: 2.2, 2.5_

  - [x] 3.2 Integrar SWRConfig en aplicación
    - Modificar `src/pages/_app.tsx` o `src/app/layout.tsx`
    - Envolver aplicación con SWRConfig
    - Pasar configuración y fetcher global
    - _Requirements: 2.2_

  - [ ]* 3.3 Escribir tests de configuración
    - Test: SWRConfig tiene dedupingInterval correcto
    - Test: fetcher global maneja errores HTTP
    - Test: fetcher global parsea JSON correctamente
    - _Requirements: 2.2_

- [x] 4. Checkpoint - Verificar Fase 1
  - Ejecutar todos los tests (unit + property)
  - Verificar que bundle size de lucide-react < 50KB
  - Verificar que safeStorage funciona en modo incógnito
  - Verificar que SWR está configurado correctamente
  - Preguntar al usuario si hay dudas o problemas

### Fase 2: Migraciones y Optimizaciones (Próxima Semana - 9 horas)

- [x] 5. Migrar 5 componentes principales a SWR
  - Identificar los 5 componentes con más requests duplicados
  - Migrar de useEffect + fetch a useSWR
  - Implementar manejo consistente de loading/error states
  - Medir reducción de requests duplicados
  - _Requirements: 2.1, 2.3, 2.4, 2.6_
  - _Tiempo: 4 horas_
  - _Archivos: CatalogGrid.tsx, delivery/page.tsx, admin/page.tsx, terminales/page.tsx, security/page.tsx_

  - [x] 5.1 Crear hooks personalizados de SWR
    - Crear `useCatalog()` para `/api/catalog/latest`
    - Crear `useDeliveryOrders()` para delivery
    - Crear `useAdminStats()` para admin dashboard
    - Crear `useTerminals()` para terminales
    - Crear `useSecurityLogs()` para security
    - _Requirements: 2.1, 2.4_

  - [x] 5.2 Migrar CatalogGrid.tsx a useCatalog
    - Reemplazar useEffect + fetch con useCatalog()
    - Implementar loading state con skeleton
    - Implementar error state con mensaje
    - Verificar que funciona correctamente
    - _Requirements: 2.1, 2.3_

  - [x] 5.3 Migrar delivery/page.tsx a useDeliveryOrders
    - Reemplazar useEffect + fetch con useDeliveryOrders()
    - Implementar loading/error states
    - Verificar que funciona correctamente
    - _Requirements: 2.1, 2.3_

  - [x] 5.4 Migrar admin/page.tsx a useAdminStats
    - Reemplazar useEffect + fetch con useAdminStats()
    - Implementar loading/error states
    - Verificar que funciona correctamente
    - _Requirements: 2.1, 2.3_

  - [x] 5.5 Migrar terminales/page.tsx y security/page.tsx
    - Migrar ambos componentes a SWR
    - Implementar loading/error states
    - Verificar que funcionan correctamente
    - _Requirements: 2.1, 2.3_

  - [ ]* 5.6 Escribir property test para deduplicación
    - **Property 1: SWR Request Deduplication and Revalidation**
    - **Validates: Requirements 2.1, 2.4, 2.5**
    - Para cualquier conjunto de componentes que solicitan los mismos datos, debe hacer solo 1 request
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 5.7 Medir reducción de requests duplicados
    - Abrir Network tab en DevTools
    - Montar múltiples instancias de componentes migrados
    - Contar requests antes y después
    - Documentar reducción (target: > 75%)
    - _Requirements: 2.3, 2.6_

- [x] 6. Auditar y optimizar waterfalls en admin pages
  - Identificar las 5 páginas admin más usadas
  - Convertir requests secuenciales a Promise.all
  - Implementar React.cache para compartir datos entre componentes
  - Medir TTFB antes y después
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - _Tiempo: 3 horas_

  - [x] 6.1 Auditar páginas admin para identificar waterfalls
    - Usar React DevTools Profiler
    - Identificar componentes que hacen fetch secuencial
    - Documentar TTFB actual de cada página
    - Priorizar las 5 páginas más lentas
    - _Requirements: 4.2, 4.6_

  - [x] 6.2 Implementar React.cache en Server Components
    - Crear funciones cacheadas para fetches comunes
    - Ejemplo: `const getAnalytics = cache(async () => ...)`
    - Ejemplo: `const getProducts = cache(async () => ...)`
    - Ejemplo: `const getEmployees = cache(async () => ...)`
    - _Requirements: 4.3_

  - [x] 6.3 Paralelizar requests con Promise.all
    - Reemplazar fetches secuenciales con Promise.all
    - Ejemplo: `const [analytics, products, employees] = await Promise.all([...])`
    - Aplicar en las 5 páginas identificadas
    - _Requirements: 4.1, 4.4_

  - [ ]* 6.4 Escribir property test para paralelización
    - **Property 4: Server Components Parallel Execution**
    - **Validates: Requirements 4.1, 4.3**
    - Para cualquier Server Component, requests deben ejecutarse en paralelo
    - _Requirements: 4.1, 4.3_

  - [x] 6.5 Medir mejora de TTFB
    - Usar Lighthouse para medir TTFB
    - Comparar antes y después
    - Documentar mejora (target: 800ms → 500ms, -37%)
    - _Requirements: 4.2, 4.5_

- [x] 7. Optimizar dependencias de useEffect
  - Auditar todos los useEffect en componentes principales
  - Reemplazar dependencias amplias (objetos completos) con específicas (primitivos)
  - Aplicar useCallback para funciones estables
  - Aplicar useMemo para cálculos costosos
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  - _Tiempo: 2 horas_

  - [x] 7.1 Auditar useEffect con dependencias amplias
    - Buscar useEffect con objetos completos como dependencias
    - Identificar al menos 10 casos
    - Documentar componente y línea
    - _Requirements: 5.1, 5.6_

  - [x] 7.2 Refactorizar useEffect con dependencias específicas
    - Reemplazar `[user]` con `[user.id]`
    - Reemplazar `[config]` con `[config.url]`
    - Aplicar en los 10 casos identificados
    - _Requirements: 5.6_

  - [ ]* 7.3 Escribir property test para useEffect
    - **Property 7: useEffect Minimal Dependencies**
    - **Validates: Requirements 5.6**
    - Para cualquier useEffect, dependencias deben ser mínimas
    - _Requirements: 5.6_

  - [x] 7.4 Identificar componentes que necesitan React.memo
    - Buscar componentes costosos que se re-renderizan frecuentemente
    - Identificar al menos 5 componentes
    - Documentar componente y razón
    - _Requirements: 5.2_

  - [x] 7.5 Aplicar React.memo a componentes costosos
    - Envolver componentes con React.memo
    - Verificar que reduce re-renders
    - _Requirements: 5.2_

  - [x] 7.6 Identificar funciones que necesitan useCallback
    - Buscar funciones pasadas como props que no cambian
    - Identificar al menos 10 casos
    - Documentar componente y función
    - _Requirements: 5.3_

  - [x] 7.7 Aplicar useCallback a funciones estables
    - Envolver funciones con useCallback
    - Usar dependencias vacías para funciones estables
    - _Requirements: 5.3_

  - [ ]* 7.8 Escribir property test para useCallback
    - **Property 5: useCallback Stability**
    - **Validates: Requirements 5.3**
    - Para cualquier función estable, useCallback mantiene referencia
    - _Requirements: 5.3_

  - [x] 7.9 Identificar cálculos costosos que necesitan useMemo
    - Buscar operaciones O(n log n) o superiores (sort, filter, map encadenados)
    - Identificar al menos 5 casos
    - Documentar componente y cálculo
    - _Requirements: 5.4_

  - [ ] 7.10 Aplicar useMemo a cálculos costosos
    - Envolver cálculos con useMemo
    - Usar dependencias específicas
    - _Requirements: 5.4_

  - [ ]* 7.11 Escribir property test para useMemo
    - **Property 6: useMemo Computation Caching**
    - **Validates: Requirements 5.4**
    - Para cualquier cálculo costoso, useMemo cachea el resultado
    - _Requirements: 5.4_

- [ ] 8. Checkpoint - Verificar Fase 2
  - Ejecutar todos los tests (unit + property)
  - Verificar que requests duplicados < 10%
  - Verificar que TTFB mejoró > 300ms
  - Verificar que re-renders redujeron > 20%
  - Preguntar al usuario si hay dudas o problemas

### Fase 3: Migración Completa y Auditoría Final (Mes 1 - 14 horas)

- [ ] 9. Migrar resto de componentes a SWR
  - Identificar todos los componentes restantes con fetch directo
  - Migrar a useSWR (15+ componentes)
  - Implementar loading/error states consistentes
  - Verificar que requests duplicados < 10%
  - _Requirements: 2.1, 2.3, 2.6_
  - _Tiempo: 6 horas_

  - [ ] 9.1 Identificar componentes restantes con fetch directo
    - Buscar en codebase: `useEffect.*fetch`
    - Excluir componentes ya migrados en Fase 2
    - Crear lista de 15+ componentes
    - _Requirements: 2.1_

  - [ ] 9.2 Crear hooks personalizados para componentes restantes
    - Crear hook para cada endpoint único
    - Reutilizar hooks donde sea posible
    - Documentar hooks en `src/lib/swr-config.ts`
    - _Requirements: 2.1, 2.4_

  - [ ] 9.3 Migrar componentes en lotes de 5
    - Lote 1: Migrar 5 componentes
    - Lote 2: Migrar 5 componentes
    - Lote 3: Migrar 5+ componentes restantes
    - Verificar que cada lote funciona antes de continuar
    - _Requirements: 2.1, 2.3_

  - [ ] 9.4 Verificar reducción final de requests duplicados
    - Medir requests duplicados en toda la aplicación
    - Comparar con baseline (40%)
    - Verificar que < 10% (target)
    - Documentar resultado final
    - _Requirements: 2.6_

- [ ] 10. Implementar React.cache en todos los RSC
  - Identificar todos los Server Components con múltiples fetches
  - Implementar React.cache para cada fetch
  - Usar Promise.all para paralelización
  - Medir mejora de TTFB en todas las páginas
  - _Requirements: 4.1, 4.3, 4.5_
  - _Tiempo: 4 horas_

  - [ ] 10.1 Auditar todos los Server Components
    - Buscar archivos en `src/app/**/page.tsx`
    - Identificar componentes con múltiples fetches
    - Crear lista de componentes a optimizar
    - _Requirements: 4.1_

  - [ ] 10.2 Implementar React.cache en todos los fetches
    - Crear función cacheada para cada fetch único
    - Reutilizar funciones cacheadas donde sea posible
    - Documentar funciones en comentarios
    - _Requirements: 4.3_

  - [ ] 10.3 Paralelizar todos los fetches con Promise.all
    - Reemplazar fetches secuenciales con Promise.all
    - Aplicar en todos los Server Components
    - _Requirements: 4.1_

  - [ ] 10.4 Medir mejora de TTFB en todas las páginas
    - Usar Lighthouse para medir TTFB de cada página
    - Comparar antes y después
    - Documentar mejora promedio
    - Verificar que cumple target (-37%)
    - _Requirements: 4.5_

- [ ] 11. Auditoría completa de re-renders
  - Usar React DevTools Profiler para identificar re-renders excesivos
  - Aplicar React.memo, useCallback, useMemo según corresponda
  - Medir reducción total de re-renders
  - Verificar que cumple target (> 50% reducción)
  - _Requirements: 5.2, 5.3, 5.4, 5.5_
  - _Tiempo: 4 horas_

  - [ ] 11.1 Configurar React DevTools Profiler
    - Instalar React DevTools en navegador
    - Configurar Profiler para grabar re-renders
    - Documentar proceso de medición
    - _Requirements: 5.5_

  - [ ] 11.2 Identificar componentes con re-renders excesivos
    - Grabar sesión de uso típico con Profiler
    - Identificar componentes que se re-renderizan > 10 veces
    - Crear lista priorizada por frecuencia
    - _Requirements: 5.5_

  - [ ] 11.3 Aplicar optimizaciones a componentes identificados
    - Aplicar React.memo donde apropiado
    - Aplicar useCallback para funciones
    - Aplicar useMemo para cálculos
    - Optimizar dependencias de useEffect
    - _Requirements: 5.2, 5.3, 5.4, 5.6_

  - [ ] 11.4 Medir reducción de re-renders
    - Grabar nueva sesión con Profiler
    - Comparar frecuencia de re-renders antes y después
    - Calcular reducción porcentual
    - Verificar que cumple target (> 50%)
    - _Requirements: 5.5_

  - [ ] 11.5 Documentar optimizaciones aplicadas
    - Crear documento con lista de componentes optimizados
    - Documentar técnica aplicada a cada uno
    - Documentar mejora medida
    - _Requirements: 5.5_

- [ ] 12. Checkpoint Final - Verificar todas las métricas
  - Ejecutar todos los tests (100% passing)
  - Verificar bundle size: 2.5MB → 2.2MB (-12%)
  - Verificar requests duplicados: 40% → < 10% (-75%)
  - Verificar crashes incógnito: Sí → No (100%)
  - Verificar TTFB: 800ms → 500ms (-37%)
  - Verificar re-renders: Baseline → -50%
  - Crear reporte final de métricas
  - Preguntar al usuario si está listo para deploy

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada fase es independiente y deployable por separado
- Cada tarea referencia los requirements específicos que valida
- Los checkpoints aseguran validación incremental
- Los property tests validan correctness properties universales
- Los unit tests validan ejemplos específicos y edge cases
- Tiempo total estimado: 28 horas (5h + 9h + 14h)

## Archivos Afectados

### Fase 1 (5 archivos nuevos)
- `scripts/analyze-bundle.ts` (nuevo)
- `src/lib/storage.ts` (nuevo)
- `src/lib/swr-config.ts` (nuevo)
- `src/pages/_app.tsx` o `src/app/layout.tsx` (modificar)
- 7 archivos con localStorage (modificar)

### Fase 2 (20+ archivos)
- `src/app/pos/components/CatalogGrid.tsx` (modificar)
- `src/app/delivery/page.tsx` (modificar)
- `src/app/admin/page.tsx` (modificar)
- `src/app/admin/terminales/page.tsx` (modificar)
- `src/app/admin/security/page.tsx` (modificar)
- 5 páginas admin con waterfalls (modificar)
- 10+ componentes con useEffect (modificar)

### Fase 3 (30+ archivos)
- 15+ componentes restantes con fetch (modificar)
- Todos los Server Components con fetches (modificar)
- Componentes con re-renders excesivos (modificar)

## Métricas de Éxito

| Métrica | Actual | Target | Fase |
|---------|--------|--------|------|
| Bundle Size | 2.5MB | 2.2MB (-12%) | Fase 1 |
| Requests Duplicados | 40% | 10% (-75%) | Fase 2-3 |
| Crashes Incógnito | Sí | No (100%) | Fase 1 |
| TTFB Admin | 800ms | 500ms (-37%) | Fase 2-3 |
| Re-renders | Baseline | -50% | Fase 2-3 |

## Referencias

- Auditoría completa: `AUDITORIA_ARQUITECTONICA_VERCEL_BEST_PRACTICES_13_FEB_2026.md`
- Resumen ejecutivo: `RESUMEN_EJECUTIVO_AUDITORIA_13_FEB_2026.md`
- Requirements: `.kiro/specs/performance-optimization-vercel-best-practices/requirements.md`
- Design: `.kiro/specs/performance-optimization-vercel-best-practices/design.md`
