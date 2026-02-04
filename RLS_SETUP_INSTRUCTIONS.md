# 🔐 Instrucciones: Resolver RLS Bypass en Supabase

**Objetivo:** Crear usuario `app_user` sin bypass de RLS para que funcione multi-tenant isolation

**Tiempo estimado:** 5-10 minutos

---

## 📋 Paso 1: Ejecutar Script SQL en Supabase

### 1.1 Abrir Supabase SQL Editor

1. Ir a [Supabase Dashboard](https://app.supabase.com)
2. Seleccionar tu proyecto
3. Ir a **SQL Editor** (en el menú izquierdo)
4. Hacer clic en **New Query**

### 1.2 Copiar y Ejecutar Script

1. Abrir archivo: `scripts/setup-app-user-supabase.sql`
2. Copiar TODO el contenido
3. Pegar en Supabase SQL Editor
4. **IMPORTANTE:** Cambiar `'secure-password-here'` por una contraseña segura
5. Hacer clic en **Run** (o presionar Ctrl+Enter)

**Ejemplo con contraseña segura:**

```sql
CREATE USER app_user WITH PASSWORD 'MySecurePassword123!@#';
```

### 1.3 Verificar Resultados

Deberías ver:

```
✅ CREATE ROLE
✅ GRANT
✅ GRANT
✅ GRANT
✅ GRANT
✅ GRANT
✅ SELECT 1 (usebypassrls = false)
✅ SELECT (permisos correctos)
```

---

## 🔑 Paso 2: Obtener Credenciales

### 2.1 Copiar Contraseña

La contraseña que usaste en el script SQL (ej: `MySecurePassword123!@#`)

### 2.2 Obtener Host y Puerto

En Supabase Dashboard:

1. Ir a **Settings** → **Database**
2. Buscar **Connection String**
3. Copiar la URL (contiene el host y puerto)

**Ejemplo:**
```
postgresql://postgres:password@aws-1-sa-east-1.pooler.supabase.com:6543/postgres
```

De aquí extraer:
- **Host:** `aws-1-sa-east-1.pooler.supabase.com`
- **Puerto (pooler):** `6543`
- **Puerto (direct):** `5432`
- **Database:** `postgres`

---

## 🔄 Paso 3: Actualizar Variables de Entorno

### 3.1 Actualizar `.env.local`

Abrir `.env.local` y reemplazar:

```bash
# ANTES:
DATABASE_URL="postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.$@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.$@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"

# DESPUÉS:
DATABASE_URL="postgresql://app_user:MySecurePassword123!@#@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://app_user:MySecurePassword123!@#@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
```

**Cambios:**
- `postgres` → `app_user`
- `M1k1sB3ll.$` → `MySecurePassword123!@#` (tu contraseña)

### 3.2 Actualizar `.env`

Hacer los mismos cambios en `.env`:

```bash
DATABASE_URL="postgresql://app_user:MySecurePassword123!@#@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://app_user:MySecurePassword123!@#@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
```

---

## 🧪 Paso 4: Verificar Conexión

Ejecutar comando para verificar que la conexión funciona:

```bash
npx tsx scripts/check-rls-status.ts
```

**Esperado:**

```
🔍 Verificando estado de RLS...

📊 RLS Status por tabla:
[
  { tablename: 'employees', rowsecurity: true },
  { tablename: 'orders', rowsecurity: true },
  { tablename: 'stations', rowsecurity: true },
  { tablename: 'tenant_settings', rowsecurity: true }
]

📋 Políticas RLS:
[... políticas listadas ...]

🧪 Probando set_config...
set_config result: [ { result: 'test-tenant-123' } ]
current_setting result: [ { tenant_id: 'test-tenant-123' } ]
```

---

## 🚀 Paso 5: Re-ejecutar Integration Tests

Ejecutar los integration tests para verificar que RLS funciona:

```bash
npx tsx scripts/test-multi-tenant-integration.ts
```

**Esperado (ANTES):**

```
✅ Pasadas: 6/10
❌ Fallidas: 4/10
```

**Esperado (DESPUÉS):**

```
✅ Pasadas: 10/10
❌ Fallidas: 0/10
```

---

## ✅ Paso 6: Validar Checklist

Antes de dar por completado, verificar:

- [ ] ✅ Usuario `app_user` creado en Supabase
- [ ] ✅ `usebypassrls = false` para `app_user`
- [ ] ✅ Permisos correctos en todas las tablas
- [ ] ✅ `.env.local` actualizado con `app_user`
- [ ] ✅ `.env` actualizado con `app_user`
- [ ] ✅ `check-rls-status.ts` ejecutado exitosamente
- [ ] ✅ Integration tests: 10/10 PASSED
- [ ] ✅ Commit a git

---

## 🔒 Seguridad

**Importante:**

1. **Contraseña segura:** Usar contraseña fuerte (mínimo 12 caracteres, mayúsculas, minúsculas, números, símbolos)
2. **No compartir credenciales:** Nunca compartir la contraseña de `app_user`
3. **Usuario `postgres`:** Mantener solo para administración y migraciones
4. **Producción:** En producción, usar variables de entorno seguras (Vercel Secrets, AWS Secrets Manager, etc.)

---

## 🐛 Troubleshooting

### Problema: "Connection refused"

```
Error: connect ECONNREFUSED
```

**Solución:**
- Verificar que `DATABASE_URL` es correcto
- Verificar que la contraseña es correcta
- Verificar que el host es accesible

### Problema: "Password authentication failed"

```
Error: password authentication failed for user "app_user"
```

**Solución:**
- Verificar que la contraseña en `.env.local` coincide con la del script SQL
- Verificar que no hay caracteres especiales mal escapados

### Problema: "RLS policy violation"

```
Error: new row violates row-level security policy
```

**Solución:**
- Verificar que `set_config('app.current_tenant_id', ...)` se ejecuta antes de las queries
- Verificar que el `tenant_id` es válido (UUID)

### Problema: "Permission denied"

```
Error: permission denied for schema public
```

**Solución:**
- Ejecutar el script SQL nuevamente
- Verificar que todos los GRANT se ejecutaron correctamente

---

## 📊 Resultados Esperados

### Antes (con usuario `postgres`):

```
Integration Tests: 6/10 PASSED
❌ RLS Isolation: Tenant 1 no ve datos de Tenant 2
❌ RLS Isolation: Tenant settings aislados
❌ RLS Isolation: Employees aislados por tenant
❌ RLS Isolation: Stations aisladas por tenant
```

### Después (con usuario `app_user`):

```
Integration Tests: 10/10 PASSED ✅
✅ RLS Isolation: Tenant 1 no ve datos de Tenant 2
✅ RLS Isolation: Tenant settings aislados
✅ RLS Isolation: Employees aislados por tenant
✅ RLS Isolation: Stations aisladas por tenant
```

---

## 📞 Soporte

Si tienes problemas:

1. Revisar logs en Supabase Dashboard
2. Ejecutar `check-rls-status.ts` para diagnosticar
3. Revisar `RLS_BYPASS_ANALYSIS.md` para más detalles
4. Revisar `.kiro/testing/QUICK_START_TESTING.md` para troubleshooting

---

## 🎓 Aprendizajes

1. **RLS en Supabase:** El usuario `postgres` siempre bypasea RLS
2. **Multi-Tenancy:** Requiere usuario sin bypass para funcionar
3. **Best Practice:** Usar usuario diferente para aplicación vs administración

---

**¡Listo!** Sigue estos pasos y los integration tests deberían pasar 10/10 ✅

