# Arquitectura de Autenticación - Separación de Concerns

## Resumen

Se implementó una arquitectura limpia que separa las operaciones de autenticación según el runtime:

- **Middleware**: Validación ligera con Web Crypto API (Edge Runtime)
- **API Routes**: Operaciones pesadas con Node.js crypto

## Estructura

```
src/core/auth/
├── middleware-auth.ts     # ✅ Edge Runtime compatible
├── auth.service.ts        # Node.js crypto (API routes only)
└── crypto-utils.ts        # Node.js crypto (API routes only)

middleware.ts              # ✅ Usa middleware-auth.ts (Edge compatible)
```

## Separación de Responsabilidades

### 1. Middleware (`middleware.ts`)
**Responsabilidad**: Validar existencia y básica integridad del token

**No hace**:
- ❌ Operaciones con Node.js crypto
- ❌ Verificación de PINs
- ❌ Generación de hashes

**Sí hace**:
- ✅ Extrae token de cookies/headers
- ✅ Valida JWT con Web Crypto API (jose)
- ✅ Agrega headers a la request
- ✅ Redirige si no hay token

### 2. API Routes (`auth.service.ts`, `crypto-utils.ts`)
**Responsabilidad**: Operaciones criptográficas completas

**Sí hace**:
- ✅ Verificación de PINs con SHA256
- ✅ Generación de tokens seguros
- ✅ Hashing de contraseñas
- ✅ Validación completa de sesiones

## Beneficios

1. **Edge Runtime Compatible**: El middleware puede ejecutarse en Edge (Vercel, Cloudflare)
2. **Seguridad**: Menor superficie de ataque en middleware
3. **Performance**: Middleware ligero, carga rápida
4. **Mantenibilidad**: Responsabilidades claras separadas

## Flujo de Autenticación

```
Request → Middleware → API Route
   ↓          ↓           ↓
  Cookie   Validar    Operaciones
  existe?  JWT        Crypto
   ↓          ↓           ↓
  No    →  Redirect   (Si falla → 401)
  Sí    →  Headers    (Si ok → 200)
         ↓
    API Route recibe
    headers con user info
```

## Archivos Modificados

1. **Nuevo**: `src/core/auth/middleware-auth.ts`
   - Funciones Edge-compatible
   - Usa Web Crypto API via jose
   - Sin dependencias de Node.js crypto

2. **Modificado**: `middleware.ts`
   - Importa desde `middleware-auth.ts`
   - Ya no importa `auth.service.ts`
   - Eliminado warning de Edge Runtime

3. **Sin cambios**: `auth.service.ts`, `crypto-utils.ts`
   - Siguen funcionando en API routes
   - Mantienen todas las capacidades criptográficas

## Notas

- La validación JWT en middleware es suficiente para la mayoría de casos
- Las operaciones sensibles (PINs, hashes) siempre ocurren en API routes
- El middleware solo "deja pasar" o "redirige", no maneja lógica de negocio
