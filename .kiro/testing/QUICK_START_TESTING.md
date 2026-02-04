# 🚀 Quick Start: Ejecutar Pruebas Multi-Tenant

**Tiempo total:** 30-55 minutos  
**Requisitos:** Node.js, npm, Supabase Cloud configurado

---

## 📋 Paso 1: Preparar Ambiente

### 1.1 Verificar variables de entorno

```bash
# Verificar que DATABASE_URL está configurado
echo $DATABASE_URL

# Debe verse algo como:
# postgresql://user:password@db.supabase.co:5432/postgres?schema=public
```

Si no está configurado:

```bash
# Copiar .env.example a .env.local
cp .env.example .env.local

# Editar .env.local y agregar:
# DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres?schema=public
```

### 1.2 Instalar dependencias

```bash
npm install
```

### 1.3 Verificar conexión a Supabase

```bash
# Ejecutar query simple
npx ts-node -e "
import prisma from './src/core/db/prisma';
(async () => {
  const result = await prisma.\$queryRaw\`SELECT 1 as test\`;
  console.log('✅ Conexión a Supabase OK:', result);
})();
"
```

---

## 🧪 Paso 2: Ejecutar Pruebas

### Opción A: Ejecutar TODO (Recomendado)

```bash
# Ejecutar todas las pruebas en orden
bash scripts/run-all-multi-tenant-tests.sh
```

**Tiempo:** 30-55 minutos

### Opción B: Ejecutar por Fases

#### FASE 1: Unit Tests (3-5 min)

```bash
npm run test -- src/core/tenant/__tests__/provisioning.unit.test.ts --run
```

**Esperado:**
```
✅ debe provisionar tenant con todos los recursos
✅ debe crear 4 estaciones por defecto
✅ debe crear admin employee con PIN hasheado
✅ debe asignar 10 rangos de números de terminal
✅ debe crear terminal por defecto

5 passed
```

#### FASE 2: Integration Tests (5-10 min)

```bash
npx ts-node scripts/test-multi-tenant-integration.ts
```

**Esperado:**
```
✅ Provisioning Service: Crear tenant completo (1200ms)
✅ RLS Isolation: Tenant 1 no ve datos de Tenant 2 (800ms)
✅ RLS Isolation: Tenant settings aislados (900ms)
✅ RLS Isolation: Employees aislados por tenant (750ms)
✅ RLS Isolation: Stations aisladas por tenant (700ms)
✅ Provisioning: Activation codes son únicos (600ms)
✅ Provisioning: Tenant IDs son únicos (550ms)
✅ Provisioning: PIN se hashea correctamente (500ms)
✅ Provisioning: Onboarding checklist tiene 6 pasos (400ms)
✅ Database: Conexión a Supabase funciona (100ms)

10/10 PASSED
```

#### FASE 3: Property-Based Tests (5-10 min)

```bash
npm run test -- src/core/tenant/__tests__/isolation.property.test.ts --run
```

**Esperado:**
```
✅ Property: RLS siempre aísla tenants (100 iteraciones)
✅ Property: Quota enforcement nunca falla (50 iteraciones)

2 passed
```

#### FASE 4: E2E Tests (15-30 min)

```bash
npm run test:e2e -- e2e/multi-tenant-provisioning.spec.ts
```

**Esperado:**
```
✅ Flujo completo: Provisionar nuevo tenant
✅ Validación: PIN debe ser 4 dígitos
✅ Validación: Legal name es requerido
✅ Validación: Admin name es requerido
✅ Funcionalidad: Copiar credenciales al portapapeles
✅ Flujo: Provisionar múltiples tenants
✅ UI: Formulario tiene todas las secciones
✅ UI: Onboarding checklist muestra 6 pasos
✅ Responsividad: Formulario funciona en mobile
✅ Accesibilidad: Formulario tiene labels correctos

10 passed
```

---

## 🔍 Paso 3: Interpretar Resultados

### ✅ Pruebas Pasadas

```
✅ Provisioning Service: Crear tenant completo (1200ms)
```

Significa:
- El servicio de provisioning funciona correctamente
- Se creó el tenant en Supabase
- Se crearon todos los recursos (settings, employees, stations, etc.)
- Tiempo de ejecución: 1.2 segundos

### ❌ Pruebas Fallidas

```
❌ RLS Isolation: Tenant 1 no ve datos de Tenant 2
   Error: Tenant 1 vio 5 órdenes (esperaba 0)
```

Significa:
- RLS no está funcionando correctamente
- Tenant 1 puede ver datos de Tenant 2 (CRÍTICO)
- Necesita revisar las políticas RLS en Supabase

---

## 🐛 Paso 4: Troubleshooting

### Problema: "Connection refused"

```bash
# Verificar DATABASE_URL
echo $DATABASE_URL

# Debe contener:
# - Host: db.supabase.co
# - Puerto: 5432
# - Base de datos: postgres
```

**Solución:**
```bash
# Copiar URL correcta de Supabase Dashboard
# Settings → Database → Connection String
```

### Problema: "RLS policy violation"

```
Error: new row violates row-level security policy
```

**Solución:**
```bash
# Verificar que RLS está habilitado en Supabase
# Ir a: SQL Editor → Ejecutar:

SELECT * FROM pg_policies 
WHERE tablename = 'orders';

-- Debe retornar políticas RLS
```

### Problema: "Timeout en E2E tests"

```
Timeout: Test exceeded 30000ms
```

**Solución:**
```bash
# Aumentar timeout en playwright.config.ts
export default defineConfig({
  timeout: 60000, // 60 segundos
});

# O ejecutar con más tiempo
npm run test:e2e -- --timeout=60000
```

### Problema: "PIN validation failed"

```
Error: PIN must be 4 digits
```

**Solución:**
```bash
# Verificar que el PIN tiene exactamente 4 dígitos
# En provisioning.ts:
admin_pin: '1234' // ✅ Correcto
admin_pin: '12'   // ❌ Incorrecto
```

---

## 📊 Paso 5: Generar Reporte

### Reporte Automático

```bash
# Ejecutar pruebas y guardar reporte
npm run test -- --reporter=verbose > test-report.txt

# Ver reporte
cat test-report.txt
```

### Reporte Manual

```bash
# Crear reporte en Markdown
cat > TESTING_REPORT.md << 'EOF'
# Testing Report - Multi-Tenant Improvements

## Fecha: $(date)

### Resultados
- Unit Tests: ✅ 5/5 PASSED
- Integration Tests: ✅ 10/10 PASSED
- Property Tests: ✅ 2/2 PASSED
- E2E Tests: ✅ 10/10 PASSED

### Total: 27/27 PASSED ✅

### Tiempo Total: 45 minutos

### Conclusión
Todas las pruebas pasaron. Sistema listo para producción.
EOF
```

---

## 🎯 Paso 6: Validar Checklist

Antes de dar por completado, verifica:

- [ ] ✅ Unit Tests: 5/5 PASSED
- [ ] ✅ Integration Tests: 10/10 PASSED
- [ ] ✅ Property Tests: 2/2 PASSED (100+ iteraciones)
- [ ] ✅ E2E Tests: 10/10 PASSED
- [ ] ✅ RLS Isolation: Funciona correctamente
- [ ] ✅ Provisioning: Crea todos los recursos
- [ ] ✅ Quotas: Se enforzan correctamente
- [ ] ✅ UI: Formulario valida datos
- [ ] ✅ Supabase: Conexión OK
- [ ] ✅ Tiempo total: < 60 minutos

---

## 📈 Paso 7: Próximos Pasos

Si todas las pruebas pasaron:

1. **Commit a Git**
   ```bash
   git add .
   git commit -m "test: add comprehensive multi-tenant testing suite"
   git push
   ```

2. **Deploy a Producción**
   ```bash
   # En Vercel o tu plataforma de deployment
   npm run build
   npm run start
   ```

3. **Monitoreo**
   - Verificar logs en Supabase
   - Monitorear performance
   - Alertas de RLS violations

---

## 💡 Tips

### Ejecutar pruebas en paralelo (más rápido)

```bash
# Vitest ejecuta en paralelo por defecto
npm run test -- --run --reporter=verbose
```

### Ejecutar solo una prueba específica

```bash
# Unit test específico
npm run test -- provisioning.unit.test.ts -t "debe provisionar tenant"

# E2E test específico
npm run test:e2e -- -g "Flujo completo"
```

### Debug de pruebas

```bash
# Ejecutar con debug
npm run test -- --inspect-brk

# O en E2E
npm run test:e2e -- --debug
```

### Limpiar datos de prueba

```bash
# Ejecutar script de limpieza
npx ts-node scripts/cleanup-test-data.ts
```

---

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs en Supabase Dashboard
2. Verifica que DATABASE_URL es correcto
3. Ejecuta `npm run test -- --reporter=verbose` para más detalles
4. Revisa `.kiro/testing/MULTI_TENANT_TESTING_STRATEGY.md` para más información

---

**¡Listo! Ahora ejecuta:** `bash scripts/run-all-multi-tenant-tests.sh` 🚀
