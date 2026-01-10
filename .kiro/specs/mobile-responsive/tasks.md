# Implementation Plan: Mobile Responsive

## Overview

Implementación Mobile-First completa para PARK POS. Se crearán componentes reutilizables, se actualizarán los estilos globales, y se refactorizarán las páginas críticas para ser 100% responsivas.

## Tasks

- [x] 1. Configurar CSS Utilities Mobile-First
  - [x] 1.1 Agregar variables CSS fluidas en globals.css
    - Fluid typography con clamp()
    - Fluid spacing con clamp()
    - Touch target variables
    - _Requirements: 1.1, 1.3, 1.4, 1.5_
  - [x] 1.2 Agregar soporte para Container Queries
    - Clase .container-responsive
    - Fallback para browsers sin soporte
    - _Requirements: 1.2_
  - [x] 1.3 Crear hook useResponsive
    - Detectar viewport width/height
    - Flags: isMobile, isTablet, isDesktop, isLandscape
    - SSR-safe
    - _Requirements: 11.1_

- [-] 2. Crear componente BottomSheet
  - [x] 2.1 Implementar BottomSheet base
    - Props: isOpen, onClose, snapPoints, defaultSnap
    - Estados: collapsed, half, full
    - Animaciones con framer-motion
    - _Requirements: 3.2, 5.2_
  - [x] 2.2 Implementar gestos de drag
    - Drag up/down para cambiar snap point
    - Velocity detection para snap rápido
    - Prevent scroll durante drag
    - _Requirements: 3.7, 5.1_
  - [x] 2.3 Write property test for BottomSheet snap points
    - **Property: Snap point transitions**
    - **Validates: Requirements 3.7**

- [x] 3. Crear componente SwipeableItem
  - [x] 3.1 Implementar SwipeableItem
    - Swipe left revela acción (delete)
    - Threshold configurable (default 80px)
    - Spring animation al soltar
    - _Requirements: 3.6, 5.4_
  - [x] 3.2 Write unit tests for SwipeableItem
    - Test threshold detection
    - Test action reveal
    - _Requirements: 3.6_

- [x] 4. Crear componente MobileHeader
  - [x] 4.1 Implementar MobileHeader
    - Altura: 56px móvil, 64px desktop
    - Props: title, subtitle, leftAction, rightActions
    - Variantes: default, transparent, colored
    - _Requirements: 6.1, 6.2, 6.5_
  - [x] 4.2 Implementar hide-on-scroll
    - Ocultar header al scroll down
    - Mostrar al scroll up
    - _Requirements: 6.6_

- [x] 5. Crear componente BottomNavigation
  - [x] 5.1 Implementar BottomNavigation
    - Solo visible en viewport < 768px
    - Altura fija: 64px
    - Máximo 5 items con iconos + labels
    - Active state con indicador
    - _Requirements: 2.7, 6.3, 6.4_
  - [x] 5.2 Write unit tests for BottomNavigation
    - Test visibility en diferentes viewports
    - Test active state
    - _Requirements: 2.7_

- [x] 6. Crear componente FAB
  - [x] 6.1 Implementar FAB (Floating Action Button)
    - Tamaño: 56x56px
    - Badge para mostrar cantidad/total
    - Posición: bottom-right
    - Variante extended con label
    - _Requirements: 3.3_

- [x] 7. Refactorizar CatalogGrid con Container Queries
  - [x] 7.1 Actualizar CatalogGrid para usar Container Queries
    - Wrapper con container-type: inline-size
    - Grid columns según container width
    - Fallback con media queries
    - _Requirements: 3.5, 4.1, 4.2, 4.3, 4.4_
  - [ ] 7.2 Write property test for grid columns
    - **Property 7: Grid Column Responsiveness**
    - **Validates: Requirements 4.2, 4.3, 4.4**
  - [ ] 7.3 Implementar Virtualization para listas largas
    - Usar react-window o similar
    - Activar cuando items > 50
    - _Requirements: 4.7, 9.2_
  - [ ] 7.4 Write property test for virtualization
    - **Property 3: Virtualization Efficiency**
    - **Validates: Requirements 4.7, 9.2**

- [x] 8. Refactorizar OrderPanel para ser adaptativo
  - [x] 8.1 Actualizar OrderPanel con modo auto
    - Detectar viewport y cambiar modo
    - Sidebar en desktop, BottomSheet en móvil
    - _Requirements: 5.1_
  - [x] 8.2 Integrar SwipeableItem en items del pedido
    - Swipe left para eliminar
    - _Requirements: 5.4_
  - [x] 8.3 Hacer Total sticky
    - Siempre visible independiente del scroll
    - _Requirements: 5.5_
  - [x] 8.4 Aumentar tamaño de botones de acción
    - Min-height: 56px en móvil
    - Touch targets: 44x44px en controles +/-
    - _Requirements: 5.3, 5.6_
  - [x] 8.5 Write property test for touch targets
    - **Property 1: Touch Targets Minimum Size**
    - **Validates: Requirements 1.5, 5.3, 10.1**

- [x] 9. Refactorizar página /mozo
  - [x] 9.1 Actualizar Header del mozo
    - Usar MobileHeader en móvil
    - Colapsar counters a badges
    - _Requirements: 2.1, 2.6_
  - [x] 9.2 Actualizar Grid de mesas
    - 2 cols móvil, 3 tablet, 4+ desktop
    - Aspect ratio 1:1 en móvil
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 9.3 Actualizar Zone Selector
    - Scroll horizontal con scroll-snap
    - _Requirements: 2.5_
  - [x] 9.4 Agregar BottomNavigation
    - Items: Mesas, Pedido, Config
    - _Requirements: 2.7_

- [x] 10. Refactorizar página /mozo/mesa/[id]
  - [x] 10.1 Implementar layout responsivo
    - Single column + BottomSheet en móvil
    - Side-by-side en tablet+
    - _Requirements: 3.1, 3.4_
  - [x] 10.2 Agregar FAB con total
    - Mostrar cantidad de items y total
    - Click abre BottomSheet
    - _Requirements: 3.3_
  - [x] 10.3 Integrar OrderPanel adaptativo
    - Usar modo 'auto'
    - _Requirements: 3.2_

- [x] 11. Checkpoint - Verificar páginas del mozo
  - Probar en móvil real o emulador
  - Verificar gestos funcionan correctamente
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Refactorizar KDS (/cocina, /bar)
  - [x] 12.1 Actualizar layout de tickets
    - 1 col en móvil, 2-3 en tablet, 4+ en desktop
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 12.2 Aumentar tipografía
    - Min 18px para legibilidad a distancia
    - _Requirements: 7.5_
  - [x] 12.3 Hacer timer prominente
    - Colores de alerta según tiempo
    - _Requirements: 7.6_

- [ ] 13. Refactorizar POS (/pos)
  - [ ] 13.1 Agregar warning para móvil
    - Mostrar mensaje "usar tablet o desktop" en < 768px
    - _Requirements: 8.2_
  - [ ] 13.2 Optimizar Numpad
    - Botones mínimo 60x60px
    - _Requirements: 8.3_
  - [ ] 13.3 Hacer Payment Modal fullscreen en móvil
    - _Requirements: 8.4_

- [ ] 14. Implementar optimizaciones de performance
  - [ ] 14.1 Agregar Skeleton Loading
    - En listas de mesas, productos, pedidos
    - _Requirements: 9.1_
  - [ ] 14.2 Implementar lazy loading de imágenes
    - loading="lazy" en todas las imágenes de productos
    - _Requirements: 9.3_
  - [ ] 14.3 Write property test for lazy loading
    - **Property 5: Image Lazy Loading**
    - **Validates: Requirements 9.3**
  - [ ] 14.4 Implementar prefetch de rutas
    - Prefetch /mesa/[id] al hover en mesa
    - _Requirements: 9.4_

- [ ] 15. Implementar accesibilidad táctil
  - [ ] 15.1 Verificar y corregir Touch Targets
    - Auditar todos los elementos interactivos
    - Corregir los que sean < 44x44px
    - _Requirements: 10.1_
  - [ ] 15.2 Verificar spacing entre elementos
    - Mínimo 8px entre elementos táctiles
    - _Requirements: 10.2_
  - [ ] 15.3 Write property test for spacing
    - **Property 2: Spacing Between Touch Targets**
    - **Validates: Requirements 10.2**
  - [ ] 15.4 Agregar feedback visual en touch
    - Active states en todos los botones
    - _Requirements: 10.3_
  - [ ] 15.5 Agregar confirmación para acciones destructivas
    - Modal o toast con undo
    - _Requirements: 10.5_

- [ ] 16. Soporte de orientación
  - [ ] 16.1 Verificar layouts en landscape
    - Ajustar layouts para aprovechar ancho
    - _Requirements: 11.2_
  - [ ] 16.2 Agregar recomendación de orientación en KDS
    - Sugerir landscape pero funcionar en portrait
    - _Requirements: 11.3_

- [ ] 17. Final Checkpoint
  - Probar todas las páginas en móvil, tablet, desktop
  - Probar en portrait y landscape
  - Verificar performance con Lighthouse
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Todos los tests son requeridos para garantizar calidad
- Priorizar páginas del mozo (más usadas en móvil)
- Usar Chrome DevTools para emular dispositivos
- Probar en dispositivos reales antes de deploy
- Container Queries tienen buen soporte (Chrome 105+, Safari 16+, Firefox 110+)
