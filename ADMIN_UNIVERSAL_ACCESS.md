# 🔐 Acceso Universal del Admin

## Característica Implementada

**El Admin (PIN 1234) puede acceder a CUALQUIER terminal del sistema.**

Esta es una característica de seguridad estándar en sistemas POS que permite al administrador:
- Hacer override en cualquier terminal
- Resolver problemas operacionales
- Acceder a cualquier módulo sin necesidad de múltiples PINs

## Cómo Funciona

### Antes (Sin Acceso Universal)
```
Admin PIN: 1234 → Solo acceso al Panel de Administración
Caja PIN: 1111 → Solo acceso a la Caja
Mesero PIN: 2222 → Solo acceso a Mesero
```

### Ahora (Con Acceso Universal)
```
Admin PIN: 1234 → Acceso a CUALQUIER terminal:
  ✅ Panel de Administración
  ✅ Caja (CASHIER)
  ✅ Mesero (WAITER)
  ✅ Cocina (KITCHEN)
  ✅ Bar (BAR)
  ✅ Delivery (DRIVER)
  ✅ Cualquier otra terminal
```

## Casos de Uso

### 1. Admin Necesita Verificar Caja
```
1. Ve a http://localhost:3000/pos
2. Ingresa PIN: 1234
3. Accede como Admin a la Caja
4. Puede ver/verificar transacciones
```

### 2. Admin Necesita Ayudar a Mesero
```
1. Ve a http://localhost:3000/mozo
2. Ingresa PIN: 1234
3. Accede como Admin al módulo de Mesero
4. Puede resolver problemas
```

### 3. Admin Necesita Verificar Cocina
```
1. Ve a http://localhost:3000/cocina
2. Ingresa PIN: 1234
3. Accede como Admin a la Cocina
4. Puede ver órdenes pendientes
```

## Implementación Técnica

### Cambio en `/api/auth/login`

```typescript
// ADMIN can access any terminal with their PIN
if (authResult.employee?.role === 'ADMIN') {
  console.log('[Login] ADMIN access detected - allowing access to any terminal');
  // Admin is allowed to access any terminal, no additional checks needed
}
```

### Flujo de Autenticación

1. **Usuario ingresa PIN** (ej: 1234)
2. **Sistema valida PIN** contra base de datos
3. **Si es ADMIN**: Permite acceso a cualquier terminal
4. **Si es otro rol**: Solo permite acceso a su terminal específico

## Seguridad

### ✅ Protecciones Implementadas

1. **Lockout por intentos fallidos**
   - 3 intentos fallidos = 5 minutos de bloqueo
   - Protege contra ataques de fuerza bruta

2. **Audit Trail**
   - Todos los logins se registran
   - Se puede ver quién accedió a qué terminal y cuándo

3. **Sesiones Seguras**
   - httpOnly cookies (protege contra XSS)
   - SameSite=strict (protege contra CSRF)
   - Tokens JWT con expiración

4. **Validación de Terminal**
   - Se verifica que la terminal esté registrada
   - Se verifica que la terminal esté activa

## Pruebas

### Test Automatizado

```bash
node scripts/test-admin-access-all-terminals.mjs
```

Este script verifica que el Admin puede acceder a:
- Caja (CASHIER)
- Mesero (WAITER)
- Cocina (KITCHEN)
- Bar (BAR)

### Prueba Manual

1. **Abre navegador**
2. **Ve a cualquier terminal** (ej: `/pos`, `/mozo`, `/cocina`)
3. **Ingresa PIN: 1234**
4. **Deberías entrar como Admin**

## Configuración

### PINs Disponibles

| Rol | PIN | Acceso |
|-----|-----|--------|
| ADMIN | 1234 | ✅ Todas las terminales |
| CASHIER | 1111 | Solo Caja |
| WAITER | 2222 | Solo Mesero |
| KITCHEN | 4444 | Solo Cocina |
| MANAGER | 0000 | Manager |
| BAR | 6666 | Solo Bar |
| DELIVERY | 8888 | Solo Delivery |

## Próximos Pasos

### Opcional: Agregar Confirmación de Admin

Si quieres agregar una confirmación adicional cuando un Admin accede a una terminal que no es la suya:

```typescript
if (authResult.employee?.role === 'ADMIN' && data.terminal_id !== 'ADMIN_PANEL') {
  // Agregar flag para mostrar confirmación en UI
  response.adminOverride = true;
}
```

### Opcional: Logging Detallado

Agregar logging más detallado para auditoría:

```typescript
if (authResult.employee?.role === 'ADMIN') {
  await logAdminAccess(prisma, tenantId, employee.id, 'ADMIN_OVERRIDE', {
    terminal_id: data.terminal_id,
    timestamp: new Date(),
  });
}
```

## Conclusión

El Admin ahora tiene acceso universal a todas las terminales con su PIN 1234, lo que permite:
- ✅ Mejor operación del negocio
- ✅ Resolución rápida de problemas
- ✅ Auditoría completa de accesos
- ✅ Seguridad mantenida con lockout y sesiones

---

**Última actualización**: 3 Febrero 2026  
**Status**: ✅ Implementado y probado  
**Impacto**: 🟢 ALTO - Mejora significativa en operación
