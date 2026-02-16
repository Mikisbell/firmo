# React.cache Optimization - Requirements

## 1. Contexto

PARK POS tiene múltiples Server Components en el admin panel que realizan llamadas a base de datos y APIs. Actualmente, estas llamadas no están optimizadas con `React.cache`, lo que puede resultar en:

- Llamadas duplicadas a la misma función durante el mismo render
- Degradación de performance en páginas con múltiples componentes que consumen los mismos datos
- Mayor carga en la base de datos y APIs

React 19 introduce `React.cache` como una API estable para memoizar funciones asíncronas durante el ciclo de vida de un request del servidor.

## 2. Objetivos

1. **Optimizar Server Components** - Implementar `React.cache` en todos los Server Components que realizan data fetching
2. **Reducir llamadas duplicadas** - Eliminar llamadas redundantes a base de datos/APIs durante el mismo render
3. **Mejorar performance** - Reducir tiempo de respuesta de páginas del admin panel
4. **Mantener type safety** - Preservar tipos TypeScript en todas las funciones cacheadas

## 3. Alcance

### 3.1 Server Components Identificados

Los siguientes archivos contienen Server Components que requieren optimización:

1. ✅ `src/app/admin/dashboard/page.tsx` - **Client Component** (usa hooks, no requiere cache)
2. ✅ `src/app/admin/empleados/page.tsx` - **Client Component** (usa hooks, no requiere cache)
3. ✅ `src/app/admin/productos/page.tsx` - **Client Component** (usa hooks, no requiere cache)
4. ⚠️ `src/app/admin/estaciones/page.tsx` - **Client Component** (usa hooks, no requiere cache)
5. ✅ `src/app/admin/drivers/page.tsx` - **Client Component** (usa hooks, no requiere cache)
6. ✅ `src/app/admin/monitoring/page.tsx` - **Client Component** (usa hooks, no requiere cache)
7. ✅ `src/app/admin/alerts/page.tsx` - **Client Component** (usa hooks, no requiere cache)
8. ✅ `src/app/admin/security/page.tsx` - **Client Component** (usa hooks, no requiere cache)
9. ✅ `src/app/admin/tenant/dashboard/page.tsx` - **Client Component** (usa hooks, no requiere cache)
10. ✅ `src/app/admin/tenant/provisioning/page.tsx` - **Client Component** (usa hooks, no requiere cache)
11. ✅ `src/app/admin/cross-tenant/dashboard/page.tsx` - **Client Component** (usa hooks, no requiere cache)

### 3.2 Hallazgo Crítico

**TODOS los componentes auditados son Client Components** (usan `'use client'` directive).

`React.cache` **SOLO funciona en Server Components**. No tiene efecto en Client Components porque:
- Client Components se ejecutan en el navegador, no en el servidor
- El ciclo de vida de request del servidor no aplica
- Los datos se obtienen vía fetch/hooks en el cliente

### 3.3 Arquitectura Actual

El admin panel usa una arquitectura **Client-Side Rendering (CSR)** con:
- Client Components que usan hooks (`useState`, `useEffect`, `useCallback`)
- Data fetching vía `fetch()` en el cliente
- SWR para caché y revalidación en algunos componentes
- Auto-refresh con intervals

### 3.4 Decisión Arquitectónica

**NO implementar React.cache en estos componentes** porque:

1. **Incompatibilidad técnica** - React.cache no funciona en Client Components
2. **Arquitectura existente** - El sistema ya usa SWR para caché del lado del cliente
3. **Funcionalidad requerida** - Auto-refresh y real-time updates requieren Client Components
4. **Costo vs beneficio** - Migrar a Server Components requeriría:
   - Reescribir toda la lógica de estado
   - Eliminar auto-refresh (incompatible con Server Components)
   - Perder interactividad en tiempo real
   - Refactorizar 11+ componentes complejos

## 4. Alternativa: Optimización de Client Components

En lugar de React.cache, se recomienda:

### 4.1 SWR Global Configuration

Optimizar la configuración de SWR para deduplicación y caché:

```typescript
// src/lib/swr-config.ts
import { SWRConfig } from 'swr';

export const swrConfig = {
  // Deduplicación automática de requests
  dedupingInterval: 2000, // 2 segundos
  
  // Revalidación inteligente
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  
  // Caché persistente
  provider: () => new Map(),
  
  // Error retry
  errorRetryCount: 3,
  errorRetryInterval: 5000,
};
```

### 4.2 Request Deduplication

Implementar deduplicación manual para requests no-SWR:

```typescript
// src/lib/fetch-cache.ts
const requestCache = new Map<string, Promise<any>>();

export function cachedFetch<T>(
  url: string,
  options?: RequestInit,
  ttl: number = 5000
): Promise<T> {
  const key = `${url}-${JSON.stringify(options)}`;
  
  if (requestCache.has(key)) {
    return requestCache.get(key)!;
  }
  
  const promise = fetch(url, options)
    .then(res => res.json())
    .finally(() => {
      setTimeout(() => requestCache.delete(key), ttl);
    });
  
  requestCache.set(key, promise);
  return promise;
}
```

### 4.3 useMemo para Cálculos Costosos

Optimizar cálculos derivados con `useMemo`:

```typescript
// Ejemplo en estaciones/page.tsx
const globalStats = useMemo(() => {
  // Cálculos costosos aquí
  return { activeStations, totalOrders, avgTime, globalEfficiency };
}, [stations]);
```

## 5. Acceptance Criteria

### 5.1 Documentación

- [ ] 5.1.1 Crear documento de análisis de arquitectura
- [ ] 5.1.2 Documentar decisión de NO usar React.cache
- [ ] 5.1.3 Documentar alternativas de optimización
- [ ] 5.1.4 Crear guía de mejores prácticas para Client Components

### 5.2 Optimizaciones Implementadas

- [ ] 5.2.1 Configurar SWR globalmente con deduplicación
- [ ] 5.2.2 Implementar cachedFetch para requests no-SWR
- [ ] 5.2.3 Auditar y optimizar useMemo en componentes existentes
- [ ] 5.2.4 Medir mejoras de performance

### 5.3 Testing

- [ ] 5.3.1 Tests de deduplicación de requests
- [ ] 5.3.2 Tests de caché de SWR
- [ ] 5.3.3 Tests de performance (antes/después)
- [ ] 5.3.4 Tests de memory leaks

## 6. Out of Scope

- Migración a Server Components (requiere reescritura completa)
- Implementación de React.cache (incompatible con Client Components)
- Cambios en la arquitectura de rendering (CSR → SSR)
- Eliminación de auto-refresh (funcionalidad crítica)

## 7. Riesgos

### 7.1 Riesgo: Caché Stale

**Descripción**: Datos en caché pueden quedar desactualizados

**Mitigación**:
- Configurar TTL apropiados (2-5 segundos)
- Mantener auto-refresh en componentes críticos
- Usar SWR revalidation strategies

### 7.2 Riesgo: Memory Leaks

**Descripción**: Caché puede crecer indefinidamente

**Mitigación**:
- Implementar TTL en cachedFetch
- Limpiar caché en unmount
- Monitorear uso de memoria

## 8. Métricas de Éxito

### 8.1 Performance

- Reducción de 30%+ en requests duplicados
- Mejora de 20%+ en tiempo de carga de páginas
- Reducción de 40%+ en queries a base de datos

### 8.2 Calidad

- 100% de tests pasando
- 0 memory leaks detectados
- 0 regresiones en funcionalidad

## 9. Referencias

- [React.cache Documentation](https://react.dev/reference/react/cache)
- [SWR Documentation](https://swr.vercel.app/)
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [PARK POS Architecture](../../docs/02-architecture/ARCHITECTURE.md)

---

**Última actualización**: 13 Febrero 2026  
**Estado**: Requirements Complete  
**Próximo paso**: Design Document
