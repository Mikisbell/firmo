# Requirements Document

## Introduction

UI completa para gestión de inventario en PARK POS (2026). Sistema diseñado con arquitectura Event Sourcing y características enterprise-level para garantizar:
- **Cero pérdida de datos**: Cada movimiento es un evento inmutable con trazabilidad completa
- **Velocidad**: Optimistic UI con sincronización en background, respuesta < 100ms
- **Seguridad financiera**: Validación doble (cliente + servidor), costos siempre en centavos (int)
- **Offline-first**: Funciona sin conexión, sincroniza cuando hay red
- **Auditoría completa**: Quién, cuándo, qué, por qué - para cada movimiento
- **FEFO (First Expired, First Out)**: Control de vencimientos para perecederos (pollo, etc.)
- **Alertas inteligentes**: Notificaciones proactivas de stock bajo, vencimientos, y anomalías
- **Trazabilidad por lote**: Seguimiento completo desde proveedor hasta venta

Stack: Next.js 15 + React Server Components + Prisma + IndexedDB (Dexie) + Tailwind

### Características Enterprise 2026 (Basado en investigación HashMicro/industria)
- Visibilidad en tiempo real de movimientos
- Tracking por lote y fecha de vencimiento
- Alertas proactivas de reposición
- Soporte para escaneo de códigos de barras/QR
- Integración con ventas para deducción automática

## Glossary

- **Inventory_UI**: Interfaz de usuario para gestión de inventario en `/admin/inventario`
- **Stock_View**: Vista principal que muestra todos los insumos con su stock actual
- **Kardex**: Historial completo de movimientos de un insumo específico
- **Goods_Receipt**: Registro de entrada de mercadería (recepción de proveedor)
- **Waste_Log**: Registro de merma (pérdida por vencimiento, daño, robo, etc.)
- **Inventory_Item**: Un insumo en el sistema (pollo, papa, aceite, etc.)
- **Movement**: Un movimiento de inventario (entrada, salida, ajuste, merma)
- **FEFO**: First Expired, First Out - método de rotación que prioriza productos por fecha de vencimiento
- **Lot/Lote**: Grupo de productos recibidos juntos con misma fecha de vencimiento y proveedor
- **COGS**: Cost of Goods Sold - costo de los productos vendidos (calculado por costo promedio ponderado)
- **Stock_Alert**: Notificación automática de stock bajo, vencimiento próximo, o anomalía
- **Barcode_Scanner**: Dispositivo USB que lee códigos de barras (emulación de teclado)

## Requirements

### Requirement 1: Vista Principal de Stock

**User Story:** Como administrador, quiero ver el stock actual de todos los insumos en una sola pantalla, para identificar rápidamente qué necesito reponer.

#### Acceptance Criteria

1. WHEN el usuario accede a `/admin/inventario` y se autentica, THE Inventory_UI SHALL mostrar una lista de todos los insumos con código, nombre, stock actual, stock mínimo y estado (OK/Bajo/Crítico)
2. WHEN el stock de un insumo está por debajo del mínimo, THE Stock_View SHALL mostrar indicador visual rojo (🔴) junto al insumo
3. WHEN el stock está entre el mínimo y 1.5x el mínimo, THE Stock_View SHALL mostrar indicador amarillo (🟡)
4. THE Stock_View SHALL mostrar un resumen en la parte superior con: cantidad de items en stock bajo, cantidad por vencer, y valor total del inventario en soles
5. WHEN el usuario escribe en el campo de búsqueda, THE Stock_View SHALL filtrar los insumos por código o nombre en tiempo real
6. THE Stock_View SHALL mostrar los últimos 10 movimientos de inventario en la parte inferior de la pantalla

### Requirement 2: Registro de Entrada de Mercadería

**User Story:** Como administrador, quiero registrar la entrada de mercadería cuando llega el proveedor, para mantener el stock actualizado con trazabilidad completa y sin pérdida de información.

#### Acceptance Criteria

1. WHEN el usuario hace clic en el botón [+] de un insumo, THE Inventory_UI SHALL mostrar un modal de entrada con campos: cantidad, proveedor (selector), número de factura, lote, fecha de vencimiento, costo unitario (centavos), y notas
2. WHEN el usuario confirma la entrada, THE Inventory_UI SHALL generar un evento `GOODS_RECEIVED` inmutable que se persiste en `event_store`
3. THE Inventory_UI SHALL usar Optimistic UI: actualizar la vista inmediatamente y sincronizar en background
4. IF el usuario no ingresa cantidad o la cantidad es <= 0, THEN THE Inventory_UI SHALL mostrar error de validación y no permitir guardar
5. THE Inventory_UI SHALL validar en servidor que el costo esté en centavos (entero) y sea >= 0
6. WHEN la entrada se guarda, THE Inventory_UI SHALL registrar: actor_id, timestamp, terminal_id, IP para auditoría completa
7. IF hay error de red, THEN THE Inventory_UI SHALL guardar en IndexedDB y reintentar automáticamente cuando haya conexión

### Requirement 3: Registro de Merma

**User Story:** Como administrador, quiero registrar mermas (pérdidas) de inventario con su motivo y evidencia, para tener control total de las pérdidas, prevenir robos, y cumplir con auditorías.

#### Acceptance Criteria

1. WHEN el usuario hace clic en el botón [-] de un insumo, THE Inventory_UI SHALL mostrar un modal de merma con campos: cantidad, motivo (EXPIRED/DAMAGED/THEFT/PRODUCTION_LOSS/COUNT_ADJUSTMENT/OTHER), detalle obligatorio si motivo es THEFT u OTHER, y foto (obligatoria si monto > S/50)
2. WHEN el usuario confirma la merma, THE Inventory_UI SHALL generar un evento `WASTE_RECORDED` inmutable
3. THE Inventory_UI SHALL calcular automáticamente el costo de la merma usando costo promedio ponderado del insumo
4. IF la cantidad de merma es mayor al stock disponible, THEN THE Inventory_UI SHALL mostrar advertencia y requerir confirmación adicional (doble click o PIN)
5. THE Inventory_UI SHALL registrar: actor_id, timestamp, terminal_id, IP, y foto_url para auditoría
6. WHEN el motivo es THEFT, THE Inventory_UI SHALL marcar el registro para revisión de administrador
7. THE Inventory_UI SHALL mostrar el costo total de la merma antes de confirmar (ej: "Pérdida: S/ 125.00")

### Requirement 4: Kardex por Insumo

**User Story:** Como administrador, quiero ver el historial completo de movimientos de un insumo específico, para auditar y entender las variaciones de stock.

#### Acceptance Criteria

1. WHEN el usuario hace clic en el botón [📋] de un insumo, THE Inventory_UI SHALL mostrar un modal con el kardex completo del insumo
2. THE Kardex SHALL mostrar cada movimiento con: fecha/hora, tipo (IN/OUT/ADJUST/WASTE), cantidad (+/-), saldo resultante, referencia (orden, recepción, etc.), actor (quién lo hizo), y notas
3. THE Kardex SHALL ordenar los movimientos del más reciente al más antiguo
4. WHEN el kardex tiene más de 50 movimientos, THE Inventory_UI SHALL paginar los resultados
5. THE Kardex SHALL permitir filtrar por rango de fechas y por tipo de movimiento
6. THE Kardex SHALL mostrar un resumen con: total entradas, total salidas, total mermas del período seleccionado

### Requirement 5: APIs de Inventario (Seguras y Rápidas)

**User Story:** Como desarrollador, quiero APIs REST seguras y optimizadas para consultar y modificar el inventario, garantizando integridad de datos y rendimiento.

#### Acceptance Criteria

1. THE API `/api/inventory/stock` SHALL retornar la lista de insumos con stock actual, mínimo, costo_cents, y estado en < 200ms
2. THE API `/api/inventory/stock` SHALL soportar parámetros: `search`, `low_stock_only`, `location_id` con índices optimizados
3. THE API `/api/inventory/receive` SHALL validar: cantidad > 0, costo_cents es entero >= 0, actor_id existe, antes de crear el evento
4. THE API `/api/inventory/waste` SHALL validar: cantidad > 0, reason_code válido, actor_id existe, y calcular costo automáticamente
5. THE API `/api/inventory/kardex/:code` SHALL retornar historial paginado con saldo calculado para cada movimiento
6. THE API `/api/inventory/kardex/:code` SHALL usar índice compuesto (tenant_id, inventory_code, created_at DESC) para queries rápidas
7. THE API `/api/inventory/stats` SHALL usar cache de 30 segundos para estadísticas agregadas
8. ALL APIs SHALL requerir autenticación JWT válida y verificar rol (ADMIN o MANAGER)
9. ALL APIs SHALL registrar en audit log: endpoint, actor, timestamp, IP, payload (sin datos sensibles)

### Requirement 6: Historial General

**User Story:** Como administrador, quiero ver los últimos movimientos de inventario de todos los insumos, para tener visibilidad de la actividad reciente.

#### Acceptance Criteria

1. THE Stock_View SHALL mostrar una sección "Últimos Movimientos" con los 10 movimientos más recientes de cualquier insumo
2. WHEN el usuario hace clic en un movimiento del historial, THE Inventory_UI SHALL resaltar el insumo correspondiente en la lista
3. THE historial SHALL mostrar: hora, icono de tipo (📥 entrada, 📤 salida, 🗑️ merma, ⚖️ ajuste), insumo, cantidad, y actor
4. THE historial SHALL actualizarse automáticamente cuando se registra un nuevo movimiento


### Requirement 7: Seguridad Financiera y Auditoría

**User Story:** Como dueño del negocio, quiero que cada movimiento de inventario sea rastreable y no se pueda manipular, para prevenir pérdidas y fraudes.

#### Acceptance Criteria

1. THE Inventory_UI SHALL usar Event Sourcing: cada movimiento genera un evento inmutable que nunca se elimina
2. ALL eventos SHALL incluir: event_id (UUID), timestamp (UTC), actor_id, terminal_id, tenant_id, payload_version
3. THE sistema SHALL usar deduplicación de eventos para prevenir duplicados por retry de red
4. THE Inventory_UI SHALL mostrar quién hizo cada movimiento (nombre del empleado) en el kardex
5. IF un movimiento necesita corrección, THE sistema SHALL crear un evento de ajuste (nunca modificar el original)
6. THE sistema SHALL calcular stock actual como proyección de todos los eventos (rebuild desde eventos)
7. WHEN hay discrepancia entre stock calculado y stock en tabla, THE sistema SHALL generar alerta para auditoría
8. THE Inventory_UI SHALL mostrar timestamp en zona horaria local (America/Lima) pero almacenar en UTC

### Requirement 8: Rendimiento y UX

**User Story:** Como usuario, quiero que la interfaz sea rápida y fluida, para poder trabajar eficientemente durante el turno.

#### Acceptance Criteria

1. THE Stock_View SHALL cargar en < 500ms incluso con 100+ insumos
2. THE Inventory_UI SHALL usar skeleton loaders mientras carga datos
3. THE modales SHALL abrirse en < 100ms (pre-renderizados)
4. THE búsqueda SHALL filtrar en tiempo real sin delay perceptible (debounce 150ms)
5. THE Inventory_UI SHALL funcionar en tablets (responsive, touch-friendly)
6. THE botones de acción [+] [-] [📋] SHALL ser suficientemente grandes para touch (min 44x44px)
7. THE Inventory_UI SHALL mostrar feedback visual inmediato en cada acción (optimistic UI)
8. WHEN hay error, THE Inventory_UI SHALL mostrar mensaje claro en español con acción sugerida

### Requirement 9: Control FEFO (First Expired, First Out) para Perecederos

**User Story:** Como administrador, quiero que el sistema priorice automáticamente los productos por fecha de vencimiento, para minimizar mermas por vencimiento y cumplir con normas sanitarias.

#### Acceptance Criteria

1. WHEN se registra una entrada de mercadería perecedera (pollo, etc.), THE Inventory_UI SHALL requerir fecha de vencimiento y número de lote obligatorios
2. THE Stock_View SHALL mostrar indicador visual de productos próximos a vencer: 🔴 (vence hoy/mañana), 🟠 (vence en 3 días), 🟡 (vence en 7 días)
3. WHEN hay múltiples lotes del mismo producto, THE Kardex SHALL mostrar el desglose por lote con fecha de vencimiento de cada uno
4. THE sistema SHALL generar alerta automática 3 días antes del vencimiento de cualquier lote
5. WHEN se deduce inventario por venta, THE sistema SHALL usar automáticamente el lote con fecha de vencimiento más próxima (FEFO)
6. THE Stock_View SHALL mostrar sección "Por Vencer" con productos que vencen en los próximos 7 días, ordenados por urgencia
7. WHEN un producto vence, THE sistema SHALL sugerir automáticamente registrar merma con motivo "EXPIRED"

### Requirement 10: Alertas Inteligentes y Sugerencias de Reposición

**User Story:** Como administrador, quiero recibir alertas proactivas y sugerencias de reposición basadas en consumo histórico, para nunca quedarme sin stock crítico.

#### Acceptance Criteria

1. THE Stock_View SHALL mostrar panel de alertas activas con prioridad: 🔴 Crítico (stock = 0 o vencido), 🟠 Urgente (stock < mínimo), 🟡 Atención (stock < 1.5x mínimo o por vencer)
2. WHEN el stock de un insumo llega al mínimo, THE sistema SHALL calcular cantidad sugerida de reposición basada en consumo promedio de últimos 7 días
3. THE alerta de stock bajo SHALL mostrar: días estimados de stock restante, cantidad sugerida a pedir, y proveedor preferido
4. WHEN hay múltiples alertas, THE sistema SHALL ordenarlas por impacto financiero (costo × urgencia)
5. THE Inventory_UI SHALL permitir "snooze" de alertas por 1h, 4h, o hasta mañana
6. WHEN se registra una entrada que resuelve una alerta, THE sistema SHALL cerrar automáticamente la alerta correspondiente
7. THE sistema SHALL detectar anomalías: consumo inusualmente alto (>2x promedio) o discrepancia entre stock teórico y real (>5%)

### Requirement 11: Soporte para Escaneo de Códigos

**User Story:** Como almacenero, quiero poder escanear códigos de barras o QR para agilizar el registro de entradas y conteos, reduciendo errores de digitación.

#### Acceptance Criteria

1. THE Inventory_UI SHALL detectar automáticamente entrada de escáner de código de barras (input rápido de caracteres)
2. WHEN se escanea un código en la vista principal, THE sistema SHALL buscar el insumo y abrir el modal de entrada (+) automáticamente
3. WHEN se escanea un código durante un conteo, THE sistema SHALL enfocar el campo de cantidad del insumo correspondiente
4. IF el código escaneado no existe en el sistema, THEN THE Inventory_UI SHALL mostrar opción de crear nuevo insumo con el código pre-llenado
5. THE Inventory_UI SHALL soportar códigos EAN-13, EAN-8, y códigos internos alfanuméricos
6. THE modal de entrada SHALL permitir escanear código de lote del proveedor para trazabilidad
7. THE sistema SHALL funcionar con escáneres USB estándar (emulación de teclado) sin configuración adicional

### Requirement 12: Trazabilidad Completa por Lote

**User Story:** Como administrador, quiero poder rastrear cualquier producto desde su origen (proveedor, factura, lote) hasta su destino (venta, merma), para cumplir con auditorías y resolver reclamos de calidad.

#### Acceptance Criteria

1. WHEN se registra una entrada, THE sistema SHALL asociar: proveedor, número de factura, número de lote, fecha de vencimiento, y costo unitario
2. THE Kardex SHALL mostrar para cada movimiento de entrada: proveedor, factura, lote, y costo
3. THE Kardex SHALL mostrar para cada movimiento de salida: referencia de orden/venta, lote usado, y costo COGS
4. WHEN se registra una merma, THE sistema SHALL requerir selección del lote específico afectado
5. THE Inventory_UI SHALL permitir buscar "¿De dónde vino este lote?" mostrando: proveedor, fecha de recepción, factura, y movimientos posteriores
6. THE Inventory_UI SHALL permitir buscar "¿A dónde fue este lote?" mostrando: ventas, mermas, y stock restante
7. IF hay reclamo de calidad, THE sistema SHALL permitir identificar todas las ventas que usaron un lote específico

### Requirement 13: Conteo Físico de Inventario

**User Story:** Como administrador, quiero realizar conteos físicos periódicos del inventario, para detectar diferencias entre el stock teórico y real, e investigar las causas.

#### Acceptance Criteria

1. WHEN el admin inicia un conteo físico, THE Inventory_UI SHALL mostrar lista de todos los insumos con su stock teórico (sin mostrar el valor para evitar sesgo)
2. THE Inventory_UI SHALL permitir ingresar cantidad contada para cada insumo, con soporte para escaneo de código de barras
3. WHEN se completa el conteo, THE sistema SHALL calcular diferencias: cantidad_contada - stock_teórico para cada insumo
4. IF hay diferencia negativa (faltante), THE sistema SHALL requerir explicación obligatoria con motivo: THEFT/UNREGISTERED_WASTE/COUNT_ERROR/OTHER
5. IF la diferencia representa > S/50 de pérdida, THE sistema SHALL requerir foto de evidencia y PIN de administrador
6. WHEN se aprueba el conteo, THE sistema SHALL generar eventos INVENTORY_ADJUSTED para cada diferencia
7. THE sistema SHALL mantener historial de conteos con: fecha, contador, aprobador, diferencias totales, y costo de varianza
8. THE Inventory_UI SHALL mostrar reporte de varianza: % de diferencia por categoría, tendencia mensual, y items con mayor discrepancia

### Requirement 14: Deducción Automática por Recetas

**User Story:** Como sistema, quiero deducir automáticamente los insumos cuando se vende un producto, para mantener el stock actualizado sin intervención manual.

#### Acceptance Criteria

1. WHEN se confirma el pago de una orden (PAYMENT_COMPLETED), THE sistema SHALL deducir automáticamente los insumos según la receta del producto
2. THE sistema SHALL usar FEFO: deducir primero del lote con fecha de vencimiento más próxima
3. IF un producto tiene variantes (1/4, 1/2, entero), THE sistema SHALL deducir la fracción correcta según la receta de cada variante
4. THE sistema SHALL generar evento INVENTORY_DEDUCTED con: order_id, product_id, lote_usado, cantidad_deducida, nuevo_stock
5. IF el stock de un insumo llega a 0 durante la deducción, THE sistema SHALL generar alerta STOCK_DEPLETED inmediatamente
6. IF no hay suficiente stock para deducir, THE sistema SHALL registrar la deducción parcial y generar alerta de stock negativo
7. WHEN se anula un item de una orden, THE sistema SHALL revertir la deducción (evento INVENTORY_REVERSED)

### Requirement 15: Prevención de Fraude y Robo

**User Story:** Como dueño del negocio, quiero que el sistema tenga controles anti-fraude para prevenir robos y manipulaciones de inventario.

#### Acceptance Criteria

1. WHEN se registra merma con motivo THEFT, THE sistema SHALL requerir: PIN de administrador, foto obligatoria, detalle de circunstancias, y marcar para revisión
2. IF un empleado registra mermas frecuentes (>3 por semana), THE sistema SHALL generar alerta de patrón sospechoso
3. THE sistema SHALL detectar anomalías: consumo >2x promedio semanal, diferencias de conteo >5%, mermas concentradas en un turno
4. WHEN hay anomalía detectada, THE sistema SHALL notificar al administrador con detalle del patrón
5. THE sistema SHALL registrar IP y terminal_id de cada operación para auditoría forense
6. IF se intenta modificar un evento pasado, THE sistema SHALL rechazar la operación (eventos son inmutables)
7. THE Inventory_UI SHALL mostrar dashboard de "Salud del Inventario" con: % de merma vs compras, varianza de conteos, alertas activas
