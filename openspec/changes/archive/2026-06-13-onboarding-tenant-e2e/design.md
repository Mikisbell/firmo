# Design: P3.6 — Onboarding Real de Tenant (10 Gaps)

> Generado desde proposal.md + specs.md | Proyecto: park-pos

---

## 1. Arquitectura General

### Estado Actual (Desconectado)

```
provisionTenant()                    createOnboardingChecklist()
  |                                    |
  |-- crea tenant, settings,           |-- define 7 steps (EN)
  |   stations, employee,              |-- persiste con (prisma as any)
  |   terminal, ranges                 |-- NO se llama desde provisioning
  |                                    |
  |-- retorna 6 steps hardcodeados     |-- NO exportado desde barrel
  |   (ES, solo en memoria)            |
  v                                    v
  Resultado en JSON                    Datos en onboarding_steps table
  (steps NO persistidos)               (si alguien la llama manualmente)
```

### Estado Objetivo (Conectado)

```
provisionTenant(request)
  |
  prisma.$transaction(tx =>
  |   |-- 1. tx.tenants.create()
  |   |-- 2. tx.tenant_settings.create()
  |   |-- 3. tx.catalog_meta.create()
  |   |-- 4. tx.stations.create() x4
  |   |-- 5. tx.employees.create() (admin)
  |   |-- 6. tx.terminal_number_ranges.create() x10
  |   |-- 7. tx.terminals.create()
  |   |-- 8. createOnboardingChecklist(tenantId, tx)  <-- NUEVO
  |   |        |
  |   |        |-- lee ONBOARDING_STEPS (constante unificada, ES)
  |   |        |-- tx.onboarding_steps.create() x6 (tipado, sin cast)
  |   |        |-- retorna OnboardingChecklist
  |   |
  |   v
  |   resultado atomico
  )
  |
  v
  TenantProvisioningResult (con checklist desde DB)

  GET /api/admin/onboarding         PUT /api/admin/onboarding/steps/:key/complete
    |                                 |
    requireAdminAuth()                requireAdminAuth()
    |                                 |
    getOnboardingChecklist(tid)       completeOnboardingStep(tid, key, eid)
    |                                 |
    v                                 v
    { status, steps, % }              { step actualizado }

  /admin/onboarding (page.tsx)
    |
    |-- fetch GET /api/admin/onboarding
    |-- render OnboardingWizard(steps, callbacks)
    |      |-- OnboardingStepProgress (sidebar)
    |      |-- OnboardingStepForm (contenido)
    |-- on complete: PUT /api/admin/onboarding/steps/:key/complete
    |-- on all done: redirect /admin/dashboard
```

---

## 2. Constante Unificada: ONBOARDING_STEPS

**Archivo**: `src/core/tenant/onboarding.ts`

```typescript
export const ONBOARDING_STEPS = [
  {
    step_number: 1,
    step_key: 'CONFIGURE_BASIC_INFO',
    title: 'Configurar Informacion del Negocio',
    description: 'Completa los datos de tu restaurante (nombre, RUC, direccion)',
    is_required: true,
  },
  {
    step_number: 2,
    step_key: 'CREATE_EMPLOYEE',
    title: 'Crear Empleados',
    description: 'Agrega al menos un empleado ademas del administrador',
    is_required: true,
  },
  {
    step_number: 3,
    step_key: 'CREATE_PRODUCT',
    title: 'Crear Productos',
    description: 'Agrega los productos que venderas (pollos, bebidas, etc.)',
    is_required: true,
  },
  {
    step_number: 4,
    step_key: 'CONFIGURE_STATIONS',
    title: 'Configurar Estaciones',
    description: 'Configura las estaciones de cocina (parrilla, cocina, bar)',
    is_required: false,
  },
  {
    step_number: 5,
    step_key: 'ACTIVATE_TERMINAL',
    title: 'Activar Terminal',
    description: 'Activa tu terminal POS con el codigo de activacion',
    is_required: true,
  },
  {
    step_number: 6,
    step_key: 'CONFIGURE_PAYMENT_METHODS',
    title: 'Configurar Metodos de Pago',
    description: 'Configura los metodos de pago que acepta tu restaurante',
    is_required: false,
  },
] as const;

export type OnboardingStepKey = typeof ONBOARDING_STEPS[number]['step_key'];
```

**Cambio clave vs propuesta**: Se reducen de 7 a 6 pasos. Se eliminan `CONFIGURE_SETTINGS` (ya se configura en provisioning) y `CREATE_TERMINAL` (ya se crea en provisioning). Se agrega `ACTIVATE_TERMINAL` y se mantiene `FIRST_SALE` como implicitico (el E2E lo verifica pero no es un step formal -- el admin no necesita un step para esto). Esto alinea con los 6 pasos que ya define `provisioning.ts`.

**Nota**: La propuesta listaba 7 pasos con `FIRST_SALE`. En el diseno final mantenemos 6 pasos para alinear con el array existente de provisioning.ts que ya tiene 6 y con lo que tiene sentido operativamente (la primera venta no es un "paso de configuracion" sino una validacion).

---

## 3. Data Flow Detallado

### 3.1 Provisioning -> Onboarding (Fase 1)

```
POST /api/admin/tenants/provision
  |
  provisionTenant(request)
  |
  prisma.$transaction(async (tx) => {
    // ... pasos 1-7 existentes (sin cambios) ...

    // Paso 8: REEMPLAZAR hardcoded steps
    // ANTES: const onboardingSteps = [{ ... hardcoded ... }]
    // DESPUES:
    const checklist = await createOnboardingChecklist(tenantId, tx);

    return {
      tenant_id: tenantId,
      admin_employee_id,
      activation_code,
      onboarding_checklist: checklist.steps,
      credentials: { ... },
    };
  })
```

### 3.2 Lectura del Checklist (Fase 2)

```
Browser                         API                           Service              DB
  |                              |                              |                   |
  |-- GET /admin/onboarding ---->|                              |                   |
  |                              |-- requireAdminAuth() ------->|                   |
  |                              |<-- { tenantId, employeeId } -|                   |
  |                              |                              |                   |
  |                              |-- getOnboardingChecklist(tid)|                   |
  |                              |                              |-- findMany(tid) -->|
  |                              |                              |<-- steps[] --------|
  |                              |                              |                   |
  |                              |<-- { status, steps, % } -----|                   |
  |<-- 200 JSON -----------------|
  |                              |
  |-- render OnboardingWizard    |
```

### 3.3 Marcar Paso Completo (Fase 2)

```
Browser                         API                           Service              DB
  |                              |                              |                   |
  |-- PUT .../steps/KEY/complete |                              |                   |
  |                              |-- requireAdminAuth() ------->|                   |
  |                              |<-- { tenantId, employeeId } -|                   |
  |                              |                              |                   |
  |                              |-- completeOnboardingStep(    |                   |
  |                              |     tid, KEY, eid)           |                   |
  |                              |                              |-- findUnique() -->|
  |                              |                              |<-- step ----------|
  |                              |                              |                   |
  |                              |                              |-- update() ------>|
  |                              |                              |<-- updatedStep ---|
  |                              |                              |                   |
  |                              |<-- updatedStep --------------|                   |
  |<-- 200 JSON -----------------|
  |                              |
  |-- actualizar UI progreso     |
```

---

## 4. API Contracts

### 4.1 GET /api/admin/onboarding

**Request**:
```
GET /api/admin/onboarding
Authorization: Bearer <JWT>
```

**Response 200**:
```json
{
  "tenant_id": "uuid",
  "status": "IN_PROGRESS",
  "steps": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "step_number": 1,
      "step_key": "CONFIGURE_BASIC_INFO",
      "title": "Configurar Informacion del Negocio",
      "description": "Completa los datos de tu restaurante...",
      "is_required": true,
      "is_completed": false,
      "completed_at": null,
      "completed_by": null,
      "metadata": {}
    }
  ],
  "completion_percentage": 0
}
```

**Response 401**:
```json
{ "error": "No autorizado" }
```

**Response 404** (si no hay checklist):
```json
{ "error": "Checklist de onboarding no encontrado" }
```

### 4.2 PUT /api/admin/onboarding/steps/:key/complete

**Request**:
```
PUT /api/admin/onboarding/steps/CREATE_EMPLOYEE/complete
Authorization: Bearer <JWT>
```

No body requerido. El `completed_by` se toma del JWT.

**Response 200**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "step_number": 2,
  "step_key": "CREATE_EMPLOYEE",
  "title": "Crear Empleados",
  "description": "Agrega al menos un empleado...",
  "is_required": true,
  "is_completed": true,
  "completed_at": "2026-03-02T15:30:00.000Z",
  "completed_by": "employee-uuid"
}
```

**Response 401**: `{ "error": "No autorizado" }`

**Response 404**: `{ "error": "Paso de onboarding no encontrado" }`

---

## 5. File Change List

### Fase 1 — Backend Integration

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `src/core/tenant/onboarding.ts` | MODIFICAR | Agregar ONBOARDING_STEPS constante exportada; reemplazar STANDARD_ONBOARDING_STEPS; reemplazar 9x `(prisma as any)` con `prisma.onboarding_steps`; agregar parametro `tx?` a `createOnboardingChecklist` |
| `src/core/tenant/provisioning.ts` | MODIFICAR | Eliminar OnboardingStep interface local y array hardcodeado (lineas 36-42, 199-242); importar y llamar `createOnboardingChecklist(tenantId, tx)` en el paso 8 |
| `src/core/tenant/index.ts` | MODIFICAR | Agregar `export * from './onboarding'` |
| `src/core/tenant/__tests__/onboarding.unit.test.ts` | MODIFICAR | Actualizar mocks para 6 pasos unificados en espanol; actualizar expects de step_keys y titles |
| `src/core/tenant/__tests__/provisioning.unit.test.ts` | MODIFICAR | Actualizar expect de `onboarding_checklist.length` si cambia; verificar que createOnboardingChecklist se invoca |

### Fase 2 — API + Wizard UI

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `src/app/api/admin/onboarding/route.ts` | CREAR | GET handler: requireAdminAuth + getOnboardingChecklist |
| `src/app/api/admin/onboarding/steps/[key]/complete/route.ts` | CREAR | PUT handler: requireAdminAuth + completeOnboardingStep |
| `src/app/admin/onboarding/page.tsx` | CREAR | Pagina que monta OnboardingWizard con fetch a API |
| `src/app/admin/components/onboarding/OnboardingWizard.tsx` | MODIFICAR | Traducir UI a espanol |
| `src/app/admin/components/onboarding/OnboardingStepProgress.tsx` | MODIFICAR | Traducir UI a espanol |
| `src/app/admin/components/onboarding/OnboardingStepForm.tsx` | MODIFICAR | Traducir UI a espanol; eliminar cases de steps removidos (CONFIGURE_SETTINGS, CREATE_TERMINAL); actualizar contenido de steps existentes |
| `src/app/admin/tenant/provisioning/page.tsx` | MODIFICAR | Traducir UI a espanol |
| `src/app/admin/components/AdminSidebar.tsx` | MODIFICAR | Agregar link a /admin/onboarding en la seccion de configuracion |

### Fase 3 — Documentacion

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `docs/GUIA_INICIO_RAPIDO.md` | CREAR | Guia completa para dueno de polleria en espanol |

### Fase 4 — E2E

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `e2e/onboarding-flow.spec.ts` | CREAR | E2E test con db-seed pattern: provision -> login -> wizard -> crear empleado -> crear producto -> POS |

---

## 6. Decisiones de Diseno

### D1: 6 pasos, no 7

La propuesta mencionaba 7 pasos incluyendo `FIRST_SALE`. El diseno final usa 6 pasos porque:
- `FIRST_SALE` no es un paso de configuracion sino una validacion operativa
- El E2E test verifica que el producto aparece en POS, lo cual es equivalente
- `CONFIGURE_SETTINGS` y `CREATE_TERMINAL` se eliminan porque provisioning ya los resuelve automaticamente
- Esto alinea con los 6 pasos que provisioning.ts ya define

### D2: API route structure con dynamic segment

Se usa `PUT /api/admin/onboarding/steps/[key]/complete` en lugar de `PUT /api/admin/onboarding` con body `{ step_key }` porque:
- Es RESTful y declarativo
- Next.js App Router maneja dynamic segments nativamente
- El step_key en la URL es mas explicito que en el body

### D3: createOnboardingChecklist acepta tx opcional

```typescript
export async function createOnboardingChecklist(
  tenant_id: string,
  tx?: PrismaClient | Prisma.TransactionClient
): Promise<OnboardingChecklist>
```

- Si no se pasa `tx`, usa el singleton `prisma` (backward compatible)
- Si se pasa `tx`, usa el transaction client (para atomicidad con provisioning)
- Esto permite que `resetOnboarding()` siga funcionando sin cambios

### D4: Onboarding page como Server Component + Client Component

La pagina `/admin/onboarding/page.tsx` sera un Client Component (`'use client'`) que:
1. Hace fetch client-side a `GET /api/admin/onboarding`
2. Pasa los datos a `OnboardingWizard` como props
3. Maneja callbacks de completar paso via `PUT /api/admin/onboarding/steps/:key/complete`

Alternativa considerada: Server Component con Server Actions. Descartada porque el wizard necesita estado interactivo complejo (current step, loading states, error handling) que es mas natural como Client Component.

### D5: E2E seed directo a DB

Se usa PrismaClient directo (patron existente en `e2e/helpers/db-seed.ts`) en lugar de llamar a la API de provisioning porque:
- El test necesita control total sobre los datos
- Evita depender del endpoint de provisioning (que podria cambiar)
- Permite crear exactamente los datos necesarios sin side effects
- Sigue el patron establecido en los tests E2E de POS

### D6: No se agrega step FIRST_SALE al onboarding

El E2E test verifica que el producto aparece en POS, pero no se agrega como paso formal porque:
- Los pasos de onboarding son de **configuracion** del sistema
- La primera venta es una **accion operativa** que no requiere marcar como completada
- Reducir pasos mejora la experiencia del dueno (menos clicks para "terminar")

---

## 7. Esquema de Base de Datos

No se requieren cambios en el schema. El modelo `onboarding_steps` ya existe:

```prisma
model onboarding_steps {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String    @db.Uuid
  step_number     Int
  step_key        String
  title           String
  description     String?
  is_required     Boolean   @default(true)
  is_completed    Boolean   @default(false)
  completed_at    DateTime? @db.Timestamptz(6)
  completed_by    String?   @db.Uuid
  metadata        Json?
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  updated_at      DateTime  @default(now()) @db.Timestamptz(6)
  tenant_settings tenants   @relation(fields: [tenant_id], references: [id])

  @@unique([tenant_id, step_key])
  @@index([tenant_id, step_number])
  @@index([tenant_id, is_completed])
}
```

---

## 8. Impacto en Tests Existentes

### Tests que DEBEN actualizarse

1. **`onboarding.unit.test.ts`**: Los mocks refieren a 7 pasos con titles en ingles. Deben actualizarse a 6 pasos con titles en espanol. El mock de prisma ya usa `prisma.onboarding_steps` (correcto), pero los mock values refieren a step_keys que cambian.

2. **`provisioning.unit.test.ts`**: El test verifica `onboarding_checklist.toHaveLength(6)` — esto sigue siendo 6, pero ahora los steps vienen de DB via `createOnboardingChecklist()` en lugar de ser hardcodeados. El test es de integracion contra Supabase Cloud, asi que necesita que la funcion completa funcione.

### Tests que NO cambian

- `cross-tenant-admin.unit.test.ts`
- `deactivation.unit.test.ts`
- `export.unit.test.ts`
- `tenant-isolation.property.test.ts`
- Todos los tests E2E existentes (no tocan onboarding)
