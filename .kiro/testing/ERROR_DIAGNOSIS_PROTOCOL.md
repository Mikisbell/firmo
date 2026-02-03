# Error Diagnosis Protocol for E2E Tests

> **Objetivo:** Protocolo sistemático para diagnosticar y resolver fallos de tests de forma eficiente.

## 🎯 Principios

1. **Reproducibilidad:** El fallo debe ser reproducible
2. **Aislamiento:** Aislar la causa del fallo
3. **Evidencia:** Recopilar evidencia (traces, logs, screenshots)
4. **Hipótesis:** Formular hipótesis basadas en evidencia
5. **Validación:** Validar la hipótesis con cambios mínimos

---

## 📋 Protocolo de 5 Pasos

### Paso 1: Reproducir el Fallo

**Objetivo:** Confirmar que el fallo es reproducible

```bash
# Ejecutar test específico
npx playwright test test-name.spec.ts --grep "test name"

# Ejecutar con debug
npx playwright test test-name.spec.ts --debug

# Ejecutar headed (ver el navegador)
npx playwright test test-name.spec.ts --headed
```

**Checklist:**
- [ ] ¿El fallo es consistente?
- [ ] ¿Ocurre en todos los navegadores?
- [ ] ¿Ocurre en local y en CI?
- [ ] ¿Ocurre en headed y headless?

**Resultado esperado:** Fallo reproducible y consistente

---

### Paso 2: Recopilar Evidencia

**Objetivo:** Capturar toda la información relevante

#### 2.1 Trace Viewer
```bash
# El trace se captura automáticamente en fallos
# Mostrar trace
npx playwright show-trace trace.zip

# O desde el reporte
npm run test:report
```

**Qué revisar:**
- Timeline de acciones
- Network requests
- Console logs
- DOM snapshots

#### 2.2 Screenshots y Videos
```bash
# Los screenshots y videos se guardan automáticamente
# Ubicación: test-results/

# Ver reporte HTML
npm run test:report
```

#### 2.3 Logs Estructurados
```typescript
// Agregar logs al test
test('should create employee', async ({ page }) => {
  console.log('TEST_START', { timestamp: new Date().toISOString() });
  
  await page.goto('/admin');
  console.log('NAVIGATION_COMPLETE', { url: page.url() });
  
  await adminPage.createEmployee({ name: 'John' });
  console.log('EMPLOYEE_CREATED', { name: 'John' });
});
```

**Checklist:**
- [ ] ¿Capturaste el trace?
- [ ] ¿Capturaste screenshots?
- [ ] ¿Capturaste logs?
- [ ] ¿Revisaste la Network tab?
- [ ] ¿Revisaste la Console tab?

**Resultado esperado:** Carpeta `test-results/` con evidencia completa

---

### Paso 3: Categorizar el Error

**Objetivo:** Identificar la categoría del error

#### Categorías

| Categoría | Síntomas | Causa Probable |
|-----------|----------|----------------|
| **Sync** | Timeout, elemento no encontrado | Race condition, timing |
| **Domain** | API error, validación falla | Lógica de negocio, datos |
| **Abstraction** | Selector no funciona | UI cambió, POM desactualizado |
| **Infrastructure** | Falla en CI pero no en local | WSL, headless, puerto |

#### Árbol de Decisión

```
¿Timeout esperando elemento?
├─ SÍ → SYNC (race condition)
└─ NO → ¿API retorna error?
    ├─ SÍ → DOMAIN (lógica de negocio)
    └─ NO → ¿Selector no funciona?
        ├─ SÍ → ABSTRACTION (UI cambió)
        └─ NO → INFRASTRUCTURE (WSL, headless)
```

**Checklist:**
- [ ] ¿Revisaste la Timeline?
- [ ] ¿Revisaste la Network tab?
- [ ] ¿Revisaste la Console tab?
- [ ] ¿Identificaste la categoría?

**Resultado esperado:** Categoría identificada (Sync/Domain/Abstraction/Infrastructure)

---

### Paso 4: Formular Hipótesis

**Objetivo:** Proponer una solución basada en la categoría

#### Hipótesis por Categoría

**SYNC Errors:**
```
Hipótesis: El elemento no aparece porque no esperamos a que se renderice

Evidencia:
- Timeline: waitForSelector timeout
- DOM: Elemento no existe en snapshot

Solución:
- Esperar a que se complete la red
- Esperar a que aparezca el elemento
- Usar mejor estrategia de espera
```

**DOMAIN Errors:**
```
Hipótesis: La API rechaza los datos porque faltan campos requeridos

Evidencia:
- Network: POST /api/admin/employees → 400 Bad Request
- Response: { "error": "name is required" }

Solución:
- Verificar que los datos sean válidos
- Verificar que el usuario esté autenticado
- Verificar que tenga permisos
```

**ABSTRACTION Errors:**
```
Hipótesis: El selector cambió porque la UI fue refactorizada

Evidencia:
- Timeline: click timeout
- DOM: Elemento no existe con ese selector

Solución:
- Actualizar el selector en el POM
- Usar data-testid en lugar de clases
- Actualizar la documentación
```

**INFRASTRUCTURE Errors:**
```
Hipótesis: El test falla en CI porque WSL tiene latencia

Evidencia:
- Falla en CI (headless)
- Pasa en local (headed)
- Timing diferente

Solución:
- Aumentar timeouts
- Usar mejor estrategia de espera
- Usar waitForLoadState('networkidle')
```

**Checklist:**
- [ ] ¿Formulaste una hipótesis clara?
- [ ] ¿Tienes evidencia que la respalda?
- [ ] ¿Propusiste una solución específica?

**Resultado esperado:** Hipótesis clara con solución propuesta

---

### Paso 5: Validar y Implementar

**Objetivo:** Validar la hipótesis y implementar la solución

#### 5.1 Cambio Mínimo
```typescript
// ❌ Malo: Cambios grandes
- await page.waitForSelector('[data-testid="save-btn"]', { timeout: 10000 });
+ await page.waitForSelector('[data-testid="save-btn"]', { timeout: 30000 });
+ await page.waitForTimeout(2000);
+ await page.reload();

// ✅ Bueno: Cambio mínimo
- await page.waitForSelector('[data-testid="save-btn"]');
+ await page.waitForLoadState('networkidle');
+ await page.waitForSelector('[data-testid="save-btn"]');
```

#### 5.2 Ejecutar Test
```bash
# Ejecutar test específico
npx playwright test test-name.spec.ts --grep "test name"

# Ejecutar con debug si falla
npx playwright test test-name.spec.ts --debug
```

#### 5.3 Verificar Solución
```bash
# Ejecutar múltiples veces para confirmar
for i in {1..5}; do
  npx playwright test test-name.spec.ts --grep "test name"
done
```

**Checklist:**
- [ ] ¿Hiciste un cambio mínimo?
- [ ] ¿El test pasa ahora?
- [ ] ¿Pasa consistentemente?
- [ ] ¿No rompiste otros tests?

**Resultado esperado:** Test pasando consistentemente

---

## 🔄 Ciclo Completo: Ejemplo

### Escenario
Test falla: "should create employee"
Error: "Timeout waiting for element [data-testid='success-message']"

### Paso 1: Reproducir
```bash
npx playwright test admin-panel.spec.ts --grep "should create employee"
# Resultado: FAILED (consistente)
```

### Paso 2: Recopilar Evidencia
```bash
npm run test:report
# Revisar trace.zip, screenshots, videos
```

**Evidencia:**
- Timeline: POST /api/admin/employees → 201 (exitoso)
- Network: Response contiene `{ "id": "emp-123", "name": "John" }`
- Console: Sin errores
- DOM: Elemento `success-message` no existe

### Paso 3: Categorizar
```
¿Timeout esperando elemento?
├─ SÍ (success-message no aparece)
└─ ¿API retorna error?
    └─ NO (API retorna 201)
    
Categoría: SYNC (elemento no se renderiza)
```

### Paso 4: Formular Hipótesis
```
Hipótesis: El componente no renderiza el success message
después de crear el empleado

Evidencia:
- API fue exitosa (201)
- No hay errores de JavaScript
- El elemento no existe en el DOM

Solución:
- Esperar a que la tabla se actualice en lugar del success message
- O verificar que el componente renderice el success message
```

### Paso 5: Validar e Implementar

**Opción A: Cambiar el test**
```typescript
// ❌ Antes
await page.waitForSelector('[data-testid="success-message"]');

// ✅ Después
await page.waitForSelector('[data-testid="employee-table"] >> text=John');
```

**Opción B: Cambiar el componente**
```typescript
// Agregar success message al componente
{success && (
  <div data-testid="success-message">
    Employee created successfully
  </div>
)}
```

**Ejecutar test:**
```bash
npx playwright test admin-panel.spec.ts --grep "should create employee"
# Resultado: PASSED
```

---

## 🛠️ Herramientas Útiles

### Debug Script
```bash
#!/bin/bash
# debug-test.sh

TEST_NAME=$1

echo "🔍 Debugging test: $TEST_NAME"
echo ""

# Ejecutar con debug
npx playwright test --grep "$TEST_NAME" --debug

# Mostrar trace
echo ""
echo "📊 Showing trace..."
npx playwright show-trace trace.zip

# Mostrar reporte
echo ""
echo "📋 Showing report..."
npm run test:report
```

**Uso:**
```bash
chmod +x debug-test.sh
./debug-test.sh "should create employee"
```

### Capturar Trace Manualmente
```typescript
test('should create employee', async ({ page, context }) => {
  // Iniciar grabación
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });

  try {
    // Tu test aquí
    await adminPage.createEmployee({ name: 'John' });
  } finally {
    // Guardar trace
    await context.tracing.stop({
      path: `trace-${Date.now()}.zip`,
    });
  }
});
```

### Comparar Traces
```bash
# Extraer ambos traces
unzip trace-success.zip -d trace-success
unzip trace-failure.zip -d trace-failure

# Comparar eventos
diff trace-success/trace.json trace-failure/trace.json
```

---

## 📊 Métricas de Diagnóstico

Registrar estas métricas para cada fallo:

```typescript
interface DiagnosticMetrics {
  testName: string;
  errorCategory: 'sync' | 'domain' | 'abstraction' | 'infrastructure';
  timeToReproduce: number; // ms
  timeToFix: number; // ms
  rootCause: string;
  solution: string;
  confidence: number; // 0-100%
}
```

**Ejemplo:**
```json
{
  "testName": "should create employee",
  "errorCategory": "sync",
  "timeToReproduce": 120,
  "timeToFix": 300,
  "rootCause": "Element not rendered after API success",
  "solution": "Wait for table update instead of success message",
  "confidence": 95
}
```

---

## ✅ Checklist Final

Antes de considerar un fallo como "resuelto":

- [ ] ¿El test pasa consistentemente?
- [ ] ¿Pasa en local y en CI?
- [ ] ¿Pasa en headed y headless?
- [ ] ¿No rompiste otros tests?
- [ ] ¿Documentaste la solución?
- [ ] ¿Actualizaste el POM si fue necesario?
- [ ] ¿Agregaste logs para futuros diagnósticos?

---

## 🎓 Recursos

- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright Debugging](https://playwright.dev/docs/debug)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

**Last Updated:** 3 Febrero 2026  
**Version:** 1.0  
**Status:** Production Ready
