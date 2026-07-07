# Tasks: P3.6 — Onboarding Real de Tenant (10 Gaps)

> Generado desde proposal.md + specs.md + design.md
> Total: 18 tareas | 4 fases | Esfuerzo estimado: 6-8 horas

---

## Fase 1 — Backend Integration (8 tareas) --- COMPLETADA

**Objetivo**: Un unico set de pasos, tipado correcto, conectado atomicamente.
**Dependencias**: Ninguna. Auto-contenido.
**Specs cubiertas**: F1.1, F1.2, F1.3, F1.4
**Estado**: [x] 1.1 [x] 1.2 [x] 1.3 [x] 1.4 [x] 1.5 [x] 1.6 [x] 1.7 [x] 1.8

### Tarea 1.1: Definir ONBOARDING_STEPS constante unificada

**Archivo**: `src/core/tenant/onboarding.ts`
**Tipo**: Modificar
**Spec**: F1.1 — Single source of truth

**Que hacer**:
1. Reemplazar `STANDARD_ONBOARDING_STEPS` con `ONBOARDING_STEPS` exportado
2. Definir 6 pasos en espanol con titles y descriptions del design.md
3. Agregar tipo `OnboardingStepKey` derivado de la constante
4. Eliminar los step_keys que ya no existen: `CONFIGURE_SETTINGS`, `CREATE_TERMINAL`
5. Agregar step_key `ACTIVATE_TERMINAL` (no existia en el array anterior)

**Step keys finales**: `CONFIGURE_BASIC_INFO`, `CREATE_EMPLOYEE`, `CREATE_PRODUCT`, `CONFIGURE_STATIONS`, `ACTIVATE_TERMINAL`, `CONFIGURE_PAYMENT_METHODS`

**Criterio de exito**: `ONBOARDING_STEPS` exportado, 6 entries, todos en espanol.

---

### Tarea 1.2: Reemplazar (prisma as any) con tipos correctos

**Archivo**: `src/core/tenant/onboarding.ts`
**Tipo**: Modificar
**Spec**: F1.2 — Zero (prisma as any)

**Que hacer**:
1. Buscar los 9 usos de `(prisma as any).onboarding_steps`
2. Reemplazar cada uno con `prisma.onboarding_steps` (o `client.onboarding_steps` donde se use el parametro tx)
3. Verificar que `tsc --noEmit` pasa — el modelo existe en schema.prisma

**Ubicaciones a cambiar** (lineas actuales):
- L111: `createOnboardingChecklist` -> `(prisma as any).onboarding_steps.create`
- L157: `getOnboardingChecklist` -> `(prisma as any).onboarding_steps.findMany`
- L186: `completeOnboardingStep` -> `(prisma as any).onboarding_steps.findUnique`
- L196: `completeOnboardingStep` -> `(prisma as any).onboarding_steps.update`
- L218: `uncompleteOnboardingStep` -> `(prisma as any).onboarding_steps.findUnique`
- L228: `uncompleteOnboardingStep` -> `(prisma as any).onboarding_steps.update`
- L253: `validateOnboardingComplete` -> `(prisma as any).onboarding_steps.findMany`
- L318: `resetOnboarding` -> `(prisma as any).onboarding_steps.deleteMany`
- L309: `getOnboardingStatus` -> `(settings as any).onboarding_status` (bonus)

**Criterio de exito**: `grep "(prisma as any)" onboarding.ts` retorna 0 resultados. `tsc --noEmit` pasa.

---

### Tarea 1.3: Exportar onboarding desde barrel

**Archivo**: `src/core/tenant/index.ts`
**Tipo**: Modificar
**Spec**: F1.3 — Barrel export

**Que hacer**:
1. Agregar `export * from './onboarding'` al barrel
2. Verificar que no hay conflictos de nombres con otros exports (especialmente `OnboardingStep` que tambien se define en `provisioning.ts`)

**Conflicto potencial**: `provisioning.ts` exporta su propia `OnboardingStep` interface (linea 36-42). Este se eliminara en tarea 1.5 cuando se limpie provisioning.ts. La tarea 1.3 DEBE ejecutarse DESPUES de 1.5 para evitar conflictos de nombres.

**Criterio de exito**: `import { createOnboardingChecklist, ONBOARDING_STEPS } from '@/src/core/tenant'` compila sin errores.

---

### Tarea 1.4: Refactorizar createOnboardingChecklist para aceptar tx

**Archivo**: `src/core/tenant/onboarding.ts`
**Tipo**: Modificar
**Spec**: F1.4 — createOnboardingChecklist acepta transaction client

**Que hacer**:
1. Agregar import de `Prisma` from `@prisma/client`
2. Cambiar firma de `createOnboardingChecklist`:
   ```typescript
   export async function createOnboardingChecklist(
     tenant_id: string,
     tx?: PrismaClient | Prisma.TransactionClient
   ): Promise<OnboardingChecklist>
   ```
3. Dentro de la funcion, usar `const client = tx || prisma;`
4. Reemplazar todas las llamadas a `prisma.onboarding_steps` dentro de la funcion con `client.onboarding_steps`
5. Actualizar el loop para usar `ONBOARDING_STEPS` en vez de la variable local eliminada

**Criterio de exito**: La funcion trabaja con y sin tx. Los tests existentes siguen pasando (backward compatible).

---

### Tarea 1.5: Conectar provisionTenant con createOnboardingChecklist

**Archivo**: `src/core/tenant/provisioning.ts`
**Tipo**: Modificar
**Spec**: F1.4 — provisionTenant crea checklist atomicamente

**Que hacer**:
1. Agregar import: `import { createOnboardingChecklist } from './onboarding'`
2. Eliminar la interface local `OnboardingStep` (lineas 36-42) — ahora viene del barrel
3. Eliminar el array hardcodeado `onboardingSteps` (lineas 199-242)
4. Reemplazar con:
   ```typescript
   // 8. Create onboarding checklist (atomico, dentro de la transaccion)
   const checklist = await createOnboardingChecklist(tenantId, tx);
   ```
5. Actualizar el return para usar `checklist.steps`:
   ```typescript
   onboarding_checklist: checklist.steps.map(s => ({
     id: s.id,
     step_number: s.step_number,
     title: s.title,
     description: s.description || '',
     is_completed: s.is_completed,
   })),
   ```
6. Actualizar `TenantProvisioningResult.onboarding_checklist` para usar el tipo de `onboarding.ts`

**Criterio de exito**: `provisionTenant()` persiste onboarding_steps en DB via la transaccion. El resultado incluye steps de DB.

---

### Tarea 1.6: Actualizar tests unitarios de onboarding

**Archivo**: `src/core/tenant/__tests__/onboarding.unit.test.ts`
**Tipo**: Modificar
**Spec**: F1.1, F1.2, F1.4

**Que hacer**:
1. Actualizar mock data para reflejar 6 pasos unificados (no 7)
2. Cambiar step_keys en mocks: eliminar `CONFIGURE_SETTINGS`, `CREATE_TERMINAL`; agregar `ACTIVATE_TERMINAL`
3. Cambiar titles en mocks de ingles a espanol
4. Actualizar expect en `createOnboardingChecklist` test: `steps.length` = 6 (no 7)
5. Agregar test para `ONBOARDING_STEPS` constante: verificar que tiene 6 entries
6. Agregar test para `createOnboardingChecklist` con tx parameter

**Criterio de exito**: Todos los tests de onboarding pasan con los nuevos step definitions.

---

### Tarea 1.7: Actualizar test de provisioning

**Archivo**: `src/core/tenant/__tests__/provisioning.unit.test.ts`
**Tipo**: Modificar
**Spec**: F1.4

**Que hacer**:
1. El test ya verifica `onboarding_checklist.toHaveLength(6)` — esto sigue siendo correcto
2. Verificar que los titles de los steps ahora estan en espanol
3. Agregar asercion de que los steps estan persistidos en DB (via un findMany despues del provision)

**Nota**: Este test es de integracion contra Supabase Cloud. Se ejecuta con la DB real.

**Criterio de exito**: `npm run test -- provisioning.unit.test` pasa.

---

### Tarea 1.8: Verificar tsc + vitest Fase 1

**Tipo**: Verificacion
**Spec**: Criterios globales

**Que hacer**:
1. Ejecutar `npx tsc --noEmit` — DEBE pasar con 0 errores
2. Ejecutar `npm run test` — DEBEN pasar todos los tests
3. Verificar `grep "(prisma as any)" src/core/tenant/onboarding.ts` retorna 0 resultados

**Criterio de exito**: Zero errores de tipo, zero tests fallando.

---

## Fase 2 — API + Wizard UI (6 tareas) --- COMPLETADA

**Objetivo**: El admin puede ver y avanzar el onboarding via browser.
**Dependencias**: Fase 1 completada.
**Specs cubiertas**: F2.1, F2.2, F2.3
**Estado**: [x] 2.1 [x] 2.2 [x] 2.3 [x] 2.4 [x] 2.5 [x] 2.6

### Tarea 2.1: Crear GET /api/admin/onboarding

**Archivo**: `src/app/api/admin/onboarding/route.ts` (NUEVO)
**Tipo**: Crear
**Spec**: F2.1 — GET endpoint

**Que hacer**:
1. Crear archivo route.ts con handler GET
2. Usar `requireAdminAuth` para autenticacion
3. Obtener `tenant_id` de `authResult.user.tenantId`
4. Llamar `getOnboardingChecklist(tenant_id)` del service
5. Retornar JSON con `{ tenant_id, status, steps, completion_percentage }`
6. Manejar error de "checklist not found" con 404
7. Manejar error de auth con 401

**Patron a seguir**: `src/app/api/admin/config/route.ts` (mismo pattern de requireAdminAuth)

**Criterio de exito**: GET retorna checklist del tenant autenticado. 401 sin JWT.

---

### Tarea 2.2: Crear PUT /api/admin/onboarding/steps/[key]/complete

**Archivo**: `src/app/api/admin/onboarding/steps/[key]/complete/route.ts` (NUEVO)
**Tipo**: Crear
**Spec**: F2.1 — PUT endpoint

**Que hacer**:
1. Crear directorio structure: `steps/[key]/complete/route.ts`
2. Usar `requireAdminAuth` para autenticacion
3. Leer `key` del dynamic segment `params.key`
4. Llamar `completeOnboardingStep(tenant_id, key, employee_id)`
5. Retornar el step actualizado con 200
6. Manejar step not found con 404 y mensaje en espanol
7. Manejar error de auth con 401

**Criterio de exito**: PUT marca step como completado. `completed_by` viene del JWT.

---

### Tarea 2.3: Crear pagina /admin/onboarding

**Archivo**: `src/app/admin/onboarding/page.tsx` (NUEVO)
**Tipo**: Crear
**Spec**: F2.2 — Pagina de onboarding

**Que hacer**:
1. Crear `'use client'` component
2. Fetch `GET /api/admin/onboarding` on mount
3. Render `OnboardingWizard` con los datos de la API
4. Callback `onStepComplete` llama `PUT /api/admin/onboarding/steps/:key/complete`
5. Callback `onOnboardingComplete` redirige a `/admin/dashboard`
6. Mostrar loading state mientras carga
7. Mostrar error state si la API falla

**Criterio de exito**: Pagina carga y muestra wizard con datos reales de DB.

---

### Tarea 2.4: Traducir provisioning page a espanol

**Archivo**: `src/app/admin/tenant/provisioning/page.tsx`
**Tipo**: Modificar
**Spec**: F2.3 — UI en espanol

**Que hacer** (strings a cambiar):
| Ingles | Espanol |
|--------|---------|
| Tenant Provisioning Complete | Aprovisionamiento de Tenant Completo |
| Your new tenant has been successfully provisioned | Tu nuevo tenant ha sido aprovisionado exitosamente |
| Success! | Exito |
| Tenant Credentials | Credenciales del Tenant |
| Tenant ID | ID del Tenant |
| Admin Employee ID | ID del Empleado Admin |
| Activation Code | Codigo de Activacion |
| Admin PIN | PIN del Admin |
| Onboarding Checklist | Lista de Configuracion |
| Provision Another Tenant | Provisionar Otro Tenant |
| Go to Dashboard | Ir al Dashboard |
| Provision New Tenant | Provisionar Nuevo Tenant |
| Create a new tenant with all required configuration | Crear un nuevo tenant con toda la configuracion requerida |
| Business Information | Informacion del Negocio |
| Legal Name * | Nombre Legal * |
| Admin Information | Informacion del Administrador |
| Admin Name * | Nombre del Admin * |
| Admin PIN (4 digits) * | PIN del Admin (4 digitos) * |
| Regional Settings | Configuracion Regional |
| Optional Settings | Configuracion Opcional |
| Receipt Footer Text | Texto de Pie de Recibo |
| Default Delivery Fee (cents) | Tarifa de Delivery por Defecto (centavos) |
| Max Offline Coupons per Order | Max Cupones Offline por Orden |
| Enable Tips | Habilitar Propinas |
| Show Tips on Invoice | Mostrar Propinas en Factura |
| Allow Offline Coupons | Permitir Cupones Offline |
| Require Manager for Offline | Requerir Gerente para Offline |
| Provisioning... | Aprovisionando... |
| Provision Tenant | Provisionar Tenant |

**Criterio de exito**: Zero strings user-facing en ingles.

---

### Tarea 2.5: Traducir componentes OnboardingWizard a espanol

**Archivos**:
- `src/app/admin/components/onboarding/OnboardingWizard.tsx`
- `src/app/admin/components/onboarding/OnboardingStepProgress.tsx`
- `src/app/admin/components/onboarding/OnboardingStepForm.tsx`

**Tipo**: Modificar
**Spec**: F2.3 — UI en espanol

**Que hacer**:

**OnboardingWizard.tsx**:
| Ingles | Espanol |
|--------|---------|
| Welcome to FIRMO POS | Bienvenido a FIRMO POS |
| Let's set up your restaurant system. Complete the required steps to get started. | Configuremos tu sistema de restaurante. Completa los pasos requeridos para comenzar. |
| Setup Progress | Progreso de Configuracion |
| required steps completed | pasos requeridos completados |
| Setup Complete! | Configuracion Completa |
| Your FIRMO POS system is ready to use. You can now start accepting orders. | Tu sistema FIRMO POS esta listo para usar. Ya puedes comenzar a tomar pedidos. |

**OnboardingStepProgress.tsx**:
| Ingles | Espanol |
|--------|---------|
| Setup Steps | Pasos de Configuracion |
| Required | Requerido |

**OnboardingStepForm.tsx**:
- Traducir TODOS los textos de `getStepContent()` a espanol
- Eliminar cases para steps removidos: `CONFIGURE_SETTINGS`, `CREATE_TERMINAL`
- Agregar case para `ACTIVATE_TERMINAL`
- Traducir botones y mensajes:

| Ingles | Espanol |
|--------|---------|
| Complete Step | Completar Paso |
| Skip | Omitir |
| Processing... | Procesando... |
| Completed | Completado |
| Step Completed | Paso Completado |
| This step has been completed. You can move to the next step. | Este paso ha sido completado. Puedes continuar al siguiente paso. |
| Error | Error |
| Tip: You can complete these steps in any order. | Consejo: Puedes completar estos pasos en cualquier orden. |

**Criterio de exito**: `grep -r "Welcome to\|Setup Progress\|Complete Step\|Skip\|Processing\.\.\." src/app/admin/components/onboarding/` retorna 0 resultados.

---

### Tarea 2.6: Agregar link de onboarding al admin sidebar

**Archivo**: `src/app/admin/components/AdminSidebar.tsx`
**Tipo**: Modificar
**Spec**: F2.2

**Que hacer**:
1. Agregar item de navegacion para `/admin/onboarding`
2. Usar icono apropiado (e.g., `Rocket` o `ClipboardCheck` de lucide-react)
3. Texto: "Configuracion Inicial" o "Onboarding"
4. Descripcion: "Guia paso a paso para configurar tu negocio"
5. Colocar en posicion prominente (despues de Dashboard)

**Criterio de exito**: Link visible en sidebar, navega a /admin/onboarding.

---

## Fase 3 — Documentacion (2 tareas)

**Objetivo**: Un dueno de polleria sabe que hacer despues del provisioning.
**Dependencias**: Ninguna tecnica. Puede ejecutarse en paralelo con Fase 2.
**Specs cubiertas**: F3.1, F3.2

### Tarea 3.1: Crear guia de inicio rapido

**Archivo**: `docs/GUIA_INICIO_RAPIDO.md` (NUEVO)
**Tipo**: Crear
**Spec**: F3.1, F3.2

**Que hacer**:
1. Crear documento en espanol con las secciones:
   - Bienvenida y proposito del documento
   - Requisitos previos (navegador moderno, conexion a internet)
   - Paso 1: Recibir credenciales del equipo PARK
   - Paso 2: Iniciar sesion con tenant_id + PIN
   - Paso 3: Navegar al wizard de configuracion (/admin/onboarding)
   - Paso 4: Configurar informacion del negocio
   - Paso 5: Crear empleados
   - Paso 6: Crear productos
   - Paso 7: Verificar en el POS
   - Preguntas frecuentes (FAQ)
2. Incluir nota sobre flujo admin-initiated:
   "El registro de su restaurante fue creado por el equipo de PARK. Usted no necesita crear una cuenta."
3. Incluir nota sobre roadmap de self-service
4. Lenguaje claro para usuarios no tecnicos

**Criterio de exito**: Documento existe, en espanol, con estructura completa y FAQ.

---

### Tarea 3.2: Documentar flujo admin-initiated

**Archivo**: `docs/GUIA_INICIO_RAPIDO.md` (misma tarea 3.1, seccion especifica)
**Tipo**: Incluido en 3.1
**Spec**: F3.2

**Que hacer** (incluido en tarea 3.1):
1. Seccion "Nota importante" que explica:
   - El flujo actual es admin-initiated
   - El dueno no necesita registrarse
   - Self-service registration planificado para fase futura
   - Flujo actual aceptable para piloto (< 20 tenants)

**Criterio de exito**: Seccion presente y clara en la guia.

---

## Fase 4 — E2E Validation (2 tareas)

**Objetivo**: Test automatizado que valida el flujo completo.
**Dependencias**: Fases 1 y 2 completadas.
**Specs cubiertas**: F4.1

### Tarea 4.1: Crear E2E test de onboarding flow

**Archivo**: `e2e/onboarding-flow.spec.ts` (NUEVO)
**Tipo**: Crear
**Spec**: F4.1

**Que hacer**:
1. Importar helpers de `e2e/helpers/db-seed.ts`
2. Setup:
   - Crear tenant via PrismaClient directo (no via API)
   - Crear tenant_settings, stations, employee, terminal, number_ranges
   - Crear onboarding_steps con los 6 pasos (usando ONBOARDING_STEPS o hardcoded)
   - Generar JWT para el admin employee
3. Tests:
   - Login como admin del tenant
   - Navegar a `/admin/onboarding`
   - Verificar que el wizard carga con 6 pasos
   - Verificar 0% de progreso
   - Marcar paso "Crear Empleados" como completado (via UI o API)
   - Marcar paso "Crear Productos" como completado
   - Verificar progreso actualizado
   - Navegar al POS y verificar que funciona
4. Cleanup:
   - `deleteMany({ where: { tenant_id } })` para:
     - onboarding_steps
     - terminal_number_ranges
     - terminals
     - employees
     - stations
     - catalog_meta
     - tenant_settings
     - tenants
   - Desconectar PrismaClient

**Patron a seguir**: `e2e/complete-waiter-flow.spec.ts` o `e2e/02-pos-login.spec.ts`

**Criterio de exito**: E2E test pasa end-to-end. Cleanup completo.

---

### Tarea 4.2: Verificar todos los tests pasan

**Tipo**: Verificacion
**Spec**: Criterios globales

**Que hacer**:
1. Ejecutar `npx tsc --noEmit` — 0 errores
2. Ejecutar `npm run test` — todos los unit tests pasan
3. Ejecutar `npm run build` — build exitoso
4. Ejecutar `npx playwright test e2e/onboarding-flow.spec.ts` — E2E pasa
5. Verificar que NO hay regresiones en tests existentes

**Criterio de exito**: Todo verde. Listo para merge.

---

## Resumen de Ejecucion

| Fase | Tareas | Esfuerzo Estimado | Dependencias |
|------|--------|-------------------|--------------|
| F1 — Backend | 1.1 - 1.8 | 2-3 horas | Ninguna |
| F2 — API + UI | 2.1 - 2.6 | 2-3 horas | F1 completada |
| F3 — Docs | 3.1 - 3.2 | 30-45 min | Ninguna (paralelo con F2) |
| F4 — E2E | 4.1 - 4.2 | 1-2 horas | F1 + F2 completadas |
| **Total** | **18 tareas** | **6-8 horas** | |

### Orden de Ejecucion Recomendado

```
Batch 1 (F1): 1.1 → 1.2 → 1.4 → 1.5 → 1.3 → 1.6 → 1.7 → 1.8
                                                ^
                                                |
                                        (1.3 despues de 1.5 por conflicto OnboardingStep)

Batch 2 (F2 + F3 en paralelo):
  F2: 2.1 → 2.2 → 2.3 → 2.5 → 2.4 → 2.6
  F3: 3.1 + 3.2 (puede hacerse en cualquier momento)

Batch 3 (F4): 4.1 → 4.2
```

### Riesgo Residual

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| `prisma.onboarding_steps` no compilable despues de quitar cast | Baja | Verificar con `tsc --noEmit` inmediatamente (tarea 1.8) |
| Conflicto de nombres `OnboardingStep` entre provisioning y onboarding | Media | Tarea 1.5 elimina la interface de provisioning ANTES de 1.3 (barrel) |
| E2E fragil por dependencia de UI selectors | Media | Usar data-testid en componentes onboarding |
| provisioning.unit.test usa DB real y puede fallar con nuevos steps | Baja | Los steps siguen siendo 6, solo cambia la fuente |
