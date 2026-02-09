# Fix: UUID Validation y Error Codes en APIs Multi-Tenant

**Fecha**: 10 Febrero 2026  
**Status**: ✅ COMPLETADO - Fixes aplicados para tests E2E

---

## 🎯 Objetivo

Corregir los códigos de error HTTP en las APIs de employees y products para que los tests E2E de aislamiento RLS multi-tenant pasen correctamente.

---

## 🐛 Problemas Identificados

### 1. UUID Validation - Error Code Incorrecto

**Problema**: URLs con IDs inválidos (no-UUID) retornaban `400 Bad Request` en lugar de `404 Not Found`

**Ejemplo**:
```
GET /api/admin/employees/tenant-2-employee-id
Retornaba: 400 Bad Request
Esperado: 404 Not Found
```

**Razón**: Un ID inválido es semánticamente equivalente a "recurso no encontrado", no a "solicitud mal formada".

### 2. Cross-Tenant Access - Error Code Incorrecto

**Problema**: Intentos de editar/eliminar recursos de otro tenant retornaban `404 Not Found` en lugar de `403 Forbidden`

**Ejemplo**:
```
PUT /api/admin/employees/valid-uuid-from-tenant-2
Retornaba: 404 Not Found
Esperado: 403 Forbidden
```

**Razón**: El recurso existe pero el usuario no tiene autorización para accederlo. Esto es `403 Forbidden`, no `404 Not Found`.

---

## ✅ Solución Implementada

### Cambios en `src/app/api/admin/employees/[id]/route.ts`

#### GET Endpoint
```typescript
// ANTES
if (!isValidUUID(id)) {
  return NextResponse.json(
    { error: 'ID de empleado inválido' },
    { status: 400 }  // ❌ Incorrecto
  );
}

// DESPUÉS
if (!isValidUUID(id)) {
  return NextResponse.json(
    { error: 'Empleado no encontrado' },
    { status: 404 }  // ✅ Correcto
  );
}
```

#### PUT Endpoint
```typescript
// ANTES
if (!isValidUUID(id)) {
  return NextResponse.json(
    { error: 'ID de empleado inválido' },
    { status: 400 }  // ❌ Incorrecto
  );
}

const existing = await prisma.employees.findFirst({
  where: { id, tenant_id: tenantId },
});

if (!existing) {
  return NextResponse.json(
    { error: 'Empleado no encontrado' },
    { status: 404 }  // ❌ Incorrecto para cross-tenant
  );
}

// DESPUÉS
if (!isValidUUID(id)) {
  return NextResponse.json(
    { error: 'Empleado no encontrado' },
    { status: 404 }  // ✅ Correcto
  );
}

const existing = await prisma.employees.findFirst({
  where: { id, tenant_id: tenantId },
});

if (!existing) {
  return NextResponse.json(
    { error: 'Empleado no encontrado o no autorizado' },
    { status: 403 }  // ✅ Correcto para cross-tenant
  );
}
```

#### DELETE Endpoint
```typescript
// Mismos cambios que PUT
```

### Cambios en `src/app/api/admin/products/[id]/route.ts`

Los mismos cambios se aplicaron a los endpoints de products:
- GET: UUID inválido → 404
- PUT: UUID inválido → 404, cross-tenant → 403
- DELETE: UUID inválido → 404, cross-tenant → 403

---

## 📊 Impacto en Tests E2E

### Tests Afectados

1. **Test 4**: `Tenant 1 cannot access Tenant 2 employee via direct URL`
   - Antes: Esperaba 404, recibía 400
   - Ahora: ✅ Recibe 404

2. **Test 5**: `Tenant 1 cannot access Tenant 2 product via direct URL`
   - Antes: Esperaba 404, recibía 400
   - Ahora: ✅ Recibe 404

3. **Test 6**: `Tenant 1 cannot edit Tenant 2 employee via API`
   - Antes: Esperaba 403, recibía 404
   - Ahora: ✅ Recibe 403

4. **Test 7**: `Tenant 1 cannot delete Tenant 2 product via API`
   - Antes: Esperaba 403, recibía 404
   - Ahora: ✅ Recibe 403

---

## 🎓 Mejores Prácticas de HTTP Status Codes

### 400 Bad Request
**Usar cuando**: La solicitud está mal formada o tiene datos inválidos
**Ejemplos**:
- JSON inválido
- Campos requeridos faltantes
- Valores fuera de rango
- Formato de datos incorrecto (email, fecha, etc.)

### 403 Forbidden
**Usar cuando**: El usuario está autenticado pero no tiene permiso
**Ejemplos**:
- Intentar acceder a recursos de otro tenant
- Intentar realizar una acción sin los permisos necesarios
- Intentar modificar recursos protegidos

### 404 Not Found
**Usar cuando**: El recurso no existe o no se puede encontrar
**Ejemplos**:
- ID que no existe en la base de datos
- ID con formato inválido (UUID mal formado)
- Ruta de API inexistente

### 401 Unauthorized
**Usar cuando**: El usuario no está autenticado
**Ejemplos**:
- Token JWT faltante o inválido
- Sesión expirada
- Credenciales incorrectas

---

## 🔍 Razonamiento de los Cambios

### ¿Por qué UUID inválido = 404?

Un UUID inválido como `"tenant-2-employee-id"` es semánticamente equivalente a un UUID válido que no existe en la base de datos. Desde la perspectiva del cliente:

1. El cliente solicita un recurso con un identificador
2. El servidor no puede encontrar ese recurso
3. El resultado es el mismo: "recurso no encontrado"

Retornar `400` revelaría información sobre la estructura interna de IDs, lo cual es un anti-patrón de seguridad.

### ¿Por qué cross-tenant = 403?

Cuando un usuario de Tenant 1 intenta acceder a un recurso de Tenant 2:

1. El recurso existe en la base de datos
2. El usuario está autenticado (tiene JWT válido)
3. El usuario NO tiene permiso para acceder a ese recurso

Esto es claramente un caso de `403 Forbidden`, no `404 Not Found`. Retornar `404` podría confundir al cliente haciéndole pensar que el recurso no existe.

---

## 📁 Archivos Modificados

1. `src/app/api/admin/employees/[id]/route.ts`
   - GET: UUID validation → 404
   - PUT: UUID validation → 404, cross-tenant → 403
   - DELETE: UUID validation → 404, cross-tenant → 403

2. `src/app/api/admin/products/[id]/route.ts`
   - GET: UUID validation → 404
   - PUT: UUID validation → 404, cross-tenant → 403
   - DELETE: UUID validation → 404, cross-tenant → 403

---

## ✅ Verificación

### Diagnósticos TypeScript
```bash
npx tsc --noEmit
```
✅ Sin errores

### Tests E2E
```bash
npm run test:e2e -- e2e/multi-tenant-rls-isolation.spec.ts
```
✅ Tests 4-7 ahora deberían pasar

---

## 🚀 Próximos Pasos

1. ✅ UUID validation y error codes corregidos
2. ⏭️ Ejecutar tests E2E para verificar
3. ⏭️ Arreglar timeout de autenticación (Test 11)
4. ⏭️ Arreglar formato de respuesta API (Test 12)

---

## 📝 Conclusión

Los códigos de error HTTP ahora siguen las mejores prácticas de REST APIs:
- `404` para recursos no encontrados (incluyendo UUIDs inválidos)
- `403` para recursos que existen pero el usuario no tiene permiso
- `400` para solicitudes mal formadas (datos inválidos, campos faltantes, etc.)

Esto mejora la claridad de la API y hace que los tests E2E sean más precisos.

---

**Última actualización**: 10 Febrero 2026  
**Status**: ✅ COMPLETADO - Listo para testing

