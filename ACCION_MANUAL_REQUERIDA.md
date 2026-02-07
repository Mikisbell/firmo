# 🚨 ACCIÓN MANUAL REQUERIDA: Crear app_user en Supabase

**Problema:** El usuario `app_user` no existe en Supabase  
**Solución:** Ejecutar script SQL manualmente en Supabase Dashboard  
**Tiempo:** 5 minutos

---

## ⚠️ Por Qué Es Necesario

Los scripts automáticos no pueden crear el usuario porque:
1. Requieren permisos de superusuario (solo disponibles en Supabase Dashboard)
2. El usuario `app_user` no existe, por lo que no podemos conectarnos con él
3. Supabase no permite crear usuarios vía API por seguridad

---

## 📋 Pasos Exactos

### Paso 1: Abrir Supabase Dashboard (1 min)

1. Ir a: https://app.supabase.com
2. Seleccionar tu proyecto
3. En el menú izquierdo, hacer clic en **SQL Editor**
4. Hacer clic en **New Query**

### Paso 2: Copiar y Modificar Script (2 min)

1. Abrir el archivo: `scripts/setup-app-user-supabase.sql`
2. Copiar **TODO** el contenido
3. Pegar en el editor SQL de Supabase
4. **IMPORTANTE:** En la línea 13, cambiar:
   ```sql
   CREATE USER app_user WITH PASSWORD 'secure-password-here';
   ```
   Por:
   ```sql
   CREATE USER app_user WITH PASSWORD 'M1k1sB3ll.$';
   ```

**Nota:** Estamos usando la misma contraseña que `postgres` por simplicidad.

### Paso 3: Ejecutar Script (1 min)

1. Hacer clic en **Run** (o presionar `Ctrl+Enter`)
2. Esperar a que termine (debería tomar ~2 segundos)

### Paso 4: Verificar Resultados (1 min)

Deberías ver en la salida:

```
✅ CREATE ROLE
✅ GRANT (varias veces)
✅ SELECT 1 (con usebypassrls = false)
✅ SELECT (con permisos correctos)
```

Si ves errores, revisar la sección de Troubleshooting abajo.

---

## ✅ Verificar Que Funcionó

Después de ejecutar el script en Supabase, ejecutar:

```bash
npx tsx scripts/check-app-user-status.ts
```

**Esperado:**
```
✅ DATABASE_URL (.env.local): Usa app_user ✅
✅ DIRECT_URL (.env.local): Usa app_user ✅
✅ Conexión a BD: Conexión exitosa ✅
✅ Usuario Actual: Usuario: app_user ✅
✅ Usuario app_user: Usuario app_user existe ✅
✅ RLS Bypass (app_user): RLS bypass desactivado ✅
✅ RLS en Tablas: RLS activado en 5 tablas ✅

✅ Pasadas: 7/7
```

---

## 🧪 Ejecutar Integration Tests

Una vez que el script de verificación muestre 7/7:

```bash
npx tsx scripts/test-multi-tenant-integration.ts
```

**Esperado:**
```
✅ Pasadas: 10/10
❌ Fallidas: 0/10
```

---

## 🐛 Troubleshooting

### Error: "role app_user already exists"

**Solución:** El usuario ya existe. Saltar al Paso 4 (Verificar).

### Error: "permission denied to create role"

**Solución:** 
1. Asegurarse de estar en Supabase Dashboard (no en terminal local)
2. Verificar que estás en el proyecto correcto
3. Intentar refrescar la página y volver a intentar

### Error: "syntax error near CREATE USER"

**Solución:**
1. Verificar que copiaste TODO el script
2. Verificar que no hay caracteres extraños
3. Intentar copiar nuevamente desde el archivo original

### Verificación muestra "Tenant or user not found"

**Solución:**
1. Verificar que el script SQL se ejecutó correctamente
2. Esperar 30 segundos y volver a intentar
3. Verificar que la contraseña en el script coincide con la de `.env.local`

---

## 📊 Progreso Esperado

### Antes (Actual)
```
✅ Unit Tests: 5/5 (100%)
🟡 Integration Tests: 6/10 (60%)
🔄 E2E Tests: 2/20 (10%)
TOTAL: 13/35 (37%)
```

### Después (Con app_user creado)
```
✅ Unit Tests: 5/5 (100%)
✅ Integration Tests: 10/10 (100%) ← +4
🔄 E2E Tests: 2/20 (10%)
TOTAL: 17/35 (49%)
```

---

## 📝 Script SQL Completo

Si no puedes abrir el archivo, aquí está el script completo:

```sql
-- Crear usuario app_user (sin bypass de RLS)
CREATE USER app_user WITH PASSWORD 'M1k1sB3ll.$';

-- Dar permisos de conexión
GRANT CONNECT ON DATABASE postgres TO app_user;

-- Dar permisos en schema public
GRANT USAGE ON SCHEMA public TO app_user;

-- Dar permisos en todas las tablas
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Dar permisos en todas las secuencias
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Dar permisos en funciones
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Verificar que el usuario NO tiene bypass de RLS
SELECT usebypassrls FROM pg_user WHERE usename = 'app_user';

-- Verificar permisos
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'orders' AND grantee = 'app_user'
ORDER BY privilege_type;
```

---

## 🎯 Siguiente Paso

Una vez que ejecutes el script SQL en Supabase:

1. ✅ Verificar con `check-app-user-status.ts` (7/7)
2. ✅ Ejecutar integration tests (10/10)
3. ✅ Commit cambios
4. 🔄 Continuar con E2E tests (18 pendientes)

---

**¿Listo?** Abre Supabase Dashboard y ejecuta el script SQL 🚀
