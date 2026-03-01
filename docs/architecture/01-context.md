# 1. Contexto del Sistema

> Quiénes interactúan con PARK POS y qué sistemas externos se integran.

## Diagrama de Contexto (C4 Level 1)

```
                              ┌─────────────┐
                              │   SUNAT     │
                              │ (Hacienda)  │
                              └──────▲──────┘
                                     │ Boletas/Facturas
                                     │ SOAP + REST (Nubefact)
                                     │
┌──────────┐   ┌──────────┐   ┌──────┴──────────────────────────────┐   ┌──────────┐
│ PedidosYa│──▶│          │   │                                     │   │  Twilio  │
│          │   │          │   │          PARK POS                    │──▶│ WhatsApp │
└──────────┘   │          │   │                                     │   └──────────┘
               │ Webhooks │──▶│  Next.js 16 monolito               │
┌──────────┐   │ (inbound)│   │  PostgreSQL + Redis + Dexie         │   ┌──────────┐
│LlamaFood │──▶│          │   │                                     │──▶│  Sentry  │
│          │   └──────────┘   └──┬───┬───┬───┬───┬───┬──────────────┘   └──────────┘
└──────────┘                    │   │   │   │   │   │
                                │   │   │   │   │   │        ┌──────────┐
              ┌─────────────────┘   │   │   │   │   └───────▶│ Logtail  │
              │                     │   │   │   │            │Better Stk│
              ▼                     ▼   │   ▼   ▼            └──────────┘
         ┌────────┐           ┌────────┐│┌────────┐
         │ Cajero │           │Cocinero│││ Admin  │
         │        │           │  KDS   │││        │
         └────────┘           └────────┘│└────────┘
                                        │
                    ┌───────────────────┬┴──────────────┐
                    ▼                   ▼               ▼
              ┌──────────┐       ┌──────────┐    ┌──────────┐
              │  Mesero   │       │ Repartidor│    │ Cliente  │
              │  (Mozo)   │       │ (Driver)  │    │(Reservas)│
              └──────────┘       └──────────┘    └──────────┘
```

## Actores Humanos

| Actor | Interacción | Módulo |
|-------|-------------|--------|
| **Cajero** | Opera el POS, abre/cierra turnos, cobra, imprime tickets | `/pos` |
| **Mesero (Mozo)** | Ve mesas, toma pedidos, recibe notificaciones | `/mozo` |
| **Cocinero** | Ve tickets en KDS, marca ítems como preparando/listos | `/cocina`, `/bar` |
| **Empacador** | Ve órdenes de empaque en KDS | `/cocina/empaque` |
| **Bartender** | Ve pedidos de bebidas en KDS | `/bar` |
| **Admin/Owner** | Gestiona productos, empleados, reportes, config | `/admin/*` |
| **Empleado** | Portal self-service: horarios, asistencia, nómina | `/employee` |
| **Repartidor (Driver)** | Recibe notificaciones push, actualiza estado delivery | PWA + push |
| **Cliente** | Reserva mesas vía web pública | `/reservar/[tenantSlug]` |
| **Almacenero** | Recibe mercancía, registra mermas, conteo físico | `/inventario` |

## Sistemas Externos

| Sistema | Dirección | Protocolo | Datos |
|---------|-----------|-----------|-------|
| **SUNAT** | Outbound | SOAP directo + REST vía Nubefact | Boletas, facturas, notas de crédito, CDR |
| **PedidosYa** | Bidireccional | Webhook in (HMAC-SHA256) + REST out (Bearer) | Pedidos delivery, aceptación, estado |
| **LlamaFood** | Bidireccional | Webhook in (HMAC-SHA256) + REST out (X-Api-Key) | Pedidos delivery, aceptación, estado |
| **Twilio WhatsApp** | Outbound | REST (Basic auth) | 5 templates: asignación, despacho, ETA, entregado, fallido |
| **Web Push (VAPID)** | Outbound | W3C Web Push | Notificaciones a drivers y empleados |
| **Sentry** | Outbound | SDK (`@sentry/nextjs`) | Errores y excepciones (opt-in, 10% sample) |
| **Logtail (Better Stack)** | Outbound | Pino transport | Logs estructurados JSON con redacción automática |
| **Slack** | Outbound | Incoming Webhook | Alertas operacionales del sistema |
| **Yape / Plin** | Display only | QR deep-link (sin API) | Monto y concepto; confirmación manual |
| **Supabase** | Internal | PostgreSQL connection + LISTEN/NOTIFY | Event bus entre instancias |

## Integraciones NO Implementadas

| Sistema | Estado | Nota |
|---------|--------|------|
| **Email** | TODO (stub) | `alert-notifier.ts` tiene placeholder, sin proveedor configurado |
| **Rappi** | Env var existe | `RAPPI_API_KEY` en config pero sin adapter implementado |
| **Payment gateways** (Visa, Mastercard) | No iniciado | Pagos con tarjeta se registran manualmente |
| **Impresora térmica real** | Driver listo, transporte pendiente | ESC/POS bytes generados, WebUSB/TCP definidos, sin integración E2E |
