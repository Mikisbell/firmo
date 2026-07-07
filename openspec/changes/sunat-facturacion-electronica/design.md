# Design: SUNAT Facturacion Electronica — Integracion Directa via nodefact

> SDD Design Artifact | Change: `sunat-facturacion-electronica` | Status: COMPLETE

## 1. Architecture Overview

```
                                      ┌──────────────────────────────┐
                                      │     Vercel Cron Scheduler    │
                                      │  ┌────────┐   ┌───────────┐ │
                                      │  │ /queue  │   │ /daily-   │ │
                                      │  │ (2 min) │   │  summary  │ │
                                      │  │         │   │ (6AM UTC-5│ │
                                      │  └────┬────┘   └─────┬─────┘ │
                                      └───────┼──────────────┼───────┘
                                              │              │
                              ┌───────────────▼──────┐  ┌────▼──────────────────┐
                              │  SunatQueueWorker    │  │  SunatDailySummary    │
                              │  ────────────────    │  │  ─────────────────    │
                              │  • Poll invoice_queue│  │  • Query boletas ACPT │
                              │  • Load tenant creds │  │  • Group by serie     │
                              │  • Dispatch to adapter│  │  • Send via adapter   │
                              │  • Retry w/ backoff  │  │  • Store ticket#      │
                              └───────┬──────────────┘  └────┬──────────────────┘
                                      │                      │
                          ┌───────────▼──────────────────────▼───────────┐
                          │          InvoiceProviderRouter               │
                          │  ─────────────────────────────────────────   │
                          │  tenant.sunat_provider === 'SUNAT_DIRECT'   │
                          │    → SunatDirectAdapter (nodefact)          │
                          │  tenant.sunat_provider === 'NUBEFACT'       │
                          │    → NubefactAdapter (HTTP REST)            │
                          │  tenant.sunat_provider === 'NONE'           │
                          │    → skip (no-op)                           │
                          └───────┬──────────────────────┬──────────────┘
                                  │                      │
                    ┌─────────────▼──────────┐  ┌────────▼────────────┐
                    │  SunatDirectAdapter    │  │  NubefactAdapter    │
                    │  ──────────────────    │  │  ───────────────    │
                    │  nodefact npm (MIT)    │  │  (existing, 233 ln) │
                    │  • UBL 2.1 XML gen    │  │  • REST API call    │
                    │  • xml-crypto sign    │  │  • Token auth       │
                    │  • SOAP to SUNAT      │  │                     │
                    │  • CDR parsing        │  │                     │
                    │  • PDF generation     │  │                     │
                    │  • QR code generation │  │                     │
                    └─────────┬─────────────┘  └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   SUNAT Web Service │
                    │   (SEE Contribuyen.)│
                    │   ────────────────  │
                    │   Beta: 4 URLs      │
                    │   Prod: 4 URLs      │
                    └─────────────────────┘
```

### ADR-010: SUNAT Direct via nodefact (Zero Cost)

**Status**: Proposed
**Context**: FIRMO POS needs electronic invoicing for SUNAT compliance. The existing `NubefactAdapter` uses a paid OSE (S/0.10/doc). nodefact (MIT) enables free direct SUNAT integration.
**Decision**: Use `nodefact` as the default provider (`sunat-direct`). Keep `NubefactAdapter` as fallback for tenants that prefer it.
**Consequences**: Zero cost per document. Tenant manages own SOL credentials and certificates. More operational responsibility but massive cost savings.

### ADR-011: Poll-Based Cron for Queue Processing

**Status**: Proposed
**Context**: Vercel Serverless has no persistent processes. Cannot use long-polling or WebSocket workers.
**Decision**: Use Vercel Cron (every 2 minutes) to poll `invoice_queue`. Process up to 10 items per invocation. Consistent with existing `cron/maintenance` pattern.
**Consequences**: Max latency = 2 min for invoice SUNAT delivery. Throughput = ~300 items/hour (sufficient for polleria volume). No cold-start issues (cron keeps function warm).

### ADR-012: AES-256-GCM for Credential Encryption at Rest

**Status**: Proposed
**Context**: SOL passwords and private keys must be encrypted in DB. Cannot store plaintext. Supabase does not provide transparent column encryption.
**Decision**: Application-level AES-256-GCM encryption with a master key from env var `SUNAT_ENCRYPTION_KEY`. IV per-value, stored as `iv:ciphertext:tag` base64 string.
**Consequences**: One more env var to manage. Keys rotate by re-encrypting all tenant credentials. Standard Node.js `crypto` module, no new dependencies.

---

## 2. Component Design

### 2.1 SunatDirectAdapter

**Location**: `src/core/integrations/sunat/sunat-direct-adapter.ts`

```typescript
// ============================================================================
// Interface Contract
// ============================================================================

export interface SunatDirectConfig {
  ruc: string;
  solUser: string;          // e.g., "MODDATOS"
  solPassword: string;      // decrypted SOL password
  certificatePem: string;   // X.509 certificate PEM (decrypted)
  privateKeyPem: string;    // RSA private key PEM (decrypted)
  mode: 'PRODUCTION' | 'BETA';
}

export interface SunatDocumentResult {
  success: boolean;
  cdrResponseCode: string;        // "0" = accepted
  cdrResponseMessage: string;
  cdrXml: string;                 // Full CDR XML from SUNAT
  hash: string;                   // Hash del comprobante
  signedXml: string;              // Signed UBL XML
  pdfBase64?: string;             // PDF of the document
  qrString?: string;              // QR string for printing
  ticketNumber?: string;          // For async documents (Resumen Diario)
}

export interface SunatDirectAdapter {
  // Core document sending
  sendInvoice(data: InvoiceData): Promise<Result<SunatDocumentResult, DomainError>>;
  sendCreditNote(data: CreditNoteData): Promise<Result<SunatDocumentResult, DomainError>>;
  sendVoidCommunication(data: VoidData): Promise<Result<SunatDocumentResult, DomainError>>;

  // Resumen Diario
  sendDailySummary(data: DailySummaryData): Promise<Result<SunatDocumentResult, DomainError>>;
  queryTicketStatus(ticketNumber: string): Promise<Result<TicketStatusResult, DomainError>>;

  // Health
  testConnection(): Promise<Result<{ message: string }, DomainError>>;
}
```

**Internal Architecture**:

```
SunatDirectAdapter
├── constructor(config: SunatDirectConfig)
│   └── Initializes nodefact with RUC, SOL creds, cert/key
│
├── sendInvoice(data)
│   ├── 1. Map InvoiceData → nodefact invoice format
│   ├── 2. nodefact.generateXml() → UBL 2.1 XML
│   ├── 3. nodefact.signXml(xml, cert, key) → signed XML
│   ├── 4. nodefact.sendToSunat(signedXml) → SOAP call
│   ├── 5. nodefact.parseCdr(response) → CDR object
│   ├── 6. nodefact.generatePdf(data) → PDF base64
│   ├── 7. nodefact.generateQr(data) → QR string
│   └── 8. Return SunatDocumentResult
│
├── sendCreditNote(data)
│   └── Same flow, document type "07" (Nota de Credito)
│
├── sendVoidCommunication(data)
│   └── Same flow, "Comunicacion de Baja" document
│
├── sendDailySummary(data)
│   ├── 1. Build Resumen Diario XML (multiple boletas)
│   ├── 2. Sign and send
│   └── 3. Return ticket_number (async processing by SUNAT)
│
├── queryTicketStatus(ticket)
│   └── SOAP call to check Resumen Diario processing status
│
└── testConnection()
    └── Send test document to SUNAT Beta endpoint
```

**SUNAT Endpoints** (stored in adapter, NOT configurable per-tenant):

| Environment | Service | URL |
|-------------|---------|-----|
| BETA | Envio CPE | `https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService` |
| BETA | Consulta CDR | `https://e-beta.sunat.gob.pe/ol-it-wsconscpegem-beta/billConsultService` |
| PRODUCTION | Envio CPE | `https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService` |
| PRODUCTION | Consulta CDR | `https://e-factura.sunat.gob.pe/ol-it-wsconscpegem/billConsultService` |

**Error Mapping** (nodefact errors → DomainError codes):

| nodefact error | DomainError code | Retryable? |
|----------------|------------------|------------|
| SOAP timeout | `SUNAT_TIMEOUT` | Yes |
| HTTP 500 | `SUNAT_SERVER_ERROR` | Yes |
| HTTP 403 | `SUNAT_AUTH_FAILED` | No |
| CDR code != "0" | `SUNAT_REJECTED` | No |
| XML signing failed | `SUNAT_SIGNING_ERROR` | No |
| Certificate expired | `SUNAT_CERT_EXPIRED` | No |
| Network error | `SUNAT_NETWORK_ERROR` | Yes |

### 2.2 InvoiceProviderRouter

**Location**: `src/core/integrations/sunat/provider-router.ts`

This replaces the current responsibility of `provider-config.ts` (which reads from env vars) with a tenant-aware router that fetches provider config from the database.

```typescript
// ============================================================================
// Interface Contract
// ============================================================================

export interface InvoiceProvider {
  sendInvoice(data: InvoiceData): Promise<Result<SunatDocumentResult, DomainError>>;
  sendCreditNote(data: CreditNoteData): Promise<Result<SunatDocumentResult, DomainError>>;
  sendVoidCommunication(data: VoidData): Promise<Result<SunatDocumentResult, DomainError>>;
  sendDailySummary(data: DailySummaryData): Promise<Result<SunatDocumentResult, DomainError>>;
  queryTicketStatus(ticketNumber: string): Promise<Result<TicketStatusResult, DomainError>>;
  testConnection(): Promise<Result<{ message: string }, DomainError>>;
}

export class InvoiceProviderRouter {
  /**
   * Resolve the correct InvoiceProvider for a tenant.
   * Reads tenant_settings to determine provider and load credentials.
   * Decrypts sensitive fields using SUNAT_ENCRYPTION_KEY.
   * Caches adapter instances per tenant for the lifetime of the request.
   */
  async getProvider(tenantId: string): Promise<Result<InvoiceProvider, DomainError>>;

  /**
   * Check if a tenant has SUNAT enabled and configured.
   */
  async isEnabled(tenantId: string): Promise<boolean>;
}
```

**Resolution Flow**:

```
getProvider(tenantId)
  │
  ├── 1. prisma.tenant_settings.findUnique({ where: { tenant_id } })
  │
  ├── 2. Check sunat_mode:
  │     ├── 'DISABLED' → return err(SUNAT_DISABLED)
  │     ├── 'BETA' → sunatMode = 'BETA'
  │     └── 'PRODUCTION' → sunatMode = 'PRODUCTION'
  │
  ├── 3. Check sunat_provider:
  │     ├── 'SUNAT_DIRECT':
  │     │     ├── Decrypt: sunat_sol_password, sunat_certificate_pem, sunat_private_key_pem
  │     │     ├── Validate all fields present (sol_user, sol_password, cert, key)
  │     │     └── return new SunatDirectAdapter(config)
  │     │
  │     ├── 'NUBEFACT':
  │     │     ├── Decrypt: nubefact_token
  │     │     ├── Validate token + url present
  │     │     └── return NubefactAdapterWrapper(token, url)
  │     │
  │     └── 'NONE':
  │           └── return err(SUNAT_NOT_CONFIGURED)
  │
  └── 4. Wrap in Result<InvoiceProvider>
```

**NubefactAdapterWrapper**: A thin wrapper around the existing `NubefactAdapter` class that implements the `InvoiceProvider` interface, translating between `SunatDocumentResult` and `NubefactResponse`.

### 2.3 Credential Encryption Module

**Location**: `src/core/integrations/sunat/credential-encryption.ts`

```typescript
// ============================================================================
// Interface Contract
// ============================================================================

/**
 * Encrypt/decrypt SUNAT credentials using AES-256-GCM.
 * Master key sourced from env var SUNAT_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * Storage format: base64(iv || ciphertext || authTag)
 * IV: 12 bytes (random per encryption)
 * Auth tag: 16 bytes
 */

export function encryptCredential(plaintext: string): string;
export function decryptCredential(encrypted: string): string;
export function isEncrypted(value: string): boolean;

/**
 * Validate a PEM certificate:
 * - Must start with -----BEGIN CERTIFICATE-----
 * - Must not be expired
 * - Returns expiration date for alert scheduling
 */
export function validateCertificatePem(pem: string): Result<{
  expiresAt: Date;
  subject: string;
  issuer: string;
}, DomainError>;

/**
 * Validate a PEM private key:
 * - Must start with -----BEGIN RSA PRIVATE KEY----- or -----BEGIN PRIVATE KEY-----
 * - Must be parseable
 */
export function validatePrivateKeyPem(pem: string): Result<void, DomainError>;
```

**Implementation Notes**:
- Uses Node.js built-in `crypto` module (no new dependencies).
- `SUNAT_ENCRYPTION_KEY` env var: 64 hex characters (256 bits). Generate with `openssl rand -hex 32`.
- Each encryption generates a fresh 12-byte IV. Stored concatenated: `base64(iv + ciphertext + tag)`.
- Decryption is deterministic given key + stored blob.
- Certificate validation uses `crypto.X509Certificate` (Node 16+).

### 2.4 Queue Worker

**Location**: `src/core/jobs/sunat-queue-worker.ts`

```typescript
// ============================================================================
// Interface Contract
// ============================================================================

export interface QueueWorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  details: QueueItemResult[];
}

export interface QueueItemResult {
  queueId: string;
  invoiceId: string;
  tenantId: string;
  action: string;
  status: 'SUCCESS' | 'RETRY' | 'FAILED' | 'SKIPPED';
  error?: string;
  durationMs: number;
}

export class SunatQueueWorker {
  constructor(
    private prisma: PrismaClient,
    private providerRouter: InvoiceProviderRouter,
  ) {}

  /**
   * Process a batch of pending queue items.
   * Called by the cron endpoint every 2 minutes.
   */
  async processBatch(batchSize?: number): Promise<QueueWorkerResult>;
}
```

**Processing Flow (per invocation)**:

```
processBatch(batchSize = 10)
  │
  ├── 1. ACQUIRE ITEMS (SELECT ... FOR UPDATE SKIP LOCKED)
  │     │
  │     └── SELECT * FROM invoice_queue
  │         WHERE status = 'PENDING'
  │           AND scheduled_at <= NOW()
  │         ORDER BY priority ASC, scheduled_at ASC
  │         LIMIT {batchSize}
  │         FOR UPDATE SKIP LOCKED
  │
  ├── 2. GROUP BY tenant_id (avoid loading same tenant config N times)
  │
  ├── 3. FOR EACH tenant group:
  │     │
  │     ├── 3a. Check sunat_mode !== 'DISABLED'
  │     │     └── If disabled → mark all items SKIPPED, continue
  │     │
  │     ├── 3b. providerRouter.getProvider(tenantId)
  │     │     └── If no provider → mark all items SKIPPED, continue
  │     │
  │     └── 3c. FOR EACH queue item in group:
  │           │
  │           ├── 3c.i. Mark item status = 'PROCESSING' (prevent re-pickup)
  │           │
  │           ├── 3c.ii. Dispatch by action:
  │           │     ├── 'EMIT_TO_SUNAT' → loadInvoice → provider.sendInvoice()
  │           │     ├── 'VOID_IN_SUNAT' → loadInvoice → provider.sendVoidCommunication()
  │           │     └── 'EMIT_CREDIT_NOTE' → loadCreditNote → provider.sendCreditNote()
  │           │
  │           ├── 3c.iii. ON SUCCESS:
  │           │     ├── Update invoice_queue: status='PROCESSED', processed_at=NOW()
  │           │     ├── Upsert invoice_cdr: response_code, hash, cdr_xml
  │           │     ├── Store signed XML and PDF (invoice_cdr fields or separate storage)
  │           │     ├── Emit event: INVOICE_SENT_TO_SUNAT (sent)
  │           │     └── Emit event: INVOICE_SUNAT_ACCEPTED (if CDR code=0)
  │           │
  │           ├── 3c.iv. ON RETRYABLE FAILURE:
  │           │     ├── Increment attempts
  │           │     ├── Set last_error, last_attempt_at
  │           │     ├── Calculate next_attempt: NOW() + (attempts * 5 min)
  │           │     ├── Update scheduled_at = next_attempt
  │           │     ├── Set status = 'PENDING' (re-eligible)
  │           │     └── If attempts >= max_attempts:
  │           │           ├── Set status = 'FAILED'
  │           │           ├── Emit event: INVOICE_SUNAT_REJECTED
  │           │           └── Check contingency trigger threshold
  │           │
  │           └── 3c.v. ON NON-RETRYABLE FAILURE:
  │                 ├── Set status = 'FAILED', last_error
  │                 ├── Emit event: INVOICE_SUNAT_REJECTED
  │                 └── Log with full trace_id context
  │
  └── 4. RETURN QueueWorkerResult with summary
```

**Concurrency Safety**:
- `FOR UPDATE SKIP LOCKED` prevents two concurrent cron invocations from picking up the same items.
- Each item is atomically set to `PROCESSING` before dispatch.
- Vercel Cron may overlap executions if one takes >2min. `SKIP LOCKED` handles this gracefully.

**Backoff Schedule**:

| Attempt | Delay | Total elapsed |
|---------|-------|---------------|
| 1 | 0 min (immediate) | 0 min |
| 2 | 5 min | 5 min |
| 3 | 10 min | 15 min |
| Failed | N/A | 15 min max |

### 2.5 Cron Endpoints

**Location**: `src/app/api/cron/sunat-queue/route.ts`

```typescript
// GET /api/cron/sunat-queue
// Schedule: */2 * * * * (every 2 minutes)
// Auth: Bearer {CRON_SECRET}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Verify CRON_SECRET (same pattern as cron/maintenance)
  // 2. Create SunatQueueWorker(prisma, providerRouter)
  // 3. const result = await worker.processBatch(10)
  // 4. Log structured output with OpenTelemetry span
  // 5. Return JSON result with status 200
}
```

**Location**: `src/app/api/cron/sunat-daily-summary/route.ts`

```typescript
// GET /api/cron/sunat-daily-summary
// Schedule: 0 11 * * * (11:00 UTC = 6:00 AM Lima, UTC-5)
// Auth: Bearer {CRON_SECRET}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Verify CRON_SECRET
  // 2. Create SunatDailySummaryService(prisma, providerRouter)
  // 3. const result = await service.processAllTenants()
  // 4. Log structured output
  // 5. Return JSON result
}
```

**vercel.json** (updated):

```json
{
  "crons": [
    {
      "path": "/api/cron/maintenance",
      "schedule": "0 3 * * 0"
    },
    {
      "path": "/api/cron/sunat-queue",
      "schedule": "*/2 * * * *"
    },
    {
      "path": "/api/cron/sunat-daily-summary",
      "schedule": "0 11 * * *"
    }
  ]
}
```

---

## 3. Data Model Changes

### 3.1 tenant_settings — New Columns (Fase 2)

```sql
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS sunat_provider     TEXT    DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS sunat_mode         TEXT    DEFAULT 'DISABLED',
  ADD COLUMN IF NOT EXISTS sunat_sol_user     TEXT,
  ADD COLUMN IF NOT EXISTS sunat_sol_password TEXT,          -- encrypted AES-256-GCM
  ADD COLUMN IF NOT EXISTS sunat_certificate_pem TEXT,       -- encrypted AES-256-GCM
  ADD COLUMN IF NOT EXISTS sunat_private_key_pem TEXT,       -- encrypted AES-256-GCM
  ADD COLUMN IF NOT EXISTS sunat_cert_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nubefact_token     TEXT,          -- encrypted AES-256-GCM
  ADD COLUMN IF NOT EXISTS nubefact_url       TEXT;
```

**Prisma schema addition** (in `tenant_settings` model):

```prisma
model tenant_settings {
  // ... existing fields ...

  // === SUNAT Electronic Invoicing ===
  sunat_provider          String?   @default("NONE")     // SUNAT_DIRECT | NUBEFACT | NONE
  sunat_mode              String?   @default("DISABLED")  // PRODUCTION | BETA | DISABLED
  sunat_sol_user          String?                         // SOL username (e.g., MODDATOS)
  sunat_sol_password      String?                         // encrypted
  sunat_certificate_pem   String?                         // encrypted
  sunat_private_key_pem   String?                         // encrypted
  sunat_cert_expires_at   DateTime? @db.Timestamptz(6)    // for expiry alerts
  nubefact_token          String?                         // encrypted
  nubefact_url            String?
}
```

**Validation constraints** (enforced in application layer):
- `sunat_provider`: one of `SUNAT_DIRECT`, `NUBEFACT`, `NONE`
- `sunat_mode`: one of `PRODUCTION`, `BETA`, `DISABLED`
- If `sunat_provider = 'SUNAT_DIRECT'`: `sunat_sol_user`, `sunat_sol_password`, `sunat_certificate_pem`, `sunat_private_key_pem` are required
- If `sunat_provider = 'NUBEFACT'`: `nubefact_token`, `nubefact_url` are required

### 3.2 sunat_contingency — New Model (Fase 4)

```prisma
model sunat_contingency {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String    @db.Uuid
  active          Boolean   @default(true)
  reason          String                          // SUNAT_UNREACHABLE | NETWORK_OUTAGE | CERTIFICATE_ERROR | MANUAL_ACTIVATION
  activated_at    DateTime  @default(now()) @db.Timestamptz(6)
  activated_by    String?   @db.Uuid              // employee who activated, null if auto
  deactivated_at  DateTime? @db.Timestamptz(6)
  pending_count   Int       @default(0)
  auto_activated  Boolean   @default(false)       // true if triggered by consecutive failures
  failure_count   Int       @default(0)           // consecutive SUNAT failures that triggered this
  tenants         tenants   @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id, active])
}

model sunat_contingency_invoices {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  contingency_id  String    @db.Uuid
  invoice_id      String    @db.Uuid
  tenant_id       String    @db.Uuid
  series          String
  number          String
  issued_at       DateTime  @default(now()) @db.Timestamptz(6)
  reconcile_by    DateTime  @db.Timestamptz(6)     // issued_at + 7 days
  reconciled_at   DateTime? @db.Timestamptz(6)
  sunat_contingency sunat_contingency @relation(fields: [contingency_id], references: [id])
  invoices          invoices          @relation(fields: [invoice_id], references: [id])
  tenants           tenants           @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id, reconciled_at])
  @@index([contingency_id])
  @@index([tenant_id, reconcile_by])
}
```

### 3.3 invoice_cdr — Additional Fields

The existing `invoice_cdr` model needs additional columns to store the signed XML and PDF:

```sql
ALTER TABLE invoice_cdr
  ADD COLUMN IF NOT EXISTS signed_xml TEXT,
  ADD COLUMN IF NOT EXISTS pdf_base64 TEXT,
  ADD COLUMN IF NOT EXISTS qr_string TEXT;
```

```prisma
model invoice_cdr {
  // ... existing fields ...
  signed_xml    String?   // Full signed UBL 2.1 XML
  pdf_base64    String?   // Generated PDF (base64)
  qr_string     String?   // QR code data string
}
```

### 3.4 sunat_daily_summary — Additional Fields

The existing model needs fields for CDR and error tracking:

```sql
ALTER TABLE sunat_daily_summary
  ADD COLUMN IF NOT EXISTS cdr_xml TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
```

```prisma
model sunat_daily_summary {
  // ... existing fields ...
  cdr_xml       String?
  last_error    String?
  attempts      Int       @default(0)
}
```

---

## 4. New Event Types

Four new event types added to `src/core/domain/events.ts`:

### 4.1 INVOICE_SENT_TO_SUNAT

Emitted when a queue item is dispatched to SUNAT (before CDR response).

```typescript
const InvoiceSentToSunatPayload = z.object({
  invoice_id: uuidSchema,
  queue_item_id: uuidSchema,
  provider: z.enum(['sunat-direct', 'nubefact']),
  action: z.string(),  // 'EMIT_TO_SUNAT' | 'VOID_IN_SUNAT' | 'EMIT_CREDIT_NOTE'
});

// In EventSchema discriminated union:
BaseEnvelopeSchema.extend({
  event_type: z.literal("INVOICE_SENT_TO_SUNAT"),
  aggregate_type: z.literal("INVOICE"),
  payload: InvoiceSentToSunatPayload,
}),
```

### 4.2 INVOICE_SUNAT_ACCEPTED

Emitted when SUNAT CDR response code is "0" (accepted).

```typescript
const InvoiceSunatAcceptedPayload = z.object({
  invoice_id: uuidSchema,
  cdr_response_code: z.string(),
  cdr_response_message: z.string(),
  hash: z.string(),
  provider: z.enum(['sunat-direct', 'nubefact']),
});

BaseEnvelopeSchema.extend({
  event_type: z.literal("INVOICE_SUNAT_ACCEPTED"),
  aggregate_type: z.literal("INVOICE"),
  payload: InvoiceSunatAcceptedPayload,
}),
```

### 4.3 INVOICE_SUNAT_REJECTED

Emitted when SUNAT CDR response code is not "0" or max retries exhausted.

```typescript
const InvoiceSunatRejectedPayload = z.object({
  invoice_id: uuidSchema,
  cdr_response_code: z.string().optional(),
  cdr_response_message: z.string().optional(),
  error_code: z.string(),  // DomainError code
  error_message: z.string(),
  attempts: z.number().int(),
  provider: z.enum(['sunat-direct', 'nubefact']),
});

BaseEnvelopeSchema.extend({
  event_type: z.literal("INVOICE_SUNAT_REJECTED"),
  aggregate_type: z.literal("INVOICE"),
  payload: InvoiceSunatRejectedPayload,
}),
```

### 4.4 DAILY_SUMMARY_SENT

Emitted when a Resumen Diario is sent to SUNAT.

```typescript
const DailySummarySentPayload = z.object({
  summary_id: uuidSchema,
  summary_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  boletas_count: z.number().int().nonnegative(),
  boletas_total_cents: positiveCentsSchema,
  ticket_number: z.string().optional(),
  provider: z.enum(['sunat-direct', 'nubefact']),
});

BaseEnvelopeSchema.extend({
  event_type: z.literal("DAILY_SUMMARY_SENT"),
  aggregate_type: z.literal("INVOICE"),
  payload: DailySummarySentPayload,
}),
```

**Event type count**: 73 existing + 4 new = **77 event types**.

**Type exports** (added to the exports section at the bottom of events.ts):

```typescript
export type InvoiceSentToSunatEvent = Extract<ParkEvent, { event_type: "INVOICE_SENT_TO_SUNAT" }>;
export type InvoiceSunatAcceptedEvent = Extract<ParkEvent, { event_type: "INVOICE_SUNAT_ACCEPTED" }>;
export type InvoiceSunatRejectedEvent = Extract<ParkEvent, { event_type: "INVOICE_SUNAT_REJECTED" }>;
export type DailySummarySentEvent = Extract<ParkEvent, { event_type: "DAILY_SUMMARY_SENT" }>;
```

---

## 5. Resumen Diario Flow

### 5.1 Service

**Location**: `src/core/jobs/sunat-daily-summary.ts`

```typescript
export interface DailySummaryResult {
  tenantId: string;
  summaryDate: string;           // YYYY-MM-DD
  boletasCount: number;
  boletasTotalCents: number;
  ticketNumber: string | null;
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  error?: string;
}

export class SunatDailySummaryService {
  constructor(
    private prisma: PrismaClient,
    private providerRouter: InvoiceProviderRouter,
  ) {}

  async processAllTenants(): Promise<DailySummaryResult[]>;
  async processTenant(tenantId: string, summaryDate: Date): Promise<DailySummaryResult>;
}
```

### 5.2 Processing Flow

```
processAllTenants()
  │
  ├── 1. Determine summary_date = yesterday (UTC-5 / Lima timezone)
  │
  ├── 2. Query active tenants with sunat_mode != 'DISABLED'
  │     │
  │     └── SELECT t.id FROM tenants t
  │         JOIN tenant_settings ts ON ts.tenant_id = t.id
  │         WHERE t.is_active = true
  │           AND ts.sunat_mode IN ('PRODUCTION', 'BETA')
  │           AND ts.sunat_provider != 'NONE'
  │
  ├── 3. FOR EACH tenant:
  │     │
  │     ├── 3a. Check if summary already sent for this date
  │     │     └── SELECT * FROM sunat_daily_summary
  │     │         WHERE tenant_id = ? AND summary_date = ?
  │     │           AND sunat_status = 'ACCEPTED'
  │     │     └── If exists → skip (idempotent)
  │     │
  │     ├── 3b. Query accepted boletas for the date
  │     │     └── SELECT i.* FROM invoices i
  │     │         JOIN invoice_cdr c ON c.invoice_id = i.id
  │     │         WHERE i.tenant_id = ?
  │     │           AND i.invoice_type = 'BOLETA'
  │     │           AND i.status != 'VOIDED'
  │     │           AND c.response_code = '0'
  │     │           AND DATE(i.created_at AT TIME ZONE 'America/Lima') = ?
  │     │
  │     ├── 3c. If 0 boletas → skip (no summary needed)
  │     │
  │     ├── 3d. Build DailySummaryData from boletas
  │     │     ├── Group by series
  │     │     ├── Calculate totals per series
  │     │     └── Include voided boletas (Comunicacion de Baja within summary)
  │     │
  │     ├── 3e. Get provider → provider.sendDailySummary(data)
  │     │
  │     ├── 3f. ON SUCCESS:
  │     │     ├── Upsert sunat_daily_summary record
  │     │     ├── Store ticket_number, CDR
  │     │     ├── Emit DAILY_SUMMARY_SENT event
  │     │     └── Return DailySummaryResult
  │     │
  │     └── 3g. ON FAILURE:
  │           ├── Update sunat_daily_summary with error
  │           ├── Log with context
  │           └── Continue to next tenant (don't abort batch)
  │
  └── 4. Return all results
```

### 5.3 Ticket Status Polling

Resumen Diario is processed asynchronously by SUNAT. They return a `ticket_number` immediately. The CDR must be fetched later using `queryTicketStatus()`.

**Strategy**: The daily summary cron runs at 6 AM. A separate check within the queue worker cron (every 2 min) polls for pending tickets:

```
// In SunatQueueWorker.processBatch(), after processing queue items:

1. SELECT * FROM sunat_daily_summary
   WHERE sunat_status = 'PENDING' AND ticket_number IS NOT NULL

2. FOR EACH pending summary:
   provider.queryTicketStatus(ticket_number)

3. If CDR received:
   Update sunat_status = 'ACCEPTED' or 'REJECTED'
   Store CDR
```

This piggybacks on the existing 2-minute cron without needing a third cron job.

---

## 6. Contingency Persistence (Fase 4)

### 6.1 State Machine

```
                    ┌──────────┐
         activate() │          │ deactivate()
     ┌──────────────► ACTIVE   ├──────────────────┐
     │              │          │                    │
     │              └────┬─────┘                    │
     │                   │                          ▼
┌────┴─────┐       register()              ┌───────────┐
│ INACTIVE │       invoice                 │ INACTIVE  │
│ (default)│                               │ (pending  │
└──────────┘                               │  invoices │
                                           │  to       │
                                           │  reconcile)│
                                           └───────────┘
```

### 6.2 Auto-Activation Trigger

The queue worker tracks consecutive SUNAT failures per tenant. After `N` consecutive failures (configurable, default = 5), contingency mode auto-activates:

```typescript
const AUTO_CONTINGENCY_THRESHOLD = 5; // consecutive failures

// In queue worker, after each failure:
tenantFailureCounts[tenantId] = (tenantFailureCounts[tenantId] || 0) + 1;

if (tenantFailureCounts[tenantId] >= AUTO_CONTINGENCY_THRESHOLD) {
  await contingencyService.activate(tenantId, 'SUNAT_UNREACHABLE', null);
  tenantFailureCounts[tenantId] = 0; // reset
}

// On any success, reset the counter:
tenantFailureCounts[tenantId] = 0;
```

### 6.3 Refactored ContingencyManager

**Location**: `src/core/integrations/sunat/contingency.ts` (modified)

```typescript
export class ContingencyManager {
  constructor(private prisma: PrismaClient) {}

  /** Get current contingency state for a tenant (from DB) */
  async getState(tenantId: string): Promise<ContingencyState>;

  /** Check if contingency is active for a tenant */
  async isActive(tenantId: string): Promise<boolean>;

  /** Activate contingency mode — persists to DB */
  async activate(tenantId: string, reason: ContingencyReason, activatedBy: string | null): Promise<void>;

  /** Deactivate contingency mode — persists to DB */
  async deactivate(tenantId: string): Promise<void>;

  /** Register an invoice issued during contingency — persists to DB */
  async registerContingencyInvoice(params: {
    tenantId: string;
    invoiceId: string;
    contingencyId: string;
    series: string;
    number: string;
  }): Promise<Date>; // returns reconcileBy date

  /** Mark a contingency invoice as reconciled */
  async markReconciled(tenantId: string, invoiceId: string): Promise<void>;

  /** Get invoices approaching reconciliation deadline */
  async getUrgentReconciliations(tenantId: string, hoursThreshold?: number): Promise<ContingencyInvoice[]>;

  /** Get overdue invoices (past reconciliation deadline) */
  async getOverdueInvoices(tenantId: string): Promise<ContingencyInvoice[]>;

  /** Get all pending (non-reconciled) invoices for a tenant */
  async getPendingInvoices(tenantId: string): Promise<ContingencyInvoice[]>;
}
```

**Key change**: No more in-memory state. No more `setInterval` health checks. Health checks are now done passively: when the queue worker successfully processes a SUNAT request for a tenant in contingency mode, it auto-deactivates contingency.

---

## 7. API Endpoints (Fase 2)

### 7.1 GET /api/admin/facturacion/configuracion

```typescript
// Auth: requireAdminPermission('OWNER', 'ADMIN')
// Response:
{
  sunat_provider: 'SUNAT_DIRECT' | 'NUBEFACT' | 'NONE',
  sunat_mode: 'PRODUCTION' | 'BETA' | 'DISABLED',
  sunat_sol_user: string | null,
  has_sol_password: boolean,        // never expose password
  has_certificate: boolean,         // never expose cert
  has_private_key: boolean,         // never expose key
  sunat_cert_expires_at: string | null,
  nubefact_url: string | null,
  has_nubefact_token: boolean,      // never expose token
}
```

### 7.2 PUT /api/admin/facturacion/configuracion

```typescript
// Auth: requireAdminPermission('OWNER', 'ADMIN')
// Body:
{
  sunat_provider: 'SUNAT_DIRECT' | 'NUBEFACT' | 'NONE',
  sunat_mode: 'PRODUCTION' | 'BETA' | 'DISABLED',
  sunat_sol_user?: string,
  sunat_sol_password?: string,          // plaintext, encrypted before storage
  sunat_certificate_pem?: string,       // PEM text, validated + encrypted
  sunat_private_key_pem?: string,       // PEM text, validated + encrypted
  nubefact_token?: string,              // plaintext, encrypted before storage
  nubefact_url?: string,
}

// Validation:
// - If provider = 'SUNAT_DIRECT': sol_user required, cert/key validated if provided
// - If provider = 'NUBEFACT': token + url required
// - Certificate PEM: validate format + expiration date
// - Private key PEM: validate format + parseable
// - Encrypt sensitive fields before DB write

// Response: same as GET (updated config)
```

### 7.3 POST /api/admin/facturacion/test-connection

```typescript
// Auth: requireAdminPermission('OWNER', 'ADMIN')
// No body (uses tenant's current saved config)
//
// Flow:
// 1. Load tenant config
// 2. Resolve provider
// 3. provider.testConnection()
// 4. Return result

// Response:
{
  success: boolean,
  message: string,              // "Conexion exitosa con SUNAT Beta" / error message
  duration_ms: number,
}
```

---

## 8. Sequence Diagrams

### 8.1 Invoice Emission → Queue → SUNAT (Happy Path)

```
Cashier         InvoiceService      invoice_queue     CronJob          QueueWorker       ProviderRouter    SunatDirectAdapter    SUNAT
  │                  │                    │               │                 │                  │                   │                │
  │  emitInvoice()   │                    │               │                 │                  │                   │                │
  ├─────────────────►│                    │               │                 │                  │                   │                │
  │                  │ CREATE invoice     │               │                 │                  │                   │                │
  │                  │ CREATE event       │               │                 │                  │                   │                │
  │                  │ CREATE queue item──┤               │                 │                  │                   │                │
  │                  │                    │               │                 │                  │                   │                │
  │  ok(invoice)     │                    │               │                 │                  │                   │                │
  │◄─────────────────│                    │               │                 │                  │                   │                │
  │                  │                    │   (2 min)     │                 │                  │                   │                │
  │                  │                    │◄──────────────│                 │                  │                   │                │
  │                  │                    │               │  processBatch() │                  │                   │                │
  │                  │                    │               ├────────────────►│                  │                   │                │
  │                  │                    │               │                 │  getProvider()   │                   │                │
  │                  │                    │◄──────────────┼─────────────────┤─────────────────►│                   │                │
  │                  │                    │ SELECT FOR    │                 │                  │                   │                │
  │                  │                    │ UPDATE SKIP   │                 │ SunatDirect      │                   │                │
  │                  │                    │ LOCKED        │                 │◄─────────────────│                   │                │
  │                  │                    │               │                 │                  │  sendInvoice()    │                │
  │                  │                    │               │                 ├──────────────────┼──────────────────►│                │
  │                  │                    │               │                 │                  │                   │  SOAP XML      │
  │                  │                    │               │                 │                  │                   ├───────────────►│
  │                  │                    │               │                 │                  │                   │     CDR        │
  │                  │                    │               │                 │                  │                   │◄───────────────│
  │                  │                    │               │                 │  SunatDocResult   │                   │                │
  │                  │                    │               │                 │◄─────────────────┼───────────────────│                │
  │                  │                    │               │                 │                  │                   │                │
  │                  │                    │ UPDATE status │                 │                  │                   │                │
  │                  │                    │ ='PROCESSED'  │                 │                  │                   │                │
  │                  │                    │◄──────────────┼─────────────────│                  │                   │                │
  │                  │                    │               │                 │ UPSERT CDR       │                   │                │
  │                  │                    │               │                 │ EMIT events      │                   │                │
  │                  │                    │               │  result         │                  │                   │                │
  │                  │                    │               │◄────────────────│                  │                   │                │
```

### 8.2 Contingency Auto-Activation

```
QueueWorker                ContingencyManager           DB
    │                            │                       │
    │  5 consecutive failures    │                       │
    │  for tenant X              │                       │
    │                            │                       │
    │  activate(tenantX,         │                       │
    │    SUNAT_UNREACHABLE)      │                       │
    ├───────────────────────────►│                       │
    │                            │  INSERT sunat_        │
    │                            │  contingency          │
    │                            ├──────────────────────►│
    │                            │                       │
    │  Later: successful SUNAT   │                       │
    │  response for tenant X     │                       │
    │                            │                       │
    │  deactivate(tenantX)       │                       │
    ├───────────────────────────►│                       │
    │                            │  UPDATE active=false, │
    │                            │  deactivated_at=NOW() │
    │                            ├──────────────────────►│
```

---

## 9. Security Considerations

### 9.1 Credential Storage

| Field | Storage | Encryption | Access |
|-------|---------|------------|--------|
| `sunat_sol_user` | DB plaintext | No (username, non-sensitive) | Admin API only |
| `sunat_sol_password` | DB encrypted | AES-256-GCM | Decrypted only in queue worker |
| `sunat_certificate_pem` | DB encrypted | AES-256-GCM | Decrypted only in queue worker |
| `sunat_private_key_pem` | DB encrypted | AES-256-GCM | Decrypted only in queue worker |
| `nubefact_token` | DB encrypted | AES-256-GCM | Decrypted only in queue worker |
| `SUNAT_ENCRYPTION_KEY` | Env var | N/A | Vercel env only |

### 9.2 API Security

- All admin endpoints require `requireAdminPermission('OWNER', 'ADMIN')`.
- Cron endpoints require `Bearer {CRON_SECRET}` header.
- `tenant_id` always derived from JWT, never from client.
- GET config endpoint never returns decrypted passwords/keys/tokens. Returns `has_*: boolean` flags.
- Certificate upload validates PEM format before storage.
- No logging of decrypted credentials (Pino sanitization already filters sensitive fields).

### 9.3 Key Rotation

When `SUNAT_ENCRYPTION_KEY` needs rotation:
1. Set new env var `SUNAT_ENCRYPTION_KEY_NEW`.
2. Run migration script that reads with old key, re-encrypts with new key.
3. Swap env vars. Remove old key.

This is a manual process, documented but not automated.

---

## 10. Observability

### 10.1 Structured Logging (Pino)

All SUNAT operations log with:

```typescript
{
  tenant_id: string,
  invoice_id: string,
  queue_item_id: string,
  action: string,
  provider: 'sunat-direct' | 'nubefact',
  sunat_mode: 'PRODUCTION' | 'BETA',
  duration_ms: number,
  attempt: number,
  trace_id: string,     // OpenTelemetry
  span_id: string,      // OpenTelemetry
}
```

### 10.2 OpenTelemetry Spans

| Span name | Attributes |
|-----------|-----------|
| `sunat.queue.process_batch` | `batch_size`, `processed`, `succeeded`, `failed` |
| `sunat.queue.process_item` | `queue_id`, `action`, `tenant_id`, `attempt` |
| `sunat.adapter.send_invoice` | `provider`, `invoice_type`, `mode` |
| `sunat.adapter.send_daily_summary` | `provider`, `boletas_count`, `summary_date` |
| `sunat.daily_summary.process` | `tenants_processed`, `summaries_sent` |
| `sunat.contingency.activate` | `tenant_id`, `reason`, `auto_activated` |

### 10.3 Metrics (via log aggregation)

| Metric | Source |
|--------|--------|
| Queue depth | `SELECT COUNT(*) FROM invoice_queue WHERE status='PENDING'` |
| Queue processing rate | Log `sunat.queue.process_batch` / `processed` per invocation |
| SUNAT response time | Span `sunat.adapter.send_invoice` / `duration_ms` |
| SUNAT success rate | Log `sunat.adapter.send_invoice` outcome counts |
| Daily summaries sent | Log `sunat.daily_summary.process` / `summaries_sent` |
| Contingency activations | Log `sunat.contingency.activate` count |

---

## 11. File Map (New and Modified)

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `src/core/integrations/sunat/sunat-direct-adapter.ts` | F1 | nodefact wrapper implementing InvoiceProvider |
| `src/core/integrations/sunat/provider-router.ts` | F1 | Tenant-aware provider resolution |
| `src/core/integrations/sunat/credential-encryption.ts` | F2 | AES-256-GCM encrypt/decrypt for SUNAT credentials |
| `src/core/integrations/sunat/nubefact-adapter-wrapper.ts` | F1 | InvoiceProvider wrapper around existing NubefactAdapter |
| `src/core/jobs/sunat-queue-worker.ts` | F1 | Queue consumer with retry logic |
| `src/core/jobs/sunat-daily-summary.ts` | F3 | Resumen Diario generation and sending |
| `src/app/api/cron/sunat-queue/route.ts` | F1 | Cron endpoint for queue processing |
| `src/app/api/cron/sunat-daily-summary/route.ts` | F3 | Cron endpoint for daily summary |
| `src/app/api/admin/facturacion/configuracion/route.ts` | F2 | GET/PUT SUNAT config per tenant |
| `src/app/api/admin/facturacion/test-connection/route.ts` | F2 | POST test SUNAT connection |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `package.json` | F1 | Add `nodefact` dependency |
| `vercel.json` | F1, F3 | Add 2 cron entries |
| `prisma/schema.prisma` | F2, F4 | New columns in tenant_settings, new models (contingency), new columns in invoice_cdr and sunat_daily_summary |
| `src/core/domain/events.ts` | F1 | Add 4 event types (77 total) |
| `src/core/integrations/sunat/client.ts` | F1 | Refactor `realSendInvoice()` to use provider router |
| `src/core/integrations/sunat/provider-config.ts` | F1 | Update types, mark as legacy (superceded by provider-router) |
| `src/core/integrations/sunat/contingency.ts` | F4 | Refactor from in-memory to Prisma persistence |
| `src/core/services/invoice.service.ts` | F4 | Integrate with persistent contingency |
| `src/app/admin/facturacion/page.tsx` | F2, F3, F4 | Add config section, daily summary table, contingency panel |

---

## 12. Testing Strategy

### Unit Tests (per component)

| Component | Test file | Key scenarios |
|-----------|-----------|---------------|
| `SunatDirectAdapter` | `__tests__/sunat-direct-adapter.test.ts` | Happy path, SUNAT error codes, timeout, cert expired, invalid XML |
| `InvoiceProviderRouter` | `__tests__/provider-router.test.ts` | SUNAT_DIRECT resolution, NUBEFACT resolution, NONE/DISABLED, missing creds |
| `credential-encryption` | `__tests__/credential-encryption.test.ts` | Encrypt/decrypt roundtrip, invalid key, PEM validation, cert expiry |
| `SunatQueueWorker` | `__tests__/sunat-queue-worker.test.ts` | Batch processing, retry logic, backoff, max attempts, SKIP LOCKED, multi-tenant |
| `SunatDailySummaryService` | `__tests__/sunat-daily-summary.test.ts` | Boleta aggregation, skip empty days, skip already sent, error handling |
| `ContingencyManager` (refactored) | `__tests__/contingency.test.ts` | Activate/deactivate persistence, register invoice, reconcile, overdue detection |

### Property Tests (fast-check)

| Property | Generator | Assertion |
|----------|-----------|-----------|
| Encryption roundtrip | `fc.string()` | `decrypt(encrypt(s)) === s` for all strings |
| Backoff monotonic | `fc.integer({min:1, max:10})` | `backoff(n+1) > backoff(n)` |
| Queue priority ordering | `fc.array(fc.record({priority: fc.integer({min:1, max:10})}))` | Processed in priority order |
| Daily summary totals | `fc.array(fc.record({total_cents: fc.integer({min:1, max:1000000})}))` | Sum matches individual totals |

### Integration Tests

- Queue worker against mock SUNAT adapter (verify full cycle from queue item to CDR storage).
- Provider router with tenant_settings fixtures (verify correct adapter instantiation).
- Cron endpoint with CRON_SECRET validation.
- Admin config API with auth + validation.

### E2E Tests (Playwright)

- Admin configures SUNAT (uploads dummy cert, sets SOL creds).
- Test connection button shows success/error.
- Daily summary table displays records.
- Contingency panel shows state.

---

## 13. Migration Strategy

### Phase 2 Migration (tenant_settings columns)

```sql
-- 001_add_sunat_config_columns.sql
-- Safe: all columns nullable with defaults, zero-downtime

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS sunat_provider TEXT DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS sunat_mode TEXT DEFAULT 'DISABLED',
  ADD COLUMN IF NOT EXISTS sunat_sol_user TEXT,
  ADD COLUMN IF NOT EXISTS sunat_sol_password TEXT,
  ADD COLUMN IF NOT EXISTS sunat_certificate_pem TEXT,
  ADD COLUMN IF NOT EXISTS sunat_private_key_pem TEXT,
  ADD COLUMN IF NOT EXISTS sunat_cert_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nubefact_token TEXT,
  ADD COLUMN IF NOT EXISTS nubefact_url TEXT;
```

### Phase 4 Migration (contingency models)

```sql
-- 002_add_sunat_contingency_models.sql

CREATE TABLE IF NOT EXISTS sunat_contingency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  active BOOLEAN DEFAULT true,
  reason TEXT NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT now(),
  activated_by UUID,
  deactivated_at TIMESTAMPTZ,
  pending_count INT DEFAULT 0,
  auto_activated BOOLEAN DEFAULT false,
  failure_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sunat_contingency_tenant_active
  ON sunat_contingency(tenant_id, active);

CREATE TABLE IF NOT EXISTS sunat_contingency_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contingency_id UUID NOT NULL REFERENCES sunat_contingency(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  series TEXT NOT NULL,
  number TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT now(),
  reconcile_by TIMESTAMPTZ NOT NULL,
  reconciled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sunat_contingency_invoices_tenant_reconciled
  ON sunat_contingency_invoices(tenant_id, reconciled_at);
CREATE INDEX IF NOT EXISTS idx_sunat_contingency_invoices_contingency
  ON sunat_contingency_invoices(contingency_id);
CREATE INDEX IF NOT EXISTS idx_sunat_contingency_invoices_reconcile_by
  ON sunat_contingency_invoices(tenant_id, reconcile_by);
```

### invoice_cdr and sunat_daily_summary additions

```sql
-- 003_extend_invoice_cdr_and_daily_summary.sql

ALTER TABLE invoice_cdr
  ADD COLUMN IF NOT EXISTS signed_xml TEXT,
  ADD COLUMN IF NOT EXISTS pdf_base64 TEXT,
  ADD COLUMN IF NOT EXISTS qr_string TEXT;

ALTER TABLE sunat_daily_summary
  ADD COLUMN IF NOT EXISTS cdr_xml TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
```

All migrations use `IF NOT EXISTS` / `IF NOT EXISTS` for idempotency. Safe to re-run.

---

## 14. Dependency: nodefact

**Package**: `nodefact` (npm)
**License**: MIT
**Version**: 0.1.2 (latest as of analysis)

**Transitive dependencies**:
- `xml-crypto` — XML digital signature (XAdES-BES)
- `soap` — SOAP client for SUNAT web services
- `xml2js` — XML parsing
- `handlebars` — Template engine for PDF
- `pdfkit` — PDF generation
- `qrcode` — QR code generation

**Risk mitigation for young library**:
1. `NubefactAdapter` remains as production-proven fallback.
2. Adapter interface allows swapping implementation without changing callers.
3. Integration tests against SUNAT Beta validate before production use.
4. If nodefact has critical issues, we can implement UBL 2.1 XML generation directly (xml-crypto + soap are the core dependencies).

---

## 15. Open Questions

| # | Question | Default if unresolved |
|---|----------|----------------------|
| Q1 | Should PDF storage be in DB (Text/base64) or S3/Supabase Storage? | DB (base64 in invoice_cdr.pdf_base64). Simple, no extra infra. PDFs are ~50-200KB each. |
| Q2 | Should we support multiple active certificates per tenant (for rotation)? | No. One active cert. Manual rotation via admin UI. |
| Q3 | Should the queue worker respect Vercel's 10-second function timeout (hobby) or 60-second (pro)? | Assume Pro plan (60s). Process up to 10 items, each ~3-5s SOAP call. |
| Q4 | Should contingency auto-deactivation happen in the queue worker or in a separate health check? | Queue worker (passive). On successful SUNAT response for tenant in contingency, auto-deactivate. No separate health check cron. |
| Q5 | Should encrypted credentials be double-encrypted (app-level + Supabase column encryption)? | No. App-level AES-256-GCM is sufficient. Supabase managed PostgreSQL uses encrypted disks. |
