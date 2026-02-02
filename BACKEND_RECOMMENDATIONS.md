# 🎯 Recomendaciones de Backend - PARK POS

**Fecha:** 2 de Febrero de 2026  
**Prioridad:** ALTA

---

## 📋 Resumen Ejecutivo

El backend está **95% operacional**. Se identificaron 3 problemas críticos y varias mejoras recomendadas.

---

## 🔴 Problemas Críticos (Resolver Inmediatamente)

### 1. NextAuth No Configurado
**Severidad:** 🔴 CRÍTICO  
**Impacto:** Autenticación podría fallar en producción

**Solución:**
```bash
# Generar secret
openssl rand -base64 32

# Agregar a .env.local
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_URL_INTERNAL=http://localhost:3000
```

**Archivos a revisar:**
- `src/core/auth/auth.service.ts`
- `src/app/api/auth/session/route.ts`

---

### 2. Endpoints 404 (Rutas Raíz Faltantes)
**Severidad:** 🔴 CRÍTICO  
**Impacto:** Clientes no pueden acceder a endpoints genéricos

**Problemas:**
- `GET /api/products` → 404 (existe `/api/admin/products`)
- `GET /api/orders` → 404 (existe `/api/orders/[orderId]/...`)
- `GET /api/inventory` → 404 (existe `/api/inventory/stock`, `/api/inventory/stats`)

**Solución:**
Crear rutas raíz que deleguen a endpoints específicos:

```typescript
// src/app/api/products/route.ts
export async function GET(request: NextRequest) {
  // Redirigir a /api/admin/products o crear endpoint público
  return NextResponse.redirect('/api/admin/products');
}

// src/app/api/orders/route.ts
export async function GET(request: NextRequest) {
  // Retornar órdenes del usuario actual
  const session = await getSessionFromRequest(request);
  // ...
}

// src/app/api/inventory/route.ts
export async function GET(request: NextRequest) {
  // Redirigir a /api/inventory/stock
  return NextResponse.redirect('/api/inventory/stock');
}
```

---

### 3. Orden Anómala (#29881)
**Severidad:** 🟡 MAYOR  
**Impacto:** Datos inconsistentes

**Problema:**
- Orden #29881 tiene estado OPEN pero total_cents = 0

**Investigación:**
```sql
SELECT * FROM orders WHERE order_number = 29881;
SELECT * FROM orders WHERE total_cents = 0;
```

**Solución:**
1. Investigar cómo se creó esta orden
2. Validar que `total_cents` nunca sea 0 para órdenes OPEN
3. Agregar validación en `src/core/services/order.service.ts`

---

## 🟡 Problemas Mayores (Resolver Esta Semana)

### 1. Email No Configurado
**Severidad:** 🟡 MAYOR  
**Impacto:** Notificaciones por email no funcionarán

**Solución:**
```bash
# Opción 1: SendGrid
SENDGRID_API_KEY=<key>
SENDGRID_FROM_EMAIL=noreply@parkpos.pe

# Opción 2: AWS SES
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=<key>
AWS_SES_SECRET_ACCESS_KEY=<secret>

# Opción 3: SMTP genérico
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<password>
SMTP_FROM=noreply@parkpos.pe
```

**Archivos a actualizar:**
- `src/core/notifications/email.service.ts` (crear si no existe)
- `src/app/api/notifications/email/route.ts` (crear si no existe)

---

### 2. Stock Bajo en Inventario
**Severidad:** 🟡 MAYOR  
**Impacto:** Operaciones podrían verse afectadas

**Items:**
- Papa: 100 kg (mínimo: 20 kg) → Reabastecer a 150+ kg
- Sal: 10 kg (mínimo: 2 kg) → Reabastecer a 20+ kg

**Acción:**
```bash
# Crear orden de compra o reabastecer manualmente
# Usar endpoint: POST /api/inventory/receive
```

---

### 3. Empleados Inactivos
**Severidad:** 🟡 MAYOR  
**Impacto:** Confusión en sistema

**Empleados:**
- Jorge Díaz (BAR) - Inactivo
- Carmen Vega (WAITER) - Inactivo

**Acción:**
1. Verificar por qué están inactivos
2. Reactivar si es necesario
3. Eliminar si ya no trabajan

---

## 🟢 Mejoras Recomendadas (Próximas 2 Semanas)

### 1. Implementar 2FA (Two-Factor Authentication)
**Beneficio:** Seguridad mejorada  
**Esfuerzo:** Medio

```typescript
// Agregar a src/core/auth/auth.service.ts
export async function enable2FA(userId: string) {
  // Generar secret TOTP
  // Retornar QR code
}

export async function verify2FA(userId: string, code: string) {
  // Verificar código TOTP
}
```

---

### 2. Implementar API Rate Limiting
**Beneficio:** Protección contra abuso  
**Esfuerzo:** Bajo

```typescript
// Ya existe en src/middleware/rate-limit.ts
// Verificar que esté habilitado en todos los endpoints
```

---

### 3. Agregar Logging Centralizado
**Beneficio:** Debugging y auditoría  
**Esfuerzo:** Medio

```typescript
// Usar Winston o Pino para logging
// Centralizar en src/core/observability/logger.ts
```

---

### 4. Implementar Health Checks Avanzados
**Beneficio:** Monitoreo de salud del sistema  
**Esfuerzo:** Bajo

```typescript
// Mejorar GET /api/health
// Incluir: DB, Redis, External APIs, Memory, CPU
```

---

### 5. Agregar Métricas de Performance
**Beneficio:** Identificar cuellos de botella  
**Esfuerzo:** Medio

```typescript
// Usar Prometheus metrics
// Trackear: Response times, Error rates, DB queries
```

---

## 📊 Checklist de Implementación

### Inmediato (Hoy)
- [ ] Configurar NextAuth
- [ ] Crear rutas raíz faltantes
- [ ] Investigar orden anómala
- [ ] Reabastecer inventario

### Esta Semana
- [ ] Configurar Email
- [ ] Reactivar/eliminar empleados inactivos
- [ ] Revisar logs de errores
- [ ] Hacer backup de BD

### Próximas 2 Semanas
- [ ] Implementar 2FA
- [ ] Mejorar logging
- [ ] Agregar health checks avanzados
- [ ] Implementar métricas

---

## 🔧 Comandos Útiles

### Verificar salud del backend
```bash
node scripts/backend-health.mjs
```

### Verificar estado de BD
```bash
node scripts/db-check.mjs
```

### Ejecutar migraciones
```bash
npx prisma migrate deploy
```

### Generar Prisma Client
```bash
npx prisma generate
```

### Ver logs de Prisma
```bash
export DEBUG="prisma:*"
npm run dev
```

---

## 📈 Métricas de Éxito

| Métrica | Actual | Meta | Plazo |
|---------|--------|------|-------|
| **Endpoints Funcionales** | 87/87 | 90/90 | Hoy |
| **Configuración Completa** | 6/8 | 8/8 | Hoy |
| **Errores en Logs** | 3 | 0 | Esta semana |
| **Uptime** | 100% | 99.9% | Permanente |
| **Response Time P95** | <500ms | <200ms | 2 semanas |

---

## 🚀 Plan de Acción

### Fase 1: Crítico (Hoy)
1. Configurar NextAuth (15 min)
2. Crear rutas raíz (30 min)
3. Investigar orden anómala (20 min)
4. Reabastecer inventario (10 min)
**Total: 1.25 horas**

### Fase 2: Mayor (Esta semana)
1. Configurar Email (30 min)
2. Gestionar empleados (15 min)
3. Revisar logs (30 min)
4. Backup de BD (10 min)
**Total: 1.5 horas**

### Fase 3: Mejoras (Próximas 2 semanas)
1. Implementar 2FA (4 horas)
2. Mejorar logging (3 horas)
3. Health checks avanzados (2 horas)
4. Métricas (3 horas)
**Total: 12 horas**

---

## 📞 Contacto y Soporte

Para preguntas o problemas:
1. Revisar logs: `npm run dev`
2. Ejecutar health check: `node scripts/backend-health.mjs`
3. Revisar BD: `node scripts/db-check.mjs`
4. Consultar documentación: `docs/`

---

**Generado por:** Backend Analysis System  
**Próxima revisión:** 3 de Febrero de 2026
