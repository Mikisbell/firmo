# 🚨 ACCIÓN INMEDIATA: Actualizar a app_user

**Problema Detectado:** `.env.local` y `.env` usan `postgres` (con RLS bypass)  
**Solución:** Cambiar a `app_user` (sin RLS bypass)  
**Tiempo:** 5 minutos

---

## ✅ Buenas Noticias

- ✅ `app_user` **ya existe** en Supabase
- ✅ RLS está activado en todas las tablas
- ✅ Solo falta actualizar variables de entorno

---

## 🔧 Solución Rápida (2 opciones)

### Opción A: Automático (Recomendado)

```bash
# Ejecutar script con la contraseña de app_user
npx tsx scripts/update-env-app-user.ts "M1k1sB3ll.$"
```

**Nota:** La contraseña es la misma que `postgres` (por ahora)

### Opción B: Manual

1. Abrir `.env.local`
2. Buscar líneas con `postgres.ncwdmdjnelopikpgrhty`
3. Reemplazar `postgres.ncwdmdjnelopikpgrhty` con `app_user`
4. Guardar archivo

**Antes:**
```
DATABASE_URL="postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.%24@..."
DIRECT_URL="postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.%24@..."
```

**Después:**
```
DATABASE_URL="postgresql://app_user:M1k1sB3ll.%24@..."
DIRECT_URL="postgresql://app_user:M1k1sB3ll.%24@..."
```

5. Repetir en `.env`

---

## ✅ Verificar

```bash
# Verificar que todo está correcto
npx tsx scripts/check-app-user-status.ts
```

**Esperado:** 7/7 checks ✅

---

## 🧪 Ejecutar Tests

```bash
# Integration tests (deberían pasar 10/10)
npx tsx scripts/test-multi-tenant-integration.ts
```

---

## 📝 Commit

```bash
git add .env.local .env
git commit -m "fix: update DATABASE_URL to use app_user without RLS bypass

- Changed from postgres user to app_user
- RLS isolation now works correctly
- Integration tests: 6/10 → 10/10 expected"
git push
```

---

**¡Listo!** Después de esto, los integration tests deberían pasar 10/10 ✅
