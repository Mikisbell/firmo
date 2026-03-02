# Specs: P3.6 — Onboarding Real de Tenant (10 Gaps)

> Generado desde proposal.md | Formato: Gherkin | RFC 2119 keywords

## Convenciones

- **MUST** / **DEBE**: Requerimiento obligatorio
- **SHOULD** / **DEBERIA**: Recomendado fuertemente
- **MAY** / **PUEDE**: Opcional

---

## Fase 1 — Backend Integration

### F1.1: Pasos de Onboarding Unificados (Gap 10)

**Contexto**: Actualmente `provisioning.ts` define 6 pasos en espanol y `onboarding.ts` define 7 pasos diferentes en ingles. DEBE existir una unica fuente de verdad.

```gherkin
Feature: Onboarding Steps Unificados (Gap 10)
  Los pasos de onboarding DEBEN estar definidos en un unico lugar
  como constante exportada desde onboarding.ts, en espanol.

  Scenario: Single source of truth para pasos de onboarding
    Given que el modulo onboarding.ts define ONBOARDING_STEPS
    Then DEBE exportar exactamente 6 pasos
    And cada paso DEBE tener: step_key, title (espanol), description (espanol), is_required
    And los step_keys DEBEN ser:
      | step_key                    | title                              | is_required |
      | CONFIGURE_BASIC_INFO        | Configurar Informacion del Negocio | true        |
      | CREATE_EMPLOYEE             | Crear Empleados                    | true        |
      | CREATE_PRODUCT              | Crear Productos                    | true        |
      | CONFIGURE_STATIONS          | Configurar Estaciones              | false       |
      | ACTIVATE_TERMINAL           | Activar Terminal                   | true        |
      | CONFIGURE_PAYMENT_METHODS   | Configurar Metodos de Pago         | false       |

  Scenario: provisioning.ts NO define pasos propios
    Given que provisioning.ts crea un tenant
    Then NO DEBE tener un array hardcodeado de onboarding steps
    And DEBE delegar la creacion de pasos a createOnboardingChecklist()

  Scenario: Los pasos tienen descripciones en espanol
    Given que ONBOARDING_STEPS esta definido
    Then cada paso DEBE tener description en espanol
    And NINGUNA description DEBE contener texto en ingles
```

### F1.2: Prisma Types Corregidos (Gap 5)

**Contexto**: `onboarding.ts` usa `(prisma as any).onboarding_steps` en 9 lugares. El modelo `onboarding_steps` existe en `prisma/schema.prisma`. El cast es innecesario.

```gherkin
Feature: Prisma Types Correctos (Gap 5)
  Todas las llamadas a prisma.onboarding_steps DEBEN ser tipadas.
  NO DEBE existir ningun uso de (prisma as any) en onboarding.ts.

  Scenario: Zero (prisma as any) en onboarding.ts
    Given que onboarding.ts usa PrismaClient
    Then DEBE usar prisma.onboarding_steps directamente (sin cast)
    And `grep "(prisma as any)" onboarding.ts` DEBE retornar 0 resultados
    And `tsc --noEmit` DEBE pasar sin errores

  Scenario: Todas las operaciones CRUD usan tipos correctos
    Given que onboarding.ts tiene funciones: create, findMany, findUnique, update, deleteMany
    Then cada funcion DEBE usar el tipo generado por Prisma para onboarding_steps
    And los argumentos where/data DEBEN ser type-safe
```

### F1.3: Barrel Export (Gap 2)

```gherkin
Feature: Barrel Export de Onboarding (Gap 2)
  El modulo onboarding DEBE ser accesible desde el barrel de tenant.

  Scenario: Import desde barrel funciona
    Given que src/core/tenant/index.ts es el barrel
    When un modulo importa { createOnboardingChecklist } from '@/src/core/tenant'
    Then DEBE resolver correctamente
    And DEBE incluir todas las funciones publicas de onboarding.ts:
      | export                       |
      | createOnboardingChecklist    |
      | getOnboardingChecklist       |
      | completeOnboardingStep       |
      | uncompleteOnboardingStep     |
      | validateOnboardingComplete   |
      | markOnboardingComplete       |
      | getOnboardingStatus          |
      | resetOnboarding              |
      | ONBOARDING_STEPS             |
      | OnboardingStep               |
      | OnboardingChecklist          |
```

### F1.4: provisionTenant() Atomico con Onboarding (Gap 1)

```gherkin
Feature: Provisioning Conectado con Onboarding (Gap 1)
  provisionTenant() DEBE crear los onboarding_steps en la misma transaccion.

  Scenario: provisionTenant crea checklist atomicamente
    Given que se llama a provisionTenant() con datos validos
    When la transaccion se ejecuta
    Then DEBE llamar createOnboardingChecklist(tenantId, tx) dentro del $transaction
    And los onboarding_steps DEBEN existir en la DB al terminar la transaccion
    And el resultado DEBE incluir onboarding_checklist con los 6 pasos

  Scenario: createOnboardingChecklist acepta transaction client
    Given que createOnboardingChecklist tiene un parametro opcional `tx`
    When se invoca con un PrismaClient (sin tx)
    Then DEBE usar el prisma singleton (backward compatible)
    When se invoca con un Prisma.TransactionClient (con tx)
    Then DEBE usar el tx proporcionado

  Scenario: Rollback atomico si falla onboarding
    Given que provisionTenant() esta en una transaccion
    When createOnboardingChecklist() falla
    Then TODA la transaccion DEBE hacer rollback
    And NO DEBE existir el tenant ni los settings en la DB

  Scenario: Resultado incluye pasos desde DB
    Given que provisionTenant() crea un tenant exitosamente
    Then el campo onboarding_checklist DEBE contener los pasos persistidos en DB
    And NO DEBE retornar pasos hardcodeados en memoria
```

---

## Fase 2 — API + Wizard UI

### F2.1: API Endpoints de Onboarding (Gap 4)

```gherkin
Feature: API Endpoints de Onboarding (Gap 4)
  DEBEN existir endpoints para leer y actualizar el checklist.

  Scenario: GET /api/admin/onboarding retorna checklist
    Given que existe un tenant con onboarding_steps en DB
    And el request tiene un JWT valido con tenant_id
    When se hace GET /api/admin/onboarding
    Then DEBE retornar status 200
    And el body DEBE incluir:
      | campo                  | tipo    |
      | tenant_id              | string  |
      | status                 | string  |
      | steps                  | array   |
      | completion_percentage  | number  |
    And tenant_id DEBE venir del JWT (NUNCA del query param)

  Scenario: GET /api/admin/onboarding sin JWT retorna 401
    Given que el request NO tiene JWT valido
    When se hace GET /api/admin/onboarding
    Then DEBE retornar status 401
    And el body DEBE incluir { error: "No autorizado" }

  Scenario: PUT /api/admin/onboarding/steps/:key/complete marca paso
    Given que existe un onboarding step con step_key "CREATE_EMPLOYEE"
    And el request tiene JWT valido
    When se hace PUT /api/admin/onboarding/steps/CREATE_EMPLOYEE/complete
    Then DEBE retornar status 200
    And el step DEBE tener is_completed = true
    And completed_at DEBE ser un timestamp reciente
    And completed_by DEBE ser el employee_id del JWT

  Scenario: PUT con step_key invalido retorna 404
    Given que el request tiene JWT valido
    When se hace PUT /api/admin/onboarding/steps/NONEXISTENT/complete
    Then DEBE retornar status 404
    And el body DEBE incluir { error: "Paso de onboarding no encontrado" }

  Scenario: PUT sin JWT retorna 401
    Given que el request NO tiene JWT valido
    When se hace PUT /api/admin/onboarding/steps/CREATE_EMPLOYEE/complete
    Then DEBE retornar status 401

  Scenario: Ambos endpoints usan requireAdminAuth
    Given que los endpoints estan definidos
    Then DEBEN usar requireAdminAuth para autenticacion
    And DEBEN obtener tenant_id de authResult.user.tenantId
```

### F2.2: Pagina /admin/onboarding (Gap 3)

```gherkin
Feature: Pagina de Onboarding Wizard (Gap 3)
  DEBE existir una pagina que monte el OnboardingWizard.

  Scenario: Pagina carga y muestra wizard
    Given que un admin esta autenticado
    When navega a /admin/onboarding
    Then DEBE ver el componente OnboardingWizard
    And DEBE ver los pasos de onboarding del tenant
    And DEBE ver la barra de progreso

  Scenario: Wizard usa datos reales de la API
    Given que el tenant tiene onboarding_steps en DB
    When la pagina carga
    Then DEBE hacer fetch a GET /api/admin/onboarding
    And los pasos mostrados DEBEN coincidir con los de la DB

  Scenario: Completar paso llama a la API
    Given que el wizard esta mostrando un paso incompleto
    When el usuario hace click en "Completar Paso"
    Then DEBE llamar PUT /api/admin/onboarding/steps/:key/complete
    And DEBE actualizar el progreso visualmente

  Scenario: Redirect al dashboard cuando onboarding completo
    Given que todos los pasos requeridos estan completados
    When el usuario completa el ultimo paso requerido
    Then DEBE redirigir a /admin/dashboard
```

### F2.3: UI en Espanol (Gap 8)

```gherkin
Feature: Toda la UI en Espanol (Gap 8)
  TODA la interfaz de onboarding y provisioning DEBE estar en espanol.

  Scenario: OnboardingWizard en espanol
    Given que el wizard esta renderizado
    Then el titulo DEBE ser "Bienvenido a PARK POS" (no "Welcome to PARK POS")
    And el subtitulo DEBE estar en espanol
    And "Setup Progress" DEBE ser "Progreso de Configuracion"
    And "required steps completed" DEBE estar en espanol

  Scenario: OnboardingStepProgress en espanol
    Given que el sidebar de pasos esta renderizado
    Then "Setup Steps" DEBE ser "Pasos de Configuracion"
    And "Required" DEBE ser "Requerido"

  Scenario: OnboardingStepForm en espanol
    Given que el formulario de paso esta renderizado
    Then TODOS los textos explicativos DEBEN estar en espanol
    And los botones DEBEN decir "Completar Paso" (no "Complete Step")
    And "Skip" DEBE ser "Omitir"
    And "Processing..." DEBE ser "Procesando..."
    And "Completed" DEBE ser "Completado"
    And "Step Completed" DEBE ser "Paso Completado"
    And el tip DEBE estar en espanol

  Scenario: Provisioning page en espanol
    Given que la pagina de provisioning esta renderizada
    Then "Provision New Tenant" DEBE ser "Provisionar Nuevo Tenant"
    And "Business Information" DEBE ser "Informacion del Negocio"
    And "Admin Information" DEBE ser "Informacion del Administrador"
    And "Regional Settings" DEBE ser "Configuracion Regional"
    And "Optional Settings" DEBE ser "Configuracion Opcional"
    And TODOS los labels y botones DEBEN estar en espanol

  Scenario: Zero strings en ingles en componentes de onboarding
    Given que todos los archivos de onboarding estan traducidos
    When se ejecuta grep para strings comunes en ingles
    Then NO DEBE haber strings en ingles user-facing:
      | forbidden_string     |
      | Welcome to           |
      | Setup Progress       |
      | Setup Steps          |
      | Complete Step        |
      | Skip                 |
      | Required             |
      | Processing...        |
      | Step Completed       |
```

---

## Fase 3 — Documentacion

### F3.1: Guia de Inicio Rapido (Gap 6)

```gherkin
Feature: Guia de Inicio Rapido (Gap 6)
  DEBE existir documentacion para el dueno de polleria.

  Scenario: Archivo existe con estructura correcta
    Given que docs/GUIA_INICIO_RAPIDO.md existe
    Then DEBE incluir las secciones:
      | seccion                     |
      | Requisitos previos          |
      | Recibir credenciales        |
      | Iniciar sesion              |
      | Seguir wizard de setup      |
      | Primera venta               |
      | Preguntas frecuentes (FAQ)  |

  Scenario: FAQ cubre problemas comunes
    Given que la seccion FAQ existe
    Then DEBE responder al menos:
      | pregunta                        |
      | No puedo iniciar sesion         |
      | Olvide mi PIN                   |
      | Como agrego mas productos       |
      | Como agrego mas empleados       |

  Scenario: Documento esta en espanol
    Given que la guia existe
    Then TODO el contenido DEBE estar en espanol
    And DEBE usar lenguaje claro para usuarios no tecnicos
```

### F3.2: Flujo Admin-Initiated (Gap 9)

```gherkin
Feature: Documentar Flujo Admin-Initiated (Gap 9)
  DEBE quedar documentado que el registro es admin-initiated.

  Scenario: Documentacion explica flujo actual
    Given que la guia existe
    Then DEBE incluir una nota que diga:
      "El registro de su restaurante fue creado por el equipo de PARK"
    And DEBE explicar que el dueno NO necesita crear cuenta
    And DEBE mencionar que self-service esta planificado para el futuro

  Scenario: Roadmap mencionado
    Given que la documentacion de flujo admin-initiated existe
    Then DEBE mencionar que self-service registration es objetivo futuro
    And DEBE indicar que el flujo actual es aceptable para piloto (< 20 tenants)
```

---

## Fase 4 — E2E Validation

### F4.1: E2E Test de Onboarding Completo (Gap 7)

```gherkin
Feature: E2E Test Onboarding Flow (Gap 7)
  DEBE existir un test E2E que valide el flujo completo.

  Scenario: Setup via db-seed
    Given que el test usa el patron db-seed existente
    When se crea un tenant de prueba
    Then DEBE crear tenant, settings, stations, employee, terminal via PrismaClient directo
    And DEBE crear onboarding_steps en DB
    And DEBE generar JWT para el admin del tenant

  Scenario: Login como admin del tenant provisionado
    Given que el tenant de prueba existe con admin employee
    When el test navega a la pagina de login
    And ingresa las credenciales del admin
    Then DEBE autenticarse exitosamente
    And DEBE redirigir al dashboard

  Scenario: Navegar a onboarding wizard
    Given que el admin esta autenticado
    When navega a /admin/onboarding
    Then DEBE ver el wizard con los 6 pasos
    And DEBE ver 0% de progreso
    And los pasos requeridos DEBEN estar marcados como pendientes

  Scenario: Completar paso "Crear Empleados"
    Given que el admin esta en el wizard
    When navega a la seccion de empleados del admin panel
    And crea un nuevo empleado con nombre y PIN
    Then el paso "Crear Empleados" DEBERIA poder marcarse como completado
    And el progreso DEBE actualizarse

  Scenario: Completar paso "Crear Productos"
    Given que el admin esta en el wizard
    When navega a la seccion de productos del admin panel
    And crea un nuevo producto con nombre, precio y categoria
    Then el paso "Crear Productos" DEBERIA poder marcarse como completado
    And el progreso DEBE actualizarse

  Scenario: Verificar producto en POS
    Given que se ha creado al menos un producto
    When el test navega al POS
    Then el producto creado DEBE aparecer en el catalogo del POS

  Scenario: Cleanup de datos de prueba
    Given que el test ha terminado (pass o fail)
    Then DEBE eliminar todos los datos del tenant de prueba
    And DEBE usar deleteMany({ where: { tenant_id } }) (NUNCA deleteMany({}))
    And DEBE desconectar PrismaClient

  Scenario: Test es independiente
    Given que el test crea su propio tenant
    Then NO DEBE depender de datos preexistentes en la DB
    And NO DEBE afectar otros tenants
    And DEBE poder ejecutarse en paralelo con otros tests
```

---

## Criterios de Aceptacion Globales

```gherkin
Feature: Criterios Globales
  Todos los cambios DEBEN cumplir los estandares del proyecto.

  Scenario: TypeScript compila sin errores
    When se ejecuta `tsc --noEmit`
    Then DEBE retornar exit code 0
    And DEBE tener 0 errores de tipo

  Scenario: Tests unitarios pasan
    When se ejecuta `npm run test`
    Then TODOS los tests DEBEN pasar
    And NO DEBE haber regresiones en tests existentes

  Scenario: Build exitoso
    When se ejecuta `npm run build`
    Then DEBE completar sin errores

  Scenario: Seguridad
    Given que tenant_id se usa en queries
    Then SIEMPRE DEBE venir del JWT (authResult.user.tenantId)
    And NUNCA DEBE venir de parametros del cliente

  Scenario: Dinero en centavos
    Given que se manejan montos monetarios
    Then SIEMPRE DEBEN ser enteros (centavos)
    And NUNCA DEBEN ser float/decimal
```
