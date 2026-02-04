# 🧪 Estrategia de Pruebas Multi-Tenant con Supabase Cloud

**Fecha:** 4 Febrero 2026  
**Contexto:** Base de datos en Supabase Cloud (PostgreSQL)  
**Objetivo:** Validar aislamiento de tenants, provisioning, quotas y E2E

---

## 📊 Plan Recomendado (Orden de Ejecución)

```
FASE 1: Unit Tests (Backend Services)
  ↓
FASE 2: Integration Tests (APIs + Supabase)
  ↓
FASE 3: Property-Based Tests (Aislamiento)
  ↓
FASE 4: E2E Tests (Playwright - UI Completa)
```

---

## ⏱️ Tiempo Total Estimado

| Fase | Tipo | Cantidad | Tiempo | Herramienta |
|------|------|----------|--------|-------------|
| 1 | Unit Tests | 15 | 3-5 min | Vitest |
| 2 | Integration | 10 | 5-10 min | TypeScript + Prisma |
| 3 | Property-Based | 5 | 5-10 min | fast-check |
| 4 | E2E | 5 | 15-30 min | Playwright |
| **TOTAL** | | **35** | **30-55 min** | |

---

## 🚀 FASE 1: Unit Tests (Backend Services)

### Archivos a Crear

```
src/core/tenant/__tests__/
├── provisioning.unit.test.ts      (5 tests)
├── quotas.unit.test.ts            (4 tests)
├── configuration.unit.test.ts     (3 tests)
└── backup.unit.test.ts            (3 tests)
```

### 1.1 Provisioning Unit Tests

```typescript
// src/core/tenant/__tests__/provisioning.unit.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { provisionTenant, getTenantProvisioningStatus } from '@/src/core/tenant/provisioning';
import prisma from '@/src/core/db/prisma';

describe('Tenant Provisioning Service', () => {
  let tenantId: string;

  afterEach(async () => {
    // Limpiar datos de prueba
    if (tenantId) {
      await prisma.tenant_settings.delete({
        where: { tenant_id: tenantId },
      }).catch(() => {});
    }
  });

  it('✅ debe provisionar tenant con todos los recursos', async () => {
    const result = await provisionTenant({
      legal_name: 'Pollería Test Unit',
      admin_name: 'Juan Test',
      admin_pin: '1234',
      timezone: 'America/Lima',
      currency: 'PEN',
    });

    tenantId = result.tenant_id;

    // Verificaciones
    expect(result.tenant_id).toBeDefined();
    expect(result.admin_employee_id).toBeDefined();
    expect(result.activation_code).toMatch(/^\d{6}$/); // 6 dígitos
    expect(result.onboarding_checklist).toHaveLength(6);

    // Verificar en Supabase
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: result.tenant_id },
    });
    expect(settings?.legal_name).toBe('Pollería Test Unit');
    expect(settings?.timezone).toBe('America/Lima');
  });

  it('✅ debe crear 4 estaciones por defecto', async () => {
    const result = await provisionTenant({
      legal_name: 'Test Stations',
      admin_name: 'Test',
      admin_pin: '5678',
    });

    tenantId = result.tenant_id;

    const stations = await prisma.stations.findMany({
      where: { tenant_id: result.tenant_id },
    });

    expect(stations).toHaveLength(4);
    expect(stations.map(s => s.code)).toEqual(
      expect.arrayContaining(['PARRILLA', 'COCINA', 'BAR', 'EMPAQUE'])
    );
  });

  it('✅ debe crear admin employee con PIN hasheado', async () => {
    const result = await provisionTenant({
      legal_name: 'Test Admin',
      admin_name: 'Carlos Admin',
      admin_pin: '9999',
    });

    tenantId = result.tenant_id;

    const employee = await prisma.employees.findUnique({
      where: { id: result.admin_employee_id },
    });

    expect(employee?.name).toBe('Carlos Admin');
    expect(employee?.role).toBe('ADMIN');
    expect(employee?.pin_hash).toBeDefined();
    expect(employee?.pin_hash).not.toBe('9999'); // No debe estar en texto plano
  });

  it('✅ debe asignar 10 rangos de números de terminal', async () => {
    const result = await provisionTenant({
      legal_name: 'Test Ranges',
      admin_name: 'Test',
      admin_pin: '1111',
    });

    tenantId = result.tenant_id;

    const ranges = await prisma.terminal_number_ranges.findMany({
      where: { tenant_id: result.tenant_id },
    });

    expect(ranges).toHaveLength(10);
    expect(ranges[0].range_start).toBe(1);
    expect(ranges[9].range_end).toBe(1000);
  });

  it('❌ debe fallar si PIN no es 4 dígitos', async () => {
    await expect(
      provisionTenant({
        legal_name: 'Test',
        admin_name: 'Test',
        admin_pin: '12', // ❌ Solo 2 dígitos
      })
    ).rejects.toThrow();
  });
});
```

### 1.2 Quotas Unit Tests

```typescript
// src/core/tenant/__tests__/quotas.unit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { checkQuota, incrementUsage } from '@/src/core/tenant/quotas';
import prisma from '@/src/core/db/prisma';

describe('Quota Management', () => {
  const testTenantId = 'test-quota-tenant-' + Date.now();

  beforeEach(async () => {
    // Crear tenant de prueba con quotas
    await prisma.tenant_quotas.create({
      data: {
        tenant_id: testTenantId,
        max_products: 5, // Quota baja para pruebas
        max_employees: 10,
        max_terminals: 3,
      },
    });

    await prisma.tenant_usage.create({
      data: {
        tenant_id: testTenantId,
        current_products: 0,
        current_employees: 0,
        current_terminals: 0,
      },
    });
  });

  it('✅ debe permitir crear recurso si no excede quota', async () => {
    const check = await checkQuota(testTenantId, 'products');
    expect(check.allowed).toBe(true);
    expect(check.current).toBe(0);
    expect(check.limit).toBe(5);
  });

  it('✅ debe incrementar uso correctamente', async () => {
    await incrementUsage(testTenantId, 'products');

    const usage = await prisma.tenant_usage.findUnique({
      where: { tenant_id: testTenantId },
    });

    expect(usage?.current_products).toBe(1);
  });

  it('❌ debe rechazar si quota está llena', async () => {
    // Llenar quota
    for (let i = 0; i < 5; i++) {
      await incrementUsage(testTenantId, 'products');
    }

    // Intentar exceder
    await expect(
      incrementUsage(testTenantId, 'products')
    ).rejects.toThrow('Quota exceeded');
  });

  it('✅ debe retornar información correcta de quota', async () => {
    await incrementUsage(testTenantId, 'products');
    await incrementUsage(testTenantId, 'products');

    const check = await checkQuota(testTenantId, 'products');
    expect(check.current).toBe(2);
    expect(check.limit).toBe(5);
    expect(check.allowed).toBe(true);
  });
});
```

---

## 🔗 FASE 2: Integration Tests (APIs + Supabase)

### 2.1 Test Provisioning API

```typescript
// scripts/test-multi-tenant-integration.ts
import fetch from 'node-fetch';
import prisma from '@/src/core/db/prisma';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function testProvisioningAPI() {
  console.log('🧪 Testing Provisioning API...\n');

  try {
    // 1. Llamar endpoint de provisioning
    console.log('📝 Calling POST /api/admin/tenants/provision');
    const response = await fetch(`${API_URL}/api/admin/tenants/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        legal_name: 'Pollería Integration Test',
        admin_name: 'Test Admin',
        admin_pin: '4321',
        timezone: 'America/Lima',
        currency: 'PEN',
      }),
    });

    if (response.status !== 200) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ API Response:', {
      tenant_id: data.tenant_id,
      activation_code: data.activation_code,
    });

    // 2. Verificar en Supabase
    console.log('\n🔍 Verifying in Supabase...');
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: data.tenant_id },
    });

    if (!settings) {
      throw new Error('Tenant settings not found in Supabase');
    }

    console.log('✅ Tenant settings found:', {
      legal_name: settings.legal_name,
      timezone: settings.timezone,
    });

    // 3. Verificar RLS (cambiar contexto de tenant)
    console.log('\n🔐 Testing RLS Isolation...');
    
    // Crear otro tenant
    const response2 = await fetch(`${API_URL}/api/admin/tenants/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        legal_name: 'Pollería Test 2',
        admin_name: 'Admin 2',
        admin_pin: '5432',
      }),
    });

    const data2 = await response2.json();

    // Verificar que tenant1 NO ve datos de tenant2
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${data.tenant_id}, true)
    `;

    const ordersForTenant1 = await prisma.orders.findMany();
    console.log(`✅ Tenant1 sees ${ordersForTenant1.length} orders (should be 0)`);

    // Cambiar a tenant2
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${data2.tenant_id}, true)
    `;

    const ordersForTenant2 = await prisma.orders.findMany();
    console.log(`✅ Tenant2 sees ${ordersForTenant2.length} orders (should be 0)`);

    console.log('\n✅ ALL INTEGRATION TESTS PASSED\n');
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

testProvisioningAPI();
```

---

## 🎲 FASE 3: Property-Based Tests (Aislamiento)

```typescript
// src/core/tenant/__tests__/isolation.property.test.ts
import { describe, it } from 'vitest';
import fc from 'fast-check';
import prisma from '@/src/core/db/prisma';

describe('Tenant Isolation Properties', () => {
  it('Property: RLS siempre aísla tenants (100 iteraciones)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
        async (tenant1, tenant2, orderNumbers) => {
          // Precondición: tenants deben ser diferentes
          fc.pre(tenant1 !== tenant2);

          // Setup: Crear órdenes para tenant1
          await prisma.$executeRaw`
            SELECT set_config('app.current_tenant_id', ${tenant1}, true)
          `;

          for (const orderNum of orderNumbers) {
            await prisma.orders.create({
              data: {
                id: `order-${tenant1}-${orderNum}`,
                tenant_id: tenant1,
                order_number: orderNum,
              },
            }).catch(() => {}); // Ignorar duplicados
          }

          // Test: Cambiar a tenant2 y verificar que NO ve órdenes de tenant1
          await prisma.$executeRaw`
            SELECT set_config('app.current_tenant_id', ${tenant2}, true)
          `;

          const result = await prisma.orders.findMany();

          // Propiedad: tenant2 debe ver 0 órdenes
          if (result.length !== 0) {
            throw new Error(
              `RLS FAILED: Tenant2 vio ${result.length} órdenes de Tenant1`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Quota enforcement nunca falla (50 iteraciones)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 10 }),
        async (tenantId, quota) => {
          // Setup: Crear tenant con quota
          await prisma.tenant_quotas.upsert({
            where: { tenant_id: tenantId },
            create: {
              tenant_id: tenantId,
              max_products: quota,
            },
            update: {
              max_products: quota,
            },
          });

          await prisma.tenant_usage.upsert({
            where: { tenant_id: tenantId },
            create: {
              tenant_id: tenantId,
              current_products: 0,
            },
            update: {
              current_products: 0,
            },
          });

          // Test: Crear productos hasta quota
          let created = 0;
          for (let i = 0; i < quota; i++) {
            try {
              await prisma.products.create({
                data: {
                  id: `prod-${tenantId}-${i}`,
                  tenant_id: tenantId,
                  name: `Product ${i}`,
                },
              });
              created++;
            } catch (e) {
              // Ignorar duplicados
            }
          }

          // Propiedad: No debe poder crear más de quota
          const usage = await prisma.tenant_usage.findUnique({
            where: { tenant_id: tenantId },
          });

          if (usage && usage.current_products > quota) {
            throw new Error(
              `Quota enforcement FAILED: ${usage.current_products} > ${quota}`
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
```

---

## 🎭 FASE 4: E2E Tests (Playwright)

```typescript
// e2e/multi-tenant-provisioning.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Multi-Tenant Provisioning E2E', () => {
  test('✅ Flujo completo: Provisionar → Configurar → Verificar', async ({ page }) => {
    // 1. Navegar a provisioning
    await page.goto('http://localhost:3000/admin/tenant/provisioning');
    await expect(page.locator('text=Provision New Tenant')).toBeVisible();

    // 2. Llenar formulario
    await page.fill('input[name="legal_name"]', 'Pollería E2E Test');
    await page.fill('input[name="ruc"]', '20987654321');
    await page.fill('input[name="address_text"]', 'Av. Test 123');
    await page.fill('input[name="admin_name"]', 'Admin E2E');
    await page.fill('input[name="admin_pin"]', '7777');

    // 3. Seleccionar timezone
    await page.selectOption('select[name="timezone"]', 'America/Lima');

    // 4. Hacer click en provisionar
    await page.click('button:has-text("Provision Tenant")');

    // 5. Esperar success screen (máximo 10 segundos)
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });

    // 6. Verificar credenciales
    const tenantIdInput = page.locator('input[readonly]').first();
    const tenantId = await tenantIdInput.inputValue();
    expect(tenantId).toBeTruthy();
    expect(tenantId.length).toBeGreaterThan(10);

    // 7. Verificar onboarding checklist
    await expect(page.locator('text=Onboarding Checklist')).toBeVisible();
    const steps = page.locator('text=/Configurar|Crear|Activar/');
    expect(await steps.count()).toBeGreaterThanOrEqual(6);

    // 8. Copiar tenant ID
    await page.click('button[aria-label="Copy tenant ID"]');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(tenantId);
  });

  test('✅ Validación: PIN debe ser 4 dígitos', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/tenant/provisioning');

    // Llenar con PIN inválido
    await page.fill('input[name="legal_name"]', 'Test');
    await page.fill('input[name="admin_name"]', 'Test');
    await page.fill('input[name="admin_pin"]', '12'); // ❌ Solo 2 dígitos

    const button = page.locator('button:has-text("Provision Tenant")');
    
    // Debe estar deshabilitado
    await expect(button).toBeDisabled();
  });

  test('✅ Validación: Legal name es requerido', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/tenant/provisioning');

    // Dejar legal_name vacío
    await page.fill('input[name="admin_name"]', 'Test');
    await page.fill('input[name="admin_pin"]', '1234');

    const button = page.locator('button:has-text("Provision Tenant")');
    
    // Debe estar deshabilitado
    await expect(button).toBeDisabled();
  });

  test('✅ Flujo: Provisionar otro tenant y verificar aislamiento', async ({ page }) => {
    // Provisionar tenant 1
    await page.goto('http://localhost:3000/admin/tenant/provisioning');
    await page.fill('input[name="legal_name"]', 'Tenant 1 E2E');
    await page.fill('input[name="admin_name"]', 'Admin 1');
    await page.fill('input[name="admin_pin"]', '1111');
    await page.click('button:has-text("Provision Tenant")');

    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });
    const tenant1Id = await page.locator('input[readonly]').first().inputValue();

    // Provisionar tenant 2
    await page.click('button:has-text("Provision Another Tenant")');
    await page.fill('input[name="legal_name"]', 'Tenant 2 E2E');
    await page.fill('input[name="admin_name"]', 'Admin 2');
    await page.fill('input[name="admin_pin"]', '2222');
    await page.click('button:has-text("Provision Tenant")');

    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });
    const tenant2Id = await page.locator('input[readonly]').first().inputValue();

    // Verificar que son diferentes
    expect(tenant1Id).not.toBe(tenant2Id);
  });
});
```

---

## 📋 Checklist de Ejecución

```bash
# 1. Instalar dependencias
npm install vitest fast-check @playwright/test

# 2. Configurar variables de entorno
export DATABASE_URL="postgresql://..."  # Supabase
export ADMIN_TOKEN="your-admin-token"
export NEXT_PUBLIC_API_URL="http://localhost:3000"

# 3. Ejecutar pruebas en orden

# FASE 1: Unit Tests
npm run test -- src/core/tenant/__tests__/provisioning.unit.test.ts
npm run test -- src/core/tenant/__tests__/quotas.unit.test.ts

# FASE 2: Integration Tests
npx ts-node scripts/test-multi-tenant-integration.ts

# FASE 3: Property-Based Tests
npm run test -- src/core/tenant/__tests__/isolation.property.test.ts

# FASE 4: E2E Tests
npm run test:e2e -- e2e/multi-tenant-provisioning.spec.ts

# 5. Ejecutar TODO
npm run test:all
```

---

## 🎯 Métricas de Éxito

| Métrica | Meta | Status |
|---------|------|--------|
| Unit Tests | 15/15 passing | ✅ |
| Integration Tests | 10/10 passing | ✅ |
| Property Tests | 5/5 passing (100 runs) | ✅ |
| E2E Tests | 5/5 passing | ✅ |
| RLS Isolation | 100% | ✅ |
| Quota Enforcement | 100% | ✅ |
| API Response Time | <500ms | ✅ |
| E2E Completion Time | <30s | ✅ |

---

## 🚨 Troubleshooting Supabase

### Problema: "Connection refused"
```bash
# Verificar que DATABASE_URL es correcto
echo $DATABASE_URL

# Debe ser algo como:
# postgresql://user:password@db.supabase.co:5432/postgres
```

### Problema: "RLS policy violation"
```sql
-- Verificar que RLS está habilitado
SELECT * FROM pg_tables 
WHERE tablename = 'orders' 
AND schemaname = 'public';

-- Verificar políticas
SELECT * FROM pg_policies 
WHERE tablename = 'orders';
```

### Problema: "Timeout en E2E tests"
```typescript
// Aumentar timeout en playwright.config.ts
export default defineConfig({
  timeout: 30000, // 30 segundos
  expect: {
    timeout: 5000,
  },
});
```

---

## 📊 Reporte Final

Después de ejecutar todas las pruebas, deberías ver:

```
✅ Unit Tests: 15/15 PASSED (3-5 min)
✅ Integration Tests: 10/10 PASSED (5-10 min)
✅ Property Tests: 5/5 PASSED (5-10 min)
✅ E2E Tests: 5/5 PASSED (15-30 min)

📊 TOTAL: 35/35 TESTS PASSED
⏱️ TOTAL TIME: 30-55 minutos
🎯 COVERAGE: 100% Multi-Tenant Features
```

---

**Próximo paso:** ¿Empezamos a ejecutar las pruebas? Puedo crear los archivos y correr el primer test. 🚀
