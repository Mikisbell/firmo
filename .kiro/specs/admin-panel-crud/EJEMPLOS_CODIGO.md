# Ejemplos de Código - Soluciones a Problemas Críticos

**Fecha:** 20 Enero 2026  
**Propósito:** Guía práctica de implementación para los 6 problemas P0

---

## 🔴 PROBLEMA 1: localStorage para Sesiones

### ❌ CÓDIGO ACTUAL (INCORRECTO)
```typescript
// src/app/admin/hooks/useAdminAuth.ts
const SESSION_KEY = 'admin_session';

export function useAdminAuth() {
  const login = useCallback((emp: AdminEmployee, tok: string) => {
    const session: AdminSession = {
      employee: emp,
      token: tok,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    };

    // ❌ VULNERABLE - Token expuesto a XSS
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setEmployee(emp);
    setToken(tok);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    // ❌ Solo limpia localStorage, no revoca el token
    localStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
  }, []);
}
```

### ✅ CÓDIGO CORRECTO
```typescript
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/src/core/auth/auth.service';

export async function POST(request: NextRequest) {
  const { pin, employeeId } = await request.json();
  
  // Validar PIN...
  const employee = await validatePin(employeeId, pin);
  
  if (!employee) {
    return NextResponse.json(
      { error: 'PIN inválido' },
      { status: 401 }
    );
  }

  // Crear JWT token
  const token = await createToken({
    sub: employee.id,
    role: employee.role,
    name: employee.name,
    tid: employee.tenant_id,
  });

  // ✅ CORRECTO - httpOnly cookie
  const response = NextResponse.json({
    success: true,
    employee: {
      id: employee.id,
      name: employee.name,
      role: employee.role,
    },
  });

  response.cookies.set('auth_token', token, {
    httpOnly: true,      // ✅ No accesible desde JavaScript
    secure: true,        // ✅ Solo HTTPS
    sameSite: 'strict',  // ✅ Protección CSRF
    maxAge: 1800,        // ✅ 30 minutos
    path: '/',
  });

  return response;
}

// src/app/api/auth/logout/route.ts
export async function POST(request: NextRequest) {
  // Revocar token en BD...
  await revokeToken(request);

  // ✅ CORRECTO - Limpiar cookie
  const response = NextResponse.json({ success: true });
  
  response.cookies.delete('auth_token');
  
  return response;
}

// src/app/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<AuthEmployee | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      // ✅ CORRECTO - Cookie se envía automáticamente
      const response = await fetch('/api/auth/session', {
        credentials: 'include', // Importante: incluir cookies
      });

      if (response.ok) {
        const data = await response.json();
        setEmployee(data.employee);
      }
    };

    checkSession();
  }, []);

  // ✅ No hay acceso directo al token desde el frontend
  // ✅ El navegador maneja las cookies automáticamente
}
```

---

## 🔴 PROBLEMA 2: Sin Paginación

### ❌ CÓDIGO ACTUAL (INCORRECTO)
```typescript
// src/app/api/admin/employees/route.ts
export async function GET() {
  try {
    // ❌ Sin paginación - puede devolver 10,000+ registros
    const employees = await prisma.employees.findMany({
      where: { tenant_id: TENANT_ID },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
```

### ✅ CÓDIGO CORRECTO
```typescript
// src/app/api/admin/employees/route.ts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // ✅ Parsear parámetros de paginación
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      100, // ✅ Límite máximo
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    
    const skip = (page - 1) * limit;

    // ✅ Query con paginación
    const [employees, total] = await Promise.all([
      prisma.employees.findMany({
        where: { tenant_id: TENANT_ID, is_active: true },
        orderBy: { name: 'asc' },
        take: limit,
        skip: skip,
        select: {
          id: true,
          name: true,
          role: true,
          is_active: true,
        },
      }),
      prisma.employees.count({
        where: { tenant_id: TENANT_ID, is_active: true },
      }),
    ]);

    // ✅ Respuesta con metadata de paginación
    return NextResponse.json({
      items: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Employees GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener empleados' },
      { status: 500 }
    );
  }
}
```

### ✅ FRONTEND CON PAGINACIÓN
```typescript
// src/app/admin/empleados/page.tsx
export default function EmpleadosPage() {
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchEmployees = async (page: number) => {
    setLoading(true);
    try {
      // ✅ Request con paginación
      const response = await fetch(
        `/api/admin/employees?page=${page}&limit=${pagination.limit}`
      );
      const data = await response.json();
      
      setEmployees(data.items);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(1);
  }, []);

  return (
    <div>
      {/* Lista de empleados */}
      {employees.map(emp => (
        <div key={emp.id}>{emp.name}</div>
      ))}

      {/* ✅ Controles de paginación */}
      <div className="flex gap-2 mt-4">
        <button
          disabled={!pagination.hasPrev || loading}
          onClick={() => fetchEmployees(pagination.page - 1)}
        >
          Anterior
        </button>
        
        <span>
          Página {pagination.page} de {pagination.totalPages}
        </span>
        
        <button
          disabled={!pagination.hasNext || loading}
          onClick={() => fetchEmployees(pagination.page + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
```

---

## 🔴 PROBLEMA 3: Dos Sistemas de Auth

### ❌ CÓDIGO ACTUAL (INCORRECTO)
```typescript
// ❌ Sistema 1: layout.tsx usa cookies
const response = await fetch('/api/auth/session', {
  credentials: 'include',
});

// ❌ Sistema 2: useAdminAuth.ts usa localStorage
const stored = localStorage.getItem(SESSION_KEY);
```

### ✅ CÓDIGO CORRECTO
```typescript
// ✅ ELIMINAR: src/app/admin/hooks/useAdminAuth.ts
// Este archivo debe ser eliminado completamente

// ✅ USAR SOLO: src/app/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<AuthEmployee | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // ✅ ÚNICO sistema de auth - cookies
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setEmployee(data.employee);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Session check error:', error);
      }
    };

    checkSession();
  }, []);

  // ✅ Proveer contexto a toda la app
  return (
    <AuthContext.Provider value={{ employee, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

// ✅ Hook para consumir el contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

## 🔴 PROBLEMA 4: Sin Rate Limiting

### ❌ CÓDIGO ACTUAL (INCORRECTO)
```typescript
// src/app/api/admin/employees/route.ts
export async function POST(request: NextRequest) {
  // ❌ Sin rate limiting - vulnerable a brute force
  const body = await request.json();
  // ...
}
```

### ✅ CÓDIGO CORRECTO
```typescript
// src/core/middleware/rate-limit.ts
import { NextRequest } from 'next/server';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();

  // Limpiar entradas expiradas
  for (const [k, v] of requestCounts.entries()) {
    if (v.resetAt < now) {
      requestCounts.delete(k);
    }
  }

  // Obtener o crear contador
  let entry = requestCounts.get(key);
  
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    requestCounts.set(key, entry);
  }

  // Incrementar contador
  entry.count++;

  // Verificar límite
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

// src/app/api/admin/employees/route.ts
import { rateLimit } from '@/src/core/middleware/rate-limit';

export async function POST(request: NextRequest) {
  // ✅ CORRECTO - Rate limiting
  const rateLimitResult = await rateLimit(request, {
    maxRequests: 10,
    windowMs: 60000, // 10 requests per minute
  });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Demasiados intentos. Intenta en 1 minuto.',
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      }
    );
  }

  // Continuar con la lógica normal...
  const authResult = await requireAdminAuth(request);
  // ...
}
```

---

## 🔴 PROBLEMA 5: Sin Configuración CORS

### ❌ CÓDIGO ACTUAL (INCORRECTO)
```typescript
// ❌ No hay configuración CORS
// Navegadores bloquean requests cross-origin
```

### ✅ CÓDIGO CORRECTO
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        // ✅ Aplicar a todas las rutas API
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            // ✅ Whitelist de orígenes permitidos
            value: process.env.ALLOWED_ORIGINS || 'https://parkpos.com',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            // ✅ Permitir cookies (httpOnly)
            value: 'true',
          },
          {
            key: 'Access-Control-Max-Age',
            // ✅ Cache preflight por 1 hora
            value: '3600',
          },
        ],
      },
    ];
  },
};

// .env.production
ALLOWED_ORIGINS=https://parkpos.com,https://admin.parkpos.com

// src/app/api/admin/[...]/route.ts
export async function OPTIONS(request: NextRequest) {
  // ✅ Manejar preflight requests
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
```

---

## 🔴 PROBLEMA 6: Race Condition catalog_version

### ❌ CÓDIGO ACTUAL (INCORRECTO)
```typescript
// src/app/api/admin/products/route.ts
const product = await prisma.$transaction(async (tx) => {
  const newProduct = await tx.products.create({ data: {...} });

  // ❌ Race condition - dos requests simultáneos
  await tx.catalog_meta.upsert({
    where: { tenant_id: TENANT_ID },
    update: {
      catalog_version: { increment: 1 }, // ❌ No es atómico
    },
  });

  return newProduct;
});
```

### ✅ CÓDIGO CORRECTO - Opción 1: Raw SQL
```typescript
// src/app/api/admin/products/route.ts
const product = await prisma.$transaction(async (tx) => {
  const newProduct = await tx.products.create({ data: {...} });

  // ✅ CORRECTO - Atómico con raw SQL
  const [catalogMeta] = await tx.$queryRaw<Array<{ catalog_version: number }>>`
    INSERT INTO catalog_meta (tenant_id, catalog_version, updated_at)
    VALUES (${TENANT_ID}, 1, NOW())
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      catalog_version = catalog_meta.catalog_version + 1,
      updated_at = NOW()
    RETURNING catalog_version
  `;

  console.log(`Catalog version updated to ${catalogMeta.catalog_version}`);

  await tx.admin_access_logs.create({ data: {...} });

  return newProduct;
});
```

### ✅ CÓDIGO CORRECTO - Opción 2: Optimistic Locking
```typescript
// src/app/api/admin/products/route.ts
const MAX_RETRIES = 3;

for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  try {
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.products.create({ data: {...} });

      // ✅ CORRECTO - Leer versión actual
      const currentMeta = await tx.catalog_meta.findUnique({
        where: { tenant_id: TENANT_ID },
        select: { catalog_version: true },
      });

      const currentVersion = currentMeta?.catalog_version || 0;

      // ✅ CORRECTO - Update con versión específica
      await tx.catalog_meta.upsert({
        where: {
          tenant_id: TENANT_ID,
          catalog_version: currentVersion, // ❌ Falla si cambió
        },
        create: {
          tenant_id: TENANT_ID,
          catalog_version: 1,
          updated_at: new Date(),
        },
        update: {
          catalog_version: currentVersion + 1,
          updated_at: new Date(),
        },
      });

      await tx.admin_access_logs.create({ data: {...} });

      return newProduct;
    });

    // ✅ Éxito - salir del loop
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    // ✅ Si falla por versión, reintentar
    if (attempt === MAX_RETRIES - 1) {
      throw error;
    }
    // Esperar un poco antes de reintentar
    await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
  }
}
```

---

## 🎯 RESUMEN DE IMPLEMENTACIÓN

### Orden Recomendado
1. **Rate Limiting** (8h) - Protección inmediata
2. **CORS** (4h) - Configuración rápida
3. **httpOnly Cookies** (4h) - Migración de auth
4. **Eliminar useAdminAuth** (6h) - Limpieza
5. **Paginación** (20h) - Estabilidad
6. **Race Condition** (6h) - Integridad

### Testing
Cada solución debe incluir:
- ✅ Unit tests
- ✅ Integration tests
- ✅ Manual testing en dev
- ✅ Staging deployment
- ✅ Production deployment

### Rollback Plan
- Mantener código viejo comentado por 1 semana
- Feature flags para activar/desactivar
- Monitoring de errores
- Rollback automático si error rate > 5%

---

**Última actualización:** 20 Enero 2026  
**Próxima acción:** Implementar en orden recomendado
