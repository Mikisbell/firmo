# 📊 Resultados de Prueba E2E: Flujo Completo del Mesero

**Fecha:** 21 Enero 2026  
**Archivo:** `e2e/complete-waiter-flow.spec.ts`  
**Estado:** ⚠️ TESTS FALLANDO - Requiere ajustes

---

## 📋 Resumen de Ejecución

### Resultados por Test

| # | Test | Chromium | Mobile | Estado |
|---|------|----------|--------|--------|
| 1 | Complete flow: waiter login → order → submit → KDS + cashier receive | 14.7s | 10.9s | ⚠️ TIMEOUT |
| 2 | Verify order status changes propagate across all screens | 30.3s | 30.2s | ❌ TIMEOUT |
| 3 | Verify multiple waiters can work simultaneously | 30.3s | 31.1s | ❌ TIMEOUT |
| 4 | Verify order persists after page refresh | 30.2s | 30.8s | ❌ TIMEOUT |

### Estadísticas Generales

- **Total Tests:** 8 (4 en chromium + 4 en mobile)
- **Pasados:** 0
- **Fallidos:** 8
- **Timeout:** 30 segundos
- **Duración Total:** ~198 segundos

---

## 🐛 Problemas Detectados

### Problema 1: Timeout en Test Principal (14.7s)
**Test:** `complete flow: waiter login → order → submit → KDS + cashier receive`  
**Duración:** 14.7s (chromium), 10.9s (mobile)  
**Estado:** ⚠️ TIMEOUT

**Análisis:**
- El test principal falló más rápido que los otros (14.7s vs 30s)
- Esto sugiere que falló en un paso temprano
- Probablemente en la verificación del header "MESERO"

**Causa Probable:**
```typescript
await expect(page.locator('text=MESERO')).toBeVisible({ timeout: 10000 });
```
- La página `/mozo` requiere autenticación
- El sistema está redirigiendo o mostrando pantalla de login
- El header "MESERO" no aparece porque no hay sesión activa

**Solución Propuesta:**
1. Agregar setup de autenticación antes de los tests
2. Simular terminal configurado con `localStorage`
3. O ajustar el test para manejar el flujo de login

---

### Problema 2: Timeout en Tests Secundarios (30s)
**Tests:** Tests 2, 3, 4  
**Duración:** ~30 segundos (timeout completo)  
**Estado:** ❌ TIMEOUT

**Análisis:**
- Todos los tests secundarios alcanzaron el timeout completo
- Fallaron en el mismo punto: `page.click('text=Mesa X')`
- Esto confirma que la página `/mozo` no está cargando correctamente

**Causa Probable:**
```typescript
await page.click('text=Mesa 2');  // Timeout esperando este elemento
```
- Las mesas no aparecen porque la página requiere autenticación
- El sistema está en estado de "Verificando sesión..."
- Los botones de mesa nunca se renderizan

---

## 🔍 Análisis Detallado

### Flujo de Autenticación Requerido

Según el código de `src/app/mozo/page.tsx`:

```typescript
const { isLoading, isAuthenticated } = useRequireTerminal();

if (isLoading || !isAuthenticated || zonesLoading) {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-zinc-700 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-zinc-400">Verificando sesión...</p>
            </div>
        </div>
    );
}
```

**Problema:** El test no está configurando la sesión/terminal antes de acceder a `/mozo`

---

## ✅ Soluciones Propuestas

### Solución 1: Configurar Terminal en beforeEach (RECOMENDADA)

```typescript
test.beforeEach(async ({ page }) => {
    // Setup: Configure terminal in localStorage
    await page.goto("/");
    
    // Set terminal configuration
    await page.evaluate(() => {
        const terminalConfig = {
            terminal_id: "waiter_test_1",
            tenant_id: "00000000-0000-0000-0000-000000000001",
            actor_id: "00000000-0000-0000-0000-000000000002",
            role: "WAITER",
            fingerprint: "test-fingerprint",
            timestamp: Date.now()
        };
        localStorage.setItem('terminal_config', JSON.stringify(terminalConfig));
    });
    
    await page.waitForLoadState("networkidle");
});
```

**Ventajas:**
- ✅ Simula terminal configurado correctamente
- ✅ No requiere cambios en el código de producción
- ✅ Tests pueden ejecutarse de forma aislada

---

### Solución 2: Agregar Flujo de Login al Test

```typescript
test("complete flow with login", async ({ page }) => {
    // Step 1: Go to setup page
    await page.goto("/setup");
    
    // Step 2: Configure terminal
    await page.fill('[name="terminal_id"]', 'waiter_test_1');
    await page.click('button:has-text("Configurar")');
    
    // Step 3: Login with PIN
    await page.goto("/mozo");
    // ... enter PIN if required
    
    // Continue with test...
});
```

**Ventajas:**
- ✅ Prueba el flujo completo incluyendo login
- ✅ Más realista

**Desventajas:**
- ❌ Más complejo
- ❌ Requiere que exista flujo de setup

---

### Solución 3: Deshabilitar Autenticación en Tests (NO RECOMENDADA)

```typescript
// En playwright.config.ts
use: {
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: {
        'X-Test-Mode': 'true'
    }
}

// En middleware o componente
if (headers.get('X-Test-Mode') === 'true') {
    // Skip authentication
}
```

**Ventajas:**
- ✅ Tests más simples

**Desventajas:**
- ❌ No prueba autenticación real
- ❌ Requiere cambios en código de producción
- ❌ Riesgo de seguridad si se deja activado

---

## 🔧 Implementación Recomendada

### Paso 1: Crear Helper de Setup

```typescript
// e2e/helpers/test-utils.ts
export async function setupWaiterTerminal(page: Page) {
    await page.goto("/");
    
    await page.evaluate(() => {
        const terminalConfig = {
            terminal_id: "waiter_test_1",
            tenant_id: "00000000-0000-0000-0000-000000000001",
            actor_id: "00000000-0000-0000-0000-000000000002",
            role: "WAITER",
            fingerprint: "test-fingerprint-" + Date.now(),
            timestamp: Date.now()
        };
        localStorage.setItem('terminal_config', JSON.stringify(terminalConfig));
        
        // Also set session if needed
        const session = {
            employee_id: "00000000-0000-0000-0000-000000000002",
            role: "WAITER",
            terminal_id: "waiter_test_1",
            logged_in_at: new Date().toISOString()
        };
        localStorage.setItem('session', JSON.stringify(session));
    });
    
    await page.waitForLoadState("networkidle");
}
```

### Paso 2: Usar Helper en Tests

```typescript
import { setupWaiterTerminal } from './helpers/test-utils';

test.beforeEach(async ({ page }) => {
    await setupWaiterTerminal(page);
});

test("complete flow: waiter login → order → submit → KDS + cashier receive", async ({ page, context }) => {
    // Now page is authenticated
    await page.goto("/mozo");
    await page.waitForLoadState("networkidle");
    
    // Verify we're on the waiter page
    await expect(page.locator('text=MESERO')).toBeVisible({ timeout: 10000 });
    
    // Continue with test...
});
```

---

## 📊 Próximos Pasos

### Prioridad Alta 🔴

1. **Implementar setupWaiterTerminal helper**
   - Crear `e2e/helpers/test-utils.ts`
   - Agregar función de setup de terminal
   - Agregar función de setup de sesión

2. **Actualizar complete-waiter-flow.spec.ts**
   - Importar helper
   - Usar en beforeEach
   - Re-ejecutar tests

3. **Verificar autenticación**
   - Revisar `useRequireTerminal` hook
   - Verificar qué datos necesita en localStorage
   - Ajustar helper según necesidad

### Prioridad Media 🟡

4. **Agregar tests de autenticación**
   - Test de login con PIN
   - Test de sesión expirada
   - Test de terminal no configurado

5. **Mejorar selectores**
   - Agregar data-testid a elementos clave
   - Hacer selectores más robustos
   - Reducir dependencia de texto

6. **Optimizar timeouts**
   - Reducir timeouts innecesarios
   - Agregar esperas específicas
   - Mejorar performance de tests

### Prioridad Baja 🟢

7. **Agregar más escenarios**
   - Test de modificar pedido
   - Test de anular items
   - Test de dividir cuenta

8. **Mejorar logs**
   - Agregar más contexto en errores
   - Capturar screenshots en puntos clave
   - Agregar video recording

---

## 📝 Código de Ejemplo Completo

### e2e/helpers/test-utils.ts

```typescript
import { Page } from '@playwright/test';

export async function setupWaiterTerminal(page: Page) {
    await page.goto("/");
    
    await page.evaluate(() => {
        // Terminal configuration
        const terminalConfig = {
            terminal_id: "waiter_test_1",
            tenant_id: "00000000-0000-0000-0000-000000000001",
            actor_id: "00000000-0000-0000-0000-000000000002",
            role: "WAITER",
            fingerprint: "test-fingerprint-" + Date.now(),
            timestamp: Date.now()
        };
        localStorage.setItem('terminal_config', JSON.stringify(terminalConfig));
        
        // Session
        const session = {
            employee_id: "00000000-0000-0000-0000-000000000002",
            role: "WAITER",
            terminal_id: "waiter_test_1",
            logged_in_at: new Date().toISOString()
        };
        localStorage.setItem('session', JSON.stringify(session));
    });
    
    await page.waitForLoadState("networkidle");
}

export async function setupKDSTerminal(page: Page, station: string) {
    await page.goto("/");
    
    await page.evaluate((station) => {
        const terminalConfig = {
            terminal_id: `kds_${station.toLowerCase()}`,
            tenant_id: "00000000-0000-0000-0000-000000000001",
            actor_id: "00000000-0000-0000-0000-000000000003",
            role: "COOK",
            station: station,
            fingerprint: "test-fingerprint-kds-" + Date.now(),
            timestamp: Date.now()
        };
        localStorage.setItem('terminal_config', JSON.stringify(terminalConfig));
    }, station);
    
    await page.waitForLoadState("networkidle");
}

export async function setupCashierTerminal(page: Page) {
    await page.goto("/");
    
    await page.evaluate(() => {
        const terminalConfig = {
            terminal_id: "cashier_test_1",
            tenant_id: "00000000-0000-0000-0000-000000000001",
            actor_id: "00000000-0000-0000-0000-000000000004",
            role: "CASHIER",
            fingerprint: "test-fingerprint-cashier-" + Date.now(),
            timestamp: Date.now()
        };
        localStorage.setItem('terminal_config', JSON.stringify(terminalConfig));
    });
    
    await page.waitForLoadState("networkidle");
}
```

### e2e/complete-waiter-flow.spec.ts (actualizado)

```typescript
import { test, expect } from "@playwright/test";
import { setupWaiterTerminal, setupKDSTerminal, setupCashierTerminal } from "./helpers/test-utils";

test.describe("Complete Waiter Flow - End to End", () => {
    test.beforeEach(async ({ page }) => {
        // Setup: Configure waiter terminal
        await setupWaiterTerminal(page);
    });

    test("complete flow: waiter login → order → submit → KDS + cashier receive", async ({ page, context }) => {
        console.log("🚀 Starting Complete Waiter Flow Test");

        // STEP 1: Waiter accesses system
        console.log("📱 STEP 1: Waiter accessing system");
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");
        
        // Verify we're on the waiter page
        await expect(page.locator('text=MESERO')).toBeVisible({ timeout: 10000 });
        console.log("✅ Waiter page loaded successfully");

        // Continue with rest of test...
    });
});
```

---

## 🎯 Conclusión

Los tests están fallando debido a la **falta de configuración de autenticación/terminal** antes de acceder a las páginas protegidas.

**Solución:** Implementar helper `setupWaiterTerminal` que configure localStorage con los datos necesarios antes de cada test.

**Próximo paso:** Crear `e2e/helpers/test-utils.ts` y actualizar los tests para usar el helper.

---

**Última actualización:** 21 Enero 2026  
**Estado:** ⚠️ Tests fallando - Solución identificada - Listo para implementar fix
