# Implementation Plan: Inventory UI

## Overview

Plan de implementación para la UI completa de gestión de inventario en PARK POS. El proyecto ya tiene implementados los servicios backend (goods-receipt, waste, inventory-count, deduction) y el schema Prisma. Este plan se enfoca en completar la UI y las APIs REST.

**Stack**: Next.js 15 + React + TypeScript + Tailwind + Zod + fast-check
**Ubicación**: `/admin/inventario` (ya existe página base con autenticación PIN)

## Tasks

- [x] 1. Setup y APIs base ✅
  - [x] 1.1 Crear API `/api/inventory/stock` para listar insumos ✅
    - Implementar query con filtros: search, low_stock_only, location_id
    - Calcular status (OK/LOW/CRITICAL) basado en stock vs minStock
    - Incluir summary: lowStockCount, expiringCount, totalValueCents
    - Usar índices existentes para performance < 200ms
    - _Requirements: 1.1, 5.1, 5.2_
  - [x] 1.2 Crear API `/api/inventory/receive` para registrar entradas ✅
    - Validar con Zod: quantity > 0, costCents >= 0, actorId existe
    - Generar evento GOODS_RECEIVED inmutable
    - Registrar audit: actor_id, timestamp, terminal_id
    - _Requirements: 2.2, 2.5, 5.3_
  - [x] 1.3 Crear API `/api/inventory/waste` para registrar mermas ✅
    - Validar con Zod: quantity > 0, reasonCode válido
    - Calcular costCents automáticamente (qty × avgCost)
    - Generar evento WASTE_RECORDED inmutable
    - _Requirements: 3.2, 3.3, 5.4_
  - [x] 1.4 Crear API `/api/inventory/kardex/:code` para historial ✅
    - Retornar movimientos paginados (50 por página)
    - Calcular saldo (balance) para cada movimiento
    - Soportar filtros: startDate, endDate, type
    - Incluir summary: totalIn, totalOut, totalWaste
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 5.5_

- [x] 2. Checkpoint - APIs funcionando
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Componentes UI principales
  - [x] 3.1 Implementar StockView component
    - Lista de insumos con código, nombre, stock, minStock, status
    - Indicadores visuales: 🔴 CRITICAL, 🟡 LOW, 🟢 OK
    - Summary card en la parte superior
    - Campo de búsqueda con debounce 150ms
    - Botones de acción: [+] entrada, [-] merma, [📋] kardex
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 3.2 Write property test for Stock Status Indicator
    - **Property 1: Stock Status Indicator Correctness**
    - **Validates: Requirements 1.2, 1.3**
  - [x] 3.3 Implementar EntryModal component
    - Campos: cantidad, proveedor, factura, lote, fecha vencimiento, costo, notas
    - Validación inline de campos requeridos
    - Fecha vencimiento obligatoria para perecederos
    - Mostrar costo total antes de confirmar
    - _Requirements: 2.1, 2.4, 9.1_
  - [x] 3.4 Implementar WasteModal component
    - Campos: cantidad, lote (selector), motivo, detalle, foto
    - Selector de motivo: EXPIRED, DAMAGED, THEFT, etc.
    - Detalle obligatorio si motivo es THEFT u OTHER
    - Foto obligatoria si costo > S/50
    - Mostrar costo calculado antes de confirmar
    - Warning si cantidad > stock disponible
    - _Requirements: 3.1, 3.4, 3.6, 3.7_
  - [x] 3.5 Write property test for Waste Cost Calculation
    - **Property 9: Waste Cost Calculation**
    - **Validates: Requirements 3.3, 3.4, 3.7**

- [x] 4. Checkpoint - UI básica funcionando
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Kardex y historial
  - [x] 5.1 Implementar KardexModal component
    - Lista de movimientos con: fecha, tipo, cantidad, saldo, referencia, actor
    - Iconos por tipo: 📥 IN, 📤 OUT, 🗑️ WASTE, ⚖️ ADJUST
    - Ordenado por fecha descendente
    - Paginación cuando > 50 movimientos
    - Filtros: rango de fechas, tipo de movimiento
    - Summary: total entradas, salidas, mermas del período
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 5.2 Write property test for Kardex Display
    - **Property 5: Kardex Display Correctness**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
  - [x] 5.3 Implementar sección "Últimos Movimientos" en StockView
    - Mostrar últimos 10 movimientos de cualquier insumo
    - Click en movimiento resalta el insumo en la lista
    - Actualización automática al registrar nuevo movimiento
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 6. Checkpoint - Kardex funcionando ✅
  - Ensure all tests pass, ask the user if questions arise.
  - **120 tests passing** (23 property + 27 unit + 45 stress + 25 services)

- [x] 7. useInventory Hook y estado ✅
  - [x] 7.1 Crear hook useInventory ✅
    - Estado: items, summary, recentMovements, isLoading, error
    - Operaciones: receiveGoods, recordWaste, getKardex, search, refresh
    - Optimistic UI: actualizar vista inmediatamente
    - Manejo de errores con toast
    - _Requirements: 2.3, 8.7_
  - [x] 7.2 Implementar IndexedDB para eventos offline ✅
    - Schema Dexie para pendingEvents
    - Guardar eventos cuando no hay conexión
    - Sync automático cuando vuelve conexión
    - Retry con backoff exponencial
    - _Requirements: 2.7_
  - [x] 7.3 Write property test for Offline Event Persistence ✅
    - **Property 8: Offline Event Persistence Round-Trip**
    - **Validates: Requirements 2.7**
    - **10 tests passing**

- [x] 8. Checkpoint - Hook y offline funcionando ✅
  - **130 tests passing** (23 property + 10 offline + 27 unit + 45 stress + 25 services)

- [x] 9. Seguridad y auditoría ✅
  - [x] 9.1 Agregar middleware de autenticación a APIs ✅
    - Verificar JWT válido en todas las APIs de inventario
    - Verificar rol ADMIN o MANAGER
    - Retornar 401/403 según corresponda
    - _Requirements: 5.8_
  - [x] 9.2 Implementar audit logging ✅
    - Registrar cada operación: endpoint, actor, timestamp, IP, payload
    - Usar tabla existente o crear audit_log
    - _Requirements: 5.9, 7.4_
  - [x] 9.3 Write property test for Authentication ✅
    - **Property 11: Authentication and Authorization**
    - **Validates: Requirements 5.8, 5.9**
    - **10 tests passing**
  - [x] 9.4 Implementar deduplicación de eventos ✅
    - Verificar event_id único antes de insertar
    - Retornar success si evento ya existe (idempotente)
    - _Requirements: 7.3_
  - [x] 9.5 Write property test for Event Deduplication ✅
    - **Property 7: Event Deduplication**
    - **Validates: Requirements 7.3**
    - **9 tests passing**

- [x] 10. Checkpoint - Seguridad implementada ✅
  - **338 tests passing** (33 property + 27 unit + 45 stress + 233 otros)

- [x] 11. FEFO y alertas de vencimiento ✅
  - [x] 11.1 Implementar indicadores de vencimiento en StockView ✅
    - 🔴 vence hoy/mañana, 🟠 vence en 3 días, 🟡 vence en 7 días
    - Sección "Por Vencer" con productos próximos a vencer
    - _Requirements: 9.2, 9.6_
  - [x] 11.2 Implementar selector de lote en WasteModal ✅
    - Mostrar lotes disponibles con fecha de vencimiento
    - Ordenar por fecha de vencimiento (FEFO)
    - API `/api/inventory/lots/[code]` creada
    - _Requirements: 9.3_
  - [x] 11.3 Write property test for FEFO Compliance ✅
    - **Property 6: FEFO Compliance**
    - **Validates: Requirements 9.4, 9.5, 9.6, 9.7**
    - **10 tests passing**

- [x] 12. Checkpoint - FEFO funcionando ✅
  - **55 tests de componentes de inventario pasando**
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Property tests core ✅
  - [x] 13.1 Write property test for Event Audit Completeness ✅
    - **Property 2: Event Immutability and Audit Completeness**
    - **Validates: Requirements 2.6, 3.5, 7.1, 7.2**
    - **8 tests passing**
  - [x] 13.2 Write property test for Input Validation ✅
    - **Property 3: Input Validation Consistency**
    - **Validates: Requirements 2.4, 2.5, 5.3, 5.4**
    - **11 tests passing**
  - [x] 13.3 Write property test for Stock Calculation ✅
    - **Property 4: Stock Calculation from Events**
    - **Validates: Requirements 7.6**
    - **9 tests passing**
  - [x] 13.4 Write property test for Search Filter ✅
    - **Property 10: Search Filter Correctness**
    - **Validates: Requirements 1.5, 5.2**
    - **15 tests passing**

- [x] 14. Integración y polish
  - [x] 14.1 Integrar componentes en página existente
    - Reemplazar placeholders en `/admin/inventario/page.tsx`
    - Conectar tabs con componentes reales
    - _Requirements: 1.1_
  - [x] 14.2 Implementar skeleton loaders
    - Mostrar skeleton mientras cargan datos
    - _Requirements: 8.2_
  - [x] 14.3 Implementar responsive design
    - Funcionar en tablets (touch-friendly)
    - Botones mínimo 44x44px
    - _Requirements: 8.5, 8.6_
  - [x] 14.4 Implementar feedback visual
    - Toast de éxito/error en cada operación
    - Indicador de sincronización offline
    - _Requirements: 8.7, 8.8_

- [x] 15. Checkpoint final - Sistema completo
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que todas las 11 propiedades de correctitud pasan
  - Verificar flujo completo: entrada → kardex → merma

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- 11 property tests validate universal correctness properties
- El backend (servicios) ya está implementado, este plan se enfoca en UI y APIs REST
- La página base `/admin/inventario` ya existe con autenticación PIN
