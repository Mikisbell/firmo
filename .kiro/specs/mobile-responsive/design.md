# Design Document: Mobile Responsive

## Overview

Este diseño implementa una estrategia Mobile-First completa para PARK POS usando técnicas modernas de CSS: Container Queries, Fluid Typography con clamp(), y patrones de UI móvil nativos como Bottom Sheets y Swipe Gestures.

## Architecture

### Estrategia de Breakpoints

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE FIRST APPROACH                     │
├─────────────────────────────────────────────────────────────┤
│  Base (0px+)     → Estilos móvil por defecto                │
│  sm (640px+)     → Ajustes para móviles grandes             │
│  md (768px+)     → Tablets portrait                         │
│  lg (1024px+)    → Tablets landscape / Desktop pequeño      │
│  xl (1280px+)    → Desktop                                  │
│  2xl (1536px+)   → Desktop grande / TV                      │
└─────────────────────────────────────────────────────────────┘
```

### Container Queries vs Media Queries

```
┌─────────────────────────────────────────────────────────────┐
│  MEDIA QUERIES (viewport)    │  CONTAINER QUERIES (parent)  │
├──────────────────────────────┼──────────────────────────────┤
│  - Layouts de página         │  - Componentes reutilizables │
│  - Headers/Footers           │  - CatalogGrid               │
│  - Navigation                │  - OrderPanel                │
│  - Page-level decisions      │  - ProductCard               │
└──────────────────────────────┴──────────────────────────────┘
```

## Components and Interfaces

### 1. Responsive Utilities (globals.css)

```css
/* Fluid Typography */
:root {
  --font-size-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  --font-size-sm: clamp(0.875rem, 0.8rem + 0.375vw, 1rem);
  --font-size-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --font-size-lg: clamp(1.125rem, 1rem + 0.625vw, 1.25rem);
  --font-size-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --font-size-2xl: clamp(1.5rem, 1.3rem + 1vw, 2rem);
  
  /* Fluid Spacing */
  --space-xs: clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem);
  --space-sm: clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem);
  --space-md: clamp(0.75rem, 0.6rem + 0.75vw, 1rem);
  --space-lg: clamp(1rem, 0.8rem + 1vw, 1.5rem);
  --space-xl: clamp(1.5rem, 1.2rem + 1.5vw, 2rem);
  
  /* Touch Targets */
  --touch-target-min: 44px;
  --button-min-height: 44px;
  --button-min-height-lg: 56px;
}

/* Container Query Support */
.container-responsive {
  container-type: inline-size;
}
```

### 2. BottomSheet Component

```typescript
interface BottomSheetProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  snapPoints?: ('collapsed' | 'half' | 'full')[];
  defaultSnap?: 'collapsed' | 'half' | 'full';
  collapsedHeight?: number;  // default: 80px (shows total)
  halfHeight?: string;       // default: '50vh'
}

// Estados del BottomSheet
type BottomSheetState = 'collapsed' | 'half' | 'full';

// Gestos soportados
// - Drag up: expand to next snap point
// - Drag down: collapse to previous snap point
// - Tap on handle: toggle between collapsed/half
// - Swipe down fast: close completely
```

### 3. OrderPanel Adaptativo

```typescript
interface OrderPanelProps {
  mode: 'sidebar' | 'bottomsheet' | 'auto';
  items: OrderItem[];
  subtotalCents: number;
  // ... otras props
}

// Comportamiento según modo:
// - 'sidebar': Siempre panel lateral (desktop)
// - 'bottomsheet': Siempre bottom sheet (móvil)
// - 'auto': Detecta viewport y cambia automáticamente
```

### 4. CatalogGrid con Container Queries

```css
/* Container Query based grid */
.catalog-grid-container {
  container-type: inline-size;
}

.catalog-grid {
  display: grid;
  gap: var(--space-sm);
  
  /* Default: 2 columns */
  grid-template-columns: repeat(2, 1fr);
}

@container (min-width: 400px) {
  .catalog-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@container (min-width: 600px) {
  .catalog-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@container (min-width: 800px) {
  .catalog-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}
```

### 5. SwipeableItem Component

```typescript
interface SwipeableItemProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;   // Reveal delete button
  onSwipeRight?: () => void;  // Optional action
  threshold?: number;         // Pixels to trigger (default: 80)
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
}
```

### 6. MobileHeader Component

```typescript
interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightActions?: React.ReactNode[];
  showBackButton?: boolean;
  onBack?: () => void;
  variant?: 'default' | 'transparent' | 'colored';
  hideOnScroll?: boolean;
}

// Altura fija: 56px en móvil, 64px en desktop
// Colapsa elementos secundarios en móvil
```

### 7. BottomNavigation Component

```typescript
interface BottomNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  href: string;
  badge?: number;
}

interface BottomNavigationProps {
  items: BottomNavItem[];
  activeId: string;
}

// Solo visible en viewport < 768px
// Altura fija: 64px
// Máximo 5 items
```

### 8. FAB (Floating Action Button)

```typescript
interface FABProps {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  badge?: number | string;
  position?: 'bottom-right' | 'bottom-center';
  extended?: boolean;  // Shows label
}

// Usado en móvil para mostrar total del pedido
// Posición: bottom-right, 16px del borde
// Tamaño: 56x56px (o extended con label)
```

## Data Models

### Responsive Context

```typescript
interface ResponsiveContext {
  isMobile: boolean;      // < 768px
  isTablet: boolean;      // 768px - 1024px
  isDesktop: boolean;     // > 1024px
  isLandscape: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

// Hook: useResponsive()
function useResponsive(): ResponsiveContext;
```

### Touch Gesture State

```typescript
interface GestureState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  velocity: number;
  direction: 'left' | 'right' | 'up' | 'down' | null;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: Touch Targets Minimum Size

*For any* interactive element (button, link, input, clickable area) in the application, its computed dimensions SHALL be at least 44x44 pixels.

**Validates: Requirements 1.5, 5.3, 10.1**

### Property 2: Spacing Between Touch Targets

*For any* two adjacent interactive elements, the gap between them SHALL be at least 8 pixels to prevent accidental taps.

**Validates: Requirements 10.2**

### Property 3: Virtualization Efficiency

*For any* list with more than 20 items, the number of rendered DOM nodes SHALL be less than or equal to the visible items plus a buffer of 5 items.

**Validates: Requirements 4.7, 9.2**

### Property 4: Product Card Height Bounds

*For any* ProductCard component, its rendered height SHALL be between 80px and 120px inclusive.

**Validates: Requirements 4.5**

### Property 5: Image Lazy Loading

*For any* product image in the catalog, the img element SHALL have loading="lazy" attribute.

**Validates: Requirements 9.3**

### Property 6: Action Button Minimum Height

*For any* primary action button (Send to Kitchen, Pay, etc.), its computed height SHALL be at least 56px on mobile viewports.

**Validates: Requirements 5.6**

### Property 7: Grid Column Responsiveness

*For any* CatalogGrid container width W:
- If W < 400px, columns SHALL equal 2
- If 400px <= W < 600px, columns SHALL equal 3
- If W >= 600px, columns SHALL equal 4 or more

**Validates: Requirements 4.2, 4.3, 4.4**

## Error Handling

### Gesture Conflicts

```typescript
// Prevent scroll while dragging bottom sheet
function preventScrollDuringDrag(isDragging: boolean) {
  if (isDragging) {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  } else {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }
}
```

### Viewport Detection Fallback

```typescript
// SSR-safe viewport detection
function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });
  
  // ... resize listener
}
```

### Container Query Fallback

```css
/* Fallback for browsers without Container Query support */
@supports not (container-type: inline-size) {
  .catalog-grid {
    /* Use media queries as fallback */
  }
  
  @media (min-width: 640px) {
    .catalog-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
}
```

## Testing Strategy

### Unit Tests

- Test useResponsive hook returns correct values for different viewport sizes
- Test BottomSheet snap point calculations
- Test SwipeableItem gesture threshold detection
- Test FAB badge rendering

### Property-Based Tests

Cada property debe implementarse como un test con mínimo 100 iteraciones:

1. **Touch Targets Test**: Generar elementos interactivos aleatorios, verificar dimensiones >= 44x44
2. **Spacing Test**: Generar pares de elementos adyacentes, verificar gap >= 8px
3. **Virtualization Test**: Generar listas de N items (N > 20), verificar DOM nodes <= visible + 5
4. **Card Height Test**: Generar ProductCards con diferentes contenidos, verificar 80 <= height <= 120
5. **Lazy Loading Test**: Generar catálogos con imágenes, verificar loading="lazy"
6. **Button Height Test**: Generar action buttons en móvil, verificar height >= 56px
7. **Grid Columns Test**: Generar containers de diferentes anchos, verificar columnas correctas

### Integration Tests (Playwright)

- Test responsive layout changes at breakpoints
- Test bottom sheet gestures (drag, snap)
- Test swipe-to-delete functionality
- Test bottom navigation visibility
- Test orientation changes

### Visual Regression Tests

- Capture screenshots at each breakpoint
- Compare against baseline images
- Flag visual differences > 1%
