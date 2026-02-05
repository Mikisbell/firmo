# 🚀 VERCEL DEPLOYMENT — Pasos para Llevar a Producción

**Fecha:** 5 Febrero 2026  
**Status:** ✅ `.env.production` CREADO  
**Próximo Paso:** Conectar a Vercel

---

## ✅ LO QUE YA HICIMOS

1. ✅ Creado `.env.production` con URLs de Vercel
2. ✅ Configuradas todas las variables de entorno
3. ✅ Cambios mínimos necesarios (solo URLs)

---

## 🎯 PRÓXIMOS PASOS (MANUAL EN VERCEL)

### Paso 1: Conectar GitHub a Vercel

1. Ir a https://vercel.com
2. Hacer login (o crear cuenta)
3. Click en "New Project"
4. Seleccionar "Import Git Repository"
5. Buscar tu repositorio (parkpos)
6. Click en "Import"

### Paso 2: Configurar Variables de Entorno

1. En Vercel, ir a "Settings" → "Environment Variables"
2. Agregar estas variables (copiar de `.env.production`):

```
DATABASE_URL=postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.%24@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20
DIRECT_URL=postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.%24@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1
REDIS_URL=redis://localhost:6379
JWT_SECRET=CgB3G4MGmwpKGAlisnwaxZJKlg6l0nSy3fYQMH8vKhg=
REFRESH_TOKEN_SECRET=HzK9mN3pQrT7wL8vX2jF5sG9bN6hR4tZmVcWqP8=
PIN_SALT=bcrypt_replaced_secure_salt_32_chars
PARK_API_SECRET=trZSA6uzhY4SIGbQ+bCl8t2BhffTrT35DVnXf5fOgao=
ADMIN_API_KEY=3sdH4SrwYmZDRPmRxw6EeM0QOJAyknulXl4a+oYTE2I=
VAPID_PUBLIC_KEY=BNc4jDxsn95-jcT30OtquC6Q4sjCbivSZIx0QrFjDbhgNBCRwbIIdwJVKv1ZkN0KjDp55V5V4Rj7FW7U6tDgf60
VAPID_PRIVATE_KEY=qxP_g_mAi1Py7WNlAY2qhooTJiaNTUAAkL1JeR6Uwic
VAPID_SUBJECT=mailto:admin@parkpos.pe
TENANT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
LOCATION_ID=9bc7e15f-ca13-43aa-a647-b1e4d46529fd
NEXTAUTH_SECRET=CgB3G4MGmwpKGAlisnwaxZJKlg6l0nSy3fYQMH8vKhg=
NEXTAUTH_URL=https://parkpos.vercel.app
NEXTAUTH_URL_INTERNAL=https://parkpos.vercel.app
ALLOWED_ORIGINS=https://parkpos.vercel.app
```

### Paso 3: Configurar Build Settings

1. En Vercel, ir a "Settings" → "Build & Development Settings"
2. Verificar:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

### Paso 4: Configurar Dominio (Opcional)

1. En Vercel, ir a "Settings" → "Domains"
2. Agregar dominio personalizado (ej: parkpos.pe)
3. O usar dominio Vercel por defecto: `parkpos.vercel.app`

### Paso 5: Deploy

1. Click en "Deploy"
2. Vercel compilará y desplegará automáticamente
3. Esperar a que termine (5-10 minutos)
4. Verificar que el build fue exitoso

---

## 🔴 IMPORTANTE: Redis en Producción

**Problema:** `REDIS_URL="redis://localhost:6379"` NO funciona en Vercel

**Soluciones:**

### Opción 1: Vercel Redis (RECOMENDADO)
```bash
# Si tu plan de Vercel incluye Redis:
# 1. Ir a Vercel Dashboard → Storage → Redis
# 2. Crear instancia Redis
# 3. Copiar URL
# 4. Actualizar REDIS_URL en variables de entorno
```

### Opción 2: Railway (GRATIS)
```bash
# 1. Ir a https://railway.app
# 2. Crear cuenta
# 3. Crear nuevo proyecto
# 4. Agregar Redis
# 5. Copiar URL de conexión
# 6. Actualizar REDIS_URL en Vercel
```

### Opción 3: Upstash (GRATIS)
```bash
# 1. Ir a https://upstash.com
# 2. Crear cuenta
# 3. Crear instancia Redis
# 4. Copiar URL
# 5. Actualizar REDIS_URL en Vercel
```

---

## ✅ CHECKLIST DE DEPLOYMENT

- [ ] Conectar GitHub a Vercel
- [ ] Agregar todas las variables de entorno
- [ ] Configurar build settings
- [ ] Configurar dominio (opcional)
- [ ] Hacer primer deploy
- [ ] Verificar que el build fue exitoso
- [ ] Probar endpoints críticos
- [ ] Verificar logs en Vercel

---

## 🧪 VERIFICACIÓN POST-DEPLOYMENT

Una vez que Vercel haya desplegado, verificar:

### 1. Health Check
```bash
curl https://parkpos.vercel.app/api/health
# Debe retornar: { "status": "ok" }
```

### 2. Login
```bash
# Ir a https://parkpos.vercel.app
# Intentar login con PIN 1234
# Debe funcionar correctamente
```

### 3. API Endpoints
```bash
# Probar endpoints críticos:
GET /api/events/sync
POST /api/events/ingest
GET /api/admin/dashboard
GET /api/tenant/configuration
```

### 4. Logs
```bash
# En Vercel Dashboard:
# 1. Ir a "Deployments"
# 2. Click en el deployment más reciente
# 3. Ver "Logs" para verificar que no hay errores
```

---

## 📊 TIMELINE

```
HOY (5 Feb):        ✅ .env.production creado
MAÑANA (6 Feb):     ⏳ Conectar GitHub a Vercel
MAÑANA (6 Feb):     ⏳ Agregar variables de entorno
MAÑANA (6 Feb):     ⏳ Hacer primer deploy
SEMANA 1 (6-12 Feb): ⏳ Probar endpoints
SEMANA 2 (13-19 Feb): ⏳ Testing en staging
SEMANA 3 (20-26 Feb): ⏳ Deployment a producción
```

---

## 🚀 PRÓXIMO PASO

**Mañana (6 Febrero):**

1. Ir a https://vercel.com
2. Conectar tu repositorio GitHub
3. Agregar variables de entorno (copiar de `.env.production`)
4. Hacer primer deploy
5. Verificar que todo funciona

**Tiempo estimado:** 30-45 minutos

---

## 📞 REFERENCIAS

- `.env.production` — Variables de entorno para producción
- `PRODUCTION_DEPLOYMENT_ZERO_COST.md` — Estrategia ZERO COST
- `P3_WEEK1_SESSION_SUMMARY.md` — Resumen de sesión

---

**Última actualización:** 5 Febrero 2026  
**Status:** ✅ LISTO PARA VERCEL  
**Próximo paso:** Conectar GitHub a Vercel

¡Listo para llevar PARK POS a producción! 🚀

