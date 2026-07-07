# FIRMO POS — Referencia de API

> 316 route handlers organizados por modulo. Todos los endpoints requieren autenticacion salvo los marcados como **Public**.

**Base URL:** `https://{domain}/api`

**Autenticacion:**
- **Admin Auth**: JWT con rol ADMIN/OWNER/MANAGER/SUPERVISOR
- **POS Auth**: JWT con cualquier rol POS
- **Employee Auth**: JWT con cualquier rol autenticado
- **API Secret**: Header `x-api-secret` para integraciones
- **CRON Secret**: Header `authorization: Bearer {CRON_SECRET}`
- **Public**: Sin autenticacion

---

## Auth

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Login con PIN |
| POST | `/auth/login-secure` | Public | Login seguro con device validation |
| POST | `/auth/check-dni` | Public | Verificar DNI del empleado |
| POST | `/auth/confirm-device` | Public | Confirmar dispositivo nuevo |
| GET | `/auth/session` | Employee | Obtener sesion actual |
| POST | `/auth/session` | Employee | Refrescar sesion |
| DELETE | `/auth/session` | Employee | Cerrar sesion |
| POST | `/auth/logout` | Employee | Logout |
| POST | `/auth/validate-session` | Employee | Validar sesion activa |
| POST | `/auth/verify-manager` | POS Auth | Verificar PIN de manager |
| POST | `/auth/register-terminal` | Admin | Registrar terminal |
| POST | `/auth/verify-terminal` | Public | Verificar codigo de terminal |
| GET | `/auth/terminals` | Admin | Listar terminales |

---

## POS (Punto de Venta)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/pos/ready-items` | POS Auth | Items listos para servir |
| POST | `/pos/payments` | POS Auth | Registrar pago |
| GET | `/pos/payments` | POS Auth | Listar pagos |
| POST | `/pos/invoices` | POS Auth | Emitir comprobante |
| POST | `/pos/print` | POS Auth | Enviar a impresora |
| POST | `/pos/z-reports` | POS Auth | Generar Z-Report |
| GET | `/pos/z-reports` | POS Auth | Listar Z-Reports |
| GET | `/pos/shifts` | POS Auth | Obtener turno actual |
| GET | `/pos/tables` | POS Auth | Listar mesas disponibles |
| GET | `/pos/zones` | POS Auth | Listar zonas |
| POST | `/pos/denominations` | POS Auth | Registrar arqueo de caja |
| GET | `/pos/denominations` | POS Auth | Obtener denominaciones |
| POST | `/pos/payment-qr` | POS Auth | Generar QR de pago (Yape/Plin) |
| GET | `/pos/customers/lookup` | POS Auth | Buscar cliente por DNI/RUC |
| GET | `/pos/loyalty/{customerId}` | POS Auth | Puntos de fidelidad del cliente |
| POST | `/pos/loyalty/redeem` | POS Auth | Canjear puntos |

---

## Ordenes

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/orders` | POS Auth | Listar ordenes |
| GET | `/orders/{orderId}/state` | POS Auth | Estado de una orden |
| GET | `/orders/{orderId}/lock` | POS Auth | Verificar lock de orden |
| POST | `/orders/{orderId}/lock` | POS Auth | Bloquear orden |
| DELETE | `/orders/{orderId}/lock` | POS Auth | Liberar lock |

---

## Eventos

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/events/ingest` | API Secret | Ingerir eventos desde terminales |
| GET | `/events/stream` | POS Auth | SSE stream de eventos en tiempo real |

---

## Delivery

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/delivery` | POS Auth | Crear orden de delivery |
| GET | `/delivery` | POS Auth | Listar deliveries |
| GET | `/delivery/{id}` | POS Auth | Detalle de delivery |
| PATCH | `/delivery/{id}/assign` | POS Auth | Asignar driver |
| PATCH | `/delivery/{id}/dispatch` | POS Auth | Despachar delivery |
| PATCH | `/delivery/{id}/deliver` | POS Auth | Marcar como entregado |
| PATCH | `/delivery/{id}/fail` | POS Auth | Marcar como fallido |
| GET | `/delivery/driver/{driverId}` | POS Auth | Deliveries del driver |
| GET | `/delivery/stats/driver/{driverId}` | POS Auth | Estadisticas del driver |
| GET | `/deliveries/stream` | POS Auth | SSE stream de deliveries |

---

## Drivers

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/drivers` | Admin | Listar drivers |
| POST | `/drivers` | Admin | Crear driver |
| GET | `/drivers/available` | POS Auth | Drivers disponibles |
| GET | `/drivers/{id}` | Admin | Detalle del driver |
| PATCH | `/drivers/{id}` | Admin | Actualizar driver |
| PATCH | `/drivers/{id}/link-employee` | Admin | Vincular driver con empleado |

---

## Inventario

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/inventory` | POS Auth | Listar inventario |
| GET | `/inventory/stock` | POS Auth | Niveles de stock |
| GET | `/inventory/stats` | POS Auth | Estadisticas de inventario |
| POST | `/inventory/receive` | POS Auth | Recibir mercaderia |
| POST | `/inventory/waste` | POS Auth | Registrar merma |
| POST | `/inventory/verify-pin` | POS Auth | Verificar PIN para operaciones |
| GET | `/inventory/kardex/{code}` | POS Auth | Kardex por producto |
| GET | `/inventory/lots/{code}` | POS Auth | Lotes por producto |
| GET | `/inventory/movements/recent` | POS Auth | Movimientos recientes |

---

## Terminales

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/terminals/activate` | Public | Activar terminal con codigo |
| POST | `/terminals/activate-simple` | Public | Activacion simplificada |
| POST | `/terminals/validate` | Public | Validar terminal |
| POST | `/terminals/validate-device` | Public | Validar dispositivo |
| GET | `/terminals/range` | Admin | Obtener rango de terminales |
| POST | `/terminals/range` | Admin | Asignar rango |

---

## Asistencia

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/attendance/clock-in` | Employee | Marcar entrada |
| POST | `/attendance/clock-out` | Employee | Marcar salida |

---

## Catalogo

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/catalog/latest` | POS Auth | Catalogo actualizado |
| GET | `/products` | POS Auth | Listar productos |

---

## Promociones

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/promotions` | POS Auth | Listar promociones activas |
| POST | `/promotions/apply` | POS Auth | Aplicar promocion a orden |
| POST | `/promotions/remove` | POS Auth | Remover promocion |
| POST | `/promotions/validate` | POS Auth | Validar promocion |

---

## Reembolsos

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/refunds` | Admin | Listar reembolsos |

---

## SUNAT (Facturacion)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/sunat/invoice` | POS Auth | Emitir comprobante SUNAT |
| POST | `/sunat/void` | Admin | Anular comprobante |

---

## Ubicaciones (GPS Drivers)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/locations` | POS Auth | Enviar ubicacion del driver |
| GET | `/locations` | POS Auth | Obtener ubicaciones activas |
| GET | `/locations/history/{driverId}` | POS Auth | Historial de ubicaciones |

---

## Push Notifications

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/push/subscribe` | Employee | Suscribir a push |
| POST | `/push/unsubscribe` | Employee | Desuscribir |
| POST | `/push/send` | Admin | Enviar notificacion push |

---

## Notificaciones

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/notifications/subscribe` | Employee | Suscribir a notificaciones |
| DELETE | `/notifications/subscribe` | Employee | Desuscribir |
| GET | `/notifications/preferences` | Employee | Obtener preferencias |
| PATCH | `/notifications/preferences` | Employee | Actualizar preferencias |
| GET | `/notifications/vapid-key` | Public | Obtener VAPID key |
| POST | `/notifications/test` | Employee | Enviar notificacion de prueba |

---

## Tenant

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/tenant/configuration` | Admin | Obtener configuracion del tenant |
| PUT | `/tenant/configuration` | Admin | Actualizar configuracion |
| POST | `/tenant/export` | Admin | Exportar datos del tenant |
| GET | `/tenant/exports` | Admin | Listar exportaciones |
| GET | `/tenant/exports/{id}/download` | Admin | Descargar exportacion |
| POST | `/tenant/restore` | Admin | Restaurar datos |
| GET | `/tenant/public` | Public | Info publica del tenant |

---

## Menu Publico

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/menu/{tenantSlug}/{tableId}` | Public | Ver menu digital de la mesa |
| POST | `/menu/{tenantSlug}/{tableId}/call-waiter` | Public | Llamar al mesero |
| POST | `/menu/{tenantSlug}/{tableId}/feedback` | Public | Enviar feedback |

---

## Reservas Publicas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/reservations/{tenantSlug}` | Public | Ver disponibilidad |
| POST | `/reservations/{tenantSlug}` | Public | Crear reserva |
| GET | `/reservations/{tenantSlug}/{code}` | Public | Ver reserva por codigo |
| PATCH | `/reservations/{tenantSlug}/{code}/cancel` | Public | Cancelar reserva |

---

## Tracking Publico

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/track/{code}` | Public | Seguimiento de pedido (PARK-XXXXXX) |

---

## Demo

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/demo-request` | Public | Solicitar demo |

---

## Health & Metrics

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/health` | Public | Health check |
| GET | `/metrics` | Admin | Metricas de la aplicacion |

---

## Docs

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/docs` | Public | Documentacion Swagger UI |
| GET | `/docs/openapi.json` | Public | OpenAPI spec |
| GET | `/docs/postman` | Public | Coleccion Postman |

---

## Webhooks

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/webhooks/pedidosya` | API Secret | Webhook de PedidosYa |
| POST | `/webhooks/llamafood` | API Secret | Webhook de LlamaFood |

---

## Cron Jobs

Configurados en `vercel.json`. Protegidos con `CRON_SECRET`.

| Metodo | Ruta | Schedule | Descripcion |
|--------|------|----------|-------------|
| GET | `/cron/maintenance` | Dom 03:00 UTC | Mantenimiento: archiver, cleanup |
| GET | `/cron/sunat-daily-summary` | Diario 11:00 UTC | Resumen diario SUNAT |
| GET | `/cron/rfm` | Diario 05:00 UTC | Calculo RFM de clientes |
| GET | `/cron/sunat-queue` | Diario 12:00 UTC | Procesar cola SUNAT |
| GET | `/cron/message-outbox` | Diario 18:00 UTC | Procesar outbox de mensajes |

---

## Admin — Analytics

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/analytics/realtime` | Admin | Metricas en tiempo real |
| GET | `/admin/analytics/hourly` | Admin | Metricas por hora |
| GET | `/admin/analytics/history` | Admin | Historial de ventas |
| GET | `/admin/analytics/top-products` | Admin | Top productos |
| GET | `/admin/analytics/comparison` | Admin | Comparacion de periodos |
| GET | `/admin/analytics/by-location` | Admin | Ventas por sucursal |

---

## Admin — Dashboard

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/dashboard/stats` | Admin | Estadisticas del dashboard |
| GET | `/admin/executive-dashboard` | Admin | Dashboard ejecutivo |
| GET | `/admin/sidebar/badges` | Admin | Badges del sidebar |

---

## Admin — Empleados

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/employees` | Admin | Listar empleados |
| POST | `/admin/employees` | Admin | Crear empleado |
| GET | `/admin/employees/{id}` | Admin | Detalle del empleado |
| PUT | `/admin/employees/{id}` | Admin | Actualizar empleado |
| DELETE | `/admin/employees/{id}` | Admin | Eliminar empleado |

---

## Admin — Productos

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/products` | Admin | Listar productos |
| POST | `/admin/products` | Admin | Crear producto |
| GET | `/admin/products/{id}` | Admin | Detalle del producto |
| PUT | `/admin/products/{id}` | Admin | Actualizar producto |
| DELETE | `/admin/products/{id}` | Admin | Eliminar producto |
| PUT | `/admin/products/{id}/availability` | Admin | Cambiar disponibilidad |
| POST | `/admin/products/bulk` | Admin | Operacion masiva |
| POST | `/admin/products/import` | Admin | Importar productos |
| GET | `/admin/products/export` | Admin | Exportar productos |
| GET | `/admin/products/template` | Admin | Plantilla de importacion |
| POST | `/admin/products/images` | Admin | Subir imagen |
| DELETE | `/admin/products/images/{id}` | Admin | Eliminar imagen |

---

## Admin — Recetas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/recipes` | Admin | Listar recetas |
| POST | `/admin/recipes` | Admin | Crear receta |
| GET | `/admin/recipes/{id}` | Admin | Detalle de receta |
| PUT | `/admin/recipes/{id}` | Admin | Actualizar receta |
| PATCH | `/admin/recipes/{id}` | Admin | Actualizar parcial |
| DELETE | `/admin/recipes/{id}` | Admin | Eliminar receta |

---

## Admin — Mesas y Zonas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/tables` | Admin | Listar mesas |
| POST | `/admin/tables` | Admin | Crear mesa |
| GET | `/admin/tables/{id}` | Admin | Detalle de mesa |
| PUT | `/admin/tables/{id}` | Admin | Actualizar mesa |
| DELETE | `/admin/tables/{id}` | Admin | Eliminar mesa |
| GET | `/admin/zones` | Admin | Listar zonas |
| GET | `/admin/mesas/status` | Admin | Estado de todas las mesas |
| GET | `/admin/mesas/qr` | Admin | Generar QR de mesa |
| POST | `/admin/mesas/{id}/occupy` | Admin | Ocupar mesa |
| POST | `/admin/mesas/{id}/release` | Admin | Liberar mesa |
| POST | `/admin/mesas/{id}/merge` | Admin | Fusionar mesas |
| POST | `/admin/mesas/{id}/split` | Admin | Dividir mesa |

---

## Admin — Ordenes (Courses)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/orders/{id}/courses` | Admin | Cursos de la orden |
| POST | `/admin/orders/{id}/courses` | Admin | Crear curso |
| POST | `/admin/orders/{id}/courses/fire` | Admin | Disparar curso (course-fire) |

---

## Admin — Facturacion SUNAT

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/facturacion` | Admin | Listar comprobantes |
| GET | `/admin/facturacion/stats` | Admin | Estadisticas de facturacion |
| GET | `/admin/facturacion/{invoiceId}` | Admin | Detalle de comprobante |
| GET | `/admin/facturacion/{invoiceId}/pdf` | Admin | Descargar PDF |
| POST | `/admin/facturacion/{invoiceId}/void` | Admin | Anular comprobante |
| GET | `/admin/facturacion/configuracion` | Admin | Configuracion SUNAT |
| PUT | `/admin/facturacion/configuracion` | Admin | Actualizar config SUNAT |
| GET | `/admin/facturacion/contingencia` | Admin | Estado de contingencia |
| POST | `/admin/facturacion/contingencia` | Admin | Activar contingencia |
| DELETE | `/admin/facturacion/contingencia` | Admin | Desactivar contingencia |
| GET | `/admin/facturacion/resumenes-diarios` | Admin | Resumenes diarios |
| POST | `/admin/facturacion/resumenes-diarios` | Admin | Generar resumen diario |
| POST | `/admin/facturacion/test-connection` | Admin | Probar conexion SUNAT |

---

## Admin — Finanzas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/pnl` | Admin | Profit & Loss |
| GET | `/admin/pnl/export` | Admin | Exportar P&L |
| GET | `/admin/petty-cash` | Admin | Listar caja chica |
| POST | `/admin/petty-cash` | Admin | Registrar movimiento |
| POST | `/admin/petty-cash/{id}/approve` | Admin | Aprobar movimiento |
| POST | `/admin/petty-cash/reconcile` | Admin | Conciliar caja chica |
| GET | `/admin/reconciliation` | Admin | Listar conciliaciones |
| POST | `/admin/reconciliation` | Admin | Crear conciliacion |
| PATCH | `/admin/reconciliation/{id}` | Admin | Actualizar conciliacion |
| GET | `/admin/reconciliation/export` | Admin | Exportar conciliacion |
| GET | `/admin/reports` | Admin | Reportes generales |
| GET | `/admin/reports/profitability` | Admin | Reporte de rentabilidad |
| GET | `/admin/reports/margin-analysis` | Admin | Analisis de margenes |
| GET | `/admin/reports/profit-by-product/{id}` | Admin | Rentabilidad por producto |

---

## Admin — Delivery

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/delivery/metrics` | Admin | Metricas de delivery |
| GET | `/admin/delivery/driver-metrics` | Admin | Metricas por driver |
| GET | `/admin/delivery/history` | Admin | Historial de deliveries |

---

## Admin — Impresoras

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/printers` | Admin | Listar impresoras |
| POST | `/admin/printers` | Admin | Registrar impresora |
| GET | `/admin/printers/{id}` | Admin | Detalle de impresora |
| PATCH | `/admin/printers/{id}` | Admin | Actualizar impresora |
| DELETE | `/admin/printers/{id}` | Admin | Eliminar impresora |
| POST | `/admin/printers/{id}/test` | Admin | Imprimir pagina de prueba |
| GET | `/admin/print-jobs` | Admin | Cola de impresion |
| POST | `/admin/print-jobs` | Admin | Crear trabajo de impresion |
| PATCH | `/admin/print-jobs/{id}/status` | Admin | Actualizar estado |
| POST | `/admin/print-jobs/{id}/retry` | Admin | Reintentar impresion |

---

## Admin — Promociones

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/promotions` | Admin | Listar promociones |
| POST | `/admin/promotions` | Admin | Crear promocion |
| GET | `/admin/promotions/{id}` | Admin | Detalle de promocion |
| PUT | `/admin/promotions/{id}` | Admin | Actualizar promocion |
| DELETE | `/admin/promotions/{id}` | Admin | Eliminar promocion |

---

## Admin — Compras

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/purchases` | Admin | Listar ordenes de compra |
| POST | `/admin/purchases` | Admin | Crear orden de compra |
| PATCH | `/admin/purchases/{id}` | Admin | Actualizar orden de compra |

---

## Admin — Clientes

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/customers` | Admin | Listar clientes |
| POST | `/admin/customers` | Admin | Crear cliente |
| GET | `/admin/customers/{id}` | Admin | Detalle del cliente |
| PUT | `/admin/customers/{id}` | Admin | Actualizar cliente |
| DELETE | `/admin/customers/{id}` | Admin | Eliminar cliente |

---

## Admin — CRM

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/crm/segments` | Admin | Listar segmentos |
| POST | `/admin/crm/segments` | Admin | Crear segmento |
| GET | `/admin/crm/segments/{id}` | Admin | Detalle de segmento |
| PUT | `/admin/crm/segments/{id}` | Admin | Actualizar segmento |
| DELETE | `/admin/crm/segments/{id}` | Admin | Eliminar segmento |
| POST | `/admin/crm/segments/{id}/evaluate` | Admin | Evaluar segmento |
| POST | `/admin/crm/segments/{id}/refresh` | Admin | Refrescar segmento |
| GET | `/admin/crm/campaigns` | Admin | Listar campanas |
| POST | `/admin/crm/campaigns` | Admin | Crear campana |
| GET | `/admin/crm/campaigns/{id}` | Admin | Detalle de campana |
| POST | `/admin/crm/campaigns/{id}/launch` | Admin | Lanzar campana |
| POST | `/admin/crm/campaigns/{id}/cancel` | Admin | Cancelar campana |
| GET | `/admin/crm/templates` | Admin | Listar templates |
| POST | `/admin/crm/templates` | Admin | Crear template |
| GET | `/admin/crm/templates/{id}` | Admin | Detalle de template |
| PUT | `/admin/crm/templates/{id}` | Admin | Actualizar template |
| DELETE | `/admin/crm/templates/{id}` | Admin | Eliminar template |
| POST | `/admin/crm/templates/{id}/preview` | Admin | Preview de template |
| GET | `/admin/crm/rfm/summary` | Admin | Resumen RFM |

---

## Admin — Fidelidad

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/loyalty/config` | Admin | Configuracion de fidelidad |
| PUT | `/admin/loyalty/config` | Admin | Actualizar configuracion |
| GET | `/admin/loyalty/customers/{id}` | Admin | Puntos del cliente |
| GET | `/admin/loyalty/customers/{id}/history` | Admin | Historial de puntos |

---

## Admin — Pollo Control

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/pollo-control` | Admin | Estado de produccion |
| GET | `/admin/pollo-control/history` | Admin | Historial de produccion |
| POST | `/admin/pollo-control/production` | Admin | Iniciar lote de produccion |
| PUT | `/admin/pollo-control/production/{id}/complete` | Admin | Completar lote |

---

## Admin — KDS Stations

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/stations` | Admin | Listar estaciones |
| POST | `/admin/stations` | Admin | Crear estacion |
| GET | `/admin/stations/{id}` | Admin | Detalle de estacion |
| PATCH | `/admin/stations/{id}` | Admin | Actualizar estacion |
| GET | `/admin/stations/{id}/orders` | Admin | Ordenes de la estacion |
| GET | `/admin/stations/{id}/metrics` | Admin | Metricas de la estacion |
| GET | `/admin/stations/alerts` | Admin | Alertas de estaciones |
| POST | `/admin/stations/alerts/{id}/dismiss` | Admin | Descartar alerta |

---

## Admin — Alertas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/alerts/configurations` | Admin | Configuraciones de alertas |
| POST | `/admin/alerts/configurations` | Admin | Crear configuracion |
| GET | `/admin/alerts/configurations/{id}` | Admin | Detalle de configuracion |
| PATCH | `/admin/alerts/configurations/{id}` | Admin | Actualizar configuracion |
| DELETE | `/admin/alerts/configurations/{id}` | Admin | Eliminar configuracion |
| GET | `/admin/alerts/events` | Admin | Eventos de alerta |
| POST | `/admin/alerts/events/{id}/acknowledge` | Admin | Acusar recibo |
| POST | `/admin/alerts/events/{id}/resolve` | Admin | Resolver alerta |

---

## Admin — Notificaciones

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/notifications` | Admin | Listar notificaciones |
| GET | `/admin/notifications/status` | Admin | Estado de notificaciones |
| POST | `/admin/notifications/{id}/read` | Admin | Marcar como leida |
| POST | `/admin/notifications/read-all` | Admin | Marcar todas como leidas |
| POST | `/admin/notifications/test` | Admin | Enviar notificacion de prueba |

---

## Admin — Reservas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/reservations` | Admin | Listar reservas |
| GET | `/admin/reservations/{id}` | Admin | Detalle de reserva |
| PATCH | `/admin/reservations/{id}` | Admin | Actualizar reserva |

---

## Admin — Ranking de Meseros

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/waiter-ranking` | Admin | Ranking de meseros |
| GET | `/admin/waiter-ranking/export` | Admin | Exportar ranking |

---

## Admin — Performance

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/performance/metrics` | Admin | Metricas de rendimiento |
| POST | `/admin/performance/metrics` | Admin | Registrar metrica |

---

## Admin — Asistencia

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/attendance/daily` | Admin | Reporte diario de asistencia |

---

## Admin — Seguridad

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/security/alerts` | Admin | Alertas de seguridad |
| POST | `/admin/security/alerts/{alertId}/resolve` | Admin | Resolver alerta |
| GET | `/admin/security/sessions` | Admin | Sesiones activas |
| POST | `/admin/security/sessions/{sessionId}/revoke` | Admin | Revocar sesion |
| GET | `/admin/security/devices` | Admin | Dispositivos registrados |
| POST | `/admin/security/devices/{mac}/block` | Admin | Bloquear dispositivo |
| GET | `/admin/security/terminals/{id}/access-log` | Admin | Log de acceso del terminal |

---

## Admin — Auditoria

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/audit-log` | Admin | Log de auditoria |
| GET | `/admin/audit/events` | Admin | Eventos de auditoria |
| GET | `/admin/audit/alerts` | Admin | Alertas de auditoria |
| POST | `/admin/audit/alerts/{alertId}/acknowledge` | Admin | Acusar recibo |

---

## Admin — Tenants

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/tenants` | Admin | Listar tenants |
| POST | `/admin/tenants/provision` | Admin | Provisionar nuevo tenant |
| GET | `/admin/tenants/{id}/configuration` | Admin | Configuracion del tenant |
| GET | `/admin/tenants/{id}/events` | Admin | Eventos del tenant |
| GET | `/admin/tenants/{id}/orders` | Admin | Ordenes del tenant |
| POST | `/admin/tenants/{id}/deactivate` | Admin | Desactivar tenant |
| POST | `/admin/tenants/{id}/reactivate` | Admin | Reactivar tenant |
| POST | `/admin/tenants/{id}/delete` | Admin | Eliminar tenant |
| GET | `/admin/tenants/{id}/delete` | Admin | Pre-check de eliminacion |
| GET | `/admin/tenants/current/metrics` | Admin | Metricas del tenant actual |
| GET | `/admin/tenants/current/activity` | Admin | Actividad del tenant actual |
| GET | `/admin/tenants/current/health` | Admin | Health del tenant actual |

---

## Admin — Cross-Tenant

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/cross-tenant/tenants` | Admin | Listar tenants (cross) |
| GET | `/admin/cross-tenant/tenants/{tenantId}/health` | Admin | Health de tenant |
| GET | `/admin/cross-tenant/access-control` | Admin | Control de acceso |
| POST | `/admin/cross-tenant/access-control` | Admin | Otorgar acceso |
| DELETE | `/admin/cross-tenant/access-control` | Admin | Revocar acceso |
| GET | `/admin/cross-tenant/audit-log` | Admin | Log de auditoria cross |
| POST | `/admin/cross-tenant-admins/grant` | Admin | Otorgar admin cross-tenant |
| POST | `/admin/cross-tenant-admins/revoke` | Admin | Revocar admin cross-tenant |

---

## Admin — Terminales V2

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/terminals-v2` | Admin | Listar terminales |
| POST | `/admin/terminals-v2/create` | Admin | Crear terminal |
| GET | `/admin/terminals-v2/{terminalId}` | Admin | Detalle del terminal |
| PATCH | `/admin/terminals-v2/{terminalId}/status` | Admin | Cambiar estado |
| POST | `/admin/terminals-v2/{terminalId}/unbind` | Admin | Desvincular terminal |
| POST | `/admin/terminals-v2/{terminalId}/regenerate-code` | Admin | Regenerar codigo |
| GET | `/admin/terminals-v2/{terminalId}/debug` | Admin | Debug del terminal |
| POST | `/admin/terminals/activate` | Admin | Activar terminal (legacy) |
| GET | `/admin/terminals` | Admin | Listar terminales (legacy) |

---

## Admin — Configuracion

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/config` | Admin | Configuracion general |
| GET | `/admin/settings/yape-plin` | Admin | Config Yape/Plin |
| PUT | `/admin/settings/yape-plin` | Admin | Actualizar config Yape/Plin |
| GET | `/admin/platform-config` | Admin | Config de plataformas |
| PATCH | `/admin/platform-config` | Admin | Actualizar config plataformas |
| GET | `/admin/log-config` | Admin | Config de logging |
| POST | `/admin/log-config` | Admin | Actualizar logging |
| GET | `/admin/locations` | Admin | Listar sucursales |

---

## Admin — Onboarding

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/onboarding` | Admin | Estado del onboarding |
| PUT | `/admin/onboarding/steps/{key}/complete` | Admin | Completar paso |

---

## Admin — Operaciones

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/admin/archive-events` | Admin | Archivar eventos |
| GET | `/admin/archive-events` | Admin | Estado de archivado |
| POST | `/admin/bulk-import` | Admin | Importacion masiva |
| POST | `/admin/cleanup` | Admin | Limpieza de datos |
| GET | `/admin/export` | Admin | Exportar datos |
| GET | `/admin/feedback` | Admin | Feedback de clientes |
| GET | `/admin/search` | Admin | Busqueda global |

---

## Admin — Recovery

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/admin/recovery/clear-cache` | Admin | Limpiar cache |
| POST | `/admin/recovery/rebuild-projections` | Admin | Reconstruir projections |
| POST | `/admin/recovery/reset-sync` | Admin | Reset de sincronizacion |

---

## Admin — Platform Orders

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/admin/platform-orders` | Admin | Ordenes de plataformas |
| POST | `/admin/platform-orders/{id}/accept` | Admin | Aceptar orden |
| POST | `/admin/platform-orders/{id}/reject` | Admin | Rechazar orden |

---

## HR (Recursos Humanos)

### Empleados

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/hr/employees` | Admin | Listar empleados |
| POST | `/hr/employees` | Admin | Crear empleado |
| GET | `/hr/employees/search` | Admin | Buscar empleados |
| GET | `/hr/employees/{id}` | Admin | Detalle del empleado |
| PATCH | `/hr/employees/{id}` | Admin | Actualizar empleado |
| DELETE | `/hr/employees/{id}` | Admin | Eliminar empleado |
| POST | `/hr/employees/{id}/documents` | Admin | Subir documento |
| POST | `/hr/employees/{id}/emergency-contacts` | Admin | Agregar contacto de emergencia |

### Asistencia

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/hr/attendance` | Admin | Listar asistencias |
| POST | `/hr/attendance` | Admin | Registrar asistencia |
| POST | `/hr/attendance/{id}/clock-out` | Admin | Registrar salida |
| POST | `/hr/attendance/{id}/justify` | Admin | Justificar inasistencia |
| GET | `/hr/attendance/report` | Admin | Reporte de asistencia |

### Licencias

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/hr/leave-requests` | Admin | Listar solicitudes |
| POST | `/hr/leave-requests` | Admin | Crear solicitud |
| GET | `/hr/leave-requests/{id}` | Admin | Detalle de solicitud |
| POST | `/hr/leave-requests/{id}/approve` | Admin | Aprobar |
| POST | `/hr/leave-requests/{id}/reject` | Admin | Rechazar |
| POST | `/hr/leave-requests/{id}/cancel` | Admin | Cancelar |
| GET | `/hr/leave-requests/employee/{employeeId}` | Admin | Licencias del empleado |
| GET | `/hr/leave-requests/employee/{employeeId}/vacation-balance` | Admin | Saldo de vacaciones |

### Adelantos

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/hr/advances` | Admin | Listar adelantos |
| POST | `/hr/advances` | Admin | Solicitar adelanto |
| GET | `/hr/advances/{id}` | Admin | Detalle del adelanto |
| POST | `/hr/advances/{id}/approve` | Admin | Aprobar |
| POST | `/hr/advances/{id}/reject` | Admin | Rechazar |
| POST | `/hr/advances/{id}/mark-paid` | Admin | Marcar como pagado |
| GET | `/hr/advances/employee/{employeeId}` | Admin | Adelantos del empleado |

### Evaluaciones

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/hr/evaluations` | Admin | Listar evaluaciones |
| POST | `/hr/evaluations` | Admin | Crear evaluacion |
| GET | `/hr/evaluations/{id}` | Admin | Detalle |
| POST | `/hr/evaluations/{id}/review` | Admin | Revisar evaluacion |
| POST | `/hr/evaluations/{id}/complete` | Admin | Completar evaluacion |
| POST | `/hr/evaluations/{id}/employee-comments` | Employee | Comentarios del empleado |
| GET | `/hr/evaluations/employee/{employeeId}` | Admin | Evaluaciones del empleado |
| GET | `/hr/evaluations/employee/{employeeId}/average` | Admin | Promedio del empleado |

### Capacitaciones

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/hr/training` | Admin | Listar capacitaciones |
| POST | `/hr/training` | Admin | Crear capacitacion |
| GET | `/hr/training/{id}` | Admin | Detalle |
| GET | `/hr/training/type/{type}` | Admin | Por tipo |
| GET | `/hr/training/employee/{employeeId}` | Admin | Del empleado |
| GET | `/hr/training/employee/{employeeId}/hours` | Admin | Horas del empleado |
| GET | `/hr/training/employee/{employeeId}/compliance` | Admin | Cumplimiento |

### Planillas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/hr/payroll/calculate` | Admin | Calcular planilla |
| GET | `/hr/payroll/{employeeId}` | Admin | Planilla del empleado |
| GET | `/hr/payroll/period/{periodMonth}` | Admin | Planilla del periodo |
| GET | `/hr/reports` | Admin | Reportes HR |

### Horarios

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/hr/schedules` | Admin | Listar horarios |
| POST | `/hr/schedules` | Admin | Crear horario |
| GET | `/hr/schedules/weekly` | Admin | Vista semanal |
| POST | `/hr/schedules/{id}/assign` | Admin | Asignar empleado |

### Portal del Empleado (/hr/me)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/hr/me` | Employee | Mi perfil |
| GET | `/hr/me/attendance` | Employee | Mi asistencia |
| GET | `/hr/me/schedule` | Employee | Mi horario |
| GET | `/hr/me/payslips` | Employee | Mis boletas de pago |
| GET | `/hr/me/vacation-balance` | Employee | Mi saldo de vacaciones |
| GET | `/hr/me/leave-requests` | Employee | Mis licencias |
| POST | `/hr/me/leave-requests` | Employee | Solicitar licencia |

---

**Total: 316 route handlers | Ultima actualizacion: Abril 2026**
