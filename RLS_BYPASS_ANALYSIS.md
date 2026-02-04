# 🔴 Análisis Crítico: RLS Bypass en Supabase

**Fecha:** 4 Febrero 2026  
**Status:** 🔴 CRÍTICO - RLS no funciona con usuario `postgres`  
**Impacto:** Multi-tenant isolation completamente inefectivo

---

## 📊 Hallazgos

### 1. RLS Está Habilitado Pero No Funciona

```
✅ RLS habilitado en tablas: orders, employees, stations, tenant_settings
✅ Políticas RLS creadas correctamente
✅ set_config() funciona correctamente
❌ RLS NO se aplica a queries
```

### 2. Causa Raíz: Usuario `postgres` Tiene Bypass

```sql
SELECT usebypassrls FROM pg_user WHERE usename = 'postgres';
-- Resultado: true
```

**Explicación:**
- El usuario `postgres` es el superuser en Supabase
- Supabase configura `usebypassrls = true` para el usuario `postgres`
- Esto significa que RLS NUNCA se aplica a este usuario
- Todas las queries del usuario `postgres` ven TODOS los datos

### 3. Impacto en Multi-Tenant

```
Tenant 1 query: SELECT * FROM orders;
  ├─ Usuario: postgres
  ├─ RLS Policy: tenant_id = current_setting('app.current_tenant_id')
  ├─ Bypass: true
  └─ Resultado: ✅ Ve TODAS las órdenes (10 órdenes)

Tenant 2 query: SELECT * FROM orders;
  ├─ Usuario: postgres
  ├─ RLS Policy: tenant_id = current_setting('app.current_tenant_id')
  ├─ Bypass: true
  └─ Resultado: ✅ Ve TODAS las órdenes (10 órdenes)

CONCLUSIÓN: ❌ Multi-tenant isolation NO funciona
```

---

## 🔧 Soluciones Posibles

### Opción 1: Usar Usuario Diferente (RECOMENDADO)

**Ventajas:**
- ✅ RLS funciona correctamente
- ✅ Multi-tenant isolation garantizado
- ✅ Seguridad en producción

**Desventajas:**
- ❌ Requiere crear usuario en Supabase
- ❌ Requiere cambiar DATABASE_URL

**Implementación:**

```sql
-- En Supabase SQL Editor:

-- 1. Crear usuario sin bypass
CREATE USER app_user WITH PASSWORD 'secure-password-here';

-- 2. Dar permisos necesarios
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 3. Verificar que NO tiene bypass
SELECT usebypassrls FROM pg_user WHERE usename = 'app_user';
-- Debe retornar: false
```

**Cambiar DATABASE_URL:**

```bash
# Antes (postgres con bypass):
DATABASE_URL="postgresql://postgres:password@db.supabase.co:5432/postgres"

# Después (app_user sin bypass):
DATABASE_URL="postgresql://app_user:secure-password@db.supabase.co:5432/postgres"
```

### Opción 2: Deshabilitar Bypass en `postgres` (NO RECOMENDADO)

**Ventajas:**
- ✅ RLS funciona con usuario actual
- ✅ No requiere crear usuario nuevo

**Desventajas:**
- ❌ Rompe herramientas de Supabase (Studio, etc.)
- ❌ Rompe migraciones de Prisma
- ❌ Rompe backups y mantenimiento
- ❌ NO RECOMENDADO en producción

**Implementación:**

```sql
-- ⚠️ SOLO para desarrollo/testing
ALTER USER postgres NOINHERIT;
ALTER USER postgres SET "app.bypass_rls" = false;
```

### Opción 3: Usar Middleware en Aplicación (PARCIAL)

**Ventajas:**
- ✅ Funciona con usuario `postgres`
- ✅ No requiere cambios en base de datos

**Desventajas:**
- ❌ RLS no se aplica en queries directas
- ❌ Requiere validación en aplicación
- ❌ Riesgo de bugs de seguridad
- ❌ NO es suficiente para producción

**Implementación:**

```typescript
// En API routes:
async function getOrders(tenantId: string) {
  // Validar que el usuario pertenece a este tenant
  const user = await getSessionUser();
  if (user.tenant_id !== tenantId) {
    throw new Error('Unauthorized');
  }

  // Hacer query (sin RLS, pero validado en app)
  return prisma.orders.findMany({
    where: { tenant_id: tenantId }
  });
}
```

---

## 🎯 Recomendación

**Usar Opción 1: Crear usuario `app_user` sin bypass**

**Razones:**
1. ✅ RLS funciona correctamente
2. ✅ Multi-tenant isolation garantizado
3. ✅ Seguridad en producción
4. ✅ Cumple con best practices de Supabase
5. ✅ Fácil de implementar

**Pasos:**

1. Crear usuario en Supabase SQL Editor
2. Cambiar DATABASE_URL en `.env.local`
3. Re-ejecutar tests
4. Verificar que RLS funciona

---

## 📋 Checklist de Implementación

- [ ] Crear usuario `app_user` en Supabase
- [ ] Dar permisos necesarios
- [ ] Verificar que `usebypassrls = false`
- [ ] Actualizar DATABASE_URL en `.env.local`
- [ ] Actualizar DATABASE_URL en `.env`
- [ ] Ejecutar `npx prisma migrate deploy`
- [ ] Re-ejecutar integration tests
- [ ] Verificar que RLS funciona (6/10 → 10/10)
- [ ] Commit a git

---

## 🔐 Seguridad

**Importante:** En producción, NUNCA usar usuario `postgres` para la aplicación.

**Best Practice:**
- `postgres`: Solo para administración y migraciones
- `app_user`: Para queries de la aplicación (con RLS)

---

## 📚 Referencias

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma Multi-Tenancy](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-databases/multi-tenancy)

---

**Próximo Paso:** Implementar Opción 1 (crear usuario `app_user`)

