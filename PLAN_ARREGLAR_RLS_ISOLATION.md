# Plan para Arreglar RLS Isolation

**Objetivo:** Hacer que RLS funcione realmente y que los tests lo verifiquen

**Tiempo estimado:** 2-3 horas

---

## 🔴 Problema Actual

El script `test-multi-tenant-integration.ts` verifica que las políticas RLS **existen**, pero NO que **funcionan realmente**.

**Por qué falla:**
- Usa `prisma` (usuario `postgres` con `bypassrls = true`)
- `postgres` SIEMPRE ve todos los datos, sin importar RLS
- Resultado: Tests pasan pero RLS no funciona

---

## ✅ Solución

### Paso 1: Crear usuario `app_user` con RLS habilitado

```bash
npx ts-node scripts/setup-app-user-rls.ts
```

**Qué hace:**
1. Crea usuario `app_user` en Supabase
2. Obtiene token de autenticación
3. Crea `DATABASE_URL_APP_USER` en `.env`
4. Actualiza `.env` con la nueva URL

**Resultado:**
- `DATABASE_URL_APP_USER` disponible en `.env`
- Usuario `app_user` con RLS habilitado

### Paso 2: Crear test real de RLS

**Archivo:** `scripts/test-rls-isolation-real.ts`

**Qué hace:**
1. Crea 2 tenants con datos
2. Conecta como Tenant 1 con `app_user`
3. Verifica que Tenant 1 solo ve sus datos
4. Conecta como Tenant 2 con `app_user`
5. Verifica que Tenant 2 solo ve sus datos
6. Verifica que Tenant 1 NO puede ver datos de Tenant 2

**Ejecutar:**
```bash
npx ts-node scripts/test-rls-isolation-real.ts
```

**Resultado esperado:**
```
✅ Setup: Create Tenant 1
✅ Setup: Create Tenant 2
✅ Verification: Postgres sees all data (bypasses RLS)
✅ RLS Isolation: Tenant 1 sees only its data
✅ RLS Isolation: Tenant 2 sees only its data
✅ RLS Isolation: Tenant 1 cannot see Tenant 2 data
✅ RLS Isolation: Tenant settings are isolated
✅ Cleanup: Delete test data

✅ Pasadas: 8/8
❌ Fallidas: 0/8
```

### Paso 3: Actualizar test de integración

**Archivo:** `scripts/test-multi-tenant-integration.ts`

**Cambios:**
1. Reemplazar tests de "políticas existen" con tests de "RLS funciona"
2. Usar `app_user` en lugar de `postgres`
3. Configurar contexto de tenant con `set_config`
4. Verificar que datos están aislados

**Antes:**
```typescript
// ❌ Verifica que políticas existen
const policies = await prisma.$queryRaw`
  SELECT policyname FROM pg_policies WHERE tablename = 'orders'
`;
```

**Después:**
```typescript
// ✅ Verifica que RLS funciona realmente
await appUserClient.$executeRaw`
  SELECT set_config('app.current_tenant_id', ${tenantId}::text, false)
`;
const orders = await appUserClient.orders.findMany();
// Debe estar vacío si no hay órdenes de este tenant
```

---

## 📋 Checklist

- [ ] Ejecutar `npx ts-node scripts/setup-app-user-rls.ts`
- [ ] Verificar que `DATABASE_URL_APP_USER` está en `.env`
- [ ] Ejecutar `npx ts-node scripts/test-rls-isolation-real.ts`
- [ ] Verificar que todos los tests pasan
- [ ] Actualizar `scripts/test-multi-tenant-integration.ts`
- [ ] Ejecutar tests actualizados
- [ ] Verificar que todos los tests pasan

---

## 🎯 Resultado Final

Cuando esté completo:
- ✅ RLS funciona realmente
- ✅ Tests verifican que RLS funciona
- ✅ Tenant 1 NO ve datos de Tenant 2
- ✅ Tenant 2 NO ve datos de Tenant 1
- ✅ Datos están completamente aislados

---

**Creado:** 5 Febrero 2026  
**Status:** Plan listo para ejecutar  
**Próximo paso:** Ejecutar Paso 1
