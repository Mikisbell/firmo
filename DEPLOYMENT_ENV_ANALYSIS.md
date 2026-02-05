# 🔍 DEPLOYMENT ENV ANALYSIS — Análisis de Variables de Entorno

**Fecha:** 5 Febrero 2026  
**Objetivo:** Documentar variables de entorno y preparar para producción  
**Status:** 🔴 EN PROGRESO

---

## 📊 ESTADO ACTUAL

### Variables Existentes en `.env`

| Variable | Status | Valor Actual | Producción |
|----------|--------|--------------|-----------|
| **DATABASE_URL** | ✅ | Supabase pooler | ⚠️ Cambiar |
| **DIRECT_URL** | ✅ | Supabase direct | ⚠️ Cambiar |
| **JWT_SECRET** | ✅ | Configurado | ✅ OK |
| **PIN_SALT** | ✅ | Configurado | ✅ OK |
| **PARK_API_SECRET** | ✅ | Configurado | ✅ OK |
| **ADMIN_API_KEY** | ✅ | Configurado | ✅ OK |
| **REDIS_URL** | ⚠️ | localhost:6379 | 🔴 CAMBIAR |
| **VAPID_PUBLIC_KEY** | ✅ | Configurado | ✅ OK |
| **VAPID_PRIVATE_KEY** | ✅ | Configurado | ✅ OK |
| **VAPID_SUBJECT** | ✅ | Configurado | ✅ OK |
| **TENANT_ID** | ✅ | UUID | ✅ OK |
| **LOCATION_ID** | ✅ | UUID | ✅ OK |
| **NEXTAUTH_SECRET** | ✅ | Configurado | ✅ OK |
| **NEXTAUTH_URL** | ⚠️ | localhost:3000 | 🔴 CAMBIAR |
| **NEXTAUTH_URL_INTERNAL** | ⚠️ | localhost:3000 | 🔴 CAMBIAR |
| **ALLOWED_ORIGINS** | ⚠️ | localhost | 🔴 CAMBIAR |

---

## 🔴 VARIABLES QUE NECESITAN CAMBIOS PARA PRODUCCIÓN

### 1. REDIS_URL (CRÍTICO)

**Actual (Desarrollo):**
```
REDIS_URL="redis://localhost:6379"
```

**Producción (Upstash):**
```
REDIS_URL="rediss://default:PASSWORD@HOST.upstash.io:6379"
```

**Pasos:**
1. Crear cuenta en Upstash (https://upstash.com)
2. Crear instancia Redis
3. Copiar URL de conexión
4. Reemplazar en `.env.production`

**Alternativas:**
- Redis Cloud: `redis://default:PASSWORD@HOST.redis.cloud:PORT`
- Railway: `redis://default:PASSWORD@HOST.railway.app:PORT`

---

### 2. NEXTAUTH_URL (CRÍTICO)

**Actual (Desarrollo):**
```
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_URL_INTERNAL="http://localhost:3000"
```

**Producción:**
```
NEXTAUTH_URL="https://parkpos.pe"  # O tu dominio
NEXTAUTH_URL_INTERNAL="https://parkpos.pe"
```

**Pasos:**
1. Decidir dominio final (ej: parkpos.pe, app.parkpos.pe)
2. Configurar en Vercel
3. Actualizar en `.env.production`

---

### 3. ALLOWED_ORIGINS (CRÍTICO)

**Actual (Desarrollo):**
```
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
```

**Producción:**
```
ALLOWED_ORIGINS="https://parkpos.pe,https://www.parkpos.pe"
```

**Pasos:**
1. Definir dominios permitidos
2. Actualizar en `.env.production`
3. Verificar CORS en APIs

---

### 4. DATABASE_URL & DIRECT_URL (IMPORTANTE)

**Actual (Desarrollo):**
```
DATABASE_URL="postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.%24@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.%24@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"
```

**Producción:**
```
# Opción 1: Usar mismo proyecto Supabase (cambiar usuario)
DATABASE_URL="postgresql://app_user:PASSWORD@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://app_user:PASSWORD@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1"

# Opción 2: Crear proyecto Supabase separado para producción
DATABASE_URL="postgresql://app_user:PASSWORD@NEW_HOST.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://app_user:PASSWORD@NEW_HOST.pooler.supabase.com:5432/postgres?connection_limit=1"
```

**Pasos:**
1. Decidir si usar mismo proyecto o crear uno nuevo
2. Crear usuario `app_user` en Supabase
3. Configurar RLS policies
4. Actualizar credenciales

---

## ✅ VARIABLES QUE ESTÁN BIEN

### Secretos de Seguridad
- ✅ JWT_SECRET — Configurado correctamente
- ✅ PIN_SALT — Configurado correctamente
- ✅ PARK_API_SECRET — Configurado correctamente
- ✅ ADMIN_API_KEY — Configurado correctamente
- ✅ NEXTAUTH_SECRET — Configurado correctamente

### VAPID (Web Push)
- ✅ VAPID_PUBLIC_KEY — Configurado
- ✅ VAPID_PRIVATE_KEY — Configurado
- ✅ VAPID_SUBJECT — Configurado

### Tenant
- ✅ TENANT_ID — Configurado
- ✅ LOCATION_ID — Configurado

---

## 📋 CHECKLIST PARA PRODUCCIÓN

### Paso 1: Crear `.env.production`
- [ ] Copiar `.env.example`
- [ ] Actualizar REDIS_URL (Upstash)
- [ ] Actualizar NEXTAUTH_URL (dominio)
- [ ] Actualizar ALLOWED_ORIGINS (dominio)
- [ ] Actualizar DATABASE_URL (si es nuevo proyecto)
- [ ] Actualizar DIRECT_URL (si es nuevo proyecto)
- [ ] Verificar que no hay valores localhost
- [ ] Verificar que todos los secretos están configurados

### Paso 2: Configurar Upstash Redis
- [ ] Crear cuenta en Upstash
- [ ] Crear instancia Redis
- [ ] Copiar REDIS_URL
- [ ] Probar conexión

### Paso 3: Configurar Vercel
- [ ] Conectar repositorio GitHub
- [ ] Configurar variables de entorno en Vercel
- [ ] Configurar dominio personalizado
- [ ] Verificar SSL/TLS automático

### Paso 4: Configurar Supabase (si es nuevo proyecto)
- [ ] Crear proyecto Supabase en producción
- [ ] Migrar schema (prisma migrate deploy)
- [ ] Crear usuario app_user
- [ ] Configurar RLS policies
- [ ] Configurar backups automáticos

### Paso 5: Verificar Configuración
- [ ] Probar conexión a base de datos
- [ ] Probar conexión a Redis
- [ ] Probar autenticación
- [ ] Probar APIs
- [ ] Verificar CORS

---

## 🚀 VARIABLES ADICIONALES PARA PRODUCCIÓN

### Monitoring & Logging
```
# Sentry (Error Tracking)
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
SENTRY_ENVIRONMENT="production"

# Vercel Analytics
VERCEL_ANALYTICS_ID="your-analytics-id"
```

### Email (Opcional)
```
# SendGrid o similar
SENDGRID_API_KEY="your-sendgrid-key"
SENDGRID_FROM_EMAIL="noreply@parkpos.pe"
```

### Stripe (Opcional - para pagos)
```
STRIPE_PUBLIC_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## 📊 RESUMEN

| Categoría | Status | Acción |
|-----------|--------|--------|
| **Secretos** | ✅ | Mantener como están |
| **Database** | ⚠️ | Decidir: mismo proyecto o nuevo |
| **Redis** | 🔴 | Crear Upstash |
| **Dominio** | 🔴 | Decidir dominio final |
| **CORS** | 🔴 | Actualizar con dominio |
| **Monitoring** | 🔴 | Configurar Sentry (opcional) |

---

## 🎯 PRÓXIMOS PASOS

### Hoy (5 Febrero)
1. ✅ Crear este análisis
2. ⏳ Decidir: ¿Mismo proyecto Supabase o nuevo?
3. ⏳ Decidir: ¿Cuál es el dominio final?

### Mañana (6 Febrero)
1. Crear instancia Upstash Redis
2. Crear `.env.production`
3. Configurar Vercel

### Esta Semana (6-12 Febrero)
1. Completar todas las variables
2. Probar configuración
3. Documentar en `DEPLOYMENT_PROCEDURE.md`

---

## 📞 REFERENCIAS

- `.env.example` — Template de variables
- `.env` — Configuración actual
- `P3_MASTER_PLAN.md` — Plan maestro
- `P3_PRODUCTION_DEPLOYMENT_WEEK1.md` — Semana 1

---

**Última actualización:** 5 Febrero 2026  
**Próxima actualización:** 6 Febrero 2026

