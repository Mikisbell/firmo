# Propuesta: P3.6 — Onboarding Real de Tenant (10 Gaps Completos)

## Intencion

El flujo de onboarding de PARK POS esta construido en piezas pero **no conectado end-to-end**. Un dueno de polleria que recibe un tenant provisionado no tiene camino claro desde "tenant creado" hasta "POS funcional". La exploracion identifico **10 gaps concretos** que impiden este flujo. Este cambio los resuelve todos: conecta provisioning con onboarding, unifica los pasos divergentes, monta el wizard en su pagina, crea la API, traduce a espanol, documenta el proceso, y valida con un E2E test completo de provision-to-POS.

**Estado actual verificado:**
- `provisioning.ts` define **6 pasos** (en espanol) pero solo los retorna como JSON — no los persiste en `onboarding_steps`
- `onboarding.ts` define **7 pasos diferentes** (en ingles) y los persiste via `(prisma as any).onboarding_steps.create()`
- `provisionTenant()` **nunca llama** `createOnboardingChecklist()` — los dos sistemas no estan conectados
- `onboarding.ts` **no esta exportado** desde `src/core/tenant/index.ts` (barrel)
- No existe pagina `/admin/onboarding/page.tsx` — los componentes `OnboardingWizard`, `OnboardingStepProgress`, `OnboardingStepForm` existen pero no estan montados
- No existe API `/api/admin/onboarding` (GET/PUT)
- Toda la UI esta en ingles: wizard, step form, provisioning page
- 9 usos de `(prisma as any)` en `onboarding.ts` — el modelo `onboarding_steps` **si existe** en `prisma/schema.prisma` (confirmado)
- No existe E2E test de provision-to-POS
- No existe documentacion de inicio rapido para el dueno

## Alcance

### Dentro del Alcance (10 Gaps)

| # | Gap | Archivo(s) Afectado(s) | Tipo |
|---|-----|------------------------|------|
| 1 | Conectar `provisionTenant()` con `createOnboardingChecklist()` dentro de la transaccion | `src/core/tenant/provisioning.ts` | Backend |
| 2 | Exportar `onboarding.ts` desde barrel | `src/core/tenant/index.ts` | Backend |
| 3 | Montar `OnboardingWizard` en `/admin/onboarding/page.tsx` | `src/app/admin/onboarding/page.tsx` (nuevo) | UI |
| 4 | Crear API endpoints: `GET /api/admin/onboarding`, `PUT /api/admin/onboarding` | `src/app/api/admin/onboarding/route.ts` (nuevo) | API |
| 5 | Arreglar `(prisma as any)` en `onboarding.ts` — tipar correctamente con `prisma.onboarding_steps` | `src/core/tenant/onboarding.ts` | Backend |
| 6 | Crear documentacion de inicio para el dueno | `docs/GUIA_INICIO_RAPIDO.md` (nuevo) | Docs |
| 7 | Crear E2E test completo: provision -> login -> crear empleado -> crear producto -> abrir POS | `e2e/onboarding-flow.spec.ts` (nuevo) | E2E |
| 8 | Traducir UI a espanol (provisioning page + onboarding wizard + step forms) | 4 archivos UI existentes | UI |
| 9 | Documentar que flujo es admin-initiated (no self-service) | `docs/GUIA_INICIO_RAPIDO.md` (seccion) | Docs |
| 10 | Unificar onboarding steps (provisioning.ts define 6 pasos, onboarding.ts define 7 diferentes) | `provisioning.ts`, `onboarding.ts` | Backend |

### Fuera del Alcance

- **Self-service registration**: El registro lo hace un admin cross-tenant. Aceptable para piloto.
- **Payment gateway integration**: No requerido para MVP.
- **Custom branding per tenant**: Diferido a fase posterior.
- **Migracion de schema**: `onboarding_steps` ya existe en Prisma schema y DB — no se necesitan migraciones.

## Enfoque

### Fase 1 — Backend Integration (Gaps 1, 2, 5, 10)

**Objetivo**: Un unico set de pasos, tipado correcto, conectado.

1. **Gap 10 — Unificar steps**: Definir `UNIFIED_ONBOARDING_STEPS` como single source of truth en `onboarding.ts`. Los 7 pasos unificados (en espanol):
   - `CONFIGURE_BASIC_INFO` — Configurar Informacion del Negocio (requerido)
   - `CREATE_EMPLOYEE` — Crear Empleados (requerido)
   - `CREATE_PRODUCT` — Crear Productos (requerido)
   - `CONFIGURE_STATIONS` — Configurar Estaciones (opcional — ya se crean 4 por defecto en provisioning)
   - `ACTIVATE_TERMINAL` — Activar Terminal (requerido)
   - `CONFIGURE_PAYMENT_METHODS` — Configurar Metodos de Pago (opcional)
   - `FIRST_SALE` — Realizar Primera Venta (requerido)

   Eliminar los 6 pasos hardcodeados en `provisioning.ts` (step 8 del metodo). Provisioning delegara a `createOnboardingChecklist()`.

2. **Gap 5 — Arreglar `(prisma as any)`**: Reemplazar los 9 usos de `(prisma as any).onboarding_steps` con `prisma.onboarding_steps` directo. El modelo existe en el schema — la razon del cast era probablemente que no se habia corrido `prisma generate` al momento de escribirlo.

3. **Gap 1 — Conectar provisioning con onboarding**: Dentro del `prisma.$transaction()` en `provisionTenant()`, reemplazar el hardcoded `onboardingSteps` array con una llamada a `createOnboardingChecklist(tenantId)` pasando el `tx` (transaction client). Esto requiere refactorizar `createOnboardingChecklist` para aceptar un `PrismaClient | Prisma.TransactionClient` como parametro opcional.

4. **Gap 2 — Exportar barrel**: Agregar `export * from './onboarding'` a `src/core/tenant/index.ts`.

**Dependencias**: Ninguna externa. Trabajo auto-contenido.

### Fase 2 — API + Wizard UI (Gaps 3, 4, 8)

**Objetivo**: El admin puede ver y avanzar el onboarding via browser.

1. **Gap 4 — API endpoints**:
   - `GET /api/admin/onboarding` — Retorna checklist del tenant actual (autenticado via `requireAdminAuth`)
   - `PUT /api/admin/onboarding` — Marca un step como completado (body: `{ step_key, completed_by? }`)
   - Ambos usan `tenant_id` del JWT (nunca del cliente)

2. **Gap 3 — Montar wizard**: Crear `src/app/admin/onboarding/page.tsx` que:
   - Fetcha el checklist via `GET /api/admin/onboarding`
   - Renderiza `OnboardingWizard` con callbacks que llaman `PUT /api/admin/onboarding`
   - Redirect a `/admin/dashboard` cuando onboarding completo

3. **Gap 8 — Traducir UI a espanol**:
   - `OnboardingWizard.tsx` — "Bienvenido a PARK POS", "Progreso de Configuracion", etc.
   - `OnboardingStepProgress.tsx` — "Pasos de Configuracion", "Requerido"
   - `OnboardingStepForm.tsx` — Contenido de cada paso, botones, mensajes
   - `provisioning/page.tsx` — Headers, labels, botones, mensajes de exito

**Dependencias**: Fase 1 completada (steps unificados, barrel exportado, API usa service tipado).

### Fase 3 — Documentacion (Gaps 6, 9)

**Objetivo**: Un dueno de polleria sabe exactamente que hacer despues del provisioning.

1. **Gap 6 — Guia de inicio rapido** (`docs/GUIA_INICIO_RAPIDO.md`):
   - Estructura: Requisitos previos -> Paso 1: Recibir credenciales -> Paso 2: Iniciar sesion -> Paso 3-7: Seguir wizard -> Paso 8: Primera venta
   - Screenshots/mockups de cada paso
   - FAQ: "No puedo iniciar sesion", "Olvide mi PIN", "Como agrego mas productos"

2. **Gap 9 — Documentar flujo admin-initiated**:
   - Seccion en la guia: "Nota: El registro de su restaurante fue creado por el equipo de PARK. Usted no necesita crear una cuenta — ya fue creada."
   - Documentar que esto es aceptable para piloto (< 20 tenants)
   - Roadmap: self-service registration planificado para fase futura

**Dependencias**: Ningun bloqueo tecnico. Puede hacerse en paralelo con Fase 2.

### Fase 4 — E2E Validation (Gap 7)

**Objetivo**: Test automatizado que verifica el flujo completo de onboarding.

1. **Gap 7 — E2E test completo** (`e2e/onboarding-flow.spec.ts`):
   - **Setup**: Usar `db-seed.ts` pattern existente para crear tenant via API/DB directo
   - **Flujo**:
     1. Login como admin del tenant recien provisionado
     2. Navegar a `/admin/onboarding`
     3. Verificar wizard carga con pasos correctos
     4. Completar paso "Crear Empleados" — crear un empleado via admin UI
     5. Completar paso "Crear Productos" — crear un producto via admin UI
     6. Verificar progreso actualizado en wizard
     7. Navegar a POS — verificar que el producto aparece
   - **Cleanup**: Eliminar datos del tenant creado

**Dependencias**: Fases 1 y 2 completadas (API y wizard funcionales).

## Areas Afectadas

| Area | Impacto | Fase | Descripcion |
|------|---------|------|-------------|
| `src/core/tenant/onboarding.ts` | Modificado | F1 | Unificar steps, arreglar `(prisma as any)`, aceptar tx param |
| `src/core/tenant/provisioning.ts` | Modificado | F1 | Eliminar hardcoded steps, llamar `createOnboardingChecklist()` |
| `src/core/tenant/index.ts` | Modificado | F1 | Agregar export de onboarding |
| `src/core/tenant/__tests__/onboarding.unit.test.ts` | Modificado | F1 | Actualizar mocks para nuevos steps unificados |
| `src/core/tenant/__tests__/provisioning.unit.test.ts` | Modificado | F1 | Actualizar para reflejar delegacion a onboarding |
| `src/app/api/admin/onboarding/route.ts` | Nuevo | F2 | GET/PUT endpoints |
| `src/app/admin/onboarding/page.tsx` | Nuevo | F2 | Pagina que monta OnboardingWizard |
| `src/app/admin/components/onboarding/OnboardingWizard.tsx` | Modificado | F2 | Traducir a espanol |
| `src/app/admin/components/onboarding/OnboardingStepProgress.tsx` | Modificado | F2 | Traducir a espanol |
| `src/app/admin/components/onboarding/OnboardingStepForm.tsx` | Modificado | F2 | Traducir a espanol, actualizar step_keys |
| `src/app/admin/tenant/provisioning/page.tsx` | Modificado | F2 | Traducir a espanol, redirect a onboarding |
| `docs/GUIA_INICIO_RAPIDO.md` | Nuevo | F3 | Documentacion para el dueno |
| `e2e/onboarding-flow.spec.ts` | Nuevo | F4 | E2E test completo |

## Riesgos

| Riesgo | Probabilidad | Fase | Mitigacion |
|--------|-------------|------|------------|
| `(prisma as any)` oculta errores de schema — al quitar cast puede haber mismatches en tipos de columnas | Baja | F1 | El modelo `onboarding_steps` existe en schema con todos los campos usados. Verificar con `tsc --noEmit` post-cambio. |
| Refactorizar `createOnboardingChecklist` para aceptar `tx` puede romper tests existentes | Media | F1 | Parametro es opcional — sin tx usa prisma singleton (backward compatible). Actualizar tests. |
| Dos fuentes de verdad para steps (provisioning vs onboarding) durante transicion | Alta | F1 | Resolver primero (Gap 10) antes de cualquier otro gap. Single source of truth en `onboarding.ts`. |
| E2E test puede ser fragil si depende del provisioning API completo | Media | F4 | Usar `db-seed.ts` pattern para seed directo a DB, igual que E2E POS existente. |
| Traduccion incompleta — quedan strings en ingles | Baja | F2 | Grep final por strings en ingles en componentes de onboarding. Checklist de traduccion. |
| OnboardingWizard step_keys no matchean con los unificados | Media | F2 | `OnboardingStepForm.tsx` tiene switch por `step_key` — actualizar todos los cases al mismo tiempo que se unifican steps. |

## Plan de Rollback

### Rollback General
- Todos los cambios son en archivos nuevos (pagina, API, E2E, docs) o modificaciones no destructivas a archivos existentes.
- `git revert <commit-sha>` restaura el estado anterior para cualquier fase.

### Rollback Fase 1 (Backend)
- **Steps unificados**: Revertir commit restaura los steps originales en ambos archivos.
- **`(prisma as any)` fix**: Revertir restore los casts. Sin impacto en runtime (ambos funcionan igual).
- **Barrel export**: Remover linea de `index.ts`. Sin impacto — nadie importa desde barrel todavia.
- **Provisioning connection**: Revertir desconecta provisioning de onboarding. Los steps hardcodeados vuelven a funcionar independientemente.

### Rollback Fase 2 (API + UI)
- **API route**: Eliminar `src/app/api/admin/onboarding/route.ts`. Es aditivo, no rompe nada existente.
- **Pagina onboarding**: Eliminar `src/app/admin/onboarding/page.tsx`. Es nueva, no afecta rutas existentes.
- **Traduccion**: Revertir commits de traduccion. UI vuelve a ingles.

### Rollback Fase 3 (Docs)
- Los archivos de documentacion son puramente aditivos. Eliminar si causan confusion.

### Rollback Fase 4 (E2E)
- Archivos de test son puramente aditivos. Eliminar si causan problemas en CI.

## Dependencias

- **Fase 1**: Sin dependencias externas. El modelo `onboarding_steps` ya existe en schema y DB.
- **Fase 2**: Depende de Fase 1 (steps unificados y service tipado).
- **Fase 3**: Sin dependencias tecnicas. Puede ejecutarse en paralelo con Fase 2.
- **Fase 4**: Depende de Fases 1 y 2 (API y wizard funcionales para E2E).
- **Dependencias de paquetes**: Ninguna nueva. Todo usa dependencias existentes.

## Criterios de Exito

### Fase 1
- [ ] `provisionTenant()` crea onboarding steps en DB (via `createOnboardingChecklist()`)
- [ ] Solo hay **un** set de pasos definido (en `onboarding.ts`, en espanol)
- [ ] 0 usos de `(prisma as any)` en `onboarding.ts`
- [ ] `import { createOnboardingChecklist } from '@/src/core/tenant'` funciona
- [ ] Tests unitarios actualizados y pasando

### Fase 2
- [ ] `GET /api/admin/onboarding` retorna checklist del tenant autenticado
- [ ] `PUT /api/admin/onboarding` marca step como completado
- [ ] Ambos endpoints retornan 401 sin JWT valido
- [ ] `/admin/onboarding` renderiza el wizard con pasos correctos
- [ ] Toda la UI de onboarding esta en espanol

### Fase 3
- [ ] `docs/GUIA_INICIO_RAPIDO.md` existe con instrucciones paso a paso
- [ ] Documentado que flujo es admin-initiated (no self-service)

### Fase 4
- [ ] E2E test pasa: provision -> login -> crear empleado -> crear producto -> verificar POS
- [ ] E2E test limpia sus datos despues de ejecutar

### General
- [ ] `tsc --noEmit` pasa con 0 errores
- [ ] `npm run build` tiene exito
- [ ] Tests existentes no tienen regresiones
