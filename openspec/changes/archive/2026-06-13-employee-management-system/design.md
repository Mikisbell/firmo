# Design: Employee Management System (RRHH) - Documentación Retrospectiva

> Generado desde implementación existente | Proyecto: park-pos

---

## 1. Arquitectura General

### Capas del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  /admin/hr/* pages + /pos employee self-service             │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   API Layer (48 endpoints)                   │
│  /api/hr/* - Authentication, Rate Limiting, Validation      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                Service Layer (8 services)                    │
│  Business logic, Event emission, Audit logging              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Data Layer (Prisma)                         │
│  PostgreSQL + Event Sourcing + Audit Logs                   │
└─────────────────────────────────────────────────────────────┘
```

### Event Sourcing Integration

```
API Request
    │
    ▼
Service Method
    │
    ├──> Prisma Transaction (DB write)
    │
    └──> Event Emission
            │
            ▼
         events table
            │
            ├──> Dexie (offline sync)
            │
            └──> Event Reducers (state reconstruction)
```

---

## 2. Data Model

### Core Entities

```typescript
// Employee (Central entity)
employees {
  id: UUID (PK)
  tenant_id: UUID (FK) ← ALWAYS from JWT
  name: string
  dni: string?
  role: EmployeeRole (11 options)
  pin_hash: string (SHA-256)
  is_active: boolean (soft delete)
  
  // Labor info
  hire_date: Date
  position: string
  base_salary_cents: Int ← Money in cents
  contract_type: ContractType
  work_schedule_type: WorkScheduleType
  location_id: UUID?
  
  // Config
  commission_rate: Decimal?
  pension_system: PensionSystem?
  has_health_insurance: boolean
}

// Attendance
attendance_records {
  id: UUID (PK)
  tenant_id: UUID (FK)
  employee_id: UUID (FK)
  schedule_id: UUID? (FK)
  date: Date (business_date)
  clock_in: Timestamp
  clock_out: Timestamp?
  breaks: JSON[] (Break[])
  
  // Calculated fields
  scheduled_minutes: Int
  worked_minutes: Int
  overtime_minutes: Int
  late_minutes: Int
  early_leave_minutes: Int
  
  status: AttendanceStatus
  notes: string?
}

// Payroll
payroll_records {
  id: UUID (PK)
  tenant_id: UUID (FK)
  employee_id: UUID (FK)
  period_month: string (YYYY-MM)
  business_date_start: Date
  business_date_end: Date
  
  // Salary components (all in cents)
  base_salary_cents: Int
  commission_cents: Int
  tips_cents: Int
  overtime_cents: Int
  bonuses_cents: Int
  
  // Deductions (all in cents)
  advances_cents: Int
  absences_cents: Int
  other_deductions_cents: Int
  essalud_cents: Int
  pension_cents: Int
  
  // Totals (all in cents)
  gross_salary_cents: Int
  net_salary_cents: Int
  
  // Metadata
  days_worked: Int
  hours_worked: Int
  overtime_hours: Int
  absences_count: Int
  
  payslip_url: string?
  calculated_by: UUID (FK)
  calculated_at: Timestamp
  paid_at: Timestamp?
}

// Schedule Templates
schedule_templates {
  id: UUID (PK)
  tenant_id: UUID (FK)
  location_id: UUID (FK)
  name: string
  schedule_type: ScheduleType (FIXED | ROTATING)
  days_of_week: Int[] (1=Monday, 7=Sunday)
  start_time: string (HH:mm)
  end_time: string (HH:mm)
  break_minutes: Int
  is_active: boolean
}

// Leave Requests
leave_requests {
  id: UUID (PK)
  tenant_id: UUID (FK)
  employee_id: UUID (FK)
  leave_type: LeaveType
  start_date: Date
  end_date: Date
  days_requested: Int
  reason: string?
  with_pay: boolean
  status: RequestStatus
  approved_by: UUID? (FK)
  approved_at: Timestamp?
  rejection_reason: string?
  certificate_url: string?
}

// Advances
advances {
  id: UUID (PK)
  tenant_id: UUID (FK)
  employee_id: UUID (FK)
  amount_cents: Int ← Money in cents
  reason: string
  status: AdvanceStatus
  approved_by: UUID? (FK)
  approved_at: Timestamp?
  paid_at: Timestamp?
  deducted_from_payroll: UUID? (FK)
  rejection_reason: string?
}

// Evaluations
evaluations {
  id: UUID (PK)
  tenant_id: UUID (FK)
  employee_id: UUID (FK)
  evaluator_id: UUID (FK)
  period_start: Date
  period_end: Date
  scores: JSON (Record<string, number>)
  automatic_metrics: JSON (Record<string, number>)
  comments: string?
  employee_comments: string?
  goals: JSON? (Goal[])
  status: EvaluationStatus
  completed_at: Timestamp?
}

// Training
training_records {
  id: UUID (PK)
  tenant_id: UUID (FK)
  employee_id: UUID (FK)
  training_name: string
  training_type: TrainingType
  provider: string?
  duration_hours: Int?
  completion_date: Date
  certificate_url: string?
  score: Int? (0-100)
  notes: string?
  assigned_by: UUID? (FK)
}
```

---

## 3. API Contracts

### Authentication Pattern (All Endpoints)

```typescript
// Admin endpoints
const authResult = await requireAdminAuth(request);
if (!authResult.authorized) return authResult.response;
const tenantId = authResult.user.tenantId; // ← ALWAYS from JWT

// Employee self-service endpoints
const authResult = await requirePosAuth(request);
if (!authResult.authorized) return authResult.response;
const employeeId = authResult.user.id; // ← ALWAYS from JWT
const tenantId = authResult.user.tenantId;
```

### Example: Employee CRUD

**POST /api/hr/employees**
```typescript
Request:
{
  name: string,
  role: EmployeeRole,
  pin: string, // 4-6 digits
  dni?: string,
  is_active?: boolean
}

Response 201:
{
  id: UUID,
  tenant_id: UUID,
  name: string,
  role: EmployeeRole,
  pin_hash: string, // SHA-256 hashed
  is_active: boolean,
  created_at: Timestamp
}

Response 409: { error: "PIN ya está en uso" }
Response 400: { error: "Datos inválidos", details: ZodError[] }
```

**GET /api/hr/employees**
```typescript
Query params:
  ?page=1&limit=10&is_active=true

Response 200:
{
  items: Employee[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean
  }
}
```

**PUT /api/hr/employees/[id]**
```typescript
Request:
{
  name?: string,
  role?: EmployeeRole,
  is_active?: boolean,
  pin?: string,
  dni?: string | null
}

Response 200: Employee
Response 403: { error: "Empleado no encontrado o no autorizado" }
Response 409: { error: "Este PIN ya está en uso por otro empleado" }
```

**DELETE /api/hr/employees/[id]**
```typescript
Response 204: (no content)
Response 403: { error: "Empleado no encontrado o no autorizado" }

// Soft delete: is_active = false
// Record preserved in DB
```

### Example: Attendance

**POST /api/hr/attendance**
```typescript
Request:
{
  employee_id: UUID,
  action: "CLOCK_IN" | "CLOCK_OUT",
  timestamp?: Timestamp, // defaults to now
  location_id?: UUID
}

Response 201:
{
  id: UUID,
  employee_id: UUID,
  clock_in: Timestamp,
  clock_out: Timestamp?,
  worked_minutes: number,
  overtime_minutes: number,
  late_minutes: number,
  status: AttendanceStatus
}
```

### Example: Payroll

**POST /api/hr/payroll/calculate**
```typescript
Request:
{
  period_month: string, // "2026-03"
  employee_ids?: UUID[] // optional, defaults to all active
}

Response 200:
{
  period_month: string,
  records_created: number,
  total_gross_cents: number,
  total_net_cents: number,
  employees: PayrollRecord[]
}
```

---

## 4. Service Layer Design

### Service Pattern

```typescript
export class EmployeeService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateEmployeeDTO, tenantId: string): Promise<Employee> {
    // 1. Validate
    // 2. Check business rules (e.g., PIN uniqueness)
    // 3. Execute in transaction
    return await this.prisma.$transaction(async (tx) => {
      // 3a. Create entity
      const employee = await tx.employees.create({ data });
      
      // 3b. Emit event
      await this.emitEvent(tx, 'EMPLOYEE_CREATED', employee);
      
      // 3c. Log audit
      await this.logAudit(tx, 'CREATE', 'employees', employee.id);
      
      return employee;
    });
  }

  async list(filters: EmployeeFilters, tenantId: string): Promise<Employee[]> {
    // 1. Build where clause
    // 2. Apply pagination
    // 3. Return results
  }

  // ... other methods
}
```

### Event Emission Pattern

```typescript
private async emitEvent(
  tx: PrismaTransaction,
  eventType: string,
  payload: any
): Promise<void> {
  await tx.events.create({
    data: {
      event_id: randomUUID(),
      tenant_id: this.tenantId,
      event_type: eventType,
      aggregate_type: 'HR',
      aggregate_id: payload.id,
      payload: payload,
      occurred_at: new Date(),
      // ... other envelope fields
    },
  });
}
```

---

## 5. Security Design

### Multi-Tenancy Isolation

```typescript
// ✅ CORRECT: tenant_id from JWT
const tenantId = authResult.user.tenantId;
const employees = await prisma.employees.findMany({
  where: { tenant_id: tenantId }
});

// ❌ WRONG: tenant_id from request body
const { tenant_id } = await request.json(); // NEVER DO THIS
```

### PIN Security

```typescript
// Hash function (same as seed.ts)
const SALT = 'PARK_POS_2026_';

function hashPin(pin: string): string {
  return createHash('sha256')
    .update(SALT + pin)
    .digest('hex');
}

// Storage
employees.pin_hash = hashPin(userInput.pin);

// Verification
const isValid = hashPin(inputPin) === employee.pin_hash;

// ⚠️ NEVER log PIN
logger.info({ employeeId, name }, 'Employee created'); // ✅
logger.info({ employeeId, pin }, 'Employee created'); // ❌ NEVER
```

### Audit Trail

```typescript
// Every mutation MUST log to admin_access_logs
await tx.admin_access_logs.create({
  data: {
    id: randomUUID(),
    tenant_id: tenantId,
    employee_id: authResult.user.id, // Who did it
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    resource: 'employees',
    metadata: {
      record_id: employee.id,
      changes: { name, role, is_active }
    },
    created_at: new Date()
  }
});
```

---

## 6. Money Handling

### Always in Cents (Integer)

```typescript
// ✅ CORRECT
interface PayrollRecord {
  base_salary_cents: number; // 250000 = S/. 2,500.00
  commission_cents: number;
  net_salary_cents: number;
}

// ❌ WRONG
interface PayrollRecord {
  base_salary: number; // 2500.00 ← NEVER use float
}

// Branded type for type safety
import { Centavos, asCentavos } from '@/src/core/types/shared';

const salary: Centavos = asCentavos(250000); // Validates integer
```

### Database Schema

```sql
-- ✅ CORRECT
CREATE TABLE payroll_records (
  base_salary_cents INT NOT NULL,
  net_salary_cents INT NOT NULL
);

-- ❌ WRONG
CREATE TABLE payroll_records (
  base_salary DECIMAL(10,2) NOT NULL -- NEVER use DECIMAL
);
```

---

## 7. Testing Strategy

### Unit Tests (Services)

```typescript
describe('EmployeeService', () => {
  it('should create employee with hashed PIN', async () => {
    const service = new EmployeeService(mockPrisma);
    const employee = await service.create({
      name: 'John Doe',
      role: 'WAITER',
      pin: '1234'
    }, tenantId);
    
    expect(employee.pin_hash).not.toBe('1234');
    expect(employee.pin_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256
  });
});
```

### API Tests

```typescript
describe('POST /api/hr/employees', () => {
  it('should reject duplicate PIN', async () => {
    // Setup: Create employee with PIN 1234
    await createEmployee({ pin: '1234' });
    
    // Test: Try to create another with same PIN
    const response = await POST(request, { pin: '1234' });
    
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('PIN ya está en uso');
  });
});
```

### E2E Tests

```typescript
test('HR module navigation', async ({ page }) => {
  await page.goto('/admin/hr');
  await page.click('text=Empleados');
  await expect(page).toHaveURL('/admin/hr/employees');
  
  await page.click('text=Asistencia');
  await expect(page).toHaveURL('/admin/hr/attendance');
});
```

---

## 8. Performance Considerations

### Caching Strategy

```typescript
// Cache employee list for 60 seconds
const cacheKey = generateCacheKey('employees', tenantId, page, limit);
const cached = await cache.get(cacheKey);
if (cached) return cached;

const employees = await prisma.employees.findMany({ ... });
await cache.set(cacheKey, employees, 60);
```

### Query Optimization

```typescript
// ✅ GOOD: Select only needed fields
const employees = await prisma.employees.findMany({
  select: {
    id: true,
    name: true,
    role: true,
    is_active: true
  }
});

// ❌ BAD: Select all fields
const employees = await prisma.employees.findMany();
```

### Pagination

```typescript
// Always paginate large lists
const { page, limit, skip } = parsePaginationParams(searchParams);
const employees = await prisma.employees.findMany({
  skip,
  take: limit
});
```

---

## 9. File Structure

```
src/
├── app/api/hr/                    # 48 API endpoints
│   ├── employees/
│   │   ├── route.ts               # GET, POST
│   │   ├── [id]/route.ts          # GET, PUT, DELETE
│   │   ├── [id]/emergency-contacts/
│   │   ├── [id]/documents/
│   │   └── search/route.ts
│   ├── attendance/
│   ├── payroll/
│   ├── schedules/
│   ├── leave-requests/
│   ├── advances/
│   ├── evaluations/
│   ├── training/
│   ├── me/                        # Self-service
│   └── reports/
│
├── core/
│   ├── services/                  # 8 services
│   │   ├── employee.service.ts
│   │   ├── attendance.service.ts
│   │   ├── payroll.service.ts
│   │   ├── schedule.service.ts
│   │   ├── leave-request.service.ts
│   │   ├── advance.service.ts
│   │   ├── evaluation.service.ts
│   │   └── training.service.ts
│   │
│   ├── types/
│   │   └── shared.ts              # HR types (8 IDs, 14 enums, 12 interfaces)
│   │
│   └── domain/
│       └── events.ts              # 15 HR events
│
└── app/admin/hr/                  # UI pages
    ├── page.tsx
    ├── employees/
    ├── attendance/
    ├── payroll/
    ├── schedules/
    ├── leave-requests/
    ├── advances/
    ├── evaluations/
    └── training/
```

---

## 10. Deployment Considerations

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=...
PIN_SALT=PARK_POS_2026_

# Optional
REDIS_URL=redis://...
```

### Database Migrations

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Health Checks

```typescript
// Verify HR module health
GET /api/health
{
  hr: {
    employees: "ok",
    attendance: "ok",
    payroll: "ok",
    database: "ok",
    cache: "ok"
  }
}
```

---

## 11. Monitoring & Observability

### Metrics

```typescript
// Business metrics
metrics.increment('employees_created_total', { role, tenant_id });
metrics.set('employees_active', activeCount, { tenant_id });
metrics.histogram('payroll_calculation_duration_ms', duration);

// Technical metrics
metrics.increment('http_requests_total', { method, path, status });
metrics.histogram('http_request_duration_ms', duration);
```

### Logging

```typescript
// Structured logging with Pino
const log = createRequestLogger(requestId, userId, { tenantId });

log.info({ operation: 'create_employee', employeeId }, 'Employee created');
log.warn({ operation: 'duplicate_pin', pin_hash }, 'Duplicate PIN attempt');
log.error({ operation: 'payroll_calc_failed', error }, 'Payroll calculation failed');
```

### Audit Trail

```typescript
// All mutations logged to admin_access_logs
{
  employee_id: UUID,      // Who
  action: string,         // What (CREATE, UPDATE, DELETE)
  resource: string,       // Where (employees, payroll, etc.)
  metadata: JSON,         // Details
  created_at: Timestamp   // When
}
```

---

## 12. Future Improvements

### Phase 2 (Recommended)
1. **Complete unit tests** for all APIs (currently only employees has full coverage)
2. **OpenAPI/Swagger** documentation generation
3. **Performance optimization** for complex queries
4. **Advanced caching** strategy for reports

### Phase 3 (Optional)
5. **Real-time notifications** for important events
6. **PDF/Excel export** for reports
7. **Mobile app** integration
8. **Advanced analytics** dashboard

---

## Conclusión

El módulo de Employee Management System está completamente funcional y sigue las mejores prácticas del proyecto. La arquitectura es escalable, segura, y mantiene consistencia con el resto del sistema PARK POS.

**Fecha de documentación**: Marzo 5, 2026
**Estado**: Producción
**Arquitectura**: Event Sourcing + Multi-tenancy + Audit Trail
