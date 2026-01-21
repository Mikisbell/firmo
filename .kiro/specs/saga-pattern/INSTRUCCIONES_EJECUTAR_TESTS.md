# 📋 Instrucciones para Ejecutar Tests E2E

**Fecha:** 21 Enero 2026  
**Estado:** 📝 GUÍA COMPLETA

---

## 🎯 Resumen

Para ejecutar los tests E2E del flujo completo (Mesero → KDS → Caja), necesitas:
1. ✅ Servidor de desarrollo corriendo
2. ✅ Base de datos con datos de prueba
3. ✅ Tests E2E configurados

---

## 📦 Pre-requisitos

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Configurar Base de Datos
```bash
# Aplicar migraciones
npx prisma migrate dev

# Seed con datos de prueba
npx prisma db seed
```

### 3. Verificar Variables de Entorno
Asegúrate de tener `.env` configurado:
```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

---

## 🚀 Ejecutar Tests

### Opción 1: Tests Completos (Recomendado)

#### Paso 1: Iniciar Servidor de Desarrollo
```bash
# Terminal 1
npm run dev
```

Espera a que veas:
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

#### Paso 2: Ejecutar Tests E2E
```bash
# Terminal 2
npx playwright test e2e/complete-waiter-flow.spec.ts
```

### Opción 2: Test Específico con UI

```bash
# Terminal 1: Servidor
npm run dev

# Terminal 2: Test con navegador visible
npx playwright test e2e/complete-waiter-flow.spec.ts -g "complete flow" --headed
```

### Opción 3: Test en Modo Debug

```bash
# Terminal 1: Servidor
npm run dev

# Terminal 2: Debug mode
npx playwright test e2e/complete-waiter-flow.spec.ts --debug
```

---

## 🧪 Tests Disponibles

### Test Principal: Flujo Completo
```bash
npx playwright test e2e/complete-waiter-flow.spec.ts -g "complete flow"
```

**Cubre:**
1. ✅ Mesero accede al sistema
2. ✅ Mesero selecciona mesa
3. ✅ Mesero agrega items (Pollo, Papas, Gaseosa)
4. ✅ Mesero envía pedido
5. ✅ Pedido llega a KDS Parrilla
6. ✅ Pedido llega a KDS Cocina
7. ✅ Pedido llega a KDS Bar
8. ✅ Pedido llega a Caja

### Test 2: Propagación de Estados
```bash
npx playwright test e2e/complete-waiter-flow.spec.ts -g "status changes"
```

**Cubre:**
- Cambios de estado en KDS se reflejan en todas las pantallas

### Test 3: Múltiples Meseros
```bash
npx playwright test e2e/complete-waiter-flow.spec.ts -g "multiple waiters"
```

**Cubre:**
- Varios meseros trabajando simultáneamente sin conflictos

### Test 4: Persistencia
```bash
npx playwright test e2e/complete-waiter-flow.spec.ts -g "persists after"
```

**Cubre:**
- Pedidos persisten después de refresh de página

---

## 🔍 Debugging

### Ver Logs del Test
Los tests imprimen logs detallados:
```
🚀 Starting Complete Waiter Flow Test
📱 STEP 1: Waiter accessing system
✅ Waiter page loaded successfully
🪑 STEP 2: Selecting table
  → Waiting for page to finish loading...
  → Found 15 buttons on page
  → Found 9 elements with "Mesa" text
✅ Mesa 1 button found and visible
✅ Mesa 1 clicked
```

### Capturar Screenshots
Si un test falla, se guardan screenshots automáticamente en:
```
test-results/
  complete-waiter-flow-Compl-36244-ubmit-→-KDS-cashier-receive-chromium/
    test-failed-1.png
    error-context.md
```

### Ver Reporte HTML
```bash
npx playwright show-report
```

Abre un navegador con reporte interactivo mostrando:
- ✅ Tests pasados
- ❌ Tests fallidos
- 📸 Screenshots
- 📝 Logs
- ⏱️ Tiempos de ejecución

---

## 🐛 Problemas Comunes

### Problema 1: "ERR_CONNECTION_REFUSED"
**Causa:** Servidor no está corriendo  
**Solución:**
```bash
# Terminal 1
npm run dev
```

### Problema 2: "Tables did not load"
**Causa:** Datos de prueba no están en base de datos  
**Solución:**
```bash
npx prisma db seed
```

### Problema 3: "PrismaClient unable to run in browser"
**Causa:** Código de servidor importado en cliente  
**Solución:** ✅ Ya solucionado en `LoginScreen.tsx`

### Problema 4: Tests muy lentos
**Causa:** Timeouts muy largos  
**Solución:** Ajustar timeouts en `playwright.config.ts`:
```typescript
timeout: 30000, // 30 segundos por test
```

### Problema 5: "PIN incorrecto"
**Causa:** Datos de seed no coinciden  
**Solución:** Verificar PINs en `e2e/helpers/test-utils.ts`:
```typescript
export const TEST_PINS = {
  ADMIN: '1234',
  CASHIER: '1111',
  WAITER: '2222',
  MANAGER: '0000',
  KITCHEN: '4444',
};
```

---

## 📊 Ejecutar Todos los Tests

### Tests E2E Completos
```bash
# Todos los tests E2E
npx playwright test e2e/

# Solo tests de flujo completo
npx playwright test e2e/complete-waiter-flow.spec.ts

# Solo tests de admin
npx playwright test e2e/admin-*.spec.ts
```

### Tests en Múltiples Navegadores
```bash
# Chromium + Mobile
npx playwright test e2e/complete-waiter-flow.spec.ts --project=chromium --project=mobile

# Solo mobile
npx playwright test e2e/complete-waiter-flow.spec.ts --project=mobile
```

### Tests en Paralelo
```bash
# 4 workers en paralelo
npx playwright test e2e/ --workers=4
```

---

## 🎬 Flujo Completo Paso a Paso

### 1. Preparar Entorno
```bash
# Instalar dependencias
npm install

# Configurar base de datos
npx prisma migrate dev
npx prisma db seed

# Verificar que todo funciona
npm run build
```

### 2. Iniciar Servidor
```bash
# Terminal 1
npm run dev

# Esperar a ver:
# ✓ Ready in 2.5s
# ○ Local:   http://localhost:3000
```

### 3. Ejecutar Tests
```bash
# Terminal 2
npx playwright test e2e/complete-waiter-flow.spec.ts
```

### 4. Ver Resultados
```bash
# Si todos pasan:
✓ 8 passed (45s)

# Si alguno falla:
✓ 6 passed
✗ 2 failed

# Ver reporte
npx playwright show-report
```

---

## 📈 Métricas Esperadas

### Tiempos de Ejecución
- **Test completo:** ~15-20 segundos
- **Setup (beforeEach):** ~2-3 segundos
- **Cada STEP:** ~1-2 segundos
- **Total suite (4 tests):** ~60-80 segundos

### Cobertura
- ✅ 8 pasos del flujo principal
- ✅ 3 estaciones KDS (Parrilla, Cocina, Bar)
- ✅ 1 terminal de caja
- ✅ 4 escenarios diferentes

---

## 🔧 Configuración Avanzada

### Ejecutar en CI/CD
```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run dev &
      - run: npx playwright test
```

### Ejecutar con Docker
```bash
# Build imagen
docker build -t park-pos .

# Ejecutar tests
docker run -it park-pos npm run test:e2e
```

---

## 📝 Checklist Pre-Ejecución

Antes de ejecutar tests, verifica:

- [ ] ✅ Node.js instalado (v18+)
- [ ] ✅ npm install ejecutado
- [ ] ✅ Base de datos configurada
- [ ] ✅ Migraciones aplicadas
- [ ] ✅ Seed ejecutado
- [ ] ✅ .env configurado
- [ ] ✅ Servidor corriendo en localhost:3000
- [ ] ✅ Playwright instalado

---

## 🎉 Resultado Esperado

Cuando todo funciona correctamente, deberías ver:

```bash
Running 8 tests using 2 workers

  ✓ [chromium] › complete flow: waiter login → order → submit → KDS + cashier receive (18s)
  ✓ [chromium] › verify order status changes propagate across all screens (12s)
  ✓ [chromium] › verify multiple waiters can work simultaneously (15s)
  ✓ [chromium] › verify order persists after page refresh (10s)
  ✓ [mobile] › complete flow: waiter login → order → submit → KDS + cashier receive (16s)
  ✓ [mobile] › verify order status changes propagate across all screens (11s)
  ✓ [mobile] › verify multiple waiters can work simultaneously (14s)
  ✓ [mobile] › verify order persists after page refresh (9s)

  8 passed (1.8m)
```

---

## 📞 Comandos Rápidos

```bash
# Iniciar servidor
npm run dev

# Ejecutar test principal
npx playwright test e2e/complete-waiter-flow.spec.ts -g "complete flow"

# Ver reporte
npx playwright show-report

# Debug mode
npx playwright test e2e/complete-waiter-flow.spec.ts --debug

# Con navegador visible
npx playwright test e2e/complete-waiter-flow.spec.ts --headed

# Solo chromium
npx playwright test e2e/complete-waiter-flow.spec.ts --project=chromium

# Solo mobile
npx playwright test e2e/complete-waiter-flow.spec.ts --project=mobile
```

---

**Última actualización:** 21 Enero 2026  
**Estado:** 📝 GUÍA COMPLETA - Lista para usar

