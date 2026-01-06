# PARK POS — Roadmap de Mejoras Arquitectónicas

**Versión:** 1.0  
**Fecha:** Enero 2026  
**Estado:** 📋 Plan de Implementación

> **Objetivo:** Roadmap priorizado para implementar las 10 mejoras arquitectónicas identificadas.

---

## 📊 Resumen Ejecutivo

| Prioridad | Mejoras | Esfuerzo Total | Impacto |
|-----------|---------|----------------|---------|
| 🔥 CRÍTICO | 3 | 5 días | Alto |
| ⚠️ IMPORTANTE | 4 | 8 días | Medio |
| 💡 MEJORA | 3 | 10 días | Bajo |
| **TOTAL** | **10** | **23 días** | - |

---

## 🔥 FASE 1: CRÍTICO (Antes de Producción)

**Duración:** 5 días  
**Objetivo:** Garantizar confiabilidad y performance básica

### 1.1 Outbox Pattern (2 días)

**Problema:** Eventos pueden perderse si SSE falla  
**Solución:** Tabla `event_outbox` + worker publisher

**Tareas:**
- [ ] Crear migración Prisma para `event_outbox`
- [ ] Modificar `/api/events/ingest` para usar outbox
- [ ] Implementar worker publisher (100ms interval)
- [ ] Agregar health check del worker
- [ ] Testing: simular fallo de EventBus

**Archivos:**
```
prisma/migrations/XXX_add_event_outbox.sql
src/core/workers/outbox-publisher.ts
src/app/api/events/ingest/route.ts (modificar)
```

**Criterio de Éxito:**
- ✅ 0 eventos perdidos en test de 1000 eventos
- ✅ Worker se recupera automáticamente de fallos
- ✅ Latencia adicional < 150ms

---

### 1.2 Proyecciones Server-Side (2 días)

**Problema:** `stations_active` y `fulfillment_status` no se calculan  
**Solución:** Función `recompute_order_derived()` + triggers

**Tareas:**
- [ ] Crear función SQL `recompute_order_derived(order_id)`
- [ ] Agregar trigger `AFTER UPDATE ON orders`
- [ ] Implementar cálculo de `stations_active`
- [ ] Implementar cálculo de `fulfillment_status`
- [ ] Testing: verificar derivados en 100 órdenes

**Archivos:**
```
prisma/migrations/XXX_add_order_triggers.sql
src/app/api/events/ingest/route.ts (usar función)
```

**Criterio de Éxito:**
- ✅ KDS filtra correctamente por estación
- ✅ `fulfillment_status` refleja estado real
- ✅ Performance < 10ms por orden

---

### 1.3 Service Worker (1 día)

**Problema:** App no funciona offline sin internet inicial  
**Solución:** PWA con app shell caching

**Tareas:**
- [ ] Crear `public/sw.js`
- [ ] Configurar Next.js para PWA
- [ ] Cache de assets estáticos
- [ ] Offline fallback page
- [ ] Testing: modo avión

**Archivos:**
```
public/sw.js
next.config.js (modificar)
public/manifest.json
```

**Criterio de Éxito:**
- ✅ App abre sin internet
- ✅ Assets cargan desde cache
- ✅ Lighthouse PWA score > 90

---

## ⚠️ FASE 2: IMPORTANTE (Antes de Escalar)

**Duración:** 8 días  
**Objetivo:** Robustez y observabilidad

### 2.1 Circuit Breaker (1 día)

**Problema:** Sync reintenta infinitamente si servidor caído  
**Solución:** Circuit breaker con estados CLOSED/OPEN/HALF_OPEN

**Tareas:**
- [ ] Implementar clase `CircuitBreaker`
- [ ] Integrar en `SyncClient`
- [ ] UI indicator de circuit state
- [ ] Testing: simular servidor caído

**Archivos:**
```
src/core/sync/circuit-breaker.ts
src/core/sync/client.ts (modificar)
```

---

### 2.2 Rate Limiting (1 día)

**Problema:** API sin protección contra abuso  
**Solución:** Rate limiter por terminal (100 req/min)

**Tareas:**
- [ ] Setup Upstash Redis
- [ ] Implementar middleware rate limiter
- [ ] Agregar header `X-RateLimit-Remaining`
- [ ] Testing: 429 después de límite

**Archivos:**
```
src/middleware.ts
src/app/api/events/ingest/route.ts (modificar)
```

---

### 2.3 Observabilidad (3 días)

**Problema:** Sin métricas de producción  
**Solución:** OpenTelemetry + Prometheus + Grafana

**Tareas:**
- [ ] Setup OpenTelemetry SDK
- [ ] Instrumentar SyncClient
- [ ] Instrumentar API endpoints
- [ ] Crear dashboards Grafana (3)
- [ ] Configurar alertas (5)

**Archivos:**
```
src/core/observability/telemetry.ts
src/core/observability/logger.ts
grafana/dashboards/*.json
```

---

### 2.4 Snapshots (3 días)

**Problema:** Rebuild lento con muchos eventos  
**Solución:** Snapshots cada 1000 eventos

**Tareas:**
- [ ] Agregar tabla `snapshots` a Dexie
- [ ] Implementar `createSnapshot()`
- [ ] Modificar `rebuildSale()` para usar snapshots
- [ ] Background job para crear snapshots
- [ ] Testing: rebuild con 10k eventos

**Archivos:**
```
src/core/db/schema.ts (modificar)
src/core/projections/snapshot.ts
src/core/projections/rebuild.ts (modificar)
```

---

## 💡 FASE 3: MEJORAS (Post-MVP)

**Duración:** 10 días  
**Objetivo:** Escalabilidad y mantenibilidad

### 3.1 Event Versioning (3 días)

**Problema:** Cambios de schema rompen eventos viejos  
**Solución:** Schema evolution con migradores

**Tareas:**
- [ ] Crear `events.v2.ts` con versiones
- [ ] Implementar `migrateEvent()`
- [ ] Modificar reducers para usar migrador
- [ ] Testing: eventos v1 funcionan con código v2

---

### 3.2 Saga Pattern (5 días)

**Problema:** Flujos complejos sin rollback  
**Solución:** Saga orchestrator

**Tareas:**
- [ ] Implementar clase `Saga`
- [ ] Crear `CompleteSaleSaga`
- [ ] Crear `ApplyPromotionSaga`
- [ ] Testing: rollback en fallo

---

### 3.3 Property-Based Testing (2 días)

**Problema:** Testing solo casos conocidos  
**Solución:** Fast-check para invariantes

**Tareas:**
- [ ] Setup fast-check
- [ ] Tests de invariantes (5)
- [ ] Generators de eventos
- [ ] CI integration

---

## 📅 Calendario Sugerido

### Semana 1 (Ene 6-10)
- Lun-Mar: Outbox Pattern
- Mié-Jue: Proyecciones Server-Side
- Vie: Service Worker

### Semana 2 (Ene 13-17)
- Lun: Circuit Breaker
- Mar: Rate Limiting
- Mié-Vie: Observabilidad

### Semana 3 (Ene 20-24)
- Lun-Mié: Snapshots
- Jue-Vie: Testing y ajustes

### Semana 4+ (Ene 27+)
- Event Versioning
- Saga Pattern
- Property-Based Testing

---

## 🎯 Hitos

| Fecha | Hito | Entregable |
|-------|------|------------|
| Ene 10 | Fase 1 Completa | MVP Production-Ready |
| Ene 17 | Fase 2 Completa | Sistema Robusto |
| Ene 24 | Testing Completo | QA Pass |
| Ene 31 | Piloto Real | 1 Pollería Live |
| Feb 14 | Fase 3 Completa | Sistema Enterprise |

---

## 📊 Métricas de Éxito

### Post-Fase 1
- ✅ 0 eventos perdidos en 1 semana
- ✅ KDS filtra correctamente
- ✅ App funciona offline

### Post-Fase 2
- ✅ Uptime > 99.5%
- ✅ P95 latency < 200ms
- ✅ Dashboards operacionales

### Post-Fase 3
- ✅ 0 bugs de schema evolution
- ✅ Rollback automático funciona
- ✅ 100% cobertura de invariantes

---

## 🚀 Próximos Pasos

1. **Revisar y aprobar roadmap** con equipo
2. **Crear issues en GitHub** para cada tarea
3. **Asignar responsables** por fase
4. **Comenzar Fase 1** el Lunes 6 de Enero

---

**Generado por:** Kiro AI Assistant  
**Fecha:** 2026-01-05

