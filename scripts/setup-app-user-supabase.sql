-- ============================================================================
-- Setup App User for Multi-Tenant RLS in Supabase
-- ============================================================================
-- 
-- IMPORTANTE: Ejecutar este script en Supabase SQL Editor
-- 
-- Este script crea un usuario 'app_user' sin bypass de RLS para que
-- las políticas RLS funcionen correctamente en el sistema multi-tenant.
--
-- ============================================================================

-- 1. Crear usuario app_user (sin bypass de RLS)
-- NOTA: Cambiar 'secure-password-here' por una contraseña segura
CREATE USER app_user WITH PASSWORD 'secure-password-here';

-- 2. Dar permisos de conexión
GRANT CONNECT ON DATABASE postgres TO app_user;

-- 3. Dar permisos en schema public
GRANT USAGE ON SCHEMA public TO app_user;

-- 4. Dar permisos en todas las tablas
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- 5. Dar permisos en todas las secuencias (para auto-increment)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 6. Dar permisos en funciones
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- 7. Verificar que el usuario NO tiene bypass de RLS
-- Debe retornar: false
SELECT usebypassrls FROM pg_user WHERE usename = 'app_user';

-- 8. Verificar que el usuario tiene los permisos correctos
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'orders' AND grantee = 'app_user'
ORDER BY privilege_type;

-- ============================================================================
-- PRÓXIMOS PASOS:
-- ============================================================================
-- 
-- 1. Copiar la contraseña generada
-- 
-- 2. Actualizar DATABASE_URL en .env.local:
--    DATABASE_URL="postgresql://app_user:secure-password-here@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
--    DIRECT_URL="postgresql://app_user:secure-password-here@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
-- 
-- 3. Actualizar DATABASE_URL en .env:
--    DATABASE_URL="postgresql://app_user:secure-password-here@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
--    DIRECT_URL="postgresql://app_user:secure-password-here@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
-- 
-- 4. Ejecutar migraciones:
--    npx prisma migrate deploy
-- 
-- 5. Re-ejecutar integration tests:
--    npx tsx scripts/test-multi-tenant-integration.ts
-- 
-- ============================================================================
