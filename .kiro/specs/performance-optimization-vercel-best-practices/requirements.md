# Requirements Document

## Introduction

Este documento define los requisitos para optimizar el rendimiento de PARK POS siguiendo las mejores prácticas de Vercel y React. La optimización se basa en una auditoría arquitectónica completa realizada el 13 de febrero de 2026 que identificó 5 áreas críticas de mejora.

**Contexto:** PARK POS es un sistema POS offline-first con arquitectura Event Sourcing que actualmente tiene problemas de rendimiento en producción:
- Bundle size: 2.5MB (300KB de lucide-react barrel imports)
- 40% de requests HTTP duplicados sin deduplicación
- Crashes en modo incógnito por localStorage sin manejo de errores
- TTFB de 800ms en admin panel por waterfalls
- Re-renders excesivos por dependencias amplias en useEffect

**Objetivo:** Reducir bundle size en 12%, eliminar 75% de requests duplicados, eliminar crashes en incógnito, reducir TTFB en 37%, y optimizar re-renders.

**Referencias:**
- Auditoría completa: `AUDITORIA_ARQUITECTONICA_VERCEL_BEST_PRACTICES_13_FEB_2026.md`
- Resumen ejecutivo: `RESUMEN_EJECUTIVO_AUDITORIA_13_FEB_2026.md`

## Glossary

- **System**: PARK POS - Sistema POS offline-first con Event Sourcing
- **Bundle_Size**: Tamaño total del JavaScript bundle enviado al cliente
- **Tree_Shaking**: Eliminación automática de código no utilizado durante el build
- **Request_Deduplication**: Eliminación de requests HTTP duplicados mediante caché
- **SWR**: Librería de React para data fetching con caché y revalidación
- **localStorage**: API del navegador para almacenamiento persistente local
- **TTFB**: Time To First Byte - tiempo hasta recibir primer byte del servidor
- **Waterfall**: Patrón donde requests se ejecutan secuencialmente en lugar de paralelo
- **Re_render**: Re-ejecución del render de un componente React
- **useEffect**: Hook de React para efectos secundarios
- **RSC**: React Server Components - componentes que se ejecutan en el servidor
- **Barrel_Import**: Import que re-exporta múltiples módulos (ej: `import { Icon } from 'library'`)
- **Named_Import**: Import específico de un módulo (ej: `import Icon from 'library/icon'`)

## Requirements

### Requirement 1: Tree-Shaking de lucide-react

**User Story:** Como desarrollador, quiero que el bundle de lucide-react use tree-shaking efectivo, para reducir el tamaño del bundle en 300KB.

#### Acceptance Criteria

1. WHEN el sistema se compila THEN lucide-react SHALL usar named imports en lugar de barrel imports
2. WHEN se analiza el bundle THEN el tamaño de lucide-react SHALL ser menor a 50KB (actualmente 350KB)
3. WHEN se verifica next.config.js THEN optimizePackageImports SHALL incluir 'lucide-react'
4. WHEN se ejecuta el build THEN el sistema SHALL generar un reporte de bundle size
5. WHEN se comparan bundles THEN la reducción SHALL ser de al menos 300KB (-12% del total)

### Requirement 2: Deduplicación de Requests HTTP

**User Story:** Como usuario, quiero que el sistema no haga requests HTTP duplicados, para mejorar el rendimiento y reducir la carga del servidor.

#### Acceptance Criteria

1. WHEN múltiples componentes solicitan los mismos datos THEN el sistema SHALL hacer solo 1 request HTTP
2. WHEN se instala SWR THEN el sistema SHALL configurar deduplicación global
3. WHEN se migran componentes a SWR THEN los requests duplicados SHALL reducirse en 75%
4. WHEN se usa SWR THEN el sistema SHALL implementar revalidación automática
5. WHEN se configura SWR THEN el sistema SHALL usar stale-while-revalidate pattern
6. WHEN se miden requests THEN el número de requests duplicados SHALL ser menor al 10%

### Requirement 3: Manejo Seguro de localStorage

**User Story:** Como usuario en modo incógnito, quiero que el sistema funcione correctamente, para poder usar la aplicación sin crashes.

#### Acceptance Criteria

1. WHEN se accede a localStorage THEN el sistema SHALL usar try-catch para manejar errores
2. WHEN localStorage no está disponible THEN el sistema SHALL usar fallback en memoria
3. WHEN se crea la utilidad THEN el sistema SHALL centralizar todo acceso a localStorage
4. WHEN ocurre un error de localStorage THEN el sistema SHALL loggear el error sin crashear
5. WHEN se usa en incógnito THEN el sistema SHALL funcionar sin errores
6. WHEN se migran componentes THEN todos los accesos directos a localStorage SHALL ser reemplazados
7. IF localStorage falla THEN el sistema SHALL continuar operando con datos en memoria

### Requirement 4: Eliminación de Waterfalls en Server Components

**User Story:** Como usuario del admin panel, quiero que las páginas carguen rápido, para tener una experiencia fluida.

#### Acceptance Criteria

1. WHEN se cargan páginas admin THEN los requests SHALL ejecutarse en paralelo
2. WHEN se auditan waterfalls THEN el TTFB SHALL reducirse de 800ms a 500ms (-37%)
3. WHEN se implementa React.cache THEN los datos SHALL ser compartidos entre componentes
4. WHEN se usan Server Components THEN el sistema SHALL usar Promise.all para paralelización
5. WHEN se mide performance THEN el tiempo de carga SHALL mejorar en al menos 300ms
6. WHEN se optimizan páginas THEN el sistema SHALL priorizar las 5 páginas más usadas

### Requirement 5: Optimización de Re-renders

**User Story:** Como desarrollador, quiero que los componentes no se re-rendericen innecesariamente, para mejorar el rendimiento de la UI.

#### Acceptance Criteria

1. WHEN se auditan useEffect THEN las dependencias amplias SHALL ser específicas
2. WHEN se optimizan componentes THEN el sistema SHALL usar React.memo donde apropiado
3. WHEN se usan callbacks THEN el sistema SHALL usar useCallback para funciones estables
4. WHEN se usan valores computados THEN el sistema SHALL usar useMemo para cálculos costosos
5. WHEN se miden re-renders THEN la frecuencia SHALL reducirse en al menos 50%
6. WHEN se refactorizan useEffect THEN cada efecto SHALL tener dependencias mínimas necesarias

## Implementation Phases

### Fase 1 (Esta Semana - 5 horas)
- Verificar tree-shaking de lucide-react (Requirement 1)
- Crear utilidad de localStorage (Requirement 3)
- Instalar y configurar SWR (Requirement 2)

### Fase 2 (Próxima Semana - 9 horas)
- Migrar 5 componentes principales a SWR (Requirement 2)
- Auditar waterfalls en admin pages (Requirement 4)
- Optimizar dependencias de useEffect (Requirement 5)

### Fase 3 (Mes 1 - 14 horas)
- Migrar resto de componentes a SWR (Requirement 2)
- Implementar React.cache en RSC (Requirement 4)
- Auditoría completa de re-renders (Requirement 5)

## Success Metrics

| Métrica | Actual | Objetivo | Mejora |
|---------|--------|----------|--------|
| Bundle Size | 2.5MB | 2.2MB | -12% |
| Requests Duplicados | 40% | 10% | -75% |
| Crashes Incógnito | Sí | No | 100% |
| TTFB Admin | 800ms | 500ms | -37% |
| Re-renders | Baseline | -50% | 50% |

## Affected Files

- **50+ archivos** con lucide-react imports (Requirement 1)
- **20+ componentes** con fetch directo (Requirement 2)
- **7 archivos** con localStorage sin try-catch (Requirement 3)
- **10+ componentes** con useEffect (Requirement 5)
- **5 páginas admin** con waterfalls (Requirement 4)

## Configuration Status

- ✅ `next.config.js` ya tiene `optimizePackageImports` configurado (línea 17)
- ❌ `package.json` NO tiene SWR instalado
- ❌ NO existe `src/lib/storage.ts`
- ❌ NO existe `src/lib/swr-config.ts`
