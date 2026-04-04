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

/**
 * Skeleton for paginated list items (2026 Modern)
 * Used with infinite scroll and virtual lists
 */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
      <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-3/4 h-4 rounded" />
        <Skeleton className="w-1/2 h-3 rounded" />
      </div>
      <Skeleton className="w-20 h-8 rounded-lg" />
    </div>
  );
}

/**
 * Skeleton for paginated list
 */
export function PaginatedListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for infinite scroll loading indicator
 */
export function InfiniteScrollLoader() {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <p className="text-sm text-zinc-400">Cargando más...</p>
      </div>
    </div>
  );
}

/**
 * Skeleton for table row (admin panels)
 */
export function TableRowSkeleton() {
  return (
    <tr className="border-b border-zinc-800">
      <td className="p-4"><Skeleton className="w-8 h-4 rounded" /></td>
      <td className="p-4"><Skeleton className="w-32 h-4 rounded" /></td>
      <td className="p-4"><Skeleton className="w-24 h-4 rounded" /></td>
      <td className="p-4"><Skeleton className="w-20 h-4 rounded" /></td>
      <td className="p-4"><Skeleton className="w-16 h-8 rounded-lg" /></td>
    </tr>
  );
}

/**
 * Skeleton for admin table
 */
export function AdminTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <table className="w-full">
        <thead className="bg-zinc-900/50">
          <tr className="border-b border-zinc-800">
            <th className="p-4 text-left"><Skeleton className="w-12 h-4 rounded" /></th>
            <th className="p-4 text-left"><Skeleton className="w-20 h-4 rounded" /></th>
            <th className="p-4 text-left"><Skeleton className="w-16 h-4 rounded" /></th>
            <th className="p-4 text-left"><Skeleton className="w-16 h-4 rounded" /></th>
            <th className="p-4 text-left"><Skeleton className="w-20 h-4 rounded" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compound Skeleton Variants (Design System Phase 2)
// ---------------------------------------------------------------------------

/**
 * Bloque de texto placeholder con multiples lineas.
 * La ultima linea es mas corta para simular texto real.
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4 rounded',
            i === lines - 1 ? 'w-4/5' : 'w-full',
          )}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton que imita la forma de un Card con padding.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-park-gray-900 border border-park-gray-800 rounded-xl p-6',
        className,
      )}
    >
      <SkeletonText lines={3} />
    </div>
  );
}

/**
 * Skeleton que imita una tabla de datos (DataTable).
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="rounded-xl border border-park-gray-800 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-park-gray-800 bg-park-gray-900/60">
            {Array.from({ length: columns }).map((_, c) => (
              <th key={c} className="p-4 text-left">
                <Skeleton className="h-4 w-20 rounded bg-park-gray-700" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-park-gray-800 last:border-b-0">
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="p-4">
                  <Skeleton className="h-4 w-full rounded" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton que imita un MetricCard: valor grande + etiqueta pequena.
 */
export function SkeletonMetricCard() {
  return (
    <div className="bg-park-gray-900 border border-park-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-8 w-32 rounded" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="mt-3">
        <Skeleton className="h-4 w-16 rounded" />
      </div>
    </div>
  );
}

/**
 * Skeleton que imita un PageHeader: titulo + descripcion.
 */
export function SkeletonPageHeader() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-8 w-2/5 rounded" />
      <Skeleton className="h-4 w-3/5 rounded" />
    </div>
  );
}

/**
 * Skeleton de pagina completa: PageHeader + 4 MetricCards + Table.
 * Ideal como fallback de Suspense a nivel de ruta.
 */
export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
