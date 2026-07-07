# 🔐 FLUJO DE AUTENTICACIÓN Y ROLES — Diseño

> **Documento:** Sistema de autenticación (NO existe actualmente)  
> **Fecha:** Enero 2026  
> **Estado:** Diseño desde cero — TODO está hardcodeado

---

## 📋 ÍNDICE

1. [Estado Actual](#estado-actual)
2. [Roles del Sistema](#roles-del-sistema)
3. [Escenarios Reales](#escenarios-reales)
4. [Diseño Propuesto](#diseño-propuesto)
5. [Implementación](#implementación)

---

## ESTADO ACTUAL

### Lo que existe (NADA)

```typescript
// src/app/(pos)/page.tsx - Líneas 17-20
const TENANT_ID = "00000000-0000-0000-0000-000000000001";  // ❌ HARDCODED
const TERM_ID = "term_1";                                   // ❌ HARDCODED
const ACTOR_ID = "00000000-0000-0000-0000-000000000001";   // ❌ HARDCODED

// src/app/kds/page.tsx - Líneas 13-16
const TENANT_ID = "00000000-0000-0000-0000-000000000001";  // ❌ HARDCODED
const TERM_ID = "kds_1";                                    // ❌ HARDCODED
const ACTOR_ID = "00000000-0000-0000-0000-000000000002";   // ❌ HARDCODED (Chef)

// src/app/waiter/order/[tableId]/page.tsx - Líneas 16-19
const TENANT_ID = "00000000-0000-0000-0000-000000000001";  // ❌ HARDCODED
const TERMINAL_ID = "waiter_1";                             // ❌ HARDCODED
const ACTOR_ID = "00000000-0000-0000-0000-000000000002";   // ❌ HARDCODED
```

### Problemas Críticos

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Sin login | Cualquiera accede a cualquier rol |
| 2 | Sin identificación de cajero | No hay auditoría de quién hizo qué |
| 3 | Sin permisos | Mesero puede cerrar turno de caja |
| 4 | Sin PINs | Descuentos sin autorización |
| 5 | Todos son el mismo tenant | Multi-tenant roto |
| 6 | Todos son el mismo terminal | Colisiones de order_number |

---

## ROLES DEL SISTEMA

### Matriz de Roles y Permisos

| Permiso | Cajero | Mesero | Cocinero | Supervisor | Admin |
|---------|--------|--------|----------|------------|-------|
| Abrir turno | ✅ | ❌ | ❌ | ✅ | ✅ |
| Cerrar turno | ✅ | ❌ | ❌ | ✅ | ✅ |
| Crear orden | ✅ | ✅ | ❌ | ✅ | ✅ |
| Agregar items | ✅ | ✅ | ❌ | ✅ | ✅ |
| Cobrar | ✅ | ❌ | ❌ | ✅ | ✅ |
| Descuento ≤10% | ✅ | ❌ | ❌ | ✅ | ✅ |
| Descuento ≤20% | ❌ | ❌ | ❌ | ✅ | ✅ |
| Descuento >20% | ❌ | ❌ | ❌ | ❌ | ✅ |
| Anular orden | ❌ | ❌ | ❌ | ✅ | ✅ |
| Devolución | ❌ | ❌ | ❌ | ✅ | ✅ |
| Ver KDS | ❌ | ❌ | ✅ | ✅ | ✅ |
| Cambiar estado item | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ver reportes | ❌ | ❌ | ❌ | ✅ | ✅ |
| Configurar sistema | ❌ | ❌ | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ❌ | ❌ | ✅ |

### Definición de Roles

```typescript
type Role = 
  | "CASHIER"      // Cajero - Opera caja, cobra, emite boletas
  | "WAITER"       // Mesero - Toma pedidos, ve estado de mesas
  | "COOK"         // Cocinero - Ve KDS, cambia estado de items
  | "SUPERVISOR"   // Supervisor - Autoriza descuentos, anulaciones
  | "ADMIN";       // Admin - Todo, incluyendo configuración

interface User {
  user_id: string;
  tenant_id: string;
  name: string;
  email?: string;
  pin: string;           // PIN de 4-6 dígitos para acceso rápido
  password_hash?: string; // Para login web (admin)
  role: Role;
  is_active: boolean;
  created_at: Date;
}
```

---

## ESCENARIOS REALES

### ESCENARIO A1: Inicio de Día - Cajero Llega

```
SITUACIÓN:
- María (cajera) llega a las 10:45 AM
- Debe abrir su turno en la caja

FLUJO ESPERADO:
1. María enciende el terminal de caja
2. Sistema muestra pantalla de LOGIN
3. María ingresa su PIN: 1234
4. Sistema valida:
   - PIN existe
   - Usuario activo
   - Rol = CASHIER o superior
5. Sistema muestra: "Bienvenida, María"
6. Sistema detecta: No hay turno abierto
7. María presiona "Abrir Turno"
8. Ingresa fondo de caja: S/ 200
9. Sistema genera SHIFT_OPENED con actor_id = María

ESTADO ACTUAL: ❌ NO EXISTE
- No hay login
- No hay validación de PIN
- actor_id es hardcoded
```

### ESCENARIO A2: Mesero Inicia Sesión en Tablet

```
SITUACIÓN:
- Pedro (mesero) toma una tablet
- Debe identificarse para tomar pedidos

FLUJO ESPERADO:
1. Pedro abre app en tablet
2. Sistema muestra pantalla de LOGIN
3. Pedro ingresa su PIN: 5678
4. Sistema valida:
   - PIN existe
   - Usuario activo
   - Rol = WAITER o superior
5. Sistema muestra mapa de mesas
6. Todos los pedidos de Pedro quedan registrados con su actor_id

ESTADO ACTUAL: ❌ NO EXISTE
- Cualquiera puede usar cualquier tablet
- No hay identificación de mesero
- No hay comisiones/propinas por mesero
```

### ESCENARIO A3: Descuento Requiere Autorización

```
SITUACIÓN:
- María (cajera) quiere dar 25% de descuento
- Política: >20% requiere Admin

FLUJO ESPERADO:
1. María aplica 25% de descuento
2. Sistema detecta: 25% > 20% (límite de cajero)
3. Sistema muestra: "Requiere autorización de Admin"
4. María llama a Carlos (admin)
5. Carlos ingresa su PIN: 9999
6. Sistema valida:
   - PIN de Carlos
   - Carlos tiene rol ADMIN
7. Sistema aplica descuento
8. Evento registra:
   - actor_id: María (quien aplicó)
   - authorized_by: Carlos (quien autorizó)

ESTADO ACTUAL: ❌ NO EXISTE
- No hay límites de descuento
- No hay autorización
- No hay PINs
```

### ESCENARIO A4: Cambio de Turno

```
SITUACIÓN:
- María termina turno a las 5 PM
- Pedro (cajero tarde) la reemplaza

FLUJO ESPERADO:
1. María presiona "Cerrar Turno"
2. Sistema pide arqueo de caja
3. María cuenta: S/ 1,285
4. Sistema calcula diferencia
5. María confirma cierre
6. Sistema genera SHIFT_CLOSED con actor_id = María
7. Sistema muestra pantalla de LOGIN
8. Pedro ingresa su PIN
9. Pedro abre nuevo turno
10. Sistema genera SHIFT_OPENED con actor_id = Pedro

ESTADO ACTUAL: ⚠️ PARCIAL
- Cierre de turno existe
- Pero no hay cambio de usuario
- Mismo actor_id para ambos turnos
```

### ESCENARIO A5: Intento de Acceso No Autorizado

```
SITUACIÓN:
- Mesero intenta acceder a reportes de ventas

FLUJO ESPERADO:
1. Mesero navega a /admin/reports
2. Sistema verifica rol del usuario actual
3. Rol = WAITER, no tiene permiso
4. Sistema redirige a /waiter con mensaje:
   "No tienes permiso para acceder a esta sección"
5. Intento queda registrado en logs

ESTADO ACTUAL: ❌ NO EXISTE
- Cualquiera puede acceder a cualquier URL
- No hay middleware de autorización
- No hay logs de acceso
```

### ESCENARIO A6: PIN Olvidado

```
SITUACIÓN:
- María olvidó su PIN

FLUJO ESPERADO:
1. María intenta login, falla 3 veces
2. Sistema bloquea cuenta temporalmente (5 min)
3. María contacta a Admin
4. Admin accede a panel de usuarios
5. Admin resetea PIN de María
6. María recibe nuevo PIN temporal
7. María debe cambiar PIN en primer login

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A7: Sesión Expirada

```
SITUACIÓN:
- Cajero deja terminal sin usar por 30 minutos

FLUJO ESPERADO:
1. Sistema detecta inactividad > 30 min
2. Sistema bloquea pantalla (no cierra sesión)
3. Muestra: "Sesión bloqueada - Ingrese PIN"
4. Cajero ingresa PIN para continuar
5. Si es otro usuario, puede iniciar su sesión

ESTADO ACTUAL: ❌ NO EXISTE
- Terminal queda abierto indefinidamente
- Cualquiera puede operar
```

---

## DISEÑO PROPUESTO

### Modelo de Datos

```prisma
// prisma/schema.prisma

model User {
  id            String   @id @default(uuid()) @db.Uuid
  tenant_id     String   @db.Uuid
  tenant        Tenant   @relation(fields: [tenant_id], references: [id])
  
  name          String
  email         String?
  pin_hash      String   // bcrypt hash del PIN
  password_hash String?  // Para login web
  
  role          Role     @default(CASHIER)
  is_active     Boolean  @default(true)
  
  // Seguridad
  failed_attempts Int     @default(0)
  locked_until    DateTime?
  last_login      DateTime?
  
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  
  // Relaciones
  shifts_opened Shift[]  @relation("ShiftOpenedBy")
  shifts_closed Shift[]  @relation("ShiftClosedBy")
  
  @@unique([tenant_id, email])
  @@index([tenant_id, pin_hash])
  @@map("users")
}

enum Role {
  CASHIER
  WAITER
  COOK
  SUPERVISOR
  ADMIN
}

model Session {
  id          String   @id @default(uuid()) @db.Uuid
  user_id     String   @db.Uuid
  terminal_id String
  
  started_at  DateTime @default(now())
  expires_at  DateTime
  is_active   Boolean  @default(true)
  
  @@index([user_id, is_active])
  @@index([terminal_id, is_active])
  @@map("sessions")
}

model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  tenant_id   String   @db.Uuid
  user_id     String?  @db.Uuid
  terminal_id String?
  
  action      String   // LOGIN, LOGOUT, ACCESS_DENIED, etc.
  resource    String?  // /admin/reports, ORDER:123, etc.
  details     Json?
  ip_address  String?
  
  created_at  DateTime @default(now())
  
  @@index([tenant_id, created_at])
  @@index([user_id, created_at])
  @@map("audit_logs")
}
```

### Flujo de Autenticación

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE LOGIN                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │  LOGIN   │────>│ VALIDAR  │────>│ CREAR    │                │
│  │  SCREEN  │     │   PIN    │     │ SESSION  │                │
│  └──────────┘     └────┬─────┘     └────┬─────┘                │
│                        │                │                       │
│                   ┌────▼────┐      ┌────▼────┐                 │
│                   │ VÁLIDO? │      │ GUARDAR │                 │
│                   └────┬────┘      │ LOCAL   │                 │
│                        │           └────┬────┘                 │
│              ┌─────────┼─────────┐      │                      │
│              │         │         │      │                      │
│              ▼         ▼         ▼      ▼                      │
│         ┌────────┐ ┌────────┐ ┌────────────┐                   │
│         │ LOCKED │ │ FAILED │ │ REDIRECT   │                   │
│         │ (5min) │ │ +1 att │ │ TO ROLE UI │                   │
│         └────────┘ └────────┘ └────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### API de Autenticación

```typescript
// POST /api/auth/login
interface LoginRequest {
  pin: string;
  terminal_id: string;
}

interface LoginResponse {
  success: boolean;
  user?: {
    user_id: string;
    name: string;
    role: Role;
  };
  session_token?: string;
  error?: string;
}

// POST /api/auth/logout
interface LogoutRequest {
  session_token: string;
}

// POST /api/auth/authorize
// Para autorización de acciones que requieren supervisor/admin
interface AuthorizeRequest {
  pin: string;
  action: string;  // "DISCOUNT_25", "VOID_ORDER", etc.
  resource_id?: string;
}

interface AuthorizeResponse {
  authorized: boolean;
  authorizer_id?: string;
  authorizer_name?: string;
  error?: string;
}
```

### Contexto de Sesión (Cliente)

```typescript
// src/core/auth/session-context.tsx

interface SessionState {
  user: {
    user_id: string;
    name: string;
    role: Role;
  } | null;
  tenant_id: string;
  terminal_id: string;
  session_token: string | null;
  is_locked: boolean;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  
  // Cargar sesión de localStorage al iniciar
  useEffect(() => {
    const stored = localStorage.getItem('park_session');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validar que no haya expirado
      if (new Date(parsed.expires_at) > new Date()) {
        setSession(parsed);
      } else {
        localStorage.removeItem('park_session');
      }
    }
  }, []);
  
  // Auto-lock por inactividad
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setSession(s => s ? { ...s, is_locked: true } : null);
      }, 30 * 60 * 1000); // 30 minutos
    };
    
    window.addEventListener('click', resetTimer);
    window.addEventListener('keypress', resetTimer);
    resetTimer();
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keypress', resetTimer);
    };
  }, []);
  
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return session;
}

export function useRequireRole(requiredRole: Role) {
  const session = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (!session.user) {
      router.push('/login');
      return;
    }
    
    if (!hasPermission(session.user.role, requiredRole)) {
      router.push('/unauthorized');
    }
  }, [session, requiredRole]);
  
  return session;
}
```

### Middleware de Autorización

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROLE_ROUTES: Record<string, Role[]> = {
  '/pos': ['CASHIER', 'SUPERVISOR', 'ADMIN'],
  '/waiter': ['WAITER', 'SUPERVISOR', 'ADMIN'],
  '/kds': ['COOK', 'SUPERVISOR', 'ADMIN'],
  '/admin': ['SUPERVISOR', 'ADMIN'],
  '/admin/config': ['ADMIN'],
  '/admin/users': ['ADMIN'],
};

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Rutas públicas
  if (path === '/login' || path === '/setup') {
    return NextResponse.next();
  }
  
  // Verificar sesión
  const sessionToken = request.cookies.get('park_session')?.value;
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Verificar rol para la ruta
  const requiredRoles = Object.entries(ROLE_ROUTES)
    .find(([route]) => path.startsWith(route))?.[1];
  
  if (requiredRoles) {
    // Decodificar token y verificar rol
    // (En producción usar JWT verificado)
    const session = decodeSession(sessionToken);
    if (!session || !requiredRoles.includes(session.role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### UI de Login

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         🍗 FIRMO POS                             │
│                                                                 │
│                    ┌─────────────────────┐                      │
│                    │                     │                      │
│                    │    INGRESE PIN      │                      │
│                    │                     │                      │
│                    │    ● ● ● ○ ○ ○      │                      │
│                    │                     │                      │
│                    │  ┌───┬───┬───┐      │                      │
│                    │  │ 1 │ 2 │ 3 │      │                      │
│                    │  ├───┼───┼───┤      │                      │
│                    │  │ 4 │ 5 │ 6 │      │                      │
│                    │  ├───┼───┼───┤      │                      │
│                    │  │ 7 │ 8 │ 9 │      │                      │
│                    │  ├───┼───┼───┤      │                      │
│                    │  │ ← │ 0 │ ✓ │      │                      │
│                    │  └───┴───┴───┘      │                      │
│                    │                     │                      │
│                    └─────────────────────┘                      │
│                                                                 │
│                    Terminal: CAJA-01                            │
│                    Pollería "El Sabrosón"                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Modal de Autorización

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              ⚠️ AUTORIZACIÓN REQUERIDA                          │
│                                                                 │
│    Acción: Descuento 25%                                        │
│    Requiere: Supervisor o Admin                                 │
│                                                                 │
│    ┌─────────────────────────────────────────┐                  │
│    │                                         │                  │
│    │    PIN del Supervisor:                  │                  │
│    │                                         │                  │
│    │    ● ● ● ○ ○ ○                          │                  │
│    │                                         │                  │
│    │    ┌───┬───┬───┐                        │                  │
│    │    │ 1 │ 2 │ 3 │                        │                  │
│    │    ├───┼───┼───┤                        │                  │
│    │    │ 4 │ 5 │ 6 │                        │                  │
│    │    ├───┼───┼───┤                        │                  │
│    │    │ 7 │ 8 │ 9 │                        │                  │
│    │    ├───┼───┼───┤                        │                  │
│    │    │ ← │ 0 │ ✓ │                        │                  │
│    │    └───┴───┴───┘                        │                  │
│    │                                         │                  │
│    └─────────────────────────────────────────┘                  │
│                                                                 │
│    [CANCELAR]                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTACIÓN

### Fase 1: Modelo de Datos (2h)

```
1. Agregar modelos a Prisma:
   - User
   - Session
   - AuditLog
   
2. Migración:
   npx prisma migrate dev --name add_auth_models
   
3. Seed de usuarios iniciales:
   - Admin: PIN 9999
   - Cajero: PIN 1234
   - Mesero: PIN 5678
   - Cocinero: PIN 4321
```

### Fase 2: API de Auth (4h)

```
1. POST /api/auth/login
2. POST /api/auth/logout
3. POST /api/auth/authorize
4. GET /api/auth/me
5. Middleware de validación
```

### Fase 3: UI de Login (4h)

```
1. Página /login con teclado numérico
2. Componente PinInput
3. Modal de autorización reutilizable
4. Pantalla de bloqueo por inactividad
```

### Fase 4: Integración (4h)

```
1. SessionProvider en layout
2. useSession hook en cada página
3. Reemplazar constantes hardcodeadas
4. Agregar actor_id dinámico a eventos
```

### Fase 5: Auditoría (2h)

```
1. Log de login/logout
2. Log de accesos denegados
3. Log de autorizaciones
4. Panel de auditoría para admin
```

---

## PRIORIDADES

| # | Feature | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|----------|-----------|
| 1 | Login con PIN | Alto | 4h | 🔴 P0 |
| 2 | SessionContext | Alto | 2h | 🔴 P0 |
| 3 | actor_id dinámico | Alto | 2h | 🔴 P0 |
| 4 | Middleware de roles | Alto | 2h | 🔴 P0 |
| 5 | Modal de autorización | Medio | 3h | 🟡 P1 |
| 6 | Auto-lock | Medio | 2h | 🟡 P1 |
| 7 | Audit logs | Medio | 3h | 🟡 P1 |
| 8 | Reset de PIN | Bajo | 2h | 🟢 P2 |

---

**Documento creado:** Enero 2026
