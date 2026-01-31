# Design Document

## Overview

This design implements complete CRUD functionality for the PARK POS Admin Panel, extending the existing read-only modules (Employees, Products, Promotions, Drivers, Configuration) with create, update, and delete capabilities. The implementation follows the established pattern from the Mesas module, which already has full CRUD functionality.

The design prioritizes:
- **Consistency**: Following existing patterns from the Mesas module
- **Security**: Role-based access control and audit logging
- **Data Integrity**: Validation, transactions, and soft deletes
- **User Experience**: Modal forms, loading states, and clear error messages
- **Offline-First**: Queue operations when offline, sync when online

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Panel UI                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Employees │  │ Products │  │Promotions│  │ Drivers  │  │
│  │  CRUD    │  │   CRUD   │  │   CRUD   │  │   CRUD   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────────┼─────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │/employees│  │/products │  │/promotions│ │ /drivers │  │
│  │ POST/PUT │  │ POST/PUT │  │ POST/PUT │  │ POST/PUT │  │
│  │  DELETE  │  │  DELETE  │  │  DELETE  │  │  DELETE  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────────┼─────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Validation Layer                           │
│  • Role-based permissions (ADMIN/MANAGER only)             │
│  • Input validation (Zod schemas)                          │
│  • Business rules (uniqueness, constraints)                │
└───────┬─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database Layer (Prisma)                    │
│  • Transactions for atomicity                              │
│  • Soft deletes (is_active flag)                           │
│  • Audit trail logging                                     │
└─────────────────────────────────────────────────────────────┘
```


### Component Architecture

Each CRUD module follows this structure:

```
src/app/admin/{module}/
├── page.tsx              # List view with DataTable (existing)
├── nuevo/
│   └── page.tsx         # Create form (new)
└── [id]/
    └── page.tsx         # Edit form (new)

src/app/api/admin/{module}/
├── route.ts             # GET (existing), POST (new)
└── [id]/
    └── route.ts         # GET, PUT, DELETE (new)
```

### Data Flow

**Create Operation:**
```
User fills form → Client validation → POST /api/admin/{module}
  → Server validation → Check uniqueness → Create record
  → Log audit trail → Return 201 + record → Refresh list
```

**Update Operation:**
```
User edits form → Client validation → PUT /api/admin/{module}/[id]
  → Server validation → Check permissions → Update record
  → Log audit trail → Return 200 + record → Refresh list
```

**Delete Operation:**
```
User clicks delete → Confirmation dialog → DELETE /api/admin/{module}/[id]
  → Check dependencies → Soft delete (is_active=false)
  → Log audit trail → Return 204 → Refresh list
```

## Components and Interfaces

### Frontend Components

#### 1. Modal Form Component Pattern

Following the `TableModal` pattern from Mesas module:

```typescript
interface ModalFormProps<T> {
  item: T | null;              // null for create, object for edit
  onClose: () => void;         // Close modal
  onSave: () => void;          // Refresh parent list
  additionalData?: any;        // Lookup data (zones, categories, etc.)
}

function ModalForm<T>({ item, onClose, onSave, additionalData }: ModalFormProps<T>) {
  const [form, setForm] = useState<FormData>(item || defaultValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      const url = item ? `/api/admin/{module}/${item.id}` : '/api/admin/{module}';
      const method = item ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-md border border-zinc-800">
        {/* Form content */}
      </div>
    </div>
  );
}
```


#### 2. List Page Component Pattern

```typescript
export default function ListPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/{module}');
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      setItems(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este registro?')) return;
    
    try {
      const res = await fetch(`/api/admin/{module}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{Module Name}</h1>
        <button onClick={() => { setEditingItem(null); setShowModal(true); }}>
          Nueva {Entity}
        </button>
      </div>

      <DataTable
        data={items}
        columns={columns}
        filters={filters}
        loading={loading}
      />

      {showModal && (
        <ModalForm
          item={editingItem}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSave={() => { setShowModal(false); setEditingItem(null); fetchData(); }}
        />
      )}
    </div>
  );
}
```

### Backend API Interfaces

#### 1. POST Endpoint (Create)

```typescript
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const body = await request.json();
    
    // Validate input
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = parsed.data;
    
    // Check uniqueness constraints
    const existing = await prisma.{table}.findFirst({
      where: { tenant_id: tenantId, {unique_field}: data.{unique_field} },
    });
    
    if (existing) {
      return NextResponse.json(
        { error: '{Field} already exists' },
        { status: 409 }
      );
    }
    
    // Create record in transaction
    const record = await prisma.$transaction(async (tx) => {
      const newRecord = await tx.{table}.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          ...data,
        },
      });
      
      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: session.employeeId,
          action: 'CREATE',
          resource: '{module}',
          metadata: { record_id: newRecord.id },
        },
      });
      
      return newRecord;
    });
    
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('{Module} POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create {entity}' },
      { status: 500 }
    );
  }
}
```


#### 2. PUT Endpoint (Update)

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const body = await request.json();
    
    // Validate input
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = parsed.data;
    
    // Check record exists
    const existing = await prisma.{table}.findFirst({
      where: { id: params.id, tenant_id: tenantId },
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: '{Entity} not found' },
        { status: 404 }
      );
    }
    
    // Update record in transaction
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.{table}.update({
        where: { id: params.id },
        data: data,
      });
      
      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: session.employeeId,
          action: 'UPDATE',
          resource: '{module}',
          metadata: { 
            record_id: params.id,
            changes: data,
          },
        },
      });
      
      return updated;
    });
    
    return NextResponse.json(record);
  } catch (error) {
    console.error('{Module} PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update {entity}' },
      { status: 500 }
    );
  }
}
```

#### 3. DELETE Endpoint (Soft Delete)

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    
    // Check record exists
    const existing = await prisma.{table}.findFirst({
      where: { id: params.id, tenant_id: tenantId },
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: '{Entity} not found' },
        { status: 404 }
      );
    }
    
    // Soft delete in transaction
    await prisma.$transaction(async (tx) => {
      await tx.{table}.update({
        where: { id: params.id },
        data: { is_active: false },
      });
      
      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: session.employeeId,
          action: 'DELETE',
          resource: '{module}',
          metadata: { record_id: params.id },
        },
      });
    });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('{Module} DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete {entity}' },
      { status: 500 }
    );
  }
}
```

## Data Models

### Employee Data Model

```typescript
interface Employee {
  id: string;              // UUID
  tenant_id: string;       // UUID
  name: string;            // 1-100 chars
  role: EmployeeRole;      // Enum
  pin_hash: string;        // SHA-256 hash
  is_active: boolean;      // Soft delete flag
  created_at: Date;        // Timestamp
}

enum EmployeeRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  WAITER = 'WAITER',
  KITCHEN = 'KITCHEN',
  DRIVER = 'DRIVER',
}

// Validation schema
const employeeSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DRIVER']),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  is_active: z.boolean().default(true),
});
```


### Product Data Model

```typescript
interface Product {
  id: string;              // UUID
  tenant_id: string;       // UUID
  sku: string;             // Unique, 1-50 chars
  name: string;            // 1-100 chars
  short_name: string | null; // 0-30 chars, optional
  price_cents: number;     // Integer, never float
  category: ProductCategory; // Enum
  station: KitchenStation;   // Enum
  type: ProductType;       // Enum
  is_active: boolean;      // Soft delete flag
}

enum ProductCategory {
  POLLOS = 'POLLOS',
  PARRILLAS = 'PARRILLAS',
  BEBIDAS = 'BEBIDAS',
  EXTRAS = 'EXTRAS',
  POSTRES = 'POSTRES',
  COMBOS = 'COMBOS',
}

enum KitchenStation {
  PARRILLA = 'PARRILLA',
  COCINA = 'COCINA',
  BAR = 'BAR',
  HORNO = 'HORNO',
  POSTRES = 'POSTRES',
  EMPAQUE = 'EMPAQUE',
}

enum ProductType {
  SIMPLE = 'SIMPLE',
  COMBO = 'COMBO',
}

// Validation schema
const productSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  short_name: z.string().max(30).nullable().optional(),
  price_cents: z.number().int().min(0),
  category: z.enum(['POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS', 'POSTRES', 'COMBOS']),
  station: z.enum(['PARRILLA', 'COCINA', 'BAR', 'HORNO', 'POSTRES', 'EMPAQUE']),
  type: z.enum(['SIMPLE', 'COMBO']).default('SIMPLE'),
  is_active: z.boolean().default(true),
});
```

### Promotion Data Model

```typescript
interface Promotion {
  id: string;              // UUID
  tenant_id: string;       // UUID
  name: string;            // 1-100 chars
  type: PromotionType;     // Enum
  value: number;           // Percentage or fixed amount
  rules: Record<string, unknown>; // JSON rules
  starts_at: Date;         // Start date
  ends_at: Date;           // End date
  is_active: boolean;      // Soft delete flag
}

enum PromotionType {
  PERCENT = 'PERCENT',     // Percentage discount
  FIXED = 'FIXED',         // Fixed amount discount
  TWO_FOR_ONE = '2X1',     // Buy one get one
  HAPPY_HOUR = 'HAPPY_HOUR', // Time-based discount
  COMBO = 'COMBO',         // Combo deal
}

// Validation schema
const promotionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO']),
  value: z.number().min(0),
  rules: z.record(z.unknown()).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  is_active: z.boolean().default(true),
}).refine(data => new Date(data.starts_at) < new Date(data.ends_at), {
  message: 'Start date must be before end date',
  path: ['starts_at'],
});
```

### Driver Data Model

```typescript
interface Driver {
  id: string;              // UUID
  tenant_id: string;       // UUID
  name: string;            // Required
  phone: string | null;    // Optional
  is_active: boolean;      // Soft delete flag
}

// Validation schema
const driverSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[\d\s-()]+$/).nullable().optional(),
  is_active: z.boolean().default(true),
});
```

### Audit Log Data Model

```typescript
interface AuditLog {
  id: string;              // UUID
  tenant_id: string;       // UUID
  employee_id: string;     // UUID of actor
  action: AuditAction;     // CREATE, UPDATE, DELETE
  resource: string;        // Module name
  ip_address: string | null;
  user_agent: string | null;
  terminal_id: string | null;
  metadata: Record<string, unknown>; // Action details
  created_at: Date;        // Timestamp
}

enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: PIN Uniqueness Enforcement
*For any* tenant and any two employees, if both employees are active, then their PIN hashes must be different.
**Validates: Requirements 1.1**

### Property 2: PIN Hashing Security
*For any* employee creation or update with a PIN, the stored pin_hash must be a SHA-256 hash and must not equal the plaintext PIN.
**Validates: Requirements 1.2**

### Property 3: Employee Field Update Permissions
*For any* employee update operation, changes to name, role, and is_active should succeed, but attempts to change pin_hash should be rejected.
**Validates: Requirements 1.3**

### Property 4: Employee Soft Delete Preservation
*For any* employee deactivation operation, the employee record must still exist in the database with is_active set to false.
**Validates: Requirements 1.4**

### Property 5: Employee Role Validation
*For any* employee creation or update, the role field must be one of the valid EmployeeRole enum values, and invalid roles must be rejected.
**Validates: Requirements 1.5**

### Property 6: Employee Audit Trail Completeness
*For any* employee create, update, or delete operation, an audit log entry must be created with the correct action type and employee_id.
**Validates: Requirements 1.6**

### Property 7: Employee List Display Completeness
*For any* employee in the list view, the rendered output must contain the employee's name, role, and is_active status.
**Validates: Requirements 1.8**

### Property 8: SKU Uniqueness Enforcement
*For any* tenant and any two products, if both products exist, then their SKU values must be different.
**Validates: Requirements 2.1**

### Property 9: Price Integer Type Safety
*For any* product creation or update, the price_cents field must be an integer type and must reject float values.
**Validates: Requirements 2.2**

### Property 10: Product Field Update Permissions
*For any* product update operation, all fields (SKU, name, price_cents, category, station, is_active) should be updatable.
**Validates: Requirements 2.3**

### Property 11: Product Soft Delete Preservation
*For any* product deactivation operation, the product record must still exist in the database with is_active set to false.
**Validates: Requirements 2.4**

### Property 12: Product Category Validation
*For any* product creation or update, the category field must be one of the valid ProductCategory enum values, and invalid categories must be rejected.
**Validates: Requirements 2.5**

### Property 13: Product Station Validation
*For any* product creation or update, the station field must be one of the valid KitchenStation enum values, and invalid stations must be rejected.
**Validates: Requirements 2.6**

### Property 14: Catalog Version Increment
*For any* product creation or update operation, the catalog_version counter in catalog_meta must increment by exactly 1.
**Validates: Requirements 2.7**

### Property 15: Product Audit Trail Completeness
*For any* product create, update, or delete operation, an audit log entry must be created with the correct action type and product_id in metadata.
**Validates: Requirements 2.8**

### Property 16: Product List Display Completeness
*For any* product in the list view, the rendered output must contain SKU, name, price_cents, category, station, and is_active status.
**Validates: Requirements 2.10**

### Property 17: Promotion Date Range Validation
*For any* promotion creation or update, if starts_at is not before ends_at, the operation must be rejected with a validation error.
**Validates: Requirements 3.1**

### Property 18: Promotion Type Validation
*For any* promotion creation or update, the type field must be one of the valid PromotionType enum values, and invalid types must be rejected.
**Validates: Requirements 3.2**

### Property 19: Promotion Field Update Permissions
*For any* promotion update operation, all fields (name, type, value, starts_at, ends_at, rules, is_active) should be updatable.
**Validates: Requirements 3.3**

### Property 20: Promotion Soft Delete Preservation
*For any* promotion deactivation operation, the promotion record must still exist in the database with is_active set to false.
**Validates: Requirements 3.4**

### Property 21: Promotion Audit Trail Completeness
*For any* promotion create, update, or delete operation, an audit log entry must be created with the correct action type and promotion_id in metadata.
**Validates: Requirements 3.6**

### Property 22: Promotion List Display Completeness
*For any* promotion in the list view, the rendered output must contain name, type, value, starts_at, ends_at, and expiration status.
**Validates: Requirements 3.8**

### Property 23: Promotion Rules JSON Validation
*For any* promotion with rules, the rules field must be valid JSON and must reject malformed JSON strings.
**Validates: Requirements 3.9**

### Property 24: Driver Required Field Validation
*For any* driver creation, the name field must be required and non-empty, while the phone field must be optional.
**Validates: Requirements 4.1**

### Property 25: Driver Field Update Permissions
*For any* driver update operation, the name, phone, and is_active fields should be updatable.
**Validates: Requirements 4.2**

### Property 26: Driver Soft Delete Preservation
*For any* driver deactivation operation, the driver record must still exist in the database with is_active set to false.
**Validates: Requirements 4.3**

### Property 27: Driver Audit Trail Completeness
*For any* driver create, update, or delete operation, an audit log entry must be created with the correct action type and driver_id in metadata.
**Validates: Requirements 4.4**

### Property 28: Driver List Display Completeness
*For any* driver in the list view, the rendered output must contain name, phone, and is_active status.
**Validates: Requirements 4.6**

### Property 29: Configuration Value Validation
*For any* configuration update, all configuration values must pass validation rules before being saved, and invalid values must be rejected.
**Validates: Requirements 5.1**

### Property 30: Configuration Audit Trail with Change Tracking
*For any* configuration update operation, an audit log entry must be created containing both the old values and new values in the metadata.
**Validates: Requirements 5.3**

### Property 31: Configuration Range Validation
*For any* numeric configuration value, the value must be within the acceptable range, and out-of-range values must be rejected.
**Validates: Requirements 5.5**

### Property 32: Dual Validation Enforcement
*For any* create or update operation, both client-side and server-side validation must reject missing required fields.
**Validates: Requirements 6.5**

### Property 33: Role-Based Access Control
*For any* create, update, or delete operation, requests from users without ADMIN or MANAGER roles must be rejected with 403 Forbidden.
**Validates: Requirements 7.1**

### Property 34: Unauthorized Access Error Code
*For any* unauthorized request to a restricted operation, the response status code must be 403 Forbidden.
**Validates: Requirements 7.2**

### Property 35: Dual Permission Validation
*For any* restricted operation, both client-side and server-side permission checks must enforce role requirements.
**Validates: Requirements 7.3**

### Property 36: Audit Log Actor Tracking
*For any* audit log entry, the actor_id and terminal_id fields must be populated with the current user and terminal information.
**Validates: Requirements 7.4**

### Property 37: Transaction Atomicity
*For any* create or update operation that fails validation, no partial changes should be committed to the database.
**Validates: Requirements 8.1, 8.2**

### Property 38: Foreign Key Constraint Enforcement
*For any* operation that references related data, invalid foreign key values must be rejected by the database.
**Validates: Requirements 8.3**

### Property 39: Dependency Check on Soft Delete
*For any* soft delete operation on a record with dependent records, a warning must be issued to the user.
**Validates: Requirements 8.4**

### Property 40: In-Use Record Protection
*For any* delete operation on a record currently in use, the operation must be rejected with an appropriate error message.
**Validates: Requirements 8.5**

### Property 41: Offline Operation Queueing
*For any* create or update operation performed while offline, the operation must be added to a sync queue for later processing.
**Validates: Requirements 9.1**

### Property 42: Automatic Sync on Reconnection
*For any* queued operations when connectivity is restored, the operations must be automatically synchronized with the server.
**Validates: Requirements 9.2**

### Property 43: Server State Conflict Resolution
*For any* sync conflict in admin operations, the server state must be used as the authoritative version.
**Validates: Requirements 9.4**

### Property 44: API Endpoint Contract Compliance
*For all* specified API endpoints (POST, PUT, DELETE for employees, products, promotions, drivers, config), the endpoints must exist and accept the correct HTTP methods.
**Validates: Requirements 10.1-10.13**

### Property 45: Success Status Code Correctness
*For any* successful API operation, the response status code must be 200 (update), 201 (create), or 204 (delete) as appropriate.
**Validates: Requirements 10.14**

### Property 46: Error Status Code Correctness
*For any* failed API operation, the response status code must be 400 (validation), 403 (permission), 404 (not found), 409 (conflict), or 500 (server error) as appropriate, with a descriptive error message.
**Validates: Requirements 10.15**


## Error Handling

### Client-Side Error Handling

```typescript
// Form validation errors
interface ValidationError {
  field: string;
  message: string;
}

// Display field-specific errors
function displayFieldError(field: string, message: string) {
  const errorElement = document.querySelector(`[data-error="${field}"]`);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }
}

// Network error handling
async function handleApiCall(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const data = await response.json();
      
      switch (response.status) {
        case 400:
          // Validation error - show field-specific messages
          if (data.details) {
            Object.entries(data.details).forEach(([field, errors]) => {
              displayFieldError(field, errors[0]);
            });
          }
          throw new Error(data.error || 'Validation failed');
          
        case 403:
          // Permission denied
          throw new Error('No tienes permisos para realizar esta acción');
          
        case 404:
          // Not found
          throw new Error('Registro no encontrado');
          
        case 409:
          // Conflict (duplicate)
          throw new Error(data.error || 'Ya existe un registro con estos datos');
          
        case 500:
          // Server error
          throw new Error('Error del servidor. Intenta nuevamente.');
          
        default:
          throw new Error(data.error || 'Error desconocido');
      }
    }
    
    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      // Network error - queue for offline sync
      throw new Error('Sin conexión. La operación se guardará para sincronizar después.');
    }
    throw error;
  }
}
```

### Server-Side Error Handling

```typescript
// Centralized error handler
function handleApiError(error: unknown, operation: string): NextResponse {
  console.error(`${operation} error:`, error);
  
  // Prisma unique constraint violation
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const field = error.meta?.target as string[];
      return NextResponse.json(
        { error: `${field?.[0] || 'Field'} already exists` },
        { status: 409 }
      );
    }
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
    
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid reference to related record' },
        { status: 400 }
      );
    }
  }
  
  // Zod validation error
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', details: error.flatten() },
      { status: 400 }
    );
  }
  
  // Generic error
  return NextResponse.json(
    { error: `Failed to ${operation}` },
    { status: 500 }
  );
}
```

### Error Recovery Strategies

1. **Validation Errors**: Display inline, allow user to correct and retry
2. **Network Errors**: Queue operation for offline sync, show sync status
3. **Permission Errors**: Redirect to login or show access denied message
4. **Conflict Errors**: Show specific conflict message, suggest resolution
5. **Server Errors**: Log error, show generic message, allow retry

## Testing Strategy

### Unit Testing

Unit tests will focus on:
- API endpoint validation logic
- Form validation functions
- Data transformation utilities
- Error handling functions
- Permission checking logic

Example unit test structure:

```typescript
describe('Employee API', () => {
  describe('POST /api/admin/employees', () => {
    it('should create employee with valid data', async () => {
      const employee = {
        name: 'John Doe',
        role: 'WAITER',
        pin: '1234',
        is_active: true,
      };
      
      const response = await POST(createRequest(employee));
      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.name).toBe(employee.name);
      expect(data.pin_hash).not.toBe(employee.pin);
    });
    
    it('should reject duplicate PIN', async () => {
      // Create first employee
      await createEmployee({ name: 'User 1', pin: '1234' });
      
      // Attempt to create second with same PIN
      const response = await POST(createRequest({
        name: 'User 2',
        pin: '1234',
      }));
      
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('PIN already in use');
    });
    
    it('should reject invalid role', async () => {
      const response = await POST(createRequest({
        name: 'John Doe',
        role: 'INVALID_ROLE',
        pin: '1234',
      }));
      
      expect(response.status).toBe(400);
    });
  });
});
```

### Property-Based Testing

Property-based tests will verify universal correctness properties across many generated inputs. Each test will run a minimum of 100 iterations.

Example property test structure:

```typescript
import fc from 'fast-check';

describe('Employee CRUD Properties', () => {
  it('Property 1: PIN uniqueness enforcement', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(employeeArbitrary(), { minLength: 2, maxLength: 10 }),
        async (employees) => {
          // Create all employees
          const created = await Promise.all(
            employees.map(emp => createEmployee(emp))
          );
          
          // Get all active employees
          const active = await getActiveEmployees();
          
          // Extract PIN hashes
          const pinHashes = active.map(emp => emp.pin_hash);
          
          // Verify all PIN hashes are unique
          const uniquePins = new Set(pinHashes);
          expect(uniquePins.size).toBe(pinHashes.length);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 2: PIN hashing security', async () => {
    await fc.assert(
      fc.asyncProperty(
        employeeArbitrary(),
        async (employee) => {
          const created = await createEmployee(employee);
          
          // Verify PIN is hashed
          expect(created.pin_hash).not.toBe(employee.pin);
          expect(created.pin_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
          
          // Verify hash is deterministic
          const hash1 = hashPin(employee.pin);
          const hash2 = hashPin(employee.pin);
          expect(hash1).toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Arbitrary generators
function employeeArbitrary() {
  return fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    role: fc.constantFrom('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DRIVER'),
    pin: fc.integer({ min: 1000, max: 999999 }).map(n => n.toString()),
    is_active: fc.boolean(),
  });
}

function productArbitrary() {
  return fc.record({
    sku: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    short_name: fc.option(fc.string({ maxLength: 30 })),
    price_cents: fc.integer({ min: 0, max: 1000000 }),
    category: fc.constantFrom('POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS', 'POSTRES', 'COMBOS'),
    station: fc.constantFrom('PARRILLA', 'COCINA', 'BAR', 'HORNO', 'POSTRES', 'EMPAQUE'),
    type: fc.constantFrom('SIMPLE', 'COMBO'),
    is_active: fc.boolean(),
  });
}
```

### Integration Testing

Integration tests will verify end-to-end flows:
- Complete CRUD cycles (create → read → update → delete)
- Form submission and validation
- Modal open/close behavior
- List refresh after operations
- Audit trail logging
- Permission enforcement

### E2E Testing (Playwright)

E2E tests will verify user workflows:
- Admin creates new employee with unique PIN
- Admin edits employee details
- Admin deactivates employee
- Admin creates new product with unique SKU
- Admin edits product price
- Admin creates promotion with date range
- Permission denied for non-admin users

Example E2E test:

```typescript
test('Admin can create and edit employee', async ({ page }) => {
  // Login as admin
  await page.goto('/admin/empleados');
  
  // Click "Nueva Empleado" button
  await page.click('text=Nueva Empleado');
  
  // Fill form
  await page.fill('[name="name"]', 'Test Employee');
  await page.selectOption('[name="role"]', 'WAITER');
  await page.fill('[name="pin"]', '1234');
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Verify employee appears in list
  await expect(page.locator('text=Test Employee')).toBeVisible();
  
  // Click edit button
  await page.click('[data-employee-id] button[title="Editar"]');
  
  // Change name
  await page.fill('[name="name"]', 'Updated Employee');
  await page.click('button[type="submit"]');
  
  // Verify updated name
  await expect(page.locator('text=Updated Employee')).toBeVisible();
});
```

### Test Coverage Goals

- **Unit Tests**: 80%+ code coverage for business logic
- **Property Tests**: All 46 correctness properties implemented
- **Integration Tests**: All CRUD operations for each module
- **E2E Tests**: Critical user workflows for each module

### Testing Configuration

```json
{
  "propertyTests": {
    "library": "fast-check",
    "iterations": 100,
    "timeout": 30000
  },
  "e2eTests": {
    "library": "playwright",
    "browsers": ["chromium"],
    "baseURL": "http://localhost:3000"
  }
}
```

