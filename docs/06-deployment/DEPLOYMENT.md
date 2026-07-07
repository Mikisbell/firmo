# 🚀 FIRMO POS — Guía de Despliegue a Producción

**Versión:** 1.0  
**Fecha:** Febrero 2026  
**Estado:** ✅ Listo para Producción

> **Objetivo:** Guía completa para desplegar FIRMO POS en producción usando Vercel + Supabase con configuración enterprise-grade.

---

## 📋 Tabla de Contenidos

1. [Pre-requisitos](#pre-requisitos)
2. [Arquitectura de Producción](#arquitectura-de-producción)
3. [Despliegue a Vercel](#despliegue-a-vercel)
4. [Configuración de Supabase](#configuración-de-supabase)
5. [Variables de Entorno](#variables-de-entorno)
6. [Dominio y SSL](#dominio-y-ssl)
7. [Monitoreo y Observabilidad](#monitoreo-y-observabilidad)
8. [Backups y Disaster Recovery](#backups-y-disaster-recovery)
9. [Escalamiento](#escalamiento)
10. [CI/CD Pipeline](#cicd-pipeline)
11. [Rollback Procedures](#rollback-procedures)
12. [Checklist Pre-Producción](#checklist-pre-producción)

---

## 🎯 Pre-requisitos

### Cuentas Requeridas

| Servicio | Plan | Costo Mensual | Propósito |
|----------|------|---------------|-----------|
| **Vercel** | Pro | $20/mes | Hosting frontend/backend |
| **Supabase** | Pro | $25/mes | Base de datos PostgreSQL |
| **Upstash Redis** | Free/Pro | $0-10/mes | Rate limiting + cache |
| **GitHub** | Free | $0 | Control de versiones |

**Costo Total:** ~$45-55/mes

### Herramientas Locales

```bash
# Node.js 20+
node --version  # v20.x.x o superior

# Git
git --version

# Vercel CLI (opcional)
npm install -g vercel

# Supabase CLI (opcional)
npm install -g supabase
```

---

## 🏗️ Arquitectura de Producción

```
┌─────────────────────────────────────────────────────────────┐
│                         USUARIOS                             │
│  (15 Terminales + 1 Caja + 5 KDS + Admin Panel)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS (SSL/TLS)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    VERCEL EDGE NETWORK                       │
│  • CDN Global (300+ ubicaciones)                            │
│  • DDoS Protection                                           │
│  • Auto-scaling                                              │
│  • SSL/TLS Termination                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐       ┌───────▼────────┐
│  NEXT.JS APP   │       │  SUPABASE DB   │
│  (Serverless)  │◄──────┤  (PostgreSQL)  │
│                │       │                │
│  • API Routes  │       │  • RLS Enabled │
│  • SSR Pages   │       │  • Backups     │
│  • Static      │       │  • Replication │
└────────┬───────┘       └────────────────┘
         │
         │
┌────────▼───────┐
│  UPSTASH REDIS │
│  (Cache/Limit) │
└────────────────┘
```

### Flujo de Datos

1. **Usuario** → Vercel Edge (CDN)
2. **Vercel** → Next.js Serverless Functions
3. **Next.js** → Supabase PostgreSQL (pooled connection)
4. **Next.js** → Upstash Redis (rate limiting)
5. **Respuesta** → Usuario (< 200ms P95)

---

## 🚀 Despliegue a Vercel

### Paso 1: Conectar Repositorio

1. Ir a [vercel.com](https://vercel.com)
2. Click en "Add New Project"
3. Importar repositorio de GitHub
4. Seleccionar `firmo-pos` (o tu nombre de repo)

### Paso 2: Configurar Build

```bash
# Framework Preset: Next.js
# Build Command: npm run build
# Output Directory: .next
# Install Command: npm install
```

**Configuración Avanzada:**

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### Paso 3: Variables de Entorno

Ver sección [Variables de Entorno](#variables-de-entorno) para configuración completa.

### Paso 4: Deploy

```bash
# Opción 1: Desde Dashboard de Vercel
# Click en "Deploy" → Esperar build (2-3 minutos)

# Opción 2: Desde CLI
vercel --prod
```

### Paso 5: Verificar Deploy

```bash
# URL de producción
https://firmo-pos.vercel.app

# Verificar endpoints
curl https://firmo-pos.vercel.app/api/health
# Respuesta esperada: {"status":"healthy"}
```

---

## 🗄️ Configuración de Supabase

### Paso 1: Crear Proyecto

1. Ir a [supabase.com](https://supabase.com)
2. Click en "New Project"
3. Configurar:
   - **Name:** firmo-pos-production
   - **Database Password:** (generar seguro)
   - **Region:** South America (São Paulo) - más cercano a Perú
   - **Plan:** Pro ($25/mes)

### Paso 2: Configurar Connection Pooling

```sql
-- En Supabase Dashboard → Settings → Database

-- Connection Pooler (PgBouncer)
-- Mode: Transaction
-- Pool Size: 20
-- Port: 6543
```

**URLs de Conexión:**

```bash
# Pooled Connection (para API Routes)
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"

# Direct Connection (para Migraciones)
DIRECT_URL="postgresql://postgres.xxx:password@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

### Paso 3: Habilitar Row Level Security (RLS)

```sql
-- Ejecutar en SQL Editor de Supabase

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ... (repetir para todas las tablas)

-- 2. Crear usuario app con bypass RLS
CREATE USER app_user WITH PASSWORD 'tu-password-seguro-aqui';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER USER app_user SET role TO 'service_role';

-- 3. Políticas RLS para usuarios admin
CREATE POLICY "Tenant isolation" ON orders
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Repetir para todas las tablas con tenant_id
```

### Paso 4: Configurar Backups

```bash
# En Supabase Dashboard → Settings → Database → Backups

# Configuración recomendada:
# - Daily backups: Enabled
# - Retention: 7 days (Pro plan)
# - Point-in-time recovery: Enabled (últimas 7 días)
```

### Paso 5: Ejecutar Migraciones

```bash
# Desde tu máquina local
export DATABASE_URL="postgresql://postgres.xxx:password@..."
export DIRECT_URL="postgresql://postgres.xxx:password@..."

# Ejecutar migraciones
npx prisma migrate deploy

# Verificar schema
npx prisma db pull
```

### Paso 6: Seed de Datos Iniciales

```bash
# Ejecutar seed script
npm run seed:prod

# Verificar datos
npm run verify:prod
```

---

## 🔐 Variables de Entorno

### Configuración en Vercel

1. Ir a **Project Settings** → **Environment Variables**
2. Agregar las siguientes variables:

#### Base de Datos

```bash
# Supabase Pooled Connection (para API Routes)
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"

# Supabase Direct Connection (para Migraciones - solo en build)
DIRECT_URL="postgresql://postgres.xxx:password@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

#### Redis (Upstash)

```bash
# Opción 1: Redis Protocol
REDIS_URL="rediss://default:password@host.upstash.io:6379"

# Opción 2: REST API (recomendado para Vercel)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

#### Seguridad

```bash
# JWT Secret (generar con: openssl rand -base64 32)
JWT_SECRET="tu-jwt-secret-aqui-minimo-32-caracteres"

# PIN Salt (generar con: openssl rand -base64 32)
PIN_SALT="tu-pin-salt-aqui-minimo-32-caracteres"

# API Secret (para endpoints internos)
PARK_API_SECRET="tu-api-secret-aqui"
```

#### Tenant/Location

```bash
# UUID del tenant principal
TENANT_ID="00000000-0000-0000-0000-000000000001"

# UUID de la ubicación
LOCATION_ID="00000000-0000-0000-0000-000000000001"
```

#### Web Push Notifications

```bash
# Generar con: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY="tu-vapid-public-key"
VAPID_PRIVATE_KEY="tu-vapid-private-key"
VAPID_SUBJECT="mailto:admin@tu-dominio.com"
```

#### CORS

```bash
# Dominios permitidos (separados por coma)
ALLOWED_ORIGINS="https://firmo-pos.vercel.app,https://tu-dominio.com"
```

#### Admin API (Opcional)

```bash
# Para endpoints de limpieza/mantenimiento
ADMIN_API_KEY="tu-admin-api-key-seguro"
```

### Verificar Variables

```bash
# Desde Vercel CLI
vercel env ls

# Probar localmente con variables de producción
vercel env pull .env.production.local
npm run build
```

---

## 🌐 Dominio y SSL

### Paso 1: Configurar Dominio Personalizado

1. En Vercel Dashboard → **Settings** → **Domains**
2. Agregar dominio: `pos.tu-restaurante.com`
3. Configurar DNS:

```dns
# Opción 1: CNAME (recomendado)
CNAME  pos  cname.vercel-dns.com

# Opción 2: A Record
A      pos  76.76.21.21
```

### Paso 2: SSL/TLS Automático

Vercel configura SSL automáticamente:
- ✅ Certificado Let's Encrypt
- ✅ Auto-renovación
- ✅ HTTPS forzado
- ✅ HTTP/2 habilitado

### Paso 3: Verificar SSL

```bash
# Verificar certificado
curl -I https://pos.tu-restaurante.com

# Verificar redirección HTTP → HTTPS
curl -I http://pos.tu-restaurante.com
# Debe retornar 308 Permanent Redirect
```

---

## 📊 Monitoreo y Observabilidad

### Vercel Analytics

**Incluido en plan Pro:**
- Real User Monitoring (RUM)
- Web Vitals (LCP, FID, CLS)
- Performance insights
- Error tracking

**Configuración:**

```typescript
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Supabase Dashboard

**Métricas disponibles:**
- Database CPU/Memory usage
- Connection pool status
- Query performance
- Storage usage
- API requests

**Alertas recomendadas:**
- CPU > 80% por 5 minutos
- Connections > 90% del pool
- Slow queries > 1 segundo
- Storage > 80% capacity

### Uptime Monitoring

**Herramientas recomendadas:**

1. **UptimeRobot** (Free)
   - Monitor cada 5 minutos
   - Alertas por email/SMS
   - Status page público

2. **Vercel Monitoring** (Incluido)
   - Uptime tracking
   - Response time
   - Error rate

**Endpoints a monitorear:**

```bash
# Health check
GET https://pos.tu-restaurante.com/api/health

# Auth check
POST https://pos.tu-restaurante.com/api/auth/login

# Events ingest
POST https://pos.tu-restaurante.com/api/events/ingest
```

### Logs

**Vercel Logs:**
```bash
# Ver logs en tiempo real
vercel logs --follow

# Filtrar por función
vercel logs --function api/events/ingest

# Últimas 100 líneas
vercel logs --limit 100
```

**Supabase Logs:**
```sql
-- Query logs (últimas 24 horas)
SELECT * FROM pg_stat_statements
WHERE query LIKE '%orders%'
ORDER BY total_exec_time DESC
LIMIT 20;
```

---

## 💾 Backups y Disaster Recovery

### Estrategia de Backups

| Tipo | Frecuencia | Retención | Ubicación |
|------|------------|-----------|-----------|
| **Database** | Diario (automático) | 7 días | Supabase |
| **Point-in-Time** | Continuo | 7 días | Supabase |
| **Manual Snapshot** | Semanal | 30 días | S3/Local |
| **Events Log** | Continuo | Indefinido | PostgreSQL |

### Backup Manual de Base de Datos

```bash
# Exportar schema + datos
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Comprimir
gzip backup-$(date +%Y%m%d).sql

# Subir a S3 (opcional)
aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://firmo-pos-backups/
```

### Restauración desde Backup

```bash
# Opción 1: Point-in-Time Recovery (Supabase)
# Desde Dashboard → Database → Backups → Restore

# Opción 2: Desde archivo SQL
psql $DATABASE_URL < backup-20260213.sql

# Opción 3: Desde Supabase CLI
supabase db restore backup-20260213.sql
```

### Disaster Recovery Plan

**RTO (Recovery Time Objective):** 1 hora  
**RPO (Recovery Point Objective):** 5 minutos

**Procedimiento:**

1. **Detectar incidente** (< 5 min)
   - Alertas de monitoreo
   - Reportes de usuarios

2. **Evaluar impacto** (< 10 min)
   - ¿Qué está caído?
   - ¿Cuántos usuarios afectados?

3. **Activar plan** (< 15 min)
   - Notificar equipo
   - Comunicar a usuarios

4. **Restaurar servicio** (< 30 min)
   - Rollback a versión anterior
   - Restaurar desde backup
   - Fix forward si es rápido

5. **Verificar** (< 10 min)
   - Smoke tests
   - Verificar datos

6. **Post-mortem** (< 24 horas)
   - Documentar incidente
   - Identificar causa raíz
   - Implementar prevención

---

## 📈 Escalamiento

### Escalamiento Horizontal (Vercel)

**Automático:**
- Vercel escala automáticamente según demanda
- Sin configuración adicional
- Límites del plan Pro:
  - 100 GB bandwidth/mes
  - 1000 GB-hours compute/mes
  - Unlimited requests

**Monitorear:**
```bash
# Ver uso actual
vercel usage

# Alertas si se acerca al límite
# Configurar en Dashboard → Settings → Usage Alerts
```

### Escalamiento de Base de Datos

**Supabase Pro:**
- 8 GB RAM
- 4 CPU cores
- 100 GB storage
- 500 concurrent connections

**Upgrade a Enterprise si:**
- > 500 connections simultáneas
- > 100 GB storage
- Necesitas read replicas
- Necesitas multi-region

**Optimizaciones:**

```sql
-- 1. Connection Pooling (ya configurado)
-- Ver configuración en Paso 2 de Supabase

-- 2. Índices de Performance
CREATE INDEX CONCURRENTLY idx_orders_active 
ON orders(tenant_id, order_status) 
WHERE order_status IN ('OPEN','IN_PROGRESS');

CREATE INDEX CONCURRENTLY idx_orders_stations 
ON orders USING GIN(stations_active);

-- 3. Vacuum automático
ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.1);
```

### Escalamiento de Redis

**Upstash Free:**
- 10,000 commands/day
- 256 MB storage

**Upgrade a Pro si:**
- > 10,000 commands/day
- Necesitas más storage
- Necesitas replicación

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run TypeScript checks
        run: npm run typecheck
      
      - name: Run unit tests
        run: npm test
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          REDIS_URL: ${{ secrets.TEST_REDIS_URL }}
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Configurar Secrets en GitHub

1. Ir a **Settings** → **Secrets and variables** → **Actions**
2. Agregar secrets:

```bash
VERCEL_TOKEN=tu-vercel-token
VERCEL_ORG_ID=tu-org-id
VERCEL_PROJECT_ID=tu-project-id
TEST_DATABASE_URL=postgresql://...
TEST_REDIS_URL=redis://...
```

### Flujo de Deploy

```
┌─────────────┐
│  Git Push   │
│  to main    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Run Tests  │
│  (5 min)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Build     │
│  (2 min)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Deploy    │
│  (1 min)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Verify     │
│  (1 min)    │
└─────────────┘
```

**Tiempo total:** ~9 minutos

---

## ⏪ Rollback Procedures

### Rollback Inmediato (< 2 minutos)

```bash
# Opción 1: Desde Vercel Dashboard
# Deployments → Click en deployment anterior → "Promote to Production"

# Opción 2: Desde CLI
vercel rollback
```

### Rollback con Verificación (< 5 minutos)

```bash
# 1. Identificar deployment anterior estable
vercel ls

# 2. Promover deployment específico
vercel promote <deployment-url>

# 3. Verificar
curl https://pos.tu-restaurante.com/api/health
```

### Rollback de Base de Datos (< 30 minutos)

```bash
# 1. Identificar punto de restauración
# Supabase Dashboard → Database → Backups

# 2. Restaurar a punto específico
# Click en "Restore" → Seleccionar timestamp

# 3. Verificar datos
psql $DATABASE_URL -c "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 hour';"

# 4. Re-ejecutar migraciones si es necesario
npx prisma migrate deploy
```

### Rollback de Código + DB (< 1 hora)

```bash
# 1. Rollback de código
vercel rollback

# 2. Identificar migración a revertir
npx prisma migrate status

# 3. Revertir migración (manual)
psql $DATABASE_URL < prisma/migrations/XXX_revert.sql

# 4. Verificar integridad
npm run verify:prod
```

---

## ✅ Checklist Pre-Producción

### Infraestructura

- [ ] Cuenta Vercel Pro creada y configurada
- [ ] Cuenta Supabase Pro creada y configurada
- [ ] Cuenta Upstash Redis creada
- [ ] Dominio personalizado configurado
- [ ] SSL/TLS verificado y funcionando
- [ ] DNS propagado correctamente

### Base de Datos

- [ ] Migraciones ejecutadas exitosamente
- [ ] RLS habilitado en todas las tablas
- [ ] Usuario `app_user` creado con permisos correctos
- [ ] Connection pooling configurado (port 6543)
- [ ] Índices de performance creados
- [ ] Backups automáticos habilitados
- [ ] Point-in-time recovery habilitado

### Seguridad

- [ ] Variables de entorno configuradas en Vercel
- [ ] JWT_SECRET generado con 32+ caracteres
- [ ] PIN_SALT generado con 32+ caracteres
- [ ] PARK_API_SECRET configurado
- [ ] CORS configurado correctamente
- [ ] Rate limiting habilitado
- [ ] Headers de seguridad configurados

### Aplicación

- [ ] Build de producción exitoso (`npm run build`)
- [ ] Tests unitarios pasando (214 tests)
- [ ] Tests E2E pasando (52 tests)
- [ ] TypeScript sin errores (`npm run typecheck`)
- [ ] Linter sin errores (`npm run lint`)
- [ ] Service Worker funcionando offline
- [ ] PWA instalable en dispositivos

### Datos Iniciales

- [ ] Tenant principal creado
- [ ] Empleados seed creados
- [ ] Productos seed creados
- [ ] Estaciones configuradas (PARRILLA, BAR, etc.)
- [ ] Terminales registrados
- [ ] Promociones iniciales creadas

### Monitoreo

- [ ] Vercel Analytics habilitado
- [ ] Supabase Dashboard configurado
- [ ] UptimeRobot monitors creados
- [ ] Alertas de email/SMS configuradas
- [ ] Logs accesibles y funcionando

### CI/CD

- [ ] GitHub Actions workflow configurado
- [ ] Secrets de GitHub configurados
- [ ] Deploy automático funcionando
- [ ] Tests automáticos en PR

### Documentación

- [ ] README.md actualizado con URL de producción
- [ ] SETUP.md con instrucciones de producción
- [ ] API.md con endpoints de producción
- [ ] Credenciales documentadas en lugar seguro (1Password/Vault)

### Testing Final

- [ ] Smoke test: Login funciona
- [ ] Smoke test: Crear orden funciona
- [ ] Smoke test: Pago funciona
- [ ] Smoke test: KDS recibe órdenes
- [ ] Smoke test: Admin panel accesible
- [ ] Smoke test: Reportes generan correctamente
- [ ] Load test: 100 requests/min sin errores
- [ ] Offline test: App funciona sin internet

### Comunicación

- [ ] Equipo notificado de fecha de lanzamiento
- [ ] Usuarios finales capacitados
- [ ] Soporte técnico preparado
- [ ] Plan de rollback comunicado
- [ ] Contactos de emergencia documentados

---

## 🆘 Soporte y Troubleshooting

### Problemas Comunes

#### 1. Build Falla en Vercel

```bash
# Error: "Module not found"
# Solución: Verificar que todas las dependencias estén en package.json
npm install --save <missing-package>
git commit -am "fix: add missing dependency"
git push

# Error: "TypeScript errors"
# Solución: Corregir errores localmente primero
npm run typecheck
# Corregir errores
git commit -am "fix: typescript errors"
git push
```

#### 2. Database Connection Timeout

```bash
# Error: "Connection timeout"
# Solución: Verificar connection pooling
# 1. Usar DATABASE_URL con port 6543 (pooled)
# 2. Agregar ?pgbouncer=true&connection_limit=20
# 3. Verificar que Supabase no esté en mantenimiento
```

#### 3. Rate Limiting Bloqueando Usuarios

```bash
# Error: "429 Too Many Requests"
# Solución: Ajustar límites en middleware
# src/middleware.ts
const limiter = new RateLimiter({
  max: 200, // Aumentar de 100 a 200
  window: '1m'
});
```

#### 4. Slow Queries

```sql
-- Identificar queries lentas
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Agregar índices faltantes
CREATE INDEX CONCURRENTLY idx_missing ON table(column);
```

### Contactos de Emergencia

| Rol | Contacto | Disponibilidad |
|-----|----------|----------------|
| **DevOps Lead** | devops@tu-empresa.com | 24/7 |
| **Backend Lead** | backend@tu-empresa.com | 9am-6pm |
| **Vercel Support** | support@vercel.com | 24/7 (Pro plan) |
| **Supabase Support** | support@supabase.com | 24/7 (Pro plan) |

---

## 📚 Referencias

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Production Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

**Última actualización:** 13 Febrero 2026  
**Versión:** 1.0.0  
**Mantenido por:** Equipo FIRMO POS
