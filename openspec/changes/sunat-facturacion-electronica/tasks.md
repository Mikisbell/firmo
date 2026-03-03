# Tasks: SUNAT Facturacion Electronica — Integracion Directa via nodefact

> **Change**: sunat-facturacion-electronica
> **Artifact**: tasks (SDD v2.5.0)
> **Depends on**: proposal.md, specs.md, design.md
> **Date**: 2026-03-02

---

## Summary

| Phase | Tasks | Focus | Estimated Effort |
|-------|-------|-------|------------------|
| Phase 1 | 22 | Queue Worker + SunatDirectAdapter + Events | 3-4 dias |
| Phase 2 | 18 | Config SUNAT per-Tenant + Encryption + Admin UI | 2-3 dias |
| Phase 3 | 14 | Resumen Diario de Boletas | 2-3 dias |
| Phase 4 | 14 | Contingencia Persistente en DB | 1-2 dias |
| Phase 5 | 8 | Verificacion Cross-Phase + Cleanup | 1 dia |
| **Total** | **76** | | **9-13 dias** |

### Implementation Order

Phases 1 and 4 can start in parallel (Phase 4 has no dependencies on Phase 1). Phase 2 depends on Phase 1 (worker must exist for config to have effect). Phase 3 depends on Phase 1 (adapter must be wired). Phase 5 runs after all others.

```
Phase 1 ─────────────► Phase 2 ──────────┐
    │                                     │
    └──────────────────► Phase 3 ─────────┤
                                          ├──► Phase 5
Phase 4 (parallel) ──────────────────────┘
```

---

## Phase 1: Queue Worker + SunatDirectAdapter + Events (F1)

### 1.1 Foundation — Dependencies & Types

- [ ] **1.1.1** Install `nodefact` npm dependency
  - **File**: `package.json`
  - **Action**: `npm install nodefact`
  - **Verify**: `npm ls nodefact` shows installed version; `tsc --noEmit` passes
  - **Effort**: 5 min
  - **Scenarios**: F1-S01 pre-req

- [ ] **1.1.2** Add 4 new event types to domain events
  - **File**: `src/core/domain/events.ts`
  - **Action**: Add `INVOICE_SENT_TO_SUNAT`, `INVOICE_SUNAT_ACCEPTED`, `INVOICE_SUNAT_REJECTED`, `DAILY_SUMMARY_SENT` to the discriminated union. Each with Zod schema, payload type, and type export.
  - **Payloads** (from specs Appendix B):
    - `InvoiceSentToSunatPayload`: `{ invoice_id, queue_item_id, provider, attempt, success }`
    - `InvoiceSunatAcceptedPayload`: `{ invoice_id, response_code, hash, cdr_received_at }`
    - `InvoiceSunatRejectedPayload`: `{ invoice_id, response_code, error_message, attempts }`
    - `DailySummarySentPayload`: `{ summary_id, tenant_id, summary_date, boletas_count, ticket_number? }`
  - **Verify**: `tsc --noEmit` passes; total event types = 77
  - **Effort**: 30 min
  - **Scenarios**: F1-S17, F1-S18; specs F1-REQ-06

- [ ] **1.1.3** Update provider-config types
  - **File**: `src/core/integrations/sunat/provider-config.ts`
  - **Action**: Ensure `SunatProvider = 'mock' | 'nubefact' | 'sunat-direct'` (already exists per specs). Add `TenantSunatCredentials` interface: `{ provider, mode, solUser?, solPassword?, certificatePem?, privateKeyPem?, nubefactToken?, nubefactUrl?, ruc }`. Add `getTenantSunatConfig(tenantId: string)` function stub that reads from `tenant_settings` via Prisma.
  - **Verify**: `tsc --noEmit` passes
  - **Effort**: 20 min
  - **Scenarios**: F1-S19; specs F1-REQ-05

- [ ] **1.1.4** Add `signed_xml`, `pdf_base64`, `qr_string` columns to `invoice_cdr` in Prisma schema
  - **File**: `prisma/schema.prisma`
  - **Action**: Add 3 optional `String?` fields to `invoice_cdr` model. Run `prisma db execute` with `ALTER TABLE invoice_cdr ADD COLUMN IF NOT EXISTS signed_xml TEXT, ADD COLUMN IF NOT EXISTS pdf_base64 TEXT, ADD COLUMN IF NOT EXISTS qr_string TEXT;`
  - **Verify**: `npx prisma generate` succeeds; `npx prisma validate` passes
  - **Effort**: 15 min
  - **Dep**: None
  - **Scenarios**: design 3.3

- [ ] **1.1.5** Add `cdr_xml`, `last_error`, `attempts` columns to `sunat_daily_summary` in Prisma schema
  - **File**: `prisma/schema.prisma`
  - **Action**: Add 3 fields to `sunat_daily_summary` model: `cdr_xml String?`, `last_error String?`, `attempts Int @default(0)`. Run `prisma db execute` with corresponding `ALTER TABLE`.
  - **Verify**: `npx prisma generate` succeeds
  - **Effort**: 10 min
  - **Dep**: None
  - **Scenarios**: design 3.4

### 1.2 Core — SunatDirectAdapter

- [ ] **1.2.1** Create `SunatDirectAdapter` implementation
  - **File**: `src/core/integrations/sunat/sunat-direct-adapter.ts` (NEW)
  - **Action**: Implement the `SunatDirectAdapter` interface from design 2.1. Export interfaces: `SunatDirectConfig`, `SunatDocumentResult`, `SunatDirectAdapter`. Methods: `sendInvoice()`, `sendCreditNote()`, `sendVoidCommunication()`, `sendDailySummary()`, `queryTicketStatus()`, `testConnection()`. Internally:
    1. Map `InvoiceData` to nodefact format (tipo `'01'` for factura, `'03'` for boleta)
    2. Call nodefact to generate XML, sign, send SOAP
    3. Parse CDR response
    4. Generate PDF and QR via nodefact
    5. Map nodefact errors to `DomainError` codes (see design error mapping table)
    6. Log with `pinoLogger` including `trace_id`
  - **SUNAT Endpoints**: Beta and Production URLs from design table 2.1
  - **Verify**: `tsc --noEmit` passes; adapter can be instantiated
  - **Effort**: 3-4 hours
  - **Dep**: 1.1.1 (nodefact installed), 1.1.3 (types)
  - **Scenarios**: F1-S01 to F1-S05

- [ ] **1.2.2** Write unit tests for `SunatDirectAdapter`
  - **File**: `src/core/integrations/sunat/__tests__/sunat-direct-adapter.test.ts` (NEW)
  - **Action**: Test with mocked nodefact:
    - Happy path: boleta, factura, nota de credito emit successfully (F1-S01, F1-S05)
    - SUNAT rejection: CDR code != "0" maps to `SUNAT_REJECTED` (F1-S02)
    - SUNAT timeout: maps to `SUNAT_TIMEOUT` (F1-S03)
    - Certificate error: expired cert maps to `SUNAT_CERT_EXPIRED` (F1-S04)
    - SOAP HTTP 500: maps to `SUNAT_SERVER_ERROR` (retryable)
    - SOAP HTTP 403: maps to `SUNAT_AUTH_FAILED` (non-retryable)
    - Data mapping: `InvoiceData` → nodefact format correctness
    - PDF/QR generation included in result
  - **Verify**: All tests green; `npm test -- sunat-direct-adapter`
  - **Effort**: 2-3 hours
  - **Dep**: 1.2.1
  - **Scenarios**: F1-S01 to F1-S05; AC-F1-02

### 1.3 Core — InvoiceProviderRouter

- [ ] **1.3.1** Create `InvoiceProviderRouter` service
  - **File**: `src/core/integrations/sunat/provider-router.ts` (NEW)
  - **Action**: Implement `InvoiceProviderRouter` from design 2.2. Implements `InvoiceProvider` interface. Methods: `getProvider(tenantId)`, `isEnabled(tenantId)`. Resolution flow:
    1. Load `tenant_settings` from Prisma
    2. Check `sunat_mode` (DISABLED -> err, BETA/PRODUCTION -> proceed)
    3. Check `sunat_provider` (SUNAT_DIRECT -> decrypt creds + new SunatDirectAdapter, NUBEFACT -> decrypt token + NubefactAdapterWrapper, NONE -> err)
    4. Cache adapter per-tenant per-request
  - **Verify**: `tsc --noEmit` passes
  - **Effort**: 1-2 hours
  - **Dep**: 1.2.1 (adapter), 1.1.3 (types)
  - **Scenarios**: F1-S11, F1-S19, F1-S20

- [ ] **1.3.2** Create `NubefactAdapterWrapper`
  - **File**: `src/core/integrations/sunat/nubefact-adapter-wrapper.ts` (NEW)
  - **Action**: Thin wrapper around existing `NubefactAdapter` (233 lines) that implements `InvoiceProvider` interface. Translates between `SunatDocumentResult` and `NubefactResponse`. Methods: `sendInvoice()`, `sendCreditNote()`, `sendVoidCommunication()`, `sendDailySummary()` (stub for daily summary as Nubefact handles it differently), `testConnection()`.
  - **Verify**: `tsc --noEmit` passes; existing `NubefactAdapter` tests still green
  - **Effort**: 1 hour
  - **Dep**: 1.3.1
  - **Scenarios**: F1-S11, F1-S20

- [ ] **1.3.3** Write unit tests for `InvoiceProviderRouter`
  - **File**: `src/core/integrations/sunat/__tests__/provider-router.test.ts` (NEW)
  - **Action**: Test with mocked Prisma:
    - SUNAT_DIRECT resolution returns SunatDirectAdapter (F1-S19)
    - NUBEFACT resolution returns NubefactAdapterWrapper (F1-S20)
    - NONE/DISABLED returns error
    - Missing credentials returns error
    - Tenant not found returns error
    - Caching: same tenant -> same adapter instance
  - **Verify**: All tests green
  - **Effort**: 1 hour
  - **Dep**: 1.3.1, 1.3.2

### 1.4 Core — Queue Worker

- [ ] **1.4.1** Create `SunatQueueWorker` service
  - **File**: `src/core/jobs/sunat-queue-worker.ts` (NEW)
  - **Action**: Implement `SunatQueueWorker` from design 2.4. Constructor: `(prisma, providerRouter)`. Method: `processBatch(batchSize = 10)`. Flow:
    1. `SELECT ... FROM invoice_queue WHERE status='PENDING' AND scheduled_at <= NOW() ORDER BY priority ASC, scheduled_at ASC LIMIT {batchSize} FOR UPDATE SKIP LOCKED`
    2. Group items by `tenant_id`
    3. For each tenant: check sunat_mode, get provider
    4. For each item: dispatch by action (`EMIT_TO_SUNAT`, `VOID_IN_SUNAT`, `EMIT_CREDIT_NOTE`)
    5. On success: update status='PROCESSED', upsert invoice_cdr, emit INVOICE_SUNAT_ACCEPTED
    6. On retryable failure: increment attempts, set scheduled_at with backoff (attempts * 5 min)
    7. On non-retryable failure or max attempts: status='FAILED', emit INVOICE_SUNAT_REJECTED
    8. Mark PROCESSING before dispatch to prevent re-pickup
    9. Respect MAX_WORKER_DURATION_MS = 50_000 safety timeout
    10. Track consecutive failures per tenant for contingency auto-activation (threshold = 5)
    11. Also poll pending daily summary tickets (design 5.3)
  - **Constants**: `BATCH_SIZE = 10`, `MAX_WORKER_DURATION_MS = 50_000`, `RETRY_BASE_MINUTES = 5`, `AUTO_CONTINGENCY_THRESHOLD = 5`
  - **Return**: `QueueWorkerResult { processed, succeeded, failed, skipped, details[] }`
  - **Verify**: `tsc --noEmit` passes
  - **Effort**: 3-4 hours
  - **Dep**: 1.3.1 (provider router), 1.1.2 (events)
  - **Scenarios**: F1-S06 to F1-S14

- [ ] **1.4.2** Write unit tests for `SunatQueueWorker`
  - **File**: `src/core/jobs/__tests__/sunat-queue-worker.test.ts` (NEW)
  - **Action**: Test with mocked Prisma + mocked InvoiceProviderRouter:
    - Happy path: 5 items processed successfully (F1-S06)
    - Retry with backoff: attempts=0 -> scheduled_at + 5min (F1-S07)
    - Max attempts reached -> FAILED (F1-S08)
    - Tenant DISABLED -> SKIP (F1-S09)
    - Tenant without credentials -> SKIP with warning (F1-S10)
    - Nubefact tenant -> uses NubefactAdapter (F1-S11)
    - Batch size respected: 25 items -> processes only 10 (F1-S12)
    - Worker duration timeout (F1-S13)
    - Idempotency: already PROCESSED items not re-picked (F1-S14)
    - Non-retryable error -> immediate FAILED
    - Consecutive failures trigger contingency (5 failures)
    - Success resets failure counter
    - Event emissions verified
  - **Property test**: backoff is monotonically increasing (`fc.integer({min:1, max:10})`)
  - **Property test**: queue items processed in priority order
  - **Verify**: All tests green; `npm test -- sunat-queue-worker`
  - **Effort**: 3-4 hours
  - **Dep**: 1.4.1

### 1.5 Integration — Cron Endpoint & Client Refactor

- [ ] **1.5.1** Create cron endpoint `/api/cron/sunat-queue`
  - **File**: `src/app/api/cron/sunat-queue/route.ts` (NEW)
  - **Action**: `GET` handler. Verify `CRON_SECRET` in `authorization` header (same pattern as `src/app/api/cron/maintenance/route.ts`). Instantiate `SunatQueueWorker(prisma, providerRouter)`. Call `processBatch(10)`. Return 200 with JSON result. Add OpenTelemetry span `sunat.queue.process_batch`.
  - **Verify**: Endpoint returns 200 with valid JSON; 401 without CRON_SECRET
  - **Effort**: 30 min
  - **Dep**: 1.4.1
  - **Scenarios**: F1-S15, F1-S16; AC-F1-07

- [ ] **1.5.2** Update `vercel.json` with sunat-queue cron
  - **File**: `vercel.json`
  - **Action**: Add cron entry: `{ "path": "/api/cron/sunat-queue", "schedule": "*/2 * * * *" }`
  - **Verify**: `vercel.json` is valid JSON with all 2 cron entries (maintenance + sunat-queue)
  - **Effort**: 5 min
  - **Dep**: 1.5.1
  - **Scenarios**: F1-REQ-07

- [ ] **1.5.3** Refactor `SunatClient.realSendInvoice()` to use ProviderRouter
  - **File**: `src/core/integrations/sunat/client.ts`
  - **Action**: Replace `SUNAT_NOT_IMPLEMENTED` return with delegation to `InvoiceProviderRouter.getProvider(tenantId)`. The method now:
    1. Receives `tenantId` as parameter
    2. Calls `providerRouter.getProvider(tenantId)` to get correct adapter
    3. Delegates to adapter's `sendInvoice()`
    4. Maintains mock mode in development (check `NODE_ENV` or `sunat_mode`)
  - **Verify**: `tsc --noEmit` passes; existing mock tests still green
  - **Effort**: 1 hour
  - **Dep**: 1.3.1
  - **Scenarios**: F1-S19, F1-S20; AC-F1-10

- [ ] **1.5.4** Write integration test for cron endpoint
  - **File**: `src/app/api/cron/__tests__/sunat-queue.test.ts` (NEW)
  - **Action**: Test:
    - 401 without CRON_SECRET (F1-S15)
    - 200 with valid CRON_SECRET (F1-S16)
    - Response includes `{ processed, failed, skipped }` shape
  - **Verify**: Tests green
  - **Effort**: 30 min
  - **Dep**: 1.5.1

### 1.6 Verification — Phase 1 Complete

- [ ] **1.6.1** Run full test suite to verify 0 regressions
  - **Action**: `npm test` — all 4897+ existing tests must pass plus new tests
  - **Verify**: 0 failures; `tsc --noEmit` 0 errors; `npm run build` succeeds
  - **Effort**: 15 min
  - **Dep**: All Phase 1 tasks
  - **Scenarios**: AC-F1-08, AC-F1-09

---

## Phase 2: Configuracion SUNAT per-Tenant (F2)

### 2.1 Foundation — Schema & Encryption

- [ ] **2.1.1** Add SUNAT config columns to `tenant_settings` in Prisma schema
  - **File**: `prisma/schema.prisma`
  - **Action**: Add to `tenant_settings` model:
    - `sunat_provider String? @default("NONE")` — SUNAT_DIRECT | NUBEFACT | NONE
    - `sunat_mode String? @default("DISABLED")` — PRODUCTION | BETA | DISABLED
    - `sunat_sol_user String?`
    - `sunat_sol_password String?` — encrypted AES-256-GCM
    - `sunat_certificate_pem String?` — encrypted AES-256-GCM
    - `sunat_private_key_pem String?` — encrypted AES-256-GCM
    - `sunat_cert_expires_at DateTime? @db.Timestamptz(6)`
    - `nubefact_token String?` — encrypted AES-256-GCM
    - `nubefact_url String?`
  - **Migration**: `prisma db execute` with `ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS ...` for each column (zero-downtime, all nullable/defaults)
  - **Verify**: `npx prisma generate` + `npx prisma validate` passes
  - **Effort**: 30 min
  - **Scenarios**: F2-S01; AC-F2-01

- [ ] **2.1.2** Create credential encryption module
  - **File**: `src/core/integrations/sunat/credential-encryption.ts` (NEW)
  - **Action**: Implement from design 2.3:
    - `encryptCredential(plaintext: string): string` — AES-256-GCM, Node.js `crypto` module
    - `decryptCredential(encrypted: string): string`
    - `isEncrypted(value: string): boolean`
    - `validateCertificatePem(pem: string): Result<{ expiresAt, subject, issuer }, DomainError>`
    - `validatePrivateKeyPem(pem: string): Result<void, DomainError>`
  - **Encryption details**: Master key from `SUNAT_ENCRYPTION_KEY` env var (64 hex chars = 32 bytes). IV: 12 bytes random. Output: `base64(iv || ciphertext || authTag)`. Auth tag: 16 bytes.
  - **Certificate validation**: Use `crypto.X509Certificate` (Node 16+). Extract `notAfter` date. Validate PEM header `-----BEGIN CERTIFICATE-----`.
  - **Key validation**: Check PEM header `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN PRIVATE KEY-----`.
  - **NEVER** log plaintext credentials.
  - **Verify**: `tsc --noEmit` passes
  - **Effort**: 1-2 hours
  - **Dep**: None
  - **Scenarios**: F2-S02, F2-S03, F2-S10, F2-S11; specs F2-REQ-02

- [ ] **2.1.3** Write unit tests for credential encryption
  - **File**: `src/core/integrations/sunat/__tests__/credential-encryption.test.ts` (NEW)
  - **Action**: Tests:
    - Encrypt/decrypt roundtrip: plaintext in = plaintext out (F2-S02, F2-S04)
    - Different encryptions of same plaintext produce different ciphertexts (IV randomness)
    - Decryption with wrong key fails
    - Invalid base64 input fails gracefully
    - `validateCertificatePem()`: valid PEM accepted, invalid rejected (F2-S10)
    - `validateCertificatePem()`: expired cert detected, expiration date extracted (F2-S12)
    - `validatePrivateKeyPem()`: valid RSA key accepted, invalid rejected (F2-S11)
    - `isEncrypted()`: recognizes encrypted vs plaintext strings
  - **Property test**: `fc.string()` -> `decrypt(encrypt(s)) === s` for all strings
  - **Verify**: All tests green
  - **Effort**: 1-2 hours
  - **Dep**: 2.1.2

- [ ] **2.1.4** Wire `getTenantSunatConfig()` to use credential decryption
  - **File**: `src/core/integrations/sunat/provider-config.ts`
  - **Action**: Implement the `getTenantSunatConfig(tenantId)` stub from task 1.1.3 to: (1) query `tenant_settings` from Prisma, (2) decrypt `sunat_sol_password`, `sunat_certificate_pem`, `sunat_private_key_pem`, `nubefact_token` using `decryptCredential()`, (3) return `TenantSunatCredentials` with decrypted values.
  - **Verify**: `tsc --noEmit` passes
  - **Effort**: 30 min
  - **Dep**: 2.1.2 (encryption module), 1.1.3 (types)

- [ ] **2.1.5** Add `SUNAT_ENCRYPTION_KEY` to `.env.example`
  - **File**: `.env.example`
  - **Action**: Add `SUNAT_ENCRYPTION_KEY=` with comment: `# 64 hex chars (256 bits). Generate with: openssl rand -hex 32`
  - **Effort**: 2 min
  - **Dep**: None

### 2.2 Core — API Endpoints

- [ ] **2.2.1** Create `GET /api/admin/facturacion/configuracion` endpoint
  - **File**: `src/app/api/admin/facturacion/configuracion/route.ts` (NEW)
  - **Action**: Auth: `requireAdminAuth` + `requireAdminPermission('manage_billing')`. Load `tenant_settings` for `authResult.user.tenantId`. Return JSON with:
    - `sunat_provider`, `sunat_mode`, `sunat_sol_user`
    - `has_sol_password: boolean`, `has_certificate: boolean`, `has_private_key: boolean` (NEVER return the actual values)
    - `sunat_cert_expires_at`, `cert_expires_in_days`
    - `nubefact_url`, `has_nubefact_token: boolean`
    - `ruc` (from tenant data)
  - **Verify**: Returns 200 with expected shape; 401 without JWT; 403 without permission
  - **Effort**: 1 hour
  - **Dep**: 2.1.1 (schema)
  - **Scenarios**: F2-S05, F2-S06, F2-S07; AC-F2-03

- [ ] **2.2.2** Create `PUT /api/admin/facturacion/configuracion` endpoint
  - **File**: `src/app/api/admin/facturacion/configuracion/route.ts` (same file as GET)
  - **Action**: Auth: same as GET. Zod validation for request body (all fields optional):
    - `sunat_provider: z.enum(['SUNAT_DIRECT', 'NUBEFACT', 'NONE'])`
    - `sunat_mode: z.enum(['PRODUCTION', 'BETA', 'DISABLED'])`
    - `sunat_sol_user, sunat_sol_password, sunat_certificate_pem, sunat_private_key_pem, nubefact_token, nubefact_url`
  - **Validations**:
    - If `sunat_provider = 'SUNAT_DIRECT'` + `sunat_mode = 'PRODUCTION'`: require SOL creds + cert + key (F2-S09)
    - PEM validation on `sunat_certificate_pem` and `sunat_private_key_pem` (F2-S10, F2-S11)
    - Extract `cert_expires_at` from certificate (F2-S12)
    - Max PEM file size: 10KB
  - **Encrypt** sensitive fields before DB write. Emit audit event (F2-S13).
  - **Return**: Updated config (same as GET response).
  - **Verify**: `tsc --noEmit` passes
  - **Effort**: 2 hours
  - **Dep**: 2.1.2 (encryption), 2.2.1
  - **Scenarios**: F2-S08 to F2-S13; AC-F2-04, AC-F2-05

- [ ] **2.2.3** Create `POST /api/admin/facturacion/test-connection` endpoint
  - **File**: `src/app/api/admin/facturacion/test-connection/route.ts` (NEW)
  - **Action**: Auth: `requireAdminPermission('OWNER', 'ADMIN')`. Load tenant config. Resolve provider via `InvoiceProviderRouter`. Call `provider.testConnection()` with BETA mode always (even if tenant is configured for PRODUCTION). Timeout: 15 seconds. Return `{ success, message, duration_ms, response_code? }`.
  - **Verify**: Returns test result; uses BETA endpoint always
  - **Effort**: 1 hour
  - **Dep**: 1.3.1 (provider router), 2.1.4 (decrypt creds)
  - **Scenarios**: F2-S14 to F2-S17; AC-F2-06

- [ ] **2.2.4** Write unit/integration tests for config API endpoints
  - **File**: `src/app/api/admin/facturacion/__tests__/configuracion.test.ts` (NEW)
  - **Action**: Tests:
    - GET: returns config without sensitive values (F2-S05)
    - GET: 401 without JWT (F2-S06)
    - GET: 403 without manage_billing permission (F2-S07)
    - PUT: partial update works (F2-S08)
    - PUT: requires SOL creds for SUNAT_DIRECT + PRODUCTION (F2-S09)
    - PUT: rejects invalid PEM certificate (F2-S10)
    - PUT: rejects invalid PEM private key (F2-S11)
    - PUT: extracts cert expiration date (F2-S12)
    - PUT: emits audit event (F2-S13)
    - PUT: encrypts credentials before storage (AC-F2-05)
    - POST test-connection: success (F2-S14)
    - POST test-connection: failure (F2-S15)
    - POST test-connection: always uses BETA (F2-S16)
    - POST test-connection: 15s timeout (F2-S17)
  - **Verify**: All tests green
  - **Effort**: 2-3 hours
  - **Dep**: 2.2.1, 2.2.2, 2.2.3

### 2.3 Integration — Admin UI

- [ ] **2.3.1** Add SUNAT configuration section to admin facturacion page
  - **File**: `src/app/admin/facturacion/page.tsx`
  - **Action**: Add "Configuracion SUNAT" section with:
    1. Radio buttons: SUNAT Directo / Nubefact / Deshabilitado (maps to sunat_provider)
    2. SUNAT Directo fields (visible when selected):
       - Input: Usuario SOL
       - Input (type=password): Clave SOL
       - File upload: Certificado digital PEM (max 10KB, accepts .pem)
       - File upload: Clave privada PEM (max 10KB, accepts .pem)
       - Indicator: Certificate expiration date (alert if < 30 days)
    3. Nubefact fields (visible when provider=NUBEFACT):
       - Input: Token de autorizacion
       - Input: URL de API
    4. Radio buttons: Modo (Produccion / Beta / Deshabilitado)
    5. Button "Guardar configuracion" -> PUT to API
    6. Button "Probar conexion" -> POST to test-connection, shows inline result
    7. Status indicator: green (complete), red (incomplete), grey (disabled)
  - **Fetch**: GET config on mount; update on save
  - **Verify**: UI renders correctly; forms submit to correct APIs
  - **Effort**: 3-4 hours
  - **Dep**: 2.2.1, 2.2.2, 2.2.3
  - **Scenarios**: F2-S18 to F2-S20; AC-F2-09

- [ ] **2.3.2** Add certificate expiration alert in UI
  - **File**: `src/app/admin/facturacion/page.tsx` (same)
  - **Action**: If `cert_expires_in_days < 30`: show yellow alert "El certificado digital expira en {N} dias". If expired: show red alert "Certificado digital expirado".
  - **Verify**: Alert shows for certs expiring within 30 days
  - **Effort**: 30 min
  - **Dep**: 2.3.1
  - **Scenarios**: F2-S19

### 2.4 Verification — Phase 2 Complete

- [ ] **2.4.1** Run full test suite to verify 0 regressions
  - **Action**: `npm test` — all existing + new tests pass; `tsc --noEmit` 0 errors
  - **Verify**: 0 failures
  - **Effort**: 15 min
  - **Dep**: All Phase 2 tasks

---

## Phase 3: Resumen Diario de Boletas (F3)

### 3.1 Core — Daily Summary Service

- [ ] **3.1.1** Create `SunatDailySummaryService`
  - **File**: `src/core/jobs/sunat-daily-summary.ts` (NEW)
  - **Action**: Implement from design 5.1-5.2. Constructor: `(prisma, providerRouter)`. Methods:
    - `processAllTenants(): Promise<DailySummaryResult[]>` — main entry
    - `processTenant(tenantId, summaryDate): Promise<DailySummaryResult>`
  - **Flow per tenant**:
    1. Determine `summaryDate` = yesterday (Lima timezone, UTC-5)
    2. Query active tenants with `sunat_mode != 'DISABLED'` and `sunat_provider != 'NONE'`
    3. Check if summary already sent for this date (idempotent)
    4. Query accepted boletas: `invoices WHERE type='BOLETA' AND status != 'VOIDED' AND cdr.response_code='0' AND DATE(created_at AT TIME ZONE 'America/Lima') = summaryDate`
    5. If 0 boletas: skip (no summary needed)
    6. Group by series, calculate totals per series (money in centavos)
    7. Generate summary number: `RC-{YYYYMMDD}-{correlativo}`
    8. Call `provider.sendDailySummary(data)`
    9. Update/create `sunat_daily_summary` with ticket_number, boletas_count, boletas_total, status
    10. Emit `DAILY_SUMMARY_SENT` event
    11. On failure: update sunat_daily_summary with error, continue to next tenant
  - **Return**: `DailySummaryResult { tenantId, summaryDate, boletasCount, boletasTotalCents, ticketNumber, status, error? }`
  - **Verify**: `tsc --noEmit` passes
  - **Effort**: 3-4 hours
  - **Dep**: 1.3.1 (provider router), 1.1.2 (events), 1.1.5 (daily summary schema)
  - **Scenarios**: F3-S01 to F3-S09

- [ ] **3.1.2** Write unit tests for `SunatDailySummaryService`
  - **File**: `src/core/jobs/__tests__/sunat-daily-summary.test.ts` (NEW)
  - **Action**: Test with mocked Prisma + mocked provider:
    - Happy path: 50 boletas -> summary sent (F3-S01)
    - No boletas: skip, no summary generated (F3-S02)
    - Exclude boletas with CDR != "0" (F3-S03)
    - Exclude voided boletas (F3-S04)
    - Exclude boletas without CDR (F3-S05)
    - Multiple tenants processed (F3-S06)
    - Disabled tenant skipped (F3-S07)
    - SUNAT error handled, continues to next tenant (F3-S08)
    - Sequential correlativo per tenant/date (F3-S09)
    - Idempotent: already-sent summary not re-sent
    - Event DAILY_SUMMARY_SENT emitted
  - **Property test**: `fc.array(fc.record({ total_cents: fc.integer({min:1, max:1000000}) }))` -> sum matches individual totals
  - **Verify**: All tests green
  - **Effort**: 2-3 hours
  - **Dep**: 3.1.1

### 3.2 Integration — Cron Endpoint

- [ ] **3.2.1** Create cron endpoint `/api/cron/sunat-daily-summary`
  - **File**: `src/app/api/cron/sunat-daily-summary/route.ts` (NEW)
  - **Action**: `GET` handler. Verify `CRON_SECRET` (same pattern as sunat-queue). Instantiate `SunatDailySummaryService(prisma, providerRouter)`. Call `processAllTenants()`. Return 200 with results JSON. Add OpenTelemetry span `sunat.daily_summary.process`.
  - **Verify**: 200 with results; 401 without CRON_SECRET
  - **Effort**: 30 min
  - **Dep**: 3.1.1
  - **Scenarios**: F3-S10

- [ ] **3.2.2** Update `vercel.json` with daily-summary cron
  - **File**: `vercel.json`
  - **Action**: Add cron entry: `{ "path": "/api/cron/sunat-daily-summary", "schedule": "0 11 * * *" }` (11:00 UTC = 6:00 AM Lima)
  - **Verify**: `vercel.json` valid JSON with 3 cron entries
  - **Effort**: 5 min
  - **Dep**: 3.2.1
  - **Scenarios**: F3-REQ-03; AC-F3-06

- [ ] **3.2.3** Write integration test for daily summary cron endpoint
  - **File**: `src/app/api/cron/__tests__/sunat-daily-summary.test.ts` (NEW)
  - **Action**: Test:
    - 401 without CRON_SECRET (F3-S10)
    - 200 with valid CRON_SECRET
    - Response includes expected shape
  - **Verify**: Tests green
  - **Effort**: 30 min
  - **Dep**: 3.2.1

### 3.3 Integration — Ticket Status Polling

- [ ] **3.3.1** Add ticket status polling to queue worker
  - **File**: `src/core/jobs/sunat-queue-worker.ts`
  - **Action**: After processing queue items in `processBatch()`, add step: query `sunat_daily_summary WHERE sunat_status = 'PENDING' AND ticket_number IS NOT NULL`. For each pending summary, call `provider.queryTicketStatus(ticket_number)`. If CDR received: update `sunat_status` to 'ACCEPTED' or 'REJECTED', store CDR.
  - **Verify**: `tsc --noEmit` passes; existing worker tests still green
  - **Effort**: 1 hour
  - **Dep**: 1.4.1 (worker exists), 3.1.1 (summary service)
  - **Scenarios**: design 5.3

- [ ] **3.3.2** Write unit test for ticket polling
  - **File**: `src/core/jobs/__tests__/sunat-queue-worker.test.ts` (append)
  - **Action**: Add tests:
    - Pending ticket polled and resolved to ACCEPTED
    - Pending ticket polled and resolved to REJECTED
    - No pending tickets: no polling
    - Polling error handled gracefully
  - **Verify**: Tests green
  - **Effort**: 1 hour
  - **Dep**: 3.3.1

### 3.4 Integration — Admin UI

- [ ] **3.4.1** Add Daily Summary table to admin facturacion page
  - **File**: `src/app/admin/facturacion/page.tsx`
  - **Action**: Add "Resumenes Diarios" section with:
    1. Table columns: Fecha, Serie, Boletas, Monto Total (S/.), Ticket SUNAT, Estado
    2. Status badges: PENDING (grey), SENT (yellow), ACCEPTED (green), REJECTED (red)
    3. Date range filter
    4. "Reenviar" button for REJECTED/PENDING summaries
    5. Pagination (10 per page)
  - **API**: Create `GET /api/admin/facturacion/resumenes-diarios` to fetch summary data, or use existing patterns.
  - **Verify**: Table renders with data; filter works
  - **Effort**: 2-3 hours
  - **Dep**: 2.3.1 (base page), 3.1.1
  - **Scenarios**: F3-S11, F3-S12; AC-F3-07

- [ ] **3.4.2** Create API endpoint for daily summary list/resend
  - **File**: `src/app/api/admin/facturacion/resumenes-diarios/route.ts` (NEW)
  - **Action**: `GET` — returns paginated list of `sunat_daily_summary` for tenant. `POST` — resend a specific summary by id.
  - **Auth**: `requireAdminAuth` + `requireAdminPermission('manage_billing')`
  - **Verify**: Returns data; 401/403 for unauthorized
  - **Effort**: 1 hour
  - **Dep**: 2.1.1 (schema)

### 3.5 Verification — Phase 3 Complete

- [ ] **3.5.1** Run full test suite to verify 0 regressions
  - **Action**: `npm test`; `tsc --noEmit`; `npm run build`
  - **Verify**: 0 failures
  - **Effort**: 15 min
  - **Dep**: All Phase 3 tasks

---

## Phase 4: Contingencia Persistente (F4)

### 4.1 Foundation — Schema

- [ ] **4.1.1** Add `sunat_contingency` model to Prisma schema
  - **File**: `prisma/schema.prisma`
  - **Action**: Add model from design 3.2:
    - Fields: `id` (UUID), `tenant_id` (FK), `active` (Boolean, default true), `reason` (String), `activated_at` (DateTime), `activated_by` (UUID?), `deactivated_at` (DateTime?), `pending_count` (Int, default 0), `auto_activated` (Boolean, default false), `failure_count` (Int, default 0), `created_at` (DateTime)
    - Relation: `tenants @relation(fields: [tenant_id], references: [id])`
    - Index: `@@index([tenant_id, active])`
  - **Migration**: `prisma db execute` with `CREATE TABLE IF NOT EXISTS sunat_contingency ...` + indexes
  - **Verify**: `npx prisma generate` + `npx prisma validate` passes
  - **Effort**: 20 min
  - **Scenarios**: F4-S01; specs F4-REQ-01

- [ ] **4.1.2** Add `sunat_contingency_invoices` model to Prisma schema
  - **File**: `prisma/schema.prisma`
  - **Action**: Add model from design 3.2:
    - Fields: `id` (UUID), `contingency_id` (FK), `invoice_id` (FK), `tenant_id` (FK), `series` (String), `number` (String), `issued_at` (DateTime), `reconcile_by` (DateTime), `reconciled_at` (DateTime?), `created_at` (DateTime)
    - Relations: `sunat_contingency`, `invoices`, `tenants`
    - Indexes: `[tenant_id, reconciled_at]`, `[contingency_id]`, `[tenant_id, reconcile_by]`
  - **Migration**: `prisma db execute` with `CREATE TABLE IF NOT EXISTS sunat_contingency_invoices ...` + indexes
  - **Verify**: `npx prisma generate` + `npx prisma validate` passes
  - **Effort**: 20 min
  - **Dep**: 4.1.1
  - **Scenarios**: F4-S02; specs F4-REQ-01

- [ ] **4.1.3** Add relations to `tenants` and `invoices` models in schema
  - **File**: `prisma/schema.prisma`
  - **Action**: Add relation fields to `tenants` model: `sunat_contingency sunat_contingency[]`, `sunat_contingency_invoices sunat_contingency_invoices[]`. Add to `invoices` model: `sunat_contingency_invoices sunat_contingency_invoices[]`.
  - **Verify**: `npx prisma generate` passes
  - **Effort**: 10 min
  - **Dep**: 4.1.1, 4.1.2

### 4.2 Core — Refactor ContingencyManager

- [ ] **4.2.1** Refactor `ContingencyManager` from in-memory to Prisma persistence
  - **File**: `src/core/integrations/sunat/contingency.ts`
  - **Action**: Major refactor per design 6.3:
    - **Remove**: `private pendingInvoices: ContingencyInvoice[] = []`, `private state: ContingencyState = { ... }`, all in-memory arrays
    - **Constructor**: `(prisma: PrismaClient)` — no longer singleton, scoped per-tenant
    - **Implement methods** (all read/write to Prisma):
      - `getState(tenantId)` -> `prisma.sunat_contingency.findFirst({ where: { tenant_id, active: true } })`
      - `isActive(tenantId)` -> boolean from getState
      - `activate(tenantId, reason, activatedBy)` -> `prisma.sunat_contingency.create(...)`
      - `deactivate(tenantId)` -> update `active=false, deactivated_at=NOW()`
      - `registerContingencyInvoice(params)` -> create in `sunat_contingency_invoices` + increment `pending_count`
      - `markReconciled(tenantId, invoiceId)` -> update `reconciled_at=NOW()` + decrement `pending_count`
      - `getPendingInvoices(tenantId)` -> `findMany({ where: { tenant_id, reconciled_at: null } })`
      - `getUrgentReconciliations(tenantId, hoursThreshold=24)` -> where `reconcile_by <= cutoff AND reconciled_at IS NULL`
      - `getOverdueInvoices(tenantId)` -> where `reconcile_by <= NOW() AND reconciled_at IS NULL`
    - **Health check**: Remove `setInterval` for SUNAT polling. Health checks are now passive: queue worker auto-deactivates contingency on successful SUNAT response.
    - **reconcile_by**: `issued_at + 7 days`
  - **Verify**: `tsc --noEmit` passes; old in-memory arrays removed
  - **Effort**: 3-4 hours
  - **Dep**: 4.1.1, 4.1.2, 4.1.3
  - **Scenarios**: F4-S01 to F4-S06; specs F4-REQ-02

- [ ] **4.2.2** Write unit tests for refactored `ContingencyManager`
  - **File**: `src/core/integrations/sunat/__tests__/contingency.test.ts` (UPDATE existing)
  - **Action**: Rewrite existing tests to use Prisma mock instead of in-memory state:
    - Activate persists to DB (F4-S01)
    - Register invoice persists to DB + increments pending_count (F4-S02)
    - Deactivate persists to DB (F4-S03)
    - Reconcile updates DB + decrements pending_count (F4-S04)
    - State survives "restart": new instance reads from DB (F4-S05)
    - No in-memory state dependency (F4-S06)
    - Urgent reconciliations query: < 24h threshold (F4-S07)
    - Overdue invoices query: past deadline (F4-S08)
    - Cannot deactivate with overdue invoices (F4-S15)
    - Auto-deactivation on SUNAT recovery (F4-S16)
  - **Verify**: All tests green; no in-memory state references
  - **Effort**: 2-3 hours
  - **Dep**: 4.2.1
  - **Scenarios**: F4-S01 to F4-S08, F4-S15, F4-S16; AC-F4-01 to AC-F4-08

### 4.3 Integration — invoice.service.ts

- [ ] **4.3.1** Update `invoice.service.ts` to use persistent ContingencyManager
  - **File**: `src/core/services/invoice.service.ts`
  - **Action**: Replace any in-memory ContingencyManager usage with Prisma-backed version. Ensure `ContingencyManager` is instantiated with `prisma` and scoped per-tenant. Update calls to `activate()`, `registerContingencyInvoice()`, etc. to pass `tenantId`.
  - **Verify**: `tsc --noEmit` passes; existing invoice service tests still green
  - **Effort**: 1-2 hours
  - **Dep**: 4.2.1
  - **Scenarios**: specs F4-REQ-04

### 4.4 Integration — Admin UI

- [ ] **4.4.1** Add Contingency section to admin facturacion page
  - **File**: `src/app/admin/facturacion/page.tsx`
  - **Action**: Add "Modo Contingencia" section per specs F4-REQ-03:
    1. Status badge: ACTIVO (red) / INACTIVO (green)
    2. If active: show reason, activated_at, activated_by, pending_count
    3. Table of contingency invoices: Serie, Numero, Emitida, Deadline, Estado (Pendiente/Reconciliado/Vencido)
    4. Visual alerts: overdue invoices in RED, urgent (< 24h) in YELLOW
    5. Button "Activar contingencia manual" (OWNER/ADMIN only) -> creates contingency with MANUAL_ACTIVATION
    6. Button "Desactivar contingencia" (OWNER/ADMIN only, disabled if overdue invoices exist)
  - **Verify**: UI renders correctly; buttons trigger correct API calls
  - **Effort**: 2-3 hours
  - **Dep**: 2.3.1 (base page), 4.2.1
  - **Scenarios**: F4-S09 to F4-S15; AC-F4-05, AC-F4-06

- [ ] **4.4.2** Create API endpoints for contingency management
  - **File**: `src/app/api/admin/facturacion/contingencia/route.ts` (NEW)
  - **Action**:
    - `GET`: Return current contingency state + pending invoices for tenant
    - `POST`: Activate manual contingency (OWNER/ADMIN only)
    - `DELETE`: Deactivate contingency (OWNER/ADMIN only, fails if overdue invoices)
  - **Auth**: `requireAdminPermission('OWNER', 'ADMIN')`
  - **Verify**: API works correctly; 403 for non-admin roles
  - **Effort**: 1-2 hours
  - **Dep**: 4.2.1

- [ ] **4.4.3** Write tests for contingency API endpoints
  - **File**: `src/app/api/admin/facturacion/__tests__/contingencia.test.ts` (NEW)
  - **Action**: Test:
    - GET: returns contingency state
    - POST: activates manual contingency (F4-S13)
    - DELETE: deactivates contingency (F4-S14)
    - DELETE: fails with overdue invoices (F4-S15)
    - Auth: 401/403 checks
  - **Verify**: All tests green
  - **Effort**: 1 hour
  - **Dep**: 4.4.2

### 4.5 Verification — Phase 4 Complete

- [ ] **4.5.1** Run full test suite to verify 0 regressions
  - **Action**: `npm test`; `tsc --noEmit`; `npm run build`
  - **Verify**: 0 failures
  - **Effort**: 15 min
  - **Dep**: All Phase 4 tasks

---

## Phase 5: Cross-Phase Verification & Cleanup

### 5.1 Integration Verification

- [ ] **5.1.1** Verify queue worker integration with all 4 phases
  - **Action**: Write integration test that exercises the full flow:
    1. Tenant configures SUNAT (Phase 2 API)
    2. Invoice created and queued (existing flow)
    3. Queue worker processes item (Phase 1)
    4. CDR stored, event emitted
    5. Daily summary generated (Phase 3)
    6. Contingency auto-activates on failure (Phase 4)
  - **File**: `src/core/jobs/__tests__/sunat-integration.test.ts` (NEW)
  - **Effort**: 2-3 hours
  - **Dep**: All Phase 1-4 tasks

- [ ] **5.1.2** Verify Pino log sanitization for SUNAT credentials
  - **Action**: Ensure `pinoLogger` redacts: `sunat_sol_password`, `certificate_pem`, `private_key_pem`, `nubefact_token`. Add these to Pino redact config if not already present.
  - **File**: Pino configuration file (locate via `pinoLogger` import)
  - **Effort**: 30 min
  - **Dep**: 2.1.2

- [ ] **5.1.3** Add OpenTelemetry spans to all SUNAT operations
  - **Action**: Ensure spans exist per design 10.2:
    - `sunat.queue.process_batch`
    - `sunat.queue.process_item`
    - `sunat.adapter.send_invoice`
    - `sunat.adapter.send_daily_summary`
    - `sunat.daily_summary.process`
    - `sunat.contingency.activate`
  - **Files**: All new service files
  - **Effort**: 1 hour
  - **Dep**: 1.4.1, 3.1.1, 4.2.1

### 5.2 Full Verification

- [ ] **5.2.1** Run complete test suite
  - **Action**: `npm test` — all 4897+ existing tests + all new tests pass
  - **Verify**: 0 failures
  - **Effort**: 15 min
  - **Dep**: All tasks

- [ ] **5.2.2** Run TypeScript type check
  - **Action**: `npx tsc --noEmit` — 0 errors
  - **Verify**: 0 errors
  - **Effort**: 5 min
  - **Dep**: All tasks

- [ ] **5.2.3** Run production build
  - **Action**: `npm run build` — succeeds without errors
  - **Verify**: Build succeeds
  - **Effort**: 10 min
  - **Dep**: All tasks

- [ ] **5.2.4** Verify `vercel.json` final state
  - **File**: `vercel.json`
  - **Action**: Confirm 3 cron entries: maintenance (weekly), sunat-queue (2 min), sunat-daily-summary (daily 11:00 UTC)
  - **Verify**: Valid JSON
  - **Effort**: 2 min
  - **Dep**: 1.5.2, 3.2.2

- [ ] **5.2.5** Verify event type count = 77
  - **File**: `src/core/domain/events.ts`
  - **Action**: Count all event types in discriminated union. Must be 73 existing + 4 new = 77.
  - **Verify**: Count matches
  - **Effort**: 5 min
  - **Dep**: 1.1.2

---

## Dependency Matrix

| Task | Depends On |
|------|-----------|
| 1.1.1 | — |
| 1.1.2 | — |
| 1.1.3 | — |
| 1.1.4 | — |
| 1.1.5 | — |
| 1.2.1 | 1.1.1, 1.1.3 |
| 1.2.2 | 1.2.1 |
| 1.3.1 | 1.2.1, 1.1.3 |
| 1.3.2 | 1.3.1 |
| 1.3.3 | 1.3.1, 1.3.2 |
| 1.4.1 | 1.3.1, 1.1.2 |
| 1.4.2 | 1.4.1 |
| 1.5.1 | 1.4.1 |
| 1.5.2 | 1.5.1 |
| 1.5.3 | 1.3.1 |
| 1.5.4 | 1.5.1 |
| 1.6.1 | All Phase 1 |
| 2.1.1 | — |
| 2.1.2 | — |
| 2.1.3 | 2.1.2 |
| 2.1.4 | 2.1.2, 1.1.3 |
| 2.1.5 | — |
| 2.2.1 | 2.1.1 |
| 2.2.2 | 2.1.2, 2.2.1 |
| 2.2.3 | 1.3.1, 2.1.4 |
| 2.2.4 | 2.2.1, 2.2.2, 2.2.3 |
| 2.3.1 | 2.2.1, 2.2.2, 2.2.3 |
| 2.3.2 | 2.3.1 |
| 2.4.1 | All Phase 2 |
| 3.1.1 | 1.3.1, 1.1.2, 1.1.5 |
| 3.1.2 | 3.1.1 |
| 3.2.1 | 3.1.1 |
| 3.2.2 | 3.2.1 |
| 3.2.3 | 3.2.1 |
| 3.3.1 | 1.4.1, 3.1.1 |
| 3.3.2 | 3.3.1 |
| 3.4.1 | 2.3.1, 3.1.1 |
| 3.4.2 | 2.1.1 |
| 3.5.1 | All Phase 3 |
| 4.1.1 | — |
| 4.1.2 | 4.1.1 |
| 4.1.3 | 4.1.1, 4.1.2 |
| 4.2.1 | 4.1.1, 4.1.2, 4.1.3 |
| 4.2.2 | 4.2.1 |
| 4.3.1 | 4.2.1 |
| 4.4.1 | 2.3.1, 4.2.1 |
| 4.4.2 | 4.2.1 |
| 4.4.3 | 4.4.2 |
| 4.5.1 | All Phase 4 |
| 5.1.1 | All Phase 1-4 |
| 5.1.2 | 2.1.2 |
| 5.1.3 | 1.4.1, 3.1.1, 4.2.1 |
| 5.2.1-5 | All tasks |

---

## New Files Summary (10)

| File | Phase |
|------|-------|
| `src/core/integrations/sunat/sunat-direct-adapter.ts` | F1 |
| `src/core/integrations/sunat/provider-router.ts` | F1 |
| `src/core/integrations/sunat/nubefact-adapter-wrapper.ts` | F1 |
| `src/core/integrations/sunat/credential-encryption.ts` | F2 |
| `src/core/jobs/sunat-queue-worker.ts` | F1 |
| `src/core/jobs/sunat-daily-summary.ts` | F3 |
| `src/app/api/cron/sunat-queue/route.ts` | F1 |
| `src/app/api/cron/sunat-daily-summary/route.ts` | F3 |
| `src/app/api/admin/facturacion/configuracion/route.ts` | F2 |
| `src/app/api/admin/facturacion/test-connection/route.ts` | F2 |

## Modified Files Summary (10)

| File | Phase(s) |
|------|----------|
| `package.json` | F1 |
| `vercel.json` | F1, F3 |
| `prisma/schema.prisma` | F1, F2, F4 |
| `src/core/domain/events.ts` | F1 |
| `src/core/integrations/sunat/provider-config.ts` | F1, F2 |
| `src/core/integrations/sunat/client.ts` | F1 |
| `src/core/integrations/sunat/contingency.ts` | F4 |
| `src/core/services/invoice.service.ts` | F4 |
| `src/app/admin/facturacion/page.tsx` | F2, F3, F4 |
| `.env.example` | F2 |

## New Test Files Summary (10)

| File | Phase |
|------|-------|
| `src/core/integrations/sunat/__tests__/sunat-direct-adapter.test.ts` | F1 |
| `src/core/integrations/sunat/__tests__/provider-router.test.ts` | F1 |
| `src/core/integrations/sunat/__tests__/credential-encryption.test.ts` | F2 |
| `src/core/jobs/__tests__/sunat-queue-worker.test.ts` | F1 |
| `src/core/jobs/__tests__/sunat-daily-summary.test.ts` | F3 |
| `src/app/api/cron/__tests__/sunat-queue.test.ts` | F1 |
| `src/app/api/cron/__tests__/sunat-daily-summary.test.ts` | F3 |
| `src/app/api/admin/facturacion/__tests__/configuracion.test.ts` | F2 |
| `src/app/api/admin/facturacion/__tests__/contingencia.test.ts` | F4 |
| `src/core/jobs/__tests__/sunat-integration.test.ts` | F5 |
