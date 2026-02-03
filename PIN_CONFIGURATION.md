# 🔐 Configuración de PINs

## Problema Identificado

Estabas intentando hacer login en la **Caja (CASHIER)** con PIN **1234**, pero ese PIN solo existe para el **Admin Principal**.

## PINs Disponibles

| Empleado | Rol | PIN | Ubicación |
|----------|-----|-----|-----------|
| Admin Principal | ADMIN | **1234** | Panel de Administración |
| María García | CASHIER | **1111** | Caja |
| Carlos López | WAITER | **2222** | Mesero |
| Ana Torres | WAITER | **3333** | Mesero |
| Pedro Ruiz | KITCHEN | **4444** | Cocina (Parrilla) |
| Luis Mendoza | KITCHEN | **5555** | Cocina |
| Rosa Flores | MANAGER | **0000** | Manager |
| Jorge Díaz | BAR | **6666** | Bar |
| Carmen Vega | WAITER | **7777** | Mesero |
| Miguel Soto | DELIVERY | **8888** | Delivery |

## Cómo Probar

### Para el Panel de Administración
1. Ve a `http://localhost:3000/admin/terminales`
2. Ingresa PIN: **1234**
3. Deberías entrar al dashboard del admin

### Para la Caja (POS)
1. Ve a `http://localhost:3000/pos`
2. Ingresa PIN: **1111** (María García - CASHIER)
3. Deberías entrar a la caja

### Para Mesero
1. Ve a `http://localhost:3000/mozo`
2. Ingresa PIN: **2222** (Carlos López - WAITER)
3. Deberías entrar al módulo de mesero

### Para Cocina
1. Ve a `http://localhost:3000/cocina`
2. Ingresa PIN: **4444** (Pedro Ruiz - KITCHEN)
3. Deberías entrar a la cocina

## Archivos Relevantes

- `src/core/config/employees.ts` - Configuración centralizada de empleados
- `prisma/seed.ts` - Script de seed que crea los empleados
- `src/core/auth/auth.service.ts` - Servicio de autenticación

## Próximos Pasos

1. **Prueba con PIN 1111** en la Caja
2. **Prueba con PIN 1234** en el Admin Panel
3. **Reporta si funciona**

Si funciona, el sistema de autenticación está 100% operativo.
