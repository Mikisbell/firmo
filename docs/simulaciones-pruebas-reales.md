# Simulaciones de Pruebas Reales - PARK POS

> Escenarios reales de uso para validar funcionalidad del POS de pollerías.
> Basado en la arquitectura event-sourced del proyecto.

---

## 🎯 Flujo Crítico 1: Venta Completa con Cambio de Estado

**Escenario:** Cliente llega, hace pedido en mesa, paga con tarjeta, se emite factura electrónica.

### Paso a Paso:

```
1. MESERO se autentica en terminal (PIN 4 dígitos)
2. MESERO abre mesa #12 (capacidad: 6 personas)
3. MESERO toma pedido:
   - 1x Pollo a la brasa entero + papas + ensalada
   - 2x Gaseosa 500ml
   - 1x Inca Kola 1.5L
   → Subtotal: S/. 85.00
   → IGV (18%): S/. 15.30
   → Total: S/. 100.30

4. MESERO envía pedido a cocina (estado: PENDIENTE → EN_PREPARACION)
5. COCINA recibe en KDS, marca como listo (estado: EN_PREPARACION → LISTO_PARA_SERVIR)
6. MESERO sirve, cierra mesa (estado: LISTO_PARA_SERVIR → ENTREGADO)
7. CLIENTE paga con tarjeta VISA S/. 100.30
8. SISTEMA genera factura electrónica (SUNAT)
9. SISTEMA imprime voucher (impresora térmica)
10. MESA queda libre para siguiente cliente
```

### Eventos Generados:
- `SHIFT_OPENED` (apertura de caja)
- `TABLE_OPENED` (mesa abierta)
- `ORDER_CREATED` (orden creada)
- `ORDER_ITEMS_ADDED` (items agregados)
- `ORDER_SENT_TO_KITCHEN` (enviado a cocina)
- `ORDER_STATUS_CHANGED` (PENDIENTE → EN_PREPARACION)
- `ORDER_STATUS_CHANGED` (EN_PREPARACION → LISTO_PARA_SERVIR)
- `TABLE_CLOSED` (mesa cerrada)
- `PAYMENT_PROCESSED` (pago con tarjeta)
- `SALE_COMPLETED` (venta completada)
- `INVOICE_GENERATED` (factura electrónica SUNAT)
- `INVENTORY_DECREASED` (stock actualizado: papas, pollo, gaseosas)

### Validaciones:
- ✅ Dinero en centavos: `10030` centavos = S/. 100.30
- ✅ IGV calculado correctamente: `1530` centavos
- ✅ Factura enviada a SUNAT con XML válido
- ✅ Stock decrementado en kardex
- ✅ Mesa liberada para nuevo uso

---

## 💰 Flujo Crítico 2: Apertura y Cierre de Caja con Reporte Z

**Escenario:** Cajero abre caja, procesa ventas del día, cierra caja con reporte Z.

### Paso a Paso:

```
1. CAJERO inicia sesión (usuario + contraseña)
2. CAJERO abre turno de caja:
   → Monto inicial: S/. 200.00 (billetes contados)
   → Billetes: 2x100 + 4x20 + 2x5 + 10x1 + monedas S/. 10

3. Durante el día:
   → 15 ventas procesadas (mixto: efectivo + tarjetas)
   → 2 ventas en efectivo: S/. 45.00 + S/. 67.50
   → 13 ventas con tarjeta: S/. 890.00 total

4. CAJERO cierra turno:
   → Dinero en caja: S/. 200.00 (inicial) + S/. 112.50 (ventas) = S/. 312.50
   → Billetes contados: S/. 315.00
   → Diferencia: +S/. 2.50 (sobrante)

5. SISTEMA genera Reporte Z:
   → Total ventas: S/. 1,002.50
   → Ventas efectivo: S/. 112.50 (11.2%)
   → Ventas tarjeta: S/. 890.00 (88.8%)
   → IGV total: S/. 152.97
   → Diferencia caja: +S/. 2.50
```

### Eventos Generados:
- `SHIFT_OPENED` (caja abierta)
- `CASH_OPENING_REGISTERED` (monto inicial)
- `SALE_COMPLETED` x15 (ventas del día)
- `PAYMENT_PROCESSED` x15 (pagos)
- `SHIFT_CLOSING_INITIATED` (inicio de cierre)
- `Z_REPORT_GENERATED` (reporte Z)
- `SHIFT_CLOSED` (caja cerrada)

### Validaciones:
- ✅ Monto inicial en centavos: `20000`
- ✅ Total ventas: `100250` centavos
- ✅ Diferencia documentada en evento `CASH_DIFFERENCE_RECORDED`
- ✅ Reporte Z almacenado como proyección
- ✅ Todos los pagos conciliados

---

## 📦 Flujo Crítico 3: Control de Inventario con FEFО

**Escenario:** Recepción de mercadería, uso en ventas, alertas de stock mínimo.

### Paso a Paso:

```
1. RECEPCIÓN: Llega proveedor con:
   → 50 pollos enteros (Lote: P-2026-0409, Vencimiento: 2026-04-15)
   → 100kg papas (Lote: PAP-2026-0409, Vencimiento: 2026-04-20)
   → 200 gaseosas 500ml (Lote: GASEOSA-2026-04, Vencimiento: 2027-01-01)

2. SISTEMA registra ingreso (FEFO - First Expired First Out):
   → Pollos: 50 unidades, vence 2026-04-15 (prioridad ALTA)
   → Papas: 100kg, vence 2026-04-20 (prioridad MEDIA)
   → Gaseosas: 200 unidades, vence 2027-01-01 (prioridad BAJA)

3. VENTAS del día consumen:
   → 15 pollos (quedan 35)
   → 22.5kg papas (quedan 77.5kg)
   → 45 gaseosas (quedan 155)

4. ALERTA: Stock bajo detectado:
   → Pollos: 35 restantes (mínimo: 20) ✅ OK
   → Papas: 77.5kg restantes (mínimo: 80kg) ⚠️ BAJO STOCK

5. SISTEMA genera alerta automática al gerente
```

### Eventos Generados:
- `INVENTORY_RECEIPT_CREATED` (recepción mercadería)
- `INVENTORY_RECEIVED` x3 (pollos, papas, gaseosas)
- `INVENTORY_DECREASED` x3 (consumo en ventas)
- `STOCK_LOW_ALERT_TRIGGERED` (alerta papas)
- `INVENTORY_COUNT_RECORDED` (conteo actual)

### Validaciones:
- ✅ FEFО aplicado: lotes con menor fecha de vencimiento primero
- ✅ Kardex actualizado con costos en centavos
- ✅ Alerta generada cuando `stock_actual < stock_minimo`
- ✅ Histórico de lotes consultable por fecha de vencimiento

---

## 👨‍🍳 Flujo Crítico 4: Cocina KDS con Priorización

**Escenario:** Cocina recibe múltiples pedidos simultáneos, los prioriza por antigüedad y tipo.

### Paso a Paso:

```
1. COCINA abre KDS (Kitchen Display System):
   → 3 pedidos pendientes:
     - Pedido #101: Mesa 5 (hace 15 min) - POLLO ENTERO x2
     - Pedido #102: Mesa 12 (hace 8 min) - 1/2 POLLO + MENESTRA
     - Pedido #103: Para llevar (hace 2 min) - POLLO ENTERO x1

2. COCINA prioriza automáticamente:
   → #101: PRIORIDAD ALTA (más antiguo)
   → #102: PRIORIDAD MEDIA
   → #103: PRIORIDAD BAJA (para llevar, más reciente)

3. COCINA empieza #101:
   → Estado: PENDIENTE → EN_PREPARACION
   → Tiempo inicio: 12:45

4. COCINA termina #101:
   → Estado: EN_PREPARACION → LISTO_PARA_SERVIR
   → Tiempo fin: 13:10 (25 min)
   → MESERO notificado

5. COCINA repite para #102 y #103
```

### Eventos Generados:
- `ORDER_RECEIVED_IN_KITCHEN` x3
- `KITCHEN_ORDER_PRIORITIZED` (reordenamiento)
- `ORDER_STATUS_CHANGED` x6 (3 pedidos x 2 transiciones)
- `ORDER_READY_FOR_PICKUP` x2 (mesa 5 y 12)
- `ORDER_DELIVERED` x3 (entregados)
- `KITCHEN_METRICS_RECORDED` (tiempos de preparación)

### Validaciones:
- ✅ Priorización por antigüedad + tipo (mesa vs llevar)
- ✅ Tiempos de preparación registrados por pedido
- ✅ Métricas de cocina actualizadas (tiempo promedio: 25 min)
- ✅ MESERO notificado vía SSE cuando pedido está listo

---

## 🧑‍💼 Flujo Crítico 5: Gestión de Empleados con Roles y Permisos

**Escenario:** Administrador crea empleado, asigna rol, empleado accede con PIN.

### Paso a Paso:

```
1. ADMIN navega a: Admin → Empleados → Nuevo
2. ADMIN crea empleado:
   → Nombre: "Juan Pérez"
   → DNI: "72345678"
   → Teléfono: "987654321"
   → Rol: CAJERO
   → PIN: 1234 (generado automáticamente)

3. SISTEMA envía credenciales por SMS
4. EMPLEADO "Juan Pérez" inicia sesión:
   → Ingresa PIN: 1234
   → Autenticación exitosa
   → Redirigido a POS (solo permisos de CAJERO)

5. CAJERO procesa venta:
   → Puede: abrir caja, procesar pagos, ver reporte del día
   → NO puede: anular ventas, acceder a costos, ver otros empleados

6. ADMIN modifica permisos:
   → Agrega permiso: "anular_ventas_hasta_S/.50"
   → CAJERO ahora puede anular ventas menores a S/. 50 sin supervisión
```

### Eventos Generados:
- `EMPLOYEE_CREATED` (empleado creado)
- `ROLE_ASSIGNED` (rol CAJERO asignado)
- `PIN_GENERATED` (PIN generado)
- `EMPLOYEE_LOGIN` (inicio de sesión)
- `PERMISSION_MODIFIED` (permiso agregado)
- `SALE_PROCESSED` xN (ventas del cajero)

### Validaciones:
- ✅ PIN único dentro del tenant (no se repite)
- ✅ Rol restringe acceso a rutas (RBAC)
- ✅ Permiso customizado permite anulación hasta límite
- ✅ SMS enviado con credenciales (Twilio)
- ✅ Log de auditoría registra todos los cambios

---

## 🧾 Flujo Crítico 6: Facturación Electrónica SUNAT con Contingencia

**Escenario:** Sistema emite factura electrónica, SUNAT responde con error, activa modo contingencia.

### Paso a Paso:

```
1. VENTA completada: S/. 150.00
2. SISTEMA genera comprobante:
   → Tipo: Factura Electrónica
   → RUC cliente: 20123456789
   → Razón social: "EMPRESA SAC"
   → XML firmado generado

3. SISTEMA envía a SUNAT (API REST):
   → Timeout después de 30s
   → Error de conexión

4. SISTEMA activa MODO CONTINGENCIA:
   → Genera CDR (Constancia de Recepción) temporal
   → Almacena comprobante en cola de reintento
   → Imprime comprobante con leyenda: "En contingencia"

5. CRON job reintenta cada 5 min:
   → Intento 1 (5 min): FALLA
   → Intento 2 (10 min): FALLA
   → Intento 3 (15 min): ÉXITO ✅
   → SUNAT devuelve CDR oficial

6. SISTEMA actualiza estado:
   → Factura: EN_CONTINGENCIA → ACEPTADO
   → Notifica al cliente por email
```

### Eventos Generados:
- `INVOICE_GENERATION_REQUESTED` (solicitud de factura)
- `INVOICE_SENT_TO_SUNAT` (envío inicial)
- `INVOICE_CONTINGENCY_ACTIVATED` (modo contingencia)
- `INVOICE_RETRIED` x3 (reintentos)
- `INVOICE_ACCEPTED_BY_SUNAT` (aceptada)
- `INVOICE_CONTINGENCY_RESOLVED` (contingencia resuelta)
- `CUSTOMER_NOTIFIED` (notificación email)

### Validaciones:
- ✅ XML firmado correctamente antes de enviar
- ✅ Contingencia activada automáticamente tras timeout
- ✅ Reintentos automáticos con backoff exponencial
- ✅ CDR oficial almacenado tras aceptación
- ✅ Estado de factura actualizado en base de datos
- ✅ Cliente notificado cuando factura es aceptada

---

## 🚨 Flujo Crítico 7: Offline → Sync con Resolución de Conflictos

**Escenario:** Terminal POS pierde conexión, sigue vendiendo, reconecta y sincroniza.

### Paso a Paso:

```
1. POS ONLINE: Terminal sincronizando normalmente
2. CONEXIÓN SE PIERDE (WiFi cae):
   → Sistema detecta offline tras 3 intentos fallidos
   → Activa modo OFFLINE (Dexie/IndexedDB)

3. CAJERO sigue vendiendo offline:
   → Venta #201: S/. 45.00 (efectivo)
   → Venta #202: S/. 67.50 (tarjeta)
   → Venta #203: S/. 30.00 (efectivo)
   → Todas almacenadas en Dexie local

4. CONEXIÓN RESTAURADA (WiFi vuelve):
   → SyncClient detecta conexión
   → Inicia sync de eventos pendientes: 3 ventas

5. CONFLICTO DETECTADO:
   → Venta #202 (tarjeta) ya fue procesada en otro terminal
   → Resolución: REJECT (política: pagos conflictivos = REJECT)
   → Venta #202 marcada como DUPLICADA

6. SYNC COMPLETADO:
   → Venta #201: ACCEPTED ✅
   → Venta #202: REJECTED (duplicada) ⚠️
   → Venta #203: ACCEPTED ✅
   → Notificación al cajero: "1 venta duplicada detectada"
```

### Eventos Generados:
- `CONNECTION_LOST` (conexión perdida)
- `OFFLINE_MODE_ACTIVATED` (modo offline)
- `SALE_COMPLETED` x3 (ventas offline)
- `CONNECTION_RESTORED` (conexión restaurada)
- `SYNC_STARTED` (sync iniciado)
- `EVENT_ACCEPTED` x2 (ventas 201 y 203)
- `EVENT_REJECTED` x1 (venta 202 duplicada)
- `SYNC_COMPLETED` (sync finalizado)

### Validaciones:
- ✅ Modo offline activado automáticamente
- ✅ Ventas almacenadas en Dexie con estructura idéntica
- ✅ Conflictos resueltos con política REJECT
- ✅ Sync idempotente (no duplica aceptadas)
- ✅ Cajero notificado de venta rechazada

---

## 📊 Flujo Crítico 8: Dashboard de Rentabilidad en Tiempo Real

**Escenario:** Gerente revisa rentabilidad del día, ve gráficos de ventas vs costos.

### Paso a Paso:

```
1. GERENTE inicia sesión (rol: ADMIN)
2. Navega a: Dashboard → Rentabilidad
3. SISTEMA calcula en tiempo real:
   → Ventas del día: S/. 2,450.00
   → Costo mercadería: S/. 980.00 (40%)
   → Margen bruto: S/. 1,470.00 (60%)
   → IGV: S/. 373.73
   → Ganancia neta estimada: S/. 1,096.27

4. GRÁFICOS mostrados:
   → Ventas por hora (barras)
   → Productos más vendidos (ranking)
   → Comparativa con día anterior (líneas)
   → Margen por categoría de producto (pie)

5. DRILL-DOWN:
   → Gerente clic en "Pollo a la brasa"
   → Detalle: 45 vendidos, costo unit S/. 18.00, venta S/. 35.00
   → Margen unitario: S/. 17.00 (48.6%)
```

### Eventos Generados:
- `DASHBOARD_ACCESSED` (dashboard visitado)
- `PROFITABILITY_CALCULATED` (cálculo ejecutado)
- `SALES_AGGREGATED_BY_HOUR` (agregación por hora)
- `TOP_PRODUCTS_CALCULATED` (productos más vendidos)
- `MARGIN_BY_CATEGORY_CALCULATED` (márgenes)

### Validaciones:
- ✅ Todos los montos en centavos internamente
- ✅ Cálculos basados en proyecciones de eventos (no queries directas)
- ✅ Datos actualizados en tiempo real vía SSE
- ✅ Gráficos renderizados con Recharts
- ✅ Drill-down muestra detalle con trazabilidad completa

---

## 🔐 Flujo Crítico 9: Provisionamiento Multi-Tenant

**Escenario:** Nueva pollería se registra, sistema provisiona todo automáticamente.

### Paso a Paso:

```
1. NUEVO CLIENTE accede a: park-pos.com/signup
2. Completa formulario:
   → Razón social: "Pollería El Buen Sabor SAC"
   → RUC: 20601234567
   → Email: "admin@elbuensabor.pe"
   → Teléfono: "987123456"
   → Plan: EMPRESARIAL (S/. 299/mes)

3. SISTEMA provisiona automáticamente:
   ✅ Crea tenant_id: "tenant_elbuenSabor_2026"
   ✅ Configuración de base de datos (RLS activado)
   ✅ Roles por defecto (OWNER asignado al creador)
   ✅ Terminal POS inicial (1 terminal)
   ✅ Catálogo base (productos de pollería)
   ✅ Configuración SUNAT (RUC vinculado)
   ✅ Integraciones externas (PedidosYa, LlamaFood)

4. SISTEMA envía email de bienvenida:
   → Credenciales de OWNER
   → Link de activación
   → Guía de configuración inicial

5. OWNER inicia sesión por primera vez:
   → Wizard de configuración:
     - Agregar empleados
     - Configurar mesas
     - Definir menú y precios
     - Configurar impresora
```

### Eventos Generados:
- `TENANT_PROVISIONED` (tenant creado)
- `DATABASE_INITIALIZED` (tablas con RLS)
- `DEFAULT_ROLES_CREATED` (roles por defecto)
- `FIRST_TERMINAL_CREATED` (terminal inicial)
- `CATALOG_INITIALIZED` (catálogo base)
- `WELCOME_EMAIL_SENT` (email enviado)
- `OWNER_FIRST_LOGIN` (primer login)

### Validaciones:
- ✅ Tenant ID único generado automáticamente
- ✅ RLS activado en 7 tablas sensibles
- ✅ OWNER tiene todos los permisos (ADMIN_ROLES)
- ✅ Catálogo inicial con productos de pollería
- ✅ Email enviado con enlaces de activación
- ✅ Aislamiento total de datos entre tenants

---

## ⚡ Flujo Crítico 10: Alta Concurrencia en Hora Punta

**Escenario:** Viernes 8pm, 5 terminales procesando ventas simultáneamente.

### Paso a Paso:

```
1. ESCENARIO: Viernes 8:00 PM (hora punta)
   → 5 terminales POS activos
   → 3 meseros tomando pedidos
   → 2 cajeros procesando pagos
   → Cocina con 12 pedidos pendientes

2. SIMULACIÓN de carga:
   → Terminal 1: Venta S/. 85.00 (mesa 3)
   → Terminal 2: Venta S/. 45.00 (mesa 8)
   → Terminal 3: Venta S/. 120.00 (mesa 15)
   → Terminal 4: Venta S/. 67.50 (para llevar)
   → Terminal 5: Venta S/. 95.00 (mesa 1)
   → TODAS simultáneas (misma fracción de segundo)

3. SISTEMA maneja concurrencia:
   → Redis locks previenen doble cobro
   → Event store recibe 5 eventos en paralelo
   → Cada venta recibe ID único
   → Proyecciones actualizadas secuencialmente

4. RESULTADO:
   → 5 ventas procesadas sin conflictos
   → 5 inventarios actualizados
   → 5 facturas generadas
   → 0 errores de concurrencia
   → Latencia promedio: 450ms
```

### Eventos Generados:
- `SALE_COMPLETED` x5 (simultáneas)
- `INVENTORY_DECREASED` x15 (5 ventas x 3 items promedio)
- `INVOICE_GENERATED` x5 (facturas electrónicas)
- `CONCURRENCY_METRICS_RECORDED` (métricas de concurrencia)

### Validaciones:
- ✅ Redis locks previenen race conditions
- ✅ Event ingestion con deduplicación
- ✅ Cada venta tiene ID único (ULID)
- ✅ Proyecciones actualizadas sin conflictos
- ✅ Métricas de latencia dentro de SLA (< 500ms)
- ✅ Cocina recibe todos los pedidos sin pérdida

---

## 📋 Checklist de Validación General

Para cada simulación, verificar:

### 💰 Dinero
- [ ] Todos los montos en centavos (enteros)
- [ ] Cálculos de IGV correctos (18%)
- [ ] Conciliación de caja exacta
- [ ] Diferencias documentadas

### 🔐 Seguridad
- [ ] `tenant_id` siempre de JWT, nunca del cliente
- [ ] Auth requerida en todas las rutas API
- [ ] Roles verificados con `ADMIN_ROLES.includes()`
- [ ] PINs no logueados
- [ ] Datos sensibles encriptados

### 🗄️ Base de Datos
- [ ] PrismaClient singleton (nunca `new PrismaClient()`)
- [ ] Try/catch en todas las queries
- [ ] Cleanup con `tenant_id` en tests
- [ ] RLS activado en tablas sensibles

### 📡 Eventos
- [ ] Tipos de evento válidos (73 tipos)
- [ ] Deduplicación en ingest
- [ ] Reducer retorna `{ state, warnings }`
- [ ] No throw en reducers

### 🖥️ UI/UX
- [ ] Sin stubs/placeholders en producción
- [ ] IDs reales (no `loc-default`, `shift-default`)
- [ ] Datos reales de SWR hooks
- [ ] Manejo de errores visual

### 🧪 Testing
- [ ] Fechas dinámicas en tests
- [ ] Mocks definidos a nivel de módulo
- [ ] `vi.hoisted()` para referencias a `vi.fn()`
- [ ] Cleanup en `afterAll`

---

## 🎯 Priorización de Implementación

| Prioridad | Flujo | Complejidad | Impacto |
|-----------|-------|-------------|---------|
| P0 | #1: Venta Completa | ALTA | CRÍTICO |
| P0 | #7: Offline → Sync | ALTA | CRÍTICO |
| P1 | #2: Apertura/Cierre Caja | MEDIA | ALTO |
| P1 | #6: Facturación SUNAT | ALTA | ALTO |
| P2 | #3: Inventario FEFО | MEDIA | MEDIO |
| P2 | #4: Cocina KDS | MEDIA | MEDIO |
| P3 | #5: Gestión Empleados | BAJA | BAJO |
| P3 | #8: Dashboard Rentabilidad | BAJA | BAJO |
| P4 | #9: Multi-Tenant | ALTA | FUTURO |
| P4 | #10: Alta Concurrencia | ALTA | FUTURO |

---

**Nota:** Estas simulaciones están basadas en la arquitectura real del proyecto PARK POS y pueden usarse como:
- 📝 Documentación de casos de uso
- 🧪 Guía para escribir tests E2E
- 🎯 Plan de validación en producción
- 📊 Métricas de cobertura funcional
