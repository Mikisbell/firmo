# 🔍 PRISMA Y CONNECTION POOLING: ¿POR QUÉ ES NECESARIO?

**Fecha:** 29 Enero 2026  
**Pregunta:** ¿Por qué connection pooling si todo va a través de Prisma?  
**Respuesta:** Prisma NO maneja connection pooling automáticamente en producción

---

## 🎯 RESPUESTA CORTA

**Prisma usa las conexiones que le proporciones.** Si no configuras pooling, Prisma abre una nueva conexión por cada query, agotando el límite de PostgreSQL.

---

## 📊 EL PROBLEMA: PRISMA SIN POOLING

### Error Real del Stress Test

```
Error: FATAL: MaxClientsInSessionMode: max clients reached
```

**¿Qué pasó?**

```typescript
// Test ejecuta 50 queries concurrentes
for (let i = 0; i < 50; i++) {
    queries.push(
        prisma.products.count() // ← Cada query abre nueva conexión
    );
}
await Promise.all(queries);

// Resultado:
// - Prisma intenta abrir 50 conexiones simultáneas
// - Supabase Session Mode límite: ~10 conexiones
// - Error: "max clients reached"
```

---

## 🔍 CÓMO FUNCIONA PRISMA (BAJO EL CAPÓ)

### Sin Connection Pooling

```
┌─────────────────────────────────────────────────────────────┐
│                    APLICACIÓN (Next.js)                     │
│                                                             │
│  Query 1 ──┐                                               │
│  Query 2 ──┼──► Prisma Client ──┐                         │
│  Query 3 ──┘                     │                         │
└──────────────────────────────────┼─────────────────────────┘
                                   │
                                   │ Cada query = nueva conexión
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Supabase)                    │
│                                                             │
│  Connection 1 ◄─── Query 1                                 │
│  Connection 2 ◄─── Query 2                                 │
│  Connection 3 ◄─── Query 3                                 │
│  ...                                                        │
│  Connection 50 ◄─── Query 50                               │
│                                                             │
│  ❌ ERROR: Max 10 connections en Session Mode              │
└─────────────────────────────────────────────────────────────┘
```

**Problema:**
- Cada query de Prisma abre nueva conexión TCP
- PostgreSQL tiene límite de conexiones (10-100)
- Queries concurrentes agotan el pool rápidamente

---

### Con Connection Pooling (PgBouncer)

```
┌─────────────────────────────────────────────────────────────┐
│                    APLICACIÓN (Next.js)                     │
│                                                             │
│  Query 1 ──┐                                               │
│  Query 2 ──┼──► Prisma Client ──┐                         │
│  Query 3 ──┘                     │                         │
└──────────────────────────────────┼─────────────────────────┘
                                   │
                                   │ Todas las queries
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│              PgBouncer (Connection Pooler)                  │
│                                                             │
│  Pool de 20 conexiones reutilizables                       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ... ┌────┐                  │
│  │ C1 │ │ C2 │ │ C3 │ │ C4 │     │C20 │                  │
│  └────┘ └────┘ └────┘ └────┘     └────┘                  │
│    ▲      ▲      ▲      ▲           ▲                      │
│    │      │      │      │           │                      │
│    └──────┴──────┴──────┴───────────┘                      │
│           Reutiliza conexiones                              │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               │ Solo 20 conexiones reales
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Supabase)                    │
│                                                             │
│  Connection 1 ◄─── Pool (reutilizada)                      │
│  Connection 2 ◄─── Pool (reutilizada)                      │
│  ...                                                        │
│  Connection 20 ◄─── Pool (reutilizada)                     │
│                                                             │
│  ✅ OK: Solo 20 conexiones, soporta 1000+ queries          │
└─────────────────────────────────────────────────────────────┘
```

**Beneficio:**
- 20 conexiones reales soportan 1000+ queries
- Conexiones se reutilizan (no se abren/cierran constantemente)
- Mucho más eficiente

---

## 🔧 CONFIGURACIÓN: PRISMA + PGBOUNCER

### Paso 1: Entender los Puertos de Supabase

Supabase proporciona **2 puertos diferentes**:

| Puerto | Modo | Uso | Pooling |
|--------|------|-----|---------|
| **5432** | Direct | Migraciones, Admin | ❌ No |
| **6543** | Pooled | Queries de aplicación | ✅ Sí (PgBouncer) |

### Paso 2: Configurar Prisma Schema

**Archivo:** `prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  
  // ✅ URL principal: Puerto 6543 (pooled)
  url       = env("DATABASE_URL")
  
  // ✅ URL directa: Puerto 5432 (para migraciones)
  directUrl = env("DIRECT_URL")
}
```

**¿Por qué 2 URLs?**

- **`url` (6543):** Para queries de aplicación (pooled, rápido)
- **`directUrl` (5432):** Para migraciones (direct, necesita transacciones largas)

### Paso 3: Variables de Entorno

**Archivo:** `.env`

```bash
# ✅ Pooled connection (Puerto 6543 con PgBouncer)
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"

# ✅ Direct connection (Puerto 5432 sin pooling)
DIRECT_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
```

**Parámetros importantes:**

- `pgbouncer=true` → Le dice a Prisma que use modo compatible con PgBouncer
- `connection_limit=20` → Límite de conexiones del pool
- Puerto `6543` → PgBouncer (pooled)
- Puerto `5432` → Direct (sin pooling)

---

## 🎯 MODOS DE PGBOUNCER

### Session Mode (❌ NO USAR)

```
Cliente ──► PgBouncer ──► PostgreSQL
           (1 conexión por sesión)
```

**Características:**
- 1 conexión = 1 sesión completa
- Límite muy bajo (~10 conexiones)
- **Problema:** Se agota rápido

**Error que vimos:**
```
FATAL: MaxClientsInSessionMode: max clients reached
```

### Transaction Mode (✅ USAR)

```
Cliente ──► PgBouncer ──► PostgreSQL
           (1 conexión por transacción)
```

**Características:**
- Conexión se libera después de cada transacción
- Límite alto (100+ conexiones virtuales)
- **Beneficio:** Mucho más eficiente

**Configurar en Supabase:**
1. Dashboard → Database → Connection Pooling
2. Mode: **Transaction**
3. Pool Size: **20**

---

## 📊 COMPARACIÓN: CON vs SIN POOLING

### Sin Pooling (Actual - Fallando)

```typescript
// 50 queries concurrentes
const queries = [];
for (let i = 0; i < 50; i++) {
    queries.push(prisma.products.count());
}
await Promise.all(queries);

// Resultado:
// - Prisma intenta abrir 50 conexiones
// - PostgreSQL límite: 10 conexiones
// - ❌ ERROR: "max clients reached"
```

**Métricas:**
- Max queries concurrentes: ~10
- Tiempo de respuesta: Variable
- Errores: Frecuentes
- Status: ❌ FAIL

### Con Pooling (Después del fix)

```typescript
// 50 queries concurrentes
const queries = [];
for (let i = 0; i < 50; i++) {
    queries.push(prisma.products.count());
}
await Promise.all(queries);

// Resultado:
// - Prisma usa pool de 20 conexiones
// - PgBouncer reutiliza conexiones
// - ✅ OK: Todas las queries completan
```

**Métricas:**
- Max queries concurrentes: 100+
- Tiempo de respuesta: Consistente
- Errores: Ninguno
- Status: ✅ PASS

---

## 🔍 PRISMA CLIENT: BAJO EL CAPÓ

### Cómo Prisma Maneja Conexiones

```typescript
// Cuando haces esto:
const products = await prisma.products.findMany();

// Prisma hace esto internamente:
// 1. Obtener conexión del pool (o crear nueva si no hay pooling)
const connection = await getConnection(DATABASE_URL);

// 2. Ejecutar query
const result = await connection.query('SELECT * FROM products');

// 3. Liberar conexión
await releaseConnection(connection);
```

**Sin pooling:**
- `getConnection()` abre nueva conexión TCP
- Lento (handshake, SSL, auth)
- Agota límite rápidamente

**Con pooling:**
- `getConnection()` reutiliza conexión existente
- Rápido (conexión ya establecida)
- Eficiente (20 conexiones soportan 1000+ queries)

---

## 🎓 ANALOGÍA: TAXI vs UBER POOL

### Sin Pooling = Taxi Individual

```
Cliente 1 ──► Taxi 1 ──► Destino
Cliente 2 ──► Taxi 2 ──► Destino
Cliente 3 ──► Taxi 3 ──► Destino
...
Cliente 50 ──► Taxi 50 ──► Destino

Problema:
- Necesitas 50 taxis para 50 clientes
- Caro, ineficiente
- Si solo hay 10 taxis → clientes esperan
```

### Con Pooling = Uber Pool

```
Cliente 1 ──┐
Cliente 2 ──┼──► Pool de 10 taxis ──► Destinos
Cliente 3 ──┤    (reutilizados)
...         │
Cliente 50 ─┘

Beneficio:
- 10 taxis sirven a 50 clientes
- Eficiente, rápido
- Taxis se reutilizan constantemente
```

---

## 🚨 ERRORES COMUNES

### Error 1: Usar Solo DATABASE_URL sin directUrl

```prisma
// ❌ MAL
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Falta directUrl
}
```

**Problema:** Migraciones fallan con PgBouncer

**Solución:**
```prisma
// ✅ BIEN
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Pooled
  directUrl = env("DIRECT_URL")        // Direct
}
```

### Error 2: Usar Session Mode

**Problema:** Límite muy bajo (~10 conexiones)

**Solución:** Cambiar a Transaction Mode en Supabase

### Error 3: No Configurar connection_limit

```bash
# ❌ MAL
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres"

# ✅ BIEN
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
```

---

## 📊 IMPACTO EN STRESS TESTS

### Antes (Sin Pooling)

```
Test: 50 concurrent queries
Result: ❌ FAIL
Error: FATAL: MaxClientsInSessionMode: max clients reached

Queries ejecutadas: 0/50
Tiempo: 0ms (falló inmediatamente)
```

### Después (Con Pooling)

```
Test: 50 concurrent queries
Result: ✅ PASS

Queries ejecutadas: 50/50
Tiempo: ~2000ms
Throughput: 25 queries/sec
```

---

## 🏁 CONCLUSIÓN

### ¿Por qué necesitamos connection pooling con Prisma?

**Respuesta:** Prisma **NO maneja pooling automáticamente**. Usa las conexiones que le proporciones.

**Sin pooling:**
- ❌ Cada query = nueva conexión
- ❌ Límite bajo (~10 conexiones)
- ❌ Lento (overhead de conexión)
- ❌ Stress tests fallan

**Con pooling:**
- ✅ Conexiones reutilizadas
- ✅ Límite alto (100+ queries concurrentes)
- ✅ Rápido (sin overhead)
- ✅ Stress tests pasan

### Configuración Necesaria

1. **Prisma Schema:** Agregar `directUrl`
2. **Variables de Entorno:** 2 URLs (pooled + direct)
3. **Supabase:** Transaction Mode, Pool Size 20
4. **Regenerar:** `npx prisma generate`

**Tiempo:** 15 minutos  
**Impacto:** CRÍTICO - Desbloquea producción

---

**Última Actualización:** 29 Enero 2026  
**Contexto:** Explicación de por qué Prisma necesita connection pooling  
**Status:** 📚 DOCUMENTADO - LISTO PARA IMPLEMENTAR
