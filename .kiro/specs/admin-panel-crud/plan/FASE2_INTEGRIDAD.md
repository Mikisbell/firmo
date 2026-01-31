# FASE 2: INTEGRIDAD DE DATOS (60 horas)

**Duración:** Días 6-12 (Semana 2)  
**Objetivo:** Datos consistentes y validados  
**Bloqueante:** Parcial

---

## DÍA 6: Validación de tenant_id (12h)

### TODO EL DÍA: Refactor tenant_id

#### Dev 1: Centralizar Configuración (6h)

**08:00-09:00 (1h)** - Auditoría
- [ ] Buscar todos los usos de `process.env.TENANT_ID`
  ```bash
  grep -r "process.env.TENANT_ID" src/app/api/
  ```
- [ ] Listar archivos afectados (30+ archivos)
- [ ] Identificar diferentes defaults usados

**09:00-10:00 (1h)** - Centralizar constante
- [ ] Verificar `src/core/config/terminal.ts`
- [ ] Confirmar que existe `DEFAULT_TENANT_ID`
- [ ] Si no existe, crear:
  ```typescript
  export const DEFAULT_TENANT_ID = 
    process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  ```

**10:00-12:00 (2h)** - Reemplazar en endpoints (Parte 1)
- [ ] Employees endpoints (4 archivos)
- [ ] Products endpoints (4 archivos)
- [ ] Promotions endpoints (4 archivos)
- [ ] Reemplazar:
  ```typescript
  // ❌ Antes
  const TENANT_ID = process.env.TENANT_ID || 'default';
  
  // ✅ Después
  import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';
  ```

**13:00-15:00 (2h)** - Reemplazar en endpoints (Parte 2)
- [ ] Delivery endpoints (6 archivos)
- [ ] Analytics endpoints (8 archivos)
- [ ] Admin endpoints restantes (10 archivos)

**15:00-16:00 (1h)** - Verificación
- [ ] Compilar proyecto
- [ ] Buscar usos restantes de `process.env.TENANT_ID`
- [ ] Verificar que todos usan `DEFAULT_TENANT_ID`
- [ ] Commit cambios

---

#### Dev 2: Usar tenant del JWT (6h)

**08:00-10:00 (2h)** - Modificar requireAdminAuth
- [ ] Actualizar `src/core/middleware/admin-auth.ts`
- [ ] Retornar `tenantId` en el objeto `user`
- [ ] Verificar que viene del JWT payload (`tid`)
- [ ] Tests unitarios

**10:00-12:00 (2h)** - Actualizar endpoints (Parte 1)
- [ ] Employees POST/PUT/DELETE
- [ ] Usar `authResult.user.tenantId` en vez de `DEFAULT_TENANT_ID`
  ```typescript
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  
  const tenantId = authResult.user.tenantId; // Del JWT
  ```
- [ ] Products POST/PUT/DELETE
- [ ] Promotions POST/PUT/DELETE

**13:00-15:00 (2h)** - Actualizar endpoints (Parte 2)
- [ ] Tables POST/PUT/DELETE
- [ ] Zones POST/PUT/DELETE
- [ ] Config POST/PUT
- [ ] Delivery POST/PUT/DELETE

**15:00-16:00 (1h)** - Tests de integración
- [ ] Test: tenant del JWT se usa correctamente
- [ ] Test: usuario de tenant A no puede acceder a datos de tenant B
- [ ] Test: error si JWT no tiene `tid`

---

## DÍA 7: Soft Delete + Transacciones (10h)

### MAÑANA (5h): Soft Delete Consistency

#### Dev 1: Filtrar is_active (5h)

**08:00-09:00 (1h)** - Auditoría
- [ ] Buscar todos los `findMany` sin filtro `is_active`
- [ ] Listar endpoints afectados
- [ ] Priorizar por impacto

**09:00-11:00 (2h)** - Agregar filtro (Parte 1)
- [ ] Employees GET
  ```typescript
  const employees = await prisma.employees.findMany({
    where: { 
      tenant_id: tenantId,
      is_active: true, // ✅ Agregar
    },
  });
  ```
- [ ] Products GET
- [ ] Promotions GET
- [ ] Tables GET

**11:00-12:00 (1h)** - Agregar filtro (Parte 2)
- [ ] Drivers GET
- [ ] Zones GET
- [ ] Terminals GET

**12:00-13:00 (1h)** - Parámetro opcional
- [ ] Agregar query param `show_inactive=true`
- [ ] Implementar en Employees
- [ ] Implementar en Products
- [ ] Tests

---

### TARDE (5h): Transacciones

#### Dev 2: Agregar Transacciones (5h)

**13:00-14:00 (1h)** - Auditoría
- [ ] Buscar operaciones sin transacción
- [ ] Identificar operaciones críticas:
  - Crear producto + incrementar catalog_version + audit log
  - Crear empleado + audit log
  - Crear promoción + audit log

**14:00-15:30 (1.5h)** - Products
- [ ] Verificar que POST ya usa transacción
- [ ] Verificar que PUT usa transacción
- [ ] Si no, envolver en `prisma.$transaction()`
- [ ] Tests: verificar rollback si falla

**15:30-17:00 (1.5h)** - Employees
- [ ] Verificar que POST ya usa transacción
- [ ] Verificar que PUT usa transacción
- [ ] Si no, envolver en `prisma.$transaction()`
- [ ] Tests: verificar rollback si falla

**17:00-18:00 (1h)** - Promotions + Config
- [ ] Verificar transacciones en Promotions
- [ ] Verificar transacciones en Config
- [ ] Tests de integración

---

## DÍA 8: Business Rules Generales (8h)

### TODO EL DÍA: Validaciones

#### Dev 1: Products Validations (4h)

**08:00-09:00 (1h)** - Precio negativo
- [ ] Agregar validación en POST
  ```typescript
  if (data.price_cents < 0) {
    return NextResponse.json(
      { error: 'El precio no puede ser negativo' },
      { status: 400 }
    );
  }
  ```
- [ ] Agregar validación en PUT
- [ ] Tests

**09:00-10:00 (1h)** - Precio máximo
- [ ] Agregar validación precio <= 100000000 (S/. 10,000)
- [ ] Tests

**10:00-11:00 (1h)** - SKU alfanumérico
- [ ] Validar formato SKU con regex
  ```typescript
  const skuRegex = /^[A-Z0-9-]+$/;
  if (!skuRegex.test(data.sku)) {
    return NextResponse.json(
      { error: 'SKU debe ser alfanumérico (A-Z, 0-9, -)' },
      { status: 400 }
    );
  }
  ```
- [ ] Tests

**11:00-12:00 (1h)** - short_name length
- [ ] Validar <= 20 caracteres
- [ ] Tests

---

#### Dev 2: Employees Validations (4h)

**08:00-09:30 (1.5h)** - PIN único
- [ ] Buscar PIN duplicado antes de crear
  ```typescript
  const existingPin = await prisma.employees.findFirst({
    where: {
      tenant_id: tenantId,
      pin_hash: hashPin(data.pin),
      id: { not: employeeId }, // Excluir en updates
    },
  });
  
  if (existingPin) {
    return NextResponse.json(
      { error: 'Este PIN ya está en uso por otro empleado' },
      { status: 409 }
    );
  }
  ```
- [ ] Aplicar en POST
- [ ] Aplicar en PUT
- [ ] Tests

**09:30-11:00 (1.5h)** - Escalación de privilegios
- [ ] Solo OWNER puede crear OWNER
  ```typescript
  if (data.role === 'OWNER' && authResult.user.role !== 'OWNER') {
    return NextResponse.json(
      { error: 'Solo un OWNER puede crear otro OWNER' },
      { status: 403 }
    );
  }
  ```
- [ ] Tests

**11:00-12:00 (1h)** - No desactivar último OWNER
- [ ] Contar OWNERs activos antes de desactivar
  ```typescript
  if (employee.role === 'OWNER') {
    const activeOwners = await prisma.employees.count({
      where: {
        tenant_id: tenantId,
        role: 'OWNER',
        is_active: true,
        id: { not: employeeId },
      },
    });
    
    if (activeOwners === 0) {
      return NextResponse.json(
        { error: 'No se puede desactivar el último OWNER' },
        { status: 400 }
      );
    }
  }
  ```
- [ ] Tests

---

## DÍA 9: Business Rules Específicas (12h)

### TODO EL DÍA: Validaciones Avanzadas

#### Dev 1: Promotions (6h)

**08:00-09:30 (1.5h)** - Descuento válido
- [ ] Validar descuento >= 0
- [ ] Validar descuento <= 100 si es PERCENTAGE
- [ ] Tests

**09:30-11:00 (1.5h)** - Fechas válidas
- [ ] Validar starts_at < ends_at
  ```typescript
  if (new Date(data.starts_at) >= new Date(data.ends_at)) {
    return NextResponse.json(
      { error: 'La fecha de inicio debe ser anterior a la fecha de fin' },
      { status: 400 }
    );
  }
  ```
- [ ] Tests

**11:00-12:00 (1h)** - No solapar promociones
- [ ] Buscar promociones activas del mismo tipo
- [ ] Validar que no se solapen fechas
- [ ] Tests

**13:00-15:00 (2h)** - Validar productos en promoción
- [ ] Si type=PRODUCT, validar que product_ids existen
- [ ] Si type=CATEGORY, validar que category existe
- [ ] Tests

**15:00-16:00 (1h)** - Tests de integración
- [ ] Test: crear promoción válida
- [ ] Test: rechazar descuento > 100%
- [ ] Test: rechazar fechas inválidas
- [ ] Test: rechazar solapamiento

---

#### Dev 2: Tables + Zones (6h)

**08:00-10:00 (2h)** - Tables validations
- [ ] Validar number > 0
- [ ] Validar capacity > 0
- [ ] Validar zone_id existe
- [ ] No duplicar number en misma zone
- [ ] Tests

**10:00-12:00 (2h)** - Zones validations
- [ ] Validar code único
- [ ] Validar name no vacío
- [ ] Validar color formato hex (#RRGGBB)
- [ ] Tests

**13:00-15:00 (2h)** - Drivers validations
- [ ] Validar phone formato
- [ ] Validar vehicle_plate formato
- [ ] Tests

**15:00-16:00 (1h)** - Tests de integración completos

---

## DÍA 10: Null Checks + Índices BD (10h)

### MAÑANA (5h): Null Safety

#### Dev 1 + Dev 2: Pair Programming (5h)

**08:00-10:00 (2h)** - Auditoría de null checks
- [ ] Buscar accesos directos a propiedades
  ```bash
  grep -r "\.name\b" src/app/api/admin/
  grep -r "\.id\b" src/app/api/admin/
  ```
- [ ] Identificar casos peligrosos
- [ ] Priorizar por riesgo

**10:00-12:00 (2h)** - Agregar null checks
- [ ] Tables con zones
  ```typescript
  zone: t.zones ? {
    id: t.zones.id,
    code: t.zones.code || 'UNKNOWN',
    name: t.zones.name || 'Sin nombre',
    color: t.zones.color || '#000000',
  } : null
  ```
- [ ] Delivery con drivers
- [ ] Orders con employees

**12:00-13:00 (1h)** - Tests
- [ ] Test: maneja null correctamente
- [ ] Test: no crashea con datos incompletos

---

### TARDE (5h): Índices de Base de Datos

#### Dev 1: Crear Migración (5h)

**13:00-14:00 (1h)** - Analizar queries lentas
- [ ] Revisar queries frecuentes
- [ ] Identificar campos sin índice
- [ ] Priorizar por impacto

**14:00-15:30 (1.5h)** - Crear migración SQL
- [ ] Crear `prisma/migrations/YYYYMMDD_add_performance_indices.sql`
  ```sql
  -- Employees
  CREATE INDEX idx_employees_tenant_active 
    ON employees(tenant_id, is_active);
  
  -- Products
  CREATE INDEX idx_products_tenant_sku 
    ON products(tenant_id, sku);
  CREATE INDEX idx_products_tenant_active 
    ON products(tenant_id, is_active);
  
  -- Promotions
  CREATE INDEX idx_promotions_tenant_dates 
    ON promotions(tenant_id, starts_at, ends_at);
  
  -- Admin logs
  CREATE INDEX idx_admin_logs_tenant_date 
    ON admin_access_logs(tenant_id, created_at DESC);
  
  -- Delivery
  CREATE INDEX idx_delivery_tenant_status 
    ON delivery_orders(tenant_id, status, created_at DESC);
  ```

**15:30-16:30 (1h)** - Ejecutar migración
- [ ] Ejecutar en dev
- [ ] Verificar índices creados
- [ ] Medir mejora de performance

**16:30-18:00 (1.5h)** - Testing de performance
- [ ] Benchmark queries antes/después
- [ ] Documentar mejoras
- [ ] Verificar que no hay regresiones

---

## DÍA 11-12: Testing Completo Fase 2 (10h)

### DÍA 11: Integration Tests (5h)

#### Dev 1 + Dev 2: Tests (5h)

**08:00-10:00 (2h)** - Tests de validación
- [ ] Test: todas las business rules
- [ ] Test: tenant_id del JWT
- [ ] Test: soft delete consistency
- [ ] Test: transacciones con rollback

**10:00-12:00 (2h)** - Tests de null safety
- [ ] Test: maneja datos incompletos
- [ ] Test: no crashea con nulls

**13:00-14:00 (1h)** - Tests de performance
- [ ] Test: queries con índices son rápidas
- [ ] Benchmark: < 100ms para queries simples

---

### DÍA 12: Manual Testing + Fixes (5h)

#### Dev 1 + Dev 2: QA (5h)

**08:00-10:00 (2h)** - Testing manual completo
- [ ] Crear empleado con PIN duplicado (debe fallar)
- [ ] Crear producto con precio negativo (debe fallar)
- [ ] Crear promoción con descuento > 100% (debe fallar)
- [ ] Desactivar último OWNER (debe fallar)
- [ ] Verificar soft delete en todas las listas

**10:00-12:00 (2h)** - Fixes de bugs encontrados
- [ ] Corregir issues encontrados
- [ ] Re-test

**13:00-15:00 (2h)** - Documentación
- [ ] Documentar todas las validaciones
- [ ] Documentar business rules
- [ ] Actualizar README

---

## ✅ CHECKLIST FASE 2

Al final del Día 12, debes tener:

- [x] tenant_id centralizado y del JWT
- [x] Soft delete consistente en todos los endpoints
- [x] Transacciones en operaciones críticas
- [x] Business rules generales implementadas
- [x] Business rules específicas implementadas
- [x] Null checks en propiedades anidadas
- [x] Índices de BD para performance
- [x] 80+ tests passing
- [x] Datos consistentes y validados

**Criterio de éxito:** Todos los problemas P1 resueltos.

---

**Próximo:** [FASE 3: Calidad de Código](./FASE3_CALIDAD.md)
