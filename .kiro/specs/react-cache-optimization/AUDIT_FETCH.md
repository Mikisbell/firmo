# Auditoría de uso de fetch() en Admin Panel

**Fecha:** 13 Febrero 2026  
**Objetivo:** Identificar oportunidades para usar `cachedFetch()` y optimizar requests HTTP

---

## Resumen Ejecutivo

**Total de archivos con fetch():** 24 archivos  
**Total de llamadas fetch():** 60+ llamadas  
**Oportunidades de optimización:** 15-20 llamadas (25-33%)

**Prioridad de migración:**
- 🔴 Alta: 8 archivos (datos que se consultan frecuentemente)
- 🟡 Media: 10 archivos (datos consultados ocasionalmente)
- 🟢 Baja: 6 archivos (mutaciones POST/PUT/DELETE)

---

## Categorización de Requests

### 🔴 ALTA PRIORIDAD - Migrar a cachedFetch()

Estos endpoints se consultan frecuentemente y se beneficiarían significativamente del caché:

#### 1. **Dashboard de Tenant** (`src/app/admin/tenant/dashboard/page.tsx`)
```typescript
// 4 requests en paralelo - EXCELENTE candidato para caché
const [configRes, metricsRes, healthRes, activityRes] = await Promise.allSettled([
  fetch('/api/tenant/configuration'),        // ← cachedFetch con TTL 30s
  fetch('/api/admin/tenants/current/metrics'), // ← cachedFetch con TTL 10s
  fetch('/api/admin/tenants/current/health'),  // ← cachedFetch con TTL 5s
  fetch('/api/admin/tenants/current/activity?limit=10'), // ← cachedFetch con TTL 5s
]);
```
**Impacto:** ALTO - Se carga frecuentemente, 4 requests simultáneos  
**TTL recomendado:** 5-30s según endpoint  
**Beneficio:** Reducción de 4 requests a 0-1 en navegación repetida

#### 2. **Delivery Page** (`src/app/admin/delivery/page.tsx`)
```typescript
// 2 requests en paralelo
const [deliveriesRes, driversRes] = await Promise.all([
  fetch('/api/delivery'),           // ← cachedFetch con TTL 5s
  fetch('/api/drivers/available'),  // ← cachedFetch con TTL 10s
]);
```
**Impacto:** ALTO - Página de alta frecuencia  
**TTL recomendado:** 5-10s  
**Beneficio:** Reducción de 2 requests en refreshes

#### 3. **Delivery Historial** (`src/app/admin/delivery/historial/page.tsx`)
```typescript
fetch(`/api/admin/delivery/history?${params}`); // ← cachedFetch con TTL 30s
fetch('/api/drivers');                          // ← cachedFetch con TTL 60s
```
**Impacto:** MEDIO - Datos históricos cambian poco  
**TTL recomendado:** 30-60s  
**Beneficio:** Excelente para paginación

#### 4. **Delivery Metrics** (`src/app/admin/delivery/components/MetricsSummary.tsx`)
```typescript
fetch('/api/admin/delivery/metrics'); // ← cachedFetch con TTL 10s
```
**Impacto:** ALTO - Componente visible en múltiples páginas  
**TTL recomendado:** 10s  
**Beneficio:** Reducción significativa en navegación

#### 5. **Drivers Page** (`src/app/admin/drivers/page.tsx`)
```typescript
fetch('/api/drivers'); // ← cachedFetch con TTL 10s
```
**Impacto:** MEDIO - Lista de drivers consultada frecuentemente  
**TTL recomendado:** 10s  
**Beneficio:** Caché útil para navegación repetida

#### 6. **Mesas/Zones** (`src/app/admin/mesas/page.tsx`)
```typescript
fetch('/api/admin/zones'); // ← cachedFetch con TTL 60s
```
**Impacto:** MEDIO - Datos de zonas cambian raramente  
**TTL recomendado:** 60s  
**Beneficio:** Datos casi estáticos, excelente para caché

#### 7. **Cross-Tenant Dashboard** (`src/app/admin/cross-tenant/dashboard/page.tsx`)
```typescript
const [tenantsRes, adminsRes, auditRes] = await Promise.allSettled([
  fetch('/api/admin/cross-tenant/tenants'), // ← cachedFetch con TTL 30s
  // ... más requests
]);
```
**Impacto:** MEDIO - Dashboard administrativo  
**TTL recomendado:** 30s  
**Beneficio:** Reducción de múltiples requests

#### 8. **Alert Configurations** (`src/app/admin/alerts/components/AlertConfigList.tsx`)
```typescript
fetch('/api/admin/alerts/configurations'); // ← cachedFetch con TTL 30s
```
**Impacto:** MEDIO - Configuraciones cambian raramente  
**TTL recomendado:** 30s  
**Beneficio:** Datos casi estáticos

---

### 🟡 MEDIA PRIORIDAD - Considerar cachedFetch()

Estos endpoints se consultan ocasionalmente:

#### 9. **Estaciones Page** (`src/app/admin/estaciones/page.tsx`)
- Ya usa `useMemo` para cálculos derivados ✅
- No tiene fetch() directo (probablemente usa SWR o props)

#### 10. **Security Page** (`src/app/admin/security/page.tsx`)
- Ya usa `useMemo` para filtrar sesiones activas ✅
- Mutaciones (block device, revoke session) - NO cachear

#### 11. **Productos Components**
- `CSVImportExport.tsx`: Export/template endpoints - cachedFetch con TTL 60s
- `BulkActionsToolbar.tsx`: Mutaciones - NO cachear

---

### 🟢 BAJA PRIORIDAD - NO migrar (Mutaciones)

Estos son POST/PUT/DELETE que NO deben cachearse:

1. **Notificaciones** - POST test notification
2. **Delivery** - PATCH assign driver
3. **Mesas** - POST/PUT/DELETE tables
4. **Terminales** - POST create terminal
5. **Tenant Provisioning** - POST provision tenant
6. **Security** - POST block device, revoke session
7. **Promociones** - POST/PUT/DELETE promotions
8. **Productos** - POST/PUT/DELETE products, images
9. **Drivers** - POST/PATCH drivers
10. **Empleados** - POST/PUT/DELETE employees
11. **Estaciones** - POST/PUT/DELETE stations
12. **Alerts** - PATCH toggle enabled

**Nota:** Después de mutaciones, usar `invalidateCachedFetch()` para limpiar caché relacionado.

---

## Patrón de Implementación

### Antes (sin caché)
```typescript
const res = await fetch('/api/delivery');
if (res.ok) {
  const data = await res.json();
  setDeliveries(data);
}
```

### Después (con caché)
```typescript
import { cachedFetch } from '@/lib/fetch-cache';

const data = await cachedFetch<Delivery[]>(
  '/api/delivery',
  { method: 'GET' },
  5000 // 5s TTL
);
setDeliveries(data);
```

### Después de Mutación
```typescript
import { cachedFetch, invalidateCachedFetch } from '@/lib/fetch-cache';

// Crear nuevo delivery
await fetch('/api/delivery', {
  method: 'POST',
  body: JSON.stringify(newDelivery)
});

// Invalidar caché para forzar refresh
invalidateCachedFetch('/api/delivery', { method: 'GET' });

// Próximo fetch obtendrá datos frescos
const updated = await cachedFetch<Delivery[]>('/api/delivery');
```

---

## Métricas de Impacto Estimadas

### Por Página

| Página | Requests Actuales | Con Caché | Reducción |
|--------|-------------------|-----------|-----------|
| Tenant Dashboard | 4 | 0-1 | 75-100% |
| Delivery | 2 | 0-1 | 50-100% |
| Delivery Historial | 2 | 0-1 | 50-100% |
| Cross-Tenant | 3+ | 0-1 | 67-100% |
| Drivers | 1 | 0-1 | 0-100% |
| Mesas | 1 | 0-1 | 0-100% |

### Global

- **Requests totales:** ~60 fetch() calls
- **Candidatos para caché:** ~20 calls (33%)
- **Reducción estimada:** 30-50% en requests duplicados
- **Mejora en tiempo de carga:** 20-40% en navegación repetida

---

## Plan de Migración

### Fase 1: High-Impact Pages (2-3 horas)
1. Tenant Dashboard (4 requests)
2. Delivery Page (2 requests)
3. Delivery Metrics (1 request)

**Impacto:** 7 requests optimizados, ~40% del total

### Fase 2: Medium-Impact Pages (2-3 horas)
4. Delivery Historial (2 requests)
5. Drivers Page (1 request)
6. Mesas/Zones (1 request)
7. Cross-Tenant Dashboard (3+ requests)
8. Alert Configurations (1 request)

**Impacto:** 8+ requests optimizados, ~50% del total

### Fase 3: Low-Impact Pages (1-2 horas)
9. CSV Export/Template endpoints
10. Otros endpoints de baja frecuencia

**Impacto:** 5+ requests optimizados, ~60% del total

---

## Consideraciones Técnicas

### TTL Recomendados por Tipo de Dato

| Tipo de Dato | TTL | Razón |
|--------------|-----|-------|
| Configuración | 60s | Cambia raramente |
| Catálogos (zones, drivers) | 30-60s | Datos casi estáticos |
| Métricas/Stats | 10-30s | Actualizaciones moderadas |
| Listas activas (deliveries) | 5-10s | Datos dinámicos |
| Real-time (monitoring) | 2-5s | Requiere frescura |

### Invalidación de Caché

Después de mutaciones, invalidar caché relacionado:

```typescript
// Después de crear delivery
invalidateCachedFetch('/api/delivery');
invalidateCachedFetch('/api/admin/delivery/metrics');

// Después de asignar driver
invalidateCachedFetch('/api/delivery');
invalidateCachedFetch('/api/drivers/available');

// Después de crear empleado
invalidateCachedFetch('/api/admin/employees');
```

---

## Próximos Pasos

1. ✅ Auditoría completada
2. ⏳ Crear AUDIT_MEMO.md (auditoría de useMemo)
3. ⏳ Crear AUDIT_SWR.md (auditoría de useSWR)
4. ⏳ Priorizar páginas para migración
5. ⏳ Implementar migraciones por fase

---

**Última actualización:** 13 Febrero 2026  
**Autor:** Kiro AI  
**Estado:** ✅ COMPLETADO
