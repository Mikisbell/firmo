# FASE 3: CALIDAD DE CÓDIGO (30 horas)

**Duración:** Días 13-17 (Semana 3)  
**Objetivo:** Código mantenible y observable  
**Bloqueante:** NO

---

## DÍA 13: Refactor Código Duplicado (4h)

### TODO EL DÍA: Crear Helper Reutilizable

#### Dev 1: withAdminEndpoint Helper (4h)

**08:00-09:00 (1h)** - Diseñar API del helper
- [ ] Crear `src/lib/api-helpers.ts`
- [ ] Definir interfaz:
  ```typescript
  interface EndpointConfig<T> {
    requireAuth?: boolean;
    rateLimit?: { maxRequests: number; windowMs: number };
    schema?: z.ZodSchema<T>;
    handler: (params: {
      request: NextRequest;
      body?: T;
      user?: AuthUser;
      tenantId: string;
    }) => Promise<NextResponse>;
  }
  
  function withAdminEndpoint<T>(config: EndpointConfig<T>) {
    return async (request: NextRequest) => {
      // Lógica común aquí
    };
  }
  ```

**09:00-11:00 (2h)** - Implementar helper
- [ ] Rate limiting automático
- [ ] Auth automático si `requireAuth: true`
- [ ] Validación con Zod si `schema` provisto
- [ ] Manejo de errores estandarizado
- [ ] Logging automático
- [ ] Retornar tenantId del JWT

**11:00-12:00 (1h)** - Tests unitarios
- [ ] Test: aplica rate limiting
- [ ] Test: valida auth
- [ ] Test: valida schema
- [ ] Test: maneja errores
- [ ] Test: retorna tenantId correcto

---

#### Dev 2: Migrar Endpoints (4h en paralelo)

**08:00-10:00 (2h)** - Migrar Employees
- [ ] POST /api/admin/employees
  ```typescript
  export const POST = withAdminEndpoint({
    requireAuth: true,
    rateLimit: { maxRequests: 10, windowMs: 60000 },
    schema: employeeSchema,
    handler: async ({ body, user, tenantId }) => {
      // Solo lógica de negocio
      const employee = await prisma.employees.create({
        data: { ...body, tenant_id: tenantId },
      });
      return NextResponse.json(employee, { status: 201 });
    },
  });
  ```
- [ ] PUT /api/admin/employees/[id]
- [ ] DELETE /api/admin/employees/[id]

**10:00-12:00 (2h)** - Migrar Products
- [ ] POST /api/admin/products
- [ ] PUT /api/admin/products/[id]
- [ ] DELETE /api/admin/products/[id]

---

### TARDE: Continuar Migración (4h)

#### Dev 1 + Dev 2: Pair Programming (4h)

**13:00-14:00 (1h)** - Promotions
- [ ] POST /api/admin/promotions
- [ ] PUT /api/admin/promotions/[id]
- [ ] DELETE /api/admin/promotions/[id]

**14:00-15:00 (1h)** - Tables
- [ ] POST /api/admin/tables
- [ ] PUT /api/admin/tables/[id]
- [ ] DELETE /api/admin/tables/[id]

**15:00-16:00 (1h)** - Config + Zones
- [ ] POST /api/admin/config
- [ ] POST /api/admin/zones

**16:00-17:00 (1h)** - Verificación
- [ ] Compilar proyecto
- [ ] Ejecutar tests
- [ ] Verificar que todo funciona
- [ ] Medir reducción de líneas de código

---

## DÍA 14-15: Logging Estructurado (6h)

### DÍA 14 MAÑANA: Setup Logger (3h)

#### Dev 1: Implementar Logger (3h)

**08:00-09:00 (1h)** - Instalar dependencias
- [ ] Instalar Pino
  ```bash
  npm install pino pino-pretty
  ```
- [ ] Configurar en `package.json`

**09:00-10:30 (1.5h)** - Crear logger service
- [ ] Crear `src/core/observability/logger.ts`
  ```typescript
  import pino from 'pino';
  
  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  });
  
  export function logInfo(message: string, context?: object) {
    logger.info(context, message);
  }
  
  export function logError(message: string, error: Error, context?: object) {
    logger.error({ ...context, error: error.message, stack: error.stack }, message);
  }
  
  export function logWarn(message: string, context?: object) {
    logger.warn(context, message);
  }
  ```

**10:30-11:00 (30min)** - Tests
- [ ] Test: logInfo funciona
- [ ] Test: logError incluye stack trace
- [ ] Test: context se serializa correctamente

---

#### Dev 2: Preparar Contexto (3h en paralelo)

**08:00-09:30 (1.5h)** - Request ID middleware
- [ ] Crear `src/core/middleware/request-id.ts`
- [ ] Generar UUID por request
- [ ] Agregar a headers de respuesta
- [ ] Almacenar en AsyncLocalStorage

**09:30-11:00 (1.5h)** - Context helper
- [ ] Crear `src/lib/request-context.ts`
- [ ] Función para obtener request ID
- [ ] Función para obtener user ID
- [ ] Función para obtener tenant ID

---

### DÍA 14 TARDE: Aplicar Logging (3h)

#### Dev 1 + Dev 2: Reemplazar console.error (3h)

**13:00-14:30 (1.5h)** - Endpoints críticos
- [ ] Employees endpoints
  ```typescript
  // ❌ Antes
  console.error('Employee POST error:', error);
  
  // ✅ Después
  logError('employee_creation_failed', error, {
    employeeId: body.id,
    tenantId: tenantId,
    userId: user.id,
    requestId: getRequestId(),
  });
  ```
- [ ] Products endpoints
- [ ] Promotions endpoints

**14:30-16:00 (1.5h)** - Resto de endpoints
- [ ] Auth endpoints
- [ ] Delivery endpoints
- [ ] Analytics endpoints

---

### DÍA 15: Logging Avanzado (3h)

#### Dev 1: Performance Logging (1.5h)

**08:00-09:30 (1.5h)** - Request timing
- [ ] Middleware para medir duración
- [ ] Log automático de requests lentos (> 1s)
- [ ] Incluir endpoint, método, duración

---

#### Dev 2: Structured Events (1.5h)

**08:00-09:30 (1.5h)** - Event logging
- [ ] Log de eventos de negocio
  ```typescript
  logInfo('employee_created', {
    employeeId: employee.id,
    role: employee.role,
    createdBy: user.id,
    tenantId: tenantId,
  });
  
  logInfo('product_price_changed', {
    productId: product.id,
    oldPrice: oldProduct.price_cents,
    newPrice: product.price_cents,
    changedBy: user.id,
  });
  ```

---

### TARDE: Testing Logging (1.5h)

#### Dev 1 + Dev 2: Verificación (1.5h)

**10:00-11:30 (1.5h)** - Manual testing
- [ ] Generar errores intencionalmente
- [ ] Verificar logs estructurados
- [ ] Verificar request ID presente
- [ ] Verificar context completo
- [ ] Verificar formato legible

---

## DÍA 16-17: Métricas y Monitoring (8h)

### DÍA 16: Setup Métricas (4h)

#### Dev 1: Prometheus Metrics (4h)

**08:00-09:00 (1h)** - Instalar dependencias
- [ ] Instalar prom-client
  ```bash
  npm install prom-client
  ```

**09:00-11:00 (2h)** - Crear metrics service
- [ ] Crear `src/core/observability/metrics.ts`
  ```typescript
  import { Counter, Histogram, Registry } from 'prom-client';
  
  const register = new Registry();
  
  // Request counter
  export const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'endpoint', 'status'],
    registers: [register],
  });
  
  // Request duration
  export const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'endpoint'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register],
  });
  
  // Business metrics
  export const employeesCreated = new Counter({
    name: 'employees_created_total',
    help: 'Total employees created',
    labelNames: ['tenant_id'],
    registers: [register],
  });
  
  export function getMetrics() {
    return register.metrics();
  }
  ```

**11:00-12:00 (1h)** - Endpoint de métricas
- [ ] Crear `/api/metrics/route.ts`
  ```typescript
  export async function GET() {
    const metrics = await getMetrics();
    return new Response(metrics, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  ```

---

#### Dev 2: Middleware de Métricas (4h en paralelo)

**08:00-10:00 (2h)** - Request metrics middleware
- [ ] Crear `src/core/middleware/metrics.ts`
- [ ] Interceptar todos los requests
- [ ] Incrementar counter
- [ ] Medir duración
- [ ] Registrar en Prometheus

**10:00-12:00 (2h)** - Aplicar a endpoints
- [ ] Envolver endpoints con middleware
- [ ] Verificar que métricas se registran
- [ ] Test manual

---

### DÍA 16 TARDE: Business Metrics (4h)

#### Dev 1 + Dev 2: Métricas de Negocio (4h)

**13:00-14:00 (1h)** - Employees metrics
- [ ] Incrementar counter al crear
- [ ] Incrementar counter al desactivar
- [ ] Gauge de empleados activos

**14:00-15:00 (1h)** - Products metrics
- [ ] Counter de productos creados
- [ ] Counter de cambios de precio
- [ ] Gauge de productos activos

**15:00-16:00 (1h)** - Orders metrics
- [ ] Counter de órdenes creadas
- [ ] Histogram de montos
- [ ] Gauge de órdenes pendientes

**16:00-17:00 (1h)** - Error metrics
- [ ] Counter de errores por endpoint
- [ ] Counter de rate limit hits
- [ ] Counter de auth failures

---

### DÍA 17: Dashboard + Alertas (4h)

#### Dev 1: Grafana Dashboard (2h)

**08:00-10:00 (2h)** - Crear dashboard
- [ ] Instalar Grafana (local/Docker)
- [ ] Configurar datasource (Prometheus)
- [ ] Crear dashboard con:
  - Request rate por endpoint
  - Request duration (p50, p95, p99)
  - Error rate
  - Empleados creados (últimas 24h)
  - Productos creados (últimas 24h)
- [ ] Exportar JSON del dashboard

---

#### Dev 2: Alertas Básicas (2h)

**08:00-10:00 (2h)** - Configurar alertas
- [ ] Alerta: Error rate > 5%
- [ ] Alerta: Request duration p95 > 2s
- [ ] Alerta: Rate limit hits > 100/min
- [ ] Configurar notificaciones (email/Slack)

---

### TARDE: Documentación (4h)

#### Dev 1 + Dev 2: Docs (4h)

**10:00-12:00 (2h)** - Documentar logging
- [ ] Crear `docs/LOGGING.md`
- [ ] Explicar estructura de logs
- [ ] Ejemplos de queries
- [ ] Best practices

**13:00-15:00 (2h)** - Documentar métricas
- [ ] Crear `docs/METRICS.md`
- [ ] Listar todas las métricas
- [ ] Explicar cómo acceder
- [ ] Cómo crear dashboard
- [ ] Cómo configurar alertas

---

## ✅ CHECKLIST FASE 3

Al final del Día 17, debes tener:

- [x] Código duplicado refactorizado (helper reutilizable)
- [x] Logging estructurado en todos los endpoints
- [x] Request ID en todos los logs
- [x] Métricas de Prometheus implementadas
- [x] Dashboard de Grafana funcional
- [x] Alertas básicas configuradas
- [x] Documentación completa
- [x] 100+ tests passing
- [x] Código mantenible y observable

**Criterio de éxito:** Todos los problemas P2 resueltos.

---

**Próximo:** [Testing y QA](./TESTING_QA.md)
