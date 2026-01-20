# DEPLOYMENT A PRODUCCIÓN

**Duración:** 1 día (después de QA)  
**Objetivo:** Lanzamiento seguro a producción

---

## PRE-DEPLOYMENT CHECKLIST

### Código
- [ ] Todos los tests passing (100%)
- [ ] Coverage > 85%
- [ ] No hay console.log en código de producción
- [ ] No hay TODOs críticos
- [ ] Branch `main` actualizado

### Configuración
- [ ] Variables de entorno configuradas en Vercel
  - [ ] `DATABASE_URL`
  - [ ] `TENANT_ID`
  - [ ] `JWT_SECRET`
  - [ ] `ALLOWED_ORIGINS`
  - [ ] `NODE_ENV=production`
  - [ ] `LOG_LEVEL=info`
- [ ] Secrets configurados
- [ ] CORS configurado correctamente

### Base de Datos
- [ ] Backup de producción creado
- [ ] Migraciones probadas en staging
- [ ] Rollback plan documentado

### Monitoring
- [ ] Grafana dashboard configurado
- [ ] Alertas configuradas
- [ ] Logs centralizados
- [ ] Error tracking (Sentry) configurado

---

## DEPLOYMENT PROCESS

### Fase 1: Preparación (1h)

**09:00-09:15 (15min)** - Comunicación
- [ ] Notificar al equipo
- [ ] Notificar a stakeholders
- [ ] Programar ventana de mantenimiento (si necesario)

**09:15-09:30 (15min)** - Backup
- [ ] Backup completo de BD producción
- [ ] Verificar backup exitoso
- [ ] Guardar en ubicación segura

**09:30-10:00 (30min)** - Final checks
- [ ] Ejecutar tests una última vez
- [ ] Verificar staging funcionando
- [ ] Revisar changelog
- [ ] Revisar rollback plan

---

### Fase 2: Database Migration (30min)

**10:00-10:15 (15min)** - Ejecutar migraciones
- [ ] Conectar a BD producción
- [ ] Ejecutar `npx prisma migrate deploy`
- [ ] Verificar migraciones exitosas
- [ ] Verificar índices creados

**10:15-10:30 (15min)** - Verificación
- [ ] Ejecutar queries de verificación
- [ ] Verificar integridad de datos
- [ ] Verificar performance de queries

---

### Fase 3: Application Deployment (30min)

**10:30-10:45 (15min)** - Deploy
- [ ] Merge `staging` a `main`
- [ ] Push a GitHub
- [ ] Vercel auto-deploy inicia
- [ ] Monitorear build logs

**10:45-11:00 (15min)** - Verificación
- [ ] Verificar deployment exitoso
- [ ] Verificar health check endpoint
- [ ] Verificar logs no muestran errores

---

### Fase 4: Smoke Testing (1h)

**11:00-11:15 (15min)** - Auth flow
- [ ] Login con OWNER
- [ ] Login con MANAGER
- [ ] Login con CASHIER
- [ ] Logout

**11:15-11:30 (15min)** - CRUD operations
- [ ] Crear empleado
- [ ] Actualizar empleado
- [ ] Desactivar empleado
- [ ] Crear producto
- [ ] Actualizar producto

**11:30-11:45 (15min)** - Validaciones
- [ ] Intentar crear empleado con PIN duplicado (debe fallar)
- [ ] Intentar crear producto con precio negativo (debe fallar)
- [ ] Verificar rate limiting funciona
- [ ] Verificar paginación funciona

**11:45-12:00 (15min)** - Monitoring
- [ ] Verificar métricas en Grafana
- [ ] Verificar logs en Pino
- [ ] Verificar no hay errores
- [ ] Verificar performance OK

---

### Fase 5: Monitoring (2h)

**12:00-14:00 (2h)** - Observación activa
- [ ] Monitorear dashboard cada 15min
- [ ] Revisar logs cada 15min
- [ ] Verificar error rate < 1%
- [ ] Verificar response time < 500ms
- [ ] Estar listo para rollback si necesario

---

## POST-DEPLOYMENT

### Inmediato (Día 1)

**14:00-14:30 (30min)** - Comunicación
- [ ] Notificar deployment exitoso
- [ ] Compartir métricas iniciales
- [ ] Documentar issues encontrados (si hay)

**14:30-15:00 (30min)** - Documentación
- [ ] Actualizar deployment log
- [ ] Documentar lecciones aprendidas
- [ ] Actualizar runbook

---

### Seguimiento (Semana 1)

**Día 2-7:**
- [ ] Monitorear métricas diariamente
- [ ] Revisar logs de errores
- [ ] Recolectar feedback de usuarios
- [ ] Corregir bugs menores si aparecen

---

## ROLLBACK PLAN

### Cuándo hacer rollback:
- Error rate > 5%
- Response time > 2s (p95)
- Crash de aplicación
- Data corruption
- Security breach

### Proceso de rollback:

**Paso 1: Decisión (5min)**
- [ ] Evaluar severidad
- [ ] Decidir rollback
- [ ] Notificar al equipo

**Paso 2: Rollback de aplicación (10min)**
- [ ] Revertir deployment en Vercel
- [ ] Verificar versión anterior funcionando
- [ ] Smoke test rápido

**Paso 3: Rollback de BD (si necesario) (30min)**
- [ ] Restaurar backup
- [ ] Verificar integridad
- [ ] Revertir migraciones si necesario

**Paso 4: Verificación (15min)**
- [ ] Verificar sistema funcionando
- [ ] Notificar rollback completado
- [ ] Investigar causa raíz

---

## MÉTRICAS DE ÉXITO

### Día 1
- ✅ Deployment exitoso sin rollback
- ✅ Error rate < 1%
- ✅ Response time p95 < 500ms
- ✅ No crashes
- ✅ No security issues

### Semana 1
- ✅ Uptime > 99.9%
- ✅ Error rate < 0.5%
- ✅ Response time p95 < 400ms
- ✅ Feedback positivo de usuarios
- ✅ No bugs críticos

### Mes 1
- ✅ Uptime > 99.95%
- ✅ Error rate < 0.1%
- ✅ Response time p95 < 300ms
- ✅ Todos los 20 problemas resueltos funcionando
- ✅ Sistema estable y escalable

---

## CONTACTOS DE EMERGENCIA

### Equipo Técnico
- Dev 1: [nombre] - [teléfono] - [email]
- Dev 2: [nombre] - [teléfono] - [email]
- Tech Lead: [nombre] - [teléfono] - [email]

### Infraestructura
- Vercel Support: support@vercel.com
- Database Provider: [contacto]

### Escalación
- CTO: [nombre] - [teléfono]
- CEO: [nombre] - [teléfono]

---

## RUNBOOK

### Problema: Error rate alto

**Síntomas:**
- Dashboard muestra error rate > 5%
- Logs muestran muchos errores 500

**Diagnóstico:**
1. Revisar logs para identificar endpoint
2. Revisar stack traces
3. Verificar BD funcionando
4. Verificar variables de entorno

**Solución:**
- Si es bug de código: hotfix + deploy
- Si es BD: verificar conexiones
- Si es config: verificar env vars
- Si no se puede resolver rápido: rollback

---

### Problema: Response time alto

**Síntomas:**
- Dashboard muestra p95 > 2s
- Usuarios reportan lentitud

**Diagnóstico:**
1. Identificar endpoint lento en métricas
2. Revisar query performance
3. Verificar índices de BD
4. Verificar carga del servidor

**Solución:**
- Optimizar query problemática
- Agregar índice faltante
- Escalar recursos si necesario
- Implementar caching si aplica

---

### Problema: Rate limiting excesivo

**Síntomas:**
- Usuarios reportan error 429
- Métricas muestran muchos rate limit hits

**Diagnóstico:**
1. Verificar configuración de rate limits
2. Identificar IPs afectadas
3. Determinar si es uso legítimo o ataque

**Solución:**
- Si es uso legítimo: aumentar límites
- Si es ataque: mantener límites o reducir
- Considerar whitelist para IPs conocidas

---

## ✅ DEPLOYMENT CHECKLIST FINAL

- [ ] Pre-deployment checklist completado
- [ ] Backup de BD creado
- [ ] Migraciones ejecutadas exitosamente
- [ ] Aplicación deployada
- [ ] Smoke tests passing
- [ ] Monitoring activo
- [ ] Equipo notificado
- [ ] Documentación actualizada
- [ ] Rollback plan listo
- [ ] Runbook actualizado

**Criterio de éxito:** Sistema en producción, estable, monitoreado.

---

**¡FELICITACIONES! Sistema production-ready de clase mundial.**
