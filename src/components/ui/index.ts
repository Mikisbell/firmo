/**
 * UI Components - Mobile Responsive
 * 
 * Export all mobile-first UI components
 */

// Bottom Sheet
export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps, SnapPoint } from './BottomSheet';

// Swipeable Item
export { SwipeableItem } from './SwipeableItem';
export type { SwipeableItemProps } from './SwipeableItem';

// Mobile Header
export { MobileHeader, HeaderSpacer } from './MobileHeader';
export type { MobileHeaderProps } from './MobileHeader';

// Bottom Navigation
export { BottomNavigation, useBottomNavVisible } from './BottomNavigation';
export type { BottomNavigationProps, BottomNavItem } from './BottomNavigation';

// FAB (Floating Action Button)
export { FAB, OrderFAB } from './FAB';
export type { FABProps, OrderFABProps } from './FAB';

// Mobile Warning
export { MobileWarning } from './MobileWarning';
export type { default as MobileWarningProps } from './MobileWarning';

// Skeleton Loading
export { 
  Skeleton,
  ProductCardSkeleton,
  CatalogGridSkeleton,
  TableCardSkeleton,
  TablesGridSkeleton,
  LineItemSkeleton,
  OrderPanelSkeleton,
  KDSTicketSkeleton,
  KDSGridSkeleton,
  PageSkeleton,
} from './Skeleton';

// Optimized Image
export { OptimizedImage, ProductImage } from './OptimizedImage';

// Confirm Action
export { ConfirmAction } from './ConfirmAction';
export type { ConfirmActionProps } from './ConfirmAction';

// Orientation Hint
export { OrientationHint } from './OrientationHint';
export type { OrientationHintProps } from './OrientationHint';
