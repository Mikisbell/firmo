# ⚙️ FLUJO DE CONFIGURACIÓN Y SETUP — Diseño

> **Documento:** Sistema de configuración inicial (NO existe actualmente)  
> **Fecha:** Enero 2026  
> **Estado:** Diseño desde cero — TODO está hardcodeado

---

## 📋 ÍNDICE

1. [Estado Actual](#estado-actual)
2. [Configuraciones Necesarias](#configuraciones-necesarias)
3. [Escenarios Reales](#escenarios-reales)
4. [Diseño Propuesto](#diseño-propuesto)
5. [Implementación](#implementación)

---

## ESTADO ACTUAL

### Lo que existe (NADA)

```typescript
// Cada página tiene sus propias constantes hardcodeadas:

// src/app/(pos)/page.tsx
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TERM_ID = "term_1";

// src/app/kds/page.tsx  
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TERM_ID = "kds_1";

// src/app/waiter/order/[tableId]/page.tsx
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TERMINAL_ID = "waiter_1";

// src/core/sync/client.ts
const tenantId = "00000000-0000-0000-0000-000000000001"; // TODO: Get from context
```

### Problemas Críticos

| # | Problema | Impacto |
|---|----------|---------|
| 1 | tenant_id hardcodeado | Multi-tenant imposible |
| 2 | terminal_id hardcodeado | Colisiones de order_number |
| 3 | Sin registro de terminal | No hay control de dispositivos |
| 4 | Sin configuración de negocio | Impuestos, moneda, etc. fijos |
| 5 | Sin setup inicial | No hay onboarding |


---

## CONFIGURACIONES NECESARIAS

### Nivel 1: Tenant (Negocio)

```typescript
interface TenantConfig {
  tenant_id: string;
  name: string;                    // "Pollería El Sabrosón"
  ruc: string;                     // RUC para facturación
  business_name: string;           // Razón social
  address: string;
  
  // Configuración fiscal
  tax_rate: number;                // 18% IGV en Perú
  currency: "PEN" | "USD";
  
  // Configuración operativa
  timezone: string;                // "America/Lima"
  business_hours: {
    open: string;                  // "11:00"
    close: string;                 // "23:00"
  };
  
  // Facturación electrónica
  sunat_user?: string;
  sunat_password?: string;
  certificate_path?: string;
  
  // Branding
  logo_url?: string;
  receipt_footer?: string;
}
```

### Nivel 2: Terminal (Dispositivo)

```typescript
interface TerminalConfig {
  terminal_id: string;
  tenant_id: string;
  
  name: string;                    // "CAJA-01", "MESA-TABLET-03"
  type: "POS" | "KDS" | "WAITER" | "ADMIN";
  
  // Identificación única
  device_fingerprint: string;      // Hash de hardware
  registered_at: Date;
  last_seen_at: Date;
  
  // Para order numbers
  number_range_start: number;      // 1000
  number_range_end: number;        // 1999
  current_number: number;          // 1045
  
  // Estado
  is_active: boolean;
  is_online: boolean;
}
```

### Nivel 3: Usuario (Persona)

```typescript
// Ver FLUJO_AUTENTICACION.md para detalle completo
interface UserConfig {
  user_id: string;
  tenant_id: string;
  name: string;
  pin_hash: string;
  role: Role;
}
```

---

## ESCENARIOS REALES

### ESCENARIO C1: Primera Instalación (Onboarding)

```
SITUACIÓN:
- Pollería nueva compra el sistema
- Técnico llega a instalar

FLUJO ESPERADO:
1. Técnico abre app en PC principal (será caja)
2. Sistema detecta: No hay configuración
3. Muestra wizard de setup:

   PASO 1: Datos del Negocio
   ┌─────────────────────────────────────────┐
   │ Nombre: [Pollería El Sabrosón        ]  │
   │ RUC:    [20123456789                 ]  │
   │ Dirección: [Av. Principal 123        ]  │
   └─────────────────────────────────────────┘

   PASO 2: Configuración Fiscal
   ┌─────────────────────────────────────────┐
   │ IGV: [18]%                              │
   │ Moneda: (●) Soles  ( ) Dólares          │
   │ Zona horaria: [America/Lima         ▼]  │
   └─────────────────────────────────────────┘

   PASO 3: Primer Usuario (Admin)
   ┌─────────────────────────────────────────┐
   │ Nombre: [Carlos Administrador        ]  │
   │ PIN:    [****]  Confirmar: [****]       │
   │ Email:  [carlos@polleria.com         ]  │
   └─────────────────────────────────────────┘

   PASO 4: Registrar Terminal
   ┌─────────────────────────────────────────┐
   │ Nombre: [CAJA-01                     ]  │
   │ Tipo:   (●) Caja  ( ) KDS  ( ) Mesero   │
   │ Rango números: [1] - [999]              │
   └─────────────────────────────────────────┘

4. Sistema crea tenant + admin + terminal
5. Sistema guarda config en localStorage
6. Redirige a login

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO C2: Agregar Nueva Tablet de Mesero

```
SITUACIÓN:
- Pollería ya funciona con 1 caja
- Compran tablet para meseros

FLUJO ESPERADO:
1. Admin abre tablet nueva
2. Sistema detecta: No hay terminal registrado
3. Muestra pantalla de registro:

   ┌─────────────────────────────────────────┐
   │         REGISTRAR TERMINAL              │
   │                                         │
   │  Código de activación:                  │
   │  [____]-[____]-[____]                   │
   │                                         │
   │  (Solicitar código al administrador)    │
   └─────────────────────────────────────────┘

4. Admin genera código en panel:
   - Panel Admin → Terminales → Nuevo
   - Sistema genera: "A1B2-C3D4-E5F6"
   - Código válido por 24 horas

5. Técnico ingresa código en tablet
6. Sistema valida código
7. Sistema registra terminal:
   - terminal_id: auto-generado
   - type: WAITER
   - number_range: 5000-5999
8. Tablet lista para usar

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO C3: Terminal Perdido/Robado

```
SITUACIÓN:
- Tablet de mesero se pierde
- Necesitan desactivarla

FLUJO ESPERADO:
1. Admin accede a Panel → Terminales
2. Ve lista de terminales:
   
   | Terminal    | Tipo   | Último uso    | Estado  |
   |-------------|--------|---------------|---------|
   | CAJA-01     | POS    | Hace 5 min    | 🟢 Online |
   | MESA-01     | WAITER | Hace 2 días   | 🔴 Offline |
   | KDS-COCINA  | KDS    | Hace 10 min   | 🟢 Online |

3. Admin selecciona MESA-01
4. Admin presiona "Desactivar"
5. Sistema:
   - Marca terminal como inactivo
   - Invalida sesiones activas
   - Bloquea sincronización
6. Si tablet intenta conectar → "Terminal desactivado"

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO C4: Cambiar Configuración de Impuestos

```
SITUACIÓN:
- Gobierno cambia IGV de 18% a 19%
- Deben actualizar el sistema

FLUJO ESPERADO:
1. Admin accede a Panel → Configuración → Fiscal
2. Cambia IGV: 18% → 19%
3. Sistema pregunta: "¿Desde cuándo aplica?"
   - ( ) Inmediatamente
   - (●) Desde fecha: [01/02/2026]
4. Admin confirma
5. Sistema:
   - Guarda nueva configuración
   - Programa cambio para fecha indicada
   - Notifica a todos los terminales
6. El día indicado, precios se recalculan

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO C5: Backup y Restauración

```
SITUACIÓN:
- PC de caja se daña
- Necesitan restaurar en PC nuevo

FLUJO ESPERADO:
1. Técnico instala app en PC nuevo
2. Sistema detecta: No hay configuración
3. Opciones:
   - [Nueva instalación]
   - [Restaurar terminal existente]
4. Técnico elige "Restaurar"
5. Sistema pide:
   - Código de restauración (del admin)
   - O archivo de backup
6. Sistema restaura:
   - Configuración del terminal
   - Eventos pendientes de sync (si hay backup)
7. Terminal listo con mismo ID

ESTADO ACTUAL: ❌ NO EXISTE
```

---

## DISEÑO PROPUESTO

### Modelo de Datos

```prisma
// prisma/schema.prisma

model Tenant {
  id              String   @id @default(uuid()) @db.Uuid
  name            String
  ruc             String   @unique
  business_name   String
  address         String?
  
  // Fiscal
  tax_rate        Decimal  @default(18) @db.Decimal(5, 2)
  currency        String   @default("PEN")
  timezone        String   @default("America/Lima")
  
  // Horario
  opens_at        String   @default("11:00")
  closes_at       String   @default("23:00")
  
  // SUNAT (encriptado)
  sunat_config    Json?
  
  // Branding
  logo_url        String?
  receipt_header  String?
  receipt_footer  String?
  
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  
  // Relaciones
  terminals       Terminal[]
  users           User[]
  
  @@map("tenants")
}

model Terminal {
  id                  String   @id @default(uuid()) @db.Uuid
  tenant_id           String   @db.Uuid
  tenant              Tenant   @relation(fields: [tenant_id], references: [id])
  
  name                String
  type                TerminalType
  device_fingerprint  String?
  
  // Order number range
  number_range_start  Int
  number_range_end    Int
  current_number      Int
  
  // Estado
  is_active           Boolean  @default(true)
  last_seen_at        DateTime?
  
  // Activación
  activation_code     String?
  activation_expires  DateTime?
  
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
  
  @@unique([tenant_id, name])
  @@index([activation_code])
  @@map("terminals")
}

enum TerminalType {
  POS
  KDS
  WAITER
  ADMIN
}

model TerminalNumberRange {
  id            String   @id @default(uuid()) @db.Uuid
  tenant_id     String   @db.Uuid
  terminal_id   String   @db.Uuid
  
  range_start   Int
  range_end     Int
  current       Int
  
  allocated_at  DateTime @default(now())
  exhausted_at  DateTime?
  
  @@unique([tenant_id, terminal_id, range_start])
  @@map("terminal_number_ranges")
}
```

### Almacenamiento Local

```typescript
// src/core/config/local-config.ts

interface LocalConfig {
  tenant_id: string;
  terminal_id: string;
  terminal_name: string;
  terminal_type: TerminalType;
  
  // Cache de configuración del tenant
  tenant_config: {
    name: string;
    tax_rate: number;
    currency: string;
    timezone: string;
  };
  
  // Order numbers
  number_range: {
    start: number;
    end: number;
    current: number;
  };
  
  // Sync
  last_sync_at: string;
  server_url: string;
}

const CONFIG_KEY = 'park_terminal_config';

export function getLocalConfig(): LocalConfig | null {
  const stored = localStorage.getItem(CONFIG_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function setLocalConfig(config: LocalConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearLocalConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

// Hook para usar en componentes
export function useTerminalConfig() {
  const [config, setConfig] = useState<LocalConfig | null>(null);
  
  useEffect(() => {
    setConfig(getLocalConfig());
  }, []);
  
  return config;
}
```

### API de Configuración

```typescript
// POST /api/setup/tenant - Crear tenant (onboarding)
interface CreateTenantRequest {
  name: string;
  ruc: string;
  business_name: string;
  address?: string;
  admin_name: string;
  admin_pin: string;
  admin_email?: string;
}

// POST /api/setup/terminal - Registrar terminal
interface RegisterTerminalRequest {
  activation_code: string;
  device_fingerprint: string;
}

// POST /api/admin/terminals/activate - Generar código
interface GenerateActivationRequest {
  terminal_name: string;
  terminal_type: TerminalType;
}

// GET /api/config/tenant - Obtener config del tenant
// PUT /api/config/tenant - Actualizar config

// GET /api/terminals/:id/number-range - Obtener rango actual
// POST /api/terminals/:id/number-range/allocate - Solicitar nuevo rango
```

### Flujo de Order Numbers (Range Allocation)

```typescript
// src/core/config/order-numbers.ts

const RANGE_SIZE = 1000; // Cada terminal recibe 1000 números

export async function getNextOrderNumber(): Promise<number> {
  const config = getLocalConfig();
  if (!config) throw new Error('Terminal not configured');
  
  const { number_range } = config;
  
  // ¿Tenemos números disponibles?
  if (number_range.current < number_range.end) {
    const next = number_range.current + 1;
    
    // Actualizar local
    setLocalConfig({
      ...config,
      number_range: { ...number_range, current: next }
    });
    
    return next;
  }
  
  // Necesitamos nuevo rango
  const newRange = await requestNewRange(config.terminal_id);
  
  setLocalConfig({
    ...config,
    number_range: newRange
  });
  
  return newRange.start;
}

async function requestNewRange(terminalId: string): Promise<NumberRange> {
  // Si estamos offline, usar rango de emergencia
  if (!navigator.onLine) {
    return getEmergencyRange(terminalId);
  }
  
  const response = await fetch(`/api/terminals/${terminalId}/number-range/allocate`, {
    method: 'POST'
  });
  
  if (!response.ok) {
    return getEmergencyRange(terminalId);
  }
  
  return response.json();
}

function getEmergencyRange(terminalId: string): NumberRange {
  // Rango temporal basado en timestamp para evitar colisiones
  const base = Date.now() % 1000000;
  return {
    start: base,
    end: base + 99,
    current: base,
    is_emergency: true
  };
}
```

---

## UI PROPUESTA

### Wizard de Onboarding

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    🍗 PARK POS                                  │
│                    Configuración Inicial                        │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  [1. Negocio]  [2. Fiscal]  [3. Admin]  [4. Terminal]           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  DATOS DEL NEGOCIO                                      │   │
│  │                                                         │   │
│  │  Nombre comercial:                                      │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ Pollería El Sabrosón                            │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  RUC:                                                   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ 20123456789                                     │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  Razón Social:                                          │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ INVERSIONES EL SABROSÓN S.A.C.                  │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  Dirección:                                             │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ Av. Principal 123, Lima                         │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                        [Siguiente →]            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Panel de Terminales (Admin)

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ ADMINISTRACIÓN > TERMINALES                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [+ Nuevo Terminal]                          🔍 Buscar...       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Terminal      │ Tipo    │ Rango      │ Último    │ Estado│   │
│  ├───────────────┼─────────┼────────────┼───────────┼───────┤   │
│  │ CAJA-01       │ POS     │ 1-999      │ Hace 2min │ 🟢    │   │
│  │ CAJA-02       │ POS     │ 1000-1999  │ Hace 5min │ 🟢    │   │
│  │ KDS-COCINA    │ KDS     │ -          │ Hace 1min │ 🟢    │   │
│  │ KDS-PARRILLA  │ KDS     │ -          │ Hace 3min │ 🟢    │   │
│  │ MESA-01       │ WAITER  │ 5000-5999  │ Hace 1hr  │ 🟡    │   │
│  │ MESA-02       │ WAITER  │ 6000-6999  │ 2 días    │ 🔴    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  CÓDIGOS DE ACTIVACIÓN PENDIENTES:                              │
│                                                                 │
│  │ Código          │ Para        │ Expira      │ Acción    │   │
│  ├─────────────────┼─────────────┼─────────────┼───────────┤   │
│  │ A1B2-C3D4-E5F6  │ MESA-03     │ En 23 horas │ [Cancelar]│   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Pantalla de Registro de Terminal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    🍗 PARK POS                                  │
│                                                                 │
│                    REGISTRAR TERMINAL                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Este dispositivo no está registrado.                   │   │
│  │                                                         │   │
│  │  Ingrese el código de activación proporcionado          │   │
│  │  por el administrador:                                  │   │
│  │                                                         │   │
│  │         ┌────┐  ┌────┐  ┌────┐                         │   │
│  │         │A1B2│ -│C3D4│ -│E5F6│                         │   │
│  │         └────┘  └────┘  └────┘                         │   │
│  │                                                         │   │
│  │                   [ACTIVAR]                             │   │
│  │                                                         │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │                                                         │   │
│  │  ¿No tiene código?                                      │   │
│  │  Contacte al administrador del sistema.                 │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTACIÓN

### Fase 1: Modelo de Datos (2h)

```
1. Agregar/modificar modelos en Prisma:
   - Tenant (si no existe completo)
   - Terminal
   - TerminalNumberRange
   
2. Migración
3. Seed con tenant de prueba
```

### Fase 2: Configuración Local (2h)

```
1. LocalConfig en localStorage
2. Hook useTerminalConfig
3. Contexto TerminalProvider
```

### Fase 3: APIs (4h)

```
1. POST /api/setup/tenant
2. POST /api/setup/terminal
3. POST /api/admin/terminals/activate
4. GET/PUT /api/config/tenant
5. POST /api/terminals/:id/number-range/allocate
```

### Fase 4: UI de Setup (4h)

```
1. Wizard de onboarding (4 pasos)
2. Pantalla de registro de terminal
3. Panel de administración de terminales
```

### Fase 5: Integración (4h)

```
1. Reemplazar constantes hardcodeadas
2. Usar useTerminalConfig en todas las páginas
3. Order numbers desde rango asignado
4. Sync client con tenant_id dinámico
```

---

## PRIORIDADES

| # | Feature | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|----------|-----------|
| 1 | LocalConfig + hook | Alto | 2h | 🔴 P0 |
| 2 | Reemplazar hardcoded | Alto | 2h | 🔴 P0 |
| 3 | Range allocation | Alto | 4h | 🔴 P0 |
| 4 | Registro de terminal | Alto | 4h | 🟡 P1 |
| 5 | Wizard onboarding | Medio | 4h | 🟡 P1 |
| 6 | Panel de terminales | Medio | 4h | 🟡 P1 |
| 7 | Backup/restore | Bajo | 4h | 🟢 P2 |

---

**Documento creado:** Enero 2026
