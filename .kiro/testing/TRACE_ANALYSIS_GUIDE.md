# Playwright Trace Viewer Analysis Guide

> **Objetivo:** Usar Playwright Trace Viewer para diagnosticar fallos de tests de forma sistemática.

## 🚀 Quick Start

Cuando un test falla, Playwright captura un trace. Para analizarlo:

```bash
# Mostrar el trace viewer
npx playwright show-trace trace.zip

# O desde el reporte HTML
npm run test:report
```

---

## 📊 Trace Viewer Interface

El Trace Viewer tiene 4 secciones principales:

```
┌─────────────────────────────────────────────────────┐
│ Timeline (Línea de tiempo de acciones)              │
├─────────────────────────────────────────────────────┤
│ Network (Llamadas HTTP)                             │
│ Console (Logs y errores)                            │
│ DOM Snapshot (Estado del DOM)                       │
│ Source (Código fuente)                              │
└─────────────────────────────────────────────────────┘
```

---

## 🔍 Análisis Paso a Paso

### Paso 1: Revisar Timeline

**¿Qué buscar?**
- Última acción antes del fallo
- Duración de cada acción
- Dónde se detiene el progreso

**Ejemplo:**
```
✓ goto http://localhost:3000/admin (1.2s)
✓ click [data-testid="create-employee-btn"] (0.3s)
✓ fill [data-testid="employee-name-input"] (0.2s)
✗ click [data-testid="save-employee-btn"] (timeout after 10s)
```

**Diagnóstico:** El botón "Save" no se encontró o no fue clickeable.

---

### Paso 2: Revisar Network Tab

**¿Qué buscar?**
- Llamadas API exitosas (200, 201)
- Llamadas API fallidas (400, 401, 403, 500)
- Requests pendientes
- Tiempos de respuesta

**Ejemplo de fallo:**
```
POST /api/admin/employees
Status: 401 Unauthorized
Response: { "error": "Not authenticated" }
```

**Diagnóstico:** El usuario no está autenticado. Falta el token JWT.

---

### Paso 3: Revisar Console Tab

**¿Qué buscar?**
- Errores de JavaScript
- Warnings
- Logs de debug
- Stack traces

**Ejemplo:**
```
Error: Cannot read property 'id' of undefined
  at AdminPanelPage.createEmployee (POM_TEMPLATE.ts:120)
  at test (admin-panel.spec.ts:45)
```

**Diagnóstico:** La respuesta de la API no tiene la propiedad `id`.

---

### Paso 4: Revisar DOM Snapshot

**¿Qué buscar?**
- ¿Existe el elemento?
- ¿Es visible?
- ¿Está habilitado?
- ¿Cuál es su estado?

**Ejemplo:**
```html
<!-- Elemento no encontrado -->
<button data-testid="save-employee-btn" style="display: none;">
  Save
</button>

<!-- Diagnóstico: El botón está oculto (display: none) -->
```

---

## 🎯 Patrones de Fallo Comunes

### Patrón 1: Timeout Esperando Elemento

**Síntomas:**
- Timeline: Acción se detiene en "waitForSelector"
- Console: "Timeout waiting for selector"
- DOM: Elemento no existe

**Causas Posibles:**
1. Selector incorrecto (cambió la UI)
2. Elemento no se renderizó
3. Elemento está en un iframe
4. Elemento está dentro de un modal no abierto

**Solución:**
```typescript
// ❌ Malo: Selector genérico
await page.waitForSelector('button');

// ✅ Bueno: Selector específico con data-testid
await page.waitForSelector('[data-testid="save-employee-btn"]');

// ✅ Mejor: Usar POM con contexto
await adminPage.click(selectors.saveEmployeeBtn, 'Save Employee button');
```

---

### Patrón 2: API Retorna Error

**Síntomas:**
- Timeline: Acción completa pero test falla
- Network: Status 400, 401, 403, 500
- Console: Error de validación o autenticación

**Causas Posibles:**
1. Datos inválidos
2. Usuario no autenticado
3. Permisos insuficientes
4. Servidor error

**Solución:**
```typescript
// ❌ Malo: No verificar respuesta
const response = await page.request.post('/api/admin/employees', { data });

// ✅ Bueno: Verificar status
expect([200, 201]).toContain(response.status());

// ✅ Mejor: Verificar status y contenido
if (!response.ok()) {
  const error = await response.json();
  throw new Error(`API error: ${error.message}`);
}
```

---

### Patrón 3: Elemento Existe Pero No Es Clickeable

**Síntomas:**
- Timeline: Acción se detiene en "click"
- DOM: Elemento existe pero está deshabilitado
- Console: "Element is not clickable"

**Causas Posibles:**
1. Elemento está deshabilitado (disabled)
2. Elemento está cubierto por otro
3. Elemento tiene opacity: 0
4. Elemento está fuera del viewport

**Solución:**
```typescript
// ❌ Malo: Click directo
await page.click('[data-testid="save-btn"]');

// ✅ Bueno: Esperar a que sea clickeable
await page.locator('[data-testid="save-btn"]').click({ force: false });

// ✅ Mejor: Verificar estado antes de click
const button = page.locator('[data-testid="save-btn"]');
await expect(button).toBeEnabled();
await button.click();
```

---

### Patrón 4: Race Condition (Sync Issue)

**Síntomas:**
- Timeline: Acciones muy rápidas
- DOM: Elemento existe pero en estado incorrecto
- Console: Datos inconsistentes

**Causas Posibles:**
1. No esperamos a que se actualice el estado
2. No esperamos a que se complete la red
3. No esperamos a que se renderice el componente

**Solución:**
```typescript
// ❌ Malo: Sin esperar
await page.click('[data-testid="create-btn"]');
await page.fill('[data-testid="name-input"]', 'John');

// ✅ Bueno: Esperar a que aparezca el formulario
await page.click('[data-testid="create-btn"]');
await page.waitForSelector('[data-testid="name-input"]');
await page.fill('[data-testid="name-input"]', 'John');

// ✅ Mejor: Usar POM que maneja esto
await adminPage.createEmployee({ name: 'John' });
```

---

### Patrón 5: Diferencia Headless vs Headed

**Síntomas:**
- Test pasa en `--headed` pero falla en headless
- Timing diferente
- Rendering diferente

**Causas Posibles:**
1. WSL filesystem latency
2. Headless rendering diferente
3. Timing assumptions

**Solución:**
```typescript
// ❌ Malo: Timeout fijo
await page.waitForTimeout(1000);

// ✅ Bueno: Esperar a estado específico
await page.waitForLoadState('networkidle');

// ✅ Mejor: Esperar a elemento específico
await page.waitForSelector('[data-testid="success-message"]');
```

---

## 📋 Checklist de Análisis

Cuando un test falla, seguir este checklist:

- [ ] **Timeline:** ¿Dónde se detiene?
- [ ] **Network:** ¿Hay errores HTTP?
- [ ] **Console:** ¿Hay errores JavaScript?
- [ ] **DOM:** ¿Existe el elemento?
- [ ] **Visibility:** ¿Es visible el elemento?
- [ ] **State:** ¿Está en el estado correcto?
- [ ] **Timing:** ¿Es un problema de timing?
- [ ] **Infrastructure:** ¿Es un problema de WSL/headless?

---

## 🔧 Herramientas Útiles

### Capturar Trace Manualmente

```typescript
test('should create employee', async ({ page }) => {
  const context = page.context();
  
  // Iniciar grabación
  await context.tracing.start({ screenshots: true, snapshots: true });
  
  try {
    // Tu test aquí
    await page.goto('/admin');
    // ...
  } finally {
    // Guardar trace
    await context.tracing.stop({ path: 'trace.zip' });
  }
});
```

### Mostrar Trace en CI/CD

```bash
# En GitHub Actions
- name: Show trace
  if: failure()
  run: npx playwright show-trace trace.zip
```

### Exportar Trace a JSON

```bash
# Extraer trace.zip
unzip trace.zip

# Ver eventos
cat trace.json | jq '.[] | select(.type == "action")'
```

---

## 💡 Tips Avanzados

### 1. Usar Breakpoints en Trace Viewer
- Click en cualquier acción en la timeline
- El DOM snapshot se actualiza a ese punto
- Puedes ver exactamente qué pasó

### 2. Comparar Traces
- Captura trace de test exitoso
- Captura trace de test fallido
- Compara en Trace Viewer
- Identifica dónde divergen

### 3. Usar Logs Estructurados
```typescript
test('should create employee', async ({ page }) => {
  console.log('Starting test at', new Date().toISOString());
  
  await page.goto('/admin');
  console.log('Navigated to admin panel');
  
  await adminPage.createEmployee({ name: 'John' });
  console.log('Employee created');
  
  // Los logs aparecen en Console tab del Trace Viewer
});
```

### 4. Capturar Screenshots en Puntos Clave
```typescript
await page.screenshot({ path: 'before-click.png' });
await page.click('[data-testid="save-btn"]');
await page.screenshot({ path: 'after-click.png' });
```

---

## 🎓 Ejemplo Completo: Diagnosticar Fallo

### Escenario
Test falla: "should create employee"
Error: "Timeout waiting for element [data-testid='success-message']"

### Análisis

**1. Timeline**
```
✓ goto /admin (1.2s)
✓ click [data-testid="create-employee-btn"] (0.3s)
✓ fill [data-testid="employee-name-input"] (0.2s)
✓ click [data-testid="save-employee-btn"] (0.5s)
✗ waitForSelector [data-testid="success-message"] (timeout after 10s)
```

**2. Network**
```
POST /api/admin/employees
Status: 201 Created
Response: { "id": "emp-123", "name": "John" }
```

**3. Console**
```
No errors
```

**4. DOM Snapshot**
```html
<!-- Success message no existe en el DOM -->
<div class="form-container">
  <form>...</form>
</div>
```

### Diagnóstico
- API fue exitosa (201)
- No hay errores de JavaScript
- El elemento `success-message` no existe en el DOM
- **Causa:** El componente no renderiza el success message después de crear

### Solución
```typescript
// ❌ Malo: Esperar elemento que no existe
await page.waitForSelector('[data-testid="success-message"]');

// ✅ Bueno: Esperar a que la tabla se actualice
await page.waitForSelector('[data-testid="employee-table"] >> text=John');

// ✅ Mejor: Usar POM que maneja esto
await adminPage.assertEmployeeInTable('John');
```

---

**Last Updated:** 3 Febrero 2026  
**Version:** 1.0  
**Status:** Production Ready
