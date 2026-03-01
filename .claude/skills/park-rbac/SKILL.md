---
name: park-rbac
description: >
  PARK POS RBAC: roles, permissions, auth middleware, RoleGuard.
  Trigger: When working with roles, permissions, auth, guards, or access control.
license: MIT
metadata:
  author: park-pos-team
  version: "1.0"
---

## Single Source of Truth

File: `src/core/constants/roles.ts`

```typescript
// 11 employee roles
export const EMPLOYEE_ROLES = [
  'OWNER','ADMIN','MANAGER','SUPERVISOR','CASHIER',
  'WAITER','KITCHEN','COOK','PACKER','BAR','DRIVER'
] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

// 4 admin panel roles
export const ADMIN_ROLES = ['OWNER','ADMIN','MANAGER','SUPERVISOR'] as const;
export type AdminAccessRole = (typeof ADMIN_ROLES)[number];

// 3 kitchen display roles
export const KITCHEN_ROLES = ['KITCHEN','COOK','PACKER'] as const;
```

## Permission Hierarchy

```
OWNER (level 4)      → ALL 10 permissions
ADMIN (level 3)      → ALL except manage_config
MANAGER (level 2)    → manage_products, manage_employees, manage_promotions, view_*
SUPERVISOR (level 1) → view_dashboard, view_reports ONLY
```

**10 admin permissions**: `view_dashboard`, `manage_products`, `manage_employees`, `manage_terminals`, `manage_promotions`, `manage_stations`, `manage_config`, `manage_fiscal`, `view_reports`, `view_audit`

## Auth Middleware (3 levels)

### 1. POS Auth — any employee role
```typescript
import { requirePosAuth } from '@/src/core/middleware/pos-auth';

export async function POST(request: NextRequest) {
  const auth = await requirePosAuth(request);
  if (!auth.authorized) return auth.response;
  // auth.user.tenantId, auth.user.id, auth.user.role
}
```

### 2. Admin Auth — ADMIN_ROLES only
```typescript
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

const auth = await requireAdminAuth(request);
if (!auth.authorized) return auth.response;
```

### 3. Admin Permission — granular
```typescript
import { requireAdminPermission } from '@/src/core/middleware/admin-permission';

const auth = await requireAdminPermission(request, 'manage_employees');
if (!auth.authorized) return auth.response;
// auth.user guaranteed to have the permission
```

All return: `{ authorized: true; user } | { authorized: false; response: NextResponse }`

## RoleGuard Component (Client-Side)

File: `src/components/auth/RoleGuard.tsx`

```tsx
// 'use client' — inside <AuthProvider requireAuth>
<RoleGuard allowedRoles={['BAR']}>
  {children}
</RoleGuard>
```

- Redirects to `/` if role not in `allowedRoles`
- Returns `null` while loading (no flash)
- Used in layout.tsx of each protected section

## Event-Sourcing Role Mapping

File: `src/core/validation/role-permissions.ts` — maps all 11 roles to allowed event_types.

## Anti-Patterns

- `role === 'ADMIN'` → **WRONG** — excludes OWNER, MANAGER, SUPERVISOR
- `ADMIN_ROLES.includes(role)` → **CORRECT**
- `tenant_id` from request body → **WRONG** — IDOR vulnerability
- `authResult.user.tenantId` from JWT → **CORRECT**
- `x-skip-auth` header → **ELIMINATED** — auth always required
- Checking role string directly → use `EMPLOYEE_ROLES`/`ADMIN_ROLES` arrays
