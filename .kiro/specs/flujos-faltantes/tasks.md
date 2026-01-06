# 🚀 PARK POS 2026 — Plan Maestro de Implementación

## Overview

Plan completo para implementar TODOS los módulos documentados en `docs/03-features/`, conectando Frontend (Next.js), Backend (API Routes), y Base de Datos (Supabase/PostgreSQL).

**Documentos a implementar:** 22 flujos
**Estimación total:** 90-100 días con herramientas IA 2026
**Stack:** Next.js 15 + Prisma + Dexie + Supabase + Yjs (CRDT) + Tailwind

---

## FASE 0: Fundamentos (Días 1-5)

### 0. Infraestructura Base
- [ ] 0.1 Setup CRDT con Yjs
  - Instalar yjs, y-indexeddb, y-webrtc
  - Crear CRDTDocument base class
  - Configurar persistence con IndexedDB + OPFS
  - _Ref: design.md - Architecture_

- [ ] 0.2 Setup P2P Mesh Network
  - Configurar signaling server en Fly.io
  - Implementar WebRTC peer discovery
  - Crear MeshNetwork class con auto-reconnect
  - _Ref: design.md - Component 3_

- [ ] 0.3 Migrar Prisma schema completo
  - Agregar tablas faltantes para todos los módulos
  - Ejecutar `prisma migrate dev`
  - Verificar en Supabase dashboard
  - _Ref: prisma/schema.prisma_

- [ ] 0.4 Setup testing infrastructure
  - Configurar fast-check para property tests
  - Configurar Playwright para E2E
  - Crear test utilities compartidos
  - _Ref: vitest.config.ts_

- [ ] 0.5 Checkpoint - Fundamentos
  - Verificar CRDT sync entre 2 dispositivos
  - Verificar conexión a Supabase
  - Ejecutar tests existentes

---

## FASE 1: Core POS (Días 6-15) — Ya parcialmente implementado

### 1. FLUJO_CAJERO — POS Principal
- [ ] 1.1 Completar Split Bill UI
  - Implementar selector de items por check
  - UI para crear/eliminar checks
  - Cálculo automático de totales por check
  - _Ref: docs/03-features/FLUJO_CAJERO.md_

- [ ] 1.2 Implementar cálculo de cambio
  - Corregir bug: cambio siempre = 0
  - Validar monto recibido >= total
  - Mostrar cambio en UI
  - _Ref: src/app/(pos)/page.tsx línea ~100_

- [ ] 1.3 Property test para Split Bill
  - **Property: Suma de checks = total orden**
  - **Validates: FLUJO_CAJERO.md**

### 2. FLUJO_MESERO — 15 Terminales
- [ ] 2.1 Implementar zonas A-H + Bar
  - Crear modelo Zone en Prisma
  - Asignar meseros a zonas
  - Filtrar mesas por zona asignada
  - _Ref: docs/03-features/FLUJO_MESERO.md_

- [ ] 2.2 Implementar transferencia de mesas
  - UI para transferir pedido entre meseros
  - Evento TABLE_TRANSFERRED
  - Notificación al mesero receptor
  - _Ref: FLUJO_MESERO.md - Escenario 8_

- [ ] 2.3 Implementar pedidos de Bar
  - Estación BAR en KDS
  - Items de bebidas van a Bar
  - Sync con cocina para combos
  - _Ref: FLUJO_MESERO.md - Escenario 12_

### 3. FLUJO_KDS — 5 Estaciones
- [ ] 3.1 Implementar multi-estación
  - Parrilla, Freidora, Cocina Fría, Bar, Expedición
  - Filtrar tickets por estación
  - Routing automático por producto
  - _Ref: docs/03-features/FLUJO_KDS.md_

- [ ] 3.2 Corregir bug de full scan
  - Agregar filtro de fecha a useKitchenTickets
  - Solo cargar eventos del día actual
  - Implementar paginación
  - _Ref: src/app/cocina/hooks/useKitchenTickets.ts_

- [ ] 3.3 Implementar expedición
  - Vista de pedidos listos para entregar
  - Verificación de completitud
  - Notificación a mesero/delivery
  - _Ref: FLUJO_KDS.md - Escenario 10_

- [ ] 3.4 Checkpoint - Core POS
  - Test E2E: crear orden → cocina → pago
  - Verificar sync entre terminales
  - Medir latencia P2P


---

## FASE 2: Autenticación y Configuración (Días 16-20)

### 4. FLUJO_AUTENTICACION — Login, Roles, PINs
- [ ] 4.1 Implementar login por PIN
  - UI de teclado numérico
  - Validación de PIN hasheado
  - Sesión por terminal
  - _Ref: docs/03-features/FLUJO_AUTENTICACION.md_

- [ ] 4.2 Implementar roles y permisos
  - ADMIN, MANAGER, CASHIER, WAITER, KITCHEN
  - Middleware de autorización
  - UI adaptativa por rol
  - _Ref: FLUJO_AUTENTICACION.md - Escenario 3_

- [ ] 4.3 Implementar cambio de usuario rápido
  - Switch user sin cerrar app
  - Mantener contexto de terminal
  - Log de cambios de usuario
  - _Ref: FLUJO_AUTENTICACION.md - Escenario 5_

### 5. FLUJO_CONFIGURACION — Setup Terminal/Tenant
- [ ] 5.1 Implementar onboarding de terminal
  - Registro de nuevo terminal
  - Asignación de estación
  - Configuración inicial
  - _Ref: docs/03-features/FLUJO_CONFIGURACION.md_

- [ ] 5.2 Implementar configuración de tenant
  - Logo, nombre, RUC
  - Configuración de impresoras
  - Zonas y estaciones
  - _Ref: FLUJO_CONFIGURACION.md - Escenario 2_

- [ ] 5.3 Implementar sync de configuración
  - Propagar cambios a todos los terminales
  - Versionado de configuración
  - Rollback si falla
  - _Ref: FLUJO_CONFIGURACION.md - Escenario 6_

---

## FASE 3: Inventario (Días 21-30)

### 6. FLUJO_INVENTARIO — Control de Stock
- [ ] 6.1 Crear modelos de inventario
  - Extender Inventory en Prisma
  - ProductStock, StockMovement, Recipe
  - Supplier model
  - _Ref: docs/03-features/FLUJO_INVENTARIO.md_

- [ ] 6.2 Implementar recepción de mercadería
  - UI de recepción con scanner
  - Evento STOCK_RECEIVED
  - Actualización de costos
  - _Ref: FLUJO_INVENTARIO.md - Escenario 1_

- [ ] 6.3 Implementar descuento automático por venta
  - Hook en PAYMENT_COMPLETED
  - Calcular ingredientes de receta
  - Generar STOCK_CONSUMED events
  - _Ref: FLUJO_INVENTARIO.md - Escenario 2_

- [ ] 6.4 Property test para stock
  - **Property: Stock nunca negativo sin alerta**
  - **Validates: FLUJO_INVENTARIO.md**

- [ ] 6.5 Implementar alertas de stock bajo
  - Cron job para verificar umbrales
  - Evento STOCK_ALERT_TRIGGERED
  - Push notification a admin
  - _Ref: FLUJO_INVENTARIO.md - Escenario 3_

- [ ] 6.6 Implementar conteo físico
  - UI de conteo con diferencias
  - Evento STOCK_ADJUSTED
  - Reporte de varianzas
  - _Ref: FLUJO_INVENTARIO.md - Escenario 4_

- [ ] 6.7 Implementar transferencias entre locales
  - STOCK_TRANSFERRED_OUT / IN
  - Aprobación de admin
  - Tracking de transporte
  - _Ref: FLUJO_INVENTARIO.md - Escenario 6_

- [ ] 6.8 Dashboard de inventario
  - Vista de stock actual
  - Alertas activas
  - Historial de movimientos
  - _Ref: FLUJO_INVENTARIO.md - UI Mockups_

- [ ] 6.9 Checkpoint - Inventario
  - Test: venta descuenta stock correctamente
  - Test: alerta se dispara en umbral
  - Verificar sync offline

---

## FASE 4: Facturación SUNAT (Días 31-40)

### 7. FLUJO_FACTURACION_SUNAT — Comprobantes Electrónicos
- [ ] 7.1 Crear modelos de facturación
  - Extender Invoice en Prisma
  - InvoiceQueue, DailySummary
  - CDR storage
  - _Ref: docs/03-features/FLUJO_FACTURACION_SUNAT.md_

- [ ] 7.2 Integrar con OSE (Nubefact)
  - SDK de Nubefact
  - Generación de XML
  - Firma digital
  - _Ref: FLUJO_FACTURACION_SUNAT.md - Integración OSE_

- [ ] 7.3 Implementar emisión de boleta
  - UI selector de tipo documento
  - Generación automática en pago
  - Impresión de ticket con QR
  - _Ref: FLUJO_FACTURACION_SUNAT.md - Escenario 1_

- [ ] 7.4 Implementar emisión de factura
  - Consulta de RUC a SUNAT
  - Autocomplete de razón social
  - Validación de datos
  - _Ref: FLUJO_FACTURACION_SUNAT.md - Escenario 2_

- [ ] 7.5 Property test para facturación
  - **Property: Todo pago tiene exactamente 1 comprobante**
  - **Validates: FLUJO_FACTURACION_SUNAT.md**

- [ ] 7.6 Implementar modo contingencia
  - Detección de falla de OSE
  - Serie de contingencia
  - Cola de reenvío
  - _Ref: FLUJO_FACTURACION_SUNAT.md - Escenario 4_

- [ ] 7.7 Implementar notas de crédito
  - Referencia a documento original
  - Motivo de NC
  - Envío a SUNAT
  - _Ref: FLUJO_FACTURACION_SUNAT.md - Escenario 3_

- [ ] 7.8 Implementar resumen diario
  - Cron a medianoche
  - Generación de resumen
  - Envío a SUNAT
  - _Ref: FLUJO_FACTURACION_SUNAT.md - Escenario 6_

- [ ] 7.9 Panel de comprobantes (Admin)
  - Lista de comprobantes
  - Reenvío de fallidos
  - Exportación para contador
  - _Ref: FLUJO_FACTURACION_SUNAT.md - UI Mockups_

- [ ] 7.10 Checkpoint - Facturación
  - Test con sandbox de SUNAT
  - Verificar contingencia funciona
  - Test de NC


---

## FASE 5: Mesas y Reservas (Días 41-50)

### 8. FLUJO_MESAS_LAYOUT — Mapa Visual
- [ ] 8.1 Crear modelos de mesas
  - Table, Zone, TableLayout en Prisma
  - Estados: AVAILABLE, OCCUPIED, RESERVED, CLEANING
  - _Ref: docs/03-features/FLUJO_MESAS_LAYOUT.md_

- [ ] 8.2 Implementar floor plan interactivo
  - Canvas con mesas arrastrables
  - Colores por estado
  - Zoom y pan
  - _Ref: FLUJO_MESAS_LAYOUT.md - UI Mockups_

- [ ] 8.3 Implementar unir/dividir mesas
  - Selección múltiple
  - Mesa virtual combinada
  - Split de pedido al dividir
  - _Ref: FLUJO_MESAS_LAYOUT.md - Escenario 2, 3_

- [ ] 8.4 Property test para mesas
  - **Property: Estado de mesa sigue máquina de estados válida**
  - **Validates: FLUJO_MESAS_LAYOUT.md**

- [ ] 8.5 Implementar editor de layout (Admin)
  - Drag and drop de mesas
  - Configuración de zonas
  - Guardar/cargar layouts
  - _Ref: FLUJO_MESAS_LAYOUT.md - Editor_

- [ ] 8.6 Sync de estado en tiempo real
  - WebSocket/SSE para cambios
  - Indicador de quién está editando
  - Conflicto prevention
  - _Ref: FLUJO_MESAS_LAYOUT.md - Sync_

### 9. FLUJO_RESERVAS — Reservaciones
- [ ] 9.1 Crear modelos de reservas
  - Reservation, Waitlist en Prisma
  - Estados: PENDING, CONFIRMED, SEATED, NO_SHOW
  - _Ref: docs/03-features/FLUJO_RESERVAS.md_

- [ ] 9.2 Implementar calendario de reservas
  - Vista semanal/diaria
  - Drag to reschedule
  - Filtros por estado
  - _Ref: FLUJO_RESERVAS.md - UI Mockups_

- [ ] 9.3 Integrar WhatsApp Business API
  - Configurar Meta Business
  - Templates de mensajes
  - Webhook para respuestas
  - _Ref: FLUJO_RESERVAS.md - WhatsApp_

- [ ] 9.4 Implementar confirmación automática
  - Reminder 24h antes
  - Confirmación 2h antes
  - Manejo de no-response
  - _Ref: FLUJO_RESERVAS.md - Escenario 2_

- [ ] 9.5 Implementar lista de espera
  - Cola por hora
  - Notificación cuando hay mesa
  - Timeout de 30 min
  - _Ref: FLUJO_RESERVAS.md - Escenario 6_

- [ ] 9.6 Implementar depósitos
  - Link de pago por WhatsApp
  - Verificación de pago
  - Reembolso si cancela
  - _Ref: FLUJO_RESERVAS.md - Escenario 4_

- [ ] 9.7 Checkpoint - Mesas y Reservas
  - Test E2E: reserva → confirmación → llegada
  - Verificar WhatsApp funciona
  - Test de overbooking prevention

---

## FASE 6: Finanzas (Días 51-60)

### 10. FLUJO_CAJA_CHICA — Gastos Menores
- [ ] 10.1 Crear modelos de caja chica
  - PettyCashTransaction, PettyCashBalance
  - Categorías de gasto
  - _Ref: docs/03-features/FLUJO_CAJA_CHICA.md_

- [ ] 10.2 Implementar retiros con aprobación
  - UI de retiro
  - PIN de supervisor si > umbral
  - Foto de recibo
  - _Ref: FLUJO_CAJA_CHICA.md - Escenario 2_

- [ ] 10.3 Integrar con cierre de turno
  - Mostrar movimientos del día
  - Incluir en cuadre de caja
  - Reporte de gastos
  - _Ref: FLUJO_CAJA_CHICA.md - Escenario 4_

### 11. FLUJO_PROPINAS — Tips
- [ ] 11.1 Crear modelos de propinas
  - Tip, TipDistribution, TipConfig
  - Modos: INDIVIDUAL, POOL, BY_ZONE
  - _Ref: docs/03-features/FLUJO_PROPINAS.md_

- [ ] 11.2 Implementar registro de propinas
  - UI en cierre de mesa
  - Sugerencias de porcentaje
  - Propina en efectivo vs tarjeta
  - _Ref: FLUJO_PROPINAS.md - Escenario 1, 2_

- [ ] 11.3 Property test para propinas
  - **Property: Suma de distribución = total pool**
  - **Validates: FLUJO_PROPINAS.md**

- [ ] 11.4 Implementar distribución pool
  - Cálculo al fin de turno
  - División igual o por horas
  - Aprobación de admin
  - _Ref: FLUJO_PROPINAS.md - Escenario 3_

- [ ] 11.5 Reporte de propinas por empleado
  - Vista diaria/semanal/mensual
  - Exportar para nómina
  - _Ref: FLUJO_PROPINAS.md - Escenario 6_

### 12. FLUJO_DEVOLUCIONES — Refunds
- [ ] 12.1 Implementar devolución total
  - Buscar orden original
  - Generar NC automática
  - Reembolso según método de pago
  - _Ref: docs/03-features/FLUJO_DEVOLUCIONES.md_

- [ ] 12.2 Implementar devolución parcial
  - Seleccionar items a devolver
  - Calcular monto proporcional
  - NC parcial
  - _Ref: FLUJO_DEVOLUCIONES.md - Escenario 2_

- [ ] 12.3 Implementar aprobación de devoluciones
  - Requiere PIN de manager
  - Motivo obligatorio
  - Foto de producto si aplica
  - _Ref: FLUJO_DEVOLUCIONES.md - Escenario 4_

- [ ] 12.4 Checkpoint - Finanzas
  - Test: caja chica cuadra con cierre
  - Test: propinas se distribuyen correctamente
  - Test: NC se genera en devolución


---

## FASE 7: Empleados y Reportes (Días 61-70)

### 13. FLUJO_EMPLEADOS_TURNOS — HR
- [ ] 13.1 Extender modelo Employee
  - Schedule, Attendance, TimeOffRequest
  - Biometric data (opcional)
  - _Ref: docs/03-features/FLUJO_EMPLEADOS_TURNOS.md_

- [ ] 13.2 Implementar programación de turnos
  - Calendario semanal
  - Drag and drop de turnos
  - Validación de restricciones
  - _Ref: FLUJO_EMPLEADOS_TURNOS.md - Escenario 1_

- [ ] 13.3 Implementar marcación de asistencia
  - Clock in/out con PIN
  - Geofence opcional
  - Detección de tardanzas
  - _Ref: FLUJO_EMPLEADOS_TURNOS.md - Escenario 2, 3_

- [ ] 13.4 Property test para asistencia
  - **Property: clock_out >= clock_in siempre**
  - **Validates: FLUJO_EMPLEADOS_TURNOS.md**

- [ ] 13.5 Implementar solicitud de permisos
  - UI para solicitar
  - Aprobación de admin
  - Ajuste automático de horario
  - _Ref: FLUJO_EMPLEADOS_TURNOS.md - Escenario 4_

- [ ] 13.6 Implementar cambio de turnos
  - Solicitud entre empleados
  - Aprobación mutua
  - Notificación a admin
  - _Ref: FLUJO_EMPLEADOS_TURNOS.md - Escenario 5_

- [ ] 13.7 Reporte de nómina
  - Horas normales y extras
  - Tardanzas y faltas
  - Exportar a Excel
  - _Ref: FLUJO_EMPLEADOS_TURNOS.md - Escenario 6_

### 14. FLUJO_REPORTES — Analytics
- [ ] 14.1 Implementar cierre de día
  - Resumen de ventas
  - Cuadre de caja
  - Generación automática a las 6AM
  - _Ref: docs/03-features/FLUJO_REPORTES.md_

- [ ] 14.2 Dashboard de ventas en tiempo real
  - Ventas del día vs ayer
  - Gráfico por hora
  - Top productos
  - _Ref: FLUJO_REPORTES.md - Dashboard_

- [ ] 14.3 Reportes históricos
  - Ventas por período
  - Comparativo semanal/mensual
  - Exportar a Excel/PDF
  - _Ref: FLUJO_REPORTES.md - Históricos_

- [ ] 14.4 Reportes de inventario
  - Valorización de stock
  - Rotación de productos
  - Análisis de mermas
  - _Ref: FLUJO_REPORTES.md - Inventario_

- [ ] 14.5 Checkpoint - HR y Reportes
  - Test: reporte de nómina es correcto
  - Test: cierre de día genera resumen
  - Verificar exportaciones

---

## FASE 8: Delivery y CRM (Días 71-80)

### 15. FLUJO_DELIVERY — Delivery Propio + Apps
- [ ] 15.1 Crear modelos de delivery
  - DeliveryOrder, Driver, DeliveryZone
  - Estados de entrega
  - _Ref: docs/03-features/FLUJO_DELIVERY.md_

- [ ] 15.2 Implementar delivery propio
  - Asignación de repartidor
  - Tracking de estado
  - Notificación al cliente
  - _Ref: FLUJO_DELIVERY.md - Escenario 1_

- [ ] 15.3 Integrar Rappi/PedidosYa
  - Webhook para nuevos pedidos
  - Sync de estados
  - Manejo de cancelaciones
  - _Ref: FLUJO_DELIVERY.md - Escenario 4, 5_

- [ ] 15.4 Implementar zonas de cobertura
  - Mapa de zonas
  - Tarifas por zona
  - Tiempo estimado
  - _Ref: FLUJO_DELIVERY.md - Escenario 3_

- [ ] 15.5 Dashboard de delivery
  - Pedidos activos
  - Mapa de repartidores
  - Métricas de tiempo
  - _Ref: FLUJO_DELIVERY.md - Dashboard_

### 16. FLUJO_CRM_FIDELIZACION — CRM con IA
- [ ] 16.1 Extender modelo Customer
  - CustomerProfile con métricas
  - Segmentos dinámicos
  - _Ref: docs/03-features/FLUJO_CRM_FIDELIZACION.md_

- [ ] 16.2 Implementar segmentación automática
  - RFM analysis
  - Segmentos predefinidos
  - Actualización diaria
  - _Ref: FLUJO_CRM_FIDELIZACION.md - Segmentación_

- [ ] 16.3 Integrar IA multi-proveedor
  - Gemini → DeepSeek → Groq fallback
  - Generación de mensajes personalizados
  - Alertas de límite de API
  - _Ref: FLUJO_CRM_FIDELIZACION.md - IA_

- [ ] 16.4 Implementar campañas automáticas
  - Cumpleaños
  - Clientes inactivos
  - Promociones personalizadas
  - _Ref: FLUJO_CRM_FIDELIZACION.md - Campañas_

- [ ] 16.5 Implementar programa de puntos
  - Acumulación por compra
  - Canje por descuentos
  - Niveles de cliente
  - _Ref: FLUJO_CRM_FIDELIZACION.md - Puntos_

- [ ] 16.6 Checkpoint - Delivery y CRM
  - Test E2E: pedido delivery completo
  - Test: campaña de cumpleaños se envía
  - Verificar fallback de IA

---

## FASE 9: Descuentos y Promociones (Días 81-85)

### 17. FLUJO_DESCUENTOS + PROMOTIONS_DSL
- [ ] 17.1 Implementar DSL de promociones
  - Parser de reglas
  - Evaluador de condiciones
  - Aplicación de descuentos
  - _Ref: docs/03-features/PROMOTIONS_DSL.md_

- [ ] 17.2 Implementar tipos de promoción
  - Porcentaje, monto fijo
  - 2x1, Happy Hour
  - Combo, delivery fee
  - _Ref: FLUJO_DESCUENTOS.md_

- [ ] 17.3 Implementar cupones
  - Generación de códigos
  - Validación y reserva
  - Redención única
  - _Ref: PROMOTIONS_DSL.md - Cupones_

- [ ] 17.4 UI de gestión de promociones
  - CRUD de promociones
  - Calendario de vigencia
  - Reportes de uso
  - _Ref: FLUJO_DESCUENTOS.md - Admin_

---

## FASE 10: Admin y Offline (Días 86-90)

### 18. FLUJO_ADMIN — Panel de Administración
- [ ] 18.1 Dashboard principal
  - KPIs en tiempo real
  - Alertas activas
  - Accesos rápidos
  - _Ref: docs/03-features/FLUJO_ADMIN.md_

- [ ] 18.2 Gestión de catálogo
  - CRUD de productos
  - Categorías y estaciones
  - Precios y recetas
  - _Ref: FLUJO_ADMIN.md - Catálogo_

- [ ] 18.3 Gestión de empleados
  - CRUD de empleados
  - Asignación de roles
  - Reset de PIN
  - _Ref: FLUJO_ADMIN.md - Empleados_

- [ ] 18.4 Configuración del sistema
  - Datos del negocio
  - Impresoras
  - Integraciones
  - _Ref: FLUJO_ADMIN.md - Config_

### 19. FLUJO_OFFLINE_SYNC — Sincronización
- [ ] 19.1 Implementar Service Worker
  - Cache de assets
  - Offline detection
  - Background sync
  - _Ref: docs/03-features/FLUJO_OFFLINE_SYNC.md_

- [ ] 19.2 Implementar cola de eventos offline
  - Persistencia en IndexedDB
  - Retry con backoff
  - Resolución de conflictos
  - _Ref: FLUJO_OFFLINE_SYNC.md - Cola_

- [ ] 19.3 Implementar indicadores de estado
  - Online/offline badge
  - Eventos pendientes
  - Última sincronización
  - _Ref: FLUJO_OFFLINE_SYNC.md - UI_

- [ ] 19.4 Property test para sync
  - **Property: Eventos offline eventualmente se sincronizan**
  - **Validates: FLUJO_OFFLINE_SYNC.md**

---

## FASE 11: Voice, Gestures y Polish (Días 91-95)

### 20. Voice & Gesture Interface
- [ ] 20.1 Implementar comandos de voz
  - Web Speech API
  - Comandos contextuales
  - Feedback auditivo
  - _Ref: design.md - Voice_

- [ ] 20.2 Implementar gestos
  - Swipe actions
  - Long press menus
  - Shake for help
  - _Ref: design.md - Gestures_

- [ ] 20.3 Implementar UI adaptativa
  - Por rol
  - Por hora del día
  - Por carga de trabajo
  - _Ref: design.md - Adaptive UI_

### 21. Self-Healing & Monitoring
- [ ] 21.1 Implementar health checks
  - Database, sync, OSE
  - Disk, memory
  - _Ref: design.md - Self-Healing_

- [ ] 21.2 Implementar auto-recovery
  - Retry con backoff
  - Failover automático
  - Cache cleanup
  - _Ref: design.md - Recovery_

- [ ] 21.3 Implementar alertas
  - Push notifications
  - WhatsApp para críticos
  - Dashboard de salud
  - _Ref: design.md - Alerts_

---

## FASE 12: Testing Final y Deploy (Días 96-100)

### 22. Testing Completo
- [ ] 22.1 Ejecutar todos los property tests
  - Mínimo 100 iteraciones cada uno
  - Documentar cualquier falla
  - _Ref: Todas las properties_

- [ ] 22.2 Tests E2E completos
  - Flujo completo de venta
  - Flujo de delivery
  - Flujo de reserva
  - _Ref: Todos los flujos_

- [ ] 22.3 Performance testing
  - 100+ usuarios concurrentes
  - Latencia P2P < 50ms
  - Offline por 24h
  - _Ref: design.md - Performance_

- [ ] 22.4 Security audit
  - Validación de inputs
  - Autenticación
  - Autorización
  - _Ref: FLUJO_AUTENTICACION.md_

### 23. Documentación Final
- [ ] 23.1 Actualizar README.md
  - Instrucciones de instalación
  - Configuración de Supabase
  - Variables de entorno
  - _Ref: docs/README.md_

- [ ] 23.2 Actualizar MASTER.md
  - Marcar tareas completadas
  - Actualizar roadmap
  - _Ref: .kiro/steering/MASTER.md_

- [ ] 23.3 Crear guías de usuario
  - Manual de cajero
  - Manual de mesero
  - Manual de admin
  - _Ref: Nuevos docs_

### 24. Deploy a Producción
- [ ] 24.1 Configurar Supabase producción
  - Migrar schema
  - Configurar RLS
  - Backup automático
  - _Ref: Supabase docs_

- [ ] 24.2 Deploy a Vercel/Fly.io
  - Variables de entorno
  - Dominio personalizado
  - SSL
  - _Ref: Vercel docs_

- [ ] 24.3 Checkpoint Final
  - Smoke test en producción
  - Verificar todas las integraciones
  - Capacitar al equipo

---

## Resumen

| Fase | Días | Módulos |
|------|------|---------|
| 0. Fundamentos | 1-5 | CRDT, P2P, Prisma, Tests |
| 1. Core POS | 6-15 | Cajero, Mesero, KDS |
| 2. Auth/Config | 16-20 | Autenticación, Configuración |
| 3. Inventario | 21-30 | Stock, Recetas, Alertas |
| 4. Facturación | 31-40 | SUNAT, OSE, Contingencia |
| 5. Mesas/Reservas | 41-50 | Layout, WhatsApp, Waitlist |
| 6. Finanzas | 51-60 | Caja Chica, Propinas, Devoluciones |
| 7. HR/Reportes | 61-70 | Empleados, Turnos, Analytics |
| 8. Delivery/CRM | 71-80 | Delivery, IA, Fidelización |
| 9. Promociones | 81-85 | DSL, Cupones |
| 10. Admin/Offline | 86-90 | Panel Admin, Service Worker |
| 11. Voice/Polish | 91-95 | Voz, Gestos, Self-Healing |
| 12. Deploy | 96-100 | Testing, Docs, Producción |

**Total: 100 días** para sistema completo de clase mundial.

---

## Notes

- Todos los property tests son obligatorios
- Cada checkpoint requiere aprobación antes de continuar
- Priorizar módulos críticos (Facturación, Inventario) si hay presión de tiempo
- IA usa APIs gratuitas (Gemini, DeepSeek, Groq)
- CRDT elimina necesidad de resolución manual de conflictos
