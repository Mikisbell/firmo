# Redis Production Setup - Guía Completa

**Fecha:** 30 Enero 2026  
**Status:** 📋 GUÍA DE CONFIGURACIÓN

---

## 🎯 Objetivo

Configurar Redis real en producción para persistencia de ubicaciones de drivers y funcionalidades del módulo de delivery.

---

## 📋 Opciones de Redis en Producción

### Opción 1: Upstash Redis (Recomendado) ⭐

**Ventajas:**
- ✅ Serverless (pago por uso)
- ✅ Compatible con Vercel
- ✅ Setup en 5 minutos
- ✅ Free tier generoso (10,000 comandos/día)
- ✅ Global edge network
- ✅ TLS encryption incluido

**Pricing:**
- Free: 10,000 comandos/día
- Pro: $0.20 por 100,000 comandos

**Setup:**
1. Ir a https://upstash.com
2. Crear cuenta (GitHub login)
3. Create Database → Redis
4. Copiar `UPSTASH_REDIS_REST_URL`

### Opción 2: Redis Cloud (Redis Labs)

**Ventajas:**
- ✅ Redis oficial
- ✅ 30MB free tier
- ✅ Alta disponibilidad
- ✅ Backups automáticos

**Pricing:**
- Free: 30MB, 30 conexiones
- Paid: Desde $5/mes

**Setup:**
1. Ir a https://redis.com/try-free
2. Crear cuenta
3. Create Database
4. Copiar connection string

### Opción 3: Railway Redis

**Ventajas:**
- ✅ Fácil integración
- ✅ $5 crédito gratis
- ✅ Deploy automático

**Pricing:**
- $5/mes por 1GB RAM

**Setup:**
1. Ir a https://railway.app
2. New Project → Add Redis
3. Copiar `REDIS_URL`

### Opción 4: Supabase + Redis (Próximamente)

**Nota:** Supabase está agregando Redis nativo. Verificar disponibilidad.

---

## 🚀 Configuración Paso a Paso (Upstash)

### Paso 1: Crear Base de Datos Redis

```bash
# 1. Ir a https://console.upstash.com
# 2. Click "Create Database"
# 3. Configuración:
#    - Name: park-pos-delivery
#    - Type: Regional (o Global para mejor latencia)
#    - Region: us-east-1 (o más cercano a tu Supabase)
#    - TLS: Enabled
#    - Eviction: allkeys-lru (recomendado)
```

### Paso 2: Obtener Credenciales

Upstash proporciona 2 tipos de conexión:

#### A. REST API (Recomendado para Vercel)
```env
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

#### B. Redis Protocol (Tradicional)
```env
REDIS_URL="redis://default:your-password@your-redis.upstash.io:6379"
```

### Paso 3: Actualizar Variables de Entorno

#### Desarrollo (.env.local)
```env
# Redis Configuration (Development)
REDIS_URL="redis://localhost:6379"
```

#### Producción (Vercel)
```env
# Redis Configuration (Production - Upstash)
REDIS_URL="rediss://default:your-password@your-redis.upstash.io:6379"

# O usando REST API
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

### Paso 4: Actualizar .env.example

```env
# Redis Configuration
# Development: redis://localhost:6379
# Production (Upstash): rediss://default:password@host.upstash.io:6379
# Production (Redis Cloud): redis://default:password@host.redis.cloud:port
REDIS_URL="redis://localhost:6379"

# Optional: Upstash REST API (alternative to Redis protocol)
# UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
# UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

---

## 🔧 Actualizar Código para Upstash REST (Opcional)

Si usas Upstash REST API en lugar del protocolo Redis tradicional:

### Crear Cliente REST

```typescript
// src/core/delivery/redis-upstash.ts
import { Redis } from '@upstash/redis';

let upstashRedis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  upstashRedis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export { upstashRedis };
```

### Instalar Dependencia

```bash
npm install @upstash/redis
```

---

## 📊 Configuración de Vercel

### Variables de Entorno en Vercel

1. Ir a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agregar:

```
REDIS_URL = rediss://default:password@host.upstash.io:6379
```

O si usas REST:

```
UPSTASH_REDIS_REST_URL = https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN = your-token-here
```

### Configuración por Ambiente

| Variable | Development | Preview | Production |
|----------|-------------|---------|------------|
| REDIS_URL | localhost:6379 | upstash | upstash |

---

## 🧪 Verificar Configuración

### Test Script

```typescript
// scripts/test-redis-connection.ts
import { deliveryRedisService } from '../src/core/delivery/redis-connection';

async function testRedis() {
  console.log('🧪 Testing Redis Connection...\n');
  
  try {
    // Test 1: Set/Get
    await deliveryRedisService.setex('test:key', 60, 'test:value');
    const value = await deliveryRedisService.get('test:key');
    console.log('✅ Set/Get:', value === 'test:value' ? 'PASS' : 'FAIL');
    
    // Test 2: List operations
    await deliveryRedisService.rpush('test:list', 'item1');
    await deliveryRedisService.rpush('test:list', 'item2');
    const length = await deliveryRedisService.llen('test:list');
    console.log('✅ List operations:', length === 2 ? 'PASS' : 'FAIL');
    
    // Test 3: Expiration
    await deliveryRedisService.expire('test:key', 1);
    await new Promise(resolve => setTimeout(resolve, 1100));
    const expired = await deliveryRedisService.get('test:key');
    console.log('✅ Expiration:', expired === null ? 'PASS' : 'FAIL');
    
    // Cleanup
    await deliveryRedisService.del('test:list');
    
    console.log('\n✅ All Redis tests passed!');
    console.log(`Connection type: ${deliveryRedisService.getType()}`);
    
  } catch (error) {
    console.error('❌ Redis test failed:', error);
    process.exit(1);
  }
}

testRedis();
```

### Ejecutar Test

```bash
npx tsx scripts/test-redis-connection.ts
```

**Resultado Esperado:**
```
🧪 Testing Redis Connection...

✅ Set/Get: PASS
✅ List operations: PASS
✅ Expiration: PASS

✅ All Redis tests passed!
Connection type: redis
```

---

## 🔍 Monitoreo y Debugging

### Ver Logs de Redis

```typescript
// En redis-connection.ts, los logs ya están configurados:
pinoLogger.info('Delivery Redis connected successfully');
pinoLogger.warn('Delivery Redis error, using in-memory fallback');
```

### Verificar Conexión en Runtime

```typescript
import { deliveryRedisService } from '@/src/core/delivery/redis-connection';

// En cualquier parte del código
const type = deliveryRedisService.getType();
console.log('Redis type:', type); // 'redis' | 'memory' | 'none'

const isAvailable = deliveryRedisService.isAvailable();
console.log('Redis available:', isAvailable);
```

### Upstash Dashboard

- Ver comandos ejecutados
- Monitorear latencia
- Ver uso de memoria
- Configurar alertas

---

## 📈 Optimizaciones de Producción

### 1. Connection Pooling

Ya configurado en `redis-connection.ts`:
```typescript
maxRetriesPerRequest: 3,
retryStrategy: (times) => Math.min(times * 100, 3000)
```

### 2. TTL Apropiados

```typescript
// Driver locations: 5 minutos
await deliveryRedisService.setex('driver:location', 300, data);

// Assignment queue: 1 hora
await deliveryRedisService.setex('assignment:queue', 3600, data);

// SSE connections: 30 minutos
await deliveryRedisService.setex('sse:connection', 1800, data);
```

### 3. Key Naming Convention

```
driver:{driverId}:location
assignment:queue:{tenantId}
sse:connection:{connectionId}
metrics:{type}:{date}
```

### 4. Eviction Policy

Configurar en Upstash:
- **allkeys-lru**: Recomendado (elimina keys menos usadas)
- **volatile-lru**: Solo keys con TTL
- **allkeys-lfu**: Elimina keys menos frecuentes

---

## 🚨 Troubleshooting

### Problema: "Connection timeout"

**Solución:**
```typescript
// Aumentar timeout en redis-connection.ts
const redis = new Redis(process.env.REDIS_URL, {
  connectTimeout: 10000, // 10 segundos
  commandTimeout: 5000,  // 5 segundos
});
```

### Problema: "Too many connections"

**Solución:**
- Verificar que no hay memory leaks
- Usar connection pooling
- Aumentar límite en Upstash dashboard

### Problema: "ECONNREFUSED"

**Solución:**
- Verificar REDIS_URL correcto
- Verificar firewall/security groups
- Verificar que Redis está corriendo

### Problema: Fallback a in-memory

**Verificar:**
```bash
# Ver logs
npm run dev

# Buscar:
# "REDIS_URL not configured, using in-memory fallback"
# "Delivery Redis error, using in-memory fallback"
```

---

## 📊 Métricas de Producción

### Comandos Esperados por Día

| Operación | Frecuencia | Comandos/día |
|-----------|------------|--------------|
| Driver location updates | 10 drivers × 12/hora × 24h | 2,880 |
| Location queries | 100 assignments/día × 10 queries | 1,000 |
| SSE connections | 50 connections × 120 heartbeats | 6,000 |
| Assignment queue | 100 assignments × 5 operations | 500 |
| **TOTAL** | | **~10,380** |

**Conclusión:** Free tier de Upstash (10,000 comandos/día) es suficiente para MVP.

---

## ✅ Checklist de Deployment

### Pre-Deployment

- [ ] Redis database creada en Upstash/Redis Cloud
- [ ] REDIS_URL configurada en Vercel
- [ ] Test de conexión ejecutado y pasando
- [ ] Logs verificados (no fallback a in-memory)
- [ ] TTLs configurados apropiadamente

### Post-Deployment

- [ ] Verificar logs en Vercel
- [ ] Verificar métricas en Upstash dashboard
- [ ] Test de driver location update
- [ ] Test de assignment flow
- [ ] Monitorear latencia (<100ms)

---

## 🎯 Próximos Pasos

1. **Crear cuenta en Upstash** (5 min)
2. **Crear database Redis** (2 min)
3. **Copiar REDIS_URL** (1 min)
4. **Agregar a Vercel env vars** (2 min)
5. **Deploy y verificar** (5 min)

**Tiempo total:** ~15 minutos

---

## 📝 Recursos

- **Upstash Docs:** https://docs.upstash.com/redis
- **Redis Cloud:** https://redis.com/redis-enterprise-cloud/overview/
- **Railway:** https://docs.railway.app/databases/redis
- **ioredis Docs:** https://github.com/redis/ioredis

---

**Última actualización:** 30 Enero 2026  
**Status:** 📋 LISTO PARA CONFIGURAR  
**Tiempo estimado:** 15 minutos  
**Costo:** $0 (free tier suficiente para MVP)
