# Backend Strategy: Lazy + Event-Driven vs Cron

> **Fecha:** 3 Febrero 2026  
> **Principio:** Lazy evaluation + Event-driven expiration  
> **Contexto:** Park POS - Restaurante con promociones de "Hora Feliz"

---

## 🚨 El Problema del Cron Job

### Escenario Real: Hora Feliz

```
Promoción: "Happy Hour 18:00-19:00"
Descuento: 50% en bebidas

Timeline:
18:00 - Promoción activa
18:59 - Cliente ordena bebida (50% descuento)
19:00 - Promoción EXPIRA
19:04 - Cron job ejecuta (deactivate_expired_promotions)
19:05 - Cliente reclama: "¿Por qué me cobran precio completo?"
```

### Problemas del Cron

1. **Latencia de 5 minutos**
   - Promoción expira a las 19:00
   - Cron ejecuta a las 19:05
   - 5 minutos de inconsistencia

2. **Pérdida de Margen**
   - Cliente ordena a las 19:01 (promoción expirada pero aún activa en DB)
   - Sistema aplica descuento (incorrecto)
   - Restaurante pierde margen

3. **Conflictos con Clientes**
   - "La promoción dice que termina a las 19:00"
   - "Pero el sistema me cobró descuento a las 19:02"
   - Disputa de pago

4. **Escalabilidad**
   - Si hay 10,000 promociones, cron tarda 30+ segundos
   - Bloquea otras operaciones
   - Impacta performance

---

## ✅ Solución: Lazy + Event-Driven

### Arquitectura

```
┌─────────────────────────────────────────────────────┐
│ Lazy Evaluation (GET /api/admin/promotions)         │
├─────────────────────────────────────────────────────┤
│ 1. Consulta promoción específica                     │
│ 2. Valida: ¿ends_at < now?                          │
│ 3. Si expirada: marca como inactiva (in-memory)     │
│ 4. Retorna estado correcto                          │
│ 5. NO actualiza DB (aún)                            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Event-Driven (Redis TTL)                            │
├─────────────────────────────────────────────────────┤
│ 1. Promoción creada: SET promo:123 TTL=3600         │
│ 2. Redis cuenta hacia atrás                         │
│ 3. TTL expira: Redis emite evento                   │
│ 4. Event handler: UPDATE promotions SET is_active=0 │
│ 5. Cache invalidado automáticamente                 │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Implementación

### Paso 1: Lazy Evaluation en GET

```typescript
// src/app/api/admin/promotions/route.ts

async function handleGET(request: NextRequest) {
  const queryParams = Object.fromEntries(request.nextUrl.searchParams);
  const validatedQuery = PromotionQuerySchema.parse(queryParams);
  
  const now = new Date();
  
  // ✅ LAZY: Solo marca como expirada si se consulta
  const where: any = { tenant_id: TENANT_ID };
  if (validatedQuery.is_active !== undefined) {
    where.is_active = validatedQuery.is_active;
  }

  // Obtener promociones
  let promotions = await prisma.promotions.findMany({
    where,
    orderBy: { starts_at: 'desc' },
    skip: params.skip,
    take: params.limit,
  });

  // ✅ LAZY: Evaluar expiración en memoria (sin DB update)
  promotions = promotions.map(promo => {
    const isExpired = new Date(promo.ends_at) < now;
    return {
      ...promo,
      is_active: isExpired ? false : promo.is_active,
      _expired_at_query: isExpired ? now : null, // Metadata
    };
  });

  return NextResponse.json(createPaginatedResponse(promotions, total, params));
}
```

**Ventajas:**
- ✅ Cero latencia (evaluación en memoria)
- ✅ Cero impacto en DB
- ✅ Respuesta correcta inmediata

---

### Paso 2: Event-Driven con Redis TTL

```typescript
// src/core/jobs/promotion-expiration-handler.ts

import { redis } from '@/src/core/cache/redis.service';
import prisma from '@/src/core/db/prisma';

/**
 * Cuando se crea una promoción, registrar TTL en Redis
 * Redis emitirá evento cuando TTL expire
 */
export async function registerPromotionTTL(
  promotionId: string,
  endsAt: Date,
  tenantId: string
) {
  const now = new Date();
  const ttlSeconds = Math.floor((endsAt.getTime() - now.getTime()) / 1000);
  
  if (ttlSeconds > 0) {
    // Guardar en Redis con TTL
    // Cuando expire, Redis emite evento keyspace notification
    await redis.setex(
      `promo:${tenantId}:${promotionId}:ttl`,
      ttlSeconds,
      JSON.stringify({ promotionId, tenantId })
    );
    
    console.log(`Registered TTL for promotion ${promotionId}: ${ttlSeconds}s`);
  }
}

/**
 * Handler para evento de expiración de Redis
 * Se ejecuta cuando TTL expira
 */
export async function handlePromotionExpiration(
  promotionId: string,
  tenantId: string
) {
  console.log(`Promotion ${promotionId} expired (TTL event)`);
  
  // Actualizar DB
  await prisma.promotions.update({
    where: { id: promotionId },
    data: { is_active: false },
  });
  
  // Invalidar cache
  await redis.del(`promotions:${tenantId}:*`);
  
  // Log audit
  console.log(`Promotion ${promotionId} marked as inactive (TTL expiration)`);
}
```

**Ventajas:**
- ✅ Exactitud: Expira exactamente cuando ends_at
- ✅ Automático: No requiere cron
- ✅ Escalable: Redis maneja millones de TTLs
- ✅ Eficiente: Solo actualiza cuando expira

---

### Paso 3: Configurar Redis Keyspace Notifications

```typescript
// src/core/cache/redis-setup.ts

import { redis } from '@/src/core/cache/redis.service';

/**
 * Configurar Redis para emitir eventos de expiración
 * Debe ejecutarse una sola vez en startup
 */
export async function setupRedisKeyspaceNotifications() {
  try {
    // Habilitar keyspace notifications
    await redis.config('SET', 'notify-keyspace-events', 'Ex');
    
    // Escuchar eventos de expiración
    const subscriber = redis.duplicate();
    await subscriber.subscribe('__keyevent@0__:expired', (message) => {
      console.log(`Key expired: ${message}`);
      
      // Parsear: promo:tenant-id:promotion-id:ttl
      const match = message.match(/promo:([^:]+):([^:]+):ttl/);
      if (match) {
        const [, tenantId, promotionId] = match;
        handlePromotionExpiration(promotionId, tenantId);
      }
    });
    
    console.log('Redis keyspace notifications configured');
  } catch (error) {
    console.error('Failed to setup Redis keyspace notifications:', error);
  }
}
```

---

## 📊 Comparación: Cron vs Lazy+Event

| Aspecto | Cron Job | Lazy + Event |
|---------|----------|--------------|
| **Latencia** | 5 minutos | 0 segundos |
| **Exactitud** | ±5 minutos | Exacta |
| **Escalabilidad** | O(n) - Barre todo | O(1) - Solo lo que expira |
| **Impacto DB** | Alto (UPDATE masivo) | Bajo (UPDATE puntual) |
| **Impacto CPU** | Alto (cada 5 min) | Bajo (solo expiración) |
| **Conflictos Cliente** | Sí (5 min de inconsistencia) | No |
| **Pérdida de Margen** | Sí | No |

---

## 🎯 Implementación Completa

### Fase 1: Lazy Evaluation (INMEDIATO)

```typescript
// Modificar handleGET en src/app/api/admin/promotions/route.ts
// Agregar evaluación en memoria de expiración
// Tiempo: 30 minutos
```

### Fase 2: Redis TTL Setup (CORTO PLAZO)

```typescript
// 1. Configurar Redis keyspace notifications
// 2. Crear handler de expiración
// 3. Registrar TTL al crear promoción
// Tiempo: 2 horas
```

### Fase 3: Validación (MEDIANO PLAZO)

```typescript
// 1. Test: Crear promoción que expira en 10 segundos
// 2. Esperar 11 segundos
// 3. Validar que está marcada como inactiva
// 4. Validar que no hay latencia
// Tiempo: 1 hora
```

---

## 🔍 Casos de Uso

### Caso 1: Hora Feliz (18:00-19:00)

```
18:00:00 - Promoción activa
18:59:59 - Cliente ordena (50% descuento) ✅
19:00:00 - Redis TTL expira → evento
19:00:01 - Promoción marcada como inactiva
19:00:02 - Cliente ordena (precio completo) ✅
```

**Resultado:** Cero inconsistencia, cero conflictos

---

### Caso 2: Descuento de Fin de Semana (Viernes 20:00 - Domingo 23:59)

```
Viernes 20:00:00 - Promoción activa
Domingo 23:59:00 - Redis TTL expira → evento
Domingo 23:59:01 - Promoción marcada como inactiva
Lunes 00:00:00 - Cliente ordena (precio completo) ✅
```

**Resultado:** Exactitud de 1 segundo

---

## 🚨 Consideraciones

### 1. Redis Persistence

```typescript
// Asegurar que Redis persiste TTLs
// En caso de restart, TTLs se pierden

// Solución: Usar Redis Persistence (RDB o AOF)
// O: Reconstruir TTLs en startup
```

### 2. Distributed Systems

```typescript
// Si hay múltiples instancias de Node.js
// Cada una escucha eventos de Redis
// Posible duplicación de handlers

// Solución: Usar Redis Streams con consumer groups
// O: Usar Redis Pub/Sub con deduplicación
```

### 3. Fallback

```typescript
// Si Redis falla, TTLs no se registran
// Fallback: Lazy evaluation sigue funcionando

// Resultado: Promociones se marcan como expiradas
// cuando se consultan (no automáticamente)
```

---

## 📋 Checklist de Implementación

- [ ] Modificar handleGET para lazy evaluation
- [ ] Configurar Redis keyspace notifications
- [ ] Crear handler de expiración
- [ ] Registrar TTL al crear promoción
- [ ] Registrar TTL al actualizar promoción
- [ ] Test: Crear promoción que expira en 10s
- [ ] Test: Validar que se marca como inactiva
- [ ] Test: Validar que no hay latencia
- [ ] Documentar en README

---

## 🎓 Conclusión

**Cron Job:**
- ❌ 5 minutos de latencia
- ❌ Pérdida de margen
- ❌ Conflictos con clientes

**Lazy + Event-Driven:**
- ✅ 0 segundos de latencia
- ✅ Exactitud garantizada
- ✅ Escalable
- ✅ Eficiente

**Recomendación:** Implementar Lazy + Event-Driven para Park POS

---

**Status:** ✅ STRATEGY DEFINED  
**Implementation:** PHASE 3 (Backend Optimization)  
**Priority:** 🟡 ALTO (Impacta experiencia del cliente)
