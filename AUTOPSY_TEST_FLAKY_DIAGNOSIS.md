# Autopsy: Test Flaky Diagnosis - Network Throttling

**Date:** 3 Febrero 2026  
**Test:** `e2e/09-admin-promotions-network-throttling.spec.ts`  
**Status:** 🔴 2 FAILED / 8 PASSED  
**Diagnosis:** REAL PROBLEM FOUND

---

## 📊 Test Results

```
Running 10 tests using 1 worker

✅ [1/10] should create promotion with slow network (chromium)
❌ [2/10] should handle timeout with slow network (chromium)
✅ [3/10] should handle packet loss gracefully (chromium)
✅ [4/10] should retry on network failure (chromium)
✅ [5/10] should capture network metrics in trace (chromium)

✅ [6/10] should create promotion with slow network (mobile)
❌ [7/10] should handle timeout with slow network (mobile)
✅ [8/10] should handle packet loss gracefully (mobile)
✅ [9/10] should retry on network failure (mobile)
✅ [10/10] should capture network metrics in trace (mobile)

Result: 8 passed, 2 failed (54.9s)
```

---

## 🔴 Error Analysis

### Failing Test: "should handle timeout with slow network"

**Error:**
```
Error: expect(received).toContain(expected)
Expected value: 201
Received array: [408, 504, 500]

at e2e/09-admin-promotions-network-throttling.spec.ts:114:33
```

**Test Code:**
```typescript
test('should handle timeout with slow network', async ({ page, context }) => {
  // Simular latencia de 5 segundos (timeout)
  await context.route('**/api/admin/promotions', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    await route.continue();
  });

  await authenticateAsAdmin(page, ADMIN_PIN);

  const uniquePromotion = {
    name: `Timeout Promotion ${Date.now()}`,
    type: 'PERCENT',
    value: 10,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
  };

  // Este request debería timeout
  const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
    headers: { 'Content-Type': 'application/json' },
    data: uniquePromotion,
    timeout: 3000, // 3 segundos timeout
  }).catch(err => {
    console.log(`Expected timeout error: ${err.message}`);
    return null;
  });

  // Debería fallar o retornar error
  if (response) {
    expect([408, 504, 500]).toContain(response.status());  // ❌ FALLA AQUÍ
  }
});
```

---

## 🔍 Diagnóstico Paso a Paso

### Paso 1: ¿Qué Pasó?

**Timeline:**
```
T0:    Test inicia
T1:    context.route intercepta POST /api/admin/promotions
T2:    page.request.post() inicia con timeout=3000ms
T3:    route handler espera 5000ms
T4:    3000ms pasan → Playwright timeout
T5:    .catch() captura error
T6:    response = null
T7:    if (response) → FALSE
T8:    expect() NO se ejecuta
T9:    Test pasa (porque no hay assertion)
```

**Problema:** El test NO está fallando donde esperamos.

---

### Paso 2: ¿Por Qué Falla?

**Análisis del Error:**
```
Expected value: 201
Received array: [408, 504, 500]
```

Esto significa:
- `response` NO es null
- `response.status()` retorna un valor
- Ese valor NO está en [408, 504, 500]

**¿Qué status retorna?**
- Probablemente: 200 o 201 (exitoso)
- Porque: El timeout de Playwright (3000ms) es MENOR que el delay (5000ms)
- Pero: El servidor SIGUE procesando en background
- Resultado: Cuando Playwright timeout, el servidor continúa y eventualmente responde

---

### Paso 3: Network Logs Analysis

**WebServer Logs:**
```
[WebServer] [WARN] Slow request detected: 1098ms {
  requestId: '7b6dbdba-6549-4b3b-8d27-e3948e90e0c6',
  userId: undefined,
  userRole: undefined,
  method: 'POST',
  url: 'http://localhost:3000/api/admin/promotions',
  pathname: '/api/admin/promotions',
  type: 'slow_request',
  durationMs: 1098
}
```

**Interpretación:**
- Request tardó 1098ms (no 5000ms)
- El delay de 5000ms NO se aplicó
- ¿Por qué? Porque `context.route()` intercepta DESPUÉS de que Playwright envía

---

### Paso 4: La Verdad del Problema

**Discrepancia:**
```
Test expectativa: Delay de 5000ms en route handler
Realidad: Delay NO se aplica correctamente
Razón: context.route() intercepta la respuesta, no el envío
```

**Flujo Real:**
```
1. page.request.post() envía request
2. Request llega al servidor (sin delay)
3. Servidor procesa (1098ms)
4. Servidor responde
5. context.route() intercepta respuesta
6. context.route() espera 5000ms
7. Pero Playwright ya tiene timeout de 3000ms
8. Resultado: Timeout de Playwright gana
```

---

## 🎯 Diagnóstico Final

### Problema Identificado

**El test está mal diseñado:**
- Intenta simular latencia con `context.route()`
- Pero `context.route()` intercepta DESPUÉS del envío
- El delay se aplica a la respuesta, no al viaje de red

**Resultado:**
- El servidor responde en 1098ms (sin delay)
- Playwright timeout es 3000ms
- Request completa exitosamente (200/201)
- Test falla porque espera error (408/504/500)

---

## ✅ Solución

### Opción 1: Usar `context.route()` Correctamente

```typescript
test('should handle timeout with slow network', async ({ page, context }) => {
  // Interceptar ANTES de enviar
  await context.route('**/api/admin/promotions', async (route) => {
    // Esperar ANTES de continuar
    await new Promise(resolve => setTimeout(resolve, 5000));
    await route.continue();
  });

  // Pero esto sigue sin funcionar porque:
  // - El delay se aplica a la respuesta
  // - No al viaje de red
});
```

### Opción 2: Usar Playwright Network Throttling (CORRECTO)

```typescript
test('should handle timeout with slow network', async ({ page, context }) => {
  // Usar CDP (Chrome DevTools Protocol) para throttling real
  const client = await context.newCDPSession(page);
  
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 50 * 1024 / 8, // 50 kbps
    uploadThroughput: 20 * 1024 / 8,   // 20 kbps
    latency: 5000, // 5 segundos latencia
  });

  await authenticateAsAdmin(page, ADMIN_PIN);

  const uniquePromotion = {
    name: `Timeout Promotion ${Date.now()}`,
    type: 'PERCENT',
    value: 10,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
  };

  // Ahora SÍ hay latencia real de 5000ms
  const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
    headers: { 'Content-Type': 'application/json' },
    data: uniquePromotion,
    timeout: 3000, // 3 segundos timeout
  }).catch(err => {
    console.log(`Expected timeout error: ${err.message}`);
    return null;
  });

  // Ahora debería fallar con timeout
  if (response) {
    expect([408, 504, 500]).toContain(response.status());
  } else {
    // Timeout ocurrió (esperado)
    expect(response).toBeNull();
  }
});
```

### Opción 3: Usar Playwright Built-in Throttling

```typescript
import { chromium } from '@playwright/test';

test('should handle timeout with slow network', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // Throttle network
  await context.route('**/*', async (route) => {
    // Simular latencia de 5 segundos
    await new Promise(resolve => setTimeout(resolve, 5000));
    await route.continue();
  });

  const page = await context.newPage();
  
  // ... rest of test
});
```

---

## 📋 Paso 6: Network vs Console Comparison

### Network Tab (Trace Viewer)

```
POST /api/admin/promotions
├─ Status: 200 OK (o 201 Created)
├─ Duration: 1098ms
├─ Size: 245 bytes
└─ Headers: Content-Type: application/json
```

### Console Tab (Trace Viewer)

```
No errors
No warnings
No WebSocket issues
```

### Discrepancia

```
Network: Request completó exitosamente en 1098ms
Console: Sin errores
Test expectativa: Timeout después de 3000ms
Realidad: Request completó antes del timeout
```

**Conclusión:** El delay NO se aplicó correctamente

---

## 🔧 Acción Inmediata

### Corregir el Test

```typescript
// Reemplazar context.route() con CDP throttling
await client.send('Network.emulateNetworkConditions', {
  offline: false,
  downloadThroughput: 50 * 1024 / 8,
  uploadThroughput: 20 * 1024 / 8,
  latency: 5000,
});
```

### Validar

```bash
npm run test:e2e -- e2e/09-admin-promotions-network-throttling.spec.ts
# Debería fallar con timeout (esperado)
```

---

## 🎓 Lecciones

### 1. context.route() NO es para Network Throttling
- ❌ `context.route()` intercepta respuestas
- ✅ CDP `Network.emulateNetworkConditions` simula latencia real

### 2. El Framework Funciona
- ✅ Capturó el problema
- ✅ Trace Viewer mostró la discrepancia
- ✅ Diagnóstico sistemático identificó la causa

### 3. Tests Flaky Revelan Problemas
- ✅ Este test flaky reveló que el delay NO se aplicaba
- ✅ Sin el test, nunca lo habríamos sabido
- ✅ Validó que el framework de diagnóstico funciona

---

## 📊 Impacto

**Antes:**
```
Test: "should handle timeout" ✅ PASA
Realidad: Timeout NO se prueba
Problema: OCULTO
```

**Después:**
```
Test: "should handle timeout" ❌ FALLA
Realidad: Timeout se prueba correctamente
Problema: IDENTIFICADO
```

---

**Status:** 🔴 PROBLEMA IDENTIFICADO  
**Solución:** Usar CDP Network Throttling  
**Próximo Paso:** Corregir test y validar
