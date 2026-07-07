# FIRMO POS — Product Requirements Document (PRD)

**Versión:** 2.0
**Fecha:** Marzo 2026
**Estado:** Producto en producción interna, pre-lanzamiento comercial
**Autor:** Equipo PARK / FreeCloud

---

## 1. Visión del Producto

### 1.1 Declaración de Visión

**FIRMO POS es un sistema de punto de venta cognitivo, offline-first y event-sourced diseñado específicamente para pollerías y restaurantes peruanos.**

Combina la operación completa de un restaurante — desde la mesa hasta la cocina, desde la caja hasta SUNAT — en una plataforma multi-tenant que funciona incluso sin internet, con sincronización inteligente y facturación electrónica integrada.

### 1.2 Propuesta de Valor Única

| Diferenciador | FIRMO POS | POS Tradicional |
|---------------|----------|-----------------|
| **Offline-first** | Funciona sin internet, sincroniza al reconectar | Requiere conexión constante |
| **Event-sourcing** | Historial completo, auditable, reversible | Solo estado actual |
| **Multi-tenant** | 1 instancia sirve múltiples locales | 1 instalación por local |
| **SUNAT nativo** | Facturación electrónica directa (S/0 por documento) | Integración costosa con terceros |
| **Vertical pollo** | Control de pollo, recetas, merma específica | Genérico, sin especialización |
| **CRM integrado** | RFM, segmentos, campañas WhatsApp | Sin CRM o básico |

### 1.3 Mercado Objetivo

- **Primario:** Pollerías y restaurantes de pollo a la brasa en Perú (30,000+ establecimientos)
- **Secundario:** Restaurantes peruanos en general con servicio de mesa y delivery
- **Terciario:** Cadenas multi-sucursal que necesitan gestión centralizada

### 1.4 Modelo de Negocio

- **SaaS multi-tenant** — Un despliegue en Vercel sirve a todos los clientes
- **Facturación electrónica gratuita** — Via SUNAT Directo (nodefact, MIT, S/0.00/doc)
- **Escala horizontal** — PostgreSQL (Supabase) + Redis + Vercel serverless

---

## 2. Usuarios y Personas

### 2.1 Roles del Sistema (11)

| Rol | Persona | Acceso | Responsabilidad Principal |
|-----|---------|--------|---------------------------|
| **OWNER** | Dueño del negocio | Admin + POS + todo | Control total, finanzas, contratación |
| **ADMIN** | Gerente general | Admin + POS + reportes | Configuración, usuarios, operaciones |
| **MANAGER** | Administrador de local | Admin + operaciones | Operación diaria, supervisión de staff |
| **SUPERVISOR** | Jefe de turno | Admin + POS + operaciones | Calidad, KDS, excepciones |
| **CASHIER** | Cajero | POS + turnos + facturación | Pagos, facturas, cierre de caja |
| **WAITER** | Mesero | App mozo | Gestión de mesas, toma de pedidos |
| **KITCHEN** | Jefe de cocina | KDS cocina | Recepción de pedidos, coordinación |
| **COOK** | Cocinero | KDS estación | Preparación en estación asignada |
| **PACKER** | Empaquetador | KDS empaque | Empaque para delivery/takeout |
| **BAR** | Barman | KDS bar | Preparación de bebidas |
| **DRIVER** | Motorizado | App delivery | Entrega, foto de prueba, reporte |

### 2.2 Flujos por Persona

**Dueño (Ana, 45 años)**
> "Necesito ver cómo va mi negocio desde mi celular, saber cuánto vendí hoy, y que la facturación electrónica funcione sin que yo haga nada."

- Dashboard ejecutivo con ventas en tiempo real
- Estado de resultados (P&L)
- Gestión de empleados y nómina
- Configuración de promociones y precios

**Cajero (Carlos, 28 años)**
> "Necesito cobrar rápido, que el sistema no se cuelgue, y poder emitir boletas incluso si se cae el internet."

- POS con catálogo visual, búsqueda rápida
- Múltiples métodos de pago (efectivo, Yape, Plin, tarjeta)
- Emisión de boleta/factura con 1 clic
- Apertura/cierre de turno con cuadre de caja

**Mesero (Luis, 22 años)**
> "Quiero ver qué mesas están libres, tomar pedidos desde mi celular, y que me avisen cuando los platos estén listos."

- Grid de mesas con colores de estado (libre/ocupado/cuenta)
- Toma de pedidos por mesa desde celular
- Notificaciones de platos listos con sonido
- Solicitud de cuenta desde la app

**Cocinero (María, 35 años)**
> "Necesito ver los pedidos en pantalla grande, marcar cuando termino, y que los meseros sepan que ya está listo."

- Pantalla KDS con tickets de pedido
- Estado de items (PENDIENTE → COCINANDO → LISTO)
- Indicadores de urgencia (tiempo transcurrido)
- Filtro por estación (cocina/horno/bar/empaque)

---

## 3. Arquitectura del Producto

### 3.1 Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| **Frontend** | Next.js (App Router) | 16.1 |
| **Lenguaje** | TypeScript | 5.7 |
| **UI** | Tailwind CSS + Lucide Icons | 4.x |
| **Estado cliente** | Zustand (1 store: cart) + SWR + Context | 5.x / 2.4 |
| **Base de datos** | PostgreSQL (Supabase Cloud) | 16 |
| **ORM** | Prisma | 6.19 |
| **Cache** | Redis (ioredis) | 7 |
| **Offline DB** | Dexie (IndexedDB) | 4.0.11 |
| **Testing** | Vitest + fast-check + Playwright | 4.x |
| **Deploy** | Vercel (serverless) | — |
| **CI/CD** | GitHub Actions | 5 jobs |
| **Logging** | Pino + Logtail | 10.x |
| **Tracing** | OpenTelemetry | 0.212 |
| **Mensajería** | Twilio REST (WhatsApp) | — |

### 3.2 Patrones Arquitectónicos

| Patrón | Implementación |
|--------|----------------|
| **Event Sourcing** | 73 tipos de evento, ingest → dedup → projection → store |
| **Offline-first** | Dexie IndexedDB + sync client + circuit breaker |
| **Multi-tenant** | tenant_id en 121/128 modelos + RLS en PostgreSQL |
| **Transactional Outbox** | event_outbox + message_outbox para entrega confiable |
| **CQRS-lite** | Misma DB para escritura/lectura, projections server-side |
| **Branded Types** | 14 tipos branded (Centavos, OrderId, TenantId, etc.) |
| **Result Pattern** | Railway `ok/err` sin exceptions para flujo de negocio |
| **Saga Orchestrator** | Compensación real en flujos multi-paso |

### 3.3 Métricas del Sistema

| Métrica | Valor |
|---------|-------|
| **Modelos Prisma** | 128 (121 con tenant_id) |
| **Tipos de evento** | 73 (15 con projection server-side) |
| **Endpoints API** | 296 |
| **Páginas UI** | 89 |
| **Servicios core** | 47 (~20,370 LOC) |
| **Tests** | 5,458 (unit + property + E2E) |
| **Archivos test** | 331 |
| **Migraciones** | 42 |
| **Bundle JS** | 5.15 MB (136 chunks) |
| **Cron jobs** | 5 |

---

## 4. Módulos del Producto

### 4.1 POS — Punto de Venta (6 páginas)

**Estado: PRODUCCIÓN** ✅

| Feature | Descripción | Estado |
|---------|-------------|--------|
| Catálogo visual | Grid de productos con imágenes, búsqueda, filtros | ✅ |
| Multi-check | Dividir cuenta por persona en una mesa | ✅ |
| Pagos múltiples | Efectivo, Yape, Plin, tarjeta, transferencia | ✅ |
| Apertura/cierre turno | Cash opening, conteo, cuadre, Z-report | ✅ |
| Facturación | Boleta/Factura con 1 clic | ✅ |
| Offline mode | Opera sin internet vía IndexedDB | ✅ |
| Historial | Últimos 20 pedidos, reimpresión | ✅ |
| UNDO | Deshacer última acción en pedido | ✅ |
| Diagnósticos | Estado de sync, fingerprint, salud DB | ✅ |

### 4.2 Mesero — App Móvil (4 páginas)

**Estado: PRODUCCIÓN** ✅

| Feature | Descripción | Estado |
|---------|-------------|--------|
| Grid de mesas | Colores: verde (libre), violeta (<20m), naranja (20-40m), rojo (>40m) | ✅ |
| Zonas | Filtro por salón/terraza/VIP | ✅ |
| Toma de pedidos | Agregar items por mesa | ✅ |
| Platos listos | Badge con conteo + sonido | ✅ |
| Solicitud cuenta | Indicador pulsante ámbar | ✅ |

### 4.3 KDS — Kitchen Display System (4 páginas)

**Estado: PRODUCCIÓN** ✅

| Feature | Descripción | Estado |
|---------|-------------|--------|
| Tickets de pedido | Agrupados por curso | ✅ |
| 4 estaciones | COCINA, HORNO, BAR, EMPAQUE | ✅ |
| Estado de items | PENDIENTE → COCINANDO → LISTO → HECHO | ✅ |
| Tiempo transcurrido | Alerta visual a 20m y 40m | ✅ |
| FireBar | Indicador de urgencia | ✅ |
| Real-time SSE | Actualizaciones en vivo | ✅ |

### 4.4 Admin — Back Office (59 páginas)

> La estructura refleja exactamente la navegación del panel (`AdminSidebar.tsx`).
> Cada módulo tiene un **nivel de madurez** basado en auditoría real del código:

| Nivel | Significado | Criterio |
|-------|-------------|----------|
| **PRODUCCIÓN** | Validado end-to-end | API + UI + unit tests + E2E funcional |
| **FUNCIONAL** | Código completo, sin validación E2E | API + UI + unit tests, sin E2E de flujo completo |
| **PARCIAL** | Bugs conocidos o flujos incompletos | Código existe pero con defectos identificados |
| **SMOKE** | Solo verificado que la página carga | E2E solo checa título/layout, no flujos reales |

**Resumen:** 5 módulos PRODUCCIÓN, 20 FUNCIONAL, 1 PARCIAL, 1 SMOKE. **0 módulos probados con usuarios reales en un restaurante.**

#### Top-Level

| Item | Ruta | Descripción | Madurez |
|------|------|-------------|---------|
| **Dashboard** | `/admin` | Ventas en tiempo real, resumen del día, KPIs principales | FUNCIONAL |
| **Configuración Inicial** | `/admin/onboarding` | Guía paso a paso para configurar el negocio (wizard 7 pasos) | FUNCIONAL (E2E spec existe) |

#### Operaciones (9 items)

| Item | Ruta | Descripción | Madurez |
|------|------|-------------|---------|
| **Mesas** | `/admin/mesas` | Gestión de mesas y zonas del local (crear, renombrar, capacidad) | FUNCIONAL |
| **QR Mesas** | `/admin/mesas/qr` | Códigos QR para autoservicio por mesa | FUNCIONAL |
| **Op. Mesa** | `/admin/mesas/operaciones` | Operaciones en tiempo real por mesa (estado, pedidos activos) | FUNCIONAL |
| **Estaciones KDS** | `/admin/estaciones` | Configuración de pantallas de cocina y despacho (4 estaciones) | FUNCIONAL |
| **Reservas** | `/admin/reservas` | Reservas de clientes y disponibilidad | FUNCIONAL (API: 2 endpoints) |
| **Delivery** | `/admin/delivery` | Pedidos de delivery en curso (badge con conteo) | FUNCIONAL |
| **Motorizados** | `/admin/drivers` | Gestión de repartidores (asignación, tracking) | FUNCIONAL (E2E CRUD) |
| **Plataformas** | `/admin/plataformas` | Integración PedidosYa, LlamaFood (Rappi/Uber Eats pendiente) | SMOKE |
| **Pedidos App** | `/admin/plataformas/pedidos` | Pedidos entrantes de apps externas | FUNCIONAL |

#### Catálogo (5 items)

| Item | Ruta | Descripción | Madurez |
|------|------|-------------|---------|
| **Productos** | `/admin/productos` | Carta, precios, categorías, imágenes, SKU, routing por estación | **PRODUCCIÓN** (E2E CRUD completo) |
| **Recetas** | `/admin/recetas` | Ingredientes, costos por plato, rendimiento | FUNCIONAL (E2E spec) |
| **Control Pollo** | `/admin/pollo-control` | Producción y merma de pollo (específico pollería) | FUNCIONAL |
| **Inventario** | `/inventario` | Stock de insumos, ajustes, conteos, alertas de mínimos | FUNCIONAL |
| **Promociones** | `/admin/promociones` | Descuentos, combos activos, programación temporal | FUNCIONAL (E2E CRUD) |

#### Equipo (4 items)

| Item | Ruta | Descripción | Madurez |
|------|------|-------------|---------|
| **Empleados** | `/admin/empleados` | Altas, bajas y roles del personal (11 roles) | **PRODUCCIÓN** (E2E CRUD, 3 specs) |
| **Recursos Humanos** | `/admin/hr` | Asistencia, planillas, nómina, vacaciones, adelantos, evaluaciones, capacitaciones (10 sub-páginas) | FUNCIONAL (1 spec smoke) |
| **Ranking Meseros** | `/admin/ranking-meseros` | Desempeño y ventas por mesero | SMOKE |
| **Portal Empleado** | `/employee` | Vista del empleado: boletas, horarios, solicitudes (5 sub-páginas) | FUNCIONAL |

#### Finanzas (9 items)

| Item | Ruta | Descripción | Madurez |
|------|------|-------------|---------|
| **Ejecutivo** | `/admin/ejecutivo` | Vista unificada de rentabilidad, dashboard financiero | FUNCIONAL |
| **Caja Chica** | `/admin/caja-chica` | Gastos menores, reembolsos, rendición | SMOKE (E2E verifica layout) |
| **Compras** | `/admin/compras` | Órdenes de compra a proveedores | SMOKE (E2E verifica layout) |
| **Facturación** | `/admin/facturacion` | Boletas, facturas y notas SUNAT (4 tabs) | **PARCIAL** — 2 bugs: `items:[]` y `razonSocialCliente:''` vacíos en queue worker. 0 comprobantes emitidos exitosamente. |
| **Clientes** | `/admin/clientes` | Directorio de clientes, identidad fiscal (RUC/DNI), historial | FUNCIONAL |
| **Fidelización** | `/admin/fidelizacion` | Puntos de lealtad, tiers (Bronce/Plata/Oro/Platino), redención | FUNCIONAL (0 E2E, nunca probado con datos reales) |
| **CRM** | `/admin/crm` | Segmentos RFM, campañas WhatsApp, plantillas de mensajes | FUNCIONAL (0 E2E, RFM worker nunca ejecutado, 0 campañas enviadas) |
| **Conciliación** | `/admin/conciliacion` | Cruce de caja vs ventas del día | SMOKE |
| **P&L** | `/admin/estado-resultados` | Estado de resultados detallado | SMOKE |

#### Reportes (4 items)

| Item | Ruta | Descripción | Madurez |
|------|------|-------------|---------|
| **Analytics** | `/admin/dashboard` | KPIs, ventas por hora, top productos, comparativa semanal | FUNCIONAL |
| **Reportes** | `/admin/reportes` | Reportes exportables por período (ventas, productos, turnos) | SMOKE (119 líneas, página mínima) |
| **Rentabilidad** | `/admin/reports/profitability` | Margen por producto y categoría | FUNCIONAL |
| **Monitoreo** | `/admin/monitoring` | Salud del sistema, performance, terminales activas | FUNCIONAL |

#### Seguridad (2 items)

| Item | Ruta | Descripción | Madurez |
|------|------|-------------|---------|
| **Auditoría** | `/admin/auditoria` | Historial de acciones y cambios (badge con alertas) | FUNCIONAL (E2E spec) |
| **Terminales** | `/admin/terminales` | Dispositivos POS registrados, fingerprint, MAC | FUNCIONAL |

#### Configuración (2 items)

| Item | Ruta | Descripción | Madurez |
|------|------|-------------|---------|
| **General** | `/admin/configuracion` | Nombre, RUC, logo, zona horaria, preferencias | FUNCIONAL |
| **Yape / Plin** | `/admin/configuracion/yape-plin` | Configurar pagos móviles (QR, cuentas) — registro manual, sin verificación automática de pago | FUNCIONAL |

### 4.5 Portal Empleado — Self-Service (5 páginas)

**Estado: PRODUCCIÓN** ✅

- Dashboard personal
- Historial de asistencia
- Horario de trabajo
- Boletas de pago
- Solicitud de vacaciones

### 4.6 Driver — App Motorizado (1 página)

**Estado: PARCIAL** ⚠️

- Pedidos asignados con filtro por estado
- Marcar despacho
- Captura de foto como prueba de entrega
- Reporte de fallo

**Falta:** GPS tracking en tiempo real

### 4.7 Público — Customer-Facing (3 páginas)

**Estado: PRODUCCIÓN** ✅

- Menú accesible por QR (por mesa y tenant)
- Formulario de reservas
- Landing page

---

## 5. Integraciones Externas

### 5.1 SUNAT — Facturación Electrónica

**Estado: 95% código completo, 2 bugs pendientes** ⚠️

| Componente | Archivo | Estado |
|------------|---------|--------|
| Adapter SUNAT Directo | `src/core/integrations/sunat/sunat-direct-adapter.ts` | ✅ |
| Adapter Nubefact (fallback) | `src/core/integrations/sunat/nubefact-adapter-wrapper.ts` | ✅ |
| Router de proveedores | `src/core/integrations/sunat/provider-router.ts` | ✅ |
| Encriptación SOL | `src/core/integrations/sunat/credential-encryption.ts` | ✅ |
| Contingencia manual | `src/core/integrations/sunat/contingency.ts` | ✅ |
| Generación PDF | `src/core/integrations/sunat/invoice-pdf.ts` | ✅ |
| QR en comprobante | `src/core/integrations/sunat/receipt-qr.ts` | ✅ |
| Queue worker | `src/core/jobs/sunat-queue-worker.ts` | ⚠️ 2 bugs |
| Resumen diario | `src/core/jobs/sunat-daily-summary.ts` | ✅ |
| Admin UI | `src/app/admin/facturacion/` (4 tabs) | ✅ |
| API endpoints | `src/app/api/admin/facturacion/` (7 endpoints) | ✅ |

**Bugs pendientes:**
1. `handleEmit()/handleCreditNote()`: `items: []` y `razonSocialCliente: ''` vacíos
2. Auto-contingencia: threshold solo logea, no activa `ContingencyManager.activate()`

**Para producción:** Credenciales SOL reales + certificado digital + testing contra SUNAT BETA

### 5.2 Twilio — WhatsApp/SMS

**Estado: WhatsApp delivery funcional, CRM messaging nuevo** ✅/⚠️

| Componente | Estado |
|------------|--------|
| WhatsApp para delivery (5 templates) | ✅ Funcional |
| MessagingService (wrapper limpio) | ✅ Nuevo |
| Message Outbox Worker | ✅ Nuevo |
| SMS | ⚠️ Stub (futuro) |

### 5.3 Plataformas de Delivery

| Plataforma | Integración | Estado |
|------------|-------------|--------|
| LlamaFood | Webhook `/api/webhooks/llamafood` | ✅ |
| PedidosYa | Webhook `/api/webhooks/pedidosya` | ✅ |
| Uber Eats | Planificado | ⬜ |

### 5.4 Identidad Peruana

| Servicio | Propósito | Estado |
|----------|-----------|--------|
| RENIEC (DNI) | Validación de DNI | ✅ |
| SUNAT (RUC) | Validación de RUC | ✅ |
| Lookup service | `src/core/integrations/peru-identity/` | ✅ |

### 5.5 Pagos

| Método | Integración | Estado |
|--------|-------------|--------|
| Efectivo | Nativo | ✅ |
| Yape | QR + config admin | ✅ |
| Plin | QR + config admin | ✅ |
| Tarjeta | Registro manual | ✅ |
| Transferencia | Registro manual | ✅ |

---

## 6. Análisis Competitivo y Gaps

### 6.1 Benchmark contra Competidores

| Feature | **Toast** (líder USA) | **Inforest** (líder Perú) | **Restaurant.pe** | **FIRMO POS** |
|---------|----------------------|--------------------------|-------------------|-------------|
| **POS core** | Nativo, hardware propio | Windows desktop | Web | Web (offline-first) |
| **Offline mode** | Hub local + KDS offline | Sí (instalado local) | Limitado | Dexie + event sourcing |
| **KDS** | Hardware dedicado | Integrado | Básico | Web SSE, 4 estaciones |
| **Factura electrónica SUNAT** | N/A (USA) | Integrada, funcional | Integrada, funcional | Código completo, **2 bugs, 0 comprobantes emitidos** |
| **Multi-sucursal** | Completo con dashboard cross-location | Sí | Sí | Schema existe, **UI no implementada** |
| **Delivery 3rd party** | 200+ integraciones | PedidosYa | Rappi, PedidosYa | LlamaFood, PedidosYa (solo 2) |
| **Procesador de pagos** | Propio (Toast Payments) | Niubiz, Izipay | Niubiz | **Solo registro manual** (sin verificación) |
| **Loyalty/CRM** | Email + SMS + app + gift cards | No | Básico | RFM + WhatsApp + tiers (nunca probado) |
| **Gift cards** | Sí | No | No | **No** |
| **Kiosco autoservicio** | Hardware propio | No | No | **No** |
| **App móvil nativa** | Toast Go (handheld) | No | No | **No** (web responsive) |
| **Payroll/RRHH** | Integrado | No | No | Sí (nómina, asistencia, evaluaciones) |
| **Reservas online** | Integrado | No | No | Sí (formulario público + admin) |
| **Soporte 24/7** | Sí | Sí | Sí | **No** |
| **Usuarios reales** | Millones de restaurantes | Miles en Perú | Cientos | **0** |
| **Precio** | $0-110/mes + processing fees | ~S/200-400/mes | ~S/150-300/mes | S/0 (producto propio) |

### 6.2 Ventajas Reales de FIRMO POS

1. **Event sourcing** — Historial completo y auditable de toda operación; los competidores peruanos solo guardan estado actual
2. **Offline-first real** — Funciona sin internet desde el primer momento; los POS web de la competencia se caen sin conexión
3. **SUNAT directo (S/0.00/doc)** — Sin intermediario costoso (cuando se arreglen los 2 bugs)
4. **RRHH integrado** — Ningún POS peruano ofrece nómina, evaluaciones y capacitaciones
5. **CRM con RFM** — Segmentación automática de clientes, campañas WhatsApp
6. **Multi-tenant SaaS** — 1 deployment para todos los clientes; competidores requieren instalación por local
7. **Costo S/0** — Código propio sin licencias de terceros

### 6.3 Gaps Críticos vs. Mercado

| Gap | Impacto | Quién lo tiene | Prioridad |
|-----|---------|----------------|-----------|
| **Procesador de pagos real** (Niubiz/Izipay) | Sin verificación de Yape/Plin = error de cuadre | Inforest, Restaurant.pe, Smart System | BLOQUEANTE |
| **0 usuarios reales** | No se ha validado nada en un restaurante real | Todos los competidores | BLOQUEANTE |
| **Facturación SUNAT rota** (2 bugs) | No puede emitir un solo comprobante válido | Inforest, Restaurant.pe | BLOQUEANTE |
| **Multi-sucursal** | Cadenas no pueden usar FIRMO POS | Toast, Inforest | Alta |
| **App móvil nativa** | Meseros en browser = lento, propenso a cerrar pestaña | Toast (Toast Go) | Alta |
| **Integración contable** (CONCAR, etc.) | Contadores no pueden importar data | Inforest, Restaurant.pe | Media |
| **Soporte 24/7** | Restaurantes operan noches y feriados | Todos los comerciales | Media |
| **Gift cards / Cupones** | Revenue driver probado en el mercado | Toast | Baja |
| **Kiosco autoservicio** | Tendencia creciente en fast-food | Toast | Baja |

### 6.4 Supuestos que Requieren Validación

| Supuesto | Riesgo si es Falso |
|----------|---------------------|
| "Offline-first es ventaja competitiva" | Los POS desktop (Inforest) nunca estuvieron online; nuestro offline resuelve un problema que creamos al ser web-first |
| "Event sourcing agrega valor al usuario" | Al dueño le importa que funcione, no cómo almacena datos internamente |
| "73 event types = sistema robusto" | Solo 15/73 tienen projection server-side; los otros 58 solo se almacenan sin procesarse |
| "296 API endpoints = producto completo" | Cantidad no es calidad; 0 de esos endpoints han recibido tráfico real |
| "5,400 tests = calidad asegurada" | Los E2E de admin son smoke tests (verifican que carga la página, no flujos reales) |
| "CRM con RFM es diferenciador" | El RFM worker nunca ha corrido, 0 segmentos populados, 0 campañas enviadas |
| "Yape/Plin soportado" | Es un checkbox manual; no hay verificación automática del pago |

---

## 7. Seguridad

### 7.1 Autenticación

| Capa | Implementación |
|------|----------------|
| JWT | Firmado con `JWT_SECRET`, httpOnly cookie + Authorization header |
| Sesiones | Redis-backed (`session-v2.ts`) |
| Terminales | Fingerprint por MAC + device ID |
| Rate limiting | Token bucket per tenant/IP, 429 con `Retry-After` |
| Multi-factor | PIN de empleado + terminal registrado |

### 7.2 Autorización (RBAC)

| Nivel | Mecanismo |
|-------|-----------|
| API | `requireAdminAuth` / `requirePosAuth` / `requireAdminPermission` |
| Database | RLS en PostgreSQL (123 tablas con policies) |
| Frontend | Guards por rol en layouts |
| Regla de oro | `ADMIN_ROLES.includes(role)` — NUNCA `role === 'ADMIN'` solo |

### 7.3 Multi-Tenancy

| Capa | Protección |
|------|------------|
| Aplicación | `tenant_id` desde JWT, NUNCA del cliente |
| Base de datos | 121/128 modelos con `tenant_id` + RLS |
| Cache | Keys prefijadas con `tenant_id` |
| IndexedDB | DBs aisladas por tenant |

### 7.4 Datos Sensibles

| Dato | Protección |
|------|------------|
| PINs de empleado | Hash + salt, nunca en logs |
| MAC addresses | Nunca en console.log |
| Credenciales SOL | AES-256 en DB |
| Tokens JWT | httpOnly cookies, no localStorage |

---

## 8. Calidad y Testing

### 8.1 Infraestructura de Tests

| Tipo | Archivos | Tests | Herramienta |
|------|----------|-------|-------------|
| Unit/Integration | 304 | ~5,400 | Vitest |
| Property-based | 96 | ~500 | fast-check (100 runs default) |
| E2E | 31 | ~200 | Playwright (Chromium) |
| **Total** | **431** | **~6,100** | — |

### 8.2 Cobertura E2E

| Flujo | Spec |
|-------|------|
| Venta completa | `01-sale-flow.spec.ts` |
| Turno POS completo | `pos-complete-shift-flow.spec.ts` |
| Flujo mesero→KDS | `waiter-to-kds.spec.ts`, `complete-waiter-flow.spec.ts` |
| CRUD productos | `admin-products-crud.spec.ts` |
| CRUD empleados | `admin-employees-crud.spec.ts` |
| Facturación QR | `invoicing-qr.spec.ts` |
| Menú público QR | `public-menu-qr.spec.ts` |
| Offline/sync | `02-offline-sync.spec.ts` |
| Concurrencia | `03-concurrency.spec.ts` |
| Aislamiento multi-tenant | `multi-tenant-rls-isolation.spec.ts` |
| Onboarding | `onboarding-flow.spec.ts` |
| Permisos admin | `role-guards.spec.ts` |
| RRHH | `admin-hr-module.spec.ts` |
| Finanzas | `admin-finance-modules.spec.ts` |

### 8.3 CI/CD Pipeline

| Job | Qué hace | Duración |
|-----|----------|----------|
| lint-and-typecheck | ESLint + `tsc --noEmit` | ~30s |
| unit-tests | Vitest (PostgreSQL 16 + Redis 7) | ~2min |
| build | Next.js build + Prisma generate | ~1min |
| e2e-tests | Playwright (Chromium) | ~3min |
| deploy-staging | ⚠️ Placeholder (no configurado) | — |

---

## 9. Roadmap de Producto

### 9.1 Fases Completadas

| Fase | Contenido | Fecha | Estado |
|------|-----------|-------|--------|
| **P1** | POS core, event sourcing, offline, sync, productos, pedidos | Dic 2025 | ✅ |
| **P2** | KDS, meseros, delivery, SSE real-time, inventario, recetas | Ene 2026 | ✅ |
| **P3** | Hardening: RLS, snapshots, circuit breaker, rate limiting, E2E, auditoria | Feb 2026 | ✅ |
| **P3.5** | RRHH completo: asistencia, nómina, evaluaciones, capacitaciones | Feb 2026 | ✅ |
| **P4.0** | Employee Management System (HR API + tests) | Mar 2026 | ✅ |
| **P4.1** | SUNAT facturación electrónica (código completo, 2 bugs) | Mar 2026 | ⚠️ 95% |
| **P4.2** | CRM Fase 1: Loyalty Points (earning, redemption, tiers, UI) | Mar 2026 | ✅ |
| **P4.3** | CRM Fase 2: Segmentos, campañas, outbox WhatsApp, RFM | Mar 2026 | ✅ |

### 9.2 Fase Actual — P4 Enterprise (Cerrar el Web)

**Objetivo:** Terminar todo lo que falta para que el sistema web esté listo para un piloto real.

| Item | Estado | Pendiente | Bloqueante para piloto |
|------|--------|-----------|------------------------|
| SUNAT producción | ⚠️ | Fix 2 bugs (`items:[]`, `razonSocialCliente:''`) + credenciales SOL + certificado digital | **SÍ** — sin esto no puede operar legalmente |
| Deploy pipeline | ⬜ | Configurar Vercel deploy en CI/CD | **SÍ** — sin esto no hay app accesible |
| WhatsApp producción | ⬜ | Migrar Twilio sandbox → producción | No (CRM puede esperar) |
| Multi-sucursal | ⬜ | CRUD locations, dashboard por sucursal, RBAC | No (piloto es 1 local) |
| Customer identity (DNI/RUC) | ✅ | Completado | — |
| Loyalty Points | ✅ | Completado | — |
| CRM Segmentos/Campañas | ✅ | Completado | — |

### 9.3 Fase P5 — Piloto y Validación (CRÍTICA)

**Objetivo:** Validar el producto con usuarios reales antes de construir más features.
**Duración estimada:** 4-8 semanas en 1 pollería real.

> **Esta fase NO existía en el roadmap anterior.** Sin ella, todo lo que sigue se construye sobre supuestos no validados. Ver sección 6.4.

| Paso | Qué | Entregable | Criterio de éxito |
|------|-----|------------|-------------------|
| 5.1 | **Seleccionar pollería piloto** | Acuerdo con 1 local, 5-15 empleados | Local con internet + disposición a probar |
| 5.2 | **Deploy producción** | App live en dominio real, HTTPS, DB producción | App accesible desde cualquier device |
| 5.3 | **Onboarding real** | Configurar tenant, productos, mesas, empleados, precios reales | Menú completo cargado en < 2 horas |
| 5.4 | **Turno piloto (shadow)** | Correr FIRMO POS en paralelo con sistema actual durante 1 semana | 0 pérdida de datos, cajero puede operar |
| 5.5 | **Facturación SUNAT real** | Emitir boletas/facturas reales contra SUNAT producción | > 99% éxito en emisión |
| 5.6 | **Corte (cutover)** | Reemplazar sistema actual por FIRMO POS | 1 semana completa sin sistema anterior |
| 5.7 | **Feedback y fixes** | Lista de bugs y mejoras priorizadas por el usuario | Bugs críticos corregidos en < 48h |
| 5.8 | **Métricas post-piloto** | Tiempo de pedido, cuadre de caja, uptime, satisfacción | Cumplir KPIs de sección 10.1 |

**Bugs probables que descubrirá el piloto** (predicción basada en gaps conocidos):
- Yape/Plin sin verificación automática → errores de cuadre de caja
- Offline mode pierde datos si cierran pestaña del browser
- UI demasiado compleja para cajero promedio (37 items en sidebar)
- Performance en dispositivos baratos (tablets Android de gama baja)
- Impresión de tickets (no hay integración con impresora térmica)

### 9.4 Fase P6 — Escalar el Web (Post-Piloto)

**Objetivo:** Features que solo tienen sentido después de validar con usuarios reales.
**Pre-requisito:** P5 completada exitosamente.

#### 9.4.1 Infraestructura (obligatorio para crecer)

| Feature | Descripción | Depende de |
|---------|-------------|------------|
| **Multi-sucursal** | CRUD locations, dashboard cross-location, shifts con location_id, RBAC por sucursal | Piloto exitoso en 1 local |
| **Procesador de pagos real** | Integración Niubiz o Izipay para verificación automática de Yape/Plin/tarjeta | Gap competitivo crítico (ver 6.3) |
| **Impresora térmica** | Integración con impresoras de tickets (ESC/POS, USB/Bluetooth) | Requisito operativo básico |
| **OpenTelemetry** | Tracing + métricas + alertas en producción | Necesario cuando hay tráfico real |
| **Soporte** | Canal de soporte (WhatsApp business, helpdesk) | Necesario para clientes pagos |

#### 9.4.2 Features de producto (priorizadas por validación del piloto)

| Feature | Descripción | Prioridad probable |
|---------|-------------|-------------------|
| **Coupons/Gift cards** | Flujo completo de cupones (stub actual) | Depende de feedback |
| **Birthday automation** | Promos automáticas por cumpleaños | Depende de si CRM se usa |
| **Expiración de puntos** | Puntos de lealtad con vencimiento | Depende de si loyalty se usa |
| **SMS real** | Twilio SMS (stub actual) | Depende de si WhatsApp es suficiente |
| **Webhooks Twilio** | Delivery status callbacks | Depende de volumen de campañas |
| **GPS delivery** | Tracking en tiempo real de motorizados | Solo si delivery es core del local |

### 9.5 Fase P7 — Más Allá del Web (Expansión de Plataforma)

**Objetivo:** Convertir FIRMO POS de "app web" a "plataforma multi-canal".
**Pre-requisito:** P6 estable, múltiples locales operando.

#### 9.5.1 Apps Nativas

| Producto | Plataforma | Para quién | Justificación |
|----------|-----------|------------|---------------|
| **App Mesero** | React Native / Flutter (Android) | Meseros | Browser en Android es lento, propenso a cerrarse; necesitan app dedicada que no se cierre |
| **App Driver** | React Native / Flutter (Android) | Motorizados | GPS tracking requiere background location, imposible en browser |
| **App Dueño** | React Native / Flutter (iOS + Android) | Dueños | Dashboard rápido desde celular, push notifications de ventas |
| **Kiosco** | Android tablet (modo kiosco) | Clientes | Autoservicio, reduce carga de meseros, tendencia en fast-food |

#### 9.5.2 Integraciones Empresariales

| Integración | Para quién | Descripción |
|-------------|-----------|-------------|
| **CONCAR / contabilidad** | Contador del negocio | Exportación automática de asientos contables |
| **PLAME / T-Registro** | RRHH / SUNAT laboral | Exportación de planillas a formato SUNAT |
| **Más plataformas delivery** | Operaciones | Uber Eats, Rappi (solo LlamaFood y PedidosYa hoy) |
| **Izipay / Niubiz directo** | Finanzas | POS de pago físico integrado con la app |

#### 9.5.3 Modelo de Negocio

| Producto | Descripción | Pricing |
|----------|-------------|---------|
| **FIRMO POS Free** | POS básico: ventas, productos, 1 caja, facturación SUNAT | S/0/mes |
| **FIRMO POS Pro** | + KDS, meseros, delivery, inventario, RRHH, CRM | S/X/mes por local |
| **FIRMO POS Enterprise** | + Multi-sucursal, API, integraciones, soporte prioritario | S/Y/mes |
| **Marketplace** | Proveedores de pollo conectados directamente al inventario | Comisión % |

### 9.6 Visión a Largo Plazo — P8+

| Área | Descripción | Pre-requisito |
|------|-------------|---------------|
| **Franquicias** | Portal de franquiciador con métricas cross-tenant, control de menú centralizado | Multi-sucursal estable |
| **IA recomendaciones** | Upselling basado en historial, predicción de demanda, optimización de inventario | Datos reales de 6+ meses |
| **Marketplace proveedores** | Proveedores de pollo, insumos, bebidas conectados para pedido automático | Base de clientes activa |
| **Expansión vertical** | Cevicherías, chifas, cafeterías (adaptar el vertical) | Producto validado en pollerías |
| **Expansión geográfica** | Colombia, Ecuador, Bolivia (adaptar facturación electrónica) | Producto estable en Perú |

---

## 10. Métricas de Éxito

### 10.1 Métricas de Producto

| KPI | Meta | Cómo se mide |
|-----|------|--------------|
| Tiempo de pedido (mesa→cocina) | < 30 seg | Timestamp ORDER_CREATED → ORDER_SUBMITTED |
| Tiempo de cobro | < 15 seg | Timestamp CHECK_CREATED → CHECK_MARKED_PAID |
| Uptime del sistema | > 99.5% | Health check endpoint |
| Sync latencia | < 200ms P95 | Event ingest round-trip |
| Offline recovery | < 5 seg | Tiempo de reconexión + sync |

### 10.2 Métricas de Negocio

| KPI | Meta | Cómo se mide |
|-----|------|--------------|
| Facturación SUNAT exitosa | > 99% | invoice_queue success rate |
| Cuadre de caja | 100% | shift.diff_cents === 0 |
| Retención de clientes | > 60% mes | RFM recency_days < 30 |
| Puntos canjeados | > 20% de earned | loyalty_ledger REDEEM / EARN ratio |
| Campañas enviadas | > 95% delivery | message_outbox SENT / total |

### 10.3 Métricas Técnicas

| Métrica | Valor Actual | Meta |
|---------|-------------|------|
| Tests passing | 5,457/5,458 | 100% (1 flaky pre-existente) |
| TypeScript errors | 0 | 0 |
| API endpoints sin auth | 0/296 | 0 |
| Tablas con RLS | 123/128 | 128/128 |
| Bundle size | 5.15 MB | < 6 MB |

---

## 11. Riesgos y Mitigaciones

### 11.1 Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| SUNAT cambia API | Media | Alto | Adapter pattern + Nubefact fallback |
| Internet inestable en pollería | Alta | Alto | Offline-first con Dexie + sync |
| Twilio rate limits | Media | Medio | Outbox worker con rate limit 1msg/sec |
| Datos de prueba en producción | Alta | Medio | CI usa DB separada (ya configurado) |
| Deploy pipeline sin configurar | Alta | Alto | Configurar Vercel CLI en CI/CD |
| Falta certificado digital SUNAT | Alta | Bloqueante | Gestionar con SUNAT antes de launch |
| Usuario cierra pestaña = pierde IndexedDB | Media | Alto | Service Worker + persistent storage API |
| Browser update rompe Dexie/IndexedDB | Baja | Crítico | Monitorear changelogs de Chrome/Firefox |

### 11.2 Riesgos de Producto

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **0 validación con usuarios reales** | Certeza | Crítico | Piloto urgente en 1 pollería antes de seguir construyendo |
| Flujos "funcionales" fallan con datos reales | Alta | Alto | E2E con seed de datos realistas, testing manual |
| Registro manual de Yape no cuadra con caja | Alta | Alto | Integrar Niubiz/Izipay o al menos notificación push |
| Dueños no entienden la UI | Media | Alto | User testing, simplificar dashboards |
| 37 items en sidebar abruman al usuario | Media | Medio | Mostrar solo lo relevante por rol/plan |
| Feature creep: seguir construyendo sin validar | Alta | Alto | Congelar features, enfocar en piloto |

### 11.3 Riesgos Competitivos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Inforest/Restaurant.pe ya tienen mercado capturado | Alta | Alto | Diferenciarse en precio (S/0) + CRM + offline |
| Toast entra a LATAM | Baja | Crítico | Velocidad: lanzar antes de que lleguen |
| POS genéricos mejoran vertical pollo | Media | Medio | Profundizar diferenciación (control pollo, recetas, merma) |

---

## 12. Dependencias y Pre-requisitos para Producción

### 12.1 Bloqueantes

| # | Item | Responsable | Estado |
|---|------|-------------|--------|
| 1 | Fix 2 bugs SUNAT queue worker | Desarrollo | ⬜ Pendiente |
| 2 | Credenciales SOL reales | Negocio (SUNAT) | ⬜ Pendiente |
| 3 | Certificado digital SUNAT | Negocio (SUNAT) | ⬜ Pendiente |
| 4 | Configurar deploy pipeline | DevOps | ⬜ Pendiente |
| 5 | Testing contra SUNAT BETA | QA | ⬜ Pendiente |

### 12.2 Importantes (no bloqueantes)

| # | Item | Estado |
|---|------|--------|
| 6 | Twilio producción (WhatsApp) | ⬜ Pendiente |
| 7 | DNS y dominio producción | ⬜ Pendiente |
| 8 | Backup strategy Supabase | ⬜ Pendiente |
| 9 | Monitoring alerts (PagerDuty/similar) | ⬜ Pendiente |
| 10 | Onboarding docs para clientes | ⬜ Pendiente |

---

## 13. Glosario

| Término | Definición |
|---------|-----------|
| **Boleta** | Comprobante de pago para consumidor final (SUNAT) |
| **Factura** | Comprobante para empresa con RUC (SUNAT) |
| **IGV** | Impuesto General a las Ventas (18% en Perú) |
| **SOL** | Sistema de Operaciones en Línea de SUNAT |
| **CDR** | Constancia de Recepción (respuesta de SUNAT) |
| **RUC** | Registro Único de Contribuyentes |
| **DNI** | Documento Nacional de Identidad |
| **Z-Report** | Reporte fiscal de cierre de turno |
| **Centavos** | Unidad monetaria interna (1 sol = 100 centavos) |
| **RFM** | Recency, Frequency, Monetary (segmentación de clientes) |
| **KDS** | Kitchen Display System |
| **SSE** | Server-Sent Events (real-time unidireccional) |
| **RLS** | Row-Level Security (aislamiento en PostgreSQL) |
| **Pollería** | Restaurante especializado en pollo a la brasa |

---

## Apéndice A: Estructura de Archivos Clave

```
park/
├── prisma/
│   ├── schema.prisma          # 128 modelos, 2,858 líneas
│   ├── migrations/            # 42 migraciones
│   └── rls/                   # SQL de Row-Level Security
├── src/
│   ├── app/
│   │   ├── admin/             # 59 páginas admin
│   │   ├── pos/               # 6 páginas POS
│   │   ├── mozo/              # 4 páginas mesero
│   │   ├── cocina/            # 3 páginas KDS
│   │   ├── bar/               # 1 página KDS bar
│   │   ├── employee/          # 5 páginas portal
│   │   ├── delivery/          # 1 página driver
│   │   └── api/               # 296 endpoints
│   ├── core/
│   │   ├── services/          # 47 servicios de negocio
│   │   ├── domain/            # events.ts (73 tipos)
│   │   ├── jobs/              # 4 background workers
│   │   ├── integrations/      # SUNAT, peru-identity, platforms
│   │   ├── projections/       # reducers (sale, shift)
│   │   ├── db/                # Prisma singleton, Dexie schema
│   │   ├── auth/              # JWT, sessions, fingerprint
│   │   ├── middleware/        # admin-auth, pos-auth, rate-limit
│   │   ├── observability/     # pino, structured-logger, tracing
│   │   ├── delivery/          # WhatsApp, assignment, tracking
│   │   ├── sync/              # offline sync, circuit breaker
│   │   └── types/             # branded types (14)
│   └── test-utils/            # helpers, arbitraries, mocks
├── e2e/                       # 31 Playwright specs
├── .github/workflows/ci.yml   # 5-job CI pipeline
├── vercel.json                # 5 cron jobs
└── docs/PRD.md                # Este documento
```

---

## Apéndice B: Event Types (73)

### Por Agregado

| Agregado | Eventos | Proyección Server |
|----------|---------|-------------------|
| SHIFT | SHIFT_OPENED, SHIFT_CLOSED, CASH_ADJUSTED | ✅ 3/3 |
| ORDER | ORDER_CREATED, ORDER_ITEM_ADDED, ORDER_ITEM_QTY_CHANGED, ORDER_ITEM_STATUS_CHANGED, ORDER_ITEM_VOIDED, ORDER_CANCELLED, ORDER_SUBMITTED, ORDER_COURSE_FIRED, REQUEST_CHECK | ✅ 2/9 |
| CHECK | CHECK_CREATED, CHECK_PAYMENT_ADDED, CHECK_MARKED_PAID, CHECK_TIP_SET, CHECK_ITEMS_UPDATED, CHECK_ITEMS_MOVED | ✅ 3/6 |
| INVOICE | INVOICE_ISSUED, INVOICE_VOIDED, CREDIT_NOTE_ISSUED, CREDIT_NOTE_VOIDED, REFUND_ISSUED | ✅ 4/5 |
| SUNAT | INVOICE_SENT_TO_SUNAT, INVOICE_SUNAT_ACCEPTED, INVOICE_SUNAT_REJECTED, DAILY_SUMMARY_SENT | ⬜ 0/4 |
| INVENTORY | 9 tipos (purchase, goods receipt, adjust, waste, count, deduct, COGS) | ⬜ 0/9 |
| DELIVERY | 6 tipos (assigned, status, handoff, platform received/accepted/rejected) | ⬜ 0/6 |
| HR | 13 tipos (employee, attendance, leave, advance, payroll, evaluation, training) | ⬜ 0/13 |
| RESERVATION | 6 tipos (created, confirmed, cancelled, arrived, seated, no-show) | ⬜ 0/6 |
| SAGA | 7 tipos (started, step completed/failed/compensated, completed, compensated, failed) | ⬜ 0/7 |
| CATALOG | 3 tipos (version bumped, product available/unavailable) | ⬜ 0/3 |
| PROMOTION | 3 tipos (tentative, validated, removed) | ✅ 2/3 |
| CUSTOMER | 2 tipos (loyalty earned, loyalty redeemed) | ⬜ 0/2 |

**Total: 73 eventos, 15 con projection server-side, 58 store-only**

---

*Documento generado el 6 de Marzo de 2026. Refleja el estado real del código auditado.*
