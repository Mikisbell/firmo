# Spec Creado: Realtime EventBus con Supabase ✅

**Fecha:** 11 Febrero 2026  
**Status:** ✅ SPEC COMPLETO - Listo para implementación

---

## Resumen Ejecutivo

Se ha creado un spec completo para resolver el problema arquitectónico crítico del EventBus in-memory que causa que el test E2E "multiple waiters can submit orders simultaneously" falle.

### Problema Identificado

El EventBus actual usa `EventEmitter` de Node.js, que solo funciona dentro del mismo proceso. En Next.js development mode (y potencialmente en producción con múltiples instancias), cada request HTTP puede ser manejado por una instancia diferente del servidor:

```
Mesero → POST /api/events/ingest → Next.js Instancia A
                                    ↓
                            eventBus.publish() ✅
                                    ↓
                            EventBus In-Memory A ❌ NADIE ESCUCHA

KDS → GET /api/events/stream → Next.js Instancia B ❌ DIFERENTE
                                ↓
                        EventBus In-Memory B ❌ NUNCA RECIBE NADA
```

### Solución Propuesta

Migrar a Supabase Realtime usando PostgreSQL LISTEN/NOTIFY como intermediario compartido:

```
Mesero → POST /api/events/ingest → Next.js Instancia A
                                    ↓
                            supabaseEventBus.publish()
                                    ↓
                            PostgreSQL NOTIFY 'events:tenant_id'
                                    ↓
                            Supabase PostgreSQL (COMPARTIDO)
                                    ↓
                            PostgreSQL LISTEN 'events:tenant_id'
                                    ↓
                            Next.js Instancia B ✅
                                    ↓
                            SSE Stream → KDS ✅ RECIBE EVENTO
```

---

## Archivos Creados

### 1. Requirements Document
**Ubicación:** `.kiro/specs/realtime-eventbus-supabase/requirements.md`

**Contenido:**
- 12 requirements con 60 acceptance criteria en formato EARS
- Cobertura completa de funcionalidad:
  - Migración de EventBus a Supabase Realtime
  - Compatibilidad con interfaz existente
  - Aislamiento por tenant
  - Integración con SSE streaming
  - Integración con Outbox Pattern
  - Soporte offline-first
  - Manejo de errores y reconexión
  - Performance y latencia
  - Fallback a EventBus in-memory
  - Testing y validación
  - Migración y despliegue
  - Monitoreo y observabilidad

### 2. Design Document
**Ubicación:** `.kiro/specs/realtime-eventbus-supabase/design.md`

**Contenido:**
- Arquitectura detallada con diagramas
- Componentes principales:
  - `SupabaseEventBus` - Implementación con PostgreSQL LISTEN/NOTIFY
  - `EventBus Factory` - Detección automática y fallback
  - `EventBus Interface` - Interfaz común para ambas implementaciones
- 22 correctness properties con validación de requirements
- Error handling completo
- Testing strategy: unit tests, property tests, integration tests, E2E tests, stress tests

### 3. Tasks Document
**Ubicación:** `.kiro/specs/realtime-eventbus-supabase/tasks.md`

**Contenido:**
- 15 tareas principales con 45+ sub-tareas
- Implementación incremental con checkpoints
- Tests opcionales marcados con `*` para MVP rápido
- Referencias a requirements específicos para trazabilidad

---

## Beneficios de la Solución

### Técnicos
- ✅ Funciona en TODOS los entornos (dev, staging, prod)
- ✅ Escala horizontalmente (múltiples servidores)
- ✅ Usa infraestructura existente (Supabase PostgreSQL)
- ✅ Mantiene compatibilidad con interfaz existente
- ✅ Fallback automático a in-memory si no hay DATABASE_URL
- ✅ Tenant isolation nativo con canales de PostgreSQL

### Operacionales
- ✅ Costo $0 (incluido en Supabase)
- ✅ No requiere servicios adicionales (Redis, etc.)
- ✅ Reconexión automática con exponential backoff
- ✅ Logging y observabilidad integrados
- ✅ Migración segura y reversible

### Testing
- ✅ Test E2E "multiple waiters" pasará
- ✅ 22 correctness properties para validación
- ✅ Unit tests, property tests, integration tests, E2E tests, stress tests
- ✅ Cobertura completa de escenarios

---

## Próximos Pasos

### Para Comenzar la Implementación

1. **Abrir el plan de tareas:**
   ```
   .kiro/specs/realtime-eventbus-supabase/tasks.md
   ```

2. **Comenzar con la Tarea 1:**
   - Implementar SupabaseEventBus con PostgreSQL LISTEN/NOTIFY
   - Crear clase base con conexión a PostgreSQL
   - Implementar métodos publish() y subscribe()

3. **Seguir el plan incremental:**
   - Cada tarea tiene sub-tareas específicas
   - Checkpoints para validación incremental
   - Tests opcionales marcados con `*` para MVP rápido

### Comandos Útiles

```bash
# Verificar que DATABASE_URL está configurado
echo $DATABASE_URL

# Ejecutar tests unitarios
npm test src/core/infra/__tests__/event-bus.test.ts

# Ejecutar tests E2E
npm run test:e2e e2e/waiter-to-kds.spec.ts

# Verificar conexión a PostgreSQL
node scripts/verify-postgres-connection.ts
```

---

## Estimación de Tiempo

### MVP (Sin tests opcionales)
- **Tiempo estimado:** 4-6 horas
- **Tareas:** 1-9 (sin sub-tareas opcionales marcadas con `*`)
- **Resultado:** Sistema funcional con tests básicos

### Completo (Con todos los tests)
- **Tiempo estimado:** 8-12 horas
- **Tareas:** 1-15 (todas las sub-tareas)
- **Resultado:** Sistema production-ready con cobertura completa

---

## Impacto

### Antes (EventBus In-Memory)
- ❌ Test E2E "multiple waiters" falla
- ❌ Eventos NO se propagan entre instancias
- ❌ Sistema NO funciona con múltiples terminales en tiempo real
- ❌ Bloqueador para producción

### Después (Supabase Realtime)
- ✅ Test E2E "multiple waiters" pasa
- ✅ Eventos se propagan entre TODAS las instancias
- ✅ Sistema funciona correctamente con múltiples terminales
- ✅ Listo para producción

---

## Referencias

- **Root Cause Analysis:** `.kiro/specs/playwright-e2e-optimization/ROOT_CAUSE_ANALYSIS_EVENTBUS.md`
- **Requirements:** `.kiro/specs/realtime-eventbus-supabase/requirements.md`
- **Design:** `.kiro/specs/realtime-eventbus-supabase/design.md`
- **Tasks:** `.kiro/specs/realtime-eventbus-supabase/tasks.md`

---

**Última actualización:** 11 Febrero 2026  
**Autor:** Kiro AI  
**Status:** ✅ SPEC COMPLETO - Listo para implementación
