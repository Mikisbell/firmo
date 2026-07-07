# 10. Glosario

> Términos del dominio, acrónimos técnicos, y conceptos específicos de FIRMO POS.

## Dominio de Negocio (Pollería Peruana)

| Término | Definición |
|---------|-----------|
| **Pollería** | Restaurante especializado en pollo a la brasa. Negocio principal del mercado objetivo de PARK. |
| **Check (Cuenta)** | Agrupación de ítems de un pedido para cobro. Una orden puede tener múltiples checks (split bill). |
| **Turno (Shift)** | Período operativo de un cajero. Abre con `SHIFT_OPENED`, cierra con `SHIFT_CLOSED`. Cuadre de caja al cierre. |
| **Cuadre de caja** | Verificación de que el dinero físico en caja coincide con lo registrado en el sistema al cierre de turno. |
| **Mesa (Table)** | Mesa física del restaurante. Estados: FREE → OCCUPIED → BILL_REQUESTED. |
| **Zona** | Agrupación de mesas: Salón, Terraza, VIP. |
| **Mozo** | Mesero / waiter. Atiende mesas, toma pedidos, sirve platos. |
| **Boleta** | Comprobante de pago para consumidor final (sin RUC). Regulado por SUNAT. |
| **Factura** | Comprobante de pago para empresas (con RUC). Regulado por SUNAT. |
| **IGV** | Impuesto General a las Ventas. 18% en Perú. Equivalente a IVA. |
| **RUC** | Registro Único de Contribuyentes. Identificador fiscal peruano (11 dígitos). |
| **DNI** | Documento Nacional de Identidad. Identificador personal peruano (8 dígitos). |
| **Yape** | App de pagos QR de BCP (banco más grande de Perú). Sin API — solo deep-link QR. |
| **Plin** | App de pagos QR inter-bancaria peruana. Sin API — solo deep-link QR. |
| **Chicha Morada** | Bebida típica peruana hecha de maíz morado. Item común en menú de pollerías. |
| **Course-fire** | Sistema de timing: la cocina controla cuándo preparar cada curso (entrada → plato principal → postre). |
| **Merma (Waste)** | Pérdida de inventario: productos vencidos, dañados, o desperdicio en preparación. |
| **Kardex** | Registro detallado de movimientos de inventario por producto (entradas, salidas, saldos). |

## Términos Técnicos de PARK

| Término | Definición |
|---------|-----------|
| **ParkEvent** | Discriminated union de 73 tipos de evento. Source of truth del sistema. Definido en `src/core/domain/events.ts`. |
| **Centavos** | Tipo branded para dinero. `2500` = S/ 25.00. Todo cálculo monetario es integer. |
| **Ingest** | Proceso de recibir, deduplicar, validar, y persistir eventos. Endpoint: `POST /api/events/ingest`. |
| **Projection** | Vista materializada derivada de eventos. Las tablas `orders`, `shifts`, `inventory` son projections. |
| **Reducer** | Función pura `(state, event) → { state, warnings }`. Nunca throws. |
| **SyncClient** | Cliente JavaScript que sincroniza eventos de Dexie al servidor. Circuit breaker + backoff exponencial. |
| **Outbox** | Tabla `event_outbox` que garantiza at-least-once delivery de notificaciones post-commit. |
| **Saga** | Orquestación de operaciones multi-paso con compensación. Implementado en `core/saga/`. |
| **Terminal** | Dispositivo físico (tablet, PC) registrado. Cada terminal tiene un código de activación de 6 caracteres. |
| **Soft Lock** | Lock advisory con TTL de 30s. No bloquea, solo advierte de edición concurrente. |
| **KDS** | Kitchen Display System. Pantalla en cocina/bar que muestra tickets de pedidos. |
| **Range Allocator** | Asigna rangos de números de orden a cada terminal para evitar colisiones offline. |

## Acrónimos

| Sigla | Significado |
|-------|-----------|
| **POS** | Point of Sale — Punto de Venta |
| **KDS** | Kitchen Display System |
| **SSE** | Server-Sent Events |
| **JWT** | JSON Web Token |
| **RBAC** | Role-Based Access Control |
| **OCC** | Optimistic Concurrency Control (revision-based) |
| **LWW** | Last-Write-Wins (estrategia de resolución de conflictos) |
| **CQRS** | Command Query Responsibility Segregation |
| **RLS** | Row-Level Security (PostgreSQL) |
| **VAPID** | Voluntary Application Server Identification (Web Push) |
| **ESC/POS** | Epson Standard Code for Point of Sale (protocolo de impresoras térmicas) |
| **CDR** | Constancia de Recepción (respuesta de SUNAT a un comprobante) |
| **PWA** | Progressive Web App |
| **PRNG** | Pseudorandom Number Generator (Mulberry32 en tests) |
| **IGV** | Impuesto General a las Ventas (18%) |
| **SUNAT** | Superintendencia Nacional de Aduanas y de Administración Tributaria |

## Roles del Sistema

| Rol | Código | Acceso |
|-----|--------|--------|
| Dueño | `OWNER` | Todo. Nivel jerárquico 4. |
| Administrador | `ADMIN` | Todo excepto gestión de tenants. Nivel 3. |
| Gerente | `MANAGER` | Operaciones + reportes. Nivel 2. |
| Supervisor | `SUPERVISOR` | Operaciones limitadas. Nivel 1. |
| Cajero | `CASHIER` | POS solamente. |
| Mesero | `WAITER` | Mozo solamente. |
| Cocina | `KITCHEN` | KDS Cocina. |
| Cocinero | `COOK` | KDS Cocina (alias). |
| Empacador | `PACKER` | KDS Empaque. |
| Bartender | `BAR` | KDS Bar. |
| Repartidor | `DRIVER` | Delivery + push notifications. |
