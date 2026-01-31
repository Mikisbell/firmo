# Prisma Model Naming Convention

> **CRÍTICO**: Este documento previene errores comunes al trabajar con Prisma Client

---

## 🚨 Problema Común

Cuando usas `prisma db pull` para generar el schema desde una base de datos existente, Prisma mantiene los nombres de tabla EXACTOS tal como están en la base de datos.

**Prisma Client NO convierte automáticamente a camelCase.**

---

## ✅ Regla de Oro

**El nombre del modelo en `schema.prisma` ES el nombre que usas en el código.**

```prisma
// En schema.prisma
model employees {
  id String @id
  name String
}

model login_attempts {
  id String @id
  success Boolean
}
```

```typescript
// En tu código TypeScript
❌ INCORRECTO: prisma.employee.findMany()
✅ CORRECTO:   prisma.employees.findMany()

❌ INCORRECTO: prisma.loginAttempt.create()
✅ CORRECTO:   prisma.login_attempts.create()
```

---

## 📋 Tabla de Referencia Rápida

| Tabla en DB | Modelo en schema.prisma | Uso en código |
|-------------|------------------------|---------------|
| `employees` | `model employees` | `prisma.employees` |
| `login_attempts` | `model login_attempts` | `prisma.login_attempts` |
| `admin_access_logs` | `model admin_access_logs` | `prisma.admin_access_logs` |
| `sessions` | `model sessions` | `prisma.sessions` |
| `products` | `model products` | `prisma.products` |
| `orders` | `model orders` | `prisma.orders` |
| `inventory_log` | `model inventory_log` | `prisma.inventory_log` |
| `goods_receipts` | `model goods_receipts` | `prisma.goods_receipts` |
| `goods_receipt_items` | `model goods_receipt_items` | `prisma.goods_receipt_items` |
| `inventory_counts` | `model inventory_counts` | `prisma.inventory_counts` |
| `inventory_count_items` | `model inventory_count_items` | `prisma.inventory_count_items` |

---

## 🔍 Cómo Verificar el Nombre Correcto

### Método 1: Buscar en schema.prisma
```bash
grep "^model " prisma/schema.prisma
```

### Método 2: Ver el modelo específico
```bash
grep -A 5 "model employees" prisma/schema.prisma
```

### Método 3: Usar TypeScript autocomplete
El editor te mostrará los nombres disponibles cuando escribas `prisma.`

---

## 🛠️ Generación de UUIDs

**IMPORTANTE**: Todas las tablas con `id String @id @db.Uuid` requieren que generes el UUID manualmente.

```typescript
import { randomBytes } from 'crypto';

// ❌ INCORRECTO - Prisma no genera el UUID automáticamente
await prisma.login_attempts.create({
  data: {
    tenant_id: "...",
    pin_hash: "...",
    success: true
  }
});

// ✅ CORRECTO - Genera el UUID manualmente
await prisma.login_attempts.create({
  data: {
    id: randomBytes(16).toString('hex'), // UUID generado
    tenant_id: "...",
    pin_hash: "...",
    success: true
  }
});
```

### Tablas que requieren UUID manual:
- `login_attempts`
- `admin_access_logs`
- `sessions`
- `employees`
- `products`
- `orders`
- `inventory_log`
- `goods_receipts`
- `goods_receipt_items`
- `inventory_counts`
- `inventory_count_items`

---

## 🚫 Errores Comunes y Soluciones

### Error 1: "Cannot read properties of undefined (reading 'findFirst')"
```typescript
// ❌ Error
const user = await prisma.employee.findFirst();
// TypeError: Cannot read properties of undefined (reading 'findFirst')

// ✅ Solución
const user = await prisma.employees.findFirst();
```

### Error 2: "Argument `id` is missing"
```typescript
// ❌ Error
await prisma.sessions.create({
  data: {
    tenant_id: "...",
    employee_id: "..."
  }
});
// Error: Argument `id` is missing

// ✅ Solución
await prisma.sessions.create({
  data: {
    id: randomBytes(16).toString('hex'),
    tenant_id: "...",
    employee_id: "..."
  }
});
```

---

## 📝 Checklist Antes de Usar Prisma

Antes de escribir código con Prisma:

1. ✅ Verificar el nombre exacto del modelo en `schema.prisma`
2. ✅ Usar el nombre EXACTO en el código (respetando snake_case)
3. ✅ Si la tabla tiene `id String @id @db.Uuid`, generar el UUID manualmente
4. ✅ Probar con un query simple antes de implementar lógica compleja

---

## 🔧 Script de Verificación

Usa este script para verificar que la base de datos esté conectada:

```bash
npx tsx scripts/check-tables.ts
```

Debe mostrar:
```
login_attempts count: X
admin_access_logs count: X
sessions count: X
Employees: [...]
```

---

## 📚 Referencias

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- Schema del proyecto: `prisma/schema.prisma`

---

**Última actualización:** 8 Enero 2026  
**Autor:** Documentado después del incidente de nombres incorrectos
