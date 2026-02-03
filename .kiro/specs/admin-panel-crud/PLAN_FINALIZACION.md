# Plan de Finalización - Admin Panel CRUD

**Objetivo:** Completar Admin Panel CRUD al 100% en 2 sesiones  
**Sesión Actual:** Implementar Tests (Task 14)  
**Sesión Siguiente:** Final Checkpoint (Task 15)

---

## 📋 SESIÓN 1: IMPLEMENTAR TESTS (Task 14)

### 14.1 Implementar Property Tests Faltantes (1.5 horas)

#### Property 18: Promotion Type Validation
**Archivo:** `src/app/admin/__tests__/promotions.property.test.ts`  
**Descripción:** Validar que solo tipos válidos de promoción son aceptados

```typescript
describe('Property 18: Promotion Type Validation', () => {
  it('invalid promotion types are rejected', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !['PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO'].includes(s)),
        (invalidType) => {
          // Should reject invalid type
          expect(() => {
            CreatePromotionSchema.parse({
              name: 'Test',
              type: invalidType,
              value: 10,
              starts_at: new Date().toISOString(),
              ends_at: new Date(Date.now() + 86400000).toISOString(),
            });
          }).toThrow();
        }
      )
    );
  });
});
```

#### Property 24: Driver Required Field Validation
**Archivo:** `src/app/admin/__tests__/drivers.property.test.ts` (crear)  
**Descripción:** Validar que name es requerido pero phone es opcional

```typescript
describe('Property 24: Driver Required Field Validation', () => {
  it('name is required, phone is optional', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 9 }), { freq: 2 }),
        (phone) => {
          // Should accept with phone
          if (phone) {
            expect(() => {
              CreateDriverSchema.parse({ name: 'John', phone });
            }).not.toThrow();
          }
          
          // Should accept without phone
          expect(() => {
            CreateDriverSchema.parse({ name: 'John' });
          }).not.toThrow();
          
          // Should reject without name
          expect(() => {
            CreateDriverSchema.parse({ phone });
          }).toThrow();
        }
      )
    );
  });
});
```

#### Property 29: Configuration Value Validation
**Archivo:** `src/app/admin/__tests__/config.property.test.ts`  
**Descripción:** Validar que todos los valores de configuración pasan validación

```typescript
describe('Property 29: Configuration Value Validation', () => {
  it('invalid configuration values are rejected', () => {
    fc.assert(
      fc.property(
        fc.record({
          business_name: fc.string({ minLength: 1 }),
          business_phone: fc.string({ minLength: 9 }),
          timezone: fc.constantFrom('America/Lima', 'America/New_York'),
          currency: fc.constantFrom('PEN', 'USD'),
        }),
        (config) => {
          // Should accept valid config
          expect(() => {
            ConfigSchema.parse(config);
          }).not.toThrow();
        }
      )
    );
  });
});
```

#### Property 31: Configuration Range Validation
**Archivo:** `src/app/admin/__tests__/config.property.test.ts`  
**Descripción:** Validar que valores numéricos están dentro de rangos aceptables

```typescript
describe('Property 31: Configuration Range Validation', () => {
  it('numeric config values must be within acceptable ranges', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (discountPercent) => {
          // Should accept valid range
          expect(() => {
            ConfigSchema.parse({
              business_name: 'Test',
              business_phone: '123456789',
              timezone: 'America/Lima',
              currency: 'PEN',
              default_discount_percent: discountPercent,
            });
          }).not.toThrow();
        }
      )
    );
  });
});
```

#### Property 33: Role-Based Access Control
**Archivo:** `src/app/admin/__tests__/permissions.property.test.ts`  
**Descripción:** Validar que solo ADMIN/MANAGER pueden hacer operaciones

```typescript
describe('Property 33: Role-Based Access Control', () => {
  it('only ADMIN/MANAGER roles can perform restricted operations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('CASHIER', 'WAITER', 'KITCHEN', 'DRIVER'),
        (restrictedRole) => {
          // Should reject non-admin roles
          const authResult = {
            authorized: false,
            user: { id: 'test', role: restrictedRole },
            response: new NextResponse(
              JSON.stringify({ error: 'Unauthorized' }),
              { status: 403 }
            ),
          };
          
          expect(authResult.authorized).toBe(false);
          expect(authResult.response.status).toBe(403);
        }
      )
    );
  });
});
```

#### Property 34: Unauthorized Access Error Code
**Archivo:** `src/app/admin/__tests__/permissions.property.test.ts`  
**Descripción:** Validar que acceso no autorizado retorna 403

```typescript
describe('Property 34: Unauthorized Access Error Code', () => {
  it('unauthorized requests return 403 Forbidden', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('POST', 'PUT', 'DELETE', 'PATCH'),
        (method) => {
          // Should return 403 for unauthorized
          const response = new NextResponse(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403 }
          );
          
          expect(response.status).toBe(403);
        }
      )
    );
  });
});
```

### 14.2 Implementar Unit Tests para APIs (2 horas)

#### Promotion API Unit Tests
**Archivo:** `src/app/admin/__tests__/promotions.unit.test.ts` (crear)

```typescript
describe('Promotions API - Unit Tests', () => {
  describe('POST /api/admin/promotions', () => {
    it('creates promotion with valid data', async () => {
      // Test successful creation
    });
    
    it('rejects invalid date range', async () => {
      // Test date validation
    });
    
    it('rejects invalid promotion type', async () => {
      // Test type validation
    });
  });
  
  describe('PUT /api/admin/promotions/[id]', () => {
    it('updates promotion with valid data', async () => {
      // Test successful update
    });
    
    it('rejects non-existent promotion', async () => {
      // Test 404 response
    });
  });
  
  describe('DELETE /api/admin/promotions/[id]', () => {
    it('soft deletes promotion', async () => {
      // Test soft delete
    });
  });
});
```

#### Driver API Unit Tests
**Archivo:** `src/app/admin/__tests__/drivers.unit.test.ts` (crear)

```typescript
describe('Drivers API - Unit Tests', () => {
  describe('POST /api/drivers', () => {
    it('creates driver with name only', async () => {
      // Test creation without phone
    });
    
    it('creates driver with name and phone', async () => {
      // Test creation with phone
    });
    
    it('rejects driver without name', async () => {
      // Test validation
    });
  });
  
  describe('PATCH /api/drivers/[id]', () => {
    it('updates driver with valid data', async () => {
      // Test successful update
    });
    
    it('rejects non-existent driver', async () => {
      // Test 404 response
    });
  });
  
  describe('DELETE /api/drivers/[id]', () => {
    it('soft deletes driver', async () => {
      // Test soft delete
    });
  });
});
```

#### Configuration API Unit Tests
**Archivo:** `src/app/admin/__tests__/config.unit.test.ts` (crear)

```typescript
describe('Configuration API - Unit Tests', () => {
  describe('PUT /api/admin/config', () => {
    it('updates configuration with valid data', async () => {
      // Test successful update
    });
    
    it('rejects invalid configuration values', async () => {
      // Test validation
    });
    
    it('rejects out-of-range numeric values', async () => {
      // Test range validation
    });
    
    it('logs audit trail with old and new values', async () => {
      // Test audit logging
    });
  });
});
```

### 14.3 Implementar E2E Tests (2 horas)

#### Employee CRUD E2E Test
**Archivo:** `e2e/admin-panel-employee-crud.spec.ts` (crear)

```typescript
test.describe('Employee CRUD Flow', () => {
  test('complete create → edit → deactivate flow', async ({ page }) => {
    // 1. Login
    // 2. Navigate to employees
    // 3. Create new employee
    // 4. Verify employee appears in list
    // 5. Edit employee
    // 6. Verify changes saved
    // 7. Deactivate employee
    // 8. Verify employee marked as inactive
  });
  
  test('permission denied for non-admin users', async ({ page }) => {
    // 1. Login as CASHIER
    // 2. Try to access create employee
    // 3. Verify 403 error
  });
});
```

#### Product CRUD E2E Test
**Archivo:** `e2e/admin-panel-product-crud.spec.ts` (crear)

```typescript
test.describe('Product CRUD Flow', () => {
  test('complete create → edit → deactivate flow', async ({ page }) => {
    // 1. Login
    // 2. Navigate to products
    // 3. Create new product
    // 4. Verify price stored as integer
    // 5. Edit product
    // 6. Verify catalog version incremented
    // 7. Deactivate product
    // 8. Verify product marked as inactive
  });
});
```

#### Promotion CRUD E2E Test
**Archivo:** `e2e/admin-panel-promotion-crud.spec.ts` (crear)

```typescript
test.describe('Promotion CRUD Flow', () => {
  test('complete create → edit → deactivate flow', async ({ page }) => {
    // 1. Login
    // 2. Navigate to promotions
    // 3. Create new promotion
    // 4. Verify date range validation
    // 5. Edit promotion
    // 6. Verify changes saved
    // 7. Deactivate promotion
    // 8. Verify promotion marked as inactive
  });
});
```

#### Driver CRUD E2E Test
**Archivo:** `e2e/admin-panel-driver-crud.spec.ts` (crear)

```typescript
test.describe('Driver CRUD Flow', () => {
  test('complete create → edit → deactivate flow', async ({ page }) => {
    // 1. Login
    // 2. Navigate to drivers
    // 3. Create new driver
    // 4. Verify driver appears in list
    // 5. Edit driver
    // 6. Verify changes saved
    // 7. Deactivate driver
    // 8. Verify driver marked as inactive
  });
});
```

### 14.4 Verificar Requirements Completeness (1 hora)

**Checklist:**

- [ ] Requirement 1: Employee CRUD Operations
  - [ ] 1.1 PIN uniqueness validation
  - [ ] 1.2 PIN hashing with SHA-256
  - [ ] 1.3 Field-level permissions (no PIN changes)
  - [ ] 1.4 Soft delete
  - [ ] 1.5 Role validation
  - [ ] 1.6 Audit trail logging
  - [ ] 1.7 Confirmation dialog
  - [ ] 1.8 List display

- [ ] Requirement 2: Product CRUD Operations
  - [ ] 2.1 SKU uniqueness validation
  - [ ] 2.2 Price as integer centavos
  - [ ] 2.3 All fields updatable
  - [ ] 2.4 Soft delete
  - [ ] 2.5 Category validation
  - [ ] 2.6 Station validation
  - [ ] 2.7 Catalog version increment
  - [ ] 2.8 Audit trail logging
  - [ ] 2.9 Confirmation dialog
  - [ ] 2.10 List display

- [ ] Requirement 3: Promotion CRUD Operations
  - [ ] 3.1 Date range validation
  - [ ] 3.2 Type validation
  - [ ] 3.3 All fields updatable
  - [ ] 3.4 Soft delete
  - [ ] 3.5 Auto-deactivate expired
  - [ ] 3.6 Audit trail logging
  - [ ] 3.7 Confirmation dialog
  - [ ] 3.8 List display
  - [ ] 3.9 JSON rules validation

- [ ] Requirement 4: Driver CRUD Operations
  - [ ] 4.1 Name required, phone optional
  - [ ] 4.2 All fields updatable
  - [ ] 4.3 Soft delete
  - [ ] 4.4 Audit trail logging
  - [ ] 4.5 Confirmation dialog
  - [ ] 4.6 List display

- [ ] Requirement 5: Configuration Edit
  - [ ] 5.1 Value validation
  - [ ] 5.2 Confirmation for critical settings
  - [ ] 5.3 Audit trail with old/new values
  - [ ] 5.4 Display current values
  - [ ] 5.5 Range validation

- [ ] Requirement 6: Form Validation & UX
  - [ ] 6.1 Field-specific error messages
  - [ ] 6.2 Loading indicators
  - [ ] 6.3 Success feedback
  - [ ] 6.4 Error handling
  - [ ] 6.5 Client & server validation
  - [ ] 6.6 Modal forms
  - [ ] 6.7 Design pattern consistency

- [ ] Requirement 7: Permission & Security
  - [ ] 7.1 ADMIN/MANAGER only
  - [ ] 7.2 403 Forbidden for unauthorized
  - [ ] 7.3 Client & server permission checks
  - [ ] 7.4 Audit trail with actor_id

- [ ] Requirement 8: Data Integrity
  - [ ] 8.1 Transaction atomicity
  - [ ] 8.2 Rollback on failure
  - [ ] 8.3 Foreign key constraints
  - [ ] 8.4 Dependency checking
  - [ ] 8.5 In-use record protection

- [ ] Requirement 9: Offline-First (OPCIONAL)
  - [ ] 9.1 Operation queueing
  - [ ] 9.2 Automatic sync
  - [ ] 9.3 Sync status indicators
  - [ ] 9.4 Conflict resolution

- [ ] Requirement 10: API Endpoints
  - [ ] 10.1-10.13 All endpoints exist
  - [ ] 10.14 Correct status codes (200, 201, 204)
  - [ ] 10.15 Error codes (400, 403, 404, 409, 500)

---

## 📊 SESIÓN 2: FINAL CHECKPOINT (Task 15)

### 15.1 Ejecutar Todos los Tests
```bash
npm test
npm run test:e2e
```

**Objetivo:** 100% de tests pasando

### 15.2 Verificar TypeScript
```bash
npx tsc --noEmit
```

**Objetivo:** 0 errores de TypeScript

### 15.3 Verificar Build
```bash
npm run build
```

**Objetivo:** Build exitoso sin errores

### 15.4 Verificar Dev Server
```bash
npm run dev
```

**Objetivo:** Dev server arranca sin errores

### 15.5 Verificación Manual
- [ ] Login como ADMIN
- [ ] Crear employee
- [ ] Editar employee
- [ ] Deactivar employee
- [ ] Crear product
- [ ] Editar product
- [ ] Deactivar product
- [ ] Crear promotion
- [ ] Editar promotion
- [ ] Deactivate promotion
- [ ] Crear driver
- [ ] Editar driver
- [ ] Deactivate driver
- [ ] Editar configuration
- [ ] Verificar audit trail

### 15.6 Documentación Final
- [ ] Actualizar README con instrucciones
- [ ] Documentar API endpoints
- [ ] Documentar frontend components
- [ ] Documentar testing strategy

---

## ⏱️ ESTIMACIÓN DE TIEMPO

| Tarea | Tiempo | Prioridad |
|-------|--------|-----------|
| 14.1 Property Tests | 1.5h | 🔴 CRÍTICO |
| 14.2 Unit Tests | 2h | 🔴 CRÍTICO |
| 14.3 E2E Tests | 2h | 🟡 ALTO |
| 14.4 Requirements Check | 1h | 🟡 ALTO |
| **Sesión 1 Total** | **6.5h** | |
| 15.1-15.6 Final Checkpoint | 2h | 🟡 ALTO |
| **Sesión 2 Total** | **2h** | |
| **TOTAL** | **8.5h** | |

---

## 🎯 CRITERIOS DE ÉXITO

✅ **Sesión 1 Completada:**
- [ ] 11/11 property tests implementados
- [ ] 15/15 unit tests implementados
- [ ] 5/5 E2E tests implementados
- [ ] Todos los tests pasando
- [ ] 0 errores de TypeScript
- [ ] Build exitoso

✅ **Sesión 2 Completada:**
- [ ] Todos los tests pasando
- [ ] Build exitoso
- [ ] Dev server funciona
- [ ] Verificación manual completada
- [ ] Documentación actualizada
- [ ] Admin Panel CRUD 100% COMPLETO

---

## 📝 NOTAS

- Usar fast-check para property tests
- Usar vitest para unit tests
- Usar Playwright para E2E tests
- Seguir patrón de tests existentes
- Mantener cobertura >80%
- Documentar cada test con comentarios

