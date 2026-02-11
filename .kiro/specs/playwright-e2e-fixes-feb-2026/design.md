# Playwright E2E Tests - Diseño de Soluciones

**Fecha:** 11 Febrero 2026  
**Spec:** playwright-e2e-fixes-feb-2026

---

## 1. Arquitectura de Solución

### 1.1 Principios de Diseño
1. **Selectores Robustos:** Usar `data-testid` en lugar de texto o clases CSS
2. **Páginas Faltantes:** Crear páginas mínimas funcionales
3. **Timeouts Razonables:** 5-10 segundos máximo
4. **Datos de Test:** Provisionar datos necesarios antes de tests

### 1.2 Estrategia de Corrección
```
Prioridad 1: Admin Auditoría (11 tests) → Crear página completa
Prioridad 2: Multi-Tenant Provisioning (11 tests) → Corregir selectores
Prioridad 3: Flujo Mesero (4 tests) → Corregir carga de mesas
Prioridad 4: Concurrencia (10 tests) → Corregir lógica de eventos
Prioridad 5: Permisos + RLS (3 tests) → Corregir validaciones
```

---

## 2. Solución: Admin Auditoría (11 tests)

### 2.1 Problema
- Página `/admin/auditoria` **NO EXISTE**
- Tests esperan página completa con filtros, tabla, estadísticas

### 2.2 Solución Técnica

#### 2.2.1 Crear Página Admin Auditoría
**Archivo:** `src/app/admin/auditoria/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: string;
  terminal_id: string;
  employee_id: string;
  status: string;
  details: string;
}

interface AuditStats {
  total: number;
  login_success: number;
  login_failed: number;
  alerts: number;
}

export default function AuditoriaPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    login_success: 0,
    login_failed: 0,
    alerts: 0
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    terminal: '',
    employee: '',
    eventType: ''
  });

  useEffect(() => {
    loadAuditData();
  }, [filters]);

  const loadAuditData = async () => {
    // Cargar datos desde API
    const response = await fetch('/api/admin/audit-log');
    const data = await response.json();
    setEvents(data.events || []);
    setStats(data.stats || stats);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      terminal: '',
      employee: '',
      eventType: ''
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Auditoría de Autenticación</h1>
        <p className="text-gray-600">Registro completo de eventos de seguridad</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm text-gray-600">Total Eventos</h3>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm text-gray-600">Login Exitoso</h3>
          <p className="text-2xl font-bold text-green-600">{stats.login_success}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm text-gray-600">Login Fallido</h3>
          <p className="text-2xl font-bold text-red-600">{stats.login_failed}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm text-gray-600">Alertas</h3>
          <p className="text-2xl font-bold text-yellow-600">{stats.alerts}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label htmlFor="start-date" className="block text-sm mb-1">Fecha Inicio</label>
            <input
              id="start-date"
              type="date"
              aria-label="Fecha Inicio"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm mb-1">Fecha Fin</label>
            <input
              id="end-date"
              type="date"
              aria-label="Fecha Fin"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label htmlFor="terminal" className="block text-sm mb-1">Terminal</label>
            <select
              id="terminal"
              aria-label="Terminal"
              value={filters.terminal}
              onChange={(e) => setFilters({...filters, terminal: e.target.value})}
              className="w-full border rounded px-2 py-1"
            >
              <option value="">Todos</option>
              <option value="CAJA-01">CAJA-01</option>
              <option value="MOZO-01">MOZO-01</option>
            </select>
          </div>
          <div>
            <label htmlFor="employee" className="block text-sm mb-1">Empleado</label>
            <select
              id="employee"
              aria-label="Empleado"
              value={filters.employee}
              onChange={(e) => setFilters({...filters, employee: e.target.value})}
              className="w-full border rounded px-2 py-1"
            >
              <option value="">Todos</option>
            </select>
          </div>
          <div>
            <label htmlFor="event-type" className="block text-sm mb-1">Tipo de Evento</label>
            <select
              id="event-type"
              aria-label="Tipo de Evento"
              value={filters.eventType}
              onChange={(e) => setFilters({...filters, eventType: e.target.value})}
              className="w-full border rounded px-2 py-1"
            >
              <option value="">Todos</option>
              <option value="login_success">Login Exitoso</option>
              <option value="login_failed">Login Fallido</option>
              <option value="security_alert">Alerta de Seguridad</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Limpiar Filtros
          </button>
          <button
            onClick={loadAuditData}
            title="Actualizar"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Fecha/Hora</th>
              <th className="px-4 py-2 text-left">Evento</th>
              <th className="px-4 py-2 text-left">Terminal</th>
              <th className="px-4 py-2 text-left">Empleado</th>
              <th className="px-4 py-2 text-left">Estado</th>
              <th className="px-4 py-2 text-left">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No hay eventos para mostrar
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="border-t">
                  <td className="px-4 py-2">{event.timestamp}</td>
                  <td className="px-4 py-2">{event.event_type}</td>
                  <td className="px-4 py-2">{event.terminal_id}</td>
                  <td className="px-4 py-2">{event.employee_id}</td>
                  <td className="px-4 py-2">{event.status}</td>
                  <td className="px-4 py-2">{event.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

#### 2.2.2 Crear API Endpoint
**Archivo:** `src/app/api/admin/audit-log/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Mock data para tests
  const events = [
    {
      id: '1',
      timestamp: new Date().toISOString(),
      event_type: 'login_success',
      terminal_id: 'CAJA-01',
      employee_id: 'EMP-001',
      status: 'success',
      details: 'Login exitoso'
    }
  ];

  const stats = {
    total: events.length,
    login_success: events.filter(e => e.event_type === 'login_success').length,
    login_failed: events.filter(e => e.event_type === 'login_failed').length,
    alerts: events.filter(e => e.event_type === 'security_alert').length
  };

  return NextResponse.json({ events, stats });
}
```

#### 2.2.3 Agregar Link en Sidebar
**Archivo:** `src/app/admin/components/AdminSidebar.tsx`

```typescript
// Agregar en la lista de links
<Link href="/admin/auditoria" className="...">
  🔍 Auditoría
</Link>
```

---

## 3. Solución: Multi-Tenant Provisioning (11 tests)

### 3.1 Problema
- Selectores frágiles usando `placeholder*`
- Timeouts de 30 segundos
- Formulario no carga rápidamente

### 3.2 Solución Técnica

#### 3.2.1 Agregar data-testid a Inputs
**Archivo:** `src/app/admin/tenant/provisioning/page.tsx`

```typescript
// Cambiar inputs para usar data-testid
<input
  data-testid="legal-name-input"
  type="text"
  placeholder="Legal Name"
  // ... resto de props
/>

<input
  data-testid="admin-name-input"
  type="text"
  placeholder="Admin Name"
  // ... resto de props
/>

<input
  data-testid="admin-pin-input"
  type="password"
  placeholder="PIN (4 digits)"
  // ... resto de props
/>
```

#### 3.2.2 Actualizar Tests
**Archivo:** `e2e/multi-tenant-provisioning.spec.ts`

```typescript
// ANTES (frágil)
const legalNameInput = page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first();

// DESPUÉS (robusto)
const legalNameInput = page.locator('[data-testid="legal-name-input"]');
const adminNameInput = page.locator('[data-testid="admin-name-input"]');
const adminPinInput = page.locator('[data-testid="admin-pin-input"]');
```

---

## 4. Solución: Flujo Mesero Completo (4 tests)

### 4.1 Problema
- Mesas no cargan (timeout)
- Selector `text=Mesa X` no encuentra elementos
- Error "Tables did not load"

### 4.2 Solución Técnica

#### 4.2.1 Agregar data-testid a Botones de Mesa
**Archivo:** `src/app/mozo/components/TableGrid.tsx` (o similar)

```typescript
// Agregar data-testid a cada botón de mesa
<button
  data-testid={`table-${tableNumber}`}
  onClick={() => selectTable(tableNumber)}
  className="..."
>
  Mesa {tableNumber}
</button>
```

#### 4.2.2 Actualizar Tests
**Archivo:** `e2e/complete-waiter-flow.spec.ts`

```typescript
// ANTES (frágil)
await page.click('text=Mesa 2');

// DESPUÉS (robusto)
await page.click('[data-testid="table-2"]');
```

#### 4.2.3 Agregar Loading State
```typescript
// Agregar indicador de carga
{isLoading ? (
  <div data-testid="tables-loading">Cargando mesas...</div>
) : (
  <div data-testid="tables-loaded">
    {/* Botones de mesa */}
  </div>
)}
```

---

## 5. Solución: Concurrencia y Sincronización (10 tests)

### 5.1 Problema
- Eventos no se procesan correctamente
- Deduplicación falla
- Rate limiting no funciona

### 5.2 Solución Técnica

#### 5.2.1 Corregir Procesamiento de Eventos
**Archivo:** `src/app/api/events/ingest/route.ts`

```typescript
// Asegurar que eventos se procesan en orden
// Implementar deduplicación correcta
// Verificar rate limiting funciona
```

#### 5.2.2 Corregir Retry de Pagos
**Archivo:** `src/app/caja/components/PaymentTerminal.tsx`

```typescript
// Asegurar retry funciona con errores de red
// Configurar timeout correcto
```

---

## 6. Solución: Permisos Admin (2 tests)

### 6.1 Problema
- API retorna códigos HTTP incorrectos
- Validación de permisos no funciona

### 6.2 Solución Técnica

#### 6.2.1 Corregir Validación de Permisos
**Archivo:** `src/app/api/admin/drivers/[id]/route.ts`

```typescript
// Verificar que retorna 403 para no-admin
// Verificar que retorna 200 para admin
```

---

## 7. Solución: RLS Analytics (1 test)

### 7.1 Problema
- Ambos tenants muestran "S/ 0.00"
- Datos no se cargan correctamente

### 7.2 Solución Técnica

#### 7.2.1 Provisionar Datos de Analytics
**Archivo:** `scripts/provision-e2e-test-tenants.ts`

```typescript
// Agregar datos de analytics para cada tenant
// Asegurar que son diferentes
```

---

## 8. Propiedades de Correctitud

### Propiedad 1: Selectores Robustos
```
∀ test ∈ E2E_Tests:
  selector_type(test) = "data-testid" ∨ selector_type(test) = "role"
```

### Propiedad 2: Timeouts Razonables
```
∀ test ∈ E2E_Tests:
  timeout(test) ≤ 10_seconds
```

### Propiedad 3: Páginas Existen
```
∀ page ∈ Required_Pages:
  exists(page) = true ∧ renders(page) < 3_seconds
```

### Propiedad 4: Tests Pasan
```
∀ test ∈ E2E_Tests:
  result(test) = "passing"
```

---

## 9. Plan de Implementación

### Fase 1: Admin Auditoría (Día 1)
1. Crear página `/admin/auditoria`
2. Crear API `/api/admin/audit-log`
3. Agregar link en sidebar
4. Ejecutar tests: `npx playwright test e2e/admin-auditoria.spec.ts`

### Fase 2: Multi-Tenant Provisioning (Día 1)
1. Agregar `data-testid` a inputs
2. Actualizar tests con selectores robustos
3. Ejecutar tests: `npx playwright test e2e/multi-tenant-provisioning.spec.ts`

### Fase 3: Flujo Mesero (Día 2)
1. Agregar `data-testid` a botones de mesa
2. Actualizar tests con selectores robustos
3. Ejecutar tests: `npx playwright test e2e/complete-waiter-flow.spec.ts`

### Fase 4: Concurrencia (Día 2)
1. Corregir procesamiento de eventos
2. Corregir retry de pagos
3. Ejecutar tests: `npx playwright test e2e/03-concurrency.spec.ts`

### Fase 5: Permisos + RLS (Día 3)
1. Corregir validación de permisos
2. Provisionar datos de analytics
3. Ejecutar tests completos

---

**Última actualización:** 11 Febrero 2026  
**Próximo paso:** Crear tasks.md con tareas específicas
