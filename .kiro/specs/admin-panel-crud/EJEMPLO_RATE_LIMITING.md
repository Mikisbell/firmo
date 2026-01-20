# Ejemplo de Rate Limiting - Antes y Después

## ❌ ANTES (Sin Rate Limiting)

```typescript
// src/app/api/admin/employees/route.ts
export async function POST(request: NextRequest) {
  // ❌ Sin protección - vulnerable a brute force
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // ... resto del código
}
```

**Problema:** Un atacante puede hacer 1000 requests por segundo.

---

## ✅ DESPUÉS (Con Rate Limiting)

```typescript
// src/app/api/admin/employees/route.ts
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/src/lib/rate-limit-response';

export async function POST(request: NextRequest) {
  // ✅ PASO 1: Rate limiting (10 requests por minuto)
  const rateLimitResponse = await checkRateLimit(request, RATE_LIMIT_CONFIGS.MUTATION);
  if (rateLimitResponse) {
    return rateLimitResponse; // Retorna 429 si excede el límite
  }

  // ✅ PASO 2: Autenticación
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // ... resto del código
}
```

**Protección:** Máximo 10 requests por minuto por IP.

---

## 📊 Respuesta cuando se excede el límite

```json
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1737388800
Retry-After: 45

{
  "error": "Demasiados intentos. Por favor intenta nuevamente más tarde.",
  "retryAfter": "45 segundos"
}
```

---

## 🎯 Configuraciones Disponibles

```typescript
// Para autenticación (más restrictivo)
RATE_LIMIT_CONFIGS.AUTH        // 5 req/min

// Para crear/modificar
RATE_LIMIT_CONFIGS.MUTATION    // 10 req/min

// Para eliminar (más restrictivo)
RATE_LIMIT_CONFIGS.DELETE      // 5 req/min

// Para lectura (más permisivo)
RATE_LIMIT_CONFIGS.READ        // 30 req/min

// Para endpoints públicos
RATE_LIMIT_CONFIGS.PUBLIC      // 20 req/min
```

---

## 🧪 Testing

```typescript
// Test: permite requests dentro del límite
for (let i = 0; i < 10; i++) {
  const response = await POST(request);
  expect(response.status).toBe(201); // OK
}

// Test: bloquea el 11vo request
const response = await POST(request);
expect(response.status).toBe(429); // Too Many Requests
expect(response.headers.get('Retry-After')).toBeDefined();
```

---

## 📝 Uso en Otros Endpoints

### Endpoint de Login (más restrictivo)
```typescript
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, RATE_LIMIT_CONFIGS.AUTH);
  if (rateLimitResponse) return rateLimitResponse;
  
  // ... lógica de login
}
```

### Endpoint de Lectura (más permisivo)
```typescript
export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, RATE_LIMIT_CONFIGS.READ);
  if (rateLimitResponse) return rateLimitResponse;
  
  // ... lógica de lectura
}
```

### Endpoint de Eliminación (restrictivo)
```typescript
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, RATE_LIMIT_CONFIGS.DELETE);
  if (rateLimitResponse) return rateLimitResponse;
  
  // ... lógica de eliminación
}
```

---

## ✅ Beneficios

1. **Protección contra brute force** - Limita intentos de login
2. **Protección contra DoS** - Previene saturación del servidor
3. **Abuse prevention** - Evita uso excesivo de recursos
4. **Headers estándar** - Compatible con herramientas de monitoreo
5. **Mensajes en español** - UX mejorada para usuarios

---

## 🚀 Próximos Pasos

1. Aplicar a todos los endpoints POST/PUT/DELETE
2. Configurar rate limiting específico por endpoint
3. Monitorear rate limit hits en producción
4. Ajustar límites según uso real
