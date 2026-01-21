# 📊 Progreso de Tests E2E - Segunda Ejecución

**Fecha:** 21 Enero 2026  
**Estado:** ⚠️ MEJORA PARCIAL - Requiere ajustes adicionales

---

## 🎯 Resultados de la Segunda Ejecución

### Comparación Antes/Después

| Test | Primera Ejecución | Segunda Ejecución | Mejora |
|------|-------------------|-------------------|--------|
| Test 1 (chromium) | 14.7s - Falló en STEP 1 | 11.2s - Falló en STEP 2 | ✅ +1 STEP |
| Test 2 (chromium) | 30.3s - Timeout | 30.1s - Timeout | ⚠️ Sin cambio |
| Test 3 (chromium) | 30.3s - Timeout | 30.1s - Timeout | ⚠️ Sin cambio |
| Test 4 (chromium) | 30.2s - Timeout | 30.1s - Timeout | ⚠️ Sin cambio |
| Test 1 (mobile) | 10.9s - Falló en STEP 1 | 10.4s - Falló en STEP 2 | ✅ +1 STEP |
| Test 2 (mobile) | 30.2s - Timeout | 30.4s - Timeout | ⚠️ Sin cambio |
| Test 3 (mobile) | 31.1s - Timeout | ? - Timeout | ⚠️ Sin cambio |
| Test 4 (mobile) | 30.8s - Timeout | ? - Timeout | ⚠️ Sin cambio |

---

## ✅ Progreso Logrado

### Test Principal - Chromium

**Primera Ejecución:**
```
📱 STEP 1: Waiter accessing system
❌ TIMEOUT - No pudo ver header "MESERO"
```

**Segunda Ejecución:**
```
📱 STEP 1: Waiter accessing system
✅ Waiter page loaded successfully
🪑 STEP 2: Selecting table
❌ TIMEOUT - No pudo seleccionar mesa
```

**Análisis:**
- ✅ **STEP 1 PASÓ** - La configuración de terminal funcionó
- ✅ Header "MESERO" ahora es visible
- ❌ **STEP 2 FALLÓ** - No puede encontrar botón de mesa

---

## 🐛 Nuevo Problema Identificado

### Problema: Botones de Mesa No Encontrados

**Error en STEP 2:**
```typescript
await page.click('text=Mesa 1');  // Timeout esperando este elemento
```

**Posibles Causas:**

#### 1. Mesas No Cargadas
Las mesas pueden no estar cargándose porque:
- No hay datos de mesas en la base de datos
- Hook `useTableStatus` no está retornando mesas
- Zonas no están configuradas

#### 2. Selector Incorrecto
El texto puede ser diferente:
- "Mesa 1" vs "Mesa 01" vs "MESA 1"
- Puede estar dentro de un elemento no clickeable
- Puede tener espacios extra

#### 3. Carga Asíncrona
Las mesas pueden tardar en cargar:
- Esperando datos de IndexedDB
- Esperando datos de API
- Rendering asíncrono

---

## 🔍 Análisis del Código

### useTableStatus Hook

Según `src/app/mozo/hooks/useTableStatus.ts`:

```typescript
const ALL_TABLES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
```

Las mesas están hardcodeadas, así que deberían aparecer.

### Renderizado de Mesas

Según `src/app/mozo/page.tsx`:

```typescript
{filteredTables.map((t) => (
    <motion.button
        onClick={() => router.push(`/mozo/mesa/${t.number}`)}
    >
        <div className="text-sm md:text-lg font-bold text-white tracking-tight">
            {t.name}
        </div>
    </motion.button>
))}
```

El texto es `{t.name}`, que probablemente es "Mesa 1", "Mesa 2", etc.

---

## ✅ Soluciones Propuestas

### Solución 1: Esperar Carga de Mesas (RECOMENDADA)

```typescript
// STEP 2: Select a Table
console.log("🪑 STEP 2: Selecting table");
const tableNumber = "1";

// Wait for tables to load
await page.waitForSelector('button:has-text("Mesa")', { timeout: 10000 });
await page.waitForTimeout(1000); // Extra wait for animations

const tableButton = page.locator(`text=Mesa ${tableNumber}`).first();
await expect(tableButton).toBeVisible({ timeout: 5000 });
await tableButton.click();
```

### Solución 2: Usar Selector Más Robusto

```typescript
// Use more specific selector
const tableButton = page.locator(`button:has-text("Mesa ${tableNumber}")`).first();
await tableButton.waitFor({ state: 'visible', timeout: 10000 });
await tableButton.click();
```

### Solución 3: Agregar data-testid

En `src/app/mozo/page.tsx`:

```typescript
<motion.button
    data-testid={`table-${t.number}`}
    onClick={() => router.push(`/mozo/mesa/${t.number}`)}
>
```

En el test:

```typescript
const tableButton = page.locator(`[data-testid="table-${tableNumber}"]`);
await tableButton.click();
```

### Solución 4: Verificar Estado de Carga

```typescript
// Wait for loading to finish
await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 });

// Then look for tables
const tableButton = page.locator(`text=Mesa ${tableNumber}`).first();
await tableButton.click();
```

---

## 🔧 Implementación Recomendada

### Actualizar STEP 2 en el Test

```typescript
// ============================================================
// STEP 2: Select a Table
// ============================================================
console.log("🪑 STEP 2: Selecting table");
const tableNumber = "1";

// Wait for page to finish loading (no spinner)
await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {
    console.log("  ⚠️ No spinner found, continuing...");
});

// Wait for at least one table button to appear
await page.waitForSelector('button:has-text("Mesa")', { timeout: 10000 });
console.log("  ✅ Tables loaded");

// Extra wait for animations to complete
await page.waitForTimeout(1000);

// Find and click the table
const tableButton = page.locator(`button:has-text("Mesa ${tableNumber}")`).first();
await expect(tableButton).toBeVisible({ timeout: 5000 });
console.log(`  ✅ Mesa ${tableNumber} button found`);

await tableButton.click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1000);

// Verify we're on the order page
await expect(page.locator(`text=Mesa ${tableNumber}`)).toBeVisible();
console.log(`✅ Table ${tableNumber} selected`);
```

---

## 📊 Tests Secundarios

Los tests 2, 3 y 4 también están fallando con timeout, probablemente por el mismo problema (no pueden seleccionar mesas).

Una vez que se solucione el STEP 2 del test principal, los demás deberían funcionar también.

---

## 🎯 Plan de Acción

### Prioridad Alta 🔴

1. **Actualizar STEP 2 del test principal**
   - Agregar espera para carga de mesas
   - Usar selector más robusto
   - Agregar logs de debug

2. **Re-ejecutar test principal**
   - Verificar que STEP 2 pasa
   - Continuar con STEP 3, 4, etc.

3. **Aplicar fix a tests secundarios**
   - Usar mismo patrón de espera
   - Verificar que todos pasan

### Prioridad Media 🟡

4. **Agregar data-testid a elementos clave**
   - Botones de mesa
   - Botones de productos
   - Botón de enviar

5. **Optimizar esperas**
   - Reducir timeouts innecesarios
   - Usar esperas específicas

### Prioridad Baja 🟢

6. **Mejorar logs**
   - Agregar más contexto
   - Capturar screenshots en cada paso

---

## 💡 Lecciones Aprendidas

### 1. Progreso Incremental
- ✅ La solución de autenticación funcionó (STEP 1 pasó)
- ⚠️ Cada paso puede tener sus propios problemas
- ✅ Debugging incremental es efectivo

### 2. Esperas Asíncronas
- ⚠️ No basta con `waitForLoadState("networkidle")`
- ✅ Necesitamos esperar elementos específicos
- ✅ Animaciones pueden requerir esperas adicionales

### 3. Selectores Robustos
- ⚠️ `text=Mesa 1` puede no ser suficiente
- ✅ `button:has-text("Mesa 1")` es más específico
- ✅ `data-testid` es la mejor práctica

---

## 📝 Código de Ejemplo Actualizado

### e2e/complete-waiter-flow.spec.ts (STEP 2 mejorado)

```typescript
// ============================================================
// STEP 2: Select a Table
// ============================================================
console.log("🪑 STEP 2: Selecting table");
const tableNumber = "1";

// Wait for loading spinner to disappear
console.log("  → Waiting for page to finish loading...");
await page.waitForSelector('.animate-spin', { 
    state: 'hidden', 
    timeout: 10000 
}).catch(() => {
    console.log("  ⚠️ No loading spinner found (may already be loaded)");
});

// Wait for tables to appear
console.log("  → Waiting for tables to load...");
await page.waitForSelector('button:has-text("Mesa")', { 
    timeout: 10000 
}).catch(async () => {
    // Debug: Take screenshot if tables don't appear
    await page.screenshot({ path: 'debug-no-tables.png' });
    console.log("  ❌ Tables not found! Screenshot saved to debug-no-tables.png");
    throw new Error("Tables did not load");
});
console.log("  ✅ Tables loaded");

// Extra wait for animations
await page.waitForTimeout(1000);

// Find the specific table button
console.log(`  → Looking for Mesa ${tableNumber}...`);
const tableButton = page.locator(`button:has-text("Mesa ${tableNumber}")`).first();

// Verify button is visible
await expect(tableButton).toBeVisible({ timeout: 5000 });
console.log(`  ✅ Mesa ${tableNumber} button found and visible`);

// Click the button
await tableButton.click();
console.log(`  ✅ Mesa ${tableNumber} clicked`);

// Wait for navigation
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1000);

// Verify we're on the order page
await expect(page.locator(`text=Mesa ${tableNumber}`)).toBeVisible();
console.log(`✅ Table ${tableNumber} selected - Order page loaded`);
```

---

## 🎉 Conclusión Parcial

### Progreso Logrado
- ✅ Autenticación funcionando (STEP 1 pasa)
- ✅ Página de mesero carga correctamente
- ✅ Header "MESERO" visible

### Problema Actual
- ❌ Selección de mesa falla (STEP 2)
- ❌ Necesita esperas adicionales para carga de mesas

### Próximo Paso
- 🔧 Implementar solución de espera para mesas
- 🔧 Re-ejecutar tests
- 🔧 Continuar con siguientes pasos

---

**Última actualización:** 21 Enero 2026  
**Estado:** ⚠️ PROGRESO PARCIAL - Solución identificada para STEP 2
