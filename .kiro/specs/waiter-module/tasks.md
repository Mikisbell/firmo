# Implementation Plan: Waiter Module

## Overview

Este plan implementa las mejoras al módulo de Mesero en fases incrementales. Cada fase entrega valor funcional y puede ser probada independientemente. El enfoque es eliminar primero los valores hardcodeados (bloqueadores críticos), luego agregar funcionalidades nuevas.

## Tasks

- [ ] 1. Eliminar valores hardcodeados y usar Terminal_Config
  - [x] 1.1 Actualizar `src/app/mozo/mesa/[tableId]/page.tsx` para usar `getStoredTerminalConfig()` en lugar de constantes TENANT_ID, TERMINAL_ID, ACTOR_ID
    - Importar `getStoredTerminalConfig` de `@/src/core/auth/fingerprint`
    - Reemplazar constantes hardcodeadas con valores del config
    - Agregar validación y redirect si no hay config
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Write property test for terminal config consistency
    - **Property 1: Terminal Configuration Consistency**
    - **Validates: Requirements 1.3, 1.4**
    - Created `src/app/mozo/__tests__/terminal-config.property.test.ts` with 12 tests

- [x] 2. Expandir configuración de mesas de 9 a 55 (con CRUD desde Admin)
  - [x] 2.1 Crear API y página de admin para gestión de mesas y zonas
    - Creado `src/app/api/admin/tables/route.ts` (GET, POST)
    - Creado `src/app/api/admin/tables/[id]/route.ts` (GET, PUT, DELETE)
    - Creado `src/app/api/admin/zones/route.ts` (GET, POST)
    - Creado `src/app/admin/mesas/page.tsx` con DataTable, filtros por zona, modal CRUD
    - Usa modelo `tables` y `zones` existentes en Prisma
    - Agregado enlace en AdminSidebar
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Actualizar `src/app/mozo/hooks/useTableStatus.ts` para usar API
    - Carga mesas desde `/api/admin/tables?active=true`
    - Agregado campo zone a TableInfo
    - Calcula elapsedMinutes desde ORDER_CREATED timestamp
    - Cuenta readyItemsCount desde eventos ORDER_ITEM_STATUS_CHANGED
    - Agregado hook useZones() para cargar zonas
    - _Requirements: 2.4, 2.5, 9.1, 9.2_


  - [x] 2.3 Write property test for table organization by floor
    - **Property 3: Table Organization by Floor**
    - **Validates: Requirements 2.2**

- [ ] 3. Actualizar UI del mapa de mesas
  - [x] 3.1 Actualizar `src/app/mozo/page.tsx` para usar nueva configuración de pisos
    - Agregado opción "Todas" las zonas
    - Agregado indicador de tiempo transcurrido real con colores
    - Agregado badge de items listos mejorado
    - Agregado indicador de zona cuando se muestran todas
    - Agregado leyenda de colores
    - _Requirements: 2.2, 2.4, 2.5, 9.2_

  - [x] 3.2 Implementar códigos de color por estado y tiempo
    - Verde: FREE (disponible)
    - Azul/Violeta: OCCUPIED < 20min
    - Naranja: OCCUPIED >= 20min
    - Rojo (pulsante): OCCUPIED >= 40min (alerta)
    - Ámbar (pulsante): BILL_REQUESTED
    - _Requirements: 2.4, 9.3, 9.4_

  - [ ] 3.3 Write property test for table status color mapping
    - **Property 4: Table Status Color Mapping**
    - **Validates: Requirements 2.4, 9.3, 9.4**

- [ ] 4. Checkpoint - Verificar configuración dinámica
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que las 55 mesas se muestran correctamente
  - Verificar que el terminal_id se lee de localStorage

- [ ] 5. Implementar gestión de cantidades (+/-)
  - [x] 5.1 Crear función `updateItemQuantity` en POSActions
    - Agregar método en `src/core/actions/pos.actions.ts`
    - Si newQty > current: emitir ORDER_ITEM_QTY_CHANGED
    - Si newQty < current: emitir ORDER_ITEM_QTY_CHANGED
    - Si newQty = 0: emitir ORDER_ITEM_VOIDED completo
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 5.2 Conectar botones +/- en OrderPanel para mesero
    - Actualizar `src/app/mozo/mesa/[tableId]/page.tsx`
    - Agregar handlers onIncrement y onDecrement
    - Llamar a POSActions.updateItemQuantity
    - _Requirements: 4.1, 4.2_

  - [ ] 5.3 Write property test for quantity increment/decrement
    - **Property 8: Quantity Increment/Decrement**
    - **Validates: Requirements 4.1, 4.2**


- [ ] 6. Implementar solicitud de cuenta (REQUEST_CHECK)
  - [x] 6.1 Agregar evento REQUEST_CHECK en `src/core/domain/events.ts`
    - Definir RequestCheckPayload interface
    - Agregar "REQUEST_CHECK" al union type de eventos
    - _Requirements: 6.1, 6.2_

  - [x] 6.2 Implementar `requestCheck` en POSActions
    - Agregar método en `src/core/actions/pos.actions.ts`
    - Validar que orden tiene items
    - Emitir evento REQUEST_CHECK con payload completo
    - _Requirements: 6.1, 6.2_

  - [x] 6.3 Conectar botón "Pedir Cuenta" en OrderPanel
    - Actualizar handler onCallBill en `src/app/mozo/mesa/[tableId]/page.tsx`
    - Llamar a POSActions.requestCheck
    - Mostrar toast de confirmación
    - _Requirements: 6.1_

  - [x] 6.4 Actualizar useTableStatus para detectar BILL_REQUESTED
    - Procesar eventos REQUEST_CHECK
    - Cambiar status de mesa a BILL_REQUESTED
    - _Requirements: 6.4_

  - [ ] 6.5 Write property test for request check event payload
    - **Property 13: Request Check Event Payload**
    - **Validates: Requirements 6.1, 6.2**

- [ ] 7. Implementar envío a cocina (ORDER_SUBMITTED)
  - [x] 7.1 Agregar evento ORDER_SUBMITTED en `src/core/domain/events.ts`
    - Definir OrderSubmittedPayload interface
    - Incluir items con station, modifiers, notes
    - _Requirements: 7.1_

  - [x] 7.2 Implementar `submitToKitchen` en POSActions
    - Agregar método en `src/core/actions/pos.actions.ts`
    - Validar que orden tiene items (rechazar vacía)
    - Agrupar items por station
    - Emitir evento ORDER_SUBMITTED
    - _Requirements: 7.1, 7.2, 7.4, 7.6_

  - [x] 7.3 Conectar botón "Enviar a Cocina" en OrderPanel
    - Actualizar handler onSendToKitchen
    - Llamar a POSActions.submitToKitchen
    - Mostrar toast con confirmación
    - _Requirements: 7.1, 7.5_

  - [ ] 7.4 Write property test for station routing
    - **Property 16: Station Routing**
    - **Validates: Requirements 7.2**

  - [ ] 7.5 Write property test for empty order rejection
    - **Property 18: Empty Order Rejection**
    - **Validates: Requirements 7.6**


- [ ] 8. Checkpoint - Verificar flujo completo de pedido
  - Ensure all tests pass, ask the user if questions arise.
  - Probar: Crear orden → Agregar items → Modificar cantidad → Enviar a cocina → Pedir cuenta

- [ ] 9. Implementar notificaciones de items listos
  - [ ] 9.1 Agregar evento ORDER_ITEM_STATUS_CHANGED en events.ts
    - Definir OrderItemStatusChangedPayload interface
    - Incluir previous_status, new_status, station
    - _Requirements: 8.1_

  - [ ] 9.2 Crear hook `useWaiterNotifications`
    - Crear `src/app/mozo/hooks/useWaiterNotifications.ts`
    - Suscribirse a eventos ORDER_ITEM_STATUS_CHANGED
    - Filtrar por mesas del mesero actual
    - Agrupar notificaciones por mesa
    - _Requirements: 8.2, 8.3, 8.7_

  - [ ] 9.3 Crear componente NotificationBadge
    - Mostrar badge pulsante en tarjeta de mesa
    - Mostrar count de items listos
    - _Requirements: 8.4_

  - [ ] 9.4 Write property test for notification grouping
    - **Property 20: Notification Grouping**
    - **Validates: Requirements 8.7**

- [ ] 10. Implementar búsqueda de productos
  - [ ] 10.1 Agregar campo de búsqueda en CatalogGrid
    - Actualizar `src/app/pos/components/CatalogGrid.tsx`
    - Agregar input de búsqueda con debounce
    - Filtrar productos por nombre (case-insensitive)
    - _Requirements: 3.4_

  - [ ] 10.2 Write property test for search results relevance
    - **Property 7: Search Results Relevance**
    - **Validates: Requirements 3.4**

- [ ] 11. Implementar pre-cuenta visual
  - [ ] 11.1 Crear componente PreCheckModal
    - Crear `src/app/mozo/components/PreCheckModal.tsx`
    - Mostrar lista de items con precios
    - Calcular subtotal, impuestos, total
    - Botón para cerrar
    - _Requirements: 6.5, 6.7_

  - [ ] 11.2 Conectar botón "Ver Pre-Cuenta" en OrderPanel
    - Agregar handler onPrintPrecheck
    - Abrir PreCheckModal
    - _Requirements: 6.5_

  - [ ] 11.3 Write property test for pre-check total accuracy
    - **Property 15: Pre-Check Total Accuracy**
    - **Validates: Requirements 6.7**


- [ ] 12. Implementar resumen de turno del mesero
  - [ ] 12.1 Crear hook `useWaiterShift`
    - Crear `src/app/mozo/hooks/useWaiterShift.ts`
    - Calcular mesas atendidas, ventas totales, propinas
    - Filtrar por actor_id del mesero actual
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 12.2 Crear página Mi Turno
    - Crear `src/app/mozo/mi-turno/page.tsx`
    - Mostrar estadísticas del turno
    - Lista de mesas atendidas
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 12.3 Write property test for shift summary accuracy
    - **Property 27: Shift Summary Accuracy**
    - **Validates: Requirements 11.2**

- [ ] 13. Mejorar modo offline
  - [ ] 13.1 Agregar indicador de sync en header
    - Actualizar header en `src/app/mozo/page.tsx`
    - Mostrar progreso de sincronización
    - Mostrar estado OFFLINE prominente
    - _Requirements: 10.4, 12.1_

  - [ ] 13.2 Verificar queue de eventos offline
    - Confirmar que eventos se guardan en IndexedDB cuando offline
    - Confirmar sync automático al reconectar
    - _Requirements: 12.2, 12.3_

  - [ ] 13.3 Write property test for offline queue and sync
    - **Property 25: Offline Queue and Sync**
    - **Validates: Requirements 12.2, 12.3**

- [ ] 14. Checkpoint final - Verificar todas las funcionalidades
  - Ensure all tests pass, ask the user if questions arise.
  - Probar flujo completo con múltiples mesas
  - Probar modo offline
  - Verificar notificaciones

## Notes

- All tasks are required for complete implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (12 property tests total)
- Unit tests validate specific examples and edge cases
- El orden de implementación prioriza eliminar bloqueadores (hardcoded values) primero
