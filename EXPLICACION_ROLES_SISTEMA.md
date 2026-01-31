# 📋 Explicación: Roles del Sistema

**Fecha:** 26 Enero 2026  
**Contexto:** Sistema PARK POS - Roles de Empleados

---

## 🎯 ROLES ACTUALES DEL SISTEMA

### Roles Definidos en el Código

El sistema actualmente usa roles en **INGLÉS** (no español):

```typescript
// src/core/config/employees.ts
export type EmployeeRole = 
  | 'ADMIN'      // Administrador principal
  | 'MANAGER'    // Gerente
  | 'CASHIER'    // Cajero
  | 'WAITER'     // Mesero
  | 'KITCHEN'    // Cocina
  | 'BAR'        // Bar
  | 'DELIVERY';  // Delivery
```

### ❌ Rol "OWNER" No Existe

El test buscaba un rol `OWNER` que **NO está definido** en el sistema:

```typescript
// ❌ INCORRECTO - Este rol no existe
const admin = await prisma.employees.findFirst({
  where: {
    role: 'OWNER',  // ❌ No existe
  },
});

// ✅ CORRECTO - Usar ADMIN o MANAGER
const admin = await prisma.employees.findFirst({
  where: {
    role: 'ADMIN',  // ✅ Existe
  },
});
```

---

## 📊 JERARQUÍA DE ROLES

### Permisos por Rol

| Rol | Permisos | Acceso Admin Panel |
|-----|----------|-------------------|
| **ADMIN** | Todos los permisos | ✅ Completo |
| **MANAGER** | Gestión operativa | ✅ Limitado |
| **CASHIER** | Caja y pagos | ❌ No |
| **WAITER** | Tomar órdenes | ❌ No |
| **KITCHEN** | Ver órdenes KDS | ❌ No |
| **BAR** | Ver órdenes bar | ❌ No |
| **DELIVERY** | Gestionar entregas | ❌ No |

### Roles con Acceso Admin

Actualmente, los endpoints admin verifican:

```typescript
// src/app/api/admin/notifications/status/route.ts
if (!['OWNER', 'ADMIN'].includes(session.role)) {
  return NextResponse.json(
    { error: 'Acceso denegado' },
    { status: 403 }
  );
}
```

**Problema:** Verifica `OWNER` que no existe.

**Solución:** Debería verificar:
```typescript
if (!['ADMIN', 'MANAGER'].includes(session.role)) {
  // ...
}
```

---

## 🔧 EMPLEADOS DE PRUEBA

### Configuración Actual (seed.ts)

```typescript
const DEFAULT_EMPLOYEES = [
  { id: "...", name: "Admin Principal", role: "ADMIN", pin: "1234" },
  { id: "...", name: "María García", role: "CASHIER", pin: "1111" },
  { id: "...", name: "Carlos López", role: "WAITER", pin: "2222" },
  { id: "...", name: "Ana Torres", role: "WAITER", pin: "3333" },
  { id: "...", name: "Pedro Ruiz", role: "KITCHEN", pin: "4444" },
  { id: "...", name: "Luis Mendoza", role: "KITCHEN", pin: "5555" },
  { id: "...", name: "Rosa Flores", role: "MANAGER", pin: "0000" },
  { id: "...", name: "Jorge Díaz", role: "BAR", pin: "6666" },
  { id: "...", name: "Carmen Vega", role: "WAITER", pin: "7777" },
  { id: "...", name: "Miguel Soto", role: "DELIVERY", pin: "8888" },
];
```

### PINs de Acceso

| Empleado | Rol | PIN |
|----------|-----|-----|
| Admin Principal | ADMIN | 1234 |
| Rosa Flores | MANAGER | 0000 |
| María García | CASHIER | 1111 |
| Carlos López | WAITER | 2222 |

---

## 🌍 ¿POR QUÉ EN INGLÉS?

### Razones Técnicas

1. **Estándar de la industria:** Los roles en sistemas POS suelen estar en inglés
2. **Compatibilidad:** Facilita integración con sistemas externos
3. **Código limpio:** Evita problemas con acentos y caracteres especiales
4. **Internacionalización:** Más fácil traducir UI que cambiar código

### UI en Español

Aunque los roles están en inglés en el código, la UI los muestra en español:

```typescript
// Frontend - Traducción de roles
const roleLabels = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero',
  WAITER: 'Mesero',
  KITCHEN: 'Cocina',
  BAR: 'Bar',
  DELIVERY: 'Delivery',
};
```

---

## 🔄 MIGRACIÓN A ESPAÑOL (Opcional)

Si se desea cambiar los roles a español, se requiere:

### 1. Actualizar Tipos

```typescript
// src/core/config/employees.ts
export type EmployeeRole = 
  | 'ADMINISTRADOR'
  | 'GERENTE'
  | 'CAJERO'
  | 'MESERO'
  | 'COCINA'
  | 'BAR'
  | 'DELIVERY';
```

### 2. Migración de Base de Datos

```sql
-- Migración de roles
UPDATE employees SET role = 'ADMINISTRADOR' WHERE role = 'ADMIN';
UPDATE employees SET role = 'GERENTE' WHERE role = 'MANAGER';
UPDATE employees SET role = 'CAJERO' WHERE role = 'CASHIER';
UPDATE employees SET role = 'MESERO' WHERE role = 'WAITER';
-- etc...
```

### 3. Actualizar Todo el Código

- Todos los archivos que verifican roles
- Todos los tests
- Toda la documentación
- Seed scripts

### Impacto

- **Alto riesgo:** Cambio masivo en toda la aplicación
- **Tiempo estimado:** 2-3 días
- **Tests afectados:** Todos los tests de autenticación y permisos
- **Beneficio:** Consistencia con idioma español

---

## ✅ RECOMENDACIÓN

### Mantener Roles en Inglés

**Razones:**

1. **Estándar de la industria:** Todos los sistemas POS usan roles en inglés
2. **Menor riesgo:** No requiere migración masiva
3. **Mejor práctica:** Separar lógica (inglés) de presentación (español)
4. **Compatibilidad:** Facilita integraciones futuras

### Solución Actual

1. **Código:** Roles en inglés (ADMIN, MANAGER, etc.)
2. **UI:** Etiquetas en español (Administrador, Gerente, etc.)
3. **Base de datos:** Roles en inglés
4. **Documentación:** Explicar ambos idiomas

---

## 🐛 FIX NECESARIO

### Problema Actual

Varios endpoints verifican rol `OWNER` que no existe:

```typescript
// ❌ INCORRECTO
if (!['OWNER', 'ADMIN'].includes(session.role)) {
  // ...
}
```

### Solución

Reemplazar `OWNER` por `MANAGER`:

```typescript
// ✅ CORRECTO
if (!['ADMIN', 'MANAGER'].includes(session.role)) {
  // ...
}
```

### Archivos a Actualizar

1. `src/app/api/admin/notifications/status/route.ts`
2. `src/app/api/admin/employees/route.ts`
3. `src/app/api/admin/products/route.ts`
4. `src/app/api/admin/stations/route.ts`
5. Todos los endpoints admin que verifican roles

---

## 📝 CONCLUSIÓN

- **Roles actuales:** ADMIN, MANAGER, CASHIER, WAITER, KITCHEN, BAR, DELIVERY
- **Rol OWNER:** No existe, debe reemplazarse por ADMIN o MANAGER
- **Idioma:** Inglés en código, español en UI
- **Recomendación:** Mantener roles en inglés
- **Acción requerida:** Reemplazar referencias a OWNER por MANAGER

---

**Status:** ✅ DOCUMENTADO  
**Próximo:** Actualizar endpoints que verifican rol OWNER
