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
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonMetricCard,
  SkeletonPageHeader,
  SkeletonPage,
} from './Skeleton';

// Skeleton Delay (anti-flash/anti-flicker wrapper)
export { SkeletonDelay } from './SkeletonDelay';

// Detail Drawer (Stripe ContextView pattern)
export { DetailDrawer } from './DetailDrawer';
export type { DetailDrawerProps } from './DetailDrawer';

// Optimized Image
export { OptimizedImage, ProductImage } from './OptimizedImage';

// Confirm Action
export { ConfirmAction } from './ConfirmAction';
export type { ConfirmActionProps } from './ConfirmAction';

// Orientation Hint
export { OrientationHint } from './OrientationHint';
export type { OrientationHintProps } from './OrientationHint';

// Tooltip
export { Tooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';

// Tabs
export { Tabs, TabsContent } from './Tabs';
export type { TabsProps, TabsContentProps, TabItem } from './Tabs';

// Breadcrumbs
export { Breadcrumbs } from './Breadcrumbs';
export type { BreadcrumbsProps, BreadcrumbItem } from './Breadcrumbs';

// Command Palette
export { CommandPalette } from './CommandPalette';

// Keyboard Shortcuts
export { KeyboardShortcuts } from './KeyboardShortcuts';

// Design System Phase 1
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { Card, CardHeader, CardContent, CardFooter } from './Card';
export type { CardProps, CardPadding, CardSectionProps } from './Card';

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { MetricCard } from './MetricCard';
export type { MetricCardProps } from './MetricCard';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// Design System — Form Components
export { Input } from './Input';
export type { InputProps } from './Input';

export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

export { FormField } from './FormField';
export type { FormFieldProps } from './FormField';

// Modal (centered dialog — different from DetailDrawer which slides from right)
export { Modal } from './Modal';
export type { ModalProps, ModalSize } from './Modal';

// Toast (sonner wrapper with PARK styling)
export { toast } from './Toast';

// Progress bar
export { Progress } from './Progress';
export type {
  ProgressProps,
  ProgressVariant,
  ProgressSize,
} from './Progress';

// Avatar + AvatarGroup
export { Avatar, AvatarGroup } from './Avatar';
export type {
  AvatarProps,
  AvatarSize,
  AvatarStatus,
  AvatarGroupProps,
  AvatarGroupSize,
} from './Avatar';

// Alert / banner
export { Alert } from './Alert';
export type { AlertProps, AlertVariant } from './Alert';

// Pagination (Design System)
export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';

// Dropdown (context menu)
export { Dropdown } from './Dropdown';
export type { DropdownProps, DropdownItem } from './Dropdown';

// DatePicker (native date input)
export { DatePicker } from './DatePicker';
export type { DatePickerProps } from './DatePicker';

// FileUpload (drag-and-drop + click to select)
export { FileUpload } from './FileUpload';
export type { FileUploadProps } from './FileUpload';

// Stepper (multi-step wizard indicator)
export { Stepper } from './Stepper';
export type { StepperProps, Step } from './Stepper';

// ConfirmDialog (confirmation modal wrapping Modal)
export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

// RadioGroup (accessible radio button group)
export { RadioGroup } from './RadioGroup';
export type { RadioGroupProps, RadioOption } from './RadioGroup';

// Popover (rich tooltip with arbitrary JSX content)
export { Popover } from './Popover';
export type {
  PopoverProps,
  PopoverSide,
  PopoverAlign,
  PopoverTriggerMode,
} from './Popover';

// ToggleGroup (exclusive button group — radio-like)
export { ToggleGroup } from './ToggleGroup';
export type {
  ToggleGroupProps,
  ToggleOption,
  ToggleGroupSize,
} from './ToggleGroup';

// Accordion (expandable/collapsible sections)
export { Accordion } from './Accordion';
export type { AccordionProps, AccordionItem } from './Accordion';
