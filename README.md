# 🍗 PARK POS

> Sistema POS offline-first de alto rendimiento para pollerías peruanas

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748)](https://www.prisma.io/)
[![Tests](https://img.shields.io/badge/Tests-214%20unit%20%2B%2052%20E2E-green)](./e2e)

**PARK POS** es un sistema punto de venta empresarial diseñado específicamente para pollerías y parrilleras en Perú. Construido con arquitectura Event Sourcing y capacidad offline-first, soporta operaciones multi-terminal con sincronización en tiempo real.

---

## 🚀 Inicio Rápido

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/park.git
cd park

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Ejecutar migraciones de base de datos
npx prisma migrate dev

# Sembrar datos de prueba
npx prisma db seed

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

**Credenciales de prueba:**
- PIN Admin: `1234`
- PIN Cajero: `5678`
- PIN Mesero: `9012`

---

## ✨ Características Principales

### 🔌 Offline-First
- Funciona 100% sin conexión a internet
- Sincronización automática cuando hay conectividad
- Event Sourcing para trazabilidad completa

### 📱 Multi-Terminal
- Soporte para 15+ terminales simultáneos
- 1 caja principal + múltiples terminales de meseros
- Kitchen Display System (KDS) por estación

### 💰 Gestión Financiera
- Split bill (división de cuenta por items o porcentaje)
- Múltiples métodos de pago (Efectivo, Yape, Plin, Tarjeta)
- Facturación electrónica SUNAT (Boletas y Facturas)
- Control de turnos con apertura/cierre de caja

### 🍽️ Operaciones de Restaurante
- Gestión de mesas y zonas
- Sistema de pedidos para dine-in, takeout y delivery
- KDS con 5 estaciones (Parrilla, Bar, Cocina Fría, Freidora, Expedición)
- Tracking de delivery en tiempo real

### 📊 Reportes y Analytics
- Dashboard en tiempo real
- Reportes de ventas por período
- Análisis de productos más vendidos
- Métricas de rendimiento por empleado

### 🔐 Seguridad Enterprise
- Multi-tenant con aislamiento completo (RLS)
- Autenticación por PIN con lockout
- Control de acceso basado en roles
- Auditoría completa de todas las operaciones

---

## 📋 Requisitos del Sistema

### Mínimos
- Node.js 18.x o superior
- PostgreSQL 14.x o superior
- 4 GB RAM
- 10 GB espacio en disco

### Recomendados
- Node.js 20.x LTS
- PostgreSQL 15.x
- 8 GB RAM
- 20 GB espacio en disco SSD
- Conexión a internet estable (para sync)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                  15 TERMINALES                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  ┌─────────┐     │
│  │Terminal1│ │Terminal2│ │Terminal3│  │TerminalN│     │
│  │ (Tablet)│ │  (PC)   │ │ (Móvil) │  │(Tablet) │     │
│  └────┬────┘ └────┬────┘ └────┬────┘  └────┬────┘     │
│       │           │           │            │           │
│       └───────────┴─────┬─────┴────────────┘           │
│                         ▼                               │
│         ┌───────────────────────────────┐              │
│         │   IndexedDB (Dexie)           │ ← Local      │
│         │   Event Log por Terminal      │              │
│         └───────────────┬───────────────┘              │
│                         │                               │
│    ┌────────────────────┼────────────────────┐         │
│    ▼                    ▼                    ▼         │
│ ┌──────┐           ┌─────────┐          ┌─────────┐   │
│ │ CAJA │           │   KDS   │          │DELIVERY │   │
│ │Cobros│           │ Cocina  │          │Tracking │   │
│ └──────┘           └─────────┘          └─────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   Supabase (PostgreSQL)       │ ← Cloud
         │   63 Tablas Enterprise        │
         └───────────────────────────────┘
```

**Principios de Diseño:**
- **Event Sourcing:** Todos los cambios son eventos inmutables
- **Device-SoT:** Cada terminal es fuente de verdad para sus eventos
- **CQRS-light:** Proyecciones optimizadas para lectura
- **Offline-First:** Funciona sin conexión, sincroniza cuando puede

Ver [ARCHITECTURE.md](./docs/02-architecture/ARCHITECTURE.md) para detalles completos.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|------------|-----------|
| **Frontend** | Next.js 16 + React 19 | Framework full-stack |
| **UI** | TailwindCSS 4 + Framer Motion | Estilos y animaciones |
| **Base de Datos Local** | Dexie (IndexedDB) | Almacenamiento offline |
| **Base de Datos Cloud** | Supabase (PostgreSQL) | Persistencia en la nube |
| **ORM** | Prisma 6 | Acceso a datos type-safe |
| **Autenticación** | JWT + PIN | Seguridad multi-capa |
| **Testing** | Vitest + Playwright | Tests unitarios y E2E |
| **Validación** | Zod | Validación de esquemas |
| **Estado** | Zustand | Gestión de estado |
| **Sincronización** | SSE + Event Bus | Real-time updates |

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [SETUP.md](./SETUP.md) | Guía completa de instalación y configuración |
| [API.md](./API.md) | Documentación de todos los endpoints |
| [ARCHITECTURE.md](./docs/02-architecture/ARCHITECTURE.md) | Arquitectura técnica detallada |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guía para contribuir al proyecto |
| [DEPLOYMENT.md](./docs/06-deployment/DEPLOYMENT.md) | Guía de despliegue a producción |
| [AGENTS.md](./AGENTS.md) | Uso de agents y skills de Kiro |

### Documentación Técnica Completa

Toda la documentación técnica está organizada en el directorio `docs/`:

- **01-vision/** - Contexto del negocio y especificaciones
- **02-architecture/** - Arquitectura, eventos, seguridad
- **03-features/** - Flujos de funcionalidades (Caja, KDS, Mesero, etc.)
- **04-operations/** - Observabilidad y monitoreo
- **05-improvements/** - Mejoras planificadas y roadmap
- **adr/** - Decisiones arquitectónicas (ADRs)

Ver [docs/README.md](./docs/README.md) para el índice completo.

---

## 🧪 Testing

```bash
# Tests unitarios (214 tests)
npm test

# Tests unitarios en modo watch
npm run test:watch

# Tests de propiedades (property-based testing)
npm run test:property

# Tests E2E con Playwright (52 tests)
npm run test:e2e

# Tests E2E en modo debug
npm run test:e2e:debug

# Tests E2E con UI
npm run test:e2e:headed

# Ver reporte de tests E2E
npm run test:e2e:report

# Tests de estrés
npm run stress-test
```

**Cobertura de Tests:**
- ✅ 214 tests unitarios
- ✅ 52 tests E2E (Playwright)
- ✅ 10 tests de estrés
- ✅ Property-based testing con fast-check

---

## 🚢 Despliegue

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy a producción
vercel --prod
```

### Variables de Entorno Requeridas

```env
# Base de datos
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Autenticación
JWT_SECRET="tu-secret-super-seguro"
PIN_SALT="PARK_POS_2026_"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Redis (opcional, para multi-node)
REDIS_URL="redis://..."
```

Ver [DEPLOYMENT.md](./docs/06-deployment/DEPLOYMENT.md) para guía completa.

---

## 📊 Estado del Proyecto

| Fase | Progreso | Estado |
|------|----------|--------|
| **P0 — MVP** | 100% | ✅ Completado |
| **P1 — Multi-Terminal** | 100% | ✅ Completado |
| **P2 — Growth** | 85% | 🟡 En progreso |

### Últimas Implementaciones

- ✅ Multi-Tenant RLS (19/19 tests E2E pasando)
- ✅ Playwright E2E Optimization (56% reducción en tiempo)
- ✅ Premium Dashboard con analytics en tiempo real
- ✅ Delivery Module completo
- ✅ Admin Panel CRUD (Employees & Products)
- ✅ Saga Pattern con compensating transactions
- ✅ Property-Based Testing expansion

Ver [CHANGELOG.md](./docs/CHANGELOG.md) para historial completo.

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor lee [CONTRIBUTING.md](./CONTRIBUTING.md) para detalles sobre:

- Código de conducta
- Proceso de pull requests
- Estándares de código
- Guía de testing
- Convenciones de commits

---

## 📄 Licencia

Este proyecto es privado y propietario. Todos los derechos reservados.

---

## 🆘 Soporte

- 📧 Email: soporte@parkpos.com
- 💬 Discord: [Únete a nuestra comunidad](https://discord.gg/parkpos)
- 📖 Docs: [https://docs.parkpos.com](https://docs.parkpos.com)
- 🐛 Issues: [GitHub Issues](https://github.com/tu-usuario/park/issues)

---

## 🙏 Agradecimientos

Construido con ❤️ para la industria gastronómica peruana.

**Tecnologías principales:**
- [Next.js](https://nextjs.org/) - Framework React
- [Prisma](https://www.prisma.io/) - ORM moderno
- [Supabase](https://supabase.com/) - Backend as a Service
- [Dexie](https://dexie.org/) - IndexedDB wrapper
- [Playwright](https://playwright.dev/) - Testing E2E

---

**Última actualización:** 13 Febrero 2026  
**Versión:** 2.0.0  
**Estado:** ✅ Production Ready
