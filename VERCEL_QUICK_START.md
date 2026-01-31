# ⚡ Vercel Quick Start - PARK POS

**5 minutos para estar listo para deployment**

---

## 🎯 PASO 1: Generar Secrets (2 min)

```bash
npx tsx scripts/generate-secrets.ts
```

**Copiar y guardar el output en un password manager:**
```
JWT_SECRET=...
PIN_SALT=...
PARK_API_SECRET=...
ADMIN_API_KEY=...
```

---

## 🔑 PASO 2: Generar VAPID Keys (1 min)

```bash
npx web-push generate-vapid-keys
```

**Copiar y guardar:**
```
Public Key: BKxT...
Private Key: CmaF...
```

---

## 🗄️ PASO 3: Obtener Database URL (1 min)

1. Ir a Supabase Dashboard
2. Settings → Database → Connection String (Pooler)
3. Copiar el string completo

**⚠️ IMPORTANTE:** Si las credenciales estuvieron expuestas, hacer "Reset Password" primero.

---

## ⚙️ PASO 4: Configurar en Vercel (10 min)

### Ir a Vercel Dashboard
1. Tu proyecto → Settings → Environment Variables
2. Click "Add New" para cada variable

### Variables REQUERIDAS (copiar/pegar):

```
DATABASE_URL=<tu-supabase-connection-string>
DIRECT_URL=<mismo-que-DATABASE_URL>
JWT_SECRET=<generado-en-paso-1>
PIN_SALT=<generado-en-paso-1>
TENANT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
LOCATION_ID=loc-00000000-0000-0000-0000-000000000001
```

### Variables RECOMENDADAS:

```
PARK_API_SECRET=<generado-en-paso-1>
ADMIN_API_KEY=<generado-en-paso-1>
VAPID_PUBLIC_KEY=<generado-en-paso-2>
VAPID_PRIVATE_KEY=<generado-en-paso-2>
VAPID_SUBJECT=mailto:tu-email@dominio.com
ALLOWED_ORIGINS=https://tu-dominio.com
```

### Para cada variable:
- Seleccionar: ✅ Production ✅ Preview ✅ Development
- Click "Save"

---

## ✅ PASO 5: Verificar (2 min)

1. **Trigger deployment** en Vercel
2. **Verificar logs** - No debe haber errores de "CONFIGURATION ERROR"
3. **Probar login** - PIN 1234 debe funcionar
4. **Verificar API** - `https://tu-app.vercel.app/api/health` debe retornar 200

---

## 🚨 ERRORES COMUNES

### "CONFIGURATION ERROR: TENANT_ID must be configured"
**Solución:** Agregar `TENANT_ID` en Vercel Environment Variables

### "SECURITY ERROR: JWT_SECRET must be configured"
**Solución:** Agregar `JWT_SECRET` generado en Paso 1

### "SECURITY ERROR: PIN_SALT must be configured"
**Solución:** Agregar `PIN_SALT` generado en Paso 1

### "Database connection failed"
**Solución:** Verificar `DATABASE_URL` es correcto y Supabase está activo

---

## 📚 DOCUMENTACIÓN COMPLETA

Para más detalles, ver:
- `VERCEL_ENV_SETUP.md` - Guía completa paso a paso
- `SECURITY_SETUP.md` - Guía de seguridad
- `RESUMEN_SEGURIDAD_COMPLETO.md` - Resumen ejecutivo

---

## ✅ CHECKLIST RÁPIDO

- [ ] Secrets generados (Paso 1)
- [ ] VAPID keys generadas (Paso 2)
- [ ] Database URL obtenida (Paso 3)
- [ ] Variables configuradas en Vercel (Paso 4)
- [ ] Deployment exitoso (Paso 5)
- [ ] Login funciona con PIN 1234
- [ ] API health check retorna 200

---

**Tiempo total:** ~15 minutos  
**Última actualización:** 23 Enero 2026

