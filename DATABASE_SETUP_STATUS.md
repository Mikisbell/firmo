# Database Setup Status - 2 Febrero 2026

## Estado Actual de la Base de Datos

### Registros Existentes
```
tenants             :     1 registros ✅
employees           :    10 registros ✅
terminals           :    10 registros ✅
locations           :     1 registros ✅
products            :    24 registros ✅
inventory           :     8 registros ✅
orders              :     0 registros (vacío)
invoices            :     0 registros (vacío)
events              :     1 registros ✅
delivery_orders     :     0 registros (vacío)
```

## Datos Disponibles para Tests E2E

### 1. Tenant
- **ID:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **Nombre:** Pollería El Sabrosón S.A.C.
- **RUC:** 20123456789
- **Zona Horaria:** America/Lima

### 2. Empleados (10 total)
```
1. Admin (PIN: 1234) - ADMIN
2. Cajero (PIN: 1111) - CASHIER
3. Mesero 1 (PIN: 2222) - WAITER
4. Mesero 2 (PIN: 2223) - WAITER
5. Mesero 3 (PIN: 2224) - WAITER
6. Mesero 4 (PIN: 2225) - WAITER
7. Mesero 5 (PIN: 2226) - WAITER
8. Chef (PIN: 3333) - KDS
9. Barman (PIN: 4444) - KDS
10. Empaquetador (PIN: 5555) - KDS
```

### 3. Terminales (10 total)
```
- CAJA_01 (CASHIER) - active
- SPC_HORNO (KDS) - active
- SPC_COCINA (KDS) - active
- SPC_BAR (BAR) - active
- SPC_EMPAQUE (KDS) - active
- MOZO_01 (WAITER) - active
- MOZO_02 (WAITER) - active
- MOZO_03 (WAITER) - pending
- MOZO_04 (WAITER) - disabled
- MOZO_05 (WAITER) - pending
```

### 4. Productos (24 total)
- 4 tipos de pollo (entero, 1/2, 1/4, 1/8)
- 3 combos (familiar, pareja, personal)
- 6 guarniciones (papas, ensalada, arroz)
- 7 bebidas (Inca Kola, Coca Cola, agua, chicha)
- 3 extras (ají, mayonesa, ketchup)
- 2 postres (torta, helado)

### 5. Estaciones (7 total)
```
- PARRILLA (Parrilla)
- COCINA (Cocina Caliente)
- BAR (Bar)
- HORNO (Horno)
- FRIOS (Platos Fríos)
- POSTRES (Postres)
- EMPAQUE (Empaque y Delivery)
```

### 6. Zonas y Mesas (4 zonas, 23 mesas)
```
- SALON (10 mesas)
- TERRAZA (6 mesas)
- BAR (4 mesas)
- VIP (3 mesas)
```

### 7. Inventario (8 items)
```
- POLLO-KG (50 kg) - Vence en 3 días
- PAPA-KG (100 kg) - Vence en 14 días
- ACEITE-LT (30 lt) - No perecedero
- SAL-KG (10 kg) - No perecedero
- AJI-KG (5 kg) - Vence mañana ⚠️
- MAYONESA-KG (8 kg) - Vence hoy ⚠️
- KETCHUP-KG (6 kg) - Ya venció ❌
- MOSTAZA-KG (4 kg) - Vence en 7 días
```

## Qué Necesitamos Hacer

### Para Tests E2E Funcionales

1. **Crear órdenes de prueba** (actualmente 0)
   - Órdenes completadas
   - Órdenes pendientes
   - Órdenes canceladas

2. **Crear facturas de prueba** (actualmente 0)
   - Facturas emitidas
   - Facturas anuladas

3. **Crear pedidos de delivery** (actualmente 0)
   - Pedidos pendientes
   - Pedidos en ruta
   - Pedidos entregados

4. **Crear eventos de prueba** (actualmente 1)
   - Eventos de venta
   - Eventos de devolución
   - Eventos de sincronización

## Próximos Pasos

1. ✅ Base de datos seeded correctamente
2. ⏳ Crear 5 archivos E2E renombrados con estructura numérica
3. ⏳ Ejecutar tests E2E para verificar funcionalidad
4. ⏳ Crear datos de prueba adicionales si es necesario

## Comandos Útiles

```bash
# Verificar estado de BD
node scripts/verify-db.mjs

# Ejecutar seed
npx prisma db seed

# Ejecutar tests E2E
npm run test:e2e

# Ejecutar servidor de desarrollo
npm run dev
```

---
**Última actualización:** 2 Febrero 2026
**Estado:** ✅ Base de datos lista para tests E2E
