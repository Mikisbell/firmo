# Plan de Implementación: Panel de Administración

## Resumen

Implementación del panel de administración centralizado para PARK POS en `/admin`. El desarrollo se divide en fases incrementales, comenzando con la estructura base y autenticación, seguido de cada módulo de gestión.

## Tareas

- [x] 1. Estructura Base y Autenticación
  - [x] 1.1 Crear layout de admin con sidebar y header
    - Crear `src/app/admin/layout.tsx` con navegación lateral
    - Crear `src/app/admin/components/AdminSidebar.tsx`
    - Crear `src/app/admin/components/AdminHeader.tsx`
    - _Requirements: 2.1, 10.1, 10.2, 10.3_

  - [x] 1.2 Implementar autenticación por PIN
    - Reutilizar `PinModal` existente de `/admin/inventario`
    - Implementar lógica de lockout (3 intentos, 5 min bloqueo)
    - Almacenar sesión en localStorage
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.3 Implementar sistema de permisos por rol
    - Crear `src/app/admin/lib/permissions.ts` con ROLE_PERMISSIONS
    - Crear hook `useAdminPermissions()` para verificar acceso
    - _Requirements: 1.4_

  - [x] 1.4 Write property test for role permissions hierarchy
    - **Property 1: Jerarquía de Permisos de Rol**
    - **Validates: Requirements 1.2, 1.4**
    - Created `src/app/admin/__tests__/permissions.property.test.ts` with 16 tests

- [x] 2. Dashboard Principal
  - [x] 2.1 Crear página de dashboard
    - Crear `src/app/admin/page.tsx` con tarjetas de navegación
    - Crear `src/app/admin/components/StatsCard.tsx`
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Implementar API de métricas
    - Crear `src/app/api/admin/dashboard/stats/route.ts`
    - Retornar: ventas del día, órdenes activas, terminales online
    - _Requirements: 2.2, 2.3_

  - [x] 2.3 Implementar polling de métricas
    - Actualizar métricas cada 60 segundos con useEffect
    - _Requirements: 2.4_

- [x] 3. Gestión de Productos
  - [x] 3.1 Crear página de lista de productos
    - Crear `src/app/admin/productos/page.tsx`
    - Implementar búsqueda y filtros (categoría, estación, estado)
    - Crear `src/app/admin/components/DataTable.tsx` reutilizable
    - _Requirements: 3.1_

  - [x] 3.2 Write property test for product filter
    - **Property 2: Filtro de Productos Retorna Resultados Correctos**
    - **Validates: Requirements 3.1**

  - [x] 3.3 Implementar CRUD de productos
    - Crear `src/app/api/admin/products/route.ts` (GET, POST)
    - Crear `src/app/api/admin/products/[id]/route.ts` (GET, PUT, DELETE)
    - Incrementar catalog_version en cada edición
    - _Requirements: 3.2, 3.3_

  - [x] 3.4 Write property test for catalog version increment
    - **Property 3: Versión de Catálogo Incrementa en Edición**
    - **Validates: Requirements 3.3**

  - [x] 3.5 Write property test for price validation
    - **Property 4: Precios Almacenados como Enteros**
    - **Validates: Requirements 3.4**
    - Incrementar catalog_version en cada edición
    - _Requirements: 3.2, 3.3_

  - [ ] 3.4 Write property test for catalog version increment
    - **Property 3: Versión de Catálogo Incrementa en Edición**
    - **Validates: Requirements 3.3**

  - [ ] 3.5 Write property test for price validation
    - **Property 4: Precios Almacenados como Enteros**
    - **Validates: Requirements 3.4**

- [x] 4. Checkpoint - Verificar productos
  - All 29 property tests pass (16 permissions + 13 products)
  - Products API: GET, POST, PUT, DELETE working
  - DataTable component with search and filters

- [x] 5. Gestión de Empleados
  - [x] 5.1 Crear página de lista de empleados
    - Crear `src/app/admin/empleados/page.tsx`
    - Mostrar nombre, rol, zona, estado
    - _Requirements: 4.1_

  - [x] 5.2 Implementar CRUD de empleados
    - Crear `src/app/api/admin/employees/route.ts` (GET, POST)
    - Crear `src/app/api/admin/employees/[id]/route.ts` (GET, PUT, DELETE)
    - Validar unicidad de PIN dentro del tenant
    - Prevenir eliminación del último OWNER/ADMIN
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 5.3 Write property test for PIN uniqueness
    - **Property 5: Unicidad de PIN dentro del Tenant**
    - **Validates: Requirements 4.3**

  - [x] 5.4 Write property test for minimum admin
    - **Property 6: Mínimo un OWNER/ADMIN debe Existir**
    - **Validates: Requirements 4.4**

- [x] 6. Gestión de Terminales
  - [x] 6.1 Crear página de terminales
    - Crear `src/app/admin/terminales/page.tsx`
    - Mostrar terminal_id, tipo, rango, last_seen, estado
    - _Requirements: 5.1_

  - [x] 6.2 Implementar generación de códigos de activación
    - Crear `src/app/api/admin/terminals/activate/route.ts`
    - Generar código de 12 caracteres, válido 24 horas
    - _Requirements: 5.2_

  - [x] 6.3 Write property test for activation codes
    - **Property 7: Códigos de Activación Válidos**
    - **Validates: Requirements 5.2**

  - [x] 6.4 Implementar revocación de terminales
    - Usar is_allowed field para revocar
    - _Requirements: 5.3_

  - [x] 6.5 Implementar asignación de rangos de números
    - Usar `src/core/order-numbers/range-allocator.ts` existente
    - Validar que rangos no se solapen
    - _Requirements: 5.4_

  - [x] 6.6 Write property test for number ranges
    - **Property 8: Rangos de Números No Se Solapan**
    - **Validates: Requirements 5.4**

- [x] 7. Checkpoint - Verificar empleados y terminales
  - All 53 property tests pass
  - Employees: PIN uniqueness + minimum admin validation
  - Terminals: Activation codes + number ranges validation

- [x] 8. Gestión de Promociones
  - [x] 8.1 Crear página de promociones
    - Crear `src/app/admin/promociones/page.tsx`
    - Mostrar nombre, tipo, valor, estado, fechas
    - _Requirements: 6.1_

  - [x] 8.2 Implementar CRUD de promociones
    - Crear `src/app/api/admin/promotions/route.ts` (GET, POST)
    - _Requirements: 6.2_

  - [x] 8.3 Implementar desactivación automática de promociones expiradas
    - Agregar lógica en GET para marcar expiradas como inactivas
    - _Requirements: 6.3_

  - [x] 8.4 Write property test for promotion expiration
    - **Property 9: Promociones Expiradas Se Desactivan**
    - **Validates: Requirements 6.3**

- [x] 9. Configuración de Estaciones KDS
  - [x] 9.1 Crear página de estaciones
    - Usar estaciones existentes en schema
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 Implementar asignación de productos a estaciones
    - Usar campo station del producto
    - _Requirements: 7.3_

- [x] 10. Configuración del Negocio
  - [x] 10.1 Crear página de configuración
    - Crear `src/app/admin/configuracion/page.tsx`
    - Formulario para editar tenant_settings
    - _Requirements: 8.1_

  - [x] 10.2 Implementar validación de RUC
    - Validar formato de 11 dígitos en cliente y servidor
    - _Requirements: 8.2_

  - [x] 10.3 Write property test for RUC validation
    - **Property 10: Validación de RUC**
    - **Validates: Requirements 8.2**

  - [x] 10.4 Implementar restricción de configuración fiscal
    - Solo permitir edición de tax_rate a rol OWNER
    - _Requirements: 8.3_

  - [x] 10.5 Write property test for fiscal config restriction
    - **Property 11: Configuración Fiscal Restringida a OWNER**
    - **Validates: Requirements 8.3**

- [x] 11. Reportes de Ventas
  - [x] 11.1 Crear página de reportes
    - Crear `src/app/admin/reportes/page.tsx`
    - Opciones: diario, semanal, mensual
    - _Requirements: 9.1_

  - [x] 11.2 Implementar API de reportes
    - Crear `src/app/api/admin/reports/route.ts`
    - Retornar ventas_netas, descuentos, propinas, cantidad_órdenes
    - Desglose por método de pago
    - _Requirements: 9.2, 9.3_

  - [x] 11.3 Implementar exportación a Excel/CSV
    - Exportación CSV implementada en cliente
    - _Requirements: 9.4_

- [x] 12. Checkpoint Final
  - All 64 property tests pass
  - All modules implemented and functional
  - Responsive design with touch-friendly buttons (min 44x44px)

## Notas

- All property-based tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
