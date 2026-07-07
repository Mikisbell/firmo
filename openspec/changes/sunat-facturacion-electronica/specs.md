# Specs: SUNAT Facturacion Electronica — Integracion Directa via nodefact

> **Change**: sunat-facturacion-electronica
> **Artifact**: specs (SDD v2.5.0)
> **Depends on**: proposal.md (completado)
> **Date**: 2026-03-02

---

## Tabla de Contenido

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Requisitos Funcionales por Fase](#2-requisitos-funcionales-por-fase)
3. [Requisitos No-Funcionales](#3-requisitos-no-funcionales)
4. [Modelos de Datos](#4-modelos-de-datos)
5. [Interfaces y Contratos](#5-interfaces-y-contratos)
6. [Escenarios Gherkin por Fase](#6-escenarios-gherkin-por-fase)
7. [Criterios de Aceptacion](#7-criterios-de-aceptacion)
8. [Matriz de Trazabilidad](#8-matriz-de-trazabilidad)

---

## 1. Resumen Ejecutivo

Este documento especifica los requisitos tecnicos detallados para implementar facturacion electronica SUNAT directa en FIRMO POS usando el paquete npm `nodefact` (MIT, costo S/ 0.00). Cubre 4 fases: F1 Queue Worker + nodefact, F2 Config per-tenant, F3 Resumen Diario, F4 Contingencia persistente.

### Estado actual del sistema

- `invoice.service.ts` (1207 lineas): Emisión, anulacion, notas de credito — funcional en modo mock.
- `SunatClient` (`client.ts`): `realSendInvoice()` retorna `SUNAT_NOT_IMPLEMENTED`.
- `NubefactAdapter` (`nubefact-adapter.ts`): Completo, testeado (16 tests), usa REST API de Nubefact.
- `provider-config.ts`: Ya soporta `SunatProvider = 'mock' | 'nubefact' | 'sunat-direct'`.
- `ContingencyManager` (`contingency.ts`): Funcional pero in-memory (`this.pendingInvoices = []`).
- DB Models: `invoices`, `invoice_queue`, `invoice_cdr`, `credit_notes`, `sunat_daily_summary` — todos existen.
- `invoice_queue` schema: `id, tenant_id, invoice_id, action, priority, attempts, max_attempts, last_attempt_at, last_error, scheduled_at, processed_at, status`.
- `tenant_settings`: No tiene campos SUNAT/SOL/certificado.
- Events: `INVOICE_ISSUED`, `INVOICE_VOIDED`, `CREDIT_NOTE_ISSUED`, `CREDIT_NOTE_VOIDED` — existen. Faltan: `INVOICE_SENT_TO_SUNAT`, `INVOICE_SUNAT_ACCEPTED`, `INVOICE_SUNAT_REJECTED`, `DAILY_SUMMARY_SENT`.
- Cron: Un solo cron job existente (`/api/cron/maintenance`, semanal, patron `CRON_SECRET`).
- Encryption: `src/core/security/encryption.ts` usa AES-GCM via Web Crypto API (client-side). Para server-side se necesita implementar con Node.js `crypto` module.

### Dependencia unica nueva

```
nodefact (MIT) — trae: xml-crypto, soap, xml2js, handlebars, pdfkit, qrcode
```

---

## 2. Requisitos Funcionales por Fase

### Fase 1 — Queue Worker + SunatDirectAdapter (F1)

#### F1-REQ-01: SunatDirectAdapter

El sistema DEBE implementar un adapter `SunatDirectAdapter` que delegue a `nodefact` para:

| Operacion | Metodo nodefact | Documento SUNAT |
|-----------|-----------------|-----------------|
| Emitir Factura | `nodefact.createInvoice({ tipo: '01', ... })` | Factura Electronica (01) |
| Emitir Boleta | `nodefact.createInvoice({ tipo: '03', ... })` | Boleta de Venta Electronica (03) |
| Nota de Credito | `nodefact.createCreditNote({ ... })` | Nota de Credito Electronica (07) |
| Comunicacion de Baja | `nodefact.createVoidedDocuments({ ... })` | Comunicacion de Baja |
| Resumen Diario | `nodefact.createDailySummary({ ... })` | Resumen Diario |

**Responsabilidades del adapter**:
- Traducir formato interno PARK (`InvoiceData`) a formato nodefact.
- Pasar credenciales SOL y certificado PEM del tenant a nodefact.
- Retornar `Result<SunatDirectResponse, DomainError>` con CDR, hash, PDF bytes, QR string.
- Manejar errores SOAP (timeout, 500, certificado invalido) con mensajes descriptivos.
- Log cada operacion con `trace_id` via `pinoLogger`.

**Interfaz del adapter**:

```typescript
interface SunatDirectAdapter {
  sendInvoice(data: InvoiceData, creds: TenantSunatCredentials): Promise<Result<SunatDirectResponse, DomainError>>;
  sendCreditNote(data: CreditNoteData, creds: TenantSunatCredentials): Promise<Result<SunatDirectResponse, DomainError>>;
  sendVoidRequest(data: VoidRequestData, creds: TenantSunatCredentials): Promise<Result<SunatDirectResponse, DomainError>>;
  sendDailySummary(data: DailySummaryData, creds: TenantSunatCredentials): Promise<Result<DailySummaryResponse, DomainError>>;
}
```

#### F1-REQ-02: Queue Worker

El sistema DEBE implementar un worker que:

1. Consulta `invoice_queue WHERE status = 'PENDING' AND scheduled_at <= NOW() ORDER BY priority ASC, scheduled_at ASC LIMIT {batchSize}`.
2. Para cada item:
   a. Carga `tenant_settings` del tenant para obtener `sunat_provider`, `sunat_mode`, credenciales.
   b. Si `sunat_mode = 'DISABLED'`: SKIP (no procesa, no marca como error).
   c. Si no hay credenciales configuradas: SKIP con log warning.
   d. Selecciona adapter segun `sunat_provider`:
      - `SUNAT_DIRECT` → `SunatDirectAdapter`
      - `NUBEFACT` → `NubefactAdapter`
   e. Ejecuta la accion segun `action` field:
      - `EMIT_TO_SUNAT` → `adapter.sendInvoice()`
      - `VOID_IN_SUNAT` → `adapter.sendVoidRequest()`
      - `CREDIT_NOTE_TO_SUNAT` → `adapter.sendCreditNote()`
   f. Si EXITO:
      - Actualiza `invoice_queue.status = 'PROCESSED'`, `processed_at = NOW()`.
      - Crea/actualiza `invoice_cdr` con CDR, hash, XML.
      - Emite evento `INVOICE_SUNAT_ACCEPTED`.
      - Almacena PDF/XML si el adapter los genera.
   g. Si FALLO:
      - Incrementa `attempts`.
      - Guarda `last_error` (message truncado a 500 chars).
      - Guarda `last_attempt_at = NOW()`.
      - Si `attempts < max_attempts`: programa retry con backoff (`scheduled_at = NOW() + attempts * 5 minutes`).
      - Si `attempts >= max_attempts`: marca `status = 'FAILED'`, emite evento `INVOICE_SUNAT_REJECTED`, logguea alerta.
      - Emite evento `INVOICE_SENT_TO_SUNAT` con `success: false`.
3. Retorna resumen: `{ processed: N, failed: N, skipped: N, duration_ms: N }`.

**Parametros configurables** (constantes, no env vars):
- `BATCH_SIZE = 10` (items por invocacion)
- `MAX_WORKER_DURATION_MS = 50_000` (safety timeout, Vercel limit ~60s)
- `RETRY_BASE_MINUTES = 5` (backoff base)

#### F1-REQ-03: Cron Endpoint `/api/cron/sunat-queue`

El sistema DEBE crear un endpoint cron que:
- Escucha `GET /api/cron/sunat-queue`.
- Verifica `CRON_SECRET` en header `authorization` (patron identico a `/api/cron/maintenance`).
- Invoca al queue worker.
- Retorna 200 con resumen JSON.
- Se ejecuta cada 2 minutos (configurado en `vercel.json`).

#### F1-REQ-04: Refactorizar SunatClient

`SunatClient.realSendInvoice()` DEBE:
- Dejar de retornar `SUNAT_NOT_IMPLEMENTED`.
- Delegar a `SunatDirectAdapter` (default) o `NubefactAdapter` segun configuracion del tenant.
- Recibir `tenantId` como parametro para cargar credenciales per-tenant.
- Mantener modo mock en development.

#### F1-REQ-05: Provider Config Actualizado

`provider-config.ts` DEBE:
- Mantener `SunatProvider = 'mock' | 'nubefact' | 'sunat-direct'`.
- Agregar interface `TenantSunatCredentials`:
  ```typescript
  interface TenantSunatCredentials {
    provider: SunatProvider;
    mode: 'PRODUCTION' | 'BETA' | 'DISABLED';
    solUser?: string;
    solPassword?: string;        // decrypted
    certificatePem?: string;     // decrypted
    privateKeyPem?: string;      // decrypted
    nubefactToken?: string;      // decrypted
    nubefactUrl?: string;
    ruc: string;
  }
  ```
- `getSunatProviderConfig()` se mantiene para modo global; agregar `getTenantSunatConfig(tenantId)` que lee de `tenant_settings`.

#### F1-REQ-06: Nuevos Event Types

Agregar al discriminated union en `events.ts`:

| Event Type | Aggregate | Payload |
|------------|-----------|---------|
| `INVOICE_SENT_TO_SUNAT` | `INVOICE` | `{ invoice_id, queue_item_id, provider, attempt, success }` |
| `INVOICE_SUNAT_ACCEPTED` | `INVOICE` | `{ invoice_id, response_code, hash, cdr_received_at }` |
| `INVOICE_SUNAT_REJECTED` | `INVOICE` | `{ invoice_id, response_code, error_message, attempts }` |
| `DAILY_SUMMARY_SENT` | `INVOICE` | `{ summary_id, tenant_id, summary_date, boletas_count, ticket_number }` |

Cada uno DEBE tener Zod schema, ser parte de `EventSchema` union, tener type export.

#### F1-REQ-07: Vercel Cron Config

`vercel.json` DEBE actualizarse:
```json
{
  "crons": [
    { "path": "/api/cron/maintenance", "schedule": "0 3 * * 0" },
    { "path": "/api/cron/sunat-queue", "schedule": "*/2 * * * *" }
  ]
}
```

---

### Fase 2 — Configuracion SUNAT per-Tenant (F2)

#### F2-REQ-01: Schema Migration — tenant_settings

Agregar columnas a `tenant_settings` (todas nullable o con default, zero-downtime):

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| `sunat_provider` | `String` | `'NONE'` | `SUNAT_DIRECT` / `NUBEFACT` / `NONE` |
| `sunat_mode` | `String` | `'DISABLED'` | `PRODUCTION` / `BETA` / `DISABLED` |
| `sunat_sol_user` | `String?` | `null` | Usuario SOL de SUNAT |
| `sunat_sol_password_enc` | `String?` | `null` | Password SOL encriptado (AES-256-GCM) |
| `sunat_certificate_pem_enc` | `String?` | `null` | Certificado X.509 PEM encriptado |
| `sunat_private_key_pem_enc` | `String?` | `null` | Clave privada RSA PEM encriptada |
| `sunat_certificate_expires_at` | `DateTime?` | `null` | Fecha expiracion del certificado |
| `nubefact_token_enc` | `String?` | `null` | Token Nubefact encriptado |
| `nubefact_url` | `String?` | `null` | URL API Nubefact |

**Convencion de nombres**: Columnas encriptadas usan sufijo `_enc`.

#### F2-REQ-02: Encriptacion Server-Side

Crear `src/core/security/server-encryption.ts` con:

```typescript
// Uses Node.js crypto module (NOT Web Crypto API from encryption.ts)
function encryptField(plaintext: string, masterKey: string): string;  // returns base64
function decryptField(ciphertext: string, masterKey: string): string;
```

- Algoritmo: AES-256-GCM con IV aleatorio de 12 bytes.
- Master key: env var `ENCRYPTION_MASTER_KEY` (32 bytes, base64).
- Output format: `base64(iv + ciphertext + authTag)`.
- NUNCA log el plaintext de credenciales.

#### F2-REQ-03: API Endpoint — Configuracion SUNAT

`GET /api/admin/facturacion/configuracion`:
- Auth: `requireAdminAuth` + `requireAdminPermission('manage_billing')`.
- Retorna config SUNAT del tenant autenticado.
- Credenciales sensibles retornadas como `{ configured: true, lastChars: '***DATOS' }` — NUNCA el valor completo.
- Retorna `sunat_certificate_expires_at` para mostrar alerta de expiracion.

`PUT /api/admin/facturacion/configuracion`:
- Auth: `requireAdminAuth` + `requireAdminPermission('manage_billing')`.
- Body (todos opcionales):
  ```typescript
  {
    sunat_provider?: 'SUNAT_DIRECT' | 'NUBEFACT' | 'NONE';
    sunat_mode?: 'PRODUCTION' | 'BETA' | 'DISABLED';
    sunat_sol_user?: string;
    sunat_sol_password?: string;      // plaintext, se encripta antes de guardar
    sunat_certificate_pem?: string;   // plaintext PEM, se encripta
    sunat_private_key_pem?: string;   // plaintext PEM, se encripta
    nubefact_token?: string;          // plaintext, se encripta
    nubefact_url?: string;
  }
  ```
- Validaciones:
  - Si `sunat_provider = 'SUNAT_DIRECT'`: requiere `sunat_sol_user`, `sunat_sol_password`, `sunat_certificate_pem`, `sunat_private_key_pem` (o que ya esten configurados).
  - Si `sunat_provider = 'NUBEFACT'`: requiere `nubefact_token`, `nubefact_url` (o que ya esten configurados).
  - `sunat_certificate_pem`: validar formato PEM (`-----BEGIN CERTIFICATE-----`), extraer fecha de expiracion con `x509` parsing.
  - `sunat_private_key_pem`: validar formato PEM (`-----BEGIN RSA PRIVATE KEY-----` o `-----BEGIN PRIVATE KEY-----`).
- Emite evento de auditoria al cambiar configuracion.

`POST /api/admin/facturacion/configuracion/test-connection`:
- Auth: `requireAdminAuth`.
- Envia un comprobante de prueba al entorno BETA de SUNAT usando las credenciales configuradas del tenant.
- Retorna: `{ success: boolean, message: string, response_code?: string }`.
- NO usa el entorno de produccion, siempre BETA.
- Timeout: 15 segundos.

#### F2-REQ-04: Admin UI — Seccion Configuracion SUNAT

En `/admin/facturacion` agregar seccion con:

1. **Selector de proveedor**: Radio buttons (SUNAT Directo / Nubefact / Deshabilitado).
2. **Campos SUNAT Directo**:
   - Input: Usuario SOL.
   - Input (password): Clave SOL.
   - File upload: Certificado digital PEM (maximo 10KB).
   - File upload: Clave privada PEM (maximo 10KB).
   - Indicador: Fecha de expiracion del certificado (con alerta si < 30 dias).
3. **Campos Nubefact** (solo si proveedor = Nubefact):
   - Input: Token de autorizacion.
   - Input: URL de API.
4. **Selector de modo**: Radio buttons (Produccion / Beta / Deshabilitado).
5. **Boton "Guardar configuracion"**: PUT a API.
6. **Boton "Probar conexion"**: POST a test-connection, muestra resultado inline.
7. **Indicador de estado**: Icono verde/rojo/gris segun si la configuracion esta completa.

#### F2-REQ-05: Queue Worker respeta configuracion

El queue worker (F1) DEBE:
- Verificar `tenant_settings.sunat_mode` antes de procesar cada item.
- Si `sunat_mode = 'DISABLED'` o `sunat_provider = 'NONE'`: SKIP sin error.
- Si credenciales faltan (null/empty): SKIP con warning log, NO marcar como FAILED.
- Si `sunat_mode = 'BETA'`: usar endpoint beta de SUNAT (`https://e-beta.sunat.gob.pe/...`).

---

### Fase 3 — Resumen Diario de Boletas (F3)

#### F3-REQ-01: Daily Summary Service

Crear `src/core/jobs/sunat-daily-summary.ts` que:

1. Recibe `targetDate` (default: dia anterior).
2. Para cada tenant activo con `sunat_mode != 'DISABLED'` y `sunat_provider != 'NONE'`:
   a. Consulta todas las boletas (tipo `'BOLETA'`) emitidas en `targetDate` con `invoice_cdr.response_code = '0'` (ACCEPTED por SUNAT).
   b. Si 0 boletas: SKIP (SUNAT no requiere resumen de dia vacio).
   c. Agrupa por serie (ej: B001, B002).
   d. Genera numero de resumen: `RC-{YYYYMMDD}-{correlativo}` (correlativo secuencial por tenant/fecha).
   e. Construye payload del Resumen Diario con totales por serie.
   f. Envia via `SunatDirectAdapter.sendDailySummary()` o NubefactAdapter equivalente.
   g. Actualiza `sunat_daily_summary`:
      - `boletas_count`: total de boletas incluidas.
      - `boletas_total`: suma de `total_cents`.
      - `ticket_number`: numero de ticket SUNAT (respuesta asincrona).
      - `sunat_status`: `'SENT'` (pendiente de CDR) o `'ACCEPTED'` (CDR exitoso).
   h. Emite evento `DAILY_SUMMARY_SENT`.
3. Retorna resumen: `{ tenants_processed, summaries_sent, summaries_skipped, errors }`.

#### F3-REQ-02: Cron Endpoint `/api/cron/sunat-daily-summary`

- Escucha `GET /api/cron/sunat-daily-summary`.
- Protegido por `CRON_SECRET`.
- Invoca al Daily Summary Service con `targetDate = yesterday`.
- Se ejecuta diariamente a las 11:00 UTC (6:00 AM Lima, UTC-5).

#### F3-REQ-03: Vercel Cron Config (actualizado)

```json
{
  "crons": [
    { "path": "/api/cron/maintenance", "schedule": "0 3 * * 0" },
    { "path": "/api/cron/sunat-queue", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/sunat-daily-summary", "schedule": "0 11 * * *" }
  ]
}
```

#### F3-REQ-04: Admin UI — Tabla Resumenes Diarios

En `/admin/facturacion` agregar seccion "Resumenes Diarios" con:

1. Tabla con columnas: Fecha, Serie, Boletas, Monto Total (S/.), Ticket SUNAT, Estado.
2. Estados posibles: PENDING (gris), SENT (amarillo), ACCEPTED (verde), REJECTED (rojo).
3. Filtro por rango de fechas.
4. Boton "Reenviar" para resumenes con estado REJECTED o PENDING (re-encola).
5. Paginacion (10 por pagina).

#### F3-REQ-05: Boletas excluidas del resumen

El Daily Summary Service DEBE excluir:
- Boletas con `invoice_cdr.response_code != '0'` (no aceptadas).
- Boletas con status `'VOIDED'`.
- Boletas sin `invoice_cdr` (aun en cola, no enviadas).

Estas boletas se incluiran en el resumen del dia en que sean finalmente aceptadas por SUNAT.

---

### Fase 4 — Contingencia Persistente (F4)

#### F4-REQ-01: Schema Migration — Modelos de Contingencia

Crear dos nuevos modelos en Prisma:

**`sunat_contingency`**:
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | `String @id @db.Uuid` | UUID |
| `tenant_id` | `String @db.Uuid` | FK a tenants |
| `active` | `Boolean @default(false)` | Estado actual |
| `reason` | `String` | SUNAT_UNREACHABLE / NETWORK_OUTAGE / CERTIFICATE_ERROR / MANUAL_ACTIVATION |
| `activated_at` | `DateTime @db.Timestamptz(6)` | Cuando se activo |
| `activated_by` | `String? @db.Uuid` | Quien activo (null si auto) |
| `deactivated_at` | `DateTime? @db.Timestamptz(6)` | Cuando se desactivo |
| `pending_count` | `Int @default(0)` | Facturas pendientes de reconciliar |
| `created_at` | `DateTime @default(now())` | Creacion |

Index: `@@index([tenant_id, active])`

**`sunat_contingency_invoices`**:
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | `String @id @db.Uuid` | UUID |
| `contingency_id` | `String @db.Uuid` | FK a sunat_contingency |
| `tenant_id` | `String @db.Uuid` | FK a tenants |
| `invoice_id` | `String @db.Uuid` | FK a invoices |
| `series` | `String` | Serie del comprobante |
| `number` | `String` | Numero del comprobante |
| `issued_at` | `DateTime @db.Timestamptz(6)` | Fecha de emision |
| `reconcile_by` | `DateTime @db.Timestamptz(6)` | Deadline: issued_at + 7 dias |
| `reconciled_at` | `DateTime? @db.Timestamptz(6)` | Cuando se reconcilio (null si pendiente) |
| `created_at` | `DateTime @default(now())` | Creacion |

Indices: `@@index([tenant_id, reconciled_at])`, `@@index([contingency_id])`

#### F4-REQ-02: Refactorizar ContingencyManager

`ContingencyManager` DEBE:
- Eliminar `private pendingInvoices: ContingencyInvoice[] = []`.
- Eliminar `private state: ContingencyState = { ... }`.
- Todos los metodos read/write van a Prisma.
- `getState()` → `prisma.sunat_contingency.findFirst({ where: { tenant_id, active: true } })`.
- `activate()` → `prisma.sunat_contingency.create(...)`.
- `deactivate()` → `prisma.sunat_contingency.update({ where: { id }, data: { active: false, deactivated_at: NOW() } })`.
- `registerContingencyInvoice()` → `prisma.sunat_contingency_invoices.create(...)` + increment `pending_count`.
- `markReconciled()` → `prisma.sunat_contingency_invoices.update({ data: { reconciled_at: NOW() } })` + decrement `pending_count`.
- `getPendingInvoices()` → `prisma.sunat_contingency_invoices.findMany({ where: { tenant_id, reconciled_at: null } })`.
- `getUrgentReconciliations()` → query where `reconcile_by <= cutoff AND reconciled_at IS NULL`.
- Recibir `tenantId` en constructor (scoped per-tenant, no singleton global).
- Health check timer: se mantiene pero ahora es no-persistente (in-memory interval es aceptable para polling).

#### F4-REQ-03: Admin UI — Seccion Contingencia

En `/admin/facturacion` agregar seccion "Modo Contingencia" con:

1. **Indicador de estado**: Badge grande (ACTIVO rojo / INACTIVO verde).
2. **Si activo**: Muestra razon, fecha de activacion, usuario que activo, conteo de facturas pendientes.
3. **Tabla de facturas en contingencia**: Serie, Numero, Emitida, Deadline, Estado (Pendiente/Reconciliado/Vencido).
4. **Alerta visual**: Facturas con `reconcile_by < NOW()` marcadas en ROJO con icono de alerta.
5. **Alerta visual**: Facturas con `reconcile_by < NOW() + 24h` marcadas en AMARILLO.
6. **Boton "Activar contingencia manual"**: Solo OWNER/ADMIN. Crea contingencia con reason `MANUAL_ACTIVATION`.
7. **Boton "Desactivar contingencia"**: Solo OWNER/ADMIN. Solo si hay 0 facturas vencidas pendientes.

#### F4-REQ-04: Recuperacion al reinicio

Al iniciar el server/request, `ContingencyManager` DEBE:
- Consultar DB para cargar estado actual (`sunat_contingency WHERE active = true AND tenant_id = X`).
- NO depender de estado in-memory.
- Health checks se reinician si hay contingencia activa.

---

## 3. Requisitos No-Funcionales

### NFR-01: Performance

| Metrica | Target | Justificacion |
|---------|--------|---------------|
| Queue worker: items/invocacion | 10 | Vercel timeout 60s, margen para SOAP lento |
| Queue worker: latencia por item | < 8s promedio | SUNAT SOAP: ~3-5s, overhead: ~2-3s |
| Cron frequency | 2 min | 300 items/hora > 200 boletas/dia por tenant |
| Daily summary: latencia total | < 30s | 1 resumen/tenant, max ~20 tenants activos |
| API config: response time | < 500ms | CRUD simple, no SUNAT call |
| Test connection: timeout | 15s | SUNAT beta puede ser lento |

### NFR-02: Security

| Requisito | Implementacion |
|-----------|----------------|
| Credenciales SOL encriptadas at-rest | AES-256-GCM con `ENCRYPTION_MASTER_KEY` |
| Certificado PEM encriptado at-rest | AES-256-GCM, misma master key |
| Credenciales NUNCA en logs | `pinoLogger` redact: `sunat_sol_password`, `certificate_pem`, `private_key_pem` |
| Credenciales NUNCA en response | API retorna `{ configured: true }`, nunca el valor |
| CRON_SECRET en cron endpoints | `authorization: Bearer {CRON_SECRET}` |
| Admin-only config | `requireAdminPermission('manage_billing')` |
| Certificado PEM validado al upload | Formato PEM valido, fecha de expiracion extraida |
| Private key PEM validada al upload | Formato PEM valido |
| Max file size para PEM | 10KB (certificados X.509 tipicamente < 5KB) |

### NFR-03: Observability

| Aspecto | Requisito |
|---------|-----------|
| Logs del queue worker | Cada item: `{ queue_item_id, tenant_id, invoice_id, action, provider, attempt, result, duration_ms }` |
| Logs del daily summary | Cada tenant: `{ tenant_id, summary_date, boletas_count, status }` |
| Eventos domain | 4 nuevos event types emitidos correctamente |
| Metrics | `sunat_queue_processed_total`, `sunat_queue_failed_total`, `sunat_queue_duration_ms` (counter/histogram via pinoLogger structured) |
| Error alerting | Items `FAILED` (max attempts) logueados con level `error` |
| Certificate expiry | Log `warn` 30 dias antes de expiracion del certificado |

### NFR-04: Reliability

| Aspecto | Requisito |
|---------|-----------|
| Retry con backoff | `scheduled_at = NOW() + attempts * 5 min` (5, 10, 15 min) |
| Max attempts | 3 (configurable, default del schema) |
| Idempotencia | Si el mismo `invoice_queue` item se procesa 2 veces, el segundo es no-op (check `status != PENDING`) |
| SUNAT timeout | 30s timeout en SOAP call (nodefact configurable) |
| Worker timeout | 50s safety (Vercel 60s limit) |
| Graceful degradation | Si nodefact falla, NubefactAdapter disponible como fallback per-tenant |
| Contingency auto-activate | Si N consecutivos fallos de SUNAT SOAP → activar contingencia (N = 5) |

### NFR-05: Compatibility

| Aspecto | Requisito |
|---------|-----------|
| 0 regresiones | 4897+ tests existentes deben seguir pasando |
| `tsc --noEmit` | 0 errores |
| `npm run build` | Exitoso |
| Prisma migrations | Zero-downtime (nullable columns, defaults) |
| NubefactAdapter | Sin cambios, mantenido como alternativa |
| Mock mode | Development sigue usando mock, sin cambios |

---

## 4. Modelos de Datos

### 4.1 Cambios a tenant_settings (F2)

```prisma
model tenant_settings {
  // ... existing fields ...

  // === SUNAT Facturacion Electronica ===
  sunat_provider               String?   // SUNAT_DIRECT | NUBEFACT | NONE
  sunat_mode                   String?   @default("DISABLED") // PRODUCTION | BETA | DISABLED
  sunat_sol_user               String?
  sunat_sol_password_enc       String?   // AES-256-GCM encrypted
  sunat_certificate_pem_enc    String?   // AES-256-GCM encrypted
  sunat_private_key_pem_enc    String?   // AES-256-GCM encrypted
  sunat_certificate_expires_at DateTime? @db.Timestamptz(6)
  nubefact_token_enc           String?   // AES-256-GCM encrypted
  nubefact_url                 String?
}
```

### 4.2 Nuevos modelos (F4)

```prisma
model sunat_contingency {
  id                          String                       @id @db.Uuid
  tenant_id                   String                       @db.Uuid
  active                      Boolean                      @default(false)
  reason                      String
  activated_at                DateTime                     @db.Timestamptz(6)
  activated_by                String?                      @db.Uuid
  deactivated_at              DateTime?                    @db.Timestamptz(6)
  pending_count               Int                          @default(0)
  created_at                  DateTime                     @default(now()) @db.Timestamptz(6)
  tenants                     tenants                      @relation(fields: [tenant_id], references: [id])
  sunat_contingency_invoices  sunat_contingency_invoices[]

  @@index([tenant_id, active])
}

model sunat_contingency_invoices {
  id               String              @id @db.Uuid
  contingency_id   String              @db.Uuid
  tenant_id        String              @db.Uuid
  invoice_id       String              @db.Uuid
  series           String
  number           String
  issued_at        DateTime            @db.Timestamptz(6)
  reconcile_by     DateTime            @db.Timestamptz(6)
  reconciled_at    DateTime?           @db.Timestamptz(6)
  created_at       DateTime            @default(now()) @db.Timestamptz(6)
  sunat_contingency sunat_contingency  @relation(fields: [contingency_id], references: [id])
  tenants          tenants             @relation(fields: [tenant_id], references: [id])
  invoices         invoices            @relation(fields: [invoice_id], references: [id])

  @@index([tenant_id, reconciled_at])
  @@index([contingency_id])
}
```

### 4.3 Modelos existentes sin cambios

- `invoices` — sin cambios
- `invoice_queue` — sin cambios (schema ya tiene todo lo necesario: `attempts`, `max_attempts`, `last_error`, `scheduled_at`, `status`)
- `invoice_cdr` — sin cambios
- `credit_notes` — sin cambios
- `sunat_daily_summary` — sin cambios estructurales (campos existentes cubren el caso)

---

## 5. Interfaces y Contratos

### 5.1 SunatDirectAdapter Interface

```typescript
// src/core/integrations/sunat/sunat-direct-adapter.ts

export interface TenantSunatCredentials {
  ruc: string;
  solUser: string;
  solPassword: string;
  certificatePem: string;
  privateKeyPem: string;
  mode: 'PRODUCTION' | 'BETA';
}

export interface SunatDirectResponse {
  accepted: boolean;
  responseCode: string;
  responseMessage: string;
  hash?: string;
  cdrXml?: string;
  pdfBytes?: Buffer;
  qrString?: string;
  signedXml?: string;
}

export interface DailySummaryResponse {
  ticketNumber: string;
  accepted: boolean;
  responseCode: string;
  responseMessage: string;
}

export interface SunatDirectAdapter {
  sendInvoice(
    data: InvoiceData,
    creds: TenantSunatCredentials
  ): Promise<Result<SunatDirectResponse, DomainError>>;

  sendCreditNote(
    data: CreditNoteData,
    creds: TenantSunatCredentials
  ): Promise<Result<SunatDirectResponse, DomainError>>;

  sendVoidRequest(
    data: VoidRequestData,
    creds: TenantSunatCredentials
  ): Promise<Result<SunatDirectResponse, DomainError>>;

  sendDailySummary(
    data: DailySummaryData,
    creds: TenantSunatCredentials
  ): Promise<Result<DailySummaryResponse, DomainError>>;
}
```

### 5.2 Queue Worker Interface

```typescript
// src/core/jobs/sunat-queue-worker.ts

export interface QueueWorkerResult {
  processed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  items: QueueItemResult[];
}

export interface QueueItemResult {
  queueItemId: string;
  invoiceId: string;
  tenantId: string;
  action: string;
  status: 'PROCESSED' | 'FAILED' | 'SKIPPED' | 'RETRY';
  error?: string;
  durationMs: number;
}

export async function processQueue(
  options?: { batchSize?: number; maxDurationMs?: number }
): Promise<QueueWorkerResult>;
```

### 5.3 API Contracts

#### GET /api/admin/facturacion/configuracion

Response 200:
```json
{
  "sunat_provider": "SUNAT_DIRECT",
  "sunat_mode": "BETA",
  "sunat_sol_user": "MODDATOS",
  "sunat_sol_password_configured": true,
  "sunat_certificate_configured": true,
  "sunat_certificate_expires_at": "2027-06-15T00:00:00.000Z",
  "sunat_certificate_expires_in_days": 470,
  "sunat_private_key_configured": true,
  "nubefact_token_configured": false,
  "nubefact_url": null,
  "ruc": "20123456789"
}
```

#### PUT /api/admin/facturacion/configuracion

Request body (partial update):
```json
{
  "sunat_provider": "SUNAT_DIRECT",
  "sunat_mode": "BETA",
  "sunat_sol_user": "MODDATOS",
  "sunat_sol_password": "miClaveSOL123"
}
```

Response 200:
```json
{
  "success": true,
  "message": "Configuracion SUNAT actualizada exitosamente",
  "warnings": ["Certificado digital expira en 25 dias"]
}
```

#### POST /api/admin/facturacion/configuracion/test-connection

Response 200:
```json
{
  "success": true,
  "message": "Conexion exitosa con SUNAT Beta",
  "response_code": "0",
  "response_message": "La Boleta de Venta electronica ha sido aceptada",
  "duration_ms": 3200
}
```

Response 200 (error de SUNAT, no HTTP error):
```json
{
  "success": false,
  "message": "SUNAT rechazo el comprobante de prueba",
  "response_code": "2010",
  "response_message": "El certificado digital no corresponde al emisor",
  "duration_ms": 2100
}
```

---

## 6. Escenarios Gherkin por Fase

### Fase 1 — Queue Worker + SunatDirectAdapter

```gherkin
Feature: F1 — SunatDirectAdapter y Queue Worker
  Como sistema FIRMO POS
  Necesito enviar comprobantes electronicos a SUNAT via nodefact
  Para cumplir con la obligacion de facturacion electronica

  Background:
    Given un tenant "Polleria El Sabroson" con RUC "20123456789"
    And credenciales SOL configuradas (sol_user="MODDATOS", sol_password="***")
    And certificado digital PEM valido (expira 2027-06-15)
    And sunat_provider = "SUNAT_DIRECT"
    And sunat_mode = "BETA"

  # --- SunatDirectAdapter ---

  Scenario: F1-S01 — Emitir boleta exitosamente via SUNAT directo
    Given una boleta B001-00000123 con total S/ 45.00 en invoice_queue con status "PENDING"
    When el SunatDirectAdapter procesa la boleta
    Then nodefact genera XML UBL 2.1 firmado digitalmente
    And nodefact envia SOAP al endpoint beta de SUNAT
    And SUNAT responde con CDR codigo "0" (aceptada)
    And el adapter retorna Result.ok con hash, CDR XML, PDF bytes, QR string

  Scenario: F1-S02 — SUNAT rechaza boleta por error de datos
    Given una boleta B001-00000124 con total S/ 0.00 (invalido)
    When el SunatDirectAdapter procesa la boleta
    Then SUNAT responde con CDR codigo "2017" (monto invalido)
    And el adapter retorna Result.err con DomainError code "SUNAT_REJECTED"
    And el error incluye response_code "2017" y mensaje descriptivo

  Scenario: F1-S03 — SUNAT timeout por servicio caido
    Given SUNAT web service esta caido (timeout 30s)
    When el SunatDirectAdapter intenta enviar una boleta
    Then despues de 30 segundos el adapter retorna Result.err con code "SUNAT_TIMEOUT"
    And el error incluye mensaje "Timeout al conectar con SUNAT"

  Scenario: F1-S04 — Certificado digital invalido o expirado
    Given un certificado PEM expirado (expired 2025-01-01)
    When el SunatDirectAdapter intenta firmar un XML
    Then retorna Result.err con code "CERTIFICATE_ERROR"
    And el error incluye mensaje "Certificado digital expirado"

  Scenario: F1-S05 — Emitir nota de credito via SUNAT directo
    Given una nota de credito NC01-00000005 referenciando factura F001-00000010
    When el SunatDirectAdapter procesa la nota de credito
    Then nodefact genera XML de Nota de Credito (tipo 07)
    And SUNAT responde con CDR codigo "0"

  # --- Queue Worker ---

  Scenario: F1-S06 — Queue worker procesa batch de items exitosamente
    Given 5 items en invoice_queue con status "PENDING" y scheduled_at <= NOW()
    And todos los tenants tienen credenciales SOL configuradas
    When el cron job /api/cron/sunat-queue se ejecuta
    Then el worker procesa los 5 items en orden de prioridad
    And cada item exitoso tiene status = "PROCESSED" y processed_at = NOW()
    And se crea invoice_cdr para cada uno con CDR, hash
    And se emite evento INVOICE_SUNAT_ACCEPTED por cada uno
    And el endpoint retorna { processed: 5, failed: 0, skipped: 0 }

  Scenario: F1-S07 — Queue worker retry con backoff exponencial
    Given un item en invoice_queue con status "PENDING", attempts = 0, max_attempts = 3
    And SUNAT responde con error 500
    When el worker procesa el item
    Then el item tiene attempts = 1, last_error con mensaje del error
    And scheduled_at = NOW() + 5 minutos (attempt 1 * 5 min)
    And status permanece "PENDING"
    And se emite evento INVOICE_SENT_TO_SUNAT con success = false

  Scenario: F1-S08 — Queue worker marca FAILED al agotar intentos
    Given un item en invoice_queue con status "PENDING", attempts = 2, max_attempts = 3
    And SUNAT responde con error
    When el worker procesa el item
    Then el item tiene attempts = 3, status = "FAILED"
    And se emite evento INVOICE_SUNAT_REJECTED
    And se logguea con nivel "error" incluyendo invoice_id y tenant_id

  Scenario: F1-S09 — Queue worker ignora tenants con SUNAT deshabilitado
    Given un item de tenant con sunat_mode = "DISABLED"
    When el worker procesa el batch
    Then el item se SKIP (no se procesa, no se marca como error)
    And el resumen muestra skipped: 1

  Scenario: F1-S10 — Queue worker ignora tenants sin credenciales
    Given un item de tenant sin sunat_sol_user configurado
    When el worker procesa el batch
    Then el item se SKIP con warning log
    And el resumen muestra skipped: 1

  Scenario: F1-S11 — Queue worker usa NubefactAdapter para tenants Nubefact
    Given un item de tenant con sunat_provider = "NUBEFACT"
    And el tenant tiene nubefact_token y nubefact_url configurados
    When el worker procesa el item
    Then se usa NubefactAdapter en lugar de SunatDirectAdapter
    And el item se procesa exitosamente

  Scenario: F1-S12 — Queue worker respeta BATCH_SIZE limit
    Given 25 items en invoice_queue con status "PENDING"
    And BATCH_SIZE = 10
    When el worker se ejecuta
    Then procesa exactamente 10 items (los de mayor prioridad y mas antiguos)
    And los 15 restantes se procesan en la siguiente invocacion

  Scenario: F1-S13 — Queue worker respeta MAX_WORKER_DURATION timeout
    Given 10 items en invoice_queue
    And cada llamada a SUNAT tarda 8 segundos
    And MAX_WORKER_DURATION_MS = 50000
    When el worker se ejecuta
    Then procesa items hasta que el tiempo acumulado se acerca a 50s
    And para el procesamiento de forma segura antes de 50s
    And retorna resultados parciales (items procesados hasta ese punto)

  Scenario: F1-S14 — Idempotencia — item ya procesado no se re-procesa
    Given un item en invoice_queue con status "PROCESSED"
    When la query del worker busca PENDING items
    Then ese item NO aparece en el resultado (filtrado por status = PENDING)

  Scenario: F1-S15 — Cron endpoint rechaza request sin CRON_SECRET
    Given CRON_SECRET = "my-secret-123"
    When se hace GET /api/cron/sunat-queue sin header authorization
    Then retorna 401 Unauthorized

  Scenario: F1-S16 — Cron endpoint acepta request con CRON_SECRET valido
    Given CRON_SECRET = "my-secret-123"
    When se hace GET /api/cron/sunat-queue con header "Authorization: Bearer my-secret-123"
    Then retorna 200 con resumen JSON

  # --- Event Types ---

  Scenario: F1-S17 — Evento INVOICE_SENT_TO_SUNAT emitido al enviar
    Given un item en invoice_queue
    When el worker intenta enviarlo a SUNAT (exito o fallo)
    Then se emite evento INVOICE_SENT_TO_SUNAT con payload:
      | campo         | valor                     |
      | invoice_id    | UUID de la factura        |
      | queue_item_id | UUID del item de cola     |
      | provider      | "sunat-direct"            |
      | attempt       | numero de intento actual  |
      | success       | true/false                |

  Scenario: F1-S18 — Evento INVOICE_SUNAT_ACCEPTED emitido al aceptar
    Given SUNAT acepta un comprobante con CDR codigo "0"
    Then se emite evento INVOICE_SUNAT_ACCEPTED con payload:
      | campo           | valor              |
      | invoice_id      | UUID de la factura |
      | response_code   | "0"                |
      | hash            | hash del CDR       |
      | cdr_received_at | timestamp ISO      |

  # --- Provider Config ---

  Scenario: F1-S19 — realSendInvoice delega a SunatDirectAdapter
    Given un tenant con sunat_provider = "SUNAT_DIRECT"
    When SunatClient.sendInvoice() se llama en modo produccion
    Then delega a SunatDirectAdapter.sendInvoice() con credenciales del tenant
    And NO retorna SUNAT_NOT_IMPLEMENTED

  Scenario: F1-S20 — realSendInvoice delega a NubefactAdapter como fallback
    Given un tenant con sunat_provider = "NUBEFACT"
    When SunatClient.sendInvoice() se llama
    Then delega a NubefactAdapter.sendInvoice() con token del tenant
```

### Fase 2 — Configuracion per-Tenant

```gherkin
Feature: F2 — Configuracion SUNAT por Tenant
  Como administrador de una polleria
  Necesito configurar mis credenciales SUNAT en FIRMO POS
  Para que mis comprobantes se envien automaticamente a SUNAT

  Background:
    Given soy admin del tenant "Polleria El Sabroson"
    And tengo rol ADMIN con permiso "manage_billing"

  # --- Schema / Migracion ---

  Scenario: F2-S01 — Migracion agrega columnas SUNAT a tenant_settings
    When se ejecuta la migracion de Prisma
    Then tenant_settings tiene columnas:
      | columna                       | tipo     | default    |
      | sunat_provider                | String?  | null       |
      | sunat_mode                    | String?  | "DISABLED" |
      | sunat_sol_user                | String?  | null       |
      | sunat_sol_password_enc        | String?  | null       |
      | sunat_certificate_pem_enc     | String?  | null       |
      | sunat_private_key_pem_enc     | String?  | null       |
      | sunat_certificate_expires_at  | DateTime?| null       |
      | nubefact_token_enc            | String?  | null       |
      | nubefact_url                  | String?  | null       |
    And tenants existentes no se ven afectados (columnas nullable)

  # --- Encriptacion ---

  Scenario: F2-S02 — Credenciales SOL encriptadas al guardar
    Given envio PUT /api/admin/facturacion/configuracion con sunat_sol_password = "miClave123"
    When el servidor procesa el request
    Then el campo sunat_sol_password_enc en la DB contiene un string base64 encriptado
    And el campo NO contiene "miClave123" en texto plano
    And la encriptacion usa AES-256-GCM con ENCRYPTION_MASTER_KEY

  Scenario: F2-S03 — Certificado PEM encriptado al guardar
    Given envio PUT con sunat_certificate_pem = "-----BEGIN CERTIFICATE-----\n..."
    When el servidor procesa el request
    Then sunat_certificate_pem_enc contiene el PEM encriptado
    And sunat_certificate_expires_at se extrae del certificado y se guarda en plaintext

  Scenario: F2-S04 — Credenciales decriptadas al leer para worker
    Given el queue worker necesita credenciales del tenant "Polleria El Sabroson"
    When getTenantSunatConfig(tenantId) se ejecuta
    Then decripta sunat_sol_password_enc, sunat_certificate_pem_enc, sunat_private_key_pem_enc
    And retorna TenantSunatCredentials con valores en plaintext

  # --- API GET ---

  Scenario: F2-S05 — GET retorna configuracion sin credenciales sensibles
    Given el tenant tiene sunat_provider = "SUNAT_DIRECT" y credenciales configuradas
    When hago GET /api/admin/facturacion/configuracion
    Then retorna 200 con:
      | campo                          | valor            |
      | sunat_provider                 | "SUNAT_DIRECT"   |
      | sunat_mode                     | "BETA"           |
      | sunat_sol_user                 | "MODDATOS"       |
      | sunat_sol_password_configured  | true             |
      | sunat_certificate_configured   | true             |
      | sunat_certificate_expires_at   | "2027-06-15..."  |
      | sunat_private_key_configured   | true             |
    And la respuesta NO contiene sunat_sol_password, certificate_pem, private_key_pem

  Scenario: F2-S06 — GET retorna 401 sin autenticacion
    When hago GET /api/admin/facturacion/configuracion sin JWT
    Then retorna 401 Unauthorized

  Scenario: F2-S07 — GET retorna 403 sin permiso manage_billing
    Given soy WAITER (sin permiso manage_billing)
    When hago GET /api/admin/facturacion/configuracion
    Then retorna 403 Forbidden

  # --- API PUT ---

  Scenario: F2-S08 — PUT actualiza configuracion parcialmente
    Given sunat_provider actual es "NONE"
    When hago PUT con { "sunat_provider": "SUNAT_DIRECT", "sunat_mode": "BETA" }
    Then retorna 200 con success = true
    And tenant_settings actualizado con sunat_provider = "SUNAT_DIRECT", sunat_mode = "BETA"
    And los demas campos permanecen sin cambios

  Scenario: F2-S09 — PUT valida que SUNAT_DIRECT requiere credenciales
    Given el tenant NO tiene credenciales SOL configuradas
    When hago PUT con { "sunat_provider": "SUNAT_DIRECT", "sunat_mode": "PRODUCTION" }
    Then retorna 400 con error "Se requieren credenciales SOL para el proveedor SUNAT Directo"

  Scenario: F2-S10 — PUT valida formato PEM del certificado
    When hago PUT con sunat_certificate_pem = "esto no es un PEM"
    Then retorna 400 con error "Formato de certificado PEM invalido"

  Scenario: F2-S11 — PUT valida formato PEM de clave privada
    When hago PUT con sunat_private_key_pem = "esto no es una clave"
    Then retorna 400 con error "Formato de clave privada PEM invalido"

  Scenario: F2-S12 — PUT extrae fecha de expiracion del certificado
    Given hago PUT con un certificado PEM valido que expira 2027-06-15
    When el servidor procesa el request
    Then sunat_certificate_expires_at = "2027-06-15T00:00:00.000Z"

  Scenario: F2-S13 — PUT emite evento de auditoria
    When hago PUT con cambios en configuracion SUNAT
    Then se crea un evento de auditoria con:
      | campo      | valor                        |
      | type       | "TENANT_SUNAT_CONFIG_UPDATED"|
      | actor_id   | mi user ID                   |
      | payload    | campos cambiados (sin valores sensibles) |

  # --- Test Connection ---

  Scenario: F2-S14 — Test connection exitosa con SUNAT beta
    Given credenciales SOL y certificado validos configurados
    When hago POST /api/admin/facturacion/configuracion/test-connection
    Then se envia un comprobante de prueba al endpoint BETA de SUNAT
    And retorna { success: true, response_code: "0", message: "Conexion exitosa con SUNAT Beta" }

  Scenario: F2-S15 — Test connection falla por credenciales incorrectas
    Given sunat_sol_password incorrecto
    When hago POST /test-connection
    Then retorna { success: false, message: "Credenciales SOL invalidas" }

  Scenario: F2-S16 — Test connection siempre usa BETA, nunca PRODUCTION
    Given sunat_mode = "PRODUCTION" en mi configuracion
    When hago POST /test-connection
    Then se usa el endpoint BETA de SUNAT (no produccion)

  Scenario: F2-S17 — Test connection timeout despues de 15 segundos
    Given SUNAT beta no responde
    When hago POST /test-connection
    Then despues de 15s retorna { success: false, message: "Timeout al conectar con SUNAT Beta" }

  # --- UI Admin ---

  Scenario: F2-S18 — Admin UI muestra formulario de configuracion
    When navego a /admin/facturacion
    Then veo seccion "Configuracion SUNAT" con:
      | elemento                        |
      | Radio: SUNAT Directo            |
      | Radio: Nubefact                 |
      | Radio: Deshabilitado            |
      | Input: Usuario SOL              |
      | Input password: Clave SOL       |
      | File upload: Certificado PEM    |
      | File upload: Clave privada PEM  |
      | Radio: Produccion / Beta        |
      | Boton: Guardar configuracion    |
      | Boton: Probar conexion          |

  Scenario: F2-S19 — Admin UI muestra alerta de expiracion de certificado
    Given el certificado expira en 20 dias
    When navego a /admin/facturacion
    Then veo alerta amarilla: "El certificado digital expira en 20 dias"

  Scenario: F2-S20 — Admin UI muestra indicador de estado
    Given sunat_provider = "SUNAT_DIRECT" y todas las credenciales configuradas
    When navego a /admin/facturacion
    Then veo indicador verde "Configuracion completa"
```

### Fase 3 — Resumen Diario

```gherkin
Feature: F3 — Resumen Diario de Boletas
  Como sistema FIRMO POS
  Necesito enviar Resumenes Diarios de boletas a SUNAT
  Para cumplir con la regulacion (antes de 11:59 PM del dia siguiente)

  Background:
    Given un tenant activo "Polleria El Sabroson"
    And sunat_provider = "SUNAT_DIRECT"
    And sunat_mode = "PRODUCTION"

  Scenario: F3-S01 — Generar y enviar resumen diario exitosamente
    Given 50 boletas emitidas ayer con invoice_cdr.response_code = "0"
    And serie B001 (30 boletas, total S/ 3,500.00) y B002 (20 boletas, total S/ 2,200.00)
    When el cron /api/cron/sunat-daily-summary se ejecuta
    Then se genera Resumen Diario con:
      | campo           | valor                    |
      | summary_number  | RC-20260301-001          |
      | boletas_count   | 50                       |
      | boletas_total   | 570000 (centavos)        |
    And se envia via SunatDirectAdapter.sendDailySummary()
    And sunat_daily_summary se actualiza con ticket_number y status "SENT"
    And se emite evento DAILY_SUMMARY_SENT

  Scenario: F3-S02 — No generar resumen si no hay boletas
    Given 0 boletas emitidas ayer
    When el cron se ejecuta
    Then NO se genera resumen para este tenant
    And log info "No hay boletas para resumen diario"

  Scenario: F3-S03 — Excluir boletas no aceptadas del resumen
    Given 30 boletas aceptadas (CDR "0") y 5 boletas rechazadas (CDR "2017")
    When el cron se ejecuta
    Then el resumen incluye solo las 30 boletas aceptadas
    And las 5 rechazadas se excluyen

  Scenario: F3-S04 — Excluir boletas anuladas del resumen
    Given 25 boletas aceptadas y 3 boletas con status "VOIDED"
    When el cron se ejecuta
    Then el resumen incluye solo las 25 boletas no anuladas

  Scenario: F3-S05 — Excluir boletas sin CDR (aun en cola)
    Given 20 boletas aceptadas y 10 boletas sin invoice_cdr (pendientes en cola)
    When el cron se ejecuta
    Then el resumen incluye solo las 20 boletas con CDR aceptado
    And las 10 pendientes se incluiran en el resumen del dia en que sean aceptadas

  Scenario: F3-S06 — Multiples tenants procesados secuencialmente
    Given tenant A con 40 boletas y tenant B con 60 boletas
    And ambos tienen sunat_mode = "PRODUCTION"
    When el cron se ejecuta
    Then se genera 1 resumen para tenant A y 1 resumen para tenant B
    And el resultado muestra tenants_processed: 2, summaries_sent: 2

  Scenario: F3-S07 — Tenant con SUNAT deshabilitado se omite
    Given tenant C con sunat_mode = "DISABLED"
    When el cron se ejecuta
    Then NO se procesa tenant C
    And el resultado muestra summaries_skipped: 1

  Scenario: F3-S08 — Error de SUNAT al enviar resumen
    Given boletas validas para el resumen
    And SUNAT SOAP responde con error 500
    When el cron se ejecuta
    Then sunat_daily_summary.sunat_status = "FAILED"
    And se logguea error con detalle
    And el resumen puede reenviarse manualmente

  Scenario: F3-S09 — Correlativo de resumen es secuencial por tenant y fecha
    Given ya existe RC-20260301-001 para este tenant
    When se genera otro resumen para la misma fecha (reenvio)
    Then el nuevo resumen tiene numero RC-20260301-002

  Scenario: F3-S10 — Cron protegido por CRON_SECRET
    When se hace GET /api/cron/sunat-daily-summary sin CRON_SECRET
    Then retorna 401 Unauthorized

  # --- UI Admin ---

  Scenario: F3-S11 — Admin UI muestra tabla de resumenes diarios
    When navego a /admin/facturacion, seccion "Resumenes Diarios"
    Then veo tabla con columnas: Fecha, Boletas, Monto Total, Ticket SUNAT, Estado
    And los resumenes estan ordenados por fecha descendente

  Scenario: F3-S12 — Admin puede reenviar resumen fallido
    Given un resumen con status "FAILED" o "PENDING"
    When hago click en "Reenviar"
    Then se re-genera y re-envia el resumen para esa fecha
```

### Fase 4 — Contingencia Persistente

```gherkin
Feature: F4 — Contingencia Persistente en Base de Datos
  Como sistema FIRMO POS
  Necesito que el estado de contingencia persista entre reinicios
  Para no perder facturas pendientes de reconciliacion

  Background:
    Given un tenant "Polleria El Sabroson" con tenant_id = "t-001"

  # --- Persistencia ---

  Scenario: F4-S01 — Activar contingencia persiste en DB
    Given no hay contingencia activa para el tenant
    When ContingencyManager.activate("SUNAT_UNREACHABLE", "system") se ejecuta
    Then se crea registro en sunat_contingency:
      | campo          | valor               |
      | tenant_id      | "t-001"             |
      | active         | true                |
      | reason         | "SUNAT_UNREACHABLE" |
      | activated_at   | NOW()               |
      | activated_by   | null (sistema)      |
      | pending_count  | 0                   |

  Scenario: F4-S02 — Registrar factura contingencia persiste en DB
    Given contingencia activa con id = "c-001"
    When ContingencyManager.registerContingencyInvoice({ invoiceId: "inv-001", series: "B001", number: "100" })
    Then se crea registro en sunat_contingency_invoices:
      | campo          | valor            |
      | contingency_id | "c-001"          |
      | tenant_id      | "t-001"          |
      | invoice_id     | "inv-001"        |
      | series         | "B001"           |
      | number         | "100"            |
      | issued_at      | NOW()            |
      | reconcile_by   | NOW() + 7 dias   |
      | reconciled_at  | null             |
    And sunat_contingency.pending_count incrementa a 1

  Scenario: F4-S03 — Desactivar contingencia persiste en DB
    Given contingencia activa con id = "c-001"
    When ContingencyManager.deactivate() se ejecuta
    Then sunat_contingency registro actualizado:
      | campo          | valor  |
      | active         | false  |
      | deactivated_at | NOW()  |

  Scenario: F4-S04 — Reconciliar factura persiste en DB
    Given factura "inv-001" en sunat_contingency_invoices con reconciled_at = null
    When ContingencyManager.markReconciled("inv-001") se ejecuta
    Then sunat_contingency_invoices.reconciled_at = NOW()
    And sunat_contingency.pending_count decrementa en 1

  Scenario: F4-S05 — Estado sobrevive reinicio del servidor
    Given contingencia activa con 3 facturas pendientes
    When el servidor se reinicia (deploy, crash, scale)
    And una nueva request carga ContingencyManager para tenant "t-001"
    Then ContingencyManager.isActive() = true
    And ContingencyManager.getState().pendingCount = 3
    And ContingencyManager.getPendingInvoices() retorna 3 facturas

  Scenario: F4-S06 — No depende de estado in-memory
    Given ContingencyManager se instancia por primera vez para tenant "t-001"
    And hay contingencia activa en DB para ese tenant
    When ContingencyManager.getState() se llama
    Then retorna el estado de la DB (no un estado in-memory default)

  # --- Queries ---

  Scenario: F4-S07 — Obtener facturas urgentes (< 24h para deadline)
    Given factura "inv-001" con reconcile_by = NOW() + 12h (urgente)
    And factura "inv-002" con reconcile_by = NOW() + 48h (no urgente)
    When ContingencyManager.getUrgentReconciliations(24) se ejecuta
    Then retorna solo "inv-001"

  Scenario: F4-S08 — Obtener facturas vencidas (pasado deadline)
    Given factura "inv-003" con reconcile_by = NOW() - 2h (vencida)
    And factura "inv-004" con reconcile_by = NOW() + 24h (no vencida)
    When ContingencyManager.getOverdueInvoices() se ejecuta
    Then retorna solo "inv-003"

  # --- Admin UI ---

  Scenario: F4-S09 — Admin UI muestra estado contingencia INACTIVO
    Given no hay contingencia activa
    When navego a /admin/facturacion, seccion "Modo Contingencia"
    Then veo badge verde "INACTIVO"
    And veo boton "Activar contingencia manual"

  Scenario: F4-S10 — Admin UI muestra estado contingencia ACTIVO
    Given contingencia activa con reason "SUNAT_UNREACHABLE", 5 facturas pendientes
    When navego a /admin/facturacion, seccion "Modo Contingencia"
    Then veo badge rojo "ACTIVO"
    And veo "Razon: SUNAT no disponible"
    And veo "Facturas pendientes: 5"
    And veo tabla de facturas en contingencia

  Scenario: F4-S11 — Admin UI marca facturas vencidas en rojo
    Given factura "inv-005" con reconcile_by pasado (vencida)
    When navego a la seccion de contingencia
    Then la fila de "inv-005" esta marcada en ROJO con icono de alerta

  Scenario: F4-S12 — Admin UI marca facturas urgentes en amarillo
    Given factura "inv-006" con reconcile_by en 18 horas
    When navego a la seccion de contingencia
    Then la fila de "inv-006" esta marcada en AMARILLO

  Scenario: F4-S13 — Admin activa contingencia manual
    Given soy OWNER del tenant
    When hago click en "Activar contingencia manual"
    Then se activa contingencia con reason = "MANUAL_ACTIVATION"
    And activatedBy = mi user ID
    And badge cambia a ACTIVO rojo

  Scenario: F4-S14 — Admin desactiva contingencia
    Given contingencia activa, 0 facturas vencidas pendientes
    And soy OWNER del tenant
    When hago click en "Desactivar contingencia"
    Then contingencia se desactiva
    And badge cambia a INACTIVO verde

  Scenario: F4-S15 — No se puede desactivar con facturas vencidas
    Given contingencia activa, 2 facturas vencidas (reconcile_by pasado)
    When intento desactivar contingencia
    Then error: "No se puede desactivar con 2 facturas vencidas sin reconciliar"

  # --- Health Check ---

  Scenario: F4-S16 — Health check auto-desactiva cuando SUNAT vuelve
    Given contingencia activa por SUNAT_UNREACHABLE
    And health check detecta que SUNAT responde exitosamente
    When se ejecuta el health check
    Then contingencia se desactiva automaticamente
    And se logguea "SUNAT es alcanzable, desactivando contingencia"
```

---

## 7. Criterios de Aceptacion

### 7.1 Fase 1 — Queue Worker + nodefact

| ID | Criterio | Verificacion |
|----|----------|-------------|
| AC-F1-01 | `nodefact` instalado y funcional | `npm ls nodefact` muestra version |
| AC-F1-02 | `SunatDirectAdapter` genera XML UBL 2.1 firmado | Test unitario con certificado de prueba |
| AC-F1-03 | Queue worker procesa items PENDING | Test integracion con mock SUNAT |
| AC-F1-04 | Retry con backoff: 5, 10, 15 min | Test unitario verifica scheduled_at |
| AC-F1-05 | Item FAILED al agotar intentos | Test unitario: attempts = max_attempts |
| AC-F1-06 | Eventos emitidos correctamente | Test verifica creacion en `events` table |
| AC-F1-07 | Cron protegido por CRON_SECRET | Test 401 sin secret, 200 con secret |
| AC-F1-08 | 0 regresiones | `npm test` pasa con 0 fallas |
| AC-F1-09 | `tsc --noEmit` sin errores | CI check |
| AC-F1-10 | Fallback a NubefactAdapter funciona | Test con tenant sunat_provider=NUBEFACT |

### 7.2 Fase 2 — Config per-Tenant

| ID | Criterio | Verificacion |
|----|----------|-------------|
| AC-F2-01 | Migracion zero-downtime | Columnas nullable/default, no breaking |
| AC-F2-02 | Credenciales encriptadas at-rest | DB dump no muestra plaintext |
| AC-F2-03 | GET no retorna credenciales sensibles | Response no contiene password/pem |
| AC-F2-04 | PUT valida formato PEM | Test con PEM invalido retorna 400 |
| AC-F2-05 | PUT encripta antes de guardar | DB row tiene `_enc` base64, no plaintext |
| AC-F2-06 | Test connection usa BETA siempre | Test verifica endpoint URL |
| AC-F2-07 | Evento de auditoria emitido | Test verifica evento en DB |
| AC-F2-08 | 401 sin JWT, 403 sin permiso | Tests de auth |
| AC-F2-09 | UI muestra alerta expiracion cert | E2E test o manual |

### 7.3 Fase 3 — Resumen Diario

| ID | Criterio | Verificacion |
|----|----------|-------------|
| AC-F3-01 | Resumen incluye solo boletas ACCEPTED | Test con mix de statuses |
| AC-F3-02 | Resumen excluye VOIDED y sin CDR | Test unitario |
| AC-F3-03 | Dia sin boletas: no genera resumen | Test verifica skip |
| AC-F3-04 | sunat_daily_summary actualizado | Test verifica row en DB |
| AC-F3-05 | Evento DAILY_SUMMARY_SENT emitido | Test verifica evento |
| AC-F3-06 | Cron a las 11:00 UTC (6AM Lima) | vercel.json schedule |
| AC-F3-07 | UI tabla de resumenes | E2E o manual |

### 7.4 Fase 4 — Contingencia Persistente

| ID | Criterio | Verificacion |
|----|----------|-------------|
| AC-F4-01 | Estado persiste en DB, no en memoria | Test: nueva instancia lee DB |
| AC-F4-02 | pendingInvoices[] eliminado | Grep source code |
| AC-F4-03 | Facturas urgentes query correcta | Test con dates variadas |
| AC-F4-04 | Facturas vencidas query correcta | Test con dates pasadas |
| AC-F4-05 | UI badge ACTIVO/INACTIVO | E2E o manual |
| AC-F4-06 | No desactivar con vencidas | Test verifica error |
| AC-F4-07 | Health check auto-desactiva | Test con mock health |
| AC-F4-08 | Tests actualizados con Prisma mock | Tests existentes no usan in-memory |

---

## 8. Matriz de Trazabilidad

| Requisito | Escenarios Gherkin | Criterio Aceptacion |
|-----------|-------------------|---------------------|
| F1-REQ-01 | F1-S01 a F1-S05 | AC-F1-02 |
| F1-REQ-02 | F1-S06 a F1-S14 | AC-F1-03 a AC-F1-06 |
| F1-REQ-03 | F1-S15, F1-S16 | AC-F1-07 |
| F1-REQ-04 | F1-S19, F1-S20 | AC-F1-10 |
| F1-REQ-05 | F1-S19 | AC-F1-10 |
| F1-REQ-06 | F1-S17, F1-S18 | AC-F1-06 |
| F1-REQ-07 | F1-S15, F1-S16 | AC-F1-07 |
| F2-REQ-01 | F2-S01 | AC-F2-01 |
| F2-REQ-02 | F2-S02 a F2-S04 | AC-F2-02, AC-F2-05 |
| F2-REQ-03 | F2-S05 a F2-S17 | AC-F2-03 a AC-F2-08 |
| F2-REQ-04 | F2-S18 a F2-S20 | AC-F2-09 |
| F2-REQ-05 | F1-S09, F1-S10 | AC-F1-03 |
| F3-REQ-01 | F3-S01 a F3-S09 | AC-F3-01 a AC-F3-05 |
| F3-REQ-02 | F3-S10 | AC-F3-06 |
| F3-REQ-03 | — | AC-F3-06 |
| F3-REQ-04 | F3-S11, F3-S12 | AC-F3-07 |
| F3-REQ-05 | F3-S03 a F3-S05 | AC-F3-01, AC-F3-02 |
| F4-REQ-01 | F4-S01 a F4-S04 | AC-F4-01 |
| F4-REQ-02 | F4-S05 a F4-S08 | AC-F4-01 a AC-F4-04, AC-F4-07, AC-F4-08 |
| F4-REQ-03 | F4-S09 a F4-S15 | AC-F4-05, AC-F4-06 |
| F4-REQ-04 | F4-S05, F4-S06 | AC-F4-01 |

---

## Apendice A: Resumen de Archivos Afectados

| Archivo | Accion | Fase | Requisito |
|---------|--------|------|-----------|
| `package.json` | Modificar (add nodefact) | F1 | F1-REQ-01 |
| `src/core/integrations/sunat/sunat-direct-adapter.ts` | CREAR | F1 | F1-REQ-01 |
| `src/core/jobs/sunat-queue-worker.ts` | CREAR | F1 | F1-REQ-02 |
| `src/app/api/cron/sunat-queue/route.ts` | CREAR | F1 | F1-REQ-03 |
| `src/core/integrations/sunat/client.ts` | Modificar | F1 | F1-REQ-04 |
| `src/core/integrations/sunat/provider-config.ts` | Modificar | F1 | F1-REQ-05 |
| `src/core/domain/events.ts` | Modificar (4 event types) | F1 | F1-REQ-06 |
| `vercel.json` | Modificar (add crons) | F1, F3 | F1-REQ-07, F3-REQ-03 |
| `src/core/security/server-encryption.ts` | CREAR | F2 | F2-REQ-02 |
| `prisma/schema.prisma` | Modificar | F2, F4 | F2-REQ-01, F4-REQ-01 |
| `src/app/api/admin/facturacion/configuracion/route.ts` | CREAR | F2 | F2-REQ-03 |
| `src/app/api/admin/facturacion/configuracion/test-connection/route.ts` | CREAR | F2 | F2-REQ-03 |
| `src/app/admin/facturacion/page.tsx` | Modificar | F2, F3, F4 | F2-REQ-04, F3-REQ-04, F4-REQ-03 |
| `src/core/jobs/sunat-daily-summary.ts` | CREAR | F3 | F3-REQ-01 |
| `src/app/api/cron/sunat-daily-summary/route.ts` | CREAR | F3 | F3-REQ-02 |
| `src/core/integrations/sunat/contingency.ts` | Modificar (refactor) | F4 | F4-REQ-02 |
| `src/core/services/invoice.service.ts` | Modificar | F1, F4 | F1-REQ-04, F4-REQ-02 |

**Totales**: 8 archivos nuevos, 9 archivos modificados, 17 total.

## Apendice B: Nuevos Event Types (Zod Schemas)

```typescript
// INVOICE_SENT_TO_SUNAT
const InvoiceSentToSunatPayload = z.object({
  invoice_id: uuidSchema,
  queue_item_id: uuidSchema,
  provider: z.enum(['sunat-direct', 'nubefact']),
  attempt: z.number().int().positive(),
  success: z.boolean(),
});

// INVOICE_SUNAT_ACCEPTED
const InvoiceSunatAcceptedPayload = z.object({
  invoice_id: uuidSchema,
  response_code: z.string(),
  hash: z.string(),
  cdr_received_at: isoDateSchema,
});

// INVOICE_SUNAT_REJECTED
const InvoiceSunatRejectedPayload = z.object({
  invoice_id: uuidSchema,
  response_code: z.string(),
  error_message: z.string(),
  attempts: z.number().int(),
});

// DAILY_SUMMARY_SENT
const DailySummarySentPayload = z.object({
  summary_id: uuidSchema,
  tenant_id: uuidSchema,
  summary_date: z.string(), // YYYY-MM-DD
  boletas_count: z.number().int().nonnegative(),
  ticket_number: z.string().optional(),
});
```

## Apendice C: Decisiones de Diseño Clave

| Decision | Alternativa rechazada | Razon |
|----------|----------------------|-------|
| Server-side encryption con Node.js `crypto` | Reusar `encryption.ts` (Web Crypto) | `encryption.ts` usa Web Crypto API (client-side); server necesita Node.js `crypto` para sync operations en Prisma context |
| Sufijo `_enc` en columnas encriptadas | Columna separada `sunat_credentials JSON` | Columnas individuales son mas faciles de auditar y migrar |
| ContingencyManager scoped per-tenant | Singleton global | Multi-tenant: cada tenant tiene su propia contingencia |
| Backoff lineal (5*N min) | Exponencial (2^N min) | Para facturacion, 5-10-15 min es mejor UX que 5-10-20 min; 15 min max es aceptable |
| Cron 2min poll | WebSocket/long-polling | Vercel Serverless no soporta WebSocket persistent; cron es el patron establecido |
| BATCH_SIZE = 10 | Process all pending | Safety: Vercel 60s timeout, SUNAT ~5s/call, 10*5s = 50s margin |
