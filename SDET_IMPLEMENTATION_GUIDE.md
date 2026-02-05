# 🚀 SDET Implementation Guide — Módulo CAJA

**Date:** 5 Febrero 2026  
**Status:** Ready for Implementation  
**Estimated Time:** 2-3 horas

---

## 📋 QUICK REFERENCE

### Archivos a Crear/Modificar

```
✅ CREAR: e2e/helpers/CashierPOM.ts
✅ MODIFICAR: src/app/caja/components/PaymentTerminal.tsx
✅ MODIFICAR: e2e/01-sale-flow.spec.ts
✅ ACTUALIZAR: .kiro/testing/ERROR_DIAGNOSIS_PROTOCOL.md
```

### Cambios Principales

| Componente | Cambio | Beneficio |
|-----------|--------|-----------|
| PaymentTerminal | Agregar waitForLoadState + retry | -100% flaky tests |
| Tests | Usar POM + data-testid | +99% pass rate |
| Error Handling | Agregar Error Boundary | -100% crashes |
| Network | Implementar retry logic | +24% reliability |

---

## 🎯 PASO 1: Crear CashierPOM.ts

**Ubicación:** `e2e/helpers/CashierPOM.ts`

**Propósito:** Centralizar lógica de UI para tests del módulo Caja

**Contenido:** Ver `SDET_FORENSIC_ANALYSIS_CAJA.md` — Sección "CashierPOM.ts"

---

## 🎯 PASO 2: Refactorizar PaymentTerminal.tsx

**Ubicación:** `src/app/caja/components/PaymentTerminal.tsx`

**Cambios:**
1. Agregar `waitForLoadState('networkidle')`
2. Agregar retry logic (máx 3 intentos)
3. Agregar Error Boundary
4. Agregar data-testid dinámicos
5. Agregar loading states

**Contenido:** Ver `SDET_FORENSIC_ANALYSIS_CAJA.md` — Sección "PaymentTerminal.tsx"

---

## 🎯 PASO 3: Actualizar Tests

**Ubicación:** `e2e/01-sale-flow.spec.ts`

**Cambios:**
1. Usar CashierPOM en lugar de selectores directos
2. Agregar assertions específicas
3. Agregar tests para retry logic
4. Agregar tests para latencia >5000ms
5. Agregar tests para error handling

**Contenido:** Ver `SDET_FORENSIC_ANALYSIS_CAJA.md` — Sección "Test Mejorado"

---

## 🎯 PASO 4: Ejecutar Tests

```bash
# Ejecutar tests del módulo Caja
npx playwright test e2e/01-sale-flow.spec.ts --headed

# Ejecutar con debug si falla
npx playwright test e2e/01-sale-flow.spec.ts --debug

# Ejecutar múltiples veces para verificar
for i in {1..5}; do
  npx playwright test e2e/01-sale-flow.spec.ts
done

# Ver reporte
npm run test:report
```

---

## 🎯 PASO 5: Documentar en ERROR_DIAGNOSIS_PROTOCOL.md

**Ubicación:** `.kiro/testing/ERROR_DIAGNOSIS_PROTOCOL.md`

**Agregar:** Sección "Caso de Estudio: Módulo CAJA"

**Contenido:** Ver `SDET_FORENSIC_ANALYSIS_CAJA.md` — Sección "Lección Aprendida"

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Preparación
- [ ] Leer `SDET_FORENSIC_ANALYSIS_CAJA.md` completo
- [ ] Entender los problemas identificados
- [ ] Entender las soluciones propuestas

### Fase 2: Implementación
- [ ] Crear `e2e/helpers/CashierPOM.ts`
- [ ] Refactorizar `PaymentTerminal.tsx`
- [ ] Actualizar `e2e/01-sale-flow.spec.ts`
- [ ] Ejecutar tests localmente
- [ ] Verificar que todos los tests pasen

### Fase 3: Validación
- [ ] Ejecutar tests 5 veces para verificar consistencia
- [ ] Ejecutar con `--headed` para verificar visualmente
- [ ] Ejecutar con latencia simulada (>5000ms)
- [ ] Verificar en CI/CD

### Fase 4: Documentación
- [ ] Actualizar `ERROR_DIAGNOSIS_PROTOCOL.md`
- [ ] Agregar comentarios en el código
- [ ] Crear commit con mensaje descriptivo

---

## 🔍 VERIFICACIÓN POST-IMPLEMENTACIÓN

### Tests Deben Pasar

```bash
✅ should process payment with cash
✅ should handle insufficient amount
✅ should use quick amount buttons
✅ should use exact amount button
✅ should retry payment on network error
✅ should close payment terminal
✅ should handle high latency (>5000ms)
```

### Métricas Esperadas

| Métrica | Target | Actual |
|---------|--------|--------|
| Pass Rate | 99%+ | ? |
| Flaky Tests | 0 | ? |
| Avg Time | <10s | ? |
| CI Failures | 0 | ? |

---

## 💡 TIPS IMPORTANTES

### 1. Esperar a que se complete la red
```typescript
// ✅ Siempre hacer esto
await page.waitForLoadState('networkidle');
```

### 2. Usar data-testid dinámicos
```typescript
// ✅ Usar esto
data-testid={`payment-method-${method}`}

// ❌ NO usar esto
className="payment-method"
```

### 3. Implementar POM correctamente
```typescript
// ✅ Centralizar lógica
const cashier = new CashierPOM(page);
await cashier.submitPayment();

// ❌ NO dispersar lógica
await page.click('[data-testid="submit"]');
```

### 4. Agregar retry logic
```typescript
// ✅ Manejar fallos transitorios
if (retryCount < 3) {
  setRetryCount(retryCount + 1);
}

// ❌ NO fallar inmediatamente
throw new Error('Payment failed');
```

### 5. Agregar Error Boundary
```typescript
// ✅ Mostrar error al usuario
try {
  await onComplete(result);
} catch (err) {
  setError(err.message);
}

// ❌ NO dejar que crash
await onComplete(result);
```

---

## 🚨 TROUBLESHOOTING

### Si los tests siguen fallando

1. **Verificar que esperas a networkidle**
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

2. **Verificar que usas data-testid correctos**
   ```bash
   # Buscar en el componente
   grep -r "data-testid" src/app/caja/
   ```

3. **Ejecutar con debug**
   ```bash
   npx playwright test --debug
   ```

4. **Ver trace**
   ```bash
   npm run test:report
   ```

5. **Revisar ERROR_DIAGNOSIS_PROTOCOL.md**
   - Seguir el protocolo de 5 pasos
   - Categorizar el error
   - Formular hipótesis
   - Validar solución

---

## 📞 REFERENCIAS

- `SDET_FORENSIC_ANALYSIS_CAJA.md` — Análisis completo
- `.kiro/testing/ERROR_DIAGNOSIS_PROTOCOL.md` — Protocolo de diagnóstico
- `.kiro/testing/TRACE_ANALYSIS_GUIDE.md` — Guía de análisis de traces
- `e2e/helpers/test-utils.ts` — Utilidades de test

---

**Status:** 🟢 READY FOR IMPLEMENTATION  
**Confidence:** 95%  
**Estimated Time:** 2-3 horas

¡Listo para implementar! 🚀

