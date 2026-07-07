# 🚀 FIRMO POS - Checklist Pre-Producción

> **Objetivo:** Validar que el sistema está listo para uso real en pollería.
> **Fecha:** Enero 2026

---

## 📋 RESUMEN EJECUTIVO

| Categoría | Estado | Crítico |
|-----------|--------|---------|
| Tests Automatizados | ✅ 620 unit + 26 E2E | - |
| Seguridad Financiera | ✅ Implementado | 🔴 |
| Flujos Core | ⏳ Pendiente validación manual | 🔴 |
| Infraestructura | ⏳ Pendiente configuración | 🔴 |
| Datos de Producción | ⏳ Pendiente seed | 🟡 |
| Backup/Recovery | ⏳ Pendiente plan | 🔴 |

---

## 🔴 CRÍTICO - Antes de Primer Uso

### 1. Variables de Entorno Producción
```bash
# .env.production (NO commitear)
DATABASE_URL="postgresql://..."  # Supabase producción
DIRECT_URL="postgresql://..."    # Conexión directa
JWT_SECRET="[generar-32-chars-random]"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

- [ ] DATABASE_URL apunta a DB de producción (no desarrollo)
- [ ] JWT_SECRET es único y seguro (no el de desarrollo)
- [ ] Supabase keys son de proyecto producción

### 2. Migraciones de Base de Datos
```bash
# Ejecutar en producción
npx prisma migrate deploy
npx prisma db seed
```

- [ ] Migraciones aplicadas sin errores
- [ ] Seed ejecutado con datos iniciales
- [ ] Verificar que tablas existen: `tenants`, `employees`, `products`, `locations`

### 3. Datos Iniciales Requeridos

#### Tenant (Negocio)
- [ ] Crear tenant con ID correcto en `tenants`
- [ ] Configurar `tenant_settings` (nombre, RUC, dirección)

#### Empleados
- [ ] Crear empleados con PINs seguros (4 dígitos únicos)
- [ ] Asignar roles: ADMIN, MANAGER, CASHIER, WAITER, KITCHEN
- [ ] Verificar que PINs no sean obvios (1234, 0000, etc.)

#### Productos
- [ ] Cargar catálogo completo de productos
- [ ] Verificar precios en CENTAVOS (S/ 25.00 = 2500)
- [ ] Asignar estaciones: HORNO, COCINA, BAR, FRIOS
- [ ] Verificar categorías

#### Mesas y Zonas
- [ ] Crear zonas: Salón, Terraza, VIP, etc.
- [ ] Crear mesas con números correctos
- [ ] Asignar mesas a zonas

### 4. Terminales
- [ ] Registrar terminal CAJA_01 (caja principal)
- [ ] Registrar terminales MOZO_01 a MOZO_15 (meseros)
- [ ] Registrar KDS_COCINA, KDS_HORNO, KDS_BAR
- [ ] Verificar que cada terminal tiene `terminal_number_ranges` asignado

---

## 🟡 IMPORTANTE - Validación Manual

### 5. Flujo Completo de Venta (Probar en Staging)

#### 5.1 Mesero → Cocina → Caja
- [ ] Mesero abre mesa (selecciona zona, mesa, # comensales)
- [ ] Mesero agrega items (pollo, papas, bebidas)
- [ ] Items aparecen en KDS Cocina/Horno/Bar según estación
- [ ] Cocina marca items como COOKING → READY
- [ ] Mesero ve notificación de items listos
- [ ] Mesero solicita cuenta
- [ ] Caja ve orden en "Pendientes"
- [ ] Caja cobra (efectivo/tarjeta/Yape)
- [ ] Caja emite boleta/factura
- [ ] Orden se cierra correctamente

#### 5.2 Delivery
- [ ] Caja crea orden delivery
- [ ] Ingresa datos cliente (nombre, teléfono, dirección)
- [ ] Agrega items
- [ ] Asigna repartidor
- [ ] Repartidor ve orden en su app
- [ ] Repartidor marca como despachado
- [ ] Repartidor marca como entregado
- [ ] Orden se cierra

#### 5.3 Para Llevar (Takeout)
- [ ] Caja crea orden para llevar
- [ ] Ingresa nombre cliente
- [ ] Agrega items
- [ ] Cobra y emite comprobante

### 6. Flujo Offline
- [ ] Desconectar WiFi en tablet mesero
- [ ] Crear orden offline
- [ ] Agregar items offline
- [ ] Reconectar WiFi
- [ ] Verificar que orden sincroniza correctamente
- [ ] Verificar que no hay duplicados

### 7. Flujo de Turno
- [ ] Abrir turno con fondo de caja (ej: S/ 200)
- [ ] Realizar ventas
- [ ] Registrar movimientos (ingreso/salida de efectivo)
- [ ] Cerrar turno
- [ ] Verificar cuadre de caja

### 8. Split Bill (División de Cuenta)
- [ ] Crear orden con múltiples items
- [ ] Dividir cuenta por items
- [ ] Dividir cuenta equitativamente
- [ ] Cobrar cada parte por separado
- [ ] Verificar totales correctos

---

## 🔧 INFRAESTRUCTURA

### 9. Hosting/Deploy
- [ ] Vercel configurado con dominio
- [ ] SSL/HTTPS activo
- [ ] Variables de entorno en Vercel
- [ ] Build de producción exitoso

### 10. Base de Datos
- [ ] Supabase en plan adecuado (no free tier para producción)
- [ ] Backups automáticos configurados
- [ ] Connection pooling habilitado
- [ ] Índices de performance aplicados

### 11. Monitoreo
- [ ] Logs accesibles (Vercel logs o similar)
- [ ] Alertas configuradas para errores críticos
- [ ] Métricas de uso básicas

---

## 🖨️ HARDWARE

### 12. Impresoras
- [ ] Impresora térmica conectada y probada
- [ ] Papel térmico suficiente
- [ ] Impresión de ticket de prueba exitosa
- [ ] Configurar ancho de papel (80mm típico)

### 13. Tablets/Dispositivos
- [ ] Tablets cargadas y con WiFi configurado
- [ ] Chrome instalado y actualizado
- [ ] PWA instalada en cada tablet
- [ ] Modo kiosko configurado (opcional)

### 14. Red
- [ ] WiFi estable en todo el local
- [ ] Router con IP fija o DHCP reservado
- [ ] Plan de contingencia si cae internet (modo offline)

---

## 📊 DATOS DE PRUEBA vs PRODUCCIÓN

### 15. Limpiar Datos de Desarrollo
```sql
-- CUIDADO: Solo ejecutar si es DB nueva
TRUNCATE events, orders, order_items, checks, payments CASCADE;
```

- [ ] Eliminar órdenes de prueba
- [ ] Eliminar eventos de desarrollo
- [ ] Mantener: productos, empleados, mesas, zonas

---

## 🚨 PLAN DE CONTINGENCIA

### 16. Si Algo Falla
- [ ] Tener sistema manual de respaldo (libreta, calculadora)
- [ ] Número de contacto de soporte técnico
- [ ] Acceso a consola de Supabase para emergencias
- [ ] Saber cómo resetear IndexedDB en tablets

### 17. Rollback
- [ ] Saber cómo volver a versión anterior en Vercel
- [ ] Backup de DB antes de ir a producción

---

## ✅ CHECKLIST FINAL

### Día Antes de Lanzamiento
- [ ] Todos los items críticos (🔴) completados
- [ ] Prueba de flujo completo exitosa
- [ ] Empleados capacitados en uso básico
- [ ] Hardware probado y funcionando
- [ ] Plan de contingencia comunicado

### Día del Lanzamiento
- [ ] Abrir turno con fondo de caja real
- [ ] Primera venta de prueba (puede ser real)
- [ ] Verificar que todo sincroniza
- [ ] Monitorear primeras 2 horas de cerca
- [ ] Tener persona técnica disponible

---

## 📞 CONTACTOS DE EMERGENCIA

| Rol | Nombre | Teléfono |
|-----|--------|----------|
| Desarrollador | [Tu nombre] | [Tu número] |
| Admin Supabase | - | - |
| Soporte Vercel | - | support.vercel.com |

---

**Última actualización:** 10 Enero 2026
