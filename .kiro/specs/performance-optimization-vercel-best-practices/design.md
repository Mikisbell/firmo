# Design Document

## Overview

Este documento describe el diseño técnico para optimizar el rendimiento de PARK POS siguiendo las mejores prácticas de Vercel y React. La optimización se implementará en 3 fases graduales e independientes, cada una deployable por separado.

**Problema:** El sistema actual tiene problemas de rendimiento en producción:
- Bundle size excesivo (2.5MB) por barrel imports de lucide-react
- 40% de requests HTTP duplicados sin deduplicación
- Crashes en modo incógnito por acceso directo a localStorage
- TTFB alto (800ms) en admin panel por waterfalls
- Re-renders excesivos por dependencias amplias en useEffect

**Solución:** Implementar 5 optimizaciones específicas y medibles:
1. Tree-shaking efectivo de lucide-react (-300KB)
2. Deduplicación de requests con SWR (-75% duplicados)
3. Utilidad centralizada de localStorage (0 crashes)
4. Paralelización de requests en RSC (-37% TTFB)
5. Optimización de re-renders (-50% frecuencia)

**Estrategia:** Migración gradual por fases, cada fase independiente y deployable.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PARK POS Frontend                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  React Components │  │  Server Components│                │
│  │                   │  │                   │                │
│  │  - SWR Hooks     │  │  - React.cache   │                │
│  │  - useCallback   │  │  - Promise.all   │                │
│  │  - useMemo       │  │  - Parallel fetch│                │
│  │  - React.memo    │  │                   │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                            │
│           v                     v                            │
│  ┌──────────────────────────────────────┐                   │
│  │      SWR Global Configuration        │                   │
│  │  - Deduplication                     │                   │
│  │  - Stale-while-revalidate           │                   │
│  │  - Automatic revalidation           │                   │
│  └──────────────────┬───────────────────┘                   │
│                     │                                        │
│                     v                                        │
│  ┌──────────────────────────────────────┐                   │
│  │    Safe Storage Utility              │                   │
│  │  - Try-catch wrapper                 │                   │
│  │  - In-memory fallback                │                   │
│  │  - Error logging                     │                   │
│  └──────────────────────────────────────┘                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Build Optimization                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────┐                   │
│  │      Next.js Build Process           │                   │
│  │                                       │                   │
│  │  - optimizePackageImports            │                   │
│  │  - Tree-shaking (lucide-react)       │                   │
│  │  - Bundle analysis                   │                   │
│  │  - Code splitting                    │                   │
│  └──────────────────────────────────────┘                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Optimization Layers

1. **Build Layer** (Requirement 1)
   - Tree-shaking de lucide-react
   - Bundle size analysis
   - Named imports enforcement

2. **Data Fetching Layer** (Requirement 2)
   - SWR para deduplicación
   - Stale-while-revalidate pattern
   - Automatic revalidation

3. **Storage Layer** (Requirement 3)
   - Safe localStorage wrapper
   - In-memory fallback
   - Error handling

4. **Server Layer** (Requirement 4)
   - React.cache para compartir datos
   - Promise.all para paralelización
   - Waterfall elimination

5. **Rendering Layer** (Requirement 5)
   - React.memo para componentes costosos
   - useCallback para funciones estables
   - useMemo para cálculos costosos
   - Dependencias específicas en useEffect

## Components and Interfaces

### 1. Safe Storage Utility (Requirement 3)

**Ubicación:** `src/lib/storage.ts`

**Interface:**

```typescript
interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
  clear(): boolean;
  isAvailable(): boolean;
}
```

**Implementación:**

```typescript
// src/lib/storage.ts

class SafeStorageImpl implements SafeStorage {
  private memoryFallback: Map<string, string> = new Map();
  private storageAvailable: boolean;

  constructor() {
    this.storageAvailable = this.checkAvailability();
  }

  private checkAvailability(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('localStorage not available, using memory fallback', e);
      return false;
    }
  }

  getItem(key: string): string | null {
    try {
      if (this.storageAvailable) {
        return localStorage.getItem(key);
      }
      return this.memoryFallback.get(key) ?? null;
    } catch (error) {
      console.error(`Error getting item ${key} from storage:`, error);
      return this.memoryFallback.get(key) ?? null;
    }
  }

  setItem(key: string, value: string): boolean {
    try {
      if (this.storageAvailable) {
        localStorage.setItem(key, value);
      }
      this.memoryFallback.set(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting item ${key} in storage:`, error);
      this.memoryFallback.set(key, value);
      return false;
    }
  }

  removeItem(key: string): boolean {
    try {
      if (this.storageAvailable) {
        localStorage.removeItem(key);
      }
      this.memoryFallback.delete(key);
      return true;
    } catch (error) {
      console.error(`Error removing item ${key} from storage:`, error);
      this.memoryFallback.delete(key);
      return false;
    }
  }

  clear(): boolean {
    try {
      if (this.storageAvailable) {
        localStorage.clear();
      }
      this.memoryFallback.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      this.memoryFallback.clear();
      return false;
    }
  }

  isAvailable(): boolean {
    return this.storageAvailable;
  }
}

export const safeStorage = new SafeStorageImpl();
```

**Uso:**

```typescript
// Antes (INCORRECTO - puede crashear)
const value = localStorage.getItem('key');
localStorage.setItem('key', 'value');

// Después (CORRECTO - manejo seguro)
import { safeStorage } from '@/lib/storage';

const value = safeStorage.getItem('key');
safeStorage.setItem('key', 'value');
```

### 2. SWR Configuration (Requirement 2)

**Ubicación:** `src/lib/swr-config.ts`

**Interface:**

```typescript
interface SWRConfig {
  dedupingInterval: number;
  revalidateOnFocus: boolean;
  revalidateOnReconnect: boolean;
  shouldRetryOnError: boolean;
  errorRetryCount: number;
  errorRetryInterval: number;
}
```

**Implementación:**

```typescript
// src/lib/swr-config.ts

import { SWRConfiguration } from 'swr';

export const swrConfig: SWRConfiguration = {
  // Deduplicación: requests idénticos en 2s se deduplicarán
  dedupingInterval: 2000,
  
  // Revalidación automática cuando la ventana recibe foco
  revalidateOnFocus: true,
  
  // Revalidación automática cuando se reconecta la red
  revalidateOnReconnect: true,
  
  // Retry en caso de error
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  
  // Stale-while-revalidate: mostrar datos stale mientras se revalidan
  // (comportamiento por defecto de SWR)
};

// Fetcher global para todas las requests
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    // @ts-ignore
    error.info = await res.json();
    // @ts-ignore
    error.status = res.status;
    throw error;
  }
  
  return res.json();
};
```

**Uso en _app.tsx:**

```typescript
// src/pages/_app.tsx (o src/app/layout.tsx para App Router)

import { SWRConfig } from 'swr';
import { swrConfig, fetcher } from '@/lib/swr-config';

export default function App({ Component, pageProps }) {
  return (
    <SWRConfig value={{ ...swrConfig, fetcher }}>
      <Component {...pageProps} />
    </SWRConfig>
  );
}
```

**Uso en componentes:**

```typescript
// Antes (INCORRECTO - requests duplicados)
const [data, setData] = useState(null);

useEffect(() => {
  fetch('/api/data')
    .then(res => res.json())
    .then(setData);
}, []);

// Después (CORRECTO - deduplicación automática)
import useSWR from 'swr';

const { data, error, isLoading } = useSWR('/api/data');
```

### 3. React.cache para Server Components (Requirement 4)

**Ubicación:** Inline en Server Components

**Implementación:**

```typescript
// src/app/admin/dashboard/page.tsx (Server Component)

import { cache } from 'react';

// Cache para compartir datos entre componentes
const getAnalytics = cache(async () => {
  const res = await fetch('http://localhost:3000/api/admin/analytics/realtime');
  return res.json();
});

const getProducts = cache(async () => {
  const res = await fetch('http://localhost:3000/api/admin/products');
  return res.json();
});

const getEmployees = cache(async () => {
  const res = await fetch('http://localhost:3000/api/admin/employees');
  return res.json();
});

export default async function DashboardPage() {
  // Paralelización con Promise.all
  const [analytics, products, employees] = await Promise.all([
    getAnalytics(),
    getProducts(),
    getEmployees(),
  ]);

  return (
    <div>
      <AnalyticsWidget data={analytics} />
      <ProductsWidget data={products} />
      <EmployeesWidget data={employees} />
    </div>
  );
}
```

**Antes (INCORRECTO - waterfall):**

```typescript
// Requests secuenciales (waterfall)
const analytics = await getAnalytics();  // 200ms
const products = await getProducts();    // 200ms
const employees = await getEmployees();  // 200ms
// Total: 600ms
```

**Después (CORRECTO - paralelo):**

```typescript
// Requests paralelos
const [analytics, products, employees] = await Promise.all([
  getAnalytics(),   // 200ms
  getProducts(),    // 200ms  } En paralelo
  getEmployees(),   // 200ms
]);
// Total: 200ms (el más lento)
```

### 4. React Performance Hooks (Requirement 5)

**React.memo:**

```typescript
// Antes (INCORRECTO - re-render en cada cambio del padre)
const ExpensiveComponent = ({ data }) => {
  // Cálculo costoso
  const processed = processData(data);
  return <div>{processed}</div>;
};

// Después (CORRECTO - solo re-render si data cambia)
const ExpensiveComponent = React.memo(({ data }) => {
  const processed = processData(data);
  return <div>{processed}</div>;
});
```

**useCallback:**

```typescript
// Antes (INCORRECTO - nueva función en cada render)
const ParentComponent = () => {
  const handleClick = () => {
    console.log('clicked');
  };
  
  return <ChildComponent onClick={handleClick} />;
};

// Después (CORRECTO - función estable)
const ParentComponent = () => {
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []); // Dependencias vacías = función estable
  
  return <ChildComponent onClick={handleClick} />;
};
```

**useMemo:**

```typescript
// Antes (INCORRECTO - cálculo en cada render)
const Component = ({ items }) => {
  const sortedItems = items.sort((a, b) => a.price - b.price);
  return <List items={sortedItems} />;
};

// Después (CORRECTO - cálculo solo cuando items cambia)
const Component = ({ items }) => {
  const sortedItems = useMemo(
    () => items.sort((a, b) => a.price - b.price),
    [items]
  );
  return <List items={sortedItems} />;
};
```

**useEffect con dependencias específicas:**

```typescript
// Antes (INCORRECTO - dependencias amplias)
useEffect(() => {
  fetchData(config.url);
}, [config]); // Re-ejecuta si CUALQUIER propiedad de config cambia

// Después (CORRECTO - dependencias específicas)
useEffect(() => {
  fetchData(config.url);
}, [config.url]); // Solo re-ejecuta si config.url cambia
```

### 5. Bundle Analysis Script (Requirement 1)

**Ubicación:** `scripts/analyze-bundle.ts`

**Implementación:**

```typescript
// scripts/analyze-bundle.ts

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface BundleStats {
  totalSize: number;
  lucideReactSize: number;
  otherPackagesSize: number;
}

function analyzeBundleSize(): BundleStats {
  // Ejecutar build con análisis
  console.log('Building application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Leer stats del build
  const statsPath = path.join(process.cwd(), '.next', 'analyze', 'client.json');
  
  if (!fs.existsSync(statsPath)) {
    throw new Error('Bundle stats not found. Run build first.');
  }
  
  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
  
  // Calcular tamaños
  let totalSize = 0;
  let lucideReactSize = 0;
  
  for (const module of stats.modules) {
    totalSize += module.size;
    
    if (module.name.includes('lucide-react')) {
      lucideReactSize += module.size;
    }
  }
  
  return {
    totalSize,
    lucideReactSize,
    otherPackagesSize: totalSize - lucideReactSize,
  };
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

// Ejecutar análisis
const stats = analyzeBundleSize();

console.log('\n📊 Bundle Analysis Results:');
console.log('─────────────────────────────');
console.log(`Total Size: ${formatBytes(stats.totalSize)}`);
console.log(`lucide-react: ${formatBytes(stats.lucideReactSize)}`);
console.log(`Other Packages: ${formatBytes(stats.otherPackagesSize)}`);
console.log('─────────────────────────────');

// Verificar que lucide-react es menor a 50KB
if (stats.lucideReactSize > 50 * 1024) {
  console.error(`❌ lucide-react size (${formatBytes(stats.lucideReactSize)}) exceeds 50KB limit`);
  process.exit(1);
} else {
  console.log(`✅ lucide-react size (${formatBytes(stats.lucideReactSize)}) is within 50KB limit`);
}
```

## Data Models

### Storage Data Model

```typescript
// Datos almacenados en localStorage/memoria

interface StoredData {
  key: string;
  value: string;
  timestamp: number;
}

// Ejemplo de uso
const terminalConfig: StoredData = {
  key: 'terminal_config',
  value: JSON.stringify({ id: 'T001', name: 'Caja 1' }),
  timestamp: Date.now(),
};
```

### SWR Cache Model

```typescript
// Estructura interna de caché de SWR

interface SWRCacheEntry<T> {
  data: T;
  error?: Error;
  isValidating: boolean;
  timestamp: number;
}

// Ejemplo de entrada en caché
const cacheEntry: SWRCacheEntry<Product[]> = {
  data: [{ id: 1, name: 'Pollo a la Brasa' }],
  error: undefined,
  isValidating: false,
  timestamp: Date.now(),
};
```

### Bundle Analysis Model

```typescript
// Resultado del análisis de bundle

interface BundleAnalysis {
  totalSize: number;        // Tamaño total en bytes
  lucideReactSize: number;  // Tamaño de lucide-react en bytes
  reduction: number;        // Reducción en bytes vs baseline
  reductionPercent: number; // Reducción en porcentaje
  meetsTarget: boolean;     // Si cumple el objetivo de 50KB
}

// Ejemplo
const analysis: BundleAnalysis = {
  totalSize: 2200000,      // 2.2MB
  lucideReactSize: 45000,  // 45KB
  reduction: 305000,       // 305KB reducidos
  reductionPercent: 12.2,  // 12.2% reducción
  meetsTarget: true,       // 45KB < 50KB ✅
};
```

### Performance Metrics Model

```typescript
// Métricas de rendimiento

interface PerformanceMetrics {
  // Bundle metrics
  bundleSize: number;
  bundleSizeReduction: number;
  
  // Request metrics
  totalRequests: number;
  duplicateRequests: number;
  duplicatePercent: number;
  
  // Storage metrics
  storageErrors: number;
  fallbackUsage: number;
  
  // TTFB metrics
  ttfbBefore: number;
  ttfbAfter: number;
  ttfbImprovement: number;
  
  // Re-render metrics
  rerendersBefore: number;
  rerendersAfter: number;
  rerendersReduction: number;
}

// Ejemplo
const metrics: PerformanceMetrics = {
  bundleSize: 2200000,
  bundleSizeReduction: 300000,
  totalRequests: 100,
  duplicateRequests: 10,
  duplicatePercent: 10,
  storageErrors: 0,
  fallbackUsage: 5,
  ttfbBefore: 800,
  ttfbAfter: 500,
  ttfbImprovement: 300,
  rerendersBefore: 100,
  rerendersAfter: 50,
  rerendersReduction: 50,
};
```


## Correctness Properties

*Una property es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas de un sistema - esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las properties sirven como puente entre especificaciones legibles por humanos y garantías de corrección verificables por máquinas.*

### Property Reflection

Antes de definir las properties, analicemos las redundancias identificadas en el prework:

**Redundancias Identificadas:**

1. **Request Deduplication (2.1, 2.4, 2.5):**
   - 2.1 verifica que múltiples componentes hacen solo 1 request
   - 2.4 verifica que SWR implementa revalidación automática
   - 2.5 verifica que SWR usa stale-while-revalidate
   - **Consolidación:** Combinar en una property comprehensiva que verifique el comportamiento completo de SWR (deduplicación + revalidación + stale-while-revalidate)

2. **localStorage Error Handling (3.1, 3.4, 3.7):**
   - 3.1 verifica que todos los accesos usan try-catch
   - 3.4 verifica que los errores se loggean sin crashear
   - 3.7 verifica que el sistema continúa operando con fallback
   - **Consolidación:** Combinar en una property que verifique el manejo completo de errores (try-catch + logging + fallback + no crash)

3. **React Performance Hooks (5.3, 5.4, 5.6):**
   - 5.3 verifica que callbacks usan useCallback
   - 5.4 verifica que cálculos costosos usan useMemo
   - 5.6 verifica que useEffect tiene dependencias mínimas
   - **Consolidación:** Mantener separadas porque cada una valida un hook diferente con propósito específico

**Properties Finales (después de consolidación):**

- Property 1: SWR Request Deduplication and Revalidation (consolida 2.1, 2.4, 2.5)
- Property 2: localStorage Safe Access with Fallback (consolida 3.1, 3.4, 3.7)
- Property 3: localStorage Fallback Consistency (3.2)
- Property 4: Server Components Parallel Execution (4.1, 4.3)
- Property 5: useCallback Stability (5.3)
- Property 6: useMemo Computation Caching (5.4)
- Property 7: useEffect Minimal Dependencies (5.6)

### Properties

**Property 1: SWR Request Deduplication and Revalidation**

*Para cualquier* conjunto de componentes que solicitan los mismos datos simultáneamente, el sistema debe hacer exactamente 1 request HTTP, implementar revalidación automática cuando los datos se vuelven stale, y mostrar datos stale mientras se revalidan (stale-while-revalidate pattern).

**Validates: Requirements 2.1, 2.4, 2.5**

**Rationale:** Esta property combina tres aspectos del comportamiento de SWR que están intrínsecamente relacionados. La deduplicación, revalidación y stale-while-revalidate son parte del mismo mecanismo de SWR y deben verificarse juntos para garantizar el comportamiento correcto completo.

---

**Property 2: localStorage Safe Access with Fallback**

*Para cualquier* operación de localStorage (get, set, remove, clear), el sistema debe usar try-catch para capturar errores, loggear el error sin crashear la aplicación, y usar fallback en memoria cuando localStorage no está disponible o falla.

**Validates: Requirements 3.1, 3.4, 3.7**

**Rationale:** Esta property consolida el manejo completo de errores de localStorage. El try-catch, logging y fallback son parte de la misma estrategia de resiliencia y deben verificarse juntos.

---

**Property 3: localStorage Fallback Consistency**

*Para cualquier* secuencia de operaciones (set → get → remove), cuando localStorage no está disponible, el fallback en memoria debe mantener consistencia: un valor almacenado debe ser recuperable hasta que se elimine.

**Validates: Requirements 3.2**

**Rationale:** Esta property verifica que el fallback en memoria funciona correctamente como reemplazo de localStorage, manteniendo la semántica esperada de un storage persistente.

---

**Property 4: Server Components Parallel Execution**

*Para cualquier* Server Component que carga múltiples recursos, los requests deben ejecutarse en paralelo usando Promise.all, y los datos deben ser compartidos entre componentes usando React.cache para evitar requests duplicados.

**Validates: Requirements 4.1, 4.3**

**Rationale:** Esta property combina paralelización y compartición de datos porque ambos son parte de la misma estrategia de optimización de Server Components.

---

**Property 5: useCallback Stability**

*Para cualquier* función pasada como prop a un componente hijo, si la función no depende de valores que cambian, debe ser envuelta en useCallback con dependencias vacías para mantener referencia estable y evitar re-renders innecesarios del hijo.

**Validates: Requirements 5.3**

**Rationale:** Esta property verifica que las funciones estables usan useCallback correctamente para optimizar re-renders.

---

**Property 6: useMemo Computation Caching**

*Para cualquier* cálculo costoso (operaciones O(n log n) o superiores, como sort, filter, map encadenados), el resultado debe ser cacheado usando useMemo con dependencias específicas para evitar recalcular en cada render.

**Validates: Requirements 5.4**

**Rationale:** Esta property verifica que los cálculos costosos se cachean apropiadamente para mejorar performance.

---

**Property 7: useEffect Minimal Dependencies**

*Para cualquier* useEffect, el array de dependencias debe contener solo las variables que realmente se usan dentro del efecto, sin incluir objetos completos cuando solo se necesitan propiedades específicas.

**Validates: Requirements 5.6**

**Rationale:** Esta property verifica que los efectos tienen dependencias mínimas para evitar ejecuciones innecesarias.

## Error Handling

### 1. localStorage Errors

**Escenarios de Error:**
- localStorage no disponible (modo incógnito)
- QuotaExceededError (storage lleno)
- SecurityError (acceso bloqueado)
- Cualquier otro error de localStorage

**Estrategia:**
```typescript
try {
  localStorage.setItem(key, value);
} catch (error) {
  // 1. Loggear error con contexto
  console.error(`localStorage error for key ${key}:`, error);
  
  // 2. Usar fallback en memoria
  memoryFallback.set(key, value);
  
  // 3. NO crashear - continuar operación
  return false; // Indicar que falló pero no crashear
}
```

### 2. SWR Errors

**Escenarios de Error:**
- Network error (sin conexión)
- HTTP error (404, 500, etc.)
- Timeout
- JSON parse error

**Estrategia:**
```typescript
const { data, error, isLoading } = useSWR('/api/data', fetcher, {
  // Retry automático
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  
  // Fallback a datos stale
  fallbackData: cachedData,
  
  // Error handler
  onError: (error) => {
    console.error('SWR error:', error);
    // Mostrar toast de error al usuario
    showErrorToast('Error loading data');
  },
});

// En el componente
if (error) {
  return <ErrorMessage error={error} />;
}
```

### 3. Server Component Errors

**Escenarios de Error:**
- Fetch error en Server Component
- Timeout en Promise.all
- Error en React.cache

**Estrategia:**
```typescript
export default async function Page() {
  try {
    const [data1, data2, data3] = await Promise.all([
      getData1(),
      getData2(),
      getData3(),
    ]);
    
    return <Content data1={data1} data2={data2} data3={data3} />;
  } catch (error) {
    console.error('Server Component error:', error);
    
    // Mostrar error boundary
    return <ErrorBoundary error={error} />;
  }
}
```

### 4. Build Errors

**Escenarios de Error:**
- Bundle size excede límite
- Tree-shaking no funciona
- Import incorrecto

**Estrategia:**
```typescript
// En scripts/analyze-bundle.ts
if (stats.lucideReactSize > 50 * 1024) {
  console.error(`❌ lucide-react size exceeds 50KB limit`);
  console.error(`Current: ${formatBytes(stats.lucideReactSize)}`);
  console.error(`Limit: 50KB`);
  console.error('\nPossible causes:');
  console.error('- Barrel imports instead of named imports');
  console.error('- Missing optimizePackageImports in next.config.js');
  process.exit(1);
}
```

## Testing Strategy

### Dual Testing Approach

Este spec requiere tanto unit tests como property-based tests para cobertura completa:

**Unit Tests:** Verifican ejemplos específicos, edge cases y configuración
**Property Tests:** Verifican properties universales a través de múltiples inputs generados

### Unit Testing

**Casos específicos a testear:**

1. **Bundle Analysis (Requirement 1)**
   - Verificar que next.config.js tiene optimizePackageImports
   - Verificar que bundle size de lucide-react < 50KB
   - Verificar reducción de 300KB vs baseline

2. **SWR Configuration (Requirement 2)**
   - Verificar que SWRConfig está configurado correctamente
   - Verificar que dedupingInterval = 2000ms
   - Verificar que fetcher global está definido

3. **localStorage Utility (Requirement 3)**
   - Verificar que safeStorage.isAvailable() detecta modo incógnito
   - Verificar que fallback en memoria funciona cuando localStorage falla
   - Verificar que no hay crashes en modo incógnito

4. **Server Components (Requirement 4)**
   - Verificar que páginas admin usan Promise.all
   - Verificar que React.cache está implementado
   - Verificar reducción de TTFB de 800ms a 500ms

5. **React Hooks (Requirement 5)**
   - Verificar que componentes costosos usan React.memo
   - Verificar que callbacks usan useCallback
   - Verificar que cálculos costosos usan useMemo

### Property-Based Testing

**Configuración:** Mínimo 100 iteraciones por test

**Properties a testear:**

1. **Property 1: SWR Request Deduplication and Revalidation**
   ```typescript
   // Feature: performance-optimization-vercel-best-practices, Property 1
   // Para cualquier conjunto de componentes que solicitan los mismos datos,
   // debe hacer exactamente 1 request HTTP
   
   test('SWR deduplicates requests for same data', async () => {
     fc.assert(
       fc.asyncProperty(
         fc.array(fc.string(), { minLength: 2, maxLength: 10 }), // URLs
         fc.integer({ min: 2, max: 5 }), // Número de componentes
         async (urls, componentCount) => {
           // Generar componentes que solicitan las mismas URLs
           const components = Array(componentCount).fill(null).map(() => 
             urls.map(url => useSWR(url))
           );
           
           // Contar requests reales
           const requestCount = countRequests();
           
           // Debe hacer solo 1 request por URL única
           expect(requestCount).toBe(new Set(urls).size);
         }
       ),
       { numRuns: 100 }
     );
   });
   ```

2. **Property 2: localStorage Safe Access with Fallback**
   ```typescript
   // Feature: performance-optimization-vercel-best-practices, Property 2
   // Para cualquier operación de localStorage, debe usar try-catch y fallback
   
   test('safeStorage handles all errors without crashing', () => {
     fc.assert(
       fc.property(
         fc.string(), // key
         fc.string(), // value
         fc.oneof(
           fc.constant('QuotaExceededError'),
           fc.constant('SecurityError'),
           fc.constant('NotAvailableError')
         ), // error type
         (key, value, errorType) => {
           // Simular error de localStorage
           mockLocalStorageError(errorType);
           
           // Operación no debe crashear
           expect(() => {
             safeStorage.setItem(key, value);
             const retrieved = safeStorage.getItem(key);
             expect(retrieved).toBe(value); // Fallback funciona
           }).not.toThrow();
         }
       ),
       { numRuns: 100 }
     );
   });
   ```

3. **Property 3: localStorage Fallback Consistency**
   ```typescript
   // Feature: performance-optimization-vercel-best-practices, Property 3
   // Para cualquier secuencia de operaciones, fallback mantiene consistencia
   
   test('memory fallback maintains storage semantics', () => {
     fc.assert(
       fc.property(
         fc.array(
           fc.record({
             operation: fc.oneof(
               fc.constant('set'),
               fc.constant('get'),
               fc.constant('remove')
             ),
             key: fc.string(),
             value: fc.string(),
           }),
           { minLength: 1, maxLength: 20 }
         ),
         (operations) => {
           // Deshabilitar localStorage
           mockLocalStorageUnavailable();
           
           const expected = new Map();
           
           for (const op of operations) {
             if (op.operation === 'set') {
               safeStorage.setItem(op.key, op.value);
               expected.set(op.key, op.value);
             } else if (op.operation === 'get') {
               const value = safeStorage.getItem(op.key);
               expect(value).toBe(expected.get(op.key) ?? null);
             } else if (op.operation === 'remove') {
               safeStorage.removeItem(op.key);
               expected.delete(op.key);
             }
           }
         }
       ),
       { numRuns: 100 }
     );
   });
   ```

4. **Property 4: Server Components Parallel Execution**
   ```typescript
   // Feature: performance-optimization-vercel-best-practices, Property 4
   // Para cualquier Server Component, requests deben ser paralelos
   
   test('Server Components execute requests in parallel', async () => {
     fc.assert(
       fc.asyncProperty(
         fc.array(fc.integer({ min: 100, max: 500 }), { minLength: 2, maxLength: 5 }),
         async (delays) => {
           // Crear funciones con delays diferentes
           const fetchers = delays.map(delay => 
             cache(async () => {
               await sleep(delay);
               return delay;
             })
           );
           
           // Ejecutar en paralelo
           const start = Date.now();
           await Promise.all(fetchers.map(f => f()));
           const elapsed = Date.now() - start;
           
           // Tiempo debe ser ~max(delays), no sum(delays)
           const maxDelay = Math.max(...delays);
           expect(elapsed).toBeLessThan(maxDelay + 100); // +100ms margen
           expect(elapsed).toBeGreaterThan(maxDelay - 50); // -50ms margen
         }
       ),
       { numRuns: 100 }
     );
   });
   ```

5. **Property 5: useCallback Stability**
   ```typescript
   // Feature: performance-optimization-vercel-best-practices, Property 5
   // Para cualquier función estable, useCallback mantiene referencia
   
   test('useCallback maintains stable reference', () => {
     fc.assert(
       fc.property(
         fc.integer({ min: 1, max: 10 }), // número de renders
         (renderCount) => {
           const refs = [];
           
           for (let i = 0; i < renderCount; i++) {
             const callback = useCallback(() => {}, []);
             refs.push(callback);
           }
           
           // Todas las referencias deben ser iguales
           const firstRef = refs[0];
           refs.forEach(ref => {
             expect(ref).toBe(firstRef);
           });
         }
       ),
       { numRuns: 100 }
     );
   });
   ```

6. **Property 6: useMemo Computation Caching**
   ```typescript
   // Feature: performance-optimization-vercel-best-practices, Property 6
   // Para cualquier cálculo costoso, useMemo cachea el resultado
   
   test('useMemo caches expensive computations', () => {
     fc.assert(
       fc.property(
         fc.array(fc.integer(), { minLength: 100, maxLength: 1000 }),
         fc.integer({ min: 1, max: 5 }), // número de renders
         (data, renderCount) => {
           let computationCount = 0;
           
           for (let i = 0; i < renderCount; i++) {
             const sorted = useMemo(() => {
               computationCount++;
               return [...data].sort((a, b) => a - b);
             }, [data]);
           }
           
           // Debe computar solo 1 vez si data no cambia
           expect(computationCount).toBe(1);
         }
       ),
       { numRuns: 100 }
     );
   });
   ```

7. **Property 7: useEffect Minimal Dependencies**
   ```typescript
   // Feature: performance-optimization-vercel-best-practices, Property 7
   // Para cualquier useEffect, dependencias deben ser mínimas
   
   test('useEffect has minimal dependencies', () => {
     fc.assert(
       fc.property(
         fc.record({
           url: fc.string(),
           method: fc.string(),
           headers: fc.dictionary(fc.string(), fc.string()),
         }),
         (config) => {
           let effectCount = 0;
           
           // Mal: depende de todo el objeto config
           useEffect(() => {
             effectCount++;
             fetch(config.url);
           }, [config]); // Se ejecuta si CUALQUIER propiedad cambia
           
           // Cambiar solo headers (no debería re-ejecutar)
           config.headers = { ...config.headers, 'X-New': 'value' };
           
           // Bien: depende solo de config.url
           useEffect(() => {
             fetch(config.url);
           }, [config.url]); // Solo se ejecuta si url cambia
           
           // Verificar que el segundo enfoque es más eficiente
           expect(effectCount).toBe(1); // Solo 1 ejecución
         }
       ),
       { numRuns: 100 }
     );
   });
   ```

### Testing Tools

**Librería de Property-Based Testing:** fast-check (JavaScript/TypeScript)

**Instalación:**
```bash
npm install --save-dev fast-check @types/fast-check
```

**Configuración en package.json:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:property": "vitest --grep 'Property [0-9]'",
    "test:unit": "vitest --grep -v 'Property [0-9]'"
  }
}
```

### Verification Scripts

**1. Bundle Analysis Script:**
```bash
npm run build
node scripts/analyze-bundle.ts
```

**2. Request Deduplication Test:**
```bash
npm run test:property -- swr-deduplication
```

**3. localStorage Safety Test:**
```bash
npm run test:property -- safe-storage
```

**4. Performance Metrics:**
```bash
npm run test -- performance-metrics
```

### Success Criteria

Todos los tests deben pasar antes de considerar cada fase completa:

**Fase 1:**
- ✅ Bundle size de lucide-react < 50KB
- ✅ safeStorage tests passing (100%)
- ✅ SWR configuration tests passing (100%)

**Fase 2:**
- ✅ Request deduplication > 75%
- ✅ TTFB reduction > 300ms
- ✅ useEffect optimization tests passing (100%)

**Fase 3:**
- ✅ All property tests passing (100%)
- ✅ All unit tests passing (100%)
- ✅ Performance metrics meet targets

## Migration Strategy

### Gradual Migration by Phases

**Fase 1 (Esta Semana - 5 horas):**

1. **Verificar tree-shaking de lucide-react (1h)**
   - Ejecutar `npm run build`
   - Ejecutar `scripts/analyze-bundle.ts`
   - Verificar que bundle size < 50KB
   - Si falla: buscar barrel imports y reemplazar con named imports

2. **Crear utilidad de localStorage (2h)**
   - Crear `src/lib/storage.ts` con SafeStorage class
   - Escribir unit tests para safeStorage
   - Escribir property tests para error handling
   - Verificar que tests pasan (100%)

3. **Instalar y configurar SWR (2h)**
   - `npm install swr`
   - Crear `src/lib/swr-config.ts`
   - Configurar SWRConfig en _app.tsx
   - Escribir tests de configuración
   - Verificar que tests pasan (100%)

**Fase 2 (Próxima Semana - 9 horas):**

4. **Migrar 5 componentes principales a SWR (4h)**
   - Identificar los 5 componentes con más requests duplicados
   - Migrar de useEffect + fetch a useSWR
   - Escribir tests para cada componente migrado
   - Medir reducción de requests duplicados
   - Target: > 75% reducción

5. **Auditar waterfalls en admin pages (3h)**
   - Identificar las 5 páginas admin más usadas
   - Convertir requests secuenciales a Promise.all
   - Implementar React.cache para compartir datos
   - Medir TTFB antes y después
   - Target: 800ms → 500ms (-37%)

6. **Optimizar dependencias de useEffect (2h)**
   - Auditar todos los useEffect en componentes principales
   - Reemplazar dependencias amplias con específicas
   - Escribir tests para verificar optimización
   - Medir reducción de re-renders
   - Target: > 50% reducción

**Fase 3 (Mes 1 - 14 horas):**

7. **Migrar resto de componentes a SWR (6h)**
   - Identificar todos los componentes restantes con fetch directo
   - Migrar a useSWR
   - Escribir tests para cada componente
   - Verificar que requests duplicados < 10%

8. **Implementar React.cache en RSC (4h)**
   - Identificar todos los Server Components con múltiples fetches
   - Implementar React.cache para cada fetch
   - Usar Promise.all para paralelización
   - Medir mejora de TTFB en todas las páginas

9. **Auditoría completa de re-renders (4h)**
   - Usar React DevTools Profiler
   - Identificar componentes con re-renders excesivos
   - Aplicar React.memo, useCallback, useMemo según corresponda
   - Medir reducción total de re-renders
   - Target: > 50% reducción

### Rollback Strategy

Cada fase es independiente y puede revertirse sin afectar las otras:

**Fase 1 Rollback:**
- Revertir cambios en `src/lib/storage.ts`
- Revertir cambios en `src/lib/swr-config.ts`
- Revertir cambios en `_app.tsx`

**Fase 2 Rollback:**
- Revertir migraciones de componentes a SWR
- Revertir cambios en Server Components
- Revertir optimizaciones de useEffect

**Fase 3 Rollback:**
- Revertir migraciones restantes
- Revertir implementaciones de React.cache
- Revertir optimizaciones de re-renders

### Deployment Strategy

**Cada fase se deploya independientemente:**

1. **Fase 1:** Deploy después de verificar tests (100% passing)
2. **Fase 2:** Deploy después de verificar métricas (> 75% reducción requests, > 300ms reducción TTFB)
3. **Fase 3:** Deploy después de auditoría completa (todas las métricas cumplen targets)

**Monitoring post-deployment:**
- Bundle size en Vercel Analytics
- Request count en Network tab
- TTFB en Vercel Speed Insights
- Re-renders en React DevTools Profiler

## References

- Auditoría completa: `AUDITORIA_ARQUITECTONICA_VERCEL_BEST_PRACTICES_13_FEB_2026.md`
- Resumen ejecutivo: `RESUMEN_EJECUTIVO_AUDITORIA_13_FEB_2026.md`
- Vercel Best Practices: https://vercel.com/docs/concepts/next.js/overview
- SWR Documentation: https://swr.vercel.app/
- React Performance: https://react.dev/learn/render-and-commit
- fast-check Documentation: https://fast-check.dev/
