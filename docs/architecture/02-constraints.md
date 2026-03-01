# 2. Restricciones Arquitectónicas

> Limitaciones no negociables que condicionan todas las decisiones de diseño.

## Restricciones de Negocio

| Restricción | Impacto |
|-------------|---------|
| **Mercado objetivo: pollerías peruanas** | Un solo idioma (español), una sola moneda (PEN), regulación SUNAT |
| **Operación offline obligatoria** | Internet en Perú es inestable. El cajero DEBE poder vender sin conexión por horas |
| **Facturación electrónica SUNAT** | Obligatorio emitir boletas/facturas electrónicas con firma digital. Plazo de contingencia: 7 días |
| **IGV 18%** | Impuesto fijo. Cálculo: `base * 0.18`. Desglose obligatorio en tickets |
| **Multi-tenant SaaS** | Cada pollería es un tenant. Aislamiento de datos obligatorio |

## Restricciones Regulatorias

| Regulación | Requisito | Implementación |
|------------|-----------|----------------|
| **SUNAT — Resolución N° 340-2017** | Emisión de comprobantes electrónicos | Integración SOAP directa + Nubefact como proxy |
| **SUNAT — Contingencia** | Si SUNAT no responde, emitir offline y reconciliar en 7 días | `ContingencyManager` con polling cada 60s |
| **Datos personales (Ley 29733)** | Protección de datos de empleados y clientes | Redacción automática de datos sensibles en logs |

## Restricciones Técnicas

| Restricción | Razón | Consecuencia |
|-------------|-------|--------------|
| **Dinero en centavos (integer)** | Evitar errores de floating point | Tipo branded `Centavos`, columnas DB `Int`, display `S/ XX.XX` |
| **tenant_id desde JWT, nunca del cliente** | Prevenir tenant spoofing | Middleware extrae `tid` del token, nunca del body/query |
| **PrismaClient singleton** | Connection pool exhaustion en serverless | `import prisma from '@/src/core/db/prisma'`, prohibido `new PrismaClient()` |
| **Dexie SSR-safe** | IndexedDB no existe en server | Siempre verificar `typeof window !== 'undefined'` antes de acceder |
| **Node.js 22 LTS** | Soporte activo hasta abril 2027 | Alpine images, standalone output |

## Restricciones Organizacionales

| Restricción | Impacto |
|-------------|---------|
| **Equipo pequeño** | Monolito > microservicios. Simplicidad operativa es prioridad |
| **Deploy en Vercel** | Serverless functions, cold starts, sin procesos persistentes |
| **Supabase Cloud** | PostgreSQL managed, sin control de configuración avanzada (e.g., partitioning) |
| **Sin presupuesto para servicios premium** | Web Push (VAPID) en vez de FCM, Logtail free tier, Sentry free tier |

## Convenciones No Negociables

```
1. Código en inglés, mensajes user-facing en español
2. ADMIN_ROLES.includes(role) — NUNCA role === 'ADMIN'
3. Cleanup en tests: deleteMany({ where: { tenant_id } }) — NUNCA deleteMany({})
4. Event reducer retorna { state, warnings } — NUNCA throws
5. fc.date() siempre con bounds; filtrar __proto__/constructor keys
6. Auth obligatoria en TODAS las rutas API sin excepción
```
