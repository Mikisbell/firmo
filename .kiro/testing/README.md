# AI-Ready Testing Framework for PARK POS

> **Objetivo:** Crear tests que sean "explicables" a IA, facilitando diagnóstico automático de fallos.

## 📁 Estructura

```
.kiro/testing/
├── README.md                          # Este archivo
├── AI_READY_FRAMEWORK.md              # Framework completo
├── POM_TEMPLATE.ts                    # Template de Page Object Model
├── TRACE_ANALYSIS_GUIDE.md            # Guía de análisis de traces
└── ERROR_DIAGNOSIS_PROTOCOL.md        # Protocolo de diagnóstico
```

---

## 🚀 Quick Start

### 1. Ejecutar Tests E2E

```bash
# Ejecutar todos los tests
npm run test:e2e

# Ejecutar con debug (Playwright Inspector)
npm run test:e2e:debug

# Ejecutar con navegador visible
npm run test:e2e:headed

# Ejecutar solo tests marcados con @focus
npm run test:e2e:single

# Ver reporte HTML
npm run test:e2e:report

# Ver trace de fallo
npm run test:e2e:trace
```

### 2. Cuando un Test Falla

1. **Ejecutar con debug:**
   ```bash
   npm run test:e2e:debug
   ```

2. **Ver el reporte:**
   ```bash
   npm run test:e2e:report
   ```

3. **Analizar el trace:**
   - Abrir `.kiro/testing/TRACE_ANALYSIS_GUIDE.md`
   - Seguir el protocolo de 5 pasos

4. **Diagnosticar el error:**
   - Abrir `.kiro/testing/ERROR_DIAGNOSIS_PROTOCOL.md`
   - Categorizar el error (Sync/Domain/Abstraction/Infrastructure)
   - Formular hipótesis
   - Implementar solución

---

## 📚 Documentación

### AI_READY_FRAMEWORK.md
**Contenido:**
- Principios fundamentales
- Mega-prompt template para Claude/GPT-4o
- Categorías de errores
- Checklist de tests AI-ready

**Cuándo usar:**
- Cuando necesitas diagnosticar un fallo con IA
- Cuando necesitas entender la filosofía del framework
- Cuando necesitas crear un nuevo test

### POM_TEMPLATE.ts
**Contenido:**
- Clase base `BasePage` con métodos comunes
- Ejemplo: `AdminPanelPage` con CRUD operations
- Ejemplo: `LoginPage` para autenticación
- Patrones de uso

**Cuándo usar:**
- Cuando creas un nuevo test
- Cuando necesitas agregar métodos a un Page Object
- Cuando necesitas entender la estructura

### TRACE_ANALYSIS_GUIDE.md
**Contenido:**
- Cómo usar Playwright Trace Viewer
- Análisis paso a paso
- Patrones de fallo comunes
- Soluciones para cada patrón

**Cuándo usar:**
- Cuando un test falla
- Cuando necesitas entender qué pasó
- Cuando necesitas diagnosticar un problema

### ERROR_DIAGNOSIS_PROTOCOL.md
**Contenido:**
- Protocolo de 5 pasos
- Categorización de errores
- Formulación de hipótesis
- Validación e implementación

**Cuándo usar:**
- Cuando necesitas resolver un fallo
- Cuando necesitas un proceso sistemático
- Cuando necesitas documentar la solución

---

## 🎯 Flujo de Trabajo

### Crear un Nuevo Test

1. **Crear archivo de test:**
   ```typescript
   // e2e/my-feature.spec.ts
   import { test, expect } from '@playwright/test';
   import { AdminPanelPage } from './.kiro/testing/POM_TEMPLATE';
   
   test('should do something', async ({ page }) => {
     const adminPage = new AdminPanelPage(page);
     
     await adminPage.goto();
     await adminPage.createEmployee({ name: 'John' });
     await adminPage.assertEmployeeInTable('John');
   });
   ```

2. **Ejecutar test:**
   ```bash
   npm run test:e2e
   ```

3. **Si falla, diagnosticar:**
   - Seguir `.kiro/testing/ERROR_DIAGNOSIS_PROTOCOL.md`

### Diagnosticar un Fallo

1. **Reproducir el fallo:**
   ```bash
   npm run test:e2e:debug
   ```

2. **Recopilar evidencia:**
   - Trace Viewer
   - Screenshots
   - Videos
   - Logs

3. **Categorizar el error:**
   - Sync (race condition)
   - Domain (lógica de negocio)
   - Abstraction (UI cambió)
   - Infrastructure (WSL, headless)

4. **Formular hipótesis:**
   - Basada en evidencia
   - Con solución propuesta

5. **Validar e implementar:**
   - Cambio mínimo
   - Test pasa consistentemente

---

## 🔧 Herramientas

### Playwright Inspector
```bash
npm run test:e2e:debug
```
- Pausa en cada acción
- Inspecciona el DOM
- Ejecuta comandos en consola

### Trace Viewer
```bash
npm run test:e2e:report
# Luego click en "View trace"
```
- Timeline de acciones
- Network requests
- Console logs
- DOM snapshots

### HTML Report
```bash
npm run test:e2e:report
```
- Resumen de tests
- Screenshots
- Videos
- Traces

---

## 📊 Métricas

### Tests Actuales
- **Total:** 58 tests
- **Passing:** 58 ✅
- **Failing:** 0
- **Coverage:** Admin Panel CRUD + Permissions

### Categorías
- **Promotions CRUD:** 16 tests
- **Permissions:** 29 tests
- **Additional:** 13 tests

---

## 🎓 Ejemplos

### Ejemplo 1: Crear Employee

```typescript
test('should create employee', async ({ page }) => {
  const adminPage = new AdminPanelPage(page);
  
  // Navigate
  await adminPage.goto();
  
  // Create
  await adminPage.createEmployee({
    name: 'John Doe',
    role: 'WAITER',
    pin: '5678',
  });
  
  // Assert
  await adminPage.assertEmployeeInTable('John Doe');
});
```

### Ejemplo 2: Diagnosticar Fallo

```
Test falla: "Timeout waiting for element [data-testid='success-message']"

Paso 1: Reproducir
✓ Fallo consistente

Paso 2: Recopilar Evidencia
- Timeline: POST /api/admin/employees → 201 (exitoso)
- Network: Response contiene { "id": "emp-123" }
- Console: Sin errores
- DOM: Elemento no existe

Paso 3: Categorizar
SYNC (elemento no se renderiza)

Paso 4: Hipótesis
El componente no renderiza el success message

Paso 5: Solución
Esperar a que la tabla se actualice en lugar del success message
```

---

## ✅ Checklist

### Antes de Crear un Test
- [ ] ¿Usas Page Object Model?
- [ ] ¿Tienes nombres descriptivos?
- [ ] ¿Usas data-testid en selectores?
- [ ] ¿Esperas a estados específicos?
- [ ] ¿Documentaste el flujo?

### Antes de Hacer Push
- [ ] ¿Todos los tests pasan?
- [ ] ¿Pasan en local y en CI?
- [ ] ¿Pasan en headed y headless?
- [ ] ¿No rompiste otros tests?
- [ ] ¿Documentaste cambios?

### Cuando un Test Falla
- [ ] ¿Reproduciste el fallo?
- [ ] ¿Recopilaste evidencia?
- [ ] ¿Categorizaste el error?
- [ ] ¿Formulaste hipótesis?
- [ ] ¿Validaste la solución?

---

## 🔗 Referencias

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)

---

## 📞 Soporte

### Preguntas Frecuentes

**P: ¿Por qué mi test falla en CI pero pasa en local?**
R: Probablemente es un problema de timing o infraestructura. Ver `TRACE_ANALYSIS_GUIDE.md` → Patrón 5.

**P: ¿Cómo diagnostico un fallo rápidamente?**
R: Seguir `ERROR_DIAGNOSIS_PROTOCOL.md` → Protocolo de 5 pasos.

**P: ¿Cómo creo un nuevo test?**
R: Usar `POM_TEMPLATE.ts` como base y seguir los ejemplos.

**P: ¿Cómo uso Trace Viewer?**
R: Ver `TRACE_ANALYSIS_GUIDE.md` → Análisis paso a paso.

---

## 🚀 Próximos Pasos

1. **Expandir cobertura:**
   - Agregar tests para Waiter flow
   - Agregar tests para KDS flow
   - Agregar tests para Cashier flow

2. **Mejorar diagnóstico:**
   - Agregar logs estructurados
   - Agregar métricas de performance
   - Agregar alertas de fallos

3. **Automatizar:**
   - CI/CD integration
   - Slack notifications
   - Automatic trace uploads

---

**Last Updated:** 3 Febrero 2026  
**Version:** 1.0  
**Status:** Production Ready  
**Maintainer:** Kiro AI Assistant
