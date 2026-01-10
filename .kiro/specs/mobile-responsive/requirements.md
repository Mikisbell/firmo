# Requirements Document

## Introduction

PARK POS debe ser 100% funcional en cualquier dispositivo. El sistema debe implementar una estrategia Mobile-First con técnicas modernas de CSS (Container Queries, Clamp, Fluid Typography) para garantizar una experiencia óptima desde celulares de 320px hasta pantallas de 4K.

## Glossary

- **Mobile_First**: Estrategia de diseño que prioriza móvil y escala hacia arriba
- **Container_Query**: CSS que responde al tamaño del contenedor padre, no del viewport
- **Fluid_Typography**: Tipografía que escala proporcionalmente sin breakpoints fijos
- **Touch_Target**: Área mínima táctil (44x44px según WCAG)
- **Skeleton_Loading**: Placeholder animado mientras carga contenido
- **Virtualization**: Renderizar solo elementos visibles en listas largas
- **Bottom_Sheet**: Panel deslizable desde abajo (patrón móvil nativo)
- **Breakpoint**: sm(640px), md(768px), lg(1024px), xl(1280px)

## Requirements

### Requirement 1: Estrategia Mobile-First Global

**User Story:** Como desarrollador, quiero una arquitectura CSS Mobile-First, para que el código sea mantenible y performante.

#### Acceptance Criteria

1. THE Sistema SHALL usar CSS Mobile-First (estilos base para móvil, media queries para escalar)
2. THE Sistema SHALL implementar Container Queries para componentes reutilizables
3. THE Sistema SHALL usar clamp() para tipografía fluida (min: 14px, preferred: 1vw, max: 18px)
4. THE Sistema SHALL definir spacing fluido con clamp() (padding, margins, gaps)
5. THE Sistema SHALL garantizar Touch Targets mínimos de 44x44px en todos los elementos interactivos

### Requirement 2: Página Principal del Mozo (/mozo)

**User Story:** Como mesero, quiero ver y seleccionar mesas desde mi celular, para tomar pedidos sin depender de tablets.

#### Acceptance Criteria

1. WHEN viewport < 640px, THE Header SHALL colapsar a una sola línea con iconos
2. WHEN viewport < 640px, THE Grid de mesas SHALL mostrar 2 columnas con aspect-ratio 1:1
3. WHEN viewport >= 640px AND < 1024px, THE Grid SHALL mostrar 3 columnas
4. WHEN viewport >= 1024px, THE Grid SHALL mostrar 4+ columnas
5. THE Zone_Selector SHALL ser scrollable horizontal con scroll-snap en móvil
6. THE Counters (ocupadas, alertas) SHALL colapsarse a iconos con badges en móvil
7. THE Sistema SHALL mostrar Bottom Navigation fija en móvil con: Mesas, Pedido, Config

### Requirement 3: Página de Mesa Individual (/mozo/mesa/[id])

**User Story:** Como mesero, quiero agregar items a un pedido desde mi celular, para trabajar eficientemente.

#### Acceptance Criteria

1. WHEN viewport < 768px, THE Layout SHALL ser single-column con Bottom Sheet para el pedido
2. WHEN viewport < 768px, THE Order_Panel SHALL ser un Bottom Sheet deslizable (collapsed/expanded)
3. WHEN viewport < 768px, THE Sistema SHALL mostrar FAB (Floating Action Button) con total y cantidad
4. WHEN viewport >= 768px, THE Layout SHALL ser side-by-side (catálogo + panel)
5. THE CatalogGrid SHALL usar Container Queries para adaptarse a su contenedor
6. THE Items del pedido SHALL soportar swipe-to-delete en móvil
7. THE Bottom_Sheet SHALL soportar gestos drag up/down para expandir/colapsar

### Requirement 4: Catálogo de Productos (CatalogGrid)

**User Story:** Como usuario, quiero navegar el catálogo fácilmente en cualquier dispositivo, para encontrar productos rápido.

#### Acceptance Criteria

1. THE CatalogGrid SHALL usar Container Queries (no media queries)
2. WHEN container < 400px, THE Grid SHALL mostrar 2 columnas
3. WHEN container >= 400px AND < 600px, THE Grid SHALL mostrar 3 columnas
4. WHEN container >= 600px, THE Grid SHALL mostrar 4+ columnas
5. THE Product_Cards SHALL tener altura mínima de 80px y máxima de 120px
6. THE Categorías SHALL ser tabs scrollables horizontalmente en móvil
7. THE Sistema SHALL implementar Virtualization si hay más de 50 productos visibles

### Requirement 5: Panel de Pedido (OrderPanel)

**User Story:** Como usuario, quiero ver y modificar mi pedido actual en cualquier dispositivo, para mantener control de la cuenta.

#### Acceptance Criteria

1. THE OrderPanel SHALL ser un componente adaptativo (sidebar en desktop, bottom sheet en móvil)
2. WHEN modo bottom_sheet, THE Panel SHALL tener 3 estados: collapsed (solo total), half (lista), full (lista + acciones)
3. THE Items SHALL mostrar controles +/- con Touch Targets de 44px
4. THE Swipe_Left en items SHALL revelar botón de eliminar
5. THE Total SHALL ser siempre visible (sticky) independiente del scroll
6. THE Acciones (Enviar, Cuenta) SHALL ser botones grandes (min-height: 56px) en móvil

### Requirement 6: Headers y Navegación

**User Story:** Como usuario móvil, quiero navegar sin que el header ocupe demasiado espacio, para ver más contenido.

#### Acceptance Criteria

1. WHEN viewport < 640px, THE Headers SHALL tener altura máxima de 56px
2. WHEN viewport < 640px, THE Headers SHALL mostrar solo iconos esenciales
3. THE Sistema SHALL implementar Bottom Navigation en páginas principales (mozo, pos)
4. THE Bottom_Navigation SHALL tener 3-5 items máximo con iconos + labels cortos
5. THE Headers SHALL usar backdrop-blur para transparencia elegante
6. IF scroll down, THE Header SHOULD ocultarse parcialmente (hide on scroll)

### Requirement 7: KDS y Pantallas de Cocina

**User Story:** Como cocinero, quiero ver los pedidos claramente en pantallas de diferentes tamaños, para no perder órdenes.

#### Acceptance Criteria

1. THE KDS SHALL soportar desde tablets 10" hasta TVs 55"
2. WHEN viewport < 768px, THE KDS SHALL mostrar 1 columna de tickets
3. WHEN viewport >= 768px AND < 1280px, THE KDS SHALL mostrar 2-3 columnas
4. WHEN viewport >= 1280px, THE KDS SHALL mostrar 4+ columnas
5. THE Tickets SHALL usar tipografía grande (min 18px) para legibilidad a distancia
6. THE Timer de cada ticket SHALL ser prominente con colores de alerta

### Requirement 8: Página de Caja/POS

**User Story:** Como cajero, quiero usar el POS en tablet o desktop, para procesar pagos eficientemente.

#### Acceptance Criteria

1. THE POS SHALL optimizarse para tablets (768px+) como dispositivo principal
2. WHEN viewport < 768px, THE POS SHALL mostrar warning de "usar tablet o desktop"
3. THE Numpad SHALL tener botones de mínimo 60x60px para precisión táctil
4. THE Payment_Modal SHALL ser fullscreen en móvil, modal centrado en desktop
5. THE Split_Bill UI SHALL adaptarse a pantallas pequeñas con scroll vertical

### Requirement 9: Performance Móvil

**User Story:** Como usuario móvil, quiero que la app cargue rápido y sea fluida, para no perder tiempo.

#### Acceptance Criteria

1. THE Sistema SHALL implementar Skeleton Loading en todas las listas
2. THE Sistema SHALL usar Virtualization (react-window) para listas > 20 items
3. THE Sistema SHALL lazy-load imágenes de productos
4. THE Sistema SHALL prefetch rutas probables (ej: al hover en mesa, prefetch /mesa/[id])
5. THE First Contentful Paint SHALL ser < 1.5s en 3G
6. THE Time to Interactive SHALL ser < 3s en 3G

### Requirement 10: Accesibilidad Táctil

**User Story:** Como usuario, quiero que todos los elementos sean fáciles de tocar, para no cometer errores.

#### Acceptance Criteria

1. THE Sistema SHALL garantizar Touch Targets mínimos de 44x44px (WCAG 2.1)
2. THE Sistema SHALL tener spacing mínimo de 8px entre elementos táctiles
3. THE Sistema SHALL proporcionar feedback visual inmediato en touch (active states)
4. THE Sistema SHALL soportar gestos estándar: tap, long-press, swipe
5. IF acción destructiva, THE Sistema SHALL requerir confirmación o permitir undo

### Requirement 11: Orientación de Pantalla

**User Story:** Como usuario, quiero usar la app en portrait o landscape, según mi preferencia.

#### Acceptance Criteria

1. THE Sistema SHALL soportar ambas orientaciones sin romper el layout
2. WHEN landscape en móvil, THE Sistema SHALL ajustar layouts para aprovechar el ancho
3. THE KDS SHALL recomendar landscape pero funcionar en portrait
4. THE POS SHALL funcionar óptimamente en landscape para tablets
