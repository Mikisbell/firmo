# Documento de Requisitos — Panel de Administración

## Introducción

Panel de administración centralizado para PARK POS que permite configurar todos los aspectos del sistema. Este panel será accesible desde `/admin` y requerirá autenticación con rol ADMIN, MANAGER u OWNER.

**Documentación de referencia:**
- Diseño detallado: `docs/03-features/FLUJO_ADMIN.md`
- Configuración: `docs/03-features/FLUJO_CONFIGURACION.md`
- Empleados: `docs/03-features/FLUJO_EMPLEADOS_TURNOS.md`
- Reportes: `docs/03-features/FLUJO_REPORTES.md`

**Estado actual:** El sistema tiene valores hardcodeados (tenant_id, terminal_id) y no existe un panel de administración funcional. Solo existe `/admin/inventario` para gestión de stock.

## Glosario

- **Panel_Admin**: Interfaz web de administración en `/admin`
- **Tenant**: Instancia del negocio (pollería) con configuración propia
- **Terminal**: Dispositivo físico identificado por fingerprint
- **Empleado**: Usuario con rol y PIN de acceso (4-6 dígitos)
- **Producto**: Artículo del catálogo con precio en centavos
- **Estación**: Estación KDS (PARRILLA, COCINA, BAR, HORNO, POSTRES)
- **Promoción**: Regla de descuento (PERCENT, FIXED, HAPPY_HOUR, 2X1, COMBO)

## Requisitos

### Requisito 1: Autenticación del Panel Admin

**Historia de Usuario:** Como administrador, quiero acceder al panel de forma segura con mi PIN.

#### Criterios de Aceptación

1. CUANDO un usuario navega a `/admin` ENTONCES EL Panel_Admin DEBE mostrar un modal de autenticación por PIN
2. CUANDO un usuario ingresa un PIN válido con rol OWNER, ADMIN o MANAGER ENTONCES EL Panel_Admin DEBE otorgar acceso
3. CUANDO un usuario ingresa un PIN inválido 3 veces ENTONCES EL Panel_Admin DEBE bloquear el acceso por 5 minutos
4. EL Panel_Admin DEBE restringir módulos según permisos de rol (OWNER > ADMIN > MANAGER)

### Requisito 2: Dashboard Principal

**Historia de Usuario:** Como administrador, quiero ver métricas del negocio y navegar a los módulos de configuración.

#### Criterios de Aceptación

1. EL Panel_Admin DEBE mostrar tarjetas de navegación para: Productos, Empleados, Terminales, Promociones, Estaciones, Configuración, Reportes
2. EL Panel_Admin DEBE mostrar métricas: ventas del día, órdenes activas, terminales online
3. EL Panel_Admin DEBE mostrar alertas: descuadres de caja, terminales offline, productos agotados
4. EL Panel_Admin DEBE actualizar métricas cada 60 segundos

### Requisito 3: Gestión de Productos

**Historia de Usuario:** Como administrador, quiero gestionar el catálogo de productos.

#### Criterios de Aceptación

1. EL Panel_Admin DEBE mostrar lista de productos con búsqueda y filtro por categoría/estación/estado
2. CUANDO un usuario crea un producto ENTONCES EL Panel_Admin DEBE requerir: nombre, SKU, precio_centavos, categoría, estación
3. CUANDO un usuario edita un producto ENTONCES EL Panel_Admin DEBE incrementar catalog_version
4. EL Panel_Admin DEBE almacenar precios en centavos (entero)

### Requisito 4: Gestión de Empleados

**Historia de Usuario:** Como administrador, quiero gestionar empleados y su acceso al sistema.

#### Criterios de Aceptación

1. EL Panel_Admin DEBE mostrar empleados con nombre, rol, zona y estado
2. CUANDO un usuario crea un empleado ENTONCES EL Panel_Admin DEBE requerir: nombre, PIN (4-6 dígitos), rol
3. CUANDO un usuario edita el PIN ENTONCES EL Panel_Admin DEBE validar unicidad dentro del tenant
4. SI un usuario intenta eliminar el último OWNER o ADMIN ENTONCES EL Panel_Admin DEBE prevenir la eliminación

### Requisito 5: Gestión de Terminales

**Historia de Usuario:** Como administrador, quiero controlar qué dispositivos acceden al sistema.

#### Criterios de Aceptación

1. EL Panel_Admin DEBE mostrar terminales con: terminal_id, tipo, rango_números, last_seen_at, estado
2. CUANDO un usuario genera un código de activación ENTONCES EL Panel_Admin DEBE crear código de 12 caracteres válido por 24 horas
3. CUANDO un usuario revoca un terminal ENTONCES EL Panel_Admin DEBE invalidar todas las sesiones
4. EL Panel_Admin DEBE asignar rangos de números automáticamente

### Requisito 6: Gestión de Promociones

**Historia de Usuario:** Como administrador, quiero crear y gestionar promociones.

#### Criterios de Aceptación

1. EL Panel_Admin DEBE mostrar promociones con nombre, tipo, valor, estado y fechas
2. CUANDO un usuario crea una promoción ENTONCES EL Panel_Admin DEBE requerir: nombre, tipo, valor, starts_at, ends_at
3. CUANDO una promoción expira ENTONCES EL Panel_Admin DEBE desactivarla automáticamente

### Requisito 7: Configuración de Estaciones KDS

**Historia de Usuario:** Como administrador, quiero configurar las estaciones de cocina.

#### Criterios de Aceptación

1. EL Panel_Admin DEBE mostrar estaciones con código, nombre, color y productos asignados
2. EL Panel_Admin DEBE soportar estaciones: PARRILLA, COCINA, BAR, HORNO, POSTRES, EMPAQUE
3. CUANDO un usuario asigna productos a una estación ENTONCES EL Panel_Admin DEBE actualizar el campo station del producto

### Requisito 8: Configuración del Negocio

**Historia de Usuario:** Como administrador, quiero configurar los datos del negocio.

#### Criterios de Aceptación

1. EL Panel_Admin DEBE permitir editar: legal_name, ruc, business_name, address, logo_url, timezone
2. EL Panel_Admin DEBE validar formato de RUC (11 dígitos)
3. EL Panel_Admin DEBE restringir configuración fiscal solo al rol OWNER

### Requisito 9: Reportes de Ventas

**Historia de Usuario:** Como administrador, quiero ver reportes de ventas del negocio.

#### Criterios de Aceptación

1. EL Panel_Admin DEBE mostrar reportes: diario, semanal, mensual
2. EL Panel_Admin DEBE mostrar: ventas_netas, descuentos, propinas, cantidad_órdenes
3. EL Panel_Admin DEBE mostrar desglose por método de pago (CASH, YAPE, PLIN, CARD)
4. CUANDO un usuario hace clic en "Exportar" ENTONCES EL Panel_Admin DEBE generar archivo Excel/CSV

### Requisito 10: Responsive y Touch-Friendly

**Historia de Usuario:** Como administrador, quiero usar el panel en tablets.

#### Criterios de Aceptación

1. EL Panel_Admin DEBE ser responsive para tablet y desktop
2. EL Panel_Admin DEBE tener botones con targets mínimos de 44x44px
3. CUANDO está en viewport móvil ENTONCES EL Panel_Admin DEBE colapsar navegación a menú hamburguesa
