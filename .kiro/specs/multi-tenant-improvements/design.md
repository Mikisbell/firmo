# Design Document: Multi-Tenant Improvements

## Overview

This design implements production-grade multi-tenancy for PARK POS, an offline-first Event Sourcing system. The design enforces tenant isolation at all layers (database, API, UI, local storage), automates tenant provisioning, implements resource quotas, and provides comprehensive tenant management capabilities.

The system uses a **shared database** architecture where all tenants share the same PostgreSQL instance with isolation enforced through Row-Level Security (RLS) policies and application-level tenant context. This approach balances cost efficiency with strong isolation guarantees.

## Architecture

### Layered Isolation Model

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                             │
│  - Tenant branding (logo, colors)                       │
│  - Tenant-scoped navigation                             │
│  - Cross-tenant admin interface                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                 API Layer (Next.js)                     │
│  - Tenant context middleware                            │
│  - JWT validation with tenant_id                        │
│  - Tenant-scoped Prisma queries                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Database Layer (PostgreSQL)                │
│  - Row-Level Security (RLS) policies                    │
│  - Tenant-scoped indexes                                │
│  - Tenant isolation in event stream                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│            Local Storage (IndexedDB)                    │
│  - Tenant-specific database names                       │
│  - Encrypted tenant data                                │
│  - Tenant context validation                            │
└─────────────────────────────────────────────────────────┘
```

### Tenant Context Flow

```
User Login → JWT with tenant_id → Middleware extracts tenant_id
     ↓
API Request → Tenant context injected → Prisma queries scoped
     ↓
Database Query → RLS policy enforces tenant_id → Results filtered
     ↓
Response → Tenant-branded UI → User sees only their data
```


## Components and Interfaces

### 1. Row-Level Security (RLS) Policies

PostgreSQL RLS policies enforce tenant isolation at the database level, providing defense-in-depth even if application code has bugs.

#### RLS Policy Template

```sql
-- Enable RLS on tenant-scoped table
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: users can only see their tenant's data
CREATE POLICY tenant_isolation_select ON {table_name}
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Policy for INSERT: users can only insert into their tenant
CREATE POLICY tenant_isolation_insert ON {table_name}
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Policy for UPDATE: users can only update their tenant's data
CREATE POLICY tenant_isolation_update ON {table_name}
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Policy for DELETE: users can only delete their tenant's data
CREATE POLICY tenant_isolation_delete ON {table_name}
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

#### Cross-Tenant Admin Policy

```sql
-- Policy for cross-tenant admins (read-only)
CREATE POLICY cross_tenant_admin_select ON {table_name}
  FOR SELECT
  USING (
    current_setting('app.current_tenant_id')::uuid = tenant_id
    OR current_setting('app.is_cross_tenant_admin')::boolean = true
  );
```

#### Tables Requiring RLS

All tables with `tenant_id` column require RLS policies:
- events, orders, products, catalog_meta, stations
- employees, terminals, shifts, customers, drivers
- invoices, tenant_settings, promotions, daily_sales_summary
- inventory, suppliers, purchase_orders, goods_receipts
- zones, tables, reservations, delivery_orders
- coupons, coupon_redemptions, sync_conflicts
- All other tenant-scoped tables (63 total)

### 2. Tenant Context Middleware

Middleware extracts tenant_id from JWT and injects it into request context and database session.

#### Middleware Interface

```typescript
// src/middleware/tenant-context.ts

export interface TenantContext {
  tenant_id: string;
  is_cross_tenant_admin: boolean;
  employee_id?: string;
  role?: string;
}

export async function withTenantContext<T>(
  handler: (context: TenantContext) => Promise<T>
): Promise<T> {
  // Extract tenant_id from JWT
  const token = await getToken();
  if (!token || !token.tenant_id) {
    throw new UnauthorizedError('Missing tenant context');
  }

  const context: TenantContext = {
    tenant_id: token.tenant_id,
    is_cross_tenant_admin: token.is_cross_tenant_admin || false,
    employee_id: token.employee_id,
    role: token.role,
  };

  // Set PostgreSQL session variables for RLS
  await prisma.$executeRaw`
    SELECT set_config('app.current_tenant_id', ${context.tenant_id}, true);
  `;
  
  await prisma.$executeRaw`
    SELECT set_config('app.is_cross_tenant_admin', ${context.is_cross_tenant_admin.toString()}, true);
  `;

  // Execute handler with context
  return handler(context);
}
```

#### API Route Pattern

```typescript
// src/app/api/orders/route.ts

export async function GET(request: NextRequest) {
  return withTenantContext(async (context) => {
    // Queries automatically scoped by RLS
    const orders = await prisma.orders.findMany({
      where: {
        // tenant_id filter optional - RLS enforces it
        order_status: 'OPEN',
      },
    });

    return NextResponse.json(orders);
  });
}
```


### 3. Tenant Provisioning Service

Automates creation of new tenants with all required configuration and data.

#### Provisioning Interface

```typescript
// src/core/tenant/provisioning.ts

export interface TenantProvisioningRequest {
  legal_name: string;
  ruc?: string;
  address_text?: string;
  admin_name: string;
  admin_pin: string;
  timezone?: string;
  currency?: string;
}

export interface TenantProvisioningResult {
  tenant_id: string;
  admin_employee_id: string;
  default_terminal_id: string;
  activation_code: string;
  onboarding_checklist: OnboardingStep[];
}

export async function provisionTenant(
  request: TenantProvisioningRequest
): Promise<TenantProvisioningResult> {
  return await prisma.$transaction(async (tx) => {
    // 1. Generate tenant_id
    const tenant_id = randomUUID();

    // 2. Create tenant_settings
    await tx.tenant_settings.create({
      data: {
        tenant_id,
        legal_name: request.legal_name,
        ruc: request.ruc,
        address_text: request.address_text,
        timezone: request.timezone || 'America/Lima',
        currency: request.currency || 'PEN',
      },
    });

    // 3. Create catalog_meta
    await tx.catalog_meta.create({
      data: {
        tenant_id,
        catalog_version: 1,
      },
    });

    // 4. Create default stations
    const stations = ['PARRILLA', 'COCINA', 'BAR', 'EMPAQUE'];
    for (const code of stations) {
      await tx.stations.create({
        data: {
          id: randomUUID(),
          tenant_id,
          code,
          name: code,
          is_active: true,
        },
      });
    }

    // 5. Create admin employee
    const admin_employee_id = randomUUID();
    const pin_hash = await hashPIN(request.admin_pin, tenant_id);
    
    await tx.employees.create({
      data: {
        id: admin_employee_id,
        tenant_id,
        name: request.admin_name,
        role: 'ADMIN',
        pin_hash,
        is_active: true,
      },
    });

    // 6. Allocate terminal number ranges
    await allocateTerminalNumberRanges(tx, tenant_id);

    // 7. Create default terminal
    const default_terminal_id = `${tenant_id.substring(0, 8)}-CAJA-01`;
    await tx.terminals.create({
      data: {
        id: randomUUID(),
        tenant_id,
        terminal_id: default_terminal_id,
        is_allowed: true,
      },
    });

    // 8. Generate activation code
    const activation_code = generateActivationCode();

    // 9. Create resource quotas
    await tx.tenant_quotas.create({
      data: {
        tenant_id,
        max_terminals: 20,
        max_employees: 50,
        max_products: 500,
        max_daily_orders: 1000,
      },
    });

    // 10. Create onboarding checklist
    const onboarding_checklist = await createOnboardingChecklist(tx, tenant_id);

    return {
      tenant_id,
      admin_employee_id,
      default_terminal_id,
      activation_code,
      onboarding_checklist,
    };
  });
}
```

#### Terminal Number Range Allocation

```typescript
async function allocateTerminalNumberRanges(
  tx: PrismaTransaction,
  tenant_id: string
) {
  // Allocate 10 ranges of 10,000 numbers each
  const ranges = [
    { terminal_id: 'CAJA_01', start: 1, end: 10000 },
    { terminal_id: 'MOZO_01', start: 10001, end: 20000 },
    { terminal_id: 'MOZO_02', start: 20001, end: 30000 },
    { terminal_id: 'MOZO_03', start: 30001, end: 40000 },
    { terminal_id: 'MOZO_04', start: 40001, end: 50000 },
    { terminal_id: 'MOZO_05', start: 50001, end: 60000 },
    { terminal_id: 'MOZO_06', start: 60001, end: 70000 },
    { terminal_id: 'MOZO_07', start: 70001, end: 80000 },
    { terminal_id: 'MOZO_08', start: 80001, end: 90000 },
    { terminal_id: 'MOZO_09', start: 90001, end: 100000 },
  ];

  for (const range of ranges) {
    await tx.terminal_number_ranges.create({
      data: {
        terminal_id: range.terminal_id,
        tenant_id,
        range_start: range.start,
        range_end: range.end,
        current_number: range.start,
      },
    });
  }
}
```


### 4. Resource Quota Management

Enforces limits on tenant resource usage to ensure fair distribution and cost control.

#### Quota Schema

```sql
CREATE TABLE tenant_quotas (
    tenant_id UUID PRIMARY KEY,
    max_terminals INTEGER DEFAULT 20,
    max_employees INTEGER DEFAULT 50,
    max_products INTEGER DEFAULT 500,
    max_daily_orders INTEGER DEFAULT 1000,
    max_storage_mb INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_usage (
    tenant_id UUID PRIMARY KEY,
    current_terminals INTEGER DEFAULT 0,
    current_employees INTEGER DEFAULT 0,
    current_products INTEGER DEFAULT 0,
    daily_orders INTEGER DEFAULT 0,
    storage_mb INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Quota Enforcement

```typescript
// src/core/tenant/quotas.ts

export interface QuotaCheck {
  allowed: boolean;
  current: number;
  limit: number;
  resource: string;
}

export async function checkQuota(
  tenant_id: string,
  resource: 'terminals' | 'employees' | 'products' | 'daily_orders'
): Promise<QuotaCheck> {
  const [quota, usage] = await Promise.all([
    prisma.tenant_quotas.findUnique({ where: { tenant_id } }),
    prisma.tenant_usage.findUnique({ where: { tenant_id } }),
  ]);

  if (!quota || !usage) {
    throw new Error('Quota configuration not found');
  }

  const limits = {
    terminals: quota.max_terminals,
    employees: quota.max_employees,
    products: quota.max_products,
    daily_orders: quota.max_daily_orders,
  };

  const current = {
    terminals: usage.current_terminals,
    employees: usage.current_employees,
    products: usage.current_products,
    daily_orders: usage.daily_orders,
  };

  return {
    allowed: current[resource] < limits[resource],
    current: current[resource],
    limit: limits[resource],
    resource,
  };
}

export async function incrementUsage(
  tenant_id: string,
  resource: 'terminals' | 'employees' | 'products' | 'daily_orders'
): Promise<void> {
  // Check quota before incrementing
  const check = await checkQuota(tenant_id, resource);
  if (!check.allowed) {
    throw new QuotaExceededError(
      `Quota exceeded for ${resource}: ${check.current}/${check.limit}`
    );
  }

  // Increment usage
  const field = `current_${resource}`;
  await prisma.tenant_usage.update({
    where: { tenant_id },
    data: {
      [field]: { increment: 1 },
      updated_at: new Date(),
    },
  });
}

export async function resetDailyQuotas(): Promise<void> {
  // Reset daily_orders for all tenants at midnight
  await prisma.tenant_usage.updateMany({
    where: {
      last_reset_date: { lt: new Date().toISOString().split('T')[0] },
    },
    data: {
      daily_orders: 0,
      last_reset_date: new Date().toISOString().split('T')[0],
    },
  });
}
```

#### Quota Middleware

```typescript
// src/middleware/quota-check.ts

export function withQuotaCheck(resource: string) {
  return async (context: TenantContext, next: () => Promise<void>) => {
    const check = await checkQuota(context.tenant_id, resource);
    
    if (!check.allowed) {
      throw new QuotaExceededError(
        `Cannot create ${resource}: quota exceeded (${check.current}/${check.limit})`
      );
    }

    await next();
  };
}

// Usage in API route
export async function POST(request: NextRequest) {
  return withTenantContext(async (context) => {
    await withQuotaCheck('products')(context, async () => {
      // Create product
      const product = await prisma.products.create({ ... });
      await incrementUsage(context.tenant_id, 'products');
      return NextResponse.json(product);
    });
  });
}
```


### 5. Tenant Configuration Service

Manages tenant-specific settings and customization.

#### Configuration Interface

```typescript
// src/core/tenant/configuration.ts

export interface TenantConfiguration {
  tenant_id: string;
  legal_name: string;
  ruc?: string;
  address_text?: string;
  logo_url?: string;
  timezone: string;
  currency: string;
  receipt_footer_text?: string;
  kds_audio_enabled: boolean;
  kds_audio_volume: number;
  default_delivery_fee_cents: number;
  enable_tips: boolean;
  tips_on_invoice: boolean;
  allow_offline_coupon: boolean;
  max_offline_coupons_per_order: number;
  require_manager_for_offline: boolean;
}

export async function getTenantConfiguration(
  tenant_id: string
): Promise<TenantConfiguration> {
  const settings = await prisma.tenant_settings.findUnique({
    where: { tenant_id },
  });

  if (!settings) {
    throw new Error('Tenant configuration not found');
  }

  return settings;
}

export async function updateTenantConfiguration(
  tenant_id: string,
  updates: Partial<TenantConfiguration>
): Promise<TenantConfiguration> {
  // Validate updates
  if (updates.logo_url) {
    await validateLogoUrl(updates.logo_url);
  }

  if (updates.timezone) {
    validateTimezone(updates.timezone);
  }

  if (updates.currency) {
    validateCurrency(updates.currency);
  }

  // Update configuration
  const updated = await prisma.tenant_settings.update({
    where: { tenant_id },
    data: {
      ...updates,
      updated_at: new Date(),
    },
  });

  // Log configuration change
  await logConfigurationChange(tenant_id, updates);

  // Invalidate cache
  await invalidateConfigurationCache(tenant_id);

  return updated;
}

async function validateLogoUrl(url: string): Promise<void> {
  // Check file size
  const response = await fetch(url, { method: 'HEAD' });
  const size = parseInt(response.headers.get('content-length') || '0');
  
  if (size > 2 * 1024 * 1024) {
    throw new ValidationError('Logo file size exceeds 2MB limit');
  }

  // Check file type
  const contentType = response.headers.get('content-type');
  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
  
  if (!contentType || !allowedTypes.includes(contentType)) {
    throw new ValidationError('Logo must be PNG, JPG, or SVG format');
  }
}

function validateTimezone(timezone: string): void {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new ValidationError(`Invalid timezone: ${timezone}`);
  }
}

function validateCurrency(currency: string): void {
  const allowedCurrencies = ['PEN', 'USD', 'EUR'];
  if (!allowedCurrencies.includes(currency)) {
    throw new ValidationError(`Unsupported currency: ${currency}`);
  }
}
```


### 6. Tenant Analytics and Monitoring

Tracks tenant health, usage patterns, and system metrics.

#### Analytics Schema

```sql
CREATE TABLE tenant_analytics (
    tenant_id UUID NOT NULL,
    date DATE NOT NULL,
    active_terminals INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_events INTEGER DEFAULT 0,
    total_revenue_cents BIGINT DEFAULT 0,
    avg_order_value_cents INTEGER DEFAULT 0,
    peak_orders_per_hour INTEGER DEFAULT 0,
    sync_errors INTEGER DEFAULT 0,
    api_errors INTEGER DEFAULT 0,
    storage_mb INTEGER DEFAULT 0,
    PRIMARY KEY (tenant_id, date)
);

CREATE TABLE tenant_health_checks (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    check_type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    details JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_checks_tenant ON tenant_health_checks(tenant_id, checked_at DESC);
```

#### Analytics Service

```typescript
// src/core/tenant/analytics.ts

export interface TenantMetrics {
  tenant_id: string;
  date: string;
  active_terminals: number;
  total_orders: number;
  total_events: number;
  total_revenue_cents: number;
  avg_order_value_cents: number;
  peak_orders_per_hour: number;
  sync_errors: number;
  api_errors: number;
  storage_mb: number;
}

export async function collectDailyMetrics(tenant_id: string): Promise<TenantMetrics> {
  const today = new Date().toISOString().split('T')[0];
  
  // Collect metrics from various sources
  const [terminals, orders, events, revenue, errors, storage] = await Promise.all([
    countActiveTerminals(tenant_id, today),
    countOrders(tenant_id, today),
    countEvents(tenant_id, today),
    calculateRevenue(tenant_id, today),
    countErrors(tenant_id, today),
    calculateStorage(tenant_id),
  ]);

  const metrics: TenantMetrics = {
    tenant_id,
    date: today,
    active_terminals: terminals,
    total_orders: orders.count,
    total_events: events,
    total_revenue_cents: revenue.total,
    avg_order_value_cents: revenue.average,
    peak_orders_per_hour: orders.peak,
    sync_errors: errors.sync,
    api_errors: errors.api,
    storage_mb: storage,
  };

  // Store metrics
  await prisma.tenant_analytics.upsert({
    where: {
      tenant_id_date: { tenant_id, date: today },
    },
    create: metrics,
    update: metrics,
  });

  return metrics;
}

export interface TenantHealthStatus {
  tenant_id: string;
  overall_status: 'healthy' | 'warning' | 'critical';
  checks: HealthCheck[];
  last_checked: Date;
}

export interface HealthCheck {
  type: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
}

export async function checkTenantHealth(tenant_id: string): Promise<TenantHealthStatus> {
  const checks: HealthCheck[] = [];

  // Check 1: Active terminals
  const terminals = await countActiveTerminals(tenant_id, new Date().toISOString().split('T')[0]);
  checks.push({
    type: 'active_terminals',
    status: terminals > 0 ? 'pass' : 'warn',
    message: `${terminals} active terminals`,
  });

  // Check 2: Recent orders
  const recentOrders = await prisma.orders.count({
    where: {
      tenant_id,
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  checks.push({
    type: 'recent_orders',
    status: recentOrders > 0 ? 'pass' : 'warn',
    message: `${recentOrders} orders in last 24h`,
  });

  // Check 3: Sync errors
  const syncErrors = await prisma.sync_conflicts.count({
    where: {
      tenant_id,
      severity: 'BLOCKING',
      resolved_at: null,
    },
  });
  checks.push({
    type: 'sync_errors',
    status: syncErrors === 0 ? 'pass' : syncErrors < 5 ? 'warn' : 'fail',
    message: `${syncErrors} unresolved sync conflicts`,
  });

  // Check 4: Storage usage
  const usage = await prisma.tenant_usage.findUnique({ where: { tenant_id } });
  const quota = await prisma.tenant_quotas.findUnique({ where: { tenant_id } });
  const storagePercent = usage && quota ? (usage.storage_mb / quota.max_storage_mb) * 100 : 0;
  checks.push({
    type: 'storage_usage',
    status: storagePercent < 80 ? 'pass' : storagePercent < 95 ? 'warn' : 'fail',
    message: `${storagePercent.toFixed(1)}% storage used`,
  });

  // Determine overall status
  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');
  const overall_status = hasFail ? 'critical' : hasWarn ? 'warning' : 'healthy';

  // Store health check results
  for (const check of checks) {
    await prisma.tenant_health_checks.create({
      data: {
        id: randomUUID(),
        tenant_id,
        check_type: check.type,
        status: check.status,
        message: check.message,
        details: check.details,
      },
    });
  }

  return {
    tenant_id,
    overall_status,
    checks,
    last_checked: new Date(),
  };
}
```


### 7. Tenant Backup and Restore

Automated backup system with point-in-time recovery capabilities.

#### Backup Schema

```sql
CREATE TABLE tenant_backups (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    backup_type TEXT NOT NULL,
    status TEXT DEFAULT 'IN_PROGRESS',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    file_size_mb INTEGER,
    file_url TEXT,
    expires_at TIMESTAMPTZ,
    encryption_key_hash TEXT,
    metadata JSONB,
    error_message TEXT
);

CREATE INDEX idx_backups_tenant ON tenant_backups(tenant_id, started_at DESC);
```

#### Backup Service

```typescript
// src/core/tenant/backup.ts

export interface BackupRequest {
  tenant_id: string;
  backup_type: 'full' | 'incremental';
  include_events?: boolean;
  include_orders?: boolean;
  include_products?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface BackupResult {
  backup_id: string;
  tenant_id: string;
  file_url: string;
  file_size_mb: number;
  expires_at: Date;
  encryption_key: string;
}

export async function createBackup(request: BackupRequest): Promise<BackupResult> {
  const backup_id = randomUUID();
  
  // Create backup record
  await prisma.tenant_backups.create({
    data: {
      id: backup_id,
      tenant_id: request.tenant_id,
      backup_type: request.backup_type,
      status: 'IN_PROGRESS',
    },
  });

  try {
    // Export tenant data
    const data = await exportTenantData(request);

    // Encrypt data
    const encryption_key = generateEncryptionKey();
    const encrypted_data = await encryptData(data, encryption_key);

    // Upload to storage
    const file_url = await uploadBackup(backup_id, encrypted_data);
    const file_size_mb = encrypted_data.length / (1024 * 1024);

    // Update backup record
    await prisma.tenant_backups.update({
      where: { id: backup_id },
      data: {
        status: 'COMPLETED',
        completed_at: new Date(),
        file_url,
        file_size_mb: Math.ceil(file_size_mb),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        encryption_key_hash: await hashKey(encryption_key),
      },
    });

    return {
      backup_id,
      tenant_id: request.tenant_id,
      file_url,
      file_size_mb: Math.ceil(file_size_mb),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      encryption_key,
    };
  } catch (error) {
    // Mark backup as failed
    await prisma.tenant_backups.update({
      where: { id: backup_id },
      data: {
        status: 'FAILED',
        error_message: error.message,
      },
    });
    throw error;
  }
}

async function exportTenantData(request: BackupRequest): Promise<any> {
  const data: any = {
    tenant_id: request.tenant_id,
    exported_at: new Date().toISOString(),
    backup_type: request.backup_type,
  };

  // Export tenant settings
  data.tenant_settings = await prisma.tenant_settings.findUnique({
    where: { tenant_id: request.tenant_id },
  });

  // Export events (if requested)
  if (request.include_events !== false) {
    const where: any = { tenant_id: request.tenant_id };
    if (request.date_from) where.occurred_at = { gte: new Date(request.date_from) };
    if (request.date_to) where.occurred_at = { ...where.occurred_at, lte: new Date(request.date_to) };

    data.events = await prisma.events.findMany({ where });
  }

  // Export orders (if requested)
  if (request.include_orders !== false) {
    const where: any = { tenant_id: request.tenant_id };
    if (request.date_from) where.created_at = { gte: new Date(request.date_from) };
    if (request.date_to) where.created_at = { ...where.created_at, lte: new Date(request.date_to) };

    data.orders = await prisma.orders.findMany({ where });
  }

  // Export products (if requested)
  if (request.include_products !== false) {
    data.products = await prisma.products.findMany({
      where: { tenant_id: request.tenant_id },
    });
  }

  // Export other tenant data
  data.employees = await prisma.employees.findMany({
    where: { tenant_id: request.tenant_id },
  });

  data.stations = await prisma.stations.findMany({
    where: { tenant_id: request.tenant_id },
  });

  data.terminals = await prisma.terminals.findMany({
    where: { tenant_id: request.tenant_id },
  });

  return data;
}

export interface RestoreRequest {
  backup_id: string;
  encryption_key: string;
  target_tenant_id?: string; // Optional: restore to different tenant
  validate_only?: boolean;
}

export async function restoreBackup(request: RestoreRequest): Promise<void> {
  // Fetch backup record
  const backup = await prisma.tenant_backups.findUnique({
    where: { id: request.backup_id },
  });

  if (!backup || backup.status !== 'COMPLETED') {
    throw new Error('Backup not found or not completed');
  }

  // Download and decrypt backup
  const encrypted_data = await downloadBackup(backup.file_url);
  const data = await decryptData(encrypted_data, request.encryption_key);

  // Validate data integrity
  await validateBackupData(data);

  if (request.validate_only) {
    return; // Only validation requested
  }

  const target_tenant_id = request.target_tenant_id || backup.tenant_id;

  // Restore data in transaction
  await prisma.$transaction(async (tx) => {
    // Restore tenant settings
    await tx.tenant_settings.upsert({
      where: { tenant_id: target_tenant_id },
      create: { ...data.tenant_settings, tenant_id: target_tenant_id },
      update: data.tenant_settings,
    });

    // Restore events
    if (data.events) {
      for (const event of data.events) {
        await tx.events.upsert({
          where: { id: event.id },
          create: { ...event, tenant_id: target_tenant_id },
          update: event,
        });
      }
    }

    // Restore orders
    if (data.orders) {
      for (const order of data.orders) {
        await tx.orders.upsert({
          where: { id: order.id },
          create: { ...order, tenant_id: target_tenant_id },
          update: order,
        });
      }
    }

    // Restore other data...
  });

  // Log restore operation
  await logRestoreOperation(backup.id, target_tenant_id);
}
```


### 8. Cross-Tenant Administration

Provides system administrators with controlled access to multiple tenants for support and monitoring.

#### Cross-Tenant Admin Schema

```sql
CREATE TABLE cross_tenant_admins (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL,
    granted_by UUID NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB NOT NULL
);

CREATE TABLE cross_tenant_audit_log (
    id UUID PRIMARY KEY,
    admin_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cross_tenant_audit ON cross_tenant_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_cross_tenant_audit_tenant ON cross_tenant_audit_log(tenant_id, created_at DESC);
```

#### Cross-Tenant Admin Interface

```typescript
// src/core/tenant/cross-tenant-admin.ts

export interface CrossTenantPermissions {
  can_view_configuration: boolean;
  can_view_events: boolean;
  can_view_orders: boolean;
  can_view_analytics: boolean;
  can_modify_configuration: boolean;
  can_modify_quotas: boolean;
  can_deactivate_tenant: boolean;
}

export interface CrossTenantAdminContext extends TenantContext {
  is_cross_tenant_admin: true;
  admin_id: string;
  permissions: CrossTenantPermissions;
  target_tenant_id: string; // Tenant being accessed
}

export async function withCrossTenantAdmin<T>(
  handler: (context: CrossTenantAdminContext) => Promise<T>
): Promise<T> {
  const token = await getToken();
  
  if (!token.is_cross_tenant_admin) {
    throw new UnauthorizedError('Cross-tenant admin access required');
  }

  // Verify admin is active
  const admin = await prisma.cross_tenant_admins.findFirst({
    where: {
      employee_id: token.employee_id,
      is_active: true,
      expires_at: { gt: new Date() },
    },
  });

  if (!admin) {
    throw new UnauthorizedError('Cross-tenant admin access expired or revoked');
  }

  // Get target tenant from request
  const target_tenant_id = getTargetTenantId();

  const context: CrossTenantAdminContext = {
    tenant_id: token.tenant_id, // Admin's home tenant
    is_cross_tenant_admin: true,
    admin_id: admin.id,
    permissions: admin.permissions as CrossTenantPermissions,
    target_tenant_id,
  };

  // Set PostgreSQL session variables
  await prisma.$executeRaw`
    SELECT set_config('app.current_tenant_id', ${target_tenant_id}, true);
  `;
  
  await prisma.$executeRaw`
    SELECT set_config('app.is_cross_tenant_admin', 'true', true);
  `;

  // Execute handler with audit logging
  try {
    const result = await handler(context);
    
    // Log successful access
    await logCrossTenantAccess(context, 'SUCCESS');
    
    return result;
  } catch (error) {
    // Log failed access
    await logCrossTenantAccess(context, 'FAILED', error);
    throw error;
  }
}

async function logCrossTenantAccess(
  context: CrossTenantAdminContext,
  status: string,
  error?: any
): Promise<void> {
  await prisma.cross_tenant_audit_log.create({
    data: {
      id: randomUUID(),
      admin_id: context.admin_id,
      tenant_id: context.target_tenant_id,
      action: status,
      details: {
        status,
        error: error?.message,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

export async function requireCrossTenantPermission(
  context: CrossTenantAdminContext,
  permission: keyof CrossTenantPermissions
): Promise<void> {
  if (!context.permissions[permission]) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}

// Usage in API route
export async function GET(request: NextRequest) {
  return withCrossTenantAdmin(async (context) => {
    await requireCrossTenantPermission(context, 'can_view_orders');

    // Access target tenant's orders
    const orders = await prisma.orders.findMany({
      where: {
        tenant_id: context.target_tenant_id,
        order_status: 'OPEN',
      },
      take: 100,
    });

    return NextResponse.json(orders);
  });
}
```


### 9. Tenant Migration and Export

Enables tenants to export their data for migration, backup, or compliance purposes.

#### Export Service

```typescript
// src/core/tenant/export.ts

export interface ExportRequest {
  tenant_id: string;
  format: 'json' | 'sql';
  include_events: boolean;
  include_orders: boolean;
  include_products: boolean;
  include_employees: boolean;
  include_customers: boolean;
  date_from?: string;
  date_to?: string;
}

export interface ExportResult {
  export_id: string;
  tenant_id: string;
  file_url: string;
  file_size_mb: number;
  expires_at: Date;
  encryption_key: string;
  checksum: string;
}

export async function exportTenantData(request: ExportRequest): Promise<ExportResult> {
  const export_id = randomUUID();

  // Validate request
  await validateExportRequest(request);

  // Collect data
  const data = await collectExportData(request);

  // Validate completeness
  await validateExportCompleteness(data, request);

  // Format data
  const formatted = request.format === 'json' 
    ? JSON.stringify(data, null, 2)
    : await formatAsSQL(data);

  // Calculate checksum
  const checksum = await calculateChecksum(formatted);

  // Encrypt data
  const encryption_key = generateEncryptionKey();
  const encrypted = await encryptData(formatted, encryption_key);

  // Upload to storage
  const file_url = await uploadExport(export_id, encrypted);
  const file_size_mb = encrypted.length / (1024 * 1024);

  // Log export operation
  await logExportOperation(export_id, request);

  return {
    export_id,
    tenant_id: request.tenant_id,
    file_url,
    file_size_mb: Math.ceil(file_size_mb),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    encryption_key,
    checksum,
  };
}

async function collectExportData(request: ExportRequest): Promise<any> {
  const data: any = {
    export_metadata: {
      export_id: randomUUID(),
      tenant_id: request.tenant_id,
      exported_at: new Date().toISOString(),
      format: request.format,
      version: '1.0',
    },
  };

  // Export tenant settings
  data.tenant_settings = await prisma.tenant_settings.findUnique({
    where: { tenant_id: request.tenant_id },
  });

  // Export catalog
  data.catalog_meta = await prisma.catalog_meta.findUnique({
    where: { tenant_id: request.tenant_id },
  });

  // Export events (if requested)
  if (request.include_events) {
    const where: any = { tenant_id: request.tenant_id };
    if (request.date_from) where.occurred_at = { gte: new Date(request.date_from) };
    if (request.date_to) where.occurred_at = { ...where.occurred_at, lte: new Date(request.date_to) };

    data.events = await prisma.events.findMany({
      where,
      orderBy: { occurred_at: 'asc' },
    });
  }

  // Export orders (if requested)
  if (request.include_orders) {
    const where: any = { tenant_id: request.tenant_id };
    if (request.date_from) where.created_at = { gte: new Date(request.date_from) };
    if (request.date_to) where.created_at = { ...where.created_at, lte: new Date(request.date_to) };

    data.orders = await prisma.orders.findMany({
      where,
      include: {
        invoices: true,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  // Export products (if requested)
  if (request.include_products) {
    data.products = await prisma.products.findMany({
      where: { tenant_id: request.tenant_id, is_active: true },
    });
  }

  // Export employees (if requested)
  if (request.include_employees) {
    data.employees = await prisma.employees.findMany({
      where: { tenant_id: request.tenant_id },
      select: {
        id: true,
        tenant_id: true,
        name: true,
        role: true,
        is_active: true,
        created_at: true,
        // Exclude pin_hash for security
      },
    });
  }

  // Export customers (if requested)
  if (request.include_customers) {
    data.customers = await prisma.customers.findMany({
      where: { tenant_id: request.tenant_id },
    });
  }

  // Export stations
  data.stations = await prisma.stations.findMany({
    where: { tenant_id: request.tenant_id },
  });

  // Export promotions
  data.promotions = await prisma.promotions.findMany({
    where: { tenant_id: request.tenant_id },
  });

  return data;
}

async function validateExportCompleteness(data: any, request: ExportRequest): Promise<void> {
  // Verify all requested data is present
  if (request.include_events && !data.events) {
    throw new Error('Events export failed');
  }

  if (request.include_orders && !data.orders) {
    throw new Error('Orders export failed');
  }

  if (request.include_products && !data.products) {
    throw new Error('Products export failed');
  }

  // Verify data integrity
  if (data.events && data.orders) {
    // Check that all order events reference existing orders
    const orderIds = new Set(data.orders.map((o: any) => o.id));
    const orphanEvents = data.events.filter(
      (e: any) => e.entity_type === 'order' && !orderIds.has(e.entity_id)
    );

    if (orphanEvents.length > 0) {
      console.warn(`Found ${orphanEvents.length} orphan events`);
    }
  }
}

async function formatAsSQL(data: any): Promise<string> {
  let sql = '-- PARK POS Tenant Export\n';
  sql += `-- Tenant ID: ${data.export_metadata.tenant_id}\n`;
  sql += `-- Exported: ${data.export_metadata.exported_at}\n\n`;

  // Generate INSERT statements for each table
  for (const [table, records] of Object.entries(data)) {
    if (table === 'export_metadata' || !Array.isArray(records)) continue;

    sql += `-- Table: ${table}\n`;
    for (const record of records as any[]) {
      const columns = Object.keys(record).join(', ');
      const values = Object.values(record)
        .map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v)
        .join(', ');
      sql += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
    }
    sql += '\n';
  }

  return sql;
}
```


### 10. Tenant Isolation in IndexedDB

Ensures tenant data isolation in offline-first local storage.

#### IndexedDB Tenant Isolation

```typescript
// src/core/sync/indexeddb-tenant.ts

export interface TenantDatabaseConfig {
  tenant_id: string;
  database_name: string;
  encryption_enabled: boolean;
}

export function getTenantDatabaseName(tenant_id: string): string {
  // Create tenant-specific database name
  return `parkpos_${tenant_id.replace(/-/g, '_')}`;
}

export async function initializeTenantDatabase(
  tenant_id: string
): Promise<Dexie> {
  const dbName = getTenantDatabaseName(tenant_id);

  const db = new Dexie(dbName);

  db.version(1).stores({
    products_cache: 'id, sku, category, station',
    orders_cache_today: 'id, order_number, order_status, created_at',
    outbox_events: '++id, event_id, published, created_at',
    sync_cursor: 'key',
    terminal_session: 'key',
  });

  // Validate tenant_id on all operations
  db.use({
    stack: 'dbcore',
    name: 'TenantValidation',
    create(downlevelDatabase) {
      return {
        ...downlevelDatabase,
        table(tableName) {
          const downlevelTable = downlevelDatabase.table(tableName);
          return {
            ...downlevelTable,
            mutate(req) {
              // Validate tenant_id on all mutations
              if (req.type === 'add' || req.type === 'put') {
                for (const value of req.values || []) {
                  if (value.tenant_id && value.tenant_id !== tenant_id) {
                    throw new Error('Cross-tenant data access denied');
                  }
                }
              }
              return downlevelTable.mutate(req);
            },
          };
        },
      };
    },
  });

  return db;
}

export async function switchTenant(
  from_tenant_id: string,
  to_tenant_id: string
): Promise<void> {
  // Close current tenant database
  const currentDb = getTenantDatabaseName(from_tenant_id);
  await Dexie.delete(currentDb);

  // Initialize new tenant database
  await initializeTenantDatabase(to_tenant_id);

  // Clear session storage
  sessionStorage.clear();

  // Update tenant context in memory
  updateTenantContext(to_tenant_id);
}

export async function purgeTenantData(tenant_id: string): Promise<void> {
  const dbName = getTenantDatabaseName(tenant_id);
  
  // Delete IndexedDB database
  await Dexie.delete(dbName);

  // Clear localStorage for tenant
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`tenant_${tenant_id}_`)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  // Clear sessionStorage
  sessionStorage.clear();
}

export async function encryptTenantData(
  tenant_id: string,
  data: any
): Promise<string> {
  // Get tenant-specific encryption key
  const key = await getTenantEncryptionKey(tenant_id);

  // Encrypt data using Web Crypto API
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

export async function decryptTenantData(
  tenant_id: string,
  encrypted: string
): Promise<any> {
  // Get tenant-specific encryption key
  const key = await getTenantEncryptionKey(tenant_id);

  // Decode base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Decode and parse
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

async function getTenantEncryptionKey(tenant_id: string): Promise<CryptoKey> {
  // Derive key from tenant_id and device secret
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(tenant_id),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('parkpos-tenant-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```


## Data Models

### New Tables

#### tenant_quotas
```sql
CREATE TABLE tenant_quotas (
    tenant_id UUID PRIMARY KEY,
    max_terminals INTEGER DEFAULT 20,
    max_employees INTEGER DEFAULT 50,
    max_products INTEGER DEFAULT 500,
    max_daily_orders INTEGER DEFAULT 1000,
    max_storage_mb INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### tenant_usage
```sql
CREATE TABLE tenant_usage (
    tenant_id UUID PRIMARY KEY,
    current_terminals INTEGER DEFAULT 0,
    current_employees INTEGER DEFAULT 0,
    current_products INTEGER DEFAULT 0,
    daily_orders INTEGER DEFAULT 0,
    storage_mb INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### tenant_analytics
```sql
CREATE TABLE tenant_analytics (
    tenant_id UUID NOT NULL,
    date DATE NOT NULL,
    active_terminals INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_events INTEGER DEFAULT 0,
    total_revenue_cents BIGINT DEFAULT 0,
    avg_order_value_cents INTEGER DEFAULT 0,
    peak_orders_per_hour INTEGER DEFAULT 0,
    sync_errors INTEGER DEFAULT 0,
    api_errors INTEGER DEFAULT 0,
    storage_mb INTEGER DEFAULT 0,
    PRIMARY KEY (tenant_id, date)
);
```

#### tenant_health_checks
```sql
CREATE TABLE tenant_health_checks (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    check_type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    details JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_checks_tenant ON tenant_health_checks(tenant_id, checked_at DESC);
```

#### tenant_backups
```sql
CREATE TABLE tenant_backups (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    backup_type TEXT NOT NULL,
    status TEXT DEFAULT 'IN_PROGRESS',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    file_size_mb INTEGER,
    file_url TEXT,
    expires_at TIMESTAMPTZ,
    encryption_key_hash TEXT,
    metadata JSONB,
    error_message TEXT
);

CREATE INDEX idx_backups_tenant ON tenant_backups(tenant_id, started_at DESC);
```

#### cross_tenant_admins
```sql
CREATE TABLE cross_tenant_admins (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL,
    granted_by UUID NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB NOT NULL
);
```

#### cross_tenant_audit_log
```sql
CREATE TABLE cross_tenant_audit_log (
    id UUID PRIMARY KEY,
    admin_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cross_tenant_audit ON cross_tenant_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_cross_tenant_audit_tenant ON cross_tenant_audit_log(tenant_id, created_at DESC);
```

### Modified Tables

All existing tenant-scoped tables require RLS policies. No schema changes needed, only policy additions.


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: RLS Enforces Tenant Isolation

*For any* database query executed with a tenant context, all returned results should only contain rows where tenant_id matches the current tenant context, even if the application code attempts to query other tenants' data.

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: Cross-Tenant Access Attempts Are Blocked

*For any* authenticated user attempting to access data with a tenant_id different from their authenticated tenant, the system should reject the request before returning any data.

**Validates: Requirements 1.3, 2.3**

### Property 3: RLS Violations Are Logged

*For any* RLS policy violation attempt, the system should create an audit log entry containing the tenant_id, attempted action, and timestamp.

**Validates: Requirements 1.6**

### Property 4: Tenant Context Extraction From JWT

*For any* valid JWT token containing a tenant_id claim, the middleware should successfully extract and validate the tenant_id before allowing the request to proceed.

**Validates: Requirements 2.1**

### Property 5: API Requests Include Tenant Context

*For any* API request that passes authentication, the tenant_id should be logged in the request audit trail.

**Validates: Requirements 2.5**

### Property 6: Prisma Queries Are Tenant-Scoped

*For any* Prisma query executed within a tenant context, the results should only include records belonging to the current tenant.

**Validates: Requirements 2.6**

### Property 7: Tenant IDs Are Unique

*For any* two tenants provisioned by the system, their tenant_ids should be different.

**Validates: Requirements 3.1**

### Property 8: Provisioning Is Atomic

*For any* tenant provisioning operation that fails, no partial tenant data (settings, employees, stations, etc.) should remain in the database.

**Validates: Requirements 3.8**

### Property 9: Quota Enforcement Prevents Overuse

*For any* tenant attempting to create a resource (terminal, employee, product, order) when their quota is already at the limit, the system should reject the creation with a quota exceeded error.

**Validates: Requirements 5.2, 5.3**

### Property 10: Resource Usage Tracking Is Accurate

*For any* sequence of resource creation and deletion operations, the tenant_usage counts should accurately reflect the current number of resources.

**Validates: Requirements 5.4**

### Property 11: Event Ingestion Validates Tenant

*For any* event submitted for ingestion, if the event's tenant_id does not match the authenticated tenant, the system should reject the event.

**Validates: Requirements 11.1**

### Property 12: Event Streams Are Tenant-Filtered

*For any* SSE event stream subscription, the client should only receive events where tenant_id matches their authenticated tenant.

**Validates: Requirements 11.2**

### Property 13: Projection Rebuild Is Tenant-Scoped

*For any* projection rebuild operation for a specific tenant, only events belonging to that tenant should be processed.

**Validates: Requirements 11.3**

### Property 14: Cross-Tenant Event References Are Rejected

*For any* event payload containing references to entities (order_id, product_id, etc.), all referenced entities should belong to the same tenant as the event.

**Validates: Requirements 11.4, 11.5**

### Property 15: Conflict Resolution Is Tenant-Scoped

*For any* sync conflict detected and resolved, the resolution should only affect data within the conflict's tenant and not impact other tenants.

**Validates: Requirements 11.6**

### Property 16: Login Validates Tenant Membership

*For any* login attempt, if the employee_id does not belong to the specified tenant_id, the system should reject the login.

**Validates: Requirements 12.1**

### Property 17: Token Tenant Mismatch Is Rejected

*For any* API request using a JWT token, if the token's tenant_id does not match the requested resource's tenant_id, the system should reject the request.

**Validates: Requirements 12.3, 12.4**

### Property 18: Tenant-Specific PIN Policies Are Enforced

*For any* tenant with custom PIN policies (length, complexity), all PIN validations for that tenant's employees should enforce those specific policies.

**Validates: Requirements 12.5**

### Property 19: IndexedDB Database Names Are Tenant-Specific

*For any* two different tenants, their IndexedDB database names should be different and include the tenant_id.

**Validates: Requirements 15.1**

### Property 20: Local Storage Isolation Prevents Cross-Tenant Access

*For any* IndexedDB operation attempted with a tenant_id that doesn't match the current session's tenant, the operation should be rejected.

**Validates: Requirements 15.2, 15.4**

### Property 21: Tenant Switch Clears Previous Data

*For any* tenant switch operation, all cached data from the previous tenant should be removed from IndexedDB and localStorage before initializing the new tenant's data.

**Validates: Requirements 15.3**


## Error Handling

### Error Types

#### TenantIsolationError
Thrown when a cross-tenant access attempt is detected.

```typescript
export class TenantIsolationError extends Error {
  constructor(
    public attempted_tenant_id: string,
    public authenticated_tenant_id: string,
    public resource_type: string
  ) {
    super(
      `Tenant isolation violation: attempted to access ${resource_type} ` +
      `for tenant ${attempted_tenant_id} while authenticated as ${authenticated_tenant_id}`
    );
    this.name = 'TenantIsolationError';
  }
}
```

#### QuotaExceededError
Thrown when a tenant attempts to exceed their resource quota.

```typescript
export class QuotaExceededError extends Error {
  constructor(
    public tenant_id: string,
    public resource: string,
    public current: number,
    public limit: number
  ) {
    super(
      `Quota exceeded for ${resource}: ${current}/${limit} (tenant: ${tenant_id})`
    );
    this.name = 'QuotaExceededError';
  }
}
```

#### TenantProvisioningError
Thrown when tenant provisioning fails.

```typescript
export class TenantProvisioningError extends Error {
  constructor(
    public step: string,
    public cause: Error
  ) {
    super(`Tenant provisioning failed at step: ${step}. Cause: ${cause.message}`);
    this.name = 'TenantProvisioningError';
  }
}
```

#### TenantConfigurationError
Thrown when tenant configuration validation fails.

```typescript
export class TenantConfigurationError extends Error {
  constructor(
    public field: string,
    public value: any,
    public reason: string
  ) {
    super(`Invalid tenant configuration for ${field}: ${reason}`);
    this.name = 'TenantConfigurationError';
  }
}
```

### Error Recovery Strategies

#### RLS Policy Violations
- Log violation with full context (tenant_id, query, user)
- Return 403 Forbidden to client
- Alert security team if repeated violations from same user
- Do not expose internal database structure in error message

#### Quota Exceeded
- Return 429 Too Many Requests with quota details
- Include Retry-After header if quota resets (daily orders)
- Provide upgrade path in error response
- Log quota exceeded events for billing/analytics

#### Provisioning Failures
- Rollback all database changes atomically
- Log detailed error for debugging
- Return generic error to client (don't expose internal details)
- Retry provisioning with exponential backoff if transient failure

#### Configuration Validation Failures
- Return 400 Bad Request with specific field errors
- Preserve existing configuration (don't partially update)
- Log validation failures for monitoring
- Provide clear guidance on valid values

### Monitoring and Alerting

#### Critical Alerts
- RLS policy violations (potential security breach)
- Provisioning failures (impacts customer onboarding)
- Cross-tenant data leakage detected
- Quota enforcement failures

#### Warning Alerts
- Tenant approaching quota limits (80% threshold)
- Unusual tenant activity patterns
- Backup failures
- Health check failures

#### Metrics to Track
- Tenant isolation violations per hour
- Quota exceeded errors per tenant
- Provisioning success rate
- Average provisioning time
- Backup success rate
- Cross-tenant admin access frequency


## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit tests for specific scenarios with property-based tests for comprehensive coverage of tenant isolation and multi-tenancy behaviors.

#### Unit Tests
Unit tests focus on:
- Specific tenant provisioning scenarios
- Configuration validation edge cases
- Error handling for quota exceeded
- Backup and restore specific examples
- Cross-tenant admin permission checks

#### Property-Based Tests
Property tests focus on:
- Universal tenant isolation properties
- Quota enforcement across all resource types
- Event stream filtering for all tenants
- IndexedDB isolation across tenant switches
- RLS policy enforcement for all queries

### Property Test Configuration

All property-based tests should:
- Run minimum 100 iterations per test (due to randomization)
- Generate random tenant_ids, user_ids, and resource data
- Test both valid and invalid scenarios
- Verify isolation properties hold across all inputs

### Test Organization

```
tests/
├── unit/
│   ├── tenant-provisioning.test.ts
│   ├── tenant-configuration.test.ts
│   ├── quota-management.test.ts
│   ├── backup-restore.test.ts
│   └── cross-tenant-admin.test.ts
├── property/
│   ├── rls-isolation.property.test.ts
│   ├── tenant-context.property.test.ts
│   ├── quota-enforcement.property.test.ts
│   ├── event-isolation.property.test.ts
│   └── indexeddb-isolation.property.test.ts
└── integration/
    ├── end-to-end-provisioning.test.ts
    ├── multi-tenant-workflow.test.ts
    └── cross-tenant-admin-workflow.test.ts
```

### Property Test Examples

#### Property Test 1: RLS Enforces Tenant Isolation
```typescript
// Feature: multi-tenant-improvements, Property 1: RLS Enforces Tenant Isolation
test('Property 1: RLS enforces tenant isolation', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uuid(), // tenant_id_1
      fc.uuid(), // tenant_id_2
      fc.array(fc.record({
        id: fc.uuid(),
        name: fc.string(),
      })), // orders for tenant_1
      async (tenant_id_1, tenant_id_2, orders) => {
        fc.pre(tenant_id_1 !== tenant_id_2);

        // Setup: Create orders for tenant_1
        await setupTenantOrders(tenant_id_1, orders);

        // Test: Query as tenant_2 should return empty
        const results = await queryOrdersAsTenant(tenant_id_2);

        expect(results).toHaveLength(0);
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property Test 2: Quota Enforcement Prevents Overuse
```typescript
// Feature: multi-tenant-improvements, Property 9: Quota enforcement prevents overuse
test('Property 9: Quota enforcement prevents overuse', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uuid(), // tenant_id
      fc.integer({ min: 1, max: 10 }), // quota limit
      fc.integer({ min: 11, max: 20 }), // attempts (exceeds quota)
      async (tenant_id, quota_limit, attempts) => {
        // Setup: Set quota
        await setTenantQuota(tenant_id, 'products', quota_limit);

        // Test: Create resources up to quota
        for (let i = 0; i < quota_limit; i++) {
          await createProduct(tenant_id, `product-${i}`);
        }

        // Verify: Next creation should fail
        await expect(
          createProduct(tenant_id, 'product-overflow')
        ).rejects.toThrow(QuotaExceededError);
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property Test 3: Event Streams Are Tenant-Filtered
```typescript
// Feature: multi-tenant-improvements, Property 12: Event streams are tenant-filtered
test('Property 12: Event streams are tenant-filtered', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uuid(), // tenant_id_1
      fc.uuid(), // tenant_id_2
      fc.array(fc.record({
        type: fc.constantFrom('ORDER_CREATED', 'ORDER_UPDATED'),
        payload: fc.object(),
      })), // events for tenant_1
      fc.array(fc.record({
        type: fc.constantFrom('ORDER_CREATED', 'ORDER_UPDATED'),
        payload: fc.object(),
      })), // events for tenant_2
      async (tenant_id_1, tenant_id_2, events_1, events_2) => {
        fc.pre(tenant_id_1 !== tenant_id_2);

        // Setup: Publish events for both tenants
        await publishEvents(tenant_id_1, events_1);
        await publishEvents(tenant_id_2, events_2);

        // Test: Subscribe as tenant_1
        const received = await subscribeAndCollectEvents(tenant_id_1, 1000);

        // Verify: Only tenant_1 events received
        expect(received.every(e => e.tenant_id === tenant_id_1)).toBe(true);
        expect(received.some(e => e.tenant_id === tenant_id_2)).toBe(false);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Test Scenarios

#### Scenario 1: Complete Tenant Lifecycle
1. Provision new tenant
2. Configure tenant settings
3. Create employees and terminals
4. Create products and orders
5. Verify all data is isolated
6. Export tenant data
7. Deactivate tenant
8. Verify data is inaccessible

#### Scenario 2: Cross-Tenant Admin Workflow
1. Create cross-tenant admin
2. Grant specific permissions
3. Access multiple tenants
4. Verify audit logs
5. Revoke permissions
6. Verify access is denied

#### Scenario 3: Quota Management Workflow
1. Set tenant quotas
2. Create resources up to quota
3. Verify quota enforcement
4. Increase quota
5. Verify new resources can be created
6. Monitor quota usage metrics

### Test Data Generation

Use fast-check library for property-based testing with custom generators:

```typescript
// Custom generators for tenant testing
const tenantIdGen = fc.uuid();
const employeeGen = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  role: fc.constantFrom('ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'),
  pin: fc.string({ minLength: 4, maxLength: 6 }),
});

const productGen = fc.record({
  id: fc.uuid(),
  sku: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  price_cents: fc.integer({ min: 100, max: 100000 }),
  category: fc.constantFrom('POLLO', 'BEBIDAS', 'GUARNICIONES', 'POSTRES'),
  station: fc.constantFrom('PARRILLA', 'COCINA', 'BAR', 'EMPAQUE'),
});

const orderGen = fc.record({
  id: fc.uuid(),
  order_number: fc.integer({ min: 1, max: 999999 }),
  order_type: fc.constantFrom('DINE_IN', 'TAKEOUT', 'DELIVERY'),
  items: fc.array(productGen, { minLength: 1, maxLength: 10 }),
});
```

### Performance Testing

#### Load Testing Scenarios
- 100 concurrent tenants with active terminals
- 1000 orders per minute across all tenants
- Event stream with 10,000 events per second
- RLS policy overhead measurement

#### Benchmarks
- Tenant provisioning: < 5 seconds
- RLS query overhead: < 10ms
- Quota check: < 5ms
- Event filtering: < 1ms per event
- IndexedDB tenant switch: < 500ms

