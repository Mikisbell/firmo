# TESTING Y QA (Semana 4)

**Duración:** Días 18-21 (4 días)  
**Objetivo:** Verificar calidad y preparar para producción

---

## DÍA 18: Testing Completo (8h)

### MAÑANA: Unit Tests (4h)

#### Dev 1 + Dev 2: Ejecutar Suite Completa (4h)

**08:00-09:00 (1h)** - Ejecutar todos los tests
- [ ] `npm run test`
- [ ] Verificar coverage > 80%
- [ ] Identificar tests fallando

**09:00-11:00 (2h)** - Corregir tests fallando
- [ ] Fix tests rotos por refactoring
- [ ] Actualizar mocks si necesario
- [ ] Re-ejecutar hasta 100% passing

**11:00-12:00 (1h)** - Agregar tests faltantes
- [ ] Identificar código sin coverage
- [ ] Escribir tests para cubrir
- [ ] Objetivo: > 85% coverage

---

### TARDE: Integration Tests (4h)

#### Dev 1 + Dev 2: E2E Testing (4h)

**13:00-14:00 (1h)** - Auth flow
- [ ] Test: Login con PIN correcto
- [ ] Test: Login con PIN incorrecto (rate limited después de 5 intentos)
- [ ] Test: Logout limpia sesión
- [ ] Test: Sesión expira después de 30min

**14:00-15:00 (1h)** - CRUD Employees
- [ ] Test: Crear empleado válido
- [ ] Test: Rechazar PIN duplicado
- [ ] Test: Rechazar MANAGER creando OWNER
- [ ] Test: Actualizar empleado
- [ ] Test: Desactivar empleado (soft delete)
- [ ] Test: No desactivar último OWNER

**15:00-16:00 (1h)** - CRUD Products
- [ ] Test: Crear producto válido
- [ ] Test: Rechazar precio negativo
- [ ] Test: Rechazar SKU duplicado
- [ ] Test: Actualizar producto
- [ ] Test: catalog_version incrementa correctamente
- [ ] Test: Desactivar producto

**16:00-17:00 (1h)** - CRUD Promotions
- [ ] Test: Crear promoción válida
- [ ] Test: Rechazar descuento > 100%
- [ ] Test: Rechazar fechas inválidas
- [ ] Test: Actualizar promoción
- [ ] Test: Desactivar promoción

---

## DÍA 19: Performance Testing (8h)

### MAÑANA: Load Testing (4h)

#### Dev 1: Configurar k6 (4h)

**08:00-09:00 (1h)** - Instalar k6
- [ ] Instalar k6
  ```bash
  # Windows
  choco install k6
  
  # Mac
  brew install k6
  ```

**09:00-11:00 (2h)** - Crear scripts de load testing
- [ ] Script: GET /api/admin/employees (100 VUs, 1min)
  ```javascript
  import http from 'k6/http';
  import { check } from 'k6';
  
  export const options = {
    vus: 100,
    duration: '1m',
  };
  
  export default function () {
    const res = http.get('http://localhost:3000/api/admin/employees');
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
  }
  ```
- [ ] Script: POST /api/admin/employees (50 VUs, 1min)
- [ ] Script: Mixed workload (GET 70%, POST 20%, PUT 10%)

**11:00-12:00 (1h)** - Ejecutar tests
- [ ] Ejecutar cada script
- [ ] Documentar resultados
- [ ] Identificar bottlenecks

---

#### Dev 2: Database Performance (4h en paralelo)

**08:00-10:00 (2h)** - Analizar queries lentas
- [ ] Habilitar query logging en Prisma
- [ ] Ejecutar operaciones comunes
- [ ] Identificar queries > 100ms
- [ ] Verificar que índices se usan

**10:00-12:00 (2h)** - Optimizar queries
- [ ] Agregar `select` para reducir datos
- [ ] Usar `include` en vez de queries separadas
- [ ] Verificar N+1 queries
- [ ] Re-test performance

---

### TARDE: Stress Testing (4h)

#### Dev 1 + Dev 2: Límites del Sistema (4h)

**13:00-14:00 (1h)** - Paginación bajo carga
- [ ] Crear 10,000 productos en BD
- [ ] Test: GET con paginación
- [ ] Verificar: response time < 500ms
- [ ] Verificar: memoria estable

**14:00-15:00 (1h)** - Concurrencia
- [ ] Test: 10 productos creados simultáneamente
- [ ] Verificar: catalog_version correcto
- [ ] Test: 10 empleados creados simultáneamente
- [ ] Verificar: no hay PINs duplicados

**15:00-16:00 (1h)** - Rate limiting
- [ ] Test: 100 requests en 10 segundos
- [ ] Verificar: rate limit activa después de límite
- [ ] Verificar: headers correctos
- [ ] Verificar: mensaje en español

**16:00-17:00 (1h)** - Memory leaks
- [ ] Ejecutar load test por 10 minutos
- [ ] Monitorear memoria con `node --inspect`
- [ ] Verificar: no hay memory leaks
- [ ] Documentar uso de memoria

---

## DÍA 20: Security Testing (8h)

### MAÑANA: Penetration Testing (4h)

#### Dev 1: Auth Security (4h)

**08:00-09:00 (1h)** - XSS Protection
- [ ] Test: inyectar script en nombre de empleado
- [ ] Verificar: sanitizado correctamente
- [ ] Test: inyectar script en nombre de producto
- [ ] Verificar: sanitizado correctamente

**09:00-10:00 (1h)** - SQL Injection
- [ ] Test: inyectar SQL en queries
- [ ] Verificar: Prisma previene injection
- [ ] Test: raw queries con parámetros
- [ ] Verificar: parametrizados correctamente

**10:00-11:00 (1h)** - CSRF Protection
- [ ] Test: request sin cookie
- [ ] Verificar: rechazado
- [ ] Test: cookie de otro dominio
- [ ] Verificar: rechazado por sameSite

**11:00-12:00 (1h)** - Session Security
- [ ] Test: robar cookie (httpOnly previene)
- [ ] Test: session fixation
- [ ] Test: session hijacking
- [ ] Verificar: protecciones funcionan

---

#### Dev 2: Authorization Testing (4h en paralelo)

**08:00-10:00 (2h)** - Role-based access
- [ ] Test: CASHIER intenta crear OWNER (debe fallar)
- [ ] Test: MANAGER intenta crear OWNER (debe fallar)
- [ ] Test: OWNER crea OWNER (debe funcionar)
- [ ] Test: Usuario sin auth accede a endpoint (debe fallar)

**10:00-12:00 (2h)** - Tenant isolation
- [ ] Test: Usuario de tenant A accede a datos de tenant B (debe fallar)
- [ ] Test: JWT con tid incorrecto (debe fallar)
- [ ] Test: JWT sin tid (debe fallar)

---

### TARDE: Vulnerability Scanning (4h)

#### Dev 1 + Dev 2: Automated Scanning (4h)

**13:00-14:00 (1h)** - npm audit
- [ ] Ejecutar `npm audit`
- [ ] Revisar vulnerabilidades
- [ ] Actualizar dependencias si necesario
- [ ] Re-ejecutar hasta 0 vulnerabilities

**14:00-15:00 (1h)** - OWASP ZAP
- [ ] Instalar OWASP ZAP
- [ ] Escanear aplicación
- [ ] Revisar reporte
- [ ] Corregir issues encontrados

**15:00-16:00 (1h)** - Snyk
- [ ] Instalar Snyk CLI
- [ ] Escanear código
- [ ] Revisar vulnerabilidades
- [ ] Corregir issues críticos

**16:00-17:00 (1h)** - Manual review
- [ ] Revisar configuración de CORS
- [ ] Revisar configuración de cookies
- [ ] Revisar rate limiting
- [ ] Revisar logging (no loggear passwords)

---

## DÍA 21: UAT y Preparación (8h)

### MAÑANA: User Acceptance Testing (4h)

#### Dev 1 + Dev 2: Manual Testing (4h)

**08:00-10:00 (2h)** - Happy paths
- [ ] Login como OWNER
- [ ] Crear empleado
- [ ] Crear producto
- [ ] Crear promoción
- [ ] Ver dashboard
- [ ] Ver reportes
- [ ] Logout

**10:00-12:00 (2h)** - Edge cases
- [ ] Intentar crear empleado con PIN duplicado
- [ ] Intentar crear producto con precio negativo
- [ ] Intentar desactivar último OWNER
- [ ] Navegar con sesión expirada
- [ ] Probar paginación con muchos datos
- [ ] Probar filtros y búsquedas

---

### TARDE: Deployment Prep (4h)

#### Dev 1: Staging Deployment (2h)

**13:00-14:00 (1h)** - Preparar staging
- [ ] Crear branch `staging`
- [ ] Merge `main` a `staging`
- [ ] Configurar variables de entorno
- [ ] Ejecutar migraciones

**14:00-15:00 (1h)** - Deploy a staging
- [ ] Deploy a Vercel staging
- [ ] Verificar que funciona
- [ ] Smoke tests

---

#### Dev 2: Documentación Final (2h)

**13:00-14:00 (1h)** - README
- [ ] Actualizar README.md
- [ ] Documentar setup
- [ ] Documentar deployment
- [ ] Documentar troubleshooting

**14:00-15:00 (1h)** - Changelog
- [ ] Crear CHANGELOG.md
- [ ] Documentar todos los cambios
- [ ] Categorizar por tipo (Security, Features, Fixes)

---

### FINAL: Sign-off (2h)

#### Dev 1 + Dev 2: Review Final (2h)

**15:00-16:00 (1h)** - Checklist final
- [ ] Todos los tests passing
- [ ] Coverage > 85%
- [ ] Performance tests OK
- [ ] Security tests OK
- [ ] UAT completado
- [ ] Documentación actualizada
- [ ] Staging funcionando

**16:00-17:00 (1h)** - Preparar presentación
- [ ] Crear slides con:
  - Problemas resueltos (20)
  - Métricas de calidad
  - Performance improvements
  - Security improvements
  - Next steps
- [ ] Preparar demo

---

## ✅ CHECKLIST TESTING COMPLETO

- [x] 100+ unit tests passing
- [x] 50+ integration tests passing
- [x] Coverage > 85%
- [x] Load testing completado
- [x] Performance tests OK (< 500ms)
- [x] Security tests passing
- [x] UAT completado
- [x] Staging deployment exitoso
- [x] Documentación completa
- [x] Sign-off del equipo

**Criterio de éxito:** Sistema listo para producción.

---

**Próximo:** [Deployment a Producción](./DEPLOYMENT.md)
