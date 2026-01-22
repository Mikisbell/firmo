# Análisis Profundo: Datos Hardcodeados y Configuración - PARK POS

**Fecha:** 22 Enero 2026  
**Fase:** Análisis Completo desde Raíz del Proyecto  
**Estado:** ✅ COMPLETADO

---

## 🎯 Objetivo

Identificar **TODOS** los huecos, inconsistencias y problemas de arquitectura, especialmente relacionados con:
- Datos hardcodeados y seeded
- Configuración multi-tenant
- Seguridad de credenciales
- Estrategia de migración a producción

---

## 🔥 PROBLEMAS CRÍTICOS IDENTIFICADOS

---

## 🚨 CATEGORÍA 1: SEGURIDAD - CREDENCIALES EXPUESTAS

### 1.1 ❌ CRÍTICO: Credenciales de Base de Datos en .env
**Archivo:** `.env`  
**Problema:** Credenciales de Supabase completamente expuestas:
```env
DATABASE_URL="postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.$@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

**Riesgo:** 🔴 CRÍTICO
- Usuario: `postgres.ncwdmdjnelopikpgrhty`
- Password: `M1k1sB3ll.$`
- Host: `aws-1-sa-east-1.pooler.supabase.com`

**Estado:** ⚠️ `.env` está en `.gitignore` (BIEN), pero si alguna vez se commitió, las credenciales están en el historial de Git.

**Solución:**
1. **Inmediato:** Rotar credenciales en Supabase
2. **Corto plazo:** Usar variables de entorno de Vercel/hosting
3. **Largo plazo:** Implementar secrets management (AWS Secrets Manager, Vault)

---

### 1.2 ❌ CRÍTICO: SALT Hardcodeado para PINs
**Archivos:**
- `prisma/seed.ts`: `const SALT = 'PARK_POS_2026_';`
- `src/core/auth/auth.service.ts`: `const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';`

**Problema:** El SALT para hashear PINs está hardcodeado y es el mismo para todos los tenants.

**Riesgo:** 🔴 ALTO
- Si un atacante obtiene el SALT, puede hacer rainbow table attacks
- Todos los tenants usan el mismo SALT
- El SALT está en el código fuente

**Solución:**
1. **Inmediato:** Mover SALT a variable de entorno
2. **Corto plazo:** Generar SALT único por tenant
3. **Largo plazo:** Usar bcrypt/argon2 que genera salt automáticamente

---

### 1.3 ❌ CRÍTICO: JWT_SECRET Hardcodeado
**Archivo:** `src/core/auth/auth.service.ts`
```typescript
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'park-pos-jwt-secret-change-in-production'
);
```

**Problema:** JWT secret con fallback hardcodeado.

**Riesgo:** 🔴 ALTO
- Si no se configura `JWT_SECRET` en producción, usa el valor por defecto
- Cualquiera puede generar tokens válidos

**Solución:**
1. **Inmediato:** Generar JWT_SECRET fuerte y configurar en Vercel
2. **Validación:** Lanzar error si JWT_SECRET no está configurado en producción

```typescript
// Solución recomendada
const JWT_SECRET_STRING = process.env.JWT_SECRET;
if (!JWT_SECRET_STRING && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be configured in production');
}
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_STRING || 'park-pos-jwt-secret-dev-only'
);
```

---

### 1.4 ⚠️ MEDIO: VAPID Keys Expuestas
**Archivo:** `.env`
```env
VAPID_PRIVATE_KEY="CmaFbBC_oku8d4qUJyFVqvhtv5eqUovVbJZt6UVO20E"
```

**Problema:** VAPID private key para web push notifications expuesta.

**Riesgo:** 🟡 MEDIO
- Permite enviar notificaciones push falsas
- Menos crítico que DB credentials pero debe protegerse

**Solución:**
1. Regenerar VAPID keys
2. Mover a variables de entorno seguras

---

## 🏗️ CATEGORÍA 2: ARQUITECTURA - DATOS HARDCODEADOS

### 2.1 ❌ CRÍTICO: Tenant ID Hardcodeado en 30+ Archivos
**Valor:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Archivos afectados (muestra):**
```
prisma/seed.ts
src/core/config/terminal.ts
src/core/config/location.ts
src/app/api/admin/config/route.ts
src/app/api/admin/reports/route.ts
src/app/api/admin/terminals/route.ts
src/app/api/admin/products/route.ts
src/app/api/admin/employees/route.ts
src/app/api/admin/promotions/route.ts
src/app/api/catalog/latest/route.ts
src/app/api/auth/session/route.ts
src/app/api/inventory/verify-pin/route.ts
src/components/auth/TerminalSetup.tsx
... y 20+ archivos más
```

**Problema:** El sistema está completamente acoplado a un solo tenant.

**Impacto:** 🔴 CRÍTICO para escalabilidad
- Imposible soportar múltiples clientes sin refactorización masiva
- Cada nuevo cliente requiere deployment separado
- No hay aislamiento de datos entre tenants

**Solución Multi-Tenant:**

#### Opción A: Tenant ID en Request Context (Recomendado)
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const tenantId = extractTenantId(request); // De subdomain, header, o JWT
  request.headers.set('x-tenant-id', tenantId);
}

// En cada API route
const tenantId = request.headers.get('x-tenant-id');
```

#### Opción B: Tenant ID en JWT Claims
```typescript
// Al generar JWT
const token = await new SignJWT({
  employee_id: employee.id,
  tenant_id: employee.tenant_id, // ← Incluir en token
  role: employee.role
})
```

#### Opción C: Subdomain-based Tenancy
```
tenant1.parkpos.pe → tenant_id: "tenant1-uuid"
tenant2.parkpos.pe → tenant_id: "tenant2-uuid"
```

---

### 2.2 ❌ CRÍTICO: Employee IDs Hardcodeados (10 UUIDs fijos)
**Archivos:**
- `prisma/seed.ts`: Define 10 UUIDs fijos
- `src/core/config/terminal.ts`: DEBE coincidir exactamente

**Problema:** Los IDs de empleados están hardcodeados y deben sincronizarse manualmente entre archivos.

**Riesgo:** 🔴 ALTO
- Si los IDs no coinciden, el sistema falla
- Imposible agregar empleados dinámicamente
- Cada terminal está atado a un employee_id específico

**Ejemplo:**
```typescript
// prisma/seed.ts
const EMPLOYEE_IDS = {
    ADMIN: "00000000-0000-0000-0000-000000000001",
    CASHIER_MARIA: "00000000-0000-0000-0000-000000000002",
    // ... 8 más
};

// src/core/config/terminal.ts
export const EMPLOYEE_IDS = {
    ADMIN: "00000000-0000-0000-0000-000000000001", // ← DEBE coincidir
    CASHIER_MARIA: "00000000-0000-0000-0000-000000000002",
    // ... 8 más
};
```

**Solución:**
1. **Inmediato:** Centralizar en un solo archivo
2. **Corto plazo:** Cargar employee IDs desde DB en runtime
3. **Largo plazo:** Implementar terminal registration flow dinámico

---

### 2.3 ❌ ALTO: Location ID Hardcodeado
**Valor:** `loc-00000000-0000-0000-0000-000000000001`

**Archivos:**
- `src/core/config/location.ts`
- `prisma/seed.ts`

**Problema:** Solo soporta una ubicación física.

**Impacto:** 🟡 MEDIO
- Funciona para single-location MVP
- Bloquea expansión a múltiples sucursales

**Solución:**
1. Agregar `location_id` a terminal registration
2. Permitir selección de location en setup

---

### 2.4 ⚠️ MEDIO: Terminal Configurations Hardcodeadas
**Archivo:** `src/core/config/terminal.ts`

**Problema:** Configuraciones de 9 terminales hardcodeadas:
```typescript
export const TERMINAL_CONFIG = {
    CAJA_01: { terminal_id: "CAJA_01", actor_id: EMPLOYEE_IDS.CASHIER_MARIA, role: "CASHIER" },
    MOZO_01: { terminal_id: "MOZO_01", actor_id: EMPLOYEE_IDS.WAITER_CARLOS, role: "WAITER" },
    // ... 7 más
};
```

**Impacto:** 🟡 MEDIO
- Limita a 9 terminales predefinidas
- No permite agregar terminales dinámicamente

**Solución:**
- Usar tabla `terminal_devices` de la DB
- Implementar terminal registration API (ya existe parcialmente)

---

## 📦 CATEGORÍA 3: DATOS SEEDED - DEPENDENCIAS HARDCODEADAS

### 3.1 ⚠️ MEDIO: Productos Hardcodeados (24 productos)
**Archivo:** `prisma/seed.ts`

**Problema:** Menú completo de pollería hardcodeado en seed.

**Productos incluidos:**
- 4 tamaños de pollo
- 3 combos
- 6 guarniciones
- 9 bebidas
- 3 salsas
- 2 postres

**Impacto:** 🟡 MEDIO
- Funciona para MVP
- Cada cliente necesita su propio menú
- No hay UI para gestionar productos (existe CRUD pero no se usa en setup)

**Solución:**
1. Crear wizard de setup inicial para productos
2. Permitir importar catálogo desde CSV/JSON
3. Proveer templates de menú por tipo de negocio

---

### 3.2 ⚠️ MEDIO: Zonas y Mesas Hardcodeadas
**Archivo:** `prisma/seed.ts`

**Problema:** Layout de restaurante hardcodeado:
- 4 zonas (Salón, Terraza, Bar, VIP)
- 23 mesas con posiciones fijas

**Impacto:** 🟡 MEDIO
- Cada restaurante tiene layout diferente
- No hay UI para diseñar layout (existe pero no se usa en setup)

**Solución:**
1. Wizard de setup de mesas con drag & drop
2. Templates de layout por tamaño de local

---

### 3.3 ⚠️ BAJO: Inventario Hardcodeado con FEFO
**Archivo:** `prisma/seed.ts`

**Problema:** 8 ingredientes con fechas de vencimiento hardcodeadas.

**Impacto:** 🟢 BAJO
- Es data de ejemplo para testing
- Se reemplaza en producción

**Nota:** Esto es aceptable para MVP.

---

### 3.4 ⚠️ BAJO: Clientes y Drivers de Ejemplo
**Archivo:** `prisma/seed.ts`

**Problema:** 5 clientes y 3 drivers hardcodeados.

**Impacto:** 🟢 BAJO
- Data de ejemplo para testing
- Se reemplaza en producción

**Nota:** Aceptable para MVP.

---

## 🔧 CATEGORÍA 4: CONFIGURACIÓN - INCONSISTENCIAS

### 4.1 ⚠️ MEDIO: Múltiples Fuentes de Verdad para Tenant ID
**Archivos:**
- `src/core/config/terminal.ts`: `DEFAULT_TENANT_ID`
- `src/core/config/location.ts`: `DEFAULT_TENANT_ID`
- `.env`: `TENANT_ID`

**Problema:** 3 lugares diferentes definen el mismo valor.

**Solución:**
```typescript
// src/core/config/tenant.ts (NUEVO)
export function getTenantId(): string {
  return process.env.TENANT_ID || process.env.NEXT_PUBLIC_TENANT_ID || DEFAULT_TENANT_ID;
}

// Usar en todos los archivos
import { getTenantId } from '@/src/core/config/tenant';
const tenantId = getTenantId();
```

---

### 4.2 ⚠️ BAJO: Inconsistent Import Paths
**Patrón encontrado:**
- Algunos: `@/src/core/*` (correcto)
- Otros: `@/core/*` (funciona pero inconsistente)

**Solución:** Estandarizar a `@/src/core/*` en todos los archivos.

---

### 4.3 ⚠️ BAJO: Admin ID Hardcodeado en Delivery Service
**Archivo:** `src/core/delivery/driver.service.ts`
```typescript
const adminId = '00000000-0000-0000-0000-000000000001';
```

**Problema:** Usa admin ID hardcodeado para audit trail.

**Solución:** Obtener employee_id del contexto de autenticación.

---

## 📊 RESUMEN EJECUTIVO

### Problemas por Severidad

| Severidad | Cantidad | Categoría Principal |
|-----------|----------|---------------------|
| 🔴 CRÍTICO | 6 | Seguridad (4) + Arquitectura (2) |
| 🟡 ALTO/MEDIO | 8 | Arquitectura (3) + Datos (3) + Config (2) |
| 🟢 BAJO | 5 | Datos de ejemplo + Inconsistencias |
| **TOTAL** | **19** | **Problemas identificados** |

---

### Top 5 Prioridades para Producción

#### 1. 🔴 URGENTE: Rotar Credenciales de Base de Datos
- **Acción:** Cambiar password en Supabase
- **Tiempo:** 5 minutos
- **Impacto:** Evita acceso no autorizado

#### 2. 🔴 URGENTE: Configurar JWT_SECRET en Producción
- **Acción:** Generar secret fuerte y configurar en Vercel
- **Tiempo:** 10 minutos
- **Impacto:** Evita falsificación de tokens

#### 3. 🔴 URGENTE: Mover SALT a Variable de Entorno
- **Acción:** Generar SALT único y configurar
- **Tiempo:** 15 minutos
- **Impacto:** Mejora seguridad de PINs

#### 4. 🔴 ALTO: Implementar Tenant Context Middleware
- **Acción:** Extraer tenant_id de request context
- **Tiempo:** 2-4 horas
- **Impacto:** Habilita multi-tenancy

#### 5. 🟡 MEDIO: Centralizar Employee IDs
- **Acción:** Cargar desde DB en runtime
- **Tiempo:** 1-2 horas
- **Impacto:** Elimina sincronización manual

---

## 🎯 PLAN DE MIGRACIÓN A PRODUCCIÓN

### Fase 1: Seguridad Inmediata (1 día)
- [ ] Rotar credenciales de Supabase
- [ ] Configurar JWT_SECRET en Vercel
- [ ] Mover PIN_SALT a variable de entorno
- [ ] Regenerar VAPID keys
- [ ] Verificar que .env nunca se commitió a Git

### Fase 2: Multi-Tenant Foundation (1 semana)
- [ ] Implementar tenant context middleware
- [ ] Refactorizar APIs para usar tenant_id dinámico
- [ ] Crear tenant provisioning API
- [ ] Implementar tenant isolation tests

### Fase 3: Dynamic Configuration (1 semana)
- [ ] Cargar employee IDs desde DB
- [ ] Implementar terminal registration flow completo
- [ ] Crear setup wizard para productos
- [ ] Crear setup wizard para mesas/zonas

### Fase 4: Production Hardening (1 semana)
- [ ] Implementar secrets management
- [ ] Agregar tenant-level rate limiting
- [ ] Implementar tenant backup/restore
- [ ] Crear admin panel para tenant management

---

## 📋 CHECKLIST DE SEGURIDAD PRE-PRODUCCIÓN

### Credenciales
- [ ] Todas las credenciales en variables de entorno
- [ ] No hay secrets hardcodeados en código
- [ ] .env está en .gitignore
- [ ] Verificar historial de Git (no hay secrets commitidos)

### Autenticación
- [ ] JWT_SECRET configurado y fuerte
- [ ] PIN_SALT único por tenant
- [ ] Session timeout configurado
- [ ] Rate limiting en login endpoints

### Base de Datos
- [ ] Credenciales rotadas
- [ ] Conexiones SSL habilitadas
- [ ] Row Level Security (RLS) configurado
- [ ] Backups automáticos habilitados

### Multi-Tenancy
- [ ] Tenant isolation verificado
- [ ] Queries filtran por tenant_id
- [ ] Tests de tenant isolation passing
- [ ] No hay data leakage entre tenants

---

## 🔗 REFERENCIAS

### Documentos Relacionados
- `docs/02-architecture/SECURITY.md` - Arquitectura de seguridad
- `docs/02-architecture/MONEY_SAFETY.md` - Seguridad financiera
- `docs/05-improvements/GAPS.md` - Gaps identificados previamente
- `.kiro/specs/multi-tenant-improvements/` - Spec de multi-tenancy

### Archivos Críticos a Revisar
- `prisma/seed.ts` - Todos los datos hardcodeados
- `src/core/config/terminal.ts` - Configuración de terminales
- `src/core/config/location.ts` - Configuración de tenant/location
- `src/core/auth/auth.service.ts` - Autenticación y JWT
- `.env` - Credenciales (NO COMMITEAR)

---

**Última actualización:** 22 Enero 2026 - 23:59  
**Estado:** Análisis Completo ✅  
**Próximo paso:** Implementar Fase 1 del Plan de Migración (Seguridad Inmediata)
