"use client";

/**
 * Skeleton Loading Components
 * Provides loading placeholders for various UI elements
 * 
 * Task 14.1 - Mobile Responsive Spec
 * Requirements: 9.1
 */

import { cn } from "@/src/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Base Skeleton component with pulse animation
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-zinc-800/50",
        className
      )}
    />
  );
}

/**
 * Skeleton for product cards in catalog grid
 */
export function ProductCardSkeleton() {
  return (
    <div className="p-3 md:p-4 min-h-[100px] md:min-h-[140px] lg:min-h-[160px] rounded-xl md:rounded-2xl border border-zinc-800 bg-zinc-900/80">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl" />
        <Skeleton className="w-16 h-4 rounded" />
      </div>
      <div className="mt-auto space-y-2">
        <Skeleton className="w-full h-4 rounded" />
        <Skeleton className="w-2/3 h-4 rounded" />
        <Skeleton className="w-20 h-6 rounded mt-2" />
      </div>
    </div>
  );
}

/**
 * Skeleton grid for catalog loading state
 */
export function CatalogGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for table/mesa cards
 */
export function TableCardSkeleton() {
  return (
    <div className="aspect-square rounded-xl md:rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 md:p-4">
      <div className="flex justify-between items-start mb-2">
        <Skeleton className="w-12 h-6 rounded" />
        <Skeleton className="w-6 h-6 rounded-full" />
      </div>
      <Skeleton className="w-full h-4 rounded mt-auto" />
    </div>
  );
}

/**
 * Skeleton grid for tables loading state
 */
export function TablesGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <TableCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for order/line items
 */
export function LineItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-700/50 bg-zinc-800/50">
      <div className="flex-1 space-y-2">
        <Skeleton className="w-3/4 h-4 rounded" />
        <Skeleton className="w-1/2 h-3 rounded" />
      </div>
      <div className="flex items-center gap-2 ml-2">
        <Skeleton className="w-20 h-8 rounded-lg" />
        <Skeleton className="w-16 h-5 rounded" />
      </div>
    </div>
  );
}

/**
 * Skeleton for order panel
 */
export function OrderPanelSkeleton({ itemCount = 3 }: { itemCount?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: itemCount }).map((_, i) => (
        <LineItemSkeleton key={i} />
      ))}
      <div className="pt-3 border-t border-zinc-800/50 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="w-20 h-4 rounded" />
          <Skeleton className="w-16 h-4 rounded" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="w-16 h-6 rounded" />
          <Skeleton className="w-24 h-6 rounded" />
        </div>
      </div>
      <Skeleton className="w-full h-12 rounded-xl" />
    </div>
  );
}

/**
 * Skeleton for KDS ticket
 */
export function KDSTicketSkeleton() {
  return (
    <div className="bg-zinc-900/90 rounded-xl md:rounded-2xl border-2 border-zinc-700/50 overflow-hidden">
      <div className="p-3 md:p-4 bg-zinc-800/50 border-b-2 border-zinc-700/50">
        <div className="flex justify-between items-center">
          <Skeleton className="w-16 h-8 rounded" />
          <Skeleton className="w-20 h-6 rounded-full" />
        </div>
      </div>
      <div className="p-2 md:p-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="w-full h-12 md:h-14 rounded-lg md:rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton grid for KDS tickets
 */
export function KDSGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <KDSTicketSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Full page skeleton with header
 */
export function PageSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header skeleton */}
      <div className="h-14 md:h-16 bg-zinc-900/50 border-b border-zinc-800 flex items-center px-4 gap-4">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-32 h-6 rounded" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="w-20 h-8 rounded-lg" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </div>
      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default Skeleton;
