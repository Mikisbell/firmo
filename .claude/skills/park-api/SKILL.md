---
name: park-api
description: >
  PARK POS API patterns: Next.js route handlers, auth guards, response shapes.
  Trigger: When creating or modifying API endpoints, route handlers, or middleware.
license: MIT
metadata:
  author: park-pos-team
  version: "1.0"
---

## Standard Route Handler Pattern

File pattern: `src/app/api/{domain}/{resource}/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import prisma from '@/src/core/db/prisma';

export async function POST(request: NextRequest) {
  // 1. Auth guard — ALWAYS first
  const auth = await requirePosAuth(request);
  if (!auth.authorized) return auth.response;

  // 2. Parse body safely
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  // 3. Validate with Zod
  const parsed = MySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validación fallida', details: parsed.error.errors },
      { status: 400 }
    );
  }

  // 4. Business logic — tenant_id ALWAYS from JWT
  const result = await myService({
    tenantId: auth.user.tenantId,  // CRITICAL: from JWT, never body
    actorId: auth.user.id,
    ...parsed.data,
  });

  // 5. Result pattern response
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json(result.data, { status: 201 });
}
```

## Auth Middleware Levels

| Middleware | Import | Protects | Returns |
|---|---|---|---|
| `requirePosAuth` | `@/src/core/middleware/pos-auth` | Any of 11 roles | `{ authorized, user/response }` |
| `requireAdminAuth` | `@/src/core/middleware/admin-auth` | ADMIN_ROLES (4) | `{ authorized, user/response }` |
| `requireAdminPermission` | `@/src/core/middleware/admin-permission` | Specific permission | `{ authorized, user/response }` |
| `requireOpenShift` | `@/src/core/middleware/shift-guard` | POS + open shift | `{ authorized, user/response }` |

```typescript
// All return the same shape:
type AuthResult =
  | { authorized: true;  user: AuthUser }
  | { authorized: false; response: NextResponse };
```

## Response Shapes

```typescript
// Success
NextResponse.json({ success: true, data: { ... } }, { status: 200 });
NextResponse.json(data, { status: 201 }); // created

// Error
NextResponse.json({ error: 'message' }, { status: 400 });
NextResponse.json({ error: 'No autorizado' }, { status: 401 });
NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
NextResponse.json({ error: 'No encontrado' }, { status: 404 });

// Ingest-specific
{ accepted: true, deduped_event_ids: [], rejected: [], merged: [] }
{ accepted: false, error: { error_code, severity, message, retryable } }
```

## Rate Limiting (3 Levels)

1. **IP-based** — global rate limit per IP
2. **Tenant Redis** — per-tenant rate limit via Redis
3. **Per-endpoint** — specific limits on sensitive endpoints

## Security Headers

Configured in `next.config.js`:
- CSP (Content Security Policy)
- CORS (restricted origins)
- HSTS (Strict Transport Security)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

## Anti-Patterns

- `tenant_id` from `body.tenant_id` → **IDOR vulnerability** — always from JWT
- Missing auth guard → **0 routes without auth** in production
- `new PrismaClient()` in route → use singleton `import prisma from '@/src/core/db/prisma'`
- `console.log(pin)` or `console.log(mac_address)` → sanitize logs
- `/api/test*` routes without `NODE_ENV` check → blocked in production (404)
- Catching all errors silently → always return structured error response
