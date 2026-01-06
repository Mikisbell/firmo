# 🎯 PARK POS — Master Steering

> **Este archivo guía TODO el desarrollo del proyecto. Léelo SIEMPRE antes de cualquier tarea.**

---

## 📋 CONTEXTO RÁPIDO (30 segundos)

**PARK POS** = Sistema POS offline-first para pollerías peruanas
- **Arquitectura:** Event Sourcing + Device-SoT + IndexedDB/PostgreSQL
- **Stack:** Next.js 15 + Prisma + Dexie + Supabase + Tailwind
- **Fase actual:** P0 (MVP) → 85% completado

**Reglas de oro:**
- 💰 Dinero SIEMPRE en centavos (int), NUNCA float
- 📱 15 terminales + 1 caja + KDS screens
- 🔌 Funciona 100% offline, sincroniza cuando hay conexión

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### P0 — MVP (Antes de producción)

#### Core Event Sourcing
- [x] Eventos base (30+ tipos definidos)
- [x] SyncClient con retry + SSE
- [x] Reducers: sale.reducer, shift.reducer
- [ ] **Outbox Pattern** → `docs/05-improvements/MEJORAS.md#1`
- [ ] **Idempotencia en proyecciones** → `docs/05-improvements/GAPS.md#3`
- [ ] **Server-side validation** → `docs/05-improvements/GAPS.md#4`

#### UI Roles
- [x] Caja (POS principal)
- [x] KDS (Kitchen Display)
- [x] Mesero (Waiter)
- [ ] Split Bill UI incompleto
- [ ] Service Worker para PWA

#### Infraestructura Crítica
- [ ] **Clock Skew handling** → `docs/05-improvements/GAPS.md#1`
- [ ] **Order Number collision fix** → `docs/05-improvements/GAPS.md#2`
- [ ] **Rate Limiting** → `docs/05-improvements/MEJORAS.md#6`
- [ ] **Performance Indices** → `docs/05-improvements/MEJORAS.md#10`
- [ ] **Circuit Breaker** → `docs/05-improvements/MEJORAS.md#4`

#### Datos
- [ ] **Timezone handling** → `docs/05-improvements/GAPS.md#7`
- [ ] **IndexedDB cleanup** → `docs/05-improvements/GAPS.md#8`
- [ ] **JSONB size limits** → `docs/05-improvements/GAPS.md#6`

### P1 — Multi-Terminal (Antes de escalar)

- [ ] **Conflict Resolution** → `docs/05-improvements/MEJORAS.md#5`
- [ ] **Event Schema Versioning** → `docs/05-improvements/MEJORAS.md#2`
- [ ] **Snapshots/Compaction** → `docs/05-improvements/MEJORAS.md#8`
- [ ] **Observabilidad** → `docs/04-operations/OBSERVABILIDAD.md`
- [ ] Terminal registration flow
- [ ] Role-based event validation

### P2 — Growth (Futuro)

- [ ] Saga Pattern para flujos complejos
- [ ] Property-Based Testing
- [ ] Multi-tenant improvements
- [ ] Delivery module completo

---

## 🔄 FLUJO DE TRABAJO AUTOMÁTICO

Cuando el usuario diga **"siguiente tarea"** o **"continuar"**:

1. **Lee este checklist** y encuentra el primer item `[ ]` sin completar
2. **Lee la documentación referenciada** (solo esa sección)
3. **Implementa** siguiendo el código de ejemplo en la doc
4. **Valida** con tests o verificación manual
5. **Marca como completado** `[x]` en este archivo
6. **Reporta** qué se hizo y cuál es la siguiente tarea

### Comando: "status"
Muestra el progreso actual del checklist.

### Comando: "siguiente tarea"
Ejecuta el flujo automático con la siguiente tarea pendiente.

### Comando: "tarea X"
Ejecuta una tarea específica (ej: "tarea Outbox Pattern").

---

## 📁 ESTRUCTURA DE DOCUMENTACIÓN

```
docs/
├── README.md                    # Índice navegable
├── 01-vision/                   # Qué es el proyecto
│   ├── CONTEXT.md              # Contexto del negocio
│   └── SPECS.md                # Especificaciones
├── 02-architecture/             # Cómo está construido
│   ├── ARCHITECTURE.md         # Arquitectura general
│   ├── EVENTS.md               # Sistema de eventos
│   ├── SECURITY.md             # Seguridad
│   └── PERFORMANCE.md          # Optimizaciones
├── 03-features/                 # Funcionalidades
│   ├── PROMOTIONS_DSL.md       # Promociones
│   ├── GROWTH.md               # Features futuras
│   └── NAVEGACION_UX.md        # UX/UI
├── 04-operations/               # Operación
│   └── OBSERVABILIDAD.md       # Monitoring
├── 05-improvements/             # Mejoras planificadas
│   ├── GAPS.md                 # 23 huecos identificados
│   ├── MEJORAS.md              # 10 mejoras arquitectónicas
│   ├── ROADMAP.md              # Plan de implementación
│   ├── ESTADO.md               # Status actual
│   └── RESUMEN.md              # Resumen ejecutivo
├── adr/                         # Decisiones arquitectónicas
└── CHANGELOG.md                 # Historial
```

---

## ⚡ REFERENCIAS RÁPIDAS

| Necesito... | Archivo |
|-------------|---------|
| Entender el negocio | `docs/01-vision/CONTEXT.md` |
| Ver arquitectura | `docs/02-architecture/ARCHITECTURE.md` |
| Lista de eventos | `docs/02-architecture/EVENTS.md` |
| Gaps críticos | `docs/05-improvements/GAPS.md` |
| Mejoras a implementar | `docs/05-improvements/MEJORAS.md` |
| Plan de trabajo | `docs/05-improvements/ROADMAP.md` |
| Schema Prisma | `prisma/schema.prisma` |
| Eventos TypeScript | `src/core/domain/events.ts` |
| Sync Client | `src/core/sync/client.ts` |
| API Ingest | `src/app/api/events/ingest/route.ts` |

---

## 🚨 REGLAS CRÍTICAS

1. **NO crear archivos .md nuevos** salvo que el usuario lo pida
2. **NO leer toda la documentación** — solo lo necesario para la tarea
3. **Código mínimo** — implementar solo lo esencial
4. **Validar siempre** — usar getDiagnostics después de cambios
5. **Actualizar checklist** — marcar `[x]` al completar

---

**Última actualización:** Enero 2026  
**Próxima tarea pendiente:** Outbox Pattern
