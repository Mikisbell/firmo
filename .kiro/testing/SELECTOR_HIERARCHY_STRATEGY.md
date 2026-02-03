# Selector Hierarchy Strategy - Accessibility First

> **Fecha:** 3 Febrero 2026  
> **Principio:** Accesibilidad > Testabilidad > Mantenibilidad

---

## 🎯 El Problema de data-testid

### La Trampa

```typescript
// ❌ Falsa sensación de seguridad
<button data-testid="save-btn" style="z-index: -1; opacity: 0;">
  Guardar
</button>

// Test pasa:
await page.locator('[data-testid="save-btn"]').click();
// ✅ Elemento existe en DOM
// ✅ Selector es específico
// ❌ PERO: Usuario NO puede clickearlo (z-index: -1)
```

### La Realidad

```
data-testid valida: ¿Existe el elemento?
Accesibilidad valida: ¿Puede el usuario interactuar con él?
```

---

## 📊 Jerarquía de Selectores

### Nivel 1: Accesibilidad (PREFERIDO) ✅

```typescript
// getByRole - Valida accesibilidad real
await page.getByRole('button', { name: 'Guardar' }).click();

// Qué valida:
// ✅ Elemento existe en accessibility tree
// ✅ Elemento es visible
// ✅ Elemento es enabled
// ✅ Elemento no está bloqueado por overlay
// ✅ Elemento tiene nombre accesible
```

**Ventajas:**
- ✅ Valida accesibilidad real
- ✅ Detecta overlays y z-index issues
- ✅ Resiliente a cambios de Tailwind
- ✅ Resiliente a cambios de estructura HTML

**Desventajas:**
- ❌ Requiere que componentes tengan roles ARIA correctos
- ❌ Requiere que botones tengan nombres accesibles

---

### Nivel 2: Labels (ALTERNATIVA) ✅

```typescript
// getByLabel - Para inputs con labels
await page.getByLabel('Nombre del Empleado').fill('John');

// Qué valida:
// ✅ Input tiene label asociado
// ✅ Label es accesible
// ✅ Input es visible
```

**Ventajas:**
- ✅ Valida que input tiene label (accesibilidad)
- ✅ Resiliente a cambios de estructura

**Desventajas:**
- ❌ Solo funciona con inputs que tienen labels

---

### Nivel 3: data-testid (FALLBACK) ⚠️

```typescript
// data-testid - Para elementos complejos
await page.locator('[data-testid="employee-table"]').isVisible();

// Qué valida:
// ✅ Elemento existe en DOM
// ❌ NO valida accesibilidad
// ❌ NO valida si está bloqueado por overlay
```

**Ventajas:**
- ✅ Funciona para cualquier elemento
- ✅ Específico y confiable

**Desventajas:**
- ❌ NO valida accesibilidad
- ❌ Puede pasar con elementos invisibles
- ❌ Requiere actualizar componentes

---

### Nivel 4: CSS Selectors (EVITAR) ❌

```typescript
// ❌ NUNCA usar clases CSS
await page.locator('.bg-amber-500.hover\\:bg-amber-600').click();

// Problemas:
// ❌ Frágil - Cambia si Tailwind cambia
// ❌ Genérico - Puede seleccionar elemento equivocado
// ❌ No valida accesibilidad
// ❌ Difícil de mantener
```

---

## 🔄 Estrategia de Migración

### Paso 1: Auditar Componentes

```typescript
// Revisar cada componente:
// ¿Tiene role ARIA?
// ¿Tiene nombre accesible?
// ¿Tiene label (si es input)?

// ❌ Antes
<button className="bg-amber-500">Guardar</button>

// ✅ Después
<button 
  className="bg-amber-500"
  aria-label="Guardar promoción"
  data-testid="save-promotion-btn"
>
  Guardar
</button>
```

### Paso 2: Actualizar POM

```typescript
// ❌ Antes
async savePromotion() {
  await this.click('[data-testid="save-promotion-btn"]', 'Save button');
}

// ✅ Después
async savePromotion() {
  // Intenta accesibilidad primero
  try {
    await this.clickButton('Guardar', 'Save promotion');
  } catch {
    // Fallback a data-testid
    await this.click('[data-testid="save-promotion-btn"]', 'Save button');
  }
}
```

### Paso 3: Validar Accesibilidad

```typescript
// Agregar test de accesibilidad
test('should have accessible buttons', async ({ page }) => {
  await page.goto('/admin/promociones');
  
  // Validar que botones son accesibles
  const saveBtn = page.getByRole('button', { name: /guardar/i });
  await expect(saveBtn).toBeVisible();
  await expect(saveBtn).toBeEnabled();
});
```

---

## 📋 Checklist de Implementación

### Para Cada Componente

- [ ] ¿Tiene role ARIA correcto?
- [ ] ¿Tiene nombre accesible (text o aria-label)?
- [ ] ¿Tiene data-testid como fallback?
- [ ] ¿Está validado en test de accesibilidad?
- [ ] ¿Funciona con getByRole?
- [ ] ¿Funciona con getByLabel (si es input)?

### Para Cada Test

- [ ] ¿Usa getByRole cuando es posible?
- [ ] ¿Usa getByLabel para inputs?
- [ ] ¿Usa data-testid como fallback?
- [ ] ¿Valida visibilidad?
- [ ] ¿Valida que no está bloqueado por overlay?

---

## 🎯 Casos de Uso

### Caso 1: Botón Simple

```typescript
// ✅ CORRECTO
<button aria-label="Guardar promoción">
  <Save className="w-4 h-4" />
</button>

// Test
await page.getByRole('button', { name: 'Guardar promoción' }).click();
```

### Caso 2: Input con Label

```typescript
// ✅ CORRECTO
<label htmlFor="promo-name">Nombre</label>
<input id="promo-name" />

// Test
await page.getByLabel('Nombre').fill('Mi Promoción');
```

### Caso 3: Tabla Compleja

```typescript
// ✅ CORRECTO
<table data-testid="promotions-table" role="table">
  <tbody>
    <tr>
      <td>{promotion.name}</td>
    </tr>
  </tbody>
</table>

// Test
const table = page.locator('[data-testid="promotions-table"]');
await expect(table).toContainText('Mi Promoción');
```

### Caso 4: Dropdown/Select

```typescript
// ✅ CORRECTO
<label htmlFor="promo-type">Tipo</label>
<select id="promo-type">
  <option value="PERCENT">Porcentaje</option>
</select>

// Test
await page.getByLabel('Tipo').selectOption('PERCENT');
```

---

## 🚨 Anti-Patrones

### Anti-Patrón 1: Selector Genérico

```typescript
// ❌ MAL
await page.locator('button').click(); // ¿Cuál botón?

// ✅ BIEN
await page.getByRole('button', { name: 'Guardar' }).click();
```

### Anti-Patrón 2: Selector Frágil

```typescript
// ❌ MAL
await page.locator('.bg-amber-500.hover\\:bg-amber-600').click();

// ✅ BIEN
await page.getByRole('button', { name: 'Guardar' }).click();
```

### Anti-Patrón 3: Sin Validación de Accesibilidad

```typescript
// ❌ MAL
const btn = page.locator('[data-testid="save-btn"]');
await btn.click(); // ¿Está visible? ¿Está enabled?

// ✅ BIEN
const btn = page.getByRole('button', { name: 'Guardar' });
await expect(btn).toBeVisible();
await expect(btn).toBeEnabled();
await btn.click();
```

---

## 📊 Impacto

### Antes (data-testid only)
```
Tests pasando: 58/58 ✅
Accesibilidad validada: ❌
Overlays detectados: ❌
Tailwind changes: ❌ (tests fallan)
```

### Después (Accessibility-First)
```
Tests pasando: 58/58 ✅
Accesibilidad validada: ✅
Overlays detectados: ✅
Tailwind changes: ✅ (tests pasan)
```

---

## 🔗 Referencias

- [Playwright getByRole](https://playwright.dev/docs/locators#locate-by-role)
- [Playwright getByLabel](https://playwright.dev/docs/locators#locate-by-label)
- [ARIA Roles](https://www.w3.org/WAI/ARIA/apg/patterns/)
- [Accessibility Testing](https://www.w3.org/WAI/test-evaluate/)

---

**Status:** ✅ STRATEGY DEFINED  
**Implementation:** PHASE 1 (Auditoría de Selectores)  
**Priority:** 🔴 CRÍTICO
