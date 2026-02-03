# Phase 1 Priority Matrix - Auditoría de Selectores

> **Fecha:** 3 Febrero 2026  
> **Objetivo:** Priorizar componentes para agregar data-testid + accesibilidad  
> **Tiempo Total:** 2-3 horas

---

## 📊 Matriz de Prioridades

| Prioridad | Componente | Razón Técnica | Impacto | Tiempo |
|-----------|-----------|---------------|--------|--------|
| 🔴 CRÍTICA | `DataTable.tsx` | Raíz de toda administración | 58 tests | 45 min |
| 🔴 CRÍTICA | `promociones/page.tsx` | Mayor riesgo de race condition | 16 tests | 30 min |
| 🟡 ALTA | `productos/page.tsx` | Frecuencia de cambios | 32 tests | 30 min |
| 🟡 ALTA | `empleados/page.tsx` | Frecuencia de cambios | 28 tests | 30 min |
| 🟡 MEDIA | `drivers/page.tsx` | Menor frecuencia de cambios | 28 tests | 30 min |

---

## 🔴 CRÍTICA: DataTable.tsx

### Por Qué Es Crítica

```
DataTable.tsx es el componente raíz de TODA la administración:
├─ Promotions page → usa DataTable
├─ Products page → usa DataTable
├─ Employees page → usa DataTable
└─ Drivers page → usa DataTable

Si DataTable falla → 58 tests fallan
```

### Qué Necesita

```typescript
// ❌ Antes
<table className="w-full">
  <thead>
    <tr>
      <th>Nombre</th>
      <th>Acciones</th>
    </tr>
  </thead>
  <tbody>
    {data.map(item => (
      <tr key={item.id}>
        <td>{item.name}</td>
        <td>
          <button>Editar</button>
          <button>Eliminar</button>
        </td>
      </tr>
    ))}
  </tbody>
</table>

// ✅ Después
<table 
  className="w-full"
  data-testid="data-table"
  role="table"
>
  <thead>
    <tr role="row">
      <th role="columnheader">Nombre</th>
      <th role="columnheader">Acciones</th>
    </tr>
  </thead>
  <tbody>
    {data.map(item => (
      <tr key={item.id} data-testid={`row-${item.id}`} role="row">
        <td role="cell">{item.name}</td>
        <td role="cell">
          <button 
            aria-label={`Editar ${item.name}`}
            data-testid={`edit-${item.id}`}
          >
            Editar
          </button>
          <button 
            aria-label={`Eliminar ${item.name}`}
            data-testid={`delete-${item.id}`}
          >
            Eliminar
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### Cambios Requeridos

1. **Agregar roles ARIA:**
   - `role="table"` en `<table>`
   - `role="row"` en `<tr>`
   - `role="columnheader"` en `<th>`
   - `role="cell"` en `<td>`

2. **Agregar data-testid:**
   - `data-testid="data-table"` en tabla
   - `data-testid="row-{id}"` en filas
   - `data-testid="edit-{id}"` en botones
   - `data-testid="delete-{id}"` en botones

3. **Agregar aria-label:**
   - `aria-label="Editar {name}"` en botones
   - `aria-label="Eliminar {name}"` en botones

### Tiempo: 45 minutos

---

## 🔴 CRÍTICA: promociones/page.tsx

### Por Qué Es Crítica

```
Mayor riesgo de race condition:
1. Promoción expira a las 19:00
2. Cron ejecuta a las 19:05
3. Cliente ordena a las 19:02
4. Sistema aplica descuento (incorrecto)

Tests deben validar este escenario
```

### Qué Necesita

```typescript
// ❌ Antes
<Link href="/admin/promociones/nuevo" className="flex items-center gap-2 px-4 py-2.5 bg-amber-500...">
  <Plus className="w-4 h-4" />
  Nueva Promoción
</Link>

<button
  onClick={() => handleDelete(p.id)}
  className="p-1.5 hover:bg-red-500/10 text-red-400..."
>
  <Trash2 className="w-4 h-4" />
</button>

// ✅ Después
<Link 
  href="/admin/promociones/nuevo" 
  data-testid="create-promotion-btn"
  aria-label="Crear nueva promoción"
  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500..."
>
  <Plus className="w-4 h-4" />
  Nueva Promoción
</Link>

<button
  onClick={() => handleDelete(p.id)}
  data-testid={`delete-promotion-${p.id}`}
  aria-label={`Desactivar promoción ${p.name}`}
  className="p-1.5 hover:bg-red-500/10 text-red-400..."
>
  <Trash2 className="w-4 h-4" />
</button>
```

### Cambios Requeridos

1. **Agregar data-testid:**
   - `data-testid="create-promotion-btn"`
   - `data-testid="promotions-table"`
   - `data-testid="row-{id}"`
   - `data-testid="delete-promotion-{id}"`

2. **Agregar aria-label:**
   - `aria-label="Crear nueva promoción"`
   - `aria-label="Desactivar promoción {name}"`

3. **Agregar roles ARIA:**
   - `role="table"` en tabla
   - `role="row"` en filas

### Tiempo: 30 minutos

---

## 🟡 ALTA: productos/page.tsx

### Por Qué Es Alta

```
Frecuencia de cambios: ALTA
- Cambios de UI frecuentes
- Cambios de Tailwind classes
- Tests fallan si selectores cambian
```

### Cambios Requeridos

- Agregar `data-testid` a botones
- Agregar `aria-label` a botones
- Agregar roles ARIA a tabla

### Tiempo: 30 minutos

---

## 🟡 ALTA: empleados/page.tsx

### Por Qué Es Alta

```
Frecuencia de cambios: ALTA
- Cambios de UI frecuentes
- Cambios de Tailwind classes
- Tests fallan si selectores cambian
```

### Cambios Requeridos

- Agregar `data-testid` a botones
- Agregar `aria-label` a botones
- Agregar roles ARIA a tabla

### Tiempo: 30 minutos

---

## 🟡 MEDIA: drivers/page.tsx

### Por Qué Es Media

```
Frecuencia de cambios: BAJA
- Cambios de UI menos frecuentes
- Menos impacto en tests
- Pero aún importante para accesibilidad
```

### Cambios Requeridos

- Agregar `data-testid` a botones
- Agregar `aria-label` a botones
- Agregar roles ARIA a tabla

### Tiempo: 30 minutos

---

## 📋 Checklist de Implementación

### DataTable.tsx (45 min)

- [ ] Agregar `role="table"` a `<table>`
- [ ] Agregar `role="row"` a `<tr>`
- [ ] Agregar `role="columnheader"` a `<th>`
- [ ] Agregar `role="cell"` a `<td>`
- [ ] Agregar `data-testid="data-table"`
- [ ] Agregar `data-testid="row-{id}"` a filas
- [ ] Agregar `data-testid="edit-{id}"` a botones
- [ ] Agregar `data-testid="delete-{id}"` a botones
- [ ] Agregar `aria-label` a botones
- [ ] Validar con test de accesibilidad

### promociones/page.tsx (30 min)

- [ ] Agregar `data-testid="create-promotion-btn"`
- [ ] Agregar `data-testid="promotions-table"`
- [ ] Agregar `data-testid="row-{id}"`
- [ ] Agregar `data-testid="delete-promotion-{id}"`
- [ ] Agregar `aria-label` a botones
- [ ] Agregar roles ARIA a tabla
- [ ] Validar con test de accesibilidad

### productos/page.tsx (30 min)

- [ ] Agregar `data-testid` a botones
- [ ] Agregar `aria-label` a botones
- [ ] Agregar roles ARIA a tabla
- [ ] Validar con test de accesibilidad

### empleados/page.tsx (30 min)

- [ ] Agregar `data-testid` a botones
- [ ] Agregar `aria-label` a botones
- [ ] Agregar roles ARIA a tabla
- [ ] Validar con test de accesibilidad

### drivers/page.tsx (30 min)

- [ ] Agregar `data-testid` a botones
- [ ] Agregar `aria-label` a botones
- [ ] Agregar roles ARIA a tabla
- [ ] Validar con test de accesibilidad

---

## 🎯 Ejecución

### Hoy (2-3 horas)

```bash
# 1. DataTable.tsx (45 min)
# 2. promociones/page.tsx (30 min)
# 3. productos/page.tsx (30 min)
# 4. empleados/page.tsx (30 min)
# 5. drivers/page.tsx (30 min)
# Total: 2h 45min
```

### Validación

```bash
# Ejecutar tests después de cada cambio
npm run test:e2e -- e2e/07-admin-promotions-crud.spec.ts

# Validar accesibilidad
npm run test:e2e -- e2e/accessibility.spec.ts (crear)
```

---

## 📊 Impacto Esperado

### Antes
```
Tests: 58/58 ✅
Accesibilidad: ❌
Selectores frágiles: ✅
Overlays detectados: ❌
```

### Después
```
Tests: 58/58 ✅
Accesibilidad: ✅
Selectores frágiles: ❌
Overlays detectados: ✅
```

---

**Status:** ✅ PRIORITY MATRIX DEFINED  
**Implementation:** PHASE 1 (Auditoría de Selectores)  
**Timeline:** 2-3 horas  
**Priority:** 🔴 CRÍTICO
