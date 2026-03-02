# Tenant Onboarding — Flujo de Aprovisionamiento

> Documento operativo | Fase piloto | Flujo admin-initiated

## Resumen

El aprovisionamiento de tenants en PARK POS es un proceso **iniciado por un super-administrador**. No existe registro de autoservicio (self-service) durante la fase piloto. El flujo completo es:

1. El super-admin provisiona el tenant via formulario interno
2. El super-admin entrega las credenciales al dueno de la polleria
3. El dueno inicia sesion y sigue el asistente de onboarding
4. El progreso se rastrea automaticamente en la tabla `onboarding_steps`

## Por que no hay self-service

En la fase piloto, el aprovisionamiento manual permite:

- **Control de calidad** — Cada tenant nuevo se revisa antes de activar
- **Configuracion personalizada** — Se ajustan parametros segun el tipo de negocio
- **Soporte directo** — El super-admin puede asistir al dueno durante la configuracion
- **Seguridad** — No se expone un endpoint publico de registro que podria ser abusado

El self-service se evaluara en fases futuras cuando el flujo este validado con usuarios reales.

## Flujo de aprovisionamiento

### Paso 1: Super-admin provisiona el tenant

**Ruta:** `/admin/tenant/provisioning`
**API:** `POST /api/admin/tenants/provision`

El super-admin completa el formulario con:

| Campo | Requerido | Descripcion |
|-------|-----------|-------------|
| `legal_name` | Si | Nombre legal del negocio (ej: "Polleria El Buen Sabor S.A.C.") |
| `admin_name` | Si | Nombre del administrador del tenant |
| `admin_pin` | Si | PIN de 4 digitos para el admin |
| `ruc` | No | RUC de 11 digitos para facturacion SUNAT |
| `address_text` | No | Direccion fisica del local |
| `timezone` | No | Default: `America/Lima` |
| `currency` | No | Default: `PEN` |

### Paso 2: Creacion atomica

La funcion `provisionTenant()` en `src/core/tenant/provisioning.ts` ejecuta todo dentro de una transaccion Prisma (timeout 30s). Si cualquier paso falla, se revierte todo.

Recursos creados atomicamente:

| # | Recurso | Detalle |
|---|---------|---------|
| 1 | `tenants` | Registro del tenant |
| 2 | `tenant_settings` | Configuracion con `onboarding_status: 'IN_PROGRESS'` |
| 3 | `catalog_meta` | Metadata del catalogo (version 1) |
| 4 | `stations` (x4) | PARRILLA, COCINA, BAR, EMPAQUE |
| 5 | `employees` (x1) | Admin con PIN hasheado |
| 6 | `terminal_number_ranges` (x10) | Rangos de numeracion |
| 7 | `terminals` (x1) | Terminal por defecto |
| 8 | `onboarding_steps` (x6) | Checklist de configuracion |

### Paso 3: Entrega de credenciales

Al completar la provision, el sistema muestra:

- **Tenant ID** — UUID del tenant
- **Employee ID del admin** — UUID del empleado administrador
- **Codigo de activacion** — 6 digitos para activar el terminal
- **PIN del admin** — El PIN ingresado (se muestra una sola vez)

El super-admin copia estas credenciales y las entrega al dueno del negocio de forma segura (en persona, llamada telefonica, mensaje cifrado). **No se envian por email automaticamente.**

### Paso 4: El dueno configura su negocio

El dueno de la polleria:

1. Accede a la URL del sistema
2. Inicia sesion con su PIN de administrador
3. Sigue el asistente de onboarding en `/admin/onboarding`
4. Completa los 6 pasos de configuracion (ver seccion siguiente)

## Pasos de onboarding

Definidos en `src/core/tenant/onboarding-steps.ts` (single source of truth):

| # | Clave | Titulo | Requerido | Ruta |
|---|-------|--------|-----------|------|
| 1 | `CONFIGURE_BASIC_INFO` | Configurar Informacion del Negocio | Si | `/admin/config` |
| 2 | `CREATE_EMPLOYEE` | Crear Empleados | Si | `/admin/employees` |
| 3 | `CREATE_PRODUCT` | Crear Productos | Si | `/admin/products` |
| 4 | `CONFIGURE_STATIONS` | Configurar Estaciones | No | `/admin/stations` |
| 5 | `ACTIVATE_TERMINAL` | Activar Terminal | Si | `/admin/terminals` |
| 6 | `CONFIGURE_PAYMENT_METHODS` | Configurar Metodos de Pago | No | `/admin/payment-methods` |

### Completar un paso

**API:** `PUT /api/admin/onboarding/steps/:key/complete`

Cada paso se marca como completado individualmente. El sistema registra:
- `is_completed: true`
- `completed_at` — Timestamp
- `completed_by` — UUID del empleado que completo el paso

### Consultar progreso

**API:** `GET /api/admin/onboarding`

Retorna:
```json
{
  "tenant_id": "uuid",
  "status": "IN_PROGRESS",
  "steps": [...],
  "completion_percentage": 50,
  "progress": {
    "completed": 3,
    "total": 6,
    "percentage": 50
  }
}
```

### Onboarding completo

Cuando todos los pasos **requeridos** estan completados:
- `tenant_settings.onboarding_status` cambia a `'COMPLETED'`
- El asistente muestra un mensaje de felicitacion
- El admin es redirigido al dashboard principal

## Modelo de datos

### Tabla `onboarding_steps`

```
id              UUID (PK, auto-generated)
tenant_id       UUID (FK -> tenants.id)
step_number     Int
step_key        String (CONFIGURE_BASIC_INFO, CREATE_EMPLOYEE, etc.)
title           String
description     String?
is_required     Boolean (default: true)
is_completed    Boolean (default: false)
completed_at    DateTime?
completed_by    UUID?
metadata        Json?
created_at      DateTime
updated_at      DateTime

UNIQUE(tenant_id, step_key)
INDEX(tenant_id, step_number)
INDEX(tenant_id, is_completed)
```

### Campo en `tenant_settings`

```
onboarding_status  String (default: 'IN_PROGRESS')
```

Valores posibles: `'IN_PROGRESS'` | `'COMPLETED'`

## Guia para el dueno

Para la guia de configuracion dirigida al dueno de la polleria (no tecnica), ver:

- `docs/GUIA_INICIO_RAPIDO.md` — Guia paso a paso en espanol

## Archivos relacionados

| Archivo | Descripcion |
|---------|-------------|
| `src/core/tenant/provisioning.ts` | Servicio de aprovisionamiento atomico |
| `src/core/tenant/onboarding.ts` | Servicio de onboarding (CRUD de pasos) |
| `src/core/tenant/onboarding-steps.ts` | Definicion de los 6 pasos (single source of truth) |
| `src/app/admin/tenant/provisioning/page.tsx` | UI de aprovisionamiento (super-admin) |
| `src/app/admin/onboarding/page.tsx` | UI del asistente de onboarding (dueno) |
| `src/app/admin/components/onboarding/OnboardingWizard.tsx` | Componente wizard |
| `src/app/api/admin/tenants/provision/route.ts` | API de aprovisionamiento |
| `src/app/api/admin/onboarding/route.ts` | API de consulta de onboarding |
| `src/app/api/admin/onboarding/steps/[key]/complete/route.ts` | API para completar pasos |
| `docs/GUIA_INICIO_RAPIDO.md` | Guia para el dueno de la polleria |

## Consideraciones de seguridad

- La ruta `/admin/tenant/provisioning` **requiere autenticacion** de super-admin
- Las credenciales del tenant (PIN) se muestran una sola vez en pantalla
- El PIN se almacena hasheado (`hashPin()` de `src/core/auth/crypto-utils.ts`)
- La transaccion de aprovisionamiento usa `RepeatableRead` isolation con timeout de 30s
- No existe endpoint publico para crear tenants
